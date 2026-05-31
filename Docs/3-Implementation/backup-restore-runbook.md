# Backup & Restore Runbook

Procedures for backing up and restoring the Business DB and Crypto DB. Crypto DB restore is the highest-stakes operation in the platform.

Backup tool: **Percona XtraBackup** (hot physical backup for MySQL 8). See [tools.md — Database Backup](tools.md#database-backup).

---

## 1. Backup parameters (recap)

| DB | Full | Binary log flush (PITR) | Retention | Backup encryption |
|---|---|---|---|---|
| Business DB | Daily 02:00 UTC | Hourly | 30 days | Storage-level (matches host TDE) |
| Crypto DB | Daily 03:00 UTC | Hourly | 90 days | XtraBackup `--encrypt` with a backup-specific encryption key (separate from `CRYPTO_KEK`) |

The Crypto DB backup encryption key is stored in OpenBao at `nexus-ca/prod/crypto-db-backup-key`.

---

## 2. Backup execution (scheduled)

Backups are driven by cron on the dedicated backup host. The cron unit `/etc/cron.d/nexus-ca-backups` invokes the scripts below.

### 2.1 Business DB

```bash
/opt/nexus-ca/scripts/backup-business-db.sh full   # daily at 02:00 UTC
/opt/nexus-ca/scripts/backup-business-db.sh binlog # hourly at :05
```

The full backup copy is written to `/backups/business/full/YYYY-MM-DD/`. Binary log archives go to `/backups/business/binlog/YYYY-MM-DD/`. Retention enforcement uses `find -mtime +30 -delete` after each full backup.

### 2.2 Crypto DB

```bash
/opt/nexus-ca/scripts/backup-crypto-db.sh full   # daily at 03:00 UTC
/opt/nexus-ca/scripts/backup-crypto-db.sh binlog # hourly at :05
```

Backups land in a VLAN 4 backup volume; they are never copied out of VLAN 4. The script:

1. Pulls the backup encryption key from OpenBao.
2. Runs `xtrabackup --backup --encrypt=AES256 --encrypt-key-file=<keyfile>` to a fresh directory.
3. Records the active `CRYPTO_KEK_ID` at backup time in `backup-manifest.json` so a future restore knows which KEK is required.
4. Computes SHA-256 of every file and writes to `checksums.txt`.

---

## 3. Restore — Business DB

### 3.1 When to restore

- Logical data corruption (operator error wiping audit log via a DB-side incident).
- Hardware loss of the Business DB host.
- DR failover (see [disaster-recovery.md](disaster-recovery.md)).

### 3.2 Procedure (full restore, latest backup, no PITR)

```bash
# 1. Stop the Business Logic API instances — no writes during restore
./scripts/bl-stop-all.sh

# 2. Stop the BDB container
ssh prod-bdb-host 'docker compose stop bdb'

# 3. Move the corrupted data directory aside
ssh prod-bdb-host 'sudo mv /var/lib/mysql /var/lib/mysql.corrupt-$(date -u +%FT%TZ)'

# 4. Prepare the latest full backup
ssh prod-backup-host 'xtrabackup --prepare --target-dir=/backups/business/full/LATEST'

# 5. Copy the prepared backup into the data directory
ssh prod-backup-host 'sudo rsync -aH /backups/business/full/LATEST/ prod-bdb-host:/var/lib/mysql/'
ssh prod-bdb-host 'sudo chown -R mysql:mysql /var/lib/mysql'

# 6. Start BDB
ssh prod-bdb-host 'docker compose up -d bdb'

# 7. Verify
mysql -h prod-bdb -e "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM audit_events;"
mysql -h prod-bdb -e "SELECT MAX(occurred_at) FROM audit_events;"

# 8. Restart BL
./scripts/bl-start-all.sh

# 9. Smoke test (deployment-runbook §9)
```

### 3.3 Point-in-time recovery (PITR) — Business DB

Used when the corruption time is known and you want to roll forward past the last full backup but stop before the corruption.

```bash
# Prepare with --apply-log-only so binlogs can be applied afterward
xtrabackup --prepare --apply-log-only --target-dir=/backups/business/full/LATEST

# Copy data into place (as §3.2 steps 5-6)

# Apply binlogs up to the target stop time
mysqlbinlog --stop-datetime='2026-05-31 14:23:00' /backups/business/binlog/2026-05-31/*.bin | mysql -h prod-bdb

# Verify last applied timestamp matches expectation
mysql -h prod-bdb -e "SELECT MAX(occurred_at) FROM audit_events;"

# Continue with §3.2 step 7+
```

---

## 4. Restore — Crypto DB

The most critical operation in the platform. **No** Crypto DB restore should happen without two-person presence and Platform Owner approval.

### 4.1 Pre-restore checklist

| # | Check | Verification |
|---|---|---|
| 1 | Two operators present (A=executor, B=witness) | In person |
| 2 | Platform Owner approval recorded | Ticket reference |
| 3 | The `CRYPTO_KEK` that matches the backup is available | Read `backup-manifest.json` → `kek_id`; verify the matching KEK still exists in OpenBao or offline archive |
| 4 | The backup encryption key is available | OpenBao `nexus-ca/prod/crypto-db-backup-key` (the key in effect at backup time — check manifest) |
| 5 | Crypto DB host is reachable; CDB container is stopped | `docker compose ps cdb` shows `Exit` |
| 6 | A test signing CA has been chosen for the post-restore verification | Pick a Root CA from the backup that is `ACTIVE` |

### 4.2 Procedure

```bash
# 1. Stop CA instances
./scripts/ca-stop-all.sh

# 2. Stop CDB
ssh prod-cdb-host 'docker compose stop cdb'

# 3. Move corrupted data aside
ssh prod-cdb-host 'sudo mv /var/lib/mysql-crypto /var/lib/mysql-crypto.corrupt-$(date -u +%FT%TZ)'

# 4. Decrypt and prepare backup
ssh prod-backup-host-vlan4 << 'EOF'
  BACKUP_KEY=$(openbao kv get -field=value nexus-ca/prod/crypto-db-backup-key)
  xtrabackup --decrypt=AES256 --encrypt-key=$BACKUP_KEY --target-dir=/backups/crypto/full/LATEST
  xtrabackup --prepare --target-dir=/backups/crypto/full/LATEST
EOF

# 5. Copy into place
ssh prod-backup-host-vlan4 'sudo rsync -aH /backups/crypto/full/LATEST/ prod-cdb-host:/var/lib/mysql-crypto/'
ssh prod-cdb-host 'sudo chown -R mysql:mysql /var/lib/mysql-crypto'

# 6. Start CDB
ssh prod-cdb-host 'docker compose up -d cdb'

# 7. Confirm the KEK that matches the restored data is loaded on CA
#    The CA env must include CRYPTO_KEK_<id> matching the manifest
cat /backups/crypto/full/LATEST/backup-manifest.json | jq .kek_id
# Compare to OpenBao
openbao kv list nexus-ca/prod/ | grep crypto-kek

# 8. Start CA
./scripts/ca-start-all.sh

# 9. POST-RESTORE TEST SIGN (mandatory)
#    Choose a known test CA from the restored data; ask Crypto API to sign a tiny payload
#    using its private key — this proves the KEK + restored bytes both work.
curl -sk -X POST https://crypto-1.vlan4:8443/v1/admin/test-sign \
  -H "X-Crypto-Api-Key: $CRYPTO_API_KEY" \
  -H "X-Crypto-Admin-Token: $CRYPTO_ADMIN_TOKEN" \
  -d '{"ca_kind":"ROOT","business_db_ca_id":"1001"}'
# Expected: 200 OK with a signature value over a fixed test message
# A 500 with code CRYPTO-0006 (KEK decryption failure) means the KEK does NOT match
# the restored data — STOP and identify the correct KEK before proceeding.

# 10. Restart BL (or unblock if previously paused)
./scripts/bl-start-all.sh

# 11. Smoke test (issue a certificate end-to-end against the test signing CA)
```

### 4.3 What if the KEK is lost?

If the KEK that was active at backup time cannot be located in either OpenBao or the offline archive: **the restored data cannot be decrypted, period**. The CA private keys are unrecoverable.

Recovery in this scenario:

1. Declare a security incident (loss of CA capability).
2. Restore the Business DB normally (per §3) — operators, requests, audit log remain.
3. The platform comes up but **cannot sign anything**. Every existing CA becomes effectively unusable; end-entity certificates already issued continue to function until expiry but cannot be reissued under the same CA.
4. Create new Root CAs (WF-001) with new keys. All previously-trusted certificates must eventually be reissued under the new chains.
5. File a post-mortem; revisit KEK retention policy.

This scenario is why [tools.md](tools.md#database-backup) calls KEK loss "irreversibility" and why §1 of the [key rotation procedure](key-rotation-procedure.md) mandates 6-month KEK retention.

---

## 5. Backup restore testing (monthly)

Per BRD operational commitment and `tools.md`:

| Test | Cadence | Owner | Procedure |
|---|---|---|---|
| Business DB restore to isolated test instance | Monthly | DBA on-call | `./scripts/restore-test-business-db.sh` — performs §3.2 against a dedicated test BDB; verifies row counts and schema integrity |
| Crypto DB restore to isolated VLAN 4 test instance | Monthly | DBA on-call (with security witness) | `./scripts/restore-test-crypto-db.sh` — performs §4.2 against a dedicated test CDB; verifies by performing a test signing operation against a designated test CA |

The script logs a `RESTORE_TEST_SUCCESS` / `RESTORE_TEST_FAILURE` event to the BL audit log. Failures trigger the incident response process.

### 5.1 The test signing CA

For Crypto DB monthly restore tests, a dedicated Root CA named **`Restore Test Root CA`** with `O=Nexus CA Internal, C=US` is created once in production. It is excluded from normal use by an operational convention (never selected as a parent CA), but its bytes are in every Crypto DB backup. The restore test signs a fixed test payload (`SHA-256("nexus-ca-restore-test")`) with this CA and asserts the signature verifies against the persisted public certificate.

This satisfies the [tools.md](tools.md#crypto-db) commitment: *"verified by attempting a test signing operation"* — without using a production-issuing CA in the test.

---

## Related

- [tools.md — Database Backup](tools.md#database-backup)
- [key-rotation-procedure.md](key-rotation-procedure.md)
- [disaster-recovery.md](disaster-recovery.md)
- [incident-response.md](incident-response.md)

# Key Rotation Procedure

This runbook covers four key-rotation scenarios:

1. **Scheduled KEK rotation** (annual)
2. **Emergency KEK rotation** (suspected compromise)
3. **`CRYPTO_API_KEY` rotation** (BL ↔ CA shared API key)
4. **`JWT_SECRET` rotation**

These keys are the most security-critical environment variables in the platform. Plan and rehearse rotations in `staging` before performing them in `prod`.

---

## Why this is hard

> **Losing the KEK renders restored private keys undecryptable even with a successful backup restore.** ([tools.md note](tools.md#database-backup))

Two consequences:

- Every KEK rotation **must** keep at least two operational KEKs (old + new) on the Crypto API for the entire transition window.
- Every backup of the Crypto DB **must** be matched to its KEK in the secrets manager. KEK rotation triggers a re-backup once the migration is complete.

---

## 1. Scheduled KEK rotation (annual)

### 1.1 Pre-rotation checklist

| # | Check | Status |
|---|---|---|
| 1 | Last successful Crypto DB backup is < 24h old and has been restore-tested | ☐ |
| 2 | Both operators (A, B) available | ☐ |
| 3 | Platform Owner approval recorded | ☐ |
| 4 | Maintenance window scheduled and announced | ☐ |
| 5 | Staging rehearsal performed within the last 30 days | ☐ |

### 1.2 Generate the new KEK

```bash
# Generate 256-bit KEK
NEW_KEK=$(openssl rand -base64 32)
NEW_KEK_ID="kek-$(date -u +%Y-%m-%d)"

# Persist in OpenBao alongside the existing KEK — do not overwrite
openbao kv put nexus-ca/prod/crypto-kek-next value="$NEW_KEK"
openbao kv put nexus-ca/prod/crypto-kek-next-id value="$NEW_KEK_ID"

# Sanity: list all KEKs
openbao kv list nexus-ca/prod/
```

### 1.3 Deploy CA with both KEKs loaded

The Crypto API supports multiple loaded KEKs indexed by `kek_id` (see [crypto-design.md §2](../2-Design/2.2-LLD/crypto-design.md#2-private-key-storage)). Decryption picks the KEK whose id matches the row's `kek_id`. Encryption uses `CRYPTO_KEK_ID_ACTIVE`.

Set, for the rotation window:

| Env var | Value during rotation |
|---|---|
| `CRYPTO_KEK_<id>` | one var per loaded KEK — for both old and new |
| `CRYPTO_KEK_ID_ACTIVE` | `<old id>` (encryption continues with old KEK during decrypt-only window) |

Roll the CA fleet to pick up the new env vars per [deployment-runbook.md §7](deployment-runbook.md#7-routine-release-deployment-no-schema-change). Verify each instance's `/health` returns 200 and that an end-to-end issuance smoke test succeeds (it still encrypts with the old KEK at this point).

### 1.4 Switch active KEK and run re-encryption

Now flip `CRYPTO_KEK_ID_ACTIVE` to the new KEK id and roll the CA fleet again. Any new CA private keys generated after this point are encrypted with the new KEK.

Trigger the re-encryption job:

```bash
# From the VLAN 4 management host
curl -sk -X POST https://crypto-1.vlan4:8443/v1/admin/kek-rotate \
  -H "X-Crypto-Api-Key: $CRYPTO_API_KEY" \
  -H "X-Crypto-Admin-Token: $CRYPTO_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"from_kek_id":"kek-2025-05-31","to_kek_id":"kek-2026-05-31","batch_size":50}' \
  | tee /tmp/kek-rotate.json
```

The job:
- Streams `ca_private_keys` rows where `kek_id = <from>`.
- For each row: decrypts with the from-KEK, re-encrypts with the to-KEK, updates `encrypted_private_key`, `iv`, `gcm_tag`, `kek_id` in a single row-level transaction.
- Reports progress and per-row success/failure.

The job is idempotent and resumable — if it dies mid-way, re-run it; rows that already have `kek_id = <to>` are skipped.

### 1.5 Verify completion

```sql
-- All rows should be on the new KEK
SELECT kek_id, COUNT(*) FROM ca_private_keys GROUP BY kek_id;
```

Expected: one row with `kek_id = <new>` and zero rows on the old id.

Smoke-test an end-to-end certificate issuance to confirm both encryption (new KEK) and decryption (signing CA's row, now on new KEK) work.

### 1.6 Take a fresh backup

```bash
# Trigger Crypto DB backup
./scripts/backup-crypto-db.sh
# Verify restore against the new KEK and a new test signing op
./scripts/restore-test-crypto-db.sh
```

### 1.7 Remove the old KEK

After the new backup is verified, roll the CA fleet once more without the old KEK env var:

```bash
openbao kv delete nexus-ca/prod/crypto-kek-old
# Update the secrets injection so only the new KEK is loaded
# Roll CA fleet per deployment-runbook
```

Keep the old KEK in offline secure storage for **6 months** in case an old backup must be restored. After 6 months, all backups taken under the old KEK are past Crypto DB retention; the old KEK may then be securely destroyed (two-person witnessed shredding of the offline copy).

---

## 2. Emergency KEK rotation (suspected compromise)

Trigger conditions:
- Suspected exfiltration of `CRYPTO_KEK` (logs reveal env dump, container escape evidence, vulnerability disclosure by OpenBao).
- Departure of an operator with documented access to `CRYPTO_KEK`.

The procedure is the same as §1 but with three differences:

| Difference | Action |
|---|---|
| Compress the timeline | Skip the rehearsal-in-staging step; perform the rotation in production within hours. |
| Treat all private keys as potentially compromised | After re-encryption with the new KEK, evaluate whether the affected CAs themselves must be revoked (see §2.1). |
| Audit | File a security incident ticket; capture an audit trail of every command run during the rotation; preserve the old KEK in offline storage until incident closure. |

### 2.1 Decision: re-key or revoke?

KEK compromise does not immediately mean the *private keys* are compromised — an attacker with the KEK still needs the Crypto DB ciphertext to extract them.

- If the attacker had **only KEK access** (no DB access): a fresh KEK rotation is sufficient; CA private keys remain confidential.
- If the attacker had **both KEK and Crypto DB access** (e.g., compromised CA container): private keys must be considered compromised. The compromised CAs must be **revoked** (WF-009, WF-015) and replaced. End-entity certificates issued under those chains must be reissued.

This is a Platform Owner decision; the runbook escalates rather than deciding.

---

## 3. `CRYPTO_API_KEY` rotation

The CRYPTO_API_KEY is the shared secret between the Business Logic API (sender) and Crypto API (validator) for all `X-Crypto-Api-Key` headers.

The Crypto API supports **two valid keys** simultaneously to allow zero-downtime rotation:

| Env var | Loaded by | Role |
|---|---|---|
| `CRYPTO_API_KEY` | BL + CA | Primary, used by BL outbound and accepted by CA |
| `CRYPTO_API_KEY_SECONDARY` | CA only | Additionally accepted by CA |

### 3.1 Procedure

1. Generate `NEW_KEY = $(openssl rand -base64 32)`.
2. Store in OpenBao as `nexus-ca/prod/crypto-api-key-next`.
3. Set `CRYPTO_API_KEY_SECONDARY = NEW_KEY` on CA, roll the CA fleet. CA now accepts both keys.
4. Set `CRYPTO_API_KEY = NEW_KEY` on BL, roll the BL fleet. BL now sends new key.
5. Verify all BL→CA traffic uses the new key (Crypto API metric `crypto_api_key_usage{key_id="primary"}` should drop to 0 for the old key over a 5-minute window).
6. Set `CRYPTO_API_KEY = NEW_KEY` on CA AND remove `CRYPTO_API_KEY_SECONDARY`. Roll CA fleet. Old key no longer accepted.
7. Delete `nexus-ca/prod/crypto-api-key-old` from OpenBao.

### 3.2 Emergency

If the old key is known-compromised, skip step 3 and immediately rotate to the new key, accepting the < 5-minute outage as the BL fleet rolls. Treat as a security incident.

---

## 4. `JWT_SECRET` rotation

The JWT signing secret. Rotating it invalidates all active sessions (every JWT signed under the old secret fails signature verification).

| Step | Action |
|---|---|
| 1 | Generate new secret in OpenBao |
| 2 | Roll BL fleet with new secret as `JWT_SECRET` |
| 3 | All users are forced to log in again |
| 4 | Audit log event `JWT_SECRET_ROTATED` recorded |

No transition window is supported in v1.0 — the JWT validator accepts a single signing key. This is intentional: the operational cost of forcing re-login is low, and supporting multi-key validation adds complexity for little gain.

Schedule JWT_SECRET rotation **outside business hours** to minimize user impact.

---

## 5. Common pitfalls

| Pitfall | Mitigation |
|---|---|
| Removing the old KEK before re-encryption finishes | Always verify `SELECT kek_id, COUNT(*) FROM ca_private_keys GROUP BY kek_id;` shows only the new id before removing the old. |
| Restoring an old Crypto DB backup after KEK rotation | Restore must include both the matching KEK (kept for 6 months) AND the backup encryption key. See [backup-restore-runbook.md](backup-restore-runbook.md). |
| Rolling the CA fleet faster than `kek-rotate` completes | The job is resumable; just re-run. Rolling does not interrupt the job (it runs entirely server-side on one CA instance and acts on rows). |
| Coordinating with backups | The next backup after rotation must be taken AFTER §1.5 verifies all rows are on the new KEK, otherwise the backup is a mix. |

---

## Related

- [crypto-design.md — KEK rotation](../2-Design/2.2-LLD/crypto-design.md#23-kek-rotation)
- [backup-restore-runbook.md](backup-restore-runbook.md)
- [incident-response.md](incident-response.md)
- [deployment-runbook.md](deployment-runbook.md)

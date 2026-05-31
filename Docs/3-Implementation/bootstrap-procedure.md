# Bootstrap Procedure

The one-time procedure that creates the initial ADMIN_MAKER and ADMIN_CHECKER accounts on a fresh deployment. After successful completion, the `/setup` endpoint is permanently disabled.

This is the highest-trust operational action in the platform: the operator running it has implicit superuser authority (no maker-checker yet exists). Two-person physical presence is required.

---

## 1. Roles for bootstrap

| Role | Identity | Responsibility |
|---|---|---|
| Bootstrap Operator A | Person who will own the first ADMIN_MAKER account | Logs in to the deployment host, runs the bootstrap command |
| Bootstrap Operator B | Person who will own the first ADMIN_CHECKER account | Physically present, witnesses operator A, verifies the `/setup` lock-out at the end |
| Platform Owner | Named individual responsible for Nexus CA | Approves the bootstrap window in writing |

Operators A and B must be different individuals. Neither operator may be a third party (vendor, contractor) without written authorization from the Platform Owner.

---

## 2. Pre-bootstrap checklist

Complete every item before initiating bootstrap. Each item must be witnessed by Operator B.

| # | Check | How verified | Status |
|---|---|---|---|
| 1 | All six containers are deployed and report healthy | `docker compose ps` shows `(healthy)` for LB, WT, BL, CA, BDB, CDB | ☐ |
| 2 | `/health` returns 200 from inside the management host | `curl https://<bl-internal>:8443/health` | ☐ |
| 3 | `/api/v1/health` returns 200 via the LB | `curl https://<lb-public>/api/v1/health` | ☐ |
| 4 | `JWT_SECRET`, `CRYPTO_API_KEY`, `CRYPTO_KEK`, `CRYPTO_KEK_ID` are loaded from the secrets manager (not plain files) | `docker inspect <bl_container>` shows the env var names but no plain values; OpenBao audit log shows the lease | ☐ |
| 5 | `CRYPTO_KEK` and the Crypto DB backup encryption key are stored as separate secrets in the secrets manager | OpenBao paths verified | ☐ |
| 6 | Backups are configured and a successful test backup of both DBs exists | Verify XtraBackup logs and one successful test restore | ☐ |
| 7 | SMTP relay reachable from VLAN 3 to corporate relay on port 587 | From BL container: `openssl s_client -starttls smtp -connect <smtp>:587` | ☐ |
| 8 | Email addresses for both operators are real, monitored, and reach the corporate inbox | Send a test email to each | ☐ |
| 9 | `bootstrap_state.setup_completed_at` is NULL | `mysql -e "SELECT setup_completed_at FROM bootstrap_state WHERE id=1"` | ☐ |
| 10 | The system date on all hosts is correct and within ±60s of NTP | `timedatectl status` on each host | ☐ |
| 11 | Logging is shipping (BL writes to log aggregation; Prometheus is scraping) | Spot-check Grafana / Loki | ☐ |
| 12 | A written approval to proceed exists from the Platform Owner | Email or ticket reference recorded | ☐ |

If any item is unchecked, do not proceed.

---

## 3. Bootstrap execution

Both operators must be physically present at the same workstation. Operator B does not type; Operator B observes.

### Step 1 — Open a session on the management host

```bash
ssh ops-bastion-01.internal
```

The management host is the only host with both a route to the Business Logic API and an outbound network position appropriate for issuing the call. Do not call `/setup` from a personal laptop or over the public LB — the audit must show this is an operational action.

### Step 2 — Verify the bootstrap endpoint is still enabled

```bash
curl -sk -X GET https://bl-internal-1.vlan3:8443/api/v1/health | jq
curl -sk -X POST https://bl-internal-1.vlan3:8443/api/v1/setup -d '{}' \
  -H 'Content-Type: application/json' | jq
```

- The health check must return `{"status":"UP"}`.
- The empty-body `/setup` POST should return `400` with field validation errors (it must NOT return `BUS-0080 Bootstrap already completed`). If it returns `BUS-0080`, **stop** — the system has already been bootstrapped; do not continue.

### Step 3 — Run the bootstrap call

Use the literal command below. Read each value aloud to Operator B before submitting; both must agree the values are correct.

```bash
curl -sk -X POST https://bl-internal-1.vlan3:8443/api/v1/setup \
  -H 'Content-Type: application/json' \
  -d @- <<'JSON' | tee /tmp/bootstrap-response.json
{
  "admin_maker": {
    "username": "operator-a",
    "full_name": "Operator A Full Legal Name",
    "email": "operator.a@corp.example"
  },
  "admin_checker": {
    "username": "operator-b",
    "full_name": "Operator B Full Legal Name",
    "email": "operator.b@corp.example"
  }
}
JSON
```

Expected response (HTTP 201):

```json
{
  "admin_maker": { "user_id": "1", "username": "operator-a", "email": "operator.a@corp.example" },
  "admin_checker": { "user_id": "2", "username": "operator-b", "email": "operator.b@corp.example" },
  "bootstrap_completed_at": "2026-05-31T14:32:07Z"
}
```

Two emails are sent immediately, one to each operator, each carrying a 16-character temporary password. Plaintext temporary passwords are not returned in the response and never appear in the server log.

### Step 4 — Each operator retrieves their temp password

Each operator opens their corporate inbox on a personal-but-managed device and locates the email with subject `Nexus CA — Account Created: Temporary Password Enclosed`.

If the email does not arrive within five minutes:
1. Check `notification_outbox` rows for delivery status: `SELECT id, status, last_error FROM notification_outbox WHERE recipient_email IN (...) ORDER BY created_at DESC LIMIT 5;`.
2. If `status=FAILED`, fix the SMTP path and **do not** re-run `/setup` (it is now disabled). Instead, the platform must be torn down and rebuilt (see Step 7 — Recovery from a failed bootstrap).

---

## 4. Post-bootstrap verification

| # | Check | How verified | Status |
|---|---|---|---|
| 1 | `bootstrap_state.setup_completed_at` is set | `SELECT setup_completed_at, setup_completed_by FROM bootstrap_state WHERE id=1` | ☐ |
| 2 | `/setup` returns `BUS-0080` | `curl -sk -X POST https://bl-internal-1.vlan3:8443/api/v1/setup -d '{}'` | ☐ |
| 3 | The two user rows exist | `SELECT id, username, role, status, force_password_reset FROM users` shows exactly two rows | ☐ |
| 4 | Both users have `force_password_reset = 1` | Same query | ☐ |
| 5 | Audit log contains the bootstrap event | `SELECT * FROM audit_events WHERE event_type='BOOTSTRAP' ORDER BY occurred_at DESC LIMIT 1` | ☐ |
| 6 | Operator A logs in via the public LB | Visit `https://<lb-public>/` and complete WF-012 force-reset | ☐ |
| 7 | Operator B logs in via the public LB | Same | ☐ |
| 8 | Operator A creates a smoke-test Root CA request | WF-001 submission succeeds | ☐ |
| 9 | Operator B approves the smoke-test Root CA | WF-001 approval succeeds; Root CA `ACTIVE` | ☐ |

Operators must complete Step 6 (force password reset) within 24 hours — the temporary password expires per the configured `Temporary Password Validity` window (default 24h).

After Step 9, the platform is operational.

---

## 5. Recovery from a failed bootstrap

Because `/setup` is permanently disabled on first success (BRD-mandated), a partial or failed bootstrap cannot be re-run on the same database. The recovery is:

1. **Confirm** that `bootstrap_state.setup_completed_at` is NULL. If it is set, the bootstrap succeeded — proceed with normal recovery (admin password reset by the other operator).
2. If `setup_completed_at` is NULL and bootstrap failed before persisting the bootstrap state (e.g., DB connection died mid-transaction):
   - Investigate root cause from BL logs.
   - Resolve the underlying issue.
   - Re-run the bootstrap call as in §3.
3. If `setup_completed_at` is NULL but at least one of the two user rows exists (a partial commit, which should be impossible because bootstrap is a single transaction):
   - This indicates database corruption or a code bug.
   - Stop the platform.
   - Drop and recreate the Business DB.
   - Run migrations from scratch.
   - Re-execute bootstrap.
   - **Do not** try to clean up by deleting rows; you cannot reproduce the password hashes.

---

## 6. Evidence package

The Platform Owner files the following items in the change ticket:

- Pre-bootstrap checklist with all 12 items checked, both operator signatures (digital or physical).
- The bootstrap response JSON (file `/tmp/bootstrap-response.json`).
- Screenshot of the post-bootstrap verification queries.
- Time and date of bootstrap.
- Two operators' signed acknowledgement that their temporary passwords were received and changed.

---

## Related

- [BRD — Bootstrap](../1-Requirements/BRD.md#bootstrap)
- [architecture.md — Bootstrap](../2-Design/2.1-HLD/architecture.md#bootstrap)
- [data-model.md — bootstrap_state](../2-Design/2.2-LLD/data-model.md#bootstrap_state)
- [deployment-runbook.md](deployment-runbook.md)

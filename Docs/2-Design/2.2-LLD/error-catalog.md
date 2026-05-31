# Error Catalog

Stable application error codes returned by the Business Logic API and Crypto API. Every error response includes a code (string), human-readable message, and (where applicable) field-level errors. Codes are namespaced by prefix and never reused.

## Prefixes

| Prefix | Domain |
|---|---|
| `VAL-` | Field-level input validation |
| `AUTH-` | Authentication / authorization / session |
| `BUS-` | Business-rule conflict |
| `CRYPTO-` | Crypto API specific |
| `INF-` | Infrastructure / dependency unavailable |

## Catalog

### Validation (`VAL-`)

| Code | HTTP | Message | Trigger |
|---|---|---|---|
| `VAL-0001` | 400 | A required string field is missing or empty | CN, O, Full Name, etc. empty |
| `VAL-0002` | 400 | Country must be a valid ISO 3166-1 alpha-2 code | |
| `VAL-0003` | 400 | Key algorithm is not in the allowed list | Submitted algorithm not in `ALLOWED_KEY_ALGORITHMS` |
| `VAL-0004` | 400 | Key size does not satisfy minimum policy | |
| `VAL-0005` | 400 | Validity period must be between 1 and 30 years | Root/Intermediate CA creation |
| `VAL-0006` | 400 | Rejection comment is required | Reject without comment |
| `VAL-0010` | 400 | Username format invalid or length out of range | |
| `VAL-0011` | 400 | Email format invalid | |
| `VAL-0012` | 400 | Role not recognized | |
| `VAL-0020` | 400 | CSR does not parse as PKCS#10 | |
| `VAL-0021` | 400 | CSR signature does not verify | |
| `VAL-0022` | 400 | CSR public key algorithm or size not permitted | |
| `VAL-0023` | 400 | Certificate type must be CLIENT, SERVER, or SIGNING | |
| `VAL-0024` | 400 | Validity From cannot be in the past | |
| `VAL-0025` | 400 | Validity To must be after Validity From | |
| `VAL-0026` | 400 | Output format not recognized | |
| `VAL-0027` | 400 | SERVER certificate requires at least one SAN entry | |
| `VAL-0028` | 400 | Subject DN invalid | length, charset, or non-printable ASCII in CN |
| `VAL-0029` | 400 | Duplicate attribute type in Subject DN | |
| `VAL-0030` | 400 | Revocation reason not recognized | |
| `VAL-0040` | 400 | New password does not meet complexity requirements | |
| `VAL-0041` | 400 | Confirm password does not match new password | |
| `VAL-0050` | 400 | System configuration value out of range | Per [WF-013](../../1-Requirements/Workflows/WF-013-system-configuration-update.md) |
| `VAL-0051` | 400 | ALLOWED_KEY_ALGORITHMS must be a non-empty subset of {RSA, EC} | |
| `VAL-0052` | 400 | RSA minimum key size must be one of {2048, 3072, 4096} | |
| `VAL-0053` | 400 | EC minimum key size must be one of {256, 384, 521} | |
| `VAL-0054` | 400 | Maximum CA Hierarchy Depth must be between 1 and 10 | |
| `VAL-0055` | 400 | Maximum certificate validity must be between 1 and 3650 days | |
| `VAL-0056` | 400 | Expiry warning must be between 1 and 365 days | |
| `VAL-0057` | 400 | Pending escalation must be between 1 and 30 days | |
| `VAL-0060` | 400 | Role name is missing, too long, or not unique | Role create/edit (WF-016/017) |
| `VAL-0061` | 400 | Role archetype not recognized or cannot be changed | Archetype ∉ {MAKER, CHECKER, VIEWER}, or change attempted on edit |
| `VAL-0062` | 400 | Permission is not in the catalogue or not valid for the archetype | e.g., Approve on a Maker role; an undefined (feature, operation) pair |
| `VAL-0063` | 400 | Edit/Delete is not permitted for cryptographic entities | Edit/Delete operation selected for ROOT_CA, INTERMEDIATE_CA, or CERTIFICATE |
| `VAL-0064` | 400 | A valid reassignment target role is required | Role deletion with assigned users (WF-018) |

### Authentication / Authorization (`AUTH-`)

| Code | HTTP | Message | Trigger |
|---|---|---|---|
| `AUTH-0001` | 401 | Invalid username or password | |
| `AUTH-0002` | 401 | Account is locked | `users.locked_at IS NOT NULL` |
| `AUTH-0003` | 401 | Account is disabled | `users.status = DISABLED` |
| `AUTH-0010` | 403 | Self-approval is prohibited | Maker = Checker |
| `AUTH-0011` | 403 | Self-action is prohibited for this operation | Self enable/disable, self role change, self password reset |
| `AUTH-0012` | 403 | Field is not self-editable | |
| `AUTH-0020` | 401 | Invalid one-time code | |
| `AUTH-0021` | 401 | One-time code expired | |
| `AUTH-0030` | 401 | Temporary password expired | |
| `AUTH-0031` | 401 | Session expired | JWT past `exp` |
| `AUTH-0032` | 401 | Session has been superseded by a newer login | `session_version` mismatch |
| `AUTH-0040` | 401 | Missing or invalid Crypto API key | Crypto API only |
| `AUTH-0041` | 401 | Missing or invalid Crypto admin token | Crypto API admin endpoints only |
| `AUTH-0050` | 403 | Role does not permit this operation | Generic RBAC failure |

### Business rules (`BUS-`)

| Code | HTTP | Message | Trigger |
|---|---|---|---|
| `BUS-0011` | 409 | Duplicate Root CA | Uniqueness on (cn, o, c) violated |
| `BUS-0012` | 409 | Duplicate Intermediate CA under the same parent | |
| `BUS-0020` | 409 | CA is revoked | Action attempted on REVOKED CA |
| `BUS-0021` | 409 | Target status equals current status | No-op |
| `BUS-0030` | 409 | Invalid or non-active parent CA | |
| `BUS-0031` | 409 | Hierarchy depth would exceed maximum | |
| `BUS-0032` | 409 | Validity exceeds parent CA validity | |
| `BUS-0040` | 409 | Username already exists | |
| `BUS-0041` | 409 | Email already exists | |
| `BUS-0050` | 409 | Must retain at least one ADMIN_MAKER | Seeded-default form of the minimum-viability rule; see `BUS-0104` for the generalised check |
| `BUS-0051` | 409 | Must retain at least one ADMIN_CHECKER | Seeded-default form; see `BUS-0102` for the generalised check |
| `BUS-0060` | 409 | CSR has already been used | csr_sha256 collision |
| `BUS-0061` | 409 | Signing chain is not entirely active | |
| `BUS-0062` | 409 | Validity exceeds signing CA validity | |
| `BUS-0063` | 409 | Validity exceeds maximum for certificate type | |
| `BUS-0070` | 409 | New password cannot equal current password | Force-reset reuse |
| `BUS-0080` | 409 | Bootstrap already completed | `/setup` after first success |
| `BUS-0090` | 409 | Request has already been decided | Approve/reject after state change |
| `BUS-0091` | 409 | Request was superseded by another executed request | |
| `BUS-0092` | 409 | Maker cannot approve own request | (Same as `AUTH-0010` mapped at the request layer) |
| `BUS-0100` | 409 | Duplicate role name | Role name collides with an existing non-deleted role |
| `BUS-0101` | 409 | Role definition violates segregation of duties | A role would hold both maker and approve operations (normally prevented by the exclusive archetype) |
| `BUS-0102` | 409 | Change would leave no active approver for a feature | Role edit/delete/disable/assignment that orphans approval for a feature (generalises `BUS-0051`) |
| `BUS-0103` | 409 | Change would leave no active path to administer Roles or Users | Self-lockout guard for the RBAC engine |
| `BUS-0104` | 409 | Change would leave no active Maker for a required feature | Generalises `BUS-0050` |

### Crypto (`CRYPTO-`)

| Code | HTTP | Message | Trigger |
|---|---|---|---|
| `CRYPTO-0001` | 400 | CSR fails PKCS#10 parse | Crypto API |
| `CRYPTO-0002` | 400 | CSR signature does not verify | Crypto API |
| `CRYPTO-0003` | 400 | Public-key algorithm or size not permitted | Crypto API |
| `CRYPTO-0004` | 400 | EC curve not permitted | Crypto API |
| `CRYPTO-0005` | 409 | Validity exceeds parent CA validity (Crypto-side check) | |
| `CRYPTO-0006` | 500 | KEK decryption failure on signing CA | |
| `CRYPTO-0007` | 409 | Idempotency-Key replay with different body | |
| `CRYPTO-0010` | 500 | Serial-number collision (extreme low-probability) | Retry |

### Infrastructure (`INF-`)

| Code | HTTP | Message | Trigger |
|---|---|---|---|
| `INF-0001` | 503 | Database unavailable | |
| `INF-0002` | 503 | Crypto API unavailable | After retries exhausted |
| `INF-0003` | 503 | SMTP relay unavailable | Surfaced only for synchronous email actions (admin password reset). Async outbox sends do not surface to the user. |
| `INF-0010` | 500 | Unexpected server error | Generic 500 — logged with `correlation_id` |
| `INF-0429` | 429 | Rate limit exceeded | Surfaced by Nginx; never originated by the application |

## Correlation

Every error response includes `correlation_id`. This is the W3C `trace_id` (from OpenTelemetry, per [tools.md — Observability](../../3-Implementation/tools.md#observability)). Users in trouble are asked to provide this id; ops can trace through Zipkin and Loki/ELK.

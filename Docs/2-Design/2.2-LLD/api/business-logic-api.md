# Business Logic API — Endpoint Catalog

This document is the interim endpoint catalog. The authoritative machine-readable spec is `business-logic-api/src/main/resources/openapi/business-logic-api.yaml` (OpenAPI 3, served via Swagger UI in `dev`/`staging` per [tools.md](../../../3-Implementation/tools.md)). This catalog defines every endpoint the Web Tier proxies and is the contract the frontend codes against during pre-implementation.

## Conventions

- Base path: all endpoints are reachable under `/api/v1/...` via the Web Tier reverse proxy.
- All requests/responses are `application/json` except `GET .../download` which returns `application/octet-stream` or `application/x-pem-file`.
- Authentication: every endpoint except `POST /auth/login`, `POST /auth/mfa`, `POST /auth/forgot-password/request`, `POST /auth/forgot-password/verify`, `POST /setup`, and `GET /health` requires header `Authorization: Bearer <jwt>`. JWT validation per [crypto-design.md §5](../crypto-design.md#5-jwt-design).
- Error response shape:
  ```json
  {
    "error_code": "VAL-0001",
    "message": "Common Name is required",
    "field_errors": { "cn": "must not be empty" },
    "correlation_id": "0af7..."
  }
  ```
- All paginated list endpoints in v1.0 return the **complete** unpaginated list (per BRD: *No filtering, export, or pagination for v1.0*) but use the `items` envelope: `{ "items": [...] }`.
- IDs are decimal strings.

## Endpoints

### Authentication

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/auth/login` | (any) | Validate username + password; if ok and password not expired and no `force_password_reset`, issue OTC and return `{"mfa_required": true}`. Otherwise return `{"force_reset": true, "mfa_required": true}` to drive WF-012. |
| POST | `/auth/mfa` | (any) | Submit OTC. On success: return JWT and increment `users.session_version`. |
| POST | `/auth/forgot-password/request` | (any) | Initiate WF-011. Always returns 200 with a generic body. |
| POST | `/auth/forgot-password/verify` | (any) | Submit OTC + new password. |
| POST | `/auth/force-reset` | (any, valid password supplied) | WF-012: submit OTC + new password during forced reset. |
| POST | `/auth/logout` | All | Revokes the session by incrementing `session_version`. |
| GET | `/auth/me` | All | Return current user profile (`id`, `username`, `full_name`, `email`, `role`, `force_password_reset`). |

### Self profile

| Method | Path | Roles | Purpose |
|---|---|---|---|
| PATCH | `/me/profile` | All | WF-010. Body: `{ "full_name"?: string, "email"?: string }`. |

### Root CA management

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/root-cas` | All | List all Root CAs (all statuses). |
| GET | `/root-cas/{id}` | All | Detail. |
| GET | `/root-cas/{id}/certificate?format=PEM\|DER` | All | Download public certificate. |
| POST | `/root-cas/requests/create` | CA_ADMIN_MAKER | WF-001 submit. Body: `{ "cn", "o", "c", "key_algorithm", "key_size_bits", "validity_years" }`. |
| POST | `/root-cas/{id}/requests/enable-disable` | CA_ADMIN_MAKER | WF-002 submit. Body: `{ "target_status": "ACTIVE"\|"DISABLED" }`. |
| POST | `/root-cas/{id}/requests/revoke` | CA_ADMIN_MAKER | WF-009 submit. Body: `{ "reason": "KEY_COMPROMISE"\|... }`. |

### Intermediate CA management

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/intermediate-cas` | All | List. |
| GET | `/intermediate-cas/{id}` | All | Detail. |
| GET | `/intermediate-cas/{id}/certificate?format=PEM\|DER` | All | Download public certificate. |
| GET | `/intermediate-cas/issuable` | CA_OPERATOR_MAKER | List ACTIVE Intermediate CAs with fully ACTIVE ancestry — input for WF-008. |
| POST | `/intermediate-cas/requests/create` | CA_ADMIN_MAKER | WF-003 submit. Body: `{ "parent_kind", "parent_id", "cn", "o", "c", "key_algorithm", "key_size_bits", "validity_years" }`. |
| POST | `/intermediate-cas/{id}/requests/enable-disable` | CA_ADMIN_MAKER | WF-004. |
| POST | `/intermediate-cas/{id}/requests/revoke` | CA_ADMIN_MAKER | WF-015. |

### Certificate issuance

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/certificates` | All | List. |
| GET | `/certificates/{id}` | All | Detail. |
| GET | `/certificates/{id}/download` | CA_OPERATOR_MAKER, CA_OPERATOR_CHECKER (only those associated with the request) | Returns bytes in the recorded `output_format`. The first CA_OPERATOR_MAKER download triggers COMPLETED. |
| POST | `/certificates/csr/parse` | CA_OPERATOR_MAKER | Stateless: parse a CSR and return Subject DN, key info, SANs, computed `csr_sha256`. Does **not** persist anything. |
| POST | `/certificates/requests/issue` | CA_OPERATOR_MAKER | WF-008 submit. Body: `{ "csr_pem", "csr_sha256", "issuing_intermediate_ca_id", "certificate_type", "valid_from", "valid_to", "output_format" }`. |

### User management

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/users` | SUPER_ADMIN_MAKER, SUPER_ADMIN_CHECKER, AUDITOR | List. |
| GET | `/users/{id}` | SUPER_ADMIN_MAKER, SUPER_ADMIN_CHECKER, AUDITOR; or self | Detail. |
| POST | `/users/requests/create` | SUPER_ADMIN_MAKER | WF-005. |
| POST | `/users/{id}/requests/enable-disable` | SUPER_ADMIN_MAKER | WF-006. |
| POST | `/users/{id}/requests/role-assign` | SUPER_ADMIN_MAKER | WF-007. Body: `{ "new_role_id": <id> }`. |
| POST | `/users/{id}/password/reset` | SUPER_ADMIN_MAKER | WF-014. No maker-checker. |

### Role management

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/roles` | SUPER_ADMIN_MAKER, SUPER_ADMIN_CHECKER, AUDITOR | List roles (id, name, archetype, is_system, permission count, assigned-user count, status). |
| GET | `/roles/{id}` | SUPER_ADMIN_MAKER, SUPER_ADMIN_CHECKER, AUDITOR | Detail including the full permission set and assigned users. |
| GET | `/roles/catalogue` | SUPER_ADMIN_MAKER | The permission catalogue (features × operations valid per archetype) — drives the Create/Edit Role form. |
| POST | `/roles/requests/create` | SUPER_ADMIN_MAKER | WF-016 submit. Body: `{ "name", "archetype", "permissions": [ { "feature", "operation" } ] }`. |
| POST | `/roles/{id}/requests/edit` | SUPER_ADMIN_MAKER | WF-017 submit. Body: `{ "name"?, "permissions": [...] }` (archetype immutable). |
| POST | `/roles/{id}/requests/delete` | SUPER_ADMIN_MAKER | WF-018 submit. Body: `{ "reassign_users_to_role_id"?: <id> }`. |

> Roles shown in the **Roles** column of this catalogue are the seeded defaults. Authorisation is enforced by the caller's **permissions** (feature + operation), not a hard-coded role name — see [BRD §Role Management](../../1-Requirements/BRD.md#role-management-configurable-rbac). A request for feature *F* routes to any active Checker-archetype role holding Approve on *F*.

### Requests (maker-checker queue)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/requests/pending` | Checker roles (visibility per BRD) | List `PENDING_APPROVAL` requests visible to the caller. |
| GET | `/requests/{id}` | Per BRD visibility rules | Detail including before/after snapshots and field-level diff. |
| POST | `/requests/{id}/approve` | Appropriate checker | Body: `{ "comment"?: string }`. |
| POST | `/requests/{id}/reject` | Appropriate checker | Body: `{ "comment": string }`. Comment is mandatory. |
| GET | `/requests/history` | Per BRD visibility rules | List COMPLETED / REJECTED requests. |

### System configuration

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/system-configuration` | SUPER_ADMIN_MAKER, SUPER_ADMIN_CHECKER, AUDITOR | Full configuration. |
| POST | `/system-configuration/requests/update` | SUPER_ADMIN_MAKER | WF-013. Body: `{ "changes": { "<PARAM_NAME>": <new_value> } }`. |

### Reports

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/reports/root-cas` | All | Per BRD report definition. |
| GET | `/reports/intermediate-cas` | All | |
| GET | `/reports/certificates` | All | |
| GET | `/reports/users` | All (excl. password fields) | |
| GET | `/reports/roles` | SUPER_ADMIN_MAKER, SUPER_ADMIN_CHECKER, AUDITOR | Per BRD Role Report. |
| GET | `/reports/pending-approval` | Per BRD visibility | |
| GET | `/reports/request-history` | Per BRD visibility | |
| GET | `/reports/audit` | All | Audit log report. |

### Bootstrap

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/setup` | (any) | One-time bootstrap. Body: `{ "admin_maker": { "username", "full_name", "email" }, "admin_checker": { "username", "full_name", "email" } }`. Disabled permanently after first success. |

### Health and meta

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/health` | (any) | Liveness + DB ping. Returns 200/503. |
| GET | `/health/ready` | (any) | Readiness (DB + Crypto API reachable). |
| GET | `/metrics` | (cluster-internal only via Nginx rule) | Prometheus exposition. |

## Status codes

| Code | Use |
|---|---|
| 200 | Success (GET, idempotent operations) |
| 201 | Resource created (request submitted) |
| 202 | Accepted (long-running execution, not used in v1.0) |
| 400 | Validation failure |
| 401 | Authentication failure / expired JWT / OTC failure |
| 403 | Authorization failure (role mismatch, self-approval, etc.) |
| 404 | Not found |
| 409 | Business-rule conflict (state machine, duplicate, etc.) |
| 429 | Rate limited by Nginx |
| 500 | Unhandled server error |
| 503 | Dependency unavailable (Crypto API, DB) |

Application error codes are defined in [error-catalog.md](../error-catalog.md).

## Related

- [crypto-design.md](../crypto-design.md)
- [error-catalog.md](../error-catalog.md)
- [data-model.md](../data-model.md)

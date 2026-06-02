# WF-005: User Creation

## Summary

SUPER_ADMIN_MAKER submits a request to create a new user account with a specified role. SUPER_ADMIN_CHECKER reviews and decides. On approval, the system generates a temporary password and emails it to the new user with first-login forced password reset semantics.

## Actors

| Role | Responsibility |
|---|---|
| SUPER_ADMIN_MAKER | Submits the request |
| SUPER_ADMIN_CHECKER | Reviews and decides |
| New user (implicit) | Receives the temporary password by email |

## Preconditions

- Username and email are unique across all users (regardless of status).
- Role references an ACTIVE role (seeded or custom; see [BRD — Role Management](../BRD.md#role-management-configurable-rbac)).

## Diagram

```mermaid
flowchart TD
    A[SUPER_ADMIN_MAKER opens Create User] --> B[Fill Full Name, Username, Email, Role]
    B --> C{Form validation passes?}
    C -- No --> C1[Inline errors] --> B
    C -- Yes --> D[Submit]
    D --> E[PENDING_APPROVAL]
    E --> F[SUPER_ADMIN_CHECKER review]
    F --> G{Decision}
    G -- Reject --> R[REJECTED] --> Z((End))
    G -- Approve --> H[APPROVED]
    H --> I[Generate temporary password]
    I --> J[Persist user with status ACTIVE,<br/>force_password_reset=true]
    J --> K[Email temp password to user]
    K --> L[EXECUTED then COMPLETED]
    L --> M[Notify maker]
    M --> Z
```

## Steps

| # | Actor | Step | Validation |
|---|---|---|---|
| 1 | SUPER_ADMIN_MAKER | Open *Create User* | Role check. |
| 2 | SUPER_ADMIN_MAKER | Fill Full Name, Username, Email, Role | Username must be unique (case-insensitive); email must match RFC 5322 simple form and be unique; role must reference an ACTIVE role (seeded or custom). |
| 3 | SUPER_ADMIN_MAKER | Submit | Server re-checks uniqueness. Creates Request row `PENDING_APPROVAL`. |
| 4 | SUPER_ADMIN_CHECKER | Review (snapshot empty Before; After = proposed new user) | |
| 5 | SUPER_ADMIN_CHECKER | Approve / Reject | Reject requires comment. |
| 6 | System | Execute | Generate user row (status `ACTIVE`, `force_password_reset = true`, `password_hash = bcrypt(temporary password)`, `temp_password_expires_at = now + 24h`), generate temp password (16 chars meeting complexity rules), email user. |
| 7 | System | Notify maker; transition `COMPLETED` |  |

## Validation Rules

| Field | Rule | On violation |
|---|---|---|
| Full Name | Non-empty, ≤ 100 chars | 400 `VAL-0001` |
| Username | Non-empty, 3..50 chars, `[a-z0-9._-]`; case-insensitive unique | 400 `VAL-0010` / 409 `BUS-0040 username exists` |
| Email | RFC 5322 simple form; unique across all users | 400 `VAL-0011` / 409 `BUS-0041 email exists` |
| Role | References an ACTIVE role (seeded or custom); see [BRD — Role Management](../BRD.md#role-management-configurable-rbac) | 400 `VAL-0012` |

## Error Paths

| Trigger | System behaviour |
|---|---|
| Two SUPER_ADMIN_MAKERs submit the same username/email concurrently | DB unique constraint enforces a single winner; the second execution fails with `BUS-0040`/`BUS-0041`; failed request is marked EXECUTED with failure metadata. |
| SMTP relay unavailable when sending temp password | User row is persisted; temp password is **not** stored in plaintext. The maker is notified and must initiate WF-014 (admin password reset) to issue a fresh temporary password. |
| Disabling the only remaining SUPER_ADMIN_CHECKER | **Blocked** (409 `BUS-0051`) — at least one active SUPER_ADMIN_CHECKER must always exist (see [BRD — SUPER_ADMIN Immutability](../BRD.md#super_admin-immutability)). For non-immutable checker roles, breaking checker availability is instead a warning the operator should reconcile per [BRD — Checker Availability](../BRD.md#checker-availability). |

## Post-conditions

- New user exists with status `ACTIVE`, `force_password_reset = true`.
- Temporary password email sent.
- Audit log captures the creation payload and full After snapshot (excluding the temp password — only its hash is stored).

## Related

- [BRD — User Lifecycle](../BRD.md#user-lifecycle)
- [WF-014 — Admin Password Reset](WF-014-admin-password-reset.md)
- [branding.md — Account Created template](../branding.md#account-created--temporary-password)

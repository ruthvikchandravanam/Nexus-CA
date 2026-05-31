# ADR-0008: Stateless JWT auth with `session_version` for single-session enforcement

- **Status:** Accepted
- **Date:** 2026-05-06

## Context

The BRD requires:

- Stateless service tiers (no server-side session store).
- Each user may have only one active session; a new login terminates any existing session.
- Sessions expire after a configurable idle period.

Pure stateless JWT cannot enforce single-session because old JWTs remain valid until `exp`. A server-side session store would solve it but breaks the statelessness requirement.

## Decision

Issue a stateless JWT (HS256, `JWT_SECRET`) carrying `sub`, `role`, `session_version`, `iat`, `exp`. Store a `session_version` counter on each user row in the Business DB; bump it on every new login, role change, password change, force-disable, and admin password reset.

On every authenticated request, validate the JWT signature, validate `exp`, and check that the embedded `session_version` matches the current value in the Business DB. Mismatch → 401 `AUTH-0032` and client redirects to login.

The Business DB read per request is unavoidable but cheap — a single index lookup on the user row.

## Consequences

Pros:

- No server-side session store; any BL instance can validate any JWT.
- Single-session, role-change-invalidation, and force-logout all share one mechanism.
- Audit trail of who-was-logged-in-when is derivable from the audit log; not needed in the session store.

Cons / costs:

- One Business DB read per authenticated request to check `session_version` (acceptable — this is the same row hit for `users.status` and `users.locked_at` anyway).
- Mixing stateless signature validation with stateful version check is conceptually less clean than pure-JWT but pragmatically the right compromise.

## Alternatives considered

| Option | Reason rejected |
|---|---|
| Server-side session store (Redis) | Violates statelessness requirement; adds a dependency |
| Pure JWT with short `exp` and silent refresh | Cannot enforce single-session; old JWTs are valid until expiry |
| JWT denylist | Requires shared state (same as a session store) |

## References

- [architecture.md — Single Active Session Enforcement](../2.1-HLD/architecture.md#single-active-session-enforcement)
- [crypto-design.md §5](../2.2-LLD/crypto-design.md#5-jwt-design)

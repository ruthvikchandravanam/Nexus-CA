# ADR-0004: OpenBao for secrets management

- **Status:** Accepted
- **Date:** 2026-04-22

## Context

The platform requires several long-lived secrets: `JWT_SECRET`, `CRYPTO_API_KEY`, `CRYPTO_KEK` (and rotated successors), DB passwords, SMTP credentials, the Crypto DB backup encryption key. They must be injected at container start, never written to disk or committed to source, and rotated periodically. They must be audit-logged.

HashiCorp Vault was historically the obvious choice; in 2023 IBM/HashiCorp's BSL relicensing forced a fork.

## Decision

Use **OpenBao** (MPL 2.0) — the open-source fork of HashiCorp Vault — as the primary secrets manager. Use the agent sidecar pattern for env var injection at container start.

## Consequences

Pros:

- API-compatible with Vault, so existing operator skills transfer.
- MPL 2.0; no BSL concerns.
- Self-hosted; suitable for air-gapped or internal deployments.
- Built-in audit log.

Cons / costs:

- Additional infrastructure component to operate.
- The OpenBao community is younger than Vault's; some integrations may lag.

## Alternatives considered

| Option | Reason rejected |
|---|---|
| HashiCorp Vault | BSL licensing concerns |
| Infisical | Capable; smaller feature set than OpenBao for this use case |
| Docker Secrets (Swarm) | Only works in Swarm; ties us to the orchestration choice |
| Plain files mounted from disk | No audit, no rotation, easy to commit by accident |
| Cloud KMS (AWS/GCP/Azure) | Not viable for an internal-only, possibly air-gapped deployment |

## References

- [tools.md — Secret Management](../../3-Implementation/tools.md#secret-management)
- [key-rotation-procedure.md](../../3-Implementation/key-rotation-procedure.md)

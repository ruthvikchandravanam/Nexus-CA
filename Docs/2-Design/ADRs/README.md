# Architecture Decision Records (ADRs)

This directory captures significant architectural decisions for Nexus CA. Each ADR is a short, immutable record of a decision, its context, the alternatives considered, and the consequences. Superseding a decision is done by writing a new ADR that references the old one — never edit a closed ADR.

Format: lightweight Michael Nygard style (Title, Status, Context, Decision, Consequences, Alternatives Considered).

## Index

| # | Title | Status | Date |
|---|---|---|---|
| [ADR-0001](ADR-0001-vertx-over-spring.md) | Use Vert.x instead of Spring for backend services | Accepted | 2026-04-15 |
| [ADR-0002](ADR-0002-bouncycastle-sole-crypto-library.md) | BouncyCastle is the sole external crypto library | Accepted | 2026-04-15 |
| [ADR-0003](ADR-0003-manual-test-doubles-no-mockito.md) | Manual test doubles instead of Mockito | Accepted | 2026-04-15 |
| [ADR-0004](ADR-0004-openbao-for-secrets.md) | OpenBao for secrets management | Accepted | 2026-04-22 |
| [ADR-0005](ADR-0005-client-side-round-robin.md) | Client-side round-robin between internal service tiers | Accepted | 2026-04-22 |
| [ADR-0006](ADR-0006-vlans-and-crypto-isolation.md) | Three-VLAN segmentation with Crypto API isolation in VLAN 4 | Accepted | 2026-04-29 |
| [ADR-0007](ADR-0007-maker-checker-single-table.md) | Single `requests` table for all maker-checker request types | Accepted | 2026-05-06 |
| [ADR-0008](ADR-0008-jwt-session-version.md) | Stateless JWT auth with `session_version` for single-session enforcement | Accepted | 2026-05-06 |
| [ADR-0009](ADR-0009-no-crl-ocsp-v1.md) | No CRL or OCSP publication in v1.0 | Accepted | 2026-05-13 |
| [ADR-0010](ADR-0010-software-encrypted-keys-no-hsm-v1.md) | Software-encrypted private keys (no HSM) in v1.0 | Accepted | 2026-05-13 |

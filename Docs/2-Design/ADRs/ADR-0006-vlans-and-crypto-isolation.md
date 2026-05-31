# ADR-0006: Three-VLAN segmentation with Crypto API isolation in VLAN 4

- **Status:** Accepted
- **Date:** 2026-04-29

## Context

Private CA keys are the most sensitive asset. The platform must make it impossible (or as close as the network model allows) for any frontend or general-purpose backend code path to ever directly access them.

## Decision

Run the platform across three VLANs (plus a DMZ for the public LB):

- **VLAN 2 — Web** — Web Tier (Nginx). Serves static SPA + reverse proxies to BL.
- **VLAN 3 — Application** — Business Logic API + Business DB. All business logic, audit, notifications, scheduler.
- **VLAN 4 — Secure** — Crypto API + Crypto DB. The only place CA private keys exist.

Firewall rules permit only:

- DMZ → VLAN 2
- VLAN 2 → VLAN 3
- VLAN 3 → VLAN 4
- VLAN 3 → SMTP relay (single fixed IP, port 587 only, outbound)

No tier may initiate a connection to a tier above it.

## Consequences

Pros:

- A compromise of the Web Tier cannot directly reach the Crypto API or DBs.
- A compromise of the Business Logic API cannot read the Crypto DB directly — it must go through the Crypto API, which never returns private keys.
- Auditable network policy with very few rules.

Cons / costs:

- More network configuration to manage; firewall rule discipline is mandatory.
- Adding a new component requires deciding its VLAN, which is a meaningful security decision (not a default).
- The two MySQL databases double DB operational work compared to one DB with separate schemas.

## Alternatives considered

| Option | Reason rejected |
|---|---|
| Single VLAN with role-based DB users | Network segmentation is one of the few security controls that survives application code bugs |
| Two VLANs (Web + Backend) | Doesn't isolate the crypto material from general business logic |
| HSM instead of a software Crypto API | Out of scope for v1.0 (see [ADR-0010](ADR-0010-software-encrypted-keys-no-hsm-v1.md)) — but VLAN 4 design is HSM-ready |

## References

- [architecture.md — VLANs](../2.1-HLD/architecture.md#vlans)
- [threat-model.md](../security/threat-model.md)

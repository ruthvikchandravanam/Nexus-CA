---
name: project-nexus-ca
description: Core project context for Nexus CA — internal CA platform, v1.0 scope, documentation structure, compliance posture, and recurring audit themes
metadata:
  type: project
---

Internal Certificate Authority platform named "Nexus CA". v1.0 scope is locked per BRD.

**Why:** Platform is pre-implementation (no build/test/run commands yet). Documentation is being written ahead of implementation.

**How to apply:** Frame all gap findings relative to v1.0 deliverables. Do not flag HSM, CRL, OCSP, ACME, LDAP/SSO, multi-tenancy, or certificate renewal as gaps — they are explicitly out of scope.

## Architecture summary
- DMZ: Nginx LB | VLAN 2: Web Tier (Nginx + React/TS) | VLAN 3: Business Logic API (Java 21/Vert.x) + Business DB (MySQL 8.4) | VLAN 4: Crypto API (Java 21/Vert.x + BouncyCastle) + Crypto DB (MySQL 8.4)
- CA private keys: AES-256-GCM encrypted with CRYPTO_KEK, stored in Crypto DB, never leave VLAN 4

## Compliance posture
- Primarily RFC 5280 conformant X.509 (not CA/B Forum public TLS — internal only)
- No CRL/OCSP in v1.0 (ADR-0009 documents this decision)
- No HSM in v1.0 (ADR-0010 documents this decision; software-encrypted keys)
- No formal CP/CPS — internal CA only; not required for v1.0 per scope lock

## Documentation structure (verified 2026-06-01)
- Requirements: BRD.md, branding.md, ui-screens.md, checker-review.md, WF-001 to WF-018
- HLD: architecture.md, sequence-diagrams.md
- LLD: data-model.md, crypto-design.md, certificate-profiles.md, error-catalog.md, api/business-logic-api.md, api/crypto-api.md
- ADRs: ADR-0001 to ADR-0010 (in Docs/2-Design/ADRs/)
- Security: threat-model.md
- Implementation: tools.md, developer-guide.md, testing-strategy.md, bootstrap-procedure.md, deployment-runbook.md, key-rotation-procedure.md, backup-restore-runbook.md, observability-runbook.md, incident-response.md, disaster-recovery.md
- Glossary: Docs/glossary.md

## Recurring BRD gap themes found in 2026-06-01 audit
1. User lifecycle is missing DISABLED status in BRD — DISABLED users cannot log in but have no explicit lifecycle note in BRD
2. BRD defines password reuse as "not restricted" in WF-011 (forgot password) but WF-012 (force reset) restricts reuse — inconsistency
3. BRD Success Criteria does not mention Role Management, RBAC engine, or configurable roles
4. BRD certificate lifecycle missing REVOKED status — only ACTIVE and EXPIRED listed
5. WF-005 Role validation rule still references five seeded roles only — inconsistent with RBAC engine
6. Request Visibility table in BRD uses seeded role names only, not archetype-based language (inconsistent with RBAC section)
7. No acceptance criteria for reports (no pagination, filtering, or export is noted as a constraint but not as a testable criterion)
8. No non-functional requirements section in BRD (availability, performance targets, RTO/RPO targets)
9. BRD notification table does not specify what happens when email delivery fails (partial coverage in WFs but not in BRD)
10. No explicit requirement ID scheme in BRD (requirements are prose, not numbered REQ-xxx)

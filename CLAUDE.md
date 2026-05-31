# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Internal Certificate Authority platform ("Nexus CA"). v1.0 scope locked per BRD.

## Documentation map

| Layer | Key files |
|---|---|
| Requirements | `Docs/1-Requirements/BRD.md`, `Docs/1-Requirements/branding.md`, `Docs/1-Requirements/ui-screens.md`, `Docs/1-Requirements/checker-review.md`, `Docs/1-Requirements/Workflows/WF-001` … `WF-015` |
| High-Level Design | `Docs/2-Design/2.1-HLD/architecture.md`, `Docs/2-Design/2.1-HLD/sequence-diagrams.md` |
| Low-Level Design | `Docs/2-Design/2.2-LLD/data-model.md`, `Docs/2-Design/2.2-LLD/crypto-design.md`, `Docs/2-Design/2.2-LLD/certificate-profiles.md`, `Docs/2-Design/2.2-LLD/error-catalog.md`, `Docs/2-Design/2.2-LLD/api/` |
| ADRs | `Docs/2-Design/ADRs/` |
| Security | `Docs/2-Design/security/threat-model.md` |
| Implementation | `Docs/3-Implementation/tools.md`, `Docs/3-Implementation/developer-guide.md`, `Docs/3-Implementation/testing-strategy.md`, `Docs/3-Implementation/bootstrap-procedure.md`, `Docs/3-Implementation/deployment-runbook.md`, `Docs/3-Implementation/key-rotation-procedure.md`, `Docs/3-Implementation/backup-restore-runbook.md`, `Docs/3-Implementation/observability-runbook.md`, `Docs/3-Implementation/incident-response.md`, `Docs/3-Implementation/disaster-recovery.md` |
| Glossary | `Docs/glossary.md` |

## Architecture summary

Four deployment units across three VLANs:
- DMZ: Load Balancer (Nginx)
- VLAN 2: Web Tier (Nginx + React/TS SPA)
- VLAN 3: Business Logic API (Java 21 / Vert.x) + Business DB (MySQL 8.4)
- VLAN 4: Crypto API (Java 21 / Vert.x + BouncyCastle) + Crypto DB (MySQL 8.4)

CA private keys exist only in VLAN 4, AES-256-GCM-encrypted with `CRYPTO_KEK`.

## Commands

_No build, test, or run commands exist yet. Update this section when implementation begins._

When implementation begins, expected commands will live in per-service Maven and npm config; for the local-dev workflow see `Docs/3-Implementation/developer-guide.md`.

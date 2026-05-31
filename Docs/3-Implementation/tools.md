# Nexus CA — Software Tools & Technology Stack

---

## Overview

This document defines the technology choices for every component of the Nexus CA platform. Selections are guided by four constraints from the architecture:

1. **Four distinct deployment units** — Load Balancer, Web Tier, Business Logic API, Crypto API
2. **Two isolated databases** — Business DB (VLAN 3) and Crypto DB (VLAN 4)
3. **Stateless service tiers** — no in-memory state between requests
4. **Crypto isolation** — all key material confined to VLAN 4; BouncyCastle handles all cryptographic operations inside the Crypto API

---

## Technology Stack

### Load Balancer (DMZ)

| Concern | Choice | Rationale |
|---|---|---|
| Load balancer / reverse proxy | **Nginx** | Battle-tested, lightweight, excellent SSL/TLS termination, health checks, and upstream configuration. Consistent with the Web Tier server choice. |
| TLS certificates | **Manually provisioned** | The platform self-issues its own TLS certificate via the Root CA after bootstrap. Prior to that, a self-signed certificate is used for initial setup. |
| Rate limiting | **Nginx `limit_req`** | Network-level rate limiting on authentication endpoints as a defence-in-depth layer complementing application-level account lockout. |

**Rate limit configuration:**

| Endpoint | Limit | Burst | Response on Exceed |
|---|---|---|---|
| `POST /api/auth/login` | 5 req / min per IP | 2 | HTTP 429 |
| `POST /api/auth/mfa` | 5 req / min per IP | 2 | HTTP 429 |
| All other `/api/*` | 120 req / min per IP | 20 | HTTP 429 |

---

### Web Tier (VLAN 2)

The Web Tier has two responsibilities: serving the pre-built static frontend and reverse-proxying `/api/*` to the Business Logic API.

#### Server

| Concern | Choice | Rationale |
|---|---|---|
| Static file server + reverse proxy | **Nginx** | Same binary as the LB; serves pre-built assets from disk and proxies API requests upstream. No application runtime required. |

#### Frontend Application

| Concern | Choice | Version | Rationale |
|---|---|---|---|
| Language | **TypeScript** | 5.x | Type safety across all API contracts, form schemas, and component props. |
| UI framework | **React** | 18.x | Large ecosystem, excellent tooling, aligns with the component-based design system. |
| Build tool | **Vite** | 5.x | Fast HMR in development; optimised production bundles. |
| Styling | **Tailwind CSS** | 3.x | Utility-first; design tokens (colors, spacing, typography) map directly to Tailwind config variables. |
| Routing | **React Router** | 6.x | File-based and nested routing for the multi-page application. |
| Server state | **React `useState` + `useEffect` + `fetch`** | (built-in) | Native browser `fetch` API for all HTTP calls; React built-in hooks manage loading, error, and data state. No external data-fetching library. |
| Forms & validation | **React controlled components** | (built-in) | Form state managed via React `useState`; validation logic written as plain TypeScript functions against typed interfaces. No external form or schema library. |
| HTTP client | **`fetch` API** | (browser built-in) | JWT attached via a thin wrapper function using `fetch`; 401 responses handled in the wrapper with a redirect to login. |
| Icons | **Inline SVG** | (browser built-in) | SVG icons inlined as React components; no icon library dependency. |

---

### Business Logic API (VLAN 3)

| Concern | Choice | Version | Rationale |
|---|---|---|---|
| Language & runtime | **Java** | 21 LTS | Long-term support, strong typing, mature enterprise ecosystem, excellent security library support. |
| Framework | **Eclipse Vert.x** | 4.5.x | Reactive, event-loop-based framework; non-blocking I/O handles concurrent requests efficiently without thread-per-request overhead. |
| HTTP server & routing | **Vert.x Web** | (bundled) | Router, request/response handling, body parsing, and middleware chain for the REST API. |
| Authentication | **Vert.x Auth JWT** | (bundled) | JWT handler integrated into the Vert.x Web router; stateless token validation per request. Nimbus JOSE is a transitive dependency — not added explicitly. |
| Database client | **Vert.x MySQL Client** | (bundled) | Reactive, non-blocking MySQL driver; built-in connection pool. Key settings: `maxSize=20`, `maxWaitQueueSize=100`. |
| Database migrations | **Vert.x MySQL Client + versioned SQL scripts** | (bundled) | Numbered `.sql` files executed in order at startup via the reactive MySQL client. No external migration framework required. |
| Background scheduler | **Vert.x `setPeriodic`** | (bundled) | Periodic timers on the event loop for daily tasks (expiry transitions, notifications, escalations); distributed lock via MySQL `SELECT … FOR UPDATE`. |
| Email | **Vert.x Mail Client** | (bundled) | Async SMTP client with STARTTLS support for the corporate relay. |
| Build tool | **Maven** | 3.9.x | Dependency management and reproducible builds. |

---

### Crypto API (VLAN 4)

| Concern | Choice | Version | Rationale |
|---|---|---|---|
| Language & runtime | **Java** | 21 LTS | Consistent with Business Logic API; BouncyCastle is the most mature Java crypto provider. |
| Framework | **Eclipse Vert.x** | 4.5.x | Consistent with Business Logic API; minimal Vert.x Web router exposing the crypto endpoints with API key validation middleware. |
| HTTP server & routing | **Vert.x Web** | (bundled) | Lightweight router; API key check applied as a global handler before all routes. |
| Cryptography | **Bouncy Castle** | 1.7x | Full X.509 certificate lifecycle: CA keypair generation (RSA/EC), self-signing, CSR validation, certificate issuance, chain building, PEM/DER/PKCS#7 output formats. JCA/JCE provider registration. |
| Database client | **Vert.x MySQL Client** | (bundled) | Reactive MySQL driver; built-in connection pool. Lower pool size than Business Logic API: `maxSize=10`, `maxWaitQueueSize=50`. |
| Database migrations | **Vert.x MySQL Client + versioned SQL scripts** | (bundled) | Same pattern as Business Logic API; no external migration framework. |
| Build tool | **Maven** | 3.9.x | Consistent with Business Logic API. |

---

### Business DB (VLAN 3)

| Concern | Choice | Version | Rationale |
|---|---|---|---|
| Database engine | **MySQL** | 8.4 LTS | ACID compliance, native JSON column type for audit snapshots and request payloads, `SELECT … FOR UPDATE` for distributed scheduler locking, wide driver support. |
| Encryption at rest | **InnoDB Tablespace Encryption** | — | MySQL 8 built-in transparent data encryption (TDE) for InnoDB; enabled per-tablespace with no application changes required. |

---

### Crypto DB (VLAN 4)

| Concern | Choice | Version | Rationale |
|---|---|---|---|
| Database engine | **MySQL** | 8.4 LTS | Consistent with Business DB; isolated instance in VLAN 4. |
| Encryption at rest | **InnoDB TDE + column-level encryption** | — | InnoDB Tablespace Encryption for full-table protection AND application-level column encryption for the `private_key` column. The Crypto API encrypts each private key with a Key Encryption Key (KEK) before storing it. The KEK is injected at deployment time as an environment variable and never written to the database. |
| Column encryption algorithm | **AES-256-GCM** | — | Authenticated encryption; detects tampering. Implemented via BouncyCastle in the Crypto API before any DB write. |

---

## Development Tooling

### IDEs

| Tool | Licence | Usage |
|---|---|---|
| **IntelliJ IDEA Community Edition** | Apache 2.0 | Java development (Business Logic API, Crypto API) |
| **Visual Studio Code** | MIT | Frontend development, documentation, configuration files |

### Version Control

| Tool | Licence | Usage |
|---|---|---|
| **Git** | GPL 2.0 | Source control |
| **Gitea** | MIT | Self-hosted Git service; remote repository, merge requests, issue tracking, and CI/CD via Gitea Actions |

### Pre-commit Hooks

Hooks run locally on `git commit` and `git push` to catch issues before they reach CI.

| Tool | Scope | Checks |
|---|---|---|
| **Husky** | Frontend | Installs and manages Git hooks for the frontend project |
| **lint-staged** | Frontend | On commit: runs ESLint + Prettier on staged `.ts`/`.tsx` files only (fast) |
| **tsc --noEmit** | Frontend | On push: full TypeScript type check |
| **Git hook (shell)** | Java | On commit: runs `mvn checkstyle:check` for changed modules |
| **Git hook (shell)** | Java | On push: runs `mvn test` to catch unit test regressions before remote |

### Code Quality — Frontend

| Tool | Purpose |
|---|---|
| ESLint | Static analysis; enforce coding standards |
| Prettier | Opinionated code formatter; no style debates |
| TypeScript strict mode | `strict: true` in `tsconfig.json`; catches null/undefined errors at compile time |

### Code Quality — Java

| Tool | Purpose |
|---|---|
| Checkstyle | Enforce Java coding conventions |
| SpotBugs | Static analysis for common bug patterns |
| JaCoCo | Code coverage reporting |

### Dependency Vulnerability Scanning

Run in CI on every build. Builds fail on **Critical** or **High** severity findings.

| Tool | Scope | Notes |
|---|---|---|
| **OWASP Dependency-Check** (Maven plugin) | Business Logic API, Crypto API | Scans all transitive Java dependencies against the NVD CVE database |
| **npm audit** | Frontend | Built into npm; flags known vulnerabilities in the `node_modules` tree |
| **Trivy** | Apache 2.0 | Scans container images and filesystem for CVEs; integrated into CI and Harbor registry |

### SAST (Static Application Security Testing)

| Tool | Scope | Notes |
|---|---|---|
| **SonarQube Community Edition** | Java + TypeScript | Self-hosted; detects security hotspots, code smells, and coverage regressions. Integrated into CI via the SonarScanner Maven plugin and Sonar Vite plugin. |
| **Semgrep** | Java + TypeScript | Open-source; runs in CI without a server. Used for security-specific rule sets (e.g., hardcoded secrets, insecure crypto usage, SQL injection patterns). |

### Testing — Frontend

| Tool | Purpose |
|---|---|
| **Vitest** | Unit and component test runner (Vite-native, fast) |
| **React Testing Library** | Component tests; tests behaviour, not implementation |
| **MSW (Mock Service Worker)** | API mocking in tests and local development |

### Testing — Backend

| Tool | Purpose |
|---|---|
| **JUnit 5** | Unit test framework (Java standard) |
| **Manual test doubles** | Hand-written stubs and fakes instead of a mocking framework; no Mockito dependency |
| **Vert.x JUnit5 (`vertx-junit5`)** | Integration tests with a real Vert.x application context; part of the Vert.x ecosystem |
| **Testcontainers** | Spins up real MySQL 8 containers for integration tests; no mocked DB |
| **`java.net.http.HttpClient`** | JDK built-in HTTP client for API-layer integration tests; no external HTTP testing library |

---

## CI/CD Pipeline

**Platform:** **Gitea Actions** (Apache 2.0) — workflow syntax is compatible with GitHub Actions; self-hosted runners execute all jobs within the internal network.

Each service has its own pipeline triggered on merge requests and on merge to `main`.

### Pipeline Stages (per service)

```
PR / push to main
      │
      ▼
  1. Lint & Format Check
      │
      ▼
  2. Unit Tests
      │
      ▼
  3. Integration Tests (Testcontainers)
      │
      ▼
  4. Dependency Vulnerability Scan (OWASP / npm audit)
      │
      ▼
  5. SAST (SonarQube + Semgrep)
      │
      ▼
  6. Build Artifact (JAR / npm build)
      │
      ▼
  7. Build & Push Docker Image → Container Registry
      │
      ▼
  8. Deploy to Staging  ◄── automatic on merge to main
      │
      ▼
  9. Deploy to Production  ◄── manual approval gate
```

### Branch Strategy

| Branch | Purpose | Deploy Target |
|---|---|---|
| `feature/*` | Feature development | None (CI checks only) |
| `main` | Integration branch | Staging (automatic on merge) |
| `release/*` | Release candidates | Staging → Production (manual approval gate) |

### Pipeline Definitions (per service)

| Service | Trigger | Key Steps |
|---|---|---|
| `frontend` | Push to any branch, PR to main | lint → type-check → vitest → npm audit → Semgrep → vite build → Docker build/push |
| `business-logic-api` | Push to any branch, PR to main | checkstyle → JUnit → Testcontainers integration → OWASP → SonarQube → Semgrep → Maven package → Docker build/push |
| `crypto-api` | Push to any branch, PR to main | checkstyle → JUnit → Testcontainers integration → OWASP → SonarQube → Semgrep → Maven package → Docker build/push |

### Quality Gates

Pipelines **fail and block merge** if any of the following are not met:

- Lint / format check fails
- Any unit or integration test fails
- OWASP or npm audit reports a Critical or High CVE
- SonarQube quality gate fails (configurable thresholds: coverage ≥ 80%, no new Critical issues)
- Semgrep reports any ERROR-level finding

---

## Infrastructure & Deployment

### Containerisation

| Tool | Usage |
|---|---|
| **Docker** | Each service (Nginx/LB, Nginx/Web, Business Logic API, Crypto API, Business DB, Crypto DB) runs as an independent container |
| **Docker Compose** | Local development and staging: orchestrates all services with correct network isolation (separate Docker networks per VLAN) |

### Container Registry

| Option | Licence | Notes |
|---|---|---|
| **Harbor** (recommended) | Apache 2.0 | Self-hosted. Supports image vulnerability scanning (Trivy integration), role-based access, and image signing. Suitable for air-gapped or internal deployments. |
| **Gitea Container Registry** | MIT | Built into Gitea; zero additional infrastructure if Gitea is already deployed. |

All images are tagged with the Git commit SHA and a semantic version. The `latest` tag is never used in production.

### Container Images

| Service | Base Image |
|---|---|
| Load Balancer | `nginx:alpine` |
| Web Tier | `nginx:alpine` (with built static assets copied in) |
| Business Logic API | `eclipse-temurin:21-jre-alpine` |
| Crypto API | `eclipse-temurin:21-jre-alpine` |
| Business DB | `mysql:8.4` |
| Crypto DB | `mysql:8.4` |

### Environment Configuration

All runtime secrets and environment-specific values are injected via environment variables. No secrets are baked into container images or committed to source control.

| Variable | Component | Description |
|---|---|---|
| `DB_URL`, `DB_USER`, `DB_PASSWORD` | Business Logic API | Business DB connection |
| `CRYPTO_DB_URL`, `CRYPTO_DB_USER`, `CRYPTO_DB_PASSWORD` | Crypto API | Crypto DB connection |
| `JWT_SECRET` | Business Logic API | HMAC secret for JWT signing |
| `CRYPTO_API_KEY` | Business Logic API + Crypto API | Shared API key for BL API → Crypto API authentication |
| `CRYPTO_KEK` | Crypto API | Key Encryption Key for private key column encryption (AES-256-GCM) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Business Logic API | SMTP relay credentials |
| `APP_ENV` | Business Logic API, Crypto API | Active environment (`dev`, `staging`, `prod`); read at startup to load the corresponding Vert.x config file |

### Secret Management

For production, environment variables are sourced from a secrets manager rather than plain files:

| Option | Licence | Notes |
|---|---|---|
| **OpenBao** (recommended) | MPL 2.0 | Open source fork of HashiCorp Vault (post-BSL relicensing); API-compatible, self-hosted, injects secrets at container start via agent sidecar or environment injection |
| **Infisical** | MIT | Open source secrets manager with a Docker Compose deployment option; secrets synced to containers as environment variables |
| **Docker Secrets** | Apache 2.0 | Built into Docker Swarm; secrets mounted as files at a known path inside the container |

### Internal TLS Certificate Provisioning

The architecture specifies HTTPS for all inter-tier communication (VLAN 2 → 3 and VLAN 3 → 4).

| Phase | Certificate Source | Mechanism |
|---|---|---|
| **Before bootstrap** | Self-signed certificates | Generated once at initial deployment; mounted into containers as PEM volume mounts. Loaded by the Vert.x HTTP server via `HttpServerOptions.setSsl(true).setKeyCertOptions(...)` at startup. |
| **After bootstrap** | Nexus CA-issued certificates | Once a Root CA and Intermediate CA exist, TLS certificates for the Business Logic API and Crypto API are issued through the normal Nexus CA certificate issuance workflow. The new certificates replace the self-signed ones via a container configuration update. |
| **Renewal** | Nexus CA certificate issuance | Before the issued certificate expires, a new certificate issuance request is submitted through the platform. The renewed certificate is deployed via a container restart with updated volume mounts. |

TLS private keys for service certificates (not CA private keys) are stored as volume-mounted files on each host, accessible only to the respective container.

### Database Backup

**Tool:** **Percona XtraBackup** — hot physical backups for MySQL 8 with no table locks; supports full and incremental backups and point-in-time recovery (PITR) via binary log archiving.

#### Business DB

| Parameter | Value |
|---|---|
| Backup schedule | Daily full backup at 02:00 UTC; hourly binary log flush for PITR |
| Retention | 30 days |
| Storage | Dedicated backup volume, separate host from the DB |
| Encryption | Storage-level (consistent with DB host InnoDB TDE) |
| Restore testing | Monthly automated restore to a test instance; verified by checking row counts and schema integrity |

#### Crypto DB

| Parameter | Value |
|---|---|
| Backup schedule | Daily full backup at 03:00 UTC; hourly binary log flush |
| Retention | 90 days (longer due to irreversibility of private key loss) |
| Storage | Dedicated backup volume in VLAN 4; never accessible outside VLAN 4 |
| Encryption | InnoDB TDE on the source **plus** XtraBackup `--encrypt` with a backup-specific encryption key (distinct from the Crypto DB KEK, stored separately in the secrets manager) |
| Restore testing | Monthly automated restore to an isolated VLAN 4 test instance; verified by attempting a test signing operation |

> **Critical note:** The backup encryption key for the Crypto DB and the KEK are two separate secrets. Losing the KEK renders restored private keys undecryptable even with a successful backup restore. Both keys must be backed up independently in the secrets manager.

---

## Observability

| Concern | Tool | Notes |
|---|---|---|
| **Structured logging** | **Logback + logstash-logback-encoder** | JSON-formatted logs from all Java services; compatible with any log aggregation pipeline (ELK, Loki, Splunk) |
| **Metrics** | **vertx-micrometer-metrics + Prometheus + Grafana** | `vertx-micrometer-metrics` registers a Prometheus registry; each service exposes `/metrics`. Prometheus scrapes all instances; Grafana visualises dashboards. All Apache 2.0 / AGPL. |
| **Health checks** | **vertx-health-check** | Each service exposes a `/health` endpoint via the Vert.x Health Check module. Used by Nginx upstream health checks and Docker Compose readiness probes to remove unhealthy instances from rotation. Apache 2.0. |
| **Distributed tracing** | **OpenTelemetry Java Agent + Zipkin** | Zero-code OTel Java agent instruments Vert.x HTTP client and server automatically. Trace IDs propagated via W3C Trace Context headers across all service hops. Zipkin (Apache 2.0) receives and visualises traces. |
| **Email delivery** | Corporate SMTP relay | Configured via `SMTP_*` environment variables; connection uses STARTTLS on port 587 |
| **API documentation** | **Vert.x Web OpenAPI + Swagger UI** | OpenAPI 3 spec maintained alongside the code; `vertx-web-openapi` validates requests against it at runtime. Swagger UI (Apache 2.0) served as static assets in `dev` and `staging` only — disabled in `prod`. |

---

## Dependency Summary

| Component | Language | Framework | Key Libraries |
|---|---|---|---|
| Load Balancer | — | Nginx | `limit_req` rate limiting |
| Web Tier (server) | — | Nginx | — |
| Web Tier (frontend) | TypeScript 5 | React 18 + Vite 5 | React Router, Tailwind CSS, native `fetch`, inline SVG |
| Business Logic API | Java 21 | Vert.x 4.5 | Vert.x Web, Vert.x Auth JWT, Vert.x MySQL Client, Vert.x Mail Client, versioned SQL scripts |
| Crypto API | Java 21 | Vert.x 4.5 | Vert.x Web, Vert.x MySQL Client, Bouncy Castle ¹, versioned SQL scripts |
| Business DB | — | MySQL 8.4 LTS | Percona XtraBackup, InnoDB TDE |
| Crypto DB | — | MySQL 8.4 LTS | Percona XtraBackup, InnoDB TDE, AES-256-GCM column encryption (via BouncyCastle) |

> ¹ **BouncyCastle is the sole external library exception.** Java's public standard library (`java.security`, `java.security.cert`) provides no API for creating X.509 certificates, parsing CSRs, or encoding PKCS#7 chains — only reading them. BouncyCastle is required for the Crypto API's core function and has no standard-library substitute.

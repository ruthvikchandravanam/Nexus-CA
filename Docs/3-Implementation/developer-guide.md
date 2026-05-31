# Developer Guide

Everything you need to know to set up a local Nexus CA development environment and contribute changes.

## 1. Repository structure

```
Certificate-Authority/
├── CLAUDE.md
├── Docs/
│   ├── 1-Requirements/   (BRD, workflows, branding, checker-review, ui-screens)
│   ├── 2-Design/
│   │   ├── 2.1-HLD/      (architecture, sequence-diagrams)
│   │   ├── 2.2-LLD/      (data-model, certificate-profiles, crypto-design, error-catalog, api/)
│   │   ├── ADRs/
│   │   └── security/     (threat-model)
│   ├── 3-Implementation/ (tools, runbooks, testing-strategy, this guide)
│   └── glossary.md
├── business-logic-api/   (Java 21 / Vert.x — VLAN 3 service)
├── crypto-api/           (Java 21 / Vert.x — VLAN 4 service)
├── frontend/             (TypeScript / React / Vite — Web Tier static assets)
├── nginx/                (LB + Web Tier Nginx configs)
├── compose/              (Docker Compose for local dev and staging)
├── scripts/              (preflight, drain/undrain, smoke, backup, restore)
└── qa/                   (contract tests, e2e tests)
```

(The three service directories and `frontend/` will exist once implementation begins; this guide assumes the layout.)

## 2. Prerequisites

| Tool | Version | Why |
|---|---|---|
| JDK | 21 LTS (Temurin) | Backend services |
| Maven | 3.9.x | Backend build |
| Node.js | 20.x LTS | Frontend build |
| npm | 10.x | Frontend dependencies |
| Docker | latest | Local compose for DB, full-stack runs |
| Docker Compose | v2.x | Same |
| Git | 2.40+ | Source control |
| `mysql` CLI | 8.x | DB inspection |
| `openssl`, `jq`, `curl` | latest | Scripts |

Install JDK 21 via SDKMAN, Node via nvm, Docker via the official installer.

## 3. First-time setup

```bash
# Clone
git clone https://gitea.internal/nexus-ca/platform.git
cd platform

# Backend
cd business-logic-api && mvn dependency:resolve && cd ..
cd crypto-api && mvn dependency:resolve && cd ..

# Frontend
cd frontend && npm ci && cd ..

# Pre-commit hooks
cd frontend && npx husky install && cd ..
./scripts/install-java-git-hooks.sh   # installs hook for mvn checkstyle on commit, mvn test on push
```

## 4. Running locally

### 4.1 Just the databases

```bash
docker compose -f compose/dev/docker-compose.dbs.yml up -d
```

Spins up `bdb` and `cdb` on isolated Docker networks emulating VLAN 3 and VLAN 4.

### 4.2 Backend services from your IDE

In IntelliJ, create a run configuration for each service:

| Service | Main class | VM args | Env |
|---|---|---|---|
| BL | `com.nexusca.bl.Main` | `-Dvertx.config=src/main/resources/config/dev.json` | see `compose/dev/.env.bl` |
| CA | `com.nexusca.ca.Main` | `-Dvertx.config=src/main/resources/config/dev.json` | see `compose/dev/.env.ca` |

Both services run on `localhost` with their HTTPS ports (BL: 8443, CA: 8543) using self-signed certs from `compose/dev/tls/`.

### 4.3 Frontend dev server

```bash
cd frontend
npm run dev
```

Vite serves the SPA on `http://localhost:5173` with `/api/*` proxied to BL at `https://localhost:8443` (with TLS verification disabled — dev only).

### 4.4 Full stack via compose

```bash
docker compose -f compose/dev/docker-compose.yml up -d --wait
# Open https://localhost (self-signed cert; accept the warning)
```

### 4.5 Bootstrap your local instance

```bash
curl -sk -X POST https://localhost:8443/api/v1/setup \
  -H 'Content-Type: application/json' \
  -d '{"admin_maker":{"username":"dev_maker","full_name":"Dev Maker","email":"maker@local"},"admin_checker":{"username":"dev_checker","full_name":"Dev Checker","email":"checker@local"}}'

# Read the temp passwords from the maildev container's UI: http://localhost:1080
```

In dev, `SMTP_HOST` points to a [maildev](https://github.com/maildev/maildev) container — every email is visible at `http://localhost:1080`.

## 5. Running tests

| Command | What runs |
|---|---|
| `mvn -pl business-logic-api test` | Unit tests only |
| `mvn -pl business-logic-api verify` | Unit + integration (Testcontainers spins up MySQL) |
| `mvn verify` | Same for both services |
| `npm --prefix frontend run test` | Vitest unit + component tests |
| `npm --prefix frontend run typecheck` | `tsc --noEmit` |
| `npm --prefix frontend run lint` | ESLint + Prettier |
| `cd qa/e2e && npm run playwright` | End-to-end against `compose/staging` |

See [testing-strategy.md](testing-strategy.md) for what belongs where.

## 6. Branching and commit conventions

| Branch | Purpose |
|---|---|
| `feature/<short-desc>` | New feature or fix; PR target is `main` |
| `main` | Integration; auto-deploys to staging on merge |
| `release/<version>` | Release candidate; manual gate to production |

Commit messages: imperative, ≤ 72 chars on the first line.

```
Add Intermediate CA depth check at submission

The previous implementation only re-checked depth at execution time,
which let users submit obviously-invalid requests. This adds an
inline check at submit and rejects with BUS-0031.
```

Reference issue/ticket IDs in the body, not the first line.

## 7. Pull request process

1. Fork or branch off `main`.
2. Implement the change.
3. Run the local test commands in §5.
4. Push and open a PR against `main`.
5. CI runs the full pipeline ([tools.md — CI/CD Pipeline](tools.md#cicd-pipeline)).
6. At least one other engineer must approve. For changes touching auth, crypto, or audit code, a **security reviewer** must additionally approve (the PR template includes a checkbox).
7. Squash-merge on green.

PR description template includes:

- What changed and why
- Linked BRD section or workflow ID (e.g., WF-008) if applicable
- Test plan
- Risk assessment
- Rollout notes (any DB migrations, env var changes, manual ops)

## 8. Schema migration changes

If your change adds a column, table, or index:

1. Add a numbered migration `V0NNN__description.sql` to the relevant service.
2. Make it **additive only** within a single release. Drops happen in a follow-up release per the expand-contract rule in [deployment-runbook.md §8](deployment-runbook.md#8-release-with-schema-change).
3. Update [data-model.md](../2-Design/2.2-LLD/data-model.md).
4. Test the migration locally by deleting the dev DB volume and starting fresh.

## 9. Code style

- Java: Checkstyle config in `config/checkstyle.xml`; enforced in pre-commit.
- TypeScript: ESLint + Prettier; enforced in pre-commit.
- Java naming: standard conventions; no abbreviations in public API.
- TS naming: PascalCase for components, camelCase for functions, UPPER_SNAKE for constants.
- Comments: only for *why*, not *what*. Don't comment self-evident code.

## 10. Documentation expectations

- Any change to a workflow ⇒ update the corresponding `WF-NNN.md`.
- Any change to a request type or business rule ⇒ update the BRD.
- Any change to the data model ⇒ update [data-model.md](../2-Design/2.2-LLD/data-model.md).
- Any change to the API ⇒ update both the OpenAPI spec and [business-logic-api.md](../2-Design/2.2-LLD/api/business-logic-api.md).
- New architectural decision ⇒ add a new ADR (do not edit closed ADRs; supersede them).

CI does not enforce doc updates, but PR review will block merges that change behavior without doc updates.

## 11. Getting help

- Slack: `#nexus-ca`
- Issue tracker: Gitea
- Runbooks: this directory

## Related

- [tools.md](tools.md)
- [testing-strategy.md](testing-strategy.md)
- [deployment-runbook.md](deployment-runbook.md)

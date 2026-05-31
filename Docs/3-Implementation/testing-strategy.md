# Testing Strategy

This document defines what kinds of tests exist, where they live, what they cover, and what the CI quality gates require. It is the answer to "how do I know my change is correct enough to merge?"

Tooling reference: [tools.md — Testing](tools.md#testing--frontend).

---

## 1. Layers

| Layer | Where | Scope | Speed | Tools |
|---|---|---|---|---|
| Unit | `src/test/java/...` per service; `src/test/...` for frontend | Single class / function; pure logic, no I/O | < 100ms per test | JUnit 5 + manual test doubles (backend); Vitest + React Testing Library (frontend) |
| Integration | `src/test/integration/...` per service | Component or HTTP-route level; real DB and HTTP server | 100ms–10s per test | Vert.x JUnit5 + Testcontainers (MySQL 8) (backend); MSW (frontend) |
| Cross-service contract | `qa/contract/` | BL ↔ CA HTTP contract | 10s–60s per test | Vert.x app + Testcontainers Crypto API |
| End-to-end (E2E) | `qa/e2e/` | Browser-driven flows across the full stack | 30s–5min per test | Playwright (headless Chromium) against a `staging`-like compose project |
| Security | various | DAST, dependency, SAST | Mixed | OWASP Dependency-Check, npm audit, Trivy, SonarQube, Semgrep |

---

## 2. Coverage targets

| Scope | Threshold | Gate |
|---|---|---|
| Backend (Java) unit + integration combined | **≥ 80% line coverage** per module | Hard fail in CI (SonarQube quality gate) |
| Frontend (TypeScript) unit + component | **≥ 80% line coverage** | Hard fail in CI |
| Critical paths (auth, JWT validation, maker-checker execution, certificate issuance, cascade revocation) | **100% branch coverage** | Hard fail in CI — enforced by JaCoCo per-class rule on a whitelist |
| E2E | Cover one happy path per BRD workflow (WF-001 through WF-015) | At least one passing E2E per workflow per release |

Note: "100% branch coverage on critical paths" is the only place we go above 80%. The rationale is that these paths have hard-to-test failure modes (concurrent execution, cryptographic edge cases) that need explicit assertion coverage. Everywhere else, 80% is sufficient and a higher number tends to drive low-value tests.

---

## 3. What goes in each layer

### 3.1 Unit tests (backend)

Cover:
- Pure functions: CSR parsing, certificate profile builders, password complexity validators, OTC verification logic, JWT claim construction, audit field-diff computation.
- Adapter/translator code: DB row → DTO mappers, request payload validation.

Do **not** cover:
- Persistence — that is integration.
- HTTP routing — that is integration.
- BouncyCastle internals — assume it works; cover our use of it via integration tests that issue real certificates.

Test doubles are hand-written stubs and fakes — no Mockito. Rationale in `tools.md`.

### 3.2 Integration tests (backend)

Cover:
- Every API route: happy path, 400 validation failure, 401/403 auth failure, 409 business-rule failure.
- Schema migrations: spin up an empty MySQL container, apply all migrations, assert no errors.
- Maker-checker execution: end-to-end through HTTP routes including JWT, against a real DB and a stubbed Crypto API.
- BL ↔ Crypto API contract: spin up a real Crypto API in a Testcontainer; run a happy-path issuance.

Each integration test gets a freshly-migrated MySQL container (Testcontainers `withReuse(false)`). Tests are isolated; no cross-test data leakage.

### 3.3 Unit tests (frontend)

Cover:
- Form validation functions (pure TypeScript).
- Reducers / hooks (`useState`/`useEffect` orchestration).
- Diff-renderer (the checker review pane).

### 3.4 Component tests (frontend)

Cover:
- Each screen renders for each role (with the correct hidden/visible controls).
- Form submissions trigger the correct API call (verified via MSW handler assertions).
- Error states render correctly when the API returns a known `error_code`.

### 3.5 E2E tests

Run against a Docker Compose `staging`-like environment with seeded users and one Root CA. Reset DB state between tests.

Required E2E scenarios (one per workflow):

| ID | Scenario |
|---|---|
| E2E-001 | Create Root CA (WF-001), approve, verify visible on list |
| E2E-002 | Enable/Disable Root CA (WF-002) |
| E2E-003 | Create Intermediate CA under existing Root (WF-003) |
| E2E-004 | Enable/Disable Intermediate CA (WF-004) |
| E2E-005 | Create user (WF-005), check email arrives, login with temp password |
| E2E-006 | Enable/Disable user (WF-006) |
| E2E-007 | Reassign role (WF-007) |
| E2E-008 | Issue Server certificate (WF-008), download, verify it parses |
| E2E-009 | Revoke Root CA (WF-009), verify cascade revokes Intermediates |
| E2E-010 | Self profile update (WF-010) |
| E2E-011 | Forgot password (WF-011) |
| E2E-012 | Force password reset on expiry (WF-012) |
| E2E-013 | Update a system configuration parameter (WF-013) |
| E2E-014 | Admin password reset (WF-014) |
| E2E-015 | Revoke Intermediate CA (WF-015), verify cascade to children |

Additional cross-cutting E2E:

| ID | Scenario |
|---|---|
| E2E-101 | Self-approval prohibited (maker attempts to approve own request, blocked) |
| E2E-102 | Superseded request auto-rejected when peer executed |
| E2E-103 | Disabled signing chain blocks issuance request execution |
| E2E-104 | OTC failure threshold locks account, ADMIN_MAKER unlock works |
| E2E-105 | JWT bumped on role change forces re-login |

### 3.6 Security tests

Already covered in CI per [tools.md — SAST, Dependency Vulnerability Scanning](tools.md#sast-static-application-security-testing). In addition:

- **Annual external penetration test** against `staging` (procurement and report-handling are out of scope of this document; reference the contracted vendor in the engagement ticket).
- **Manual review** of new authentication, authorization, or crypto code by a second engineer before merge — enforced as a PR-template checkbox.

---

## 4. Test data management

### 4.1 Crypto DB seed for tests

The integration test harness ships a deterministic test KEK and a small seed of pre-generated CAs in raw form, written to the test Crypto DB at startup via a Vert.x context manager. Seeded entities:

- One Root CA (test only) — `O=Nexus CA Test, CN=Test Root CA`.
- One Intermediate CA under that Root — `CN=Test Issuing CA`.

These exist only in test instances; the production Crypto DB never contains them.

### 4.2 Business DB seed

A `db/test-seed/` directory holds SQL fragments creating:

- One user per role (`test_admin_maker`, `test_admin_checker`, etc.) with bcrypt-hashed known passwords.
- The bootstrap_state row marked completed so `/setup` is disabled in tests.

### 4.3 No test data in production

Production environments must not contain test users, test CAs, or test certificates. This is verified at deploy time by `./scripts/preflight.sh` which queries for known test usernames and fails if any exist.

---

## 5. Flake handling

A test that fails intermittently is treated as a real defect, not a quirk. Procedure:

1. On first intermittent failure: file a ticket linking the failing run, add `@Tag("flaky")` (or `.fails-intermittently` for Vitest), exclude from the merge gate while investigation continues.
2. Within 5 working days: identify root cause (race, timing, ordering, environment leak). Fix or remove.
3. No test may carry the `flaky` tag for more than 10 working days.

Do **not** retry on failure. CI runs each test exactly once. Adding retry hides flakes and produces silently-degraded CI.

---

## 6. CI quality gates (recap)

A merge is **blocked** if any of the following fails (per [tools.md — Quality Gates](tools.md#quality-gates)):

- Lint / format check
- Any unit or integration test
- OWASP Dependency-Check or `npm audit` Critical/High CVE
- SonarQube quality gate (coverage and no-new-Critical)
- Semgrep ERROR-level finding

E2E tests run on the `release/*` branch and on a nightly job; they do not gate per-PR merge (too slow), but a failing E2E blocks the release.

---

## 7. Local testing workflow

A developer about to push a backend change should run, at minimum:

```bash
cd business-logic-api
mvn -q -DskipITs=false verify
```

For a frontend change:

```bash
cd frontend
npm run lint && npm run typecheck && npm run test
```

For full local E2E:

```bash
cd qa/e2e
docker compose up -d --wait
npm run playwright
```

The pre-commit and pre-push hooks (Husky for frontend; shell scripts for Java) catch the most common omissions automatically — see [tools.md — Pre-commit Hooks](tools.md#pre-commit-hooks).

---

## Related

- [tools.md](tools.md)
- [error-catalog.md](../2-Design/2.2-LLD/error-catalog.md)
- [developer-guide.md](developer-guide.md)

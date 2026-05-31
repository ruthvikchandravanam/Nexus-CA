# Deployment Runbook

This runbook describes deploying Nexus CA from scratch and performing routine releases. For the one-time post-deployment user setup, see [bootstrap-procedure.md](bootstrap-procedure.md). For DR / restore, see [backup-restore-runbook.md](backup-restore-runbook.md).

## 1. Environments

| Environment | Purpose | Trigger | Approval |
|---|---|---|---|
| `dev` | Local development | `feature/*` push (CI checks only); developer runs locally with `docker compose up` | None |
| `staging` | Pre-production verification | Merge to `main` | Automatic |
| `prod` | Production | Push of `release/*` tag | Manual approval gate in Gitea Actions |

## 2. Topology recap

Each environment runs the 6-container topology from [architecture.md](../2-Design/2.1-HLD/architecture.md):

```
LB (Nginx, DMZ)
  └── WT × n (Nginx, VLAN 2)
        └── BL × n (Java/Vert.x, VLAN 3) ──► BDB (MySQL 8.4, VLAN 3)
              └── CA × n (Java/Vert.x, VLAN 4) ──► CDB (MySQL 8.4, VLAN 4)
```

VLANs are realized as separate Docker networks in `dev` and `staging`; in `prod` they are separate physical VLANs with firewalled boundaries.

## 3. Image tagging

All images are tagged with the Git commit SHA AND a semantic version. `latest` is never used in production. Example:

| Image | Tag |
|---|---|
| `registry.internal/nexus-ca/business-logic-api` | `1.0.3-a8c1de4` |
| `registry.internal/nexus-ca/crypto-api` | `1.0.3-a8c1de4` |
| `registry.internal/nexus-ca/web-tier` | `1.0.3-a8c1de4` |

## 4. Pre-deployment checklist

| # | Item | Verification |
|---|---|---|
| 1 | Target version's images exist in the registry and pass Trivy scan | Harbor UI / `trivy image` |
| 2 | All secrets exist in OpenBao with valid leases for the target environment | OpenBao audit |
| 3 | `JWT_SECRET` is set and ≥ 256 bits | Length check |
| 4 | `CRYPTO_KEK` and `CRYPTO_KEK_ID` are set and consistent with what is in the Crypto DB (no rotation in flight) | Cross-check `kek_id` distinct values from `ca_private_keys` |
| 5 | `CRYPTO_API_KEY` is the same value provided to both BL and CA | Hash compare |
| 6 | DB backup taken within the last 24h | XtraBackup log |
| 7 | `MAINTENANCE.md` change-log entry exists for this release | Repo check |
| 8 | Release notes drafted | Internal wiki |

## 5. Container startup order

The 6 containers MUST start in this order. Subsequent containers wait for the prior tier's health check to pass.

1. **BDB** — `mysql:8.4`. Wait until `mysqladmin ping` succeeds.
2. **CDB** — `mysql:8.4`. Wait until ping succeeds. (Independent of BDB; can start in parallel with BDB.)
3. **CA** — `eclipse-temurin:21-jre-alpine`. Reads `CRYPTO_KEK`, `CRYPTO_API_KEY`, connects to CDB, runs migrations, exposes `/health`.
4. **BL** — Reads its env vars, connects to BDB, runs migrations, validates `CA /health` is reachable; exposes `/health` only after migrations succeed.
5. **WT** — Nginx with static assets and `/api/*` proxy to BL. Exposes `/health` (Nginx local) and the static SPA root.
6. **LB** — Nginx in DMZ. Upstream to all WT instances.

Healthchecks (`HEALTHCHECK` in each Dockerfile / `healthcheck:` in `docker-compose.yml`):

| Service | Test |
|---|---|
| BDB / CDB | `mysqladmin ping -h localhost` |
| BL / CA | `curl -fsk https://localhost:8443/health` |
| WT | `curl -fs http://localhost/health` |
| LB | `curl -fsk https://localhost/health` |

In `prod`, the orchestration platform (or `docker compose --wait`) enforces ordering via `depends_on: condition: service_healthy`.

## 6. First-time deployment

```bash
# 1. Provision secrets in OpenBao under nexus-ca/<env>/
#    (run as the secrets admin)
openbao kv put nexus-ca/prod/jwt-secret value="$(openssl rand -base64 32)"
openbao kv put nexus-ca/prod/crypto-api-key value="$(openssl rand -base64 32)"
openbao kv put nexus-ca/prod/crypto-kek value="$(openssl rand -base64 32)"
openbao kv put nexus-ca/prod/crypto-kek-id value="kek-2026-05-31"
openbao kv put nexus-ca/prod/db/business value=<password>
openbao kv put nexus-ca/prod/db/crypto value=<password>
openbao kv put nexus-ca/prod/smtp value=<password>
openbao kv put nexus-ca/prod/crypto-db-backup-key value="$(openssl rand -base64 32)"

# 2. Lay down the compose project on each host (or apply the orchestration manifest)
ssh prod-host-01 'cd /opt/nexus-ca && git checkout v1.0.3'
ssh prod-host-01 'cd /opt/nexus-ca && docker compose --env-file .env.prod pull'

# 3. Start in two phases — DBs first, then services
ssh prod-host-01 'cd /opt/nexus-ca && docker compose --env-file .env.prod up -d --wait bdb cdb'
ssh prod-host-01 'cd /opt/nexus-ca && docker compose --env-file .env.prod up -d --wait ca bl wt lb'

# 4. Confirm health
ssh prod-host-01 'docker compose ps'
curl -sk https://nexus-ca.internal/api/v1/health | jq

# 5. Run the bootstrap procedure
#    See bootstrap-procedure.md
```

## 7. Routine release deployment (no schema change)

```bash
# Pre-flight
./scripts/preflight.sh prod 1.0.4

# Drain LB pool: remove one WT instance from the LB upstream, then redeploy it
./scripts/lb-drain.sh wt-1
ssh prod-host-01 'cd /opt/nexus-ca && docker compose --env-file .env.prod up -d --no-deps --wait wt-1'
./scripts/lb-undrain.sh wt-1
# repeat for wt-2, wt-3 ...

# Roll BL instances one at a time
./scripts/bl-drain.sh bl-1   # removes bl-1 from WT's upstream
ssh prod-host-01 'cd /opt/nexus-ca && docker compose --env-file .env.prod up -d --no-deps --wait bl-1'
./scripts/bl-undrain.sh bl-1
# repeat

# Roll CA instances (similar pattern; BL clients re-discover)
./scripts/ca-drain.sh ca-1
ssh prod-host-01 'cd /opt/nexus-ca && docker compose --env-file .env.prod up -d --no-deps --wait ca-1'
./scripts/ca-undrain.sh ca-1
# repeat

# Smoke tests
./scripts/smoke-prod.sh
```

## 8. Release with schema change

Schema migrations are applied at BL/CA startup by the Vert.x MySQL Client running numbered SQL scripts. Migrations must be backward-compatible (additive) within a single release. Any breaking change requires the expand-contract pattern across two releases:

1. **Release N (expand)** — add new column / table / index. Code reads both old and new shape.
2. **Release N+1 (contract)** — code writes new shape only. Drop the old shape.

Never deploy a release that simultaneously drops a column and replaces references to it; an in-flight instance running the older code will see a missing column on its next query.

## 9. Smoke tests

`./scripts/smoke-prod.sh` runs (as a read-only `AUDITOR`-role user):

| Test | Expected |
|---|---|
| `GET /api/v1/health` | 200 |
| `GET /api/v1/health/ready` | 200 |
| `GET /api/v1/auth/me` with valid JWT | 200, returns user |
| `GET /api/v1/root-cas` | 200, returns existing CAs (at least the smoke-test CA) |
| `GET /api/v1/intermediate-cas/issuable` | 200 |
| Metrics endpoint scraped by Prometheus within 60s | Grafana panel `up{job="business-logic-api"}` = 1 for all instances |

Any smoke test failure triggers immediate rollback (see §10).

## 10. Rollback

```bash
# 1. Re-tag the previous version as the deploy target
PREV=1.0.2
./scripts/preflight.sh prod $PREV

# 2. Roll back instance by instance using the same drain pattern as §7
#    (No DB rollback unless schema changed — see §8 expand-contract)
```

If the failed release shipped a schema change, do **not** roll back the schema. The rollback target must run against the *post-migration* schema. This is the reason for the expand-contract rule.

## 11. Decommission / shutdown

```bash
ssh prod-host-01 'cd /opt/nexus-ca && docker compose --env-file .env.prod stop lb wt bl ca'
# leave DBs running until final backup verified
ssh prod-host-01 'cd /opt/nexus-ca && docker compose --env-file .env.prod stop cdb bdb'
```

Do not remove volumes without explicit Platform Owner sign-off — destroying the Crypto DB volume permanently destroys all CA private keys.

## Related

- [tools.md](tools.md)
- [bootstrap-procedure.md](bootstrap-procedure.md)
- [backup-restore-runbook.md](backup-restore-runbook.md)
- [key-rotation-procedure.md](key-rotation-procedure.md)
- [observability-runbook.md](observability-runbook.md)

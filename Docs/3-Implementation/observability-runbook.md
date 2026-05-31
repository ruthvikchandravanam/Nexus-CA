# Observability Runbook

Defines the dashboards, alerts, and on-call response patterns for Nexus CA. Tooling: Prometheus + Grafana + Zipkin + Loki/ELK + Logback structured JSON (see [tools.md — Observability](tools.md#observability)).

---

## 1. Signals collected

| Signal | Source | Retention |
|---|---|---|
| Service metrics | `/metrics` on each service via `vertx-micrometer-metrics`; scraped by Prometheus every 15s | 30 days at full resolution, 1y downsampled |
| Health | `/health` and `/health/ready` per service | Real-time only (used by orchestrator + Grafana) |
| Distributed traces | OpenTelemetry Java agent → Zipkin | 7 days |
| Logs | Logback JSON to stdout → log aggregator (Loki or ELK) | 90 days |
| Audit | `audit_events` table in Business DB | Indefinite (no expiry per BRD) |

---

## 2. Dashboards

Each dashboard lives in Grafana under the *Nexus CA* folder.

### 2.1 Platform Overview

| Panel | Metric / query | Width |
|---|---|---|
| Up status | `up{job=~"business-logic-api|crypto-api|web-tier|load-balancer"}` | 6 |
| Request rate (BL) | `sum(rate(http_server_requests_total{job="business-logic-api"}[1m])) by (method, route)` | 6 |
| Request error rate (BL) | `sum(rate(http_server_requests_total{job="business-logic-api",status=~"5.."}[1m])) / sum(rate(http_server_requests_total{job="business-logic-api"}[1m]))` | 6 |
| p95 latency (BL) | `histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket{job="business-logic-api"}[1m])) by (le, route))` | 6 |
| Crypto API latency | Same shape for `crypto-api` | 6 |
| DB connection pool (BL) | `vertx_pool_in_use{pool_type="connection"}` vs. `vertx_pool_max{pool_type="connection"}` | 6 |
| Outbox depth | `nexus_ca_notification_outbox_pending` | 6 |
| Scheduler last-success | `nexus_ca_scheduler_last_success_timestamp_seconds` per task | 6 |

### 2.2 Authentication & Sessions

| Panel | Metric |
|---|---|
| Login success rate | `rate(nexus_ca_login_total{result="success"}[5m]) / rate(nexus_ca_login_total[5m])` |
| MFA failure rate | `rate(nexus_ca_mfa_failure_total[5m])` |
| Account lockouts (rolling 24h) | `increase(nexus_ca_account_locked_total[24h])` |
| Active sessions (estimated) | Count of distinct `users.id` with valid `session_version` within last `Session Timeout` |

### 2.3 Maker-Checker Throughput

| Panel | Metric |
|---|---|
| Requests submitted per type | `sum(rate(nexus_ca_request_submitted_total[5m])) by (type)` |
| Pending queue depth per checker role | `nexus_ca_request_pending_count{checker_role="..."}` |
| Time-to-decision histogram | `histogram_quantile(0.5, sum(rate(nexus_ca_request_decide_seconds_bucket[1h])) by (le, type))` |
| Superseded auto-reject rate | `rate(nexus_ca_request_superseded_total[5m])` |
| Execution failure rate | `rate(nexus_ca_request_execution_failure_total[5m]) by (type)` |

### 2.4 Crypto API

| Panel | Metric |
|---|---|
| Issuance rate | `rate(nexus_ca_certificate_issued_total[5m]) by (type)` |
| Issuance latency p95 | `histogram_quantile(0.95, sum(rate(nexus_ca_certificate_issue_seconds_bucket[5m])) by (le, type))` |
| Keypair generation latency | `histogram_quantile(0.95, sum(rate(nexus_ca_keypair_generation_seconds_bucket[5m])) by (le, algorithm))` |
| KEK decrypt errors | `rate(nexus_ca_kek_decrypt_failure_total[5m])` |
| API key validation failures | `rate(nexus_ca_crypto_api_key_invalid_total[5m])` |

### 2.5 Scheduled Tasks

| Panel | Metric |
|---|---|
| Last run per task | `time() - nexus_ca_scheduler_last_success_timestamp_seconds` |
| Run duration p95 | `histogram_quantile(0.95, sum(rate(nexus_ca_scheduler_run_seconds_bucket[1d])) by (le, task))` |
| Certificates transitioned to EXPIRED today | `increase(nexus_ca_certificates_transitioned_expired_total[24h])` |
| Warnings sent | `increase(nexus_ca_expiry_warnings_sent_total[24h])` |
| Escalations sent | `increase(nexus_ca_request_escalations_sent_total[24h])` |

### 2.6 Database health

| Panel | Source |
|---|---|
| BDB connections | `mysql_global_status_threads_connected{instance="bdb"}` |
| CDB connections | Same for `cdb` |
| Slow queries | `rate(mysql_global_status_slow_queries[5m])` |
| InnoDB buffer pool hit rate | `1 - (mysql_global_status_innodb_buffer_pool_reads / mysql_global_status_innodb_buffer_pool_read_requests)` |
| Replication lag (if read replicas added) | `mysql_slave_lag_seconds` |

---

## 3. Alerts

Alerts route via Alertmanager. Three channels: `pager` (SMS to on-call), `slack-warning` (Slack `#nexus-ca-alerts`), `email-info` (digest).

| Alert | Expression | Severity | Channel | Runbook |
|---|---|---|---|---|
| `BLDown` | `up{job="business-logic-api"} == 0 for 2m` | Critical | pager | [§5.1](#51-bl-or-ca-down) |
| `CADown` | `up{job="crypto-api"} == 0 for 2m` | Critical | pager | [§5.1](#51-bl-or-ca-down) |
| `LBDown` | `up{job="load-balancer"} == 0 for 1m` | Critical | pager | Restart LB; check FW-Ext |
| `HighErrorRate` | error rate > 5% over 5m | Warning | slack-warning | [§5.2](#52-elevated-error-rate) |
| `LatencyP95High` | BL p95 > 2s for 10m | Warning | slack-warning | [§5.3](#53-elevated-latency) |
| `DBConnectionsExhausted` | pool in_use / max > 0.9 for 5m | Warning | slack-warning | Increase pool size or investigate slow query |
| `OutboxBacklog` | `nexus_ca_notification_outbox_pending > 100 for 10m` | Warning | slack-warning | [§5.4](#54-email-outbox-backlog) |
| `SchedulerStuck` | `time() - nexus_ca_scheduler_last_success_timestamp_seconds{task="..."} > 86400 + 3600` | Critical | pager | [§5.5](#55-scheduled-task-not-running) |
| `KekDecryptFailures` | `rate(nexus_ca_kek_decrypt_failure_total[5m]) > 0` | Critical | pager | [incident-response.md](incident-response.md) — possible KEK mismatch |
| `LoginBruteForce` | `rate(nexus_ca_login_total{result="failure"}[5m]) > 50/min` | Warning | slack-warning | Check source IPs; coordinate with network |
| `AuditLogStalled` | `time() - max(audit_event_inserted_timestamp_seconds) > 600` AND request rate > 0 | Critical | pager | DB issue or BL bug — audit must never silently drop |
| `BackupMissingBusinessDB` | `time() - business_db_last_backup_timestamp_seconds > 90000` | Critical | pager | Investigate backup host |
| `BackupMissingCryptoDB` | `time() - crypto_db_last_backup_timestamp_seconds > 90000` | Critical | pager | Investigate backup host |
| `CertExpiryWarningFailures` | failure to send warning emails for > 24h | Warning | slack-warning | Investigate SMTP |
| `DiskSpaceLow` | `node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.1` | Warning | slack-warning | Clean up logs / backups; expand volume |

### 3.1 Alert hygiene

- Every alert has a runbook reference. No alert may exist without a documented response.
- Tune thresholds quarterly based on the false-positive log.
- Silenced alerts must have a stop-time and an owner.

---

## 4. Logging conventions

All services emit structured JSON to stdout. Required fields per log entry:

| Field | Source |
|---|---|
| `timestamp` | ISO-8601 UTC |
| `level` | DEBUG, INFO, WARN, ERROR |
| `service` | `business-logic-api`, `crypto-api`, `web-tier` |
| `instance` | hostname:pid |
| `trace_id` | W3C trace id from OpenTelemetry context (when available) |
| `span_id` | Same |
| `user_id` | When request is authenticated |
| `request_id` | The Nexus CA request id (not the HTTP request — see audit semantics) |
| `correlation_id` | Returned to client on errors (same as `trace_id`) |
| `message` | Human-readable summary |
| `event` | Machine-friendly event name (e.g., `LOGIN_SUCCESS`, `CSR_VALIDATED`) |
| `error_code` | When applicable (matches [error-catalog.md](../2-Design/2.2-LLD/error-catalog.md)) |

Never log: passwords, password hashes, OTC plaintext, JWT bodies, private keys, KEK, API keys, full request payloads containing CSR Subject (logged with subject only, not full DN).

---

## 5. Common incidents and procedures

### 5.1 BL or CA down

1. Confirm via Grafana panel and direct `curl https://<instance>/health`.
2. Check container logs: `docker logs --tail 200 <container>`.
3. Common causes:
   - Out-of-memory: container `Exit 137` — increase JVM heap or container memory limit.
   - DB unreachable: BL waits at startup; check BDB / CDB.
   - Migration failure: check the migration log; do not delete migration history.
4. Restart only after root cause is understood.

### 5.2 Elevated error rate

1. Open the *Authentication & Sessions* dashboard first — high 401 rate suggests a credential rotation or session issue.
2. If 4xx is concentrated on one route, look at the recent deploy history.
3. If 5xx, check BL logs for stack traces and pull a Zipkin trace by `correlation_id` from a sample error response.

### 5.3 Elevated latency

1. Check DB slow queries panel — usually a missing index or a recently-added expensive `SELECT`.
2. Check Crypto API latency — keypair generation for RSA 4096 is naturally slow (5–10s); a spike of those drags BL latency.
3. Check thread pool saturation in BL.

### 5.4 Email outbox backlog

1. Open the outbox panel; check the `last_error` distribution.
2. If errors point at SMTP timeout, check connectivity to corporate relay: from BL container, `openssl s_client -starttls smtp -connect <smtp>:587`.
3. The outbox sender has exponential backoff; it will drain once SMTP is healthy.
4. If SMTP is down for > 1h, escalate to corporate networking.

### 5.5 Scheduled task not running

1. Identify which task: `nexus_ca_scheduler_last_success_timestamp_seconds{task="..."}`.
2. Check `scheduler_locks` table — if `lock_owner` is set to a dead instance, the lock will not be cleaned up until `lock_expires_at`. Confirm and wait, or clear manually after verifying the owner is genuinely dead.
3. Check the targeted instance's logs for the periodic-timer fire and any thrown exceptions.

---

## 6. Audit log monitoring

The audit log is the BRD-mandated record of every state change. Two operational concerns:

1. **Audit log must never silently drop**. The alert `AuditLogStalled` catches this; INSERT failures in the audit path should crash the request, not be swallowed.
2. **Audit log must not be tamperable through the app**. Per [data-model.md](../2-Design/2.2-LLD/data-model.md#audit_events), the application DB user has INSERT-only on `audit_events` and `audit_field_changes`. Any DELETE/UPDATE against these tables is performed by a separate DBA credential and is itself logged at the DB level.

A weekly cron job exports `audit_events` to read-only WORM storage as a defense-in-depth measure (out of scope for v1.0 implementation but recommended; deferred to v2).

---

## 7. Related

- [tools.md — Observability](tools.md#observability)
- [error-catalog.md](../2-Design/2.2-LLD/error-catalog.md)
- [incident-response.md](incident-response.md)
- [disaster-recovery.md](disaster-recovery.md)

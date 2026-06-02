# Incident Response

How to recognize, classify, contain, and learn from incidents in Nexus CA. Covers operational outages and security incidents alike. For DR-scale events, see [disaster-recovery.md](disaster-recovery.md).

---

## 1. Roles

| Role | Responsibility |
|---|---|
| **Incident Commander (IC)** | Drives the response; ensures tasks are assigned and tracked; communicates status. Not the same person doing the technical work. |
| **Technical Lead (TL)** | Hands-on investigation and remediation. |
| **Communications Lead** | Posts status to stakeholders; if security, owns external/legal communication. |
| **Scribe** | Maintains an incident timeline as actions and observations happen. |
| **On-call engineer** | First responder to the page; escalates to IC if severity warrants. |

In small incidents the IC, TL, and Scribe may be the same person. In Sev1/Sev2 incidents they should be different people.

---

## 2. Severity

| Severity | Definition | Examples | Response |
|---|---|---|---|
| **Sev1** | Active loss of CA capability OR confirmed compromise of CA private keys or KEK | KEK lost; CDB unrecoverable; CA private key exfiltrated | Page IC + Platform Owner immediately; convene war room within 15 min |
| **Sev2** | Significant degradation OR suspected security incident | BL down; audit log stalled; suspicious access pattern; sustained brute-force | Page on-call; IC convened within 30 min |
| **Sev3** | Localized degradation, workaround exists | Single instance unhealthy; one scheduled task missed a cycle | On-call investigates during business hours |
| **Sev4** | Minor / cosmetic | UI rendering glitch; verbose log; non-critical metric noise | File ticket; no paging |

---

## 3. Detection sources

| Source | Examples |
|---|---|
| Alertmanager → pager | Critical alerts from [observability-runbook.md §3](observability-runbook.md#3-alerts) |
| User reports | Stakeholder Slack messages, support tickets |
| Audit log review | Periodic review by the security team |
| External notification | Vendor security disclosure, CERT advisory |

---

## 4. Response process (every incident)

### Step 1 — Acknowledge

On-call acknowledges the page within 5 minutes (Sev1/Sev2). If on-call cannot respond, the pager escalates to the secondary.

### Step 2 — Stabilize

Before deep investigation, contain the damage:

- If a service is down and a known-good rollback exists, roll back.
- If credentials are suspected compromised, rotate immediately (see [key-rotation-procedure.md](key-rotation-procedure.md)).
- If an actor is suspected of malicious activity, disable the account (WF-006).

### Step 3 — Diagnose

Use logs, traces, and dashboards to identify root cause. Capture evidence:

- Screenshot relevant Grafana panels.
- Save Zipkin traces by `trace_id`.
- Save BL/CA logs for the incident window (`docker logs --since <T0> --until <T1>`).
- For security incidents: capture audit log rows; do NOT modify the system in a way that destroys evidence (e.g., do not `docker rm` containers).

### Step 4 — Resolve

Apply the fix. Confirm by smoke test + observation of the previously-failing signal.

### Step 5 — Communicate

| Audience | When | Channel |
|---|---|---|
| Internal Slack | At incident open; status every 30 min until resolved | `#nexus-ca-alerts` |
| Stakeholders (named in playbook) | At Sev1/Sev2 open; resolution; post-mortem | Email |
| Platform Owner | Sev1 immediately; Sev2 at acknowledgement | Phone |
| Security team | Any suspected security incident (Sev2+) | Phone |

### Step 6 — Close

After confirming the system is healthy:

- Resolve the alert in Alertmanager.
- Update the incident ticket with the resolution.
- Schedule a post-mortem within 5 business days (Sev1/Sev2).

---

## 5. Playbooks

### 5.1 BL or CA down

→ See [observability-runbook.md §5.1](observability-runbook.md#51-bl-or-ca-down).

### 5.2 Suspected KEK compromise

| # | Action |
|---|---|
| 1 | Page Platform Owner and security lead (Sev1) |
| 2 | Open emergency KEK rotation per [key-rotation-procedure.md §2](key-rotation-procedure.md#2-emergency-kek-rotation-suspected-compromise) |
| 3 | Decide whether private keys must be considered compromised (see [key-rotation-procedure.md §2.1](key-rotation-procedure.md#21-decision-re-key-or-revoke)) |
| 4 | If yes: revoke affected CAs (WF-009, WF-015); reissue dependent end-entity certificates |
| 5 | Capture evidence and timeline for post-incident review |

### 5.3 Audit log stalled

| # | Action |
|---|---|
| 1 | Investigate BDB health: connections, slow queries |
| 2 | Investigate BL logs for INSERT failures into `audit_events` |
| 3 | If BDB is healthy and BL is throwing on audit insert, this is a code bug — stop traffic, roll back |
| 4 | Once audit insertions resume, manually emit an `AUDIT_RESUMED` event with the gap window noted |

### 5.4 Brute-force login pattern

| # | Action |
|---|---|
| 1 | Identify source IP(s) from BL logs / Nginx logs |
| 2 | If a small set of IPs: ask network to block at corporate firewall |
| 3 | Confirm Nginx rate limiting is in effect (5 req/min/IP) |
| 4 | Confirm account lockout is functioning (locked accounts in the audit log) |
| 5 | If targeted at a specific username: contact that user; consider WF-006 disable |

### 5.5 Compromised user account

| # | Action |
|---|---|
| 1 | SUPER_ADMIN_MAKER initiates WF-006 disable on the account (Sev2) |
| 2 | Increment `session_version` is automatic on disable |
| 3 | Review the user's recent audit trail to identify what they accessed or changed |
| 4 | For privileged accounts (SUPER_ADMIN_*, CA_ADMIN_*, CA_OPERATOR_*): review any requests they approved while compromised; consider reversing (note: revoked CAs cannot be un-revoked, so cascading impact must be evaluated) |
| 5 | Issue a new account via WF-005 for the legitimate user; password reset via WF-014 |

### 5.6 SMTP outage

| # | Action |
|---|---|
| 1 | Confirm via outbox dashboard ([§5.4 observability-runbook](observability-runbook.md#54-email-outbox-backlog)) |
| 2 | If corporate SMTP is genuinely down: escalate; the outbox will retain pending messages and drain when SMTP recovers |
| 3 | If SMTP is broken specifically for Nexus CA (cert / auth issue): re-pull SMTP credentials from OpenBao; check STARTTLS cert chain on the relay |
| 4 | For prolonged outages, consider whether to pause flows that depend on email (admin password reset) |

### 5.7 Crypto API API key compromise

Follow [key-rotation-procedure.md §3.2](key-rotation-procedure.md#32-emergency).

---

## 6. Post-incident review (post-mortem)

For every Sev1 and Sev2 incident, conduct a blameless post-mortem within 5 business days.

Template:

```
# Post-mortem: <short description> — <YYYY-MM-DD>

## Summary
One paragraph.

## Impact
Who was affected, for how long, what couldn't they do?

## Timeline (UTC)
- HH:MM — first observation
- HH:MM — alerts fired
- HH:MM — IC convened
- HH:MM — root cause identified
- HH:MM — fix applied
- HH:MM — incident closed

## Root cause
What actually went wrong (technical detail).

## What went well
2-4 bullets.

## What went badly
2-4 bullets — process gaps, blind spots, slow tooling.

## Action items
| # | Action | Owner | Due |
|---|---|---|---|

## Detection / Response gaps
Did monitoring catch it? Was the runbook adequate? Were the right people paged?
```

Action items are tracked in Gitea with the `post-mortem` label and reviewed monthly.

---

## 7. Related

- [observability-runbook.md](observability-runbook.md)
- [key-rotation-procedure.md](key-rotation-procedure.md)
- [backup-restore-runbook.md](backup-restore-runbook.md)
- [disaster-recovery.md](disaster-recovery.md)
- [threat-model.md](../2-Design/security/threat-model.md)

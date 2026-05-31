# Disaster Recovery

Plan for recovering Nexus CA after a catastrophic loss of the primary site or DBs. This document defines the recovery objectives, the DR topology, and the runbook for failover.

For day-to-day backup and restore procedures (single-DB corruption, single-host loss), see [backup-restore-runbook.md](backup-restore-runbook.md). For routine incident response, see [incident-response.md](incident-response.md).

---

## 1. Objectives

| Metric | Target | Notes |
|---|---|---|
| RPO — Business DB | ≤ 1 hour | Achieved via hourly binary log flush + PITR |
| RPO — Crypto DB | ≤ 1 hour | Same |
| RTO — Read-only access | ≤ 4 hours | Reports + downloads of existing certificates and CA public certs |
| RTO — Full write capability | ≤ 8 hours | Including certificate issuance and CA management |
| MTPD (Maximum Tolerable Period of Disruption) | 24 hours | Beyond this, dependent systems begin experiencing downstream impact as certificates approach expiry |

These objectives apply to a Sev1 disaster (loss of primary data center, total host loss). For partial outages, see incident-response.md.

---

## 2. DR scenarios in scope

| Scenario | Approach |
|---|---|
| Primary data center loss | Failover to DR site using replicated backups |
| Total loss of BDB (corruption, hardware failure) | Restore from backup per [backup-restore-runbook.md §3](backup-restore-runbook.md#3-restore--business-db) |
| Total loss of CDB | Restore from backup per [backup-restore-runbook.md §4](backup-restore-runbook.md#4-restore--crypto-db); requires KEK |
| Loss of KEK | Acknowledged as recovery-blocking for CA private keys; see [§7](#7-kek-loss-degraded-recovery) |
| Loss of secrets manager | Rebuild from offline copies of seed secrets; rotate everything |

---

## 3. DR topology

| Component | Primary | DR site |
|---|---|---|
| LB / WT / BL / CA containers | Active in primary | Standby (cold) in DR; images pulled from registry on demand |
| BDB | Active primary | Daily full backup + hourly binlog mirrored to DR backup volume |
| CDB | Active primary | Same; mirrored only within secure-channel inside the organization's perimeter |
| Backup encryption keys | Primary OpenBao | Replicated to DR OpenBao |
| KEK | Primary OpenBao + offline archive | DR OpenBao loaded from offline archive at activation time |

The DR site is **cold** — no containers running until failover. This is intentional: a hot DR site for a CA introduces split-brain risks (which site issued this certificate?). Cold DR avoids that at the cost of higher RTO.

### 3.1 Backup mirroring

Backups are mirrored asynchronously from primary backup host to DR backup host every hour. Mirroring uses `rsync` over a dedicated channel; the DR backup host has no inbound network from anywhere except the primary backup host on a single port.

---

## 4. DR activation decision

DR activation is a Platform Owner decision. Triggers:

- Confirmed loss of primary data center for > 2 hours with no ETA.
- Confirmed unrecoverable BDB or CDB at primary, with backups also unavailable at primary.
- Security incident requiring isolation of the primary environment.

The Platform Owner notifies the IC, security lead, and stakeholders before activation.

---

## 5. Failover runbook

### 5.1 Pre-failover (T+0 to T+15 minutes)

| # | Action |
|---|---|
| 1 | Platform Owner approves activation in writing |
| 2 | IC + TL + Comms Lead convene |
| 3 | Confirm primary is genuinely unrecoverable (not split-brain bait) |
| 4 | Notify stakeholders that platform is going into DR |

### 5.2 DR site activation (T+15 to T+90 minutes)

| # | Action |
|---|---|
| 1 | DR site engineer powers up DR hosts |
| 2 | Restore Business DB from latest mirrored backup per [backup-restore-runbook.md §3](backup-restore-runbook.md#3-restore--business-db) onto DR BDB host |
| 3 | Load the KEK matching the latest CDB backup into DR OpenBao from the offline archive (two-person witnessed) |
| 4 | Restore Crypto DB from latest mirrored backup per [backup-restore-runbook.md §4](backup-restore-runbook.md#4-restore--crypto-db) onto DR CDB host |
| 5 | Inject all DR-side secrets into containers (JWT_SECRET, CRYPTO_API_KEY, CRYPTO_KEK[s]) from DR OpenBao |
| 6 | Bring up BL, CA, WT, LB on DR hosts in startup order per [deployment-runbook.md §5](deployment-runbook.md#5-container-startup-order) |
| 7 | Run the mandatory test sign per [backup-restore-runbook.md §4.2 step 9](backup-restore-runbook.md#42-procedure) to confirm KEK + CDB are aligned |
| 8 | Run smoke tests per [deployment-runbook.md §9](deployment-runbook.md#9-smoke-tests) |

### 5.3 Cutover (T+90 to T+120 minutes)

| # | Action |
|---|---|
| 1 | Update corporate DNS to point `nexus-ca.internal` to DR LB IP (TTL pre-tuned to ≤ 60s) |
| 2 | Comms Lead announces DR is live; resume of access for users |
| 3 | Confirm one end-to-end issuance against a test CA in DR |
| 4 | Open incident ticket transitions to "monitoring" status |

### 5.4 Post-failover

| # | Action |
|---|---|
| 1 | Schedule post-mortem |
| 2 | Plan primary site rebuild |
| 3 | When primary is rebuilt: take a fresh backup at DR, restore at primary, perform reverse cutover during a planned maintenance window |
| 4 | Update DR documentation with lessons learned |

---

## 6. RPO at activation — what is "lost"

Depending on when the disaster occurred relative to the last backup mirror:

| Time since last mirror | Data potentially lost on activation |
|---|---|
| 0–60 min | At worst the last 60 minutes of audit, requests, certificate issuances |
| > 60 min | Indicates mirroring also failed; escalate before activation |

The lost-data window means:

- Some requests submitted in the last hour before the disaster will be absent on DR. Users may need to resubmit.
- Some certificates issued in the last hour may not appear in DR. Those certificates exist (the user has them) but are not in the system; they cannot be re-downloaded. Users who downloaded successfully are unaffected; users who did not must request a new CSR-based issuance.
- Audit events for the lost window are missing. This is a compliance gap that must be documented in the incident report.

---

## 7. KEK loss: degraded recovery

If the KEK matching the CDB backup at the time of failover is **not available** in either primary OpenBao, DR OpenBao, or the offline archive:

**Outcome:** CA private keys cannot be decrypted. Existing end-entity certificates already in the field continue to work until they expire (they don't need the CA to validate). But no new certificate can be signed by an existing CA; revoked CAs cannot be re-keyed.

**Recovery path:** Restore BDB normally (operators, users, audit log, request history remain). Bring up the platform. Issue new Root CAs (WF-001 generates new keypairs encrypted with the new KEK). Begin reissuing every active certificate under the new chains.

This scenario is **the** disaster the entire KEK retention policy ([key-rotation-procedure.md §1.7](key-rotation-procedure.md#17-remove-the-old-kek)) exists to prevent. The 6-month retention window + offline archive should make it vanishingly rare.

---

## 8. DR rehearsal

Tabletop or full DR rehearsal **annually**.

| Type | Frequency | Scope |
|---|---|---|
| Tabletop | Quarterly | Walk through §5 on a whiteboard with the response team; no actual failover |
| Partial | Semi-annual | Restore BDB only to DR test instance; confirm reports load |
| Full | Annual | Stand up the entire DR stack in an isolated environment; complete §5 end-to-end; tear down |

Each rehearsal produces a written report filed with the Platform Owner.

---

## 9. Related

- [backup-restore-runbook.md](backup-restore-runbook.md)
- [key-rotation-procedure.md](key-rotation-procedure.md)
- [incident-response.md](incident-response.md)
- [bootstrap-procedure.md](bootstrap-procedure.md)

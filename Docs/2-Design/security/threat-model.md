# Threat Model

The threats this platform must defend against and the controls mapped to each threat. Methodology: STRIDE per asset, with explicit attacker scenarios for the most material threats.

## 1. Assets

| ID | Asset | Sensitivity |
|---|---|---|
| A1 | CA private keys | **Critical** — compromise undermines every certificate ever issued under the CA |
| A2 | Issued certificates and certificate metadata | Internal |
| A3 | User credentials (password hashes, OTC) | Critical |
| A4 | Audit log | Critical (integrity) |
| A5 | Session JWTs | Internal (confidentiality), Critical (integrity) |
| A6 | System configuration (lockout thresholds, key-size minimums, etc.) | Internal |
| A7 | Email notifications (containing temporary passwords, OTCs) | Critical (in transit) |
| A8 | KEK and JWT secrets | Critical |

## 2. Trust boundaries

```
[Internet] ─[FW-Ext]─► [DMZ: LB] ─[FW-Int]─► [VLAN 2: WT] ─► [VLAN 3: BL + BDB] ─► [VLAN 4: CA + CDB]
                                                                          │
                                                                          └─[outbound 587]─► [Corporate SMTP relay]
```

Each arrow is a boundary across which authentication and validation apply. The most important boundary is VLAN 3 → VLAN 4 — once a request crosses into VLAN 4, it touches private keys.

## 3. Attackers considered

| ID | Attacker | Capability |
|---|---|---|
| T1 | External unauthenticated attacker on internet | Network access to LB only |
| T2 | Authenticated low-privilege user (e.g., AUDITOR) | Valid JWT |
| T3 | Authenticated maker | Can submit requests |
| T4 | Authenticated checker | Can approve/reject requests |
| T5 | Malicious insider — ADMIN_MAKER or ADMIN_CHECKER | Single dual-control role |
| T6 | Malicious insider — DBA with Business DB access | Direct DB write |
| T7 | Malicious insider — DBA with Crypto DB access | Direct DB write |
| T8 | Compromised VLAN 3 host (e.g., BL container escape) | Outbound to Crypto API, BDB |
| T9 | Compromised secrets manager | All env vars exposed |
| T10 | Lost / stolen backup volume | Ciphertext only |

## 4. STRIDE × asset matrix

| Asset | Spoofing | Tampering | Repudiation | Info Disclosure | DoS | Elevation |
|---|---|---|---|---|---|---|
| **A1 CA private keys** | C1 | C2 | — | C3, C4 | — | C5 |
| **A3 Credentials** | C6, C7 | C8 | — | C9 | C10 | C11 |
| **A4 Audit log** | — | C12 | C13 | — | — | — |
| **A5 JWT** | C14 | C15 | — | — | — | C16 |
| **A7 Email** | C17 | — | — | C18 | — | — |
| **A8 KEK / JWT secret** | — | — | — | C19 | — | C20 |

## 5. Controls

| ID | Control | Mitigates | Source / Reference |
|---|---|---|---|
| C1 | CA private keys are only generated inside VLAN 4 by the Crypto API; never imported from caller | T1, T2, T3, T8 | [architecture.md — Key Storage](../2.1-HLD/architecture.md#key-storage) |
| C2 | CA private keys stored AES-256-GCM with AAD that binds to ca_kind+ca_id+kek_id; tamper attempt fails GCM tag verification | T6, T7, T10 | [crypto-design.md §2.2](../2.2-LLD/crypto-design.md#22-encryption-format) |
| C3 | VLAN 4 firewall denies all egress except DB-within-VLAN-4; VLAN 3 cannot read CDB directly | T1, T8 | [architecture.md — VLANs](../2.1-HLD/architecture.md#vlans) |
| C4 | Crypto API never returns private key material — only certificates and signed data | T2, T3, T8 | [architecture.md — Crypto API](../2.1-HLD/architecture.md#crypto-api) |
| C5 | Crypto API requires `X-Crypto-Api-Key` AND network origin from VLAN 3; admin endpoints require additional `X-Crypto-Admin-Token` | T1, T2, T3 | [crypto-design.md §6](../2.2-LLD/crypto-design.md#6-crypto-api-endpoint-contract) |
| C6 | Authentication requires bcrypt password verify + MFA via email OTC | T1, T5 | BRD Authentication |
| C7 | Constant-time SHA-256 compare on OTC verification | T1 | [crypto-design.md §4](../2.2-LLD/crypto-design.md#4-otc-one-time-code-mechanics) |
| C8 | Password hashes stored as bcrypt cost 12; never returned via API | T6 | [crypto-design.md §3](../2.2-LLD/crypto-design.md#3-password-storage) |
| C9 | OTC plaintext never stored; only SHA-256; single-use; rotated on issue | T6, T10 | Same |
| C10 | Nginx rate limit on `/auth/login` and `/auth/mfa` (5/min/IP); MFA failure threshold locks account | T1 | [tools.md — Rate Limit Configuration](../../3-Implementation/tools.md#load-balancer-dmz) |
| C11 | Self-approval blocked; self-role-change blocked; self-disable blocked | T3, T4, T5 | BRD Segregation of Duties |
| C12 | Audit log is append-only; DB user used by BL has INSERT privilege only on `audit_events` and `audit_field_changes` | T6 (partial) | [data-model.md — audit_events](../2.2-LLD/data-model.md#audit_events) |
| C13 | Every state change emits an audit event with actor, timestamp, before/after snapshots | T3, T4, T5 | BRD Audit Requirements |
| C14 | JWT signed with HS256 + `JWT_SECRET`; signature verified per request | T1, T2 | [crypto-design.md §5](../2.2-LLD/crypto-design.md#5-jwt-design) |
| C15 | JWT carries `session_version`; mismatched session_version (e.g., role change, force logout) invalidates the JWT | T3, T4 | [architecture.md — Single Active Session](../2.1-HLD/architecture.md#single-active-session-enforcement) |
| C16 | JWT does not carry permissions inline — role is in claim and authorisation is re-checked server-side per request | T2 | Same |
| C17 | Emails sent only by the BL via SMTP relay with STARTTLS; recipient address is read from `users.email` set by ADMIN_MAKER (cannot be self-changed to bypass) | T5 | BRD Self-Profile Update (email IS editable; mitigated by C13 audit) |
| C18 | TLS on SMTP relay; corporate relay is the only outbound destination from VLAN 3 (single fixed IP) | T1 | [architecture.md — VLANs](../2.1-HLD/architecture.md#vlans) |
| C19 | Secrets stored in OpenBao with audit; KEK never persisted to disk on CA host; injected at container start | T6, T9 (partial) | [tools.md — Secret Management](../../3-Implementation/tools.md#secret-management) |
| C20 | Two-person physical procedure for KEK rotation and bootstrap | T9 (residual) | [bootstrap-procedure.md](../../3-Implementation/bootstrap-procedure.md), [key-rotation-procedure.md](../../3-Implementation/key-rotation-procedure.md) |

## 6. Residual risks

| Risk | Mitigation chosen | Residual impact |
|---|---|---|
| Maker-checker collusion | Two-person personnel security (background check, role separation policy) | Accepted — technical controls cannot prevent two cooperating insiders |
| Compromise of secrets manager (T9) | Defense-in-depth via two-person rotation procedure; no single env var grants direct private-key access (need both KEK and CDB) | Accepted — secrets manager hardening is an organisational responsibility |
| Loss of `CRYPTO_KEK` | 6-month KEK retention; offline archive; documented backup-restore procedure | Operational risk — if KEK is truly lost, restored CA private keys are unrecoverable. This is acknowledged in BRD / tools.md and is the reason the KEK has the strictest controls in the system |
| Audit log tampering by direct DB access (T6) | Application user has INSERT-only on audit tables; DELETE/UPDATE only via DBA credentials | DBA with full privileges can still tamper. Out of scope for v1.0; HSM-backed write-once storage is a v2 candidate |
| External revocation notification (CRL/OCSP) | Out of scope for v1.0 | Relying parties cannot externally check revocation status; internal-only consumer base assumed |
| HSM not used | Out of scope for v1.0 | Software-encrypted keys; KEK in env var. Acceptable for internal CA; HSM is v2 candidate for high-value Root CAs |
| Denial of service against LB | Nginx rate limits + corporate network DDoS posture | LB capacity is the bound; treat as availability incident, not security |

## 7. Notable attack scenarios

### Scenario 1 — Stolen Crypto DB backup (T10)

Attacker exfiltrates a Crypto DB backup tarball.

- Backup is XtraBackup-encrypted with a key separate from the KEK (C19 secrets isolation).
- Even if decrypted, every `ca_private_keys.encrypted_private_key` is AES-256-GCM ciphertext bound to `CRYPTO_KEK` (C2).
- Outcome: ciphertext only — no private keys recovered. The attacker must additionally obtain the KEK.

### Scenario 2 — Compromised BL container (T8)

Attacker gains code execution inside a Business Logic API container.

- Attacker has `JWT_SECRET` (env var). They can forge JWTs for any user.
- Attacker can read/write the Business DB. They can create users, modify roles, even alter audit records (mitigated by the INSERT-only application DB user — but the attacker controls the BL process, so they could re-grant). Audit tampering remains a residual risk.
- Attacker can call the Crypto API. The Crypto API will sign anything the JWT-authorized BL asks it to — so the attacker can issue certificates under any CA, and request new CAs (which BL would normally gate by maker-checker, but the attacker controls BL).
- **They cannot directly extract private keys** — the Crypto API never returns them (C4).

Detection: anomalous certificate issuance volume (observability — see [observability-runbook.md](../../3-Implementation/observability-runbook.md)). Incident response: rotate `CRYPTO_API_KEY`, `JWT_SECRET`, audit issued certificates for the compromise window.

### Scenario 3 — Malicious ADMIN_CHECKER (T5)

Attacker is an authenticated ADMIN_CHECKER colluding with no one.

- They can approve any administrative request *submitted by an ADMIN_MAKER*. They cannot submit and approve their own (C11).
- A solo malicious checker can therefore approve, but cannot originate, a malicious change. The malicious maker would have to exist separately.
- Detection: every approval is audited with the checker's identity and comment (C13).

This is exactly the design intent of the maker-checker control.

### Scenario 4 — Brute force against login (T1)

Attacker tries password lists against the public LB.

- Nginx limits to 5 req/min/IP on `/auth/login` and `/auth/mfa` (C10).
- After 3 MFA failures the user account locks (configurable). Account locked email is sent to the user and ADMIN_MAKER (visibility).
- An attacker would need to find a valid username AND get the right password AND get past MFA before lockout. Realistically infeasible.

---

## 8. Versioning

This threat model is reviewed annually and on every architecture change. Last reviewed: 2026-05-31.

## Related

- [architecture.md](../2.1-HLD/architecture.md)
- [crypto-design.md](../2.2-LLD/crypto-design.md)
- [BRD — Authentication Requirements](../../1-Requirements/BRD.md#authentication-requirements)
- [BRD — Audit Requirements](../../1-Requirements/BRD.md#audit-requirements)
- [incident-response.md](../../3-Implementation/incident-response.md)

# Sequence Diagrams

End-to-end sequences for the flows that cross component boundaries. These complement the workflow files in `Docs/1-Requirements/Workflows/` — workflows describe *what happens*; sequence diagrams describe *who calls whom* and *in what order*.

Components in the diagrams below:

- **U** — User (browser)
- **LB** — Load Balancer (DMZ)
- **WT** — Web Tier (Nginx in VLAN 2)
- **BL** — Business Logic API (VLAN 3)
- **BDB** — Business DB (VLAN 3)
- **CA** — Crypto API (VLAN 4)
- **CDB** — Crypto DB (VLAN 4)
- **SMTP** — Corporate SMTP relay

---

## 1. Authentication + MFA

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant LB
    participant WT
    participant BL
    participant BDB
    participant SMTP

    U->>LB: POST /api/v1/auth/login (username, password)
    LB->>WT: forward
    WT->>BL: forward
    BL->>BDB: SELECT user WHERE username_lower = ?
    BDB-->>BL: row(password_hash, status, locked_at, ...)
    BL->>BL: bcrypt.verify(password, hash)
    alt invalid OR locked OR disabled
        BL-->>U: 401 AUTH-0001/0002/0003
    else valid AND password expired
        BL-->>U: 200 {force_reset:true, mfa_required:true}
        note over BL,U: flow continues at /auth/force-reset (WF-012)
    else valid AND ok
        BL->>BL: generate 6-digit OTC
        BL->>BDB: INSERT INTO otc_tokens (purpose=LOGIN_MFA, sha256, expires_at)
        BL->>BDB: INSERT INTO notification_outbox (template=MFA_OTC, body=...)
        BL-->>U: 200 {mfa_required: true}
        par async outbox sender
            BL->>BDB: SELECT pending notifications
            BL->>SMTP: STARTTLS, send OTC email
            BL->>BDB: UPDATE notification_outbox SET status='SENT'
        end
    end
    U->>BL: POST /api/v1/auth/mfa (code)
    BL->>BDB: SELECT otc_tokens WHERE user_id, purpose, unconsumed
    BL->>BL: constant-time SHA-256 compare
    alt invalid or expired
        BL->>BDB: UPDATE users SET mfa_failure_count = mfa_failure_count + 1
        alt failure_count >= MFA_ATTEMPT_LIMIT
            BL->>BDB: UPDATE users SET locked_at = NOW()
            BL->>BDB: INSERT notification_outbox (template=ACCOUNT_LOCKED)
        end
        BL-->>U: 401 AUTH-0020/0021
    else valid
        BL->>BDB: BEGIN
        BL->>BDB: UPDATE otc_tokens SET consumed_at = NOW()
        BL->>BDB: UPDATE users SET session_version = session_version + 1, last_login_at = NOW(), mfa_failure_count = 0
        BL->>BDB: INSERT audit_events (LOGIN_SUCCESS)
        BL->>BDB: COMMIT
        BL->>BL: sign JWT (sub, role, session_version, exp)
        BL-->>U: 200 {jwt: "..."}
    end
```

---

## 2. Root CA Creation (end-to-end)

```mermaid
sequenceDiagram
    autonumber
    participant U as ADMIN_MAKER
    participant BL
    participant BDB
    participant CH as ADMIN_CHECKER
    participant CA
    participant CDB

    U->>BL: POST /root-cas/requests/create (cn, o, c, algo, size, years)
    BL->>BL: validate fields per WF-001
    BL->>BDB: INSERT requests (type=ROOT_CA_CREATE, status=PENDING_APPROVAL, payload)
    BL->>BDB: INSERT audit_events (REQUEST_SUBMITTED)
    BL->>BDB: INSERT notification_outbox (template=PENDING_APPROVAL → all ADMIN_CHECKERs)
    BL-->>U: 201 {request_id}

    note over CH: later, checker logs in and opens pending queue

    CH->>BL: GET /requests/{id}
    BL->>BDB: SELECT request, build before/after snapshots
    BL-->>CH: request detail

    CH->>BL: POST /requests/{id}/approve
    BL->>BL: self-approval check (sub != maker_user_id)
    BL->>BDB: UPDATE requests SET status='APPROVED', checker_user_id, decided_at
    BL->>BDB: INSERT audit_events (REQUEST_APPROVED)
    BL->>BDB: INSERT notification_outbox (template=APPROVED → maker)

    note over BL: execution kicks off synchronously after approve

    BL->>CA: POST /v1/ca/root (Idempotency-Key, subject, algo, size, validity)
    CA->>CA: BouncyCastle: generate keypair
    CA->>CA: build TBSCertificate per Root CA profile, self-sign
    CA->>CA: PKCS#8 encode private key, AES-256-GCM with KEK
    CA->>CDB: BEGIN
    CA->>CDB: INSERT ca_private_keys (encrypted, iv, tag, kek_id)
    CA->>CDB: INSERT ca_public_certificates (der, pem, serial)
    CA->>CDB: COMMIT
    CA-->>BL: 201 {serial, certificate_pem}

    BL->>BDB: BEGIN
    BL->>BDB: INSERT root_cas (cn, o, c, ..., status=ACTIVE)
    BL->>BDB: UPDATE requests SET status='EXECUTED' then 'COMPLETED', executed_at, completed_at
    BL->>BDB: INSERT audit_events (REQUEST_EXECUTED, after_snapshot)
    BL->>BDB: UPDATE requests SET status='REJECTED' WHERE target=this AND status='PENDING_APPROVAL' (supersede)
    BL->>BDB: INSERT notification_outbox (template=EXECUTED → maker)
    BL->>BDB: COMMIT
    BL-->>CH: 200 {request_id, status: COMPLETED}
```

Notes:
- The execution call to the Crypto API uses an `Idempotency-Key` of `request_id` so a retry produces the same persisted state.
- If the Crypto API fails after the keypair is generated but before the BL transaction completes, the BL retries; the Crypto API short-circuits to the prior response on `Idempotency-Key` replay.
- If the BL transaction fails after a successful Crypto API call, the next retry sees the Crypto DB row already exists; the BL re-fetches it and continues persistence in the Business DB.

---

## 3. Certificate Issuance (end-to-end)

```mermaid
sequenceDiagram
    autonumber
    participant U as OPERATOR_MAKER
    participant BL
    participant BDB
    participant CH as OPERATOR_CHECKER
    participant CA
    participant CDB

    U->>BL: POST /certificates/csr/parse (csr_pem)
    BL->>BL: parse PKCS#10, verify signature
    BL-->>U: {subject, public_key_info, sans, csr_sha256}

    U->>BL: GET /intermediate-cas/issuable
    BL->>BDB: SELECT Intermediate CAs WHERE chain entirely ACTIVE
    BL-->>U: [{ca_id, cn, ...}]

    U->>BL: POST /certificates/requests/issue (csr, csr_sha256, ca_id, type, dates, format)
    BL->>BDB: SELECT certificates WHERE csr_sha256 = ?  (uniqueness)
    BL->>BL: validate dates, type, chain still ACTIVE
    BL->>BDB: INSERT requests (type=CERTIFICATE_ISSUE, payload)
    BL->>BDB: INSERT audit_events (REQUEST_SUBMITTED)
    BL->>BDB: INSERT notification_outbox (→ OPERATOR_CHECKERs)
    BL-->>U: 201 {request_id}

    note over CH: later

    CH->>BL: GET /requests/{id}
    BL-->>CH: detail (CSR subject, sans, key info, chosen CA, type, dates, format)
    CH->>BL: POST /requests/{id}/approve
    BL->>BDB: UPDATE requests SET status=APPROVED

    BL->>CA: POST /v1/cert/issue (csr_pem, ca_id, type, dates)
    CA->>CDB: SELECT ca_private_keys for issuing CA
    CA->>CA: AES-256-GCM decrypt with KEK matching kek_id
    CA->>CA: build TBSCertificate per profile (CLIENT/SERVER/SIGNING)
    CA->>CA: sign per signature-algorithm-selection rule
    CA->>CA: build PEM, DER, PEM-chain, P7B outputs
    CA->>CDB: BEGIN
    CA->>CDB: INSERT issued_certificates (all output formats, serial)
    CA->>CDB: INSERT csr_archive (csr_sha256, der, subject_dn)
    CA->>CDB: COMMIT
    CA-->>BL: 201 {serial, outputs}

    BL->>BDB: BEGIN
    BL->>BDB: INSERT certificates (metadata, output_format, crypto_db_certificate_id)
    BL->>BDB: UPDATE requests SET status=EXECUTED
    BL->>BDB: INSERT audit_events (REQUEST_EXECUTED)
    BL->>BDB: INSERT notification_outbox (→ maker)
    BL->>BDB: COMMIT
    BL-->>CH: 200

    note over U: later, OPERATOR_MAKER downloads

    U->>BL: GET /certificates/{id}/download
    BL->>BDB: SELECT certificate, verify caller is maker/checker for this cert
    BL->>CA: GET /v1/cert/{cdb_id}/download?format=PEM_FULL_CHAIN
    CA->>CDB: SELECT issued_certificates
    CA-->>BL: bytes
    BL->>BDB: BEGIN
    BL->>BDB: UPDATE requests SET status=COMPLETED, completed_at WHERE caller is maker AND status=EXECUTED
    BL->>BDB: INSERT audit_events (CERTIFICATE_DOWNLOADED)
    BL->>BDB: COMMIT
    BL-->>U: 200 application/x-pem-file
```

---

## 4. Maker-Checker execution with concurrent requests

Illustrates how the *superseded by executed request* rule is applied at execution time.

```mermaid
sequenceDiagram
    autonumber
    participant M1 as ADMIN_MAKER A
    participant M2 as ADMIN_MAKER B
    participant BL
    participant BDB
    participant C as ADMIN_CHECKER

    M1->>BL: submit Disable Root CA #1
    BL->>BDB: INSERT requests R1 (target=RootCA#1, status=PENDING_APPROVAL)

    M2->>BL: submit Disable Root CA #1 (parallel)
    BL->>BDB: INSERT requests R2 (target=RootCA#1, status=PENDING_APPROVAL)

    C->>BL: approve R1
    BL->>BDB: BEGIN
    BL->>BDB: UPDATE requests SET status='APPROVED' WHERE id=R1
    BL->>BDB: UPDATE root_cas SET status='DISABLED' WHERE id=#1
    BL->>BDB: UPDATE requests SET status='REJECTED', checker_comment='superseded by executed request' WHERE target_entity_kind='ROOT_CA' AND target_entity_id=#1 AND status='PENDING_APPROVAL' AND id != R1
    BL->>BDB: UPDATE requests SET status='EXECUTED' WHERE id=R1
    BL->>BDB: INSERT audit_events ×3 (approved, executed, superseded)
    BL->>BDB: COMMIT
    BL-->>C: 200

    note over BDB: R2 is now REJECTED with the superseded reason; M2 is notified
```

---

## 5. Root CA Revocation cascade

```mermaid
sequenceDiagram
    autonumber
    participant M as ADMIN_MAKER
    participant BL
    participant BDB
    participant C as ADMIN_CHECKER

    M->>BL: submit Revoke Root CA #1 (reason)
    BL->>BDB: INSERT requests (type=ROOT_CA_REVOKE)
    M->>BL: GET impact summary
    BL->>BDB: count descendant Intermediates, count active certs
    BL-->>M: counts

    C->>BL: approve
    BL->>BDB: BEGIN
    BL->>BDB: UPDATE root_cas SET status='REVOKED', revocation_reason, revocation_date WHERE id=#1
    BL->>BDB: WITH RECURSIVE descendants AS (...)
    BL->>BDB: UPDATE intermediate_cas SET status='REVOKED', revocation_reason='SUPERSEDED', revocation_date, revoked_due_to_cascade_from=(ROOT,#1) WHERE id IN descendants
    BL->>BDB: INSERT audit_events (REQUEST_EXECUTED for Root CA)
    BL->>BDB: INSERT audit_events × N (CA_REVOKED_CASCADE for each Intermediate)
    BL->>BDB: UPDATE requests SET status='EXECUTED' then 'COMPLETED'
    BL->>BDB: INSERT notification_outbox (→ maker)
    BL->>BDB: COMMIT
    BL-->>C: 200
```

If the BL transaction fails at any point, the entire cascade rolls back — no partial revocation is ever persisted (see WF-009 Error Paths).

---

## 6. Scheduled task — Certificate expiry transition

```mermaid
sequenceDiagram
    autonumber
    participant T as setPeriodic tick (every 24h)
    participant BL
    participant BDB

    T->>BL: tick
    BL->>BDB: BEGIN
    BL->>BDB: SELECT * FROM scheduler_locks WHERE task_name='CERT_EXPIRY_TRANSITION' FOR UPDATE
    alt lock held by another instance and not expired
        BL->>BDB: COMMIT (release row lock, do nothing)
    else lock free or expired
        BL->>BDB: UPDATE scheduler_locks SET lock_owner=$inst, locked_at=NOW(), lock_expires_at=NOW()+10m
        BL->>BDB: COMMIT
        BL->>BDB: UPDATE certificates SET status='EXPIRED' WHERE status='ACTIVE' AND valid_to < NOW()
        BL->>BDB: INSERT audit_events × N (CERTIFICATE_EXPIRED)
        BL->>BDB: UPDATE scheduler_locks SET lock_owner=NULL, locked_at=NULL, lock_expires_at=NULL
    end
```

The same pattern is used for `EXPIRY_WARNING_NOTIFICATIONS` and `PENDING_REQUEST_ESCALATION`.

---

## Related

- [architecture.md](architecture.md)
- [Workflows/](../../1-Requirements/Workflows/)
- [crypto-design.md](../2.2-LLD/crypto-design.md)
- [data-model.md](../2.2-LLD/data-model.md)

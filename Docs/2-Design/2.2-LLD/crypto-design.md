# Crypto Design

This document specifies the cryptographic policy and the internal contract between the Business Logic API and the Crypto API. It also defines the OTC and password mechanisms used by the Business Logic API.

---

## 1. Algorithm policy

### 1.1 Permitted public-key algorithms

Per [BRD — System Configuration](../../1-Requirements/BRD.md#system-configuration):

| Algorithm | Permitted key sizes / curves | Default minimum (System Configuration) |
|---|---|---|
| RSA | 2048, 3072, 4096 bits | 2048 |
| EC | `secp256r1` (NIST P-256), `secp384r1` (NIST P-384), `secp521r1` (NIST P-521) | 256 bits (i.e., P-256) |

Brainpool curves, Edwards curves (Ed25519, Ed448), and X25519/X448 are **not permitted** in v1.0. BouncyCastle supports them, but they are excluded for compatibility with common consumer libraries (OpenSSL, .NET, Go's `crypto/x509`, Java's stock `JSSE`) which historically had inconsistent NIST-curve support. Adding new algorithms is a v2.0 change-management item.

EC key size mapping:
- 256-bit EC key size → curve `secp256r1`
- 384-bit EC key size → curve `secp384r1`
- 521-bit EC key size → curve `secp521r1`

The "key size" parameter for EC encodes the curve choice; no separate curve picker is exposed in the UI.

### 1.2 Signature algorithm selection

Signature algorithms are determined by the **issuer's** key algorithm — the algorithm that performs the signing — not the subject's key. The platform pairs hash strength to key strength per NIST SP 800-57 Part 1 guidance.

| Issuer key | Key size | Signature algorithm | OID |
|---|---|---|---|
| RSA | 2048 | `SHA256withRSA` | 1.2.840.113549.1.1.11 |
| RSA | 3072 | `SHA384withRSA` | 1.2.840.113549.1.1.12 |
| RSA | 4096 | `SHA384withRSA` | 1.2.840.113549.1.1.12 |
| EC | P-256 | `SHA256withECDSA` | 1.2.840.10045.4.3.2 |
| EC | P-384 | `SHA384withECDSA` | 1.2.840.10045.4.3.3 |
| EC | P-521 | `SHA512withECDSA` | 1.2.840.10045.4.3.4 |

RSA-PSS is not used in v1.0 for the same compatibility reason as the curve exclusion. PKCS#1 v1.5 (`SHAxxxwithRSA`) is the universally interoperable option.

### 1.3 Hash algorithm policy (non-signature uses)

| Purpose | Algorithm | Notes |
|---|---|---|
| CSR digest (uniqueness check) | SHA-256 | Stored hex in `certificates.csr_sha256`. |
| Subject Key Identifier / Authority Key Identifier | SHA-1 over BIT STRING `subjectPublicKey` | Per RFC 5280 §4.2.1.2. SHA-1 here is non-security-sensitive (identifier only, not signature). |
| OTC storage | SHA-256 hex | OTC plaintext never stored. |
| Password storage | bcrypt cost 12 | See §3. |
| KEK encryption | AES-256-GCM | See §2. |

### 1.4 Random number generation

All key generation, OTC generation, serial numbers, IVs, and tokens are sourced from `java.security.SecureRandom` initialized with the JDK default provider (NativePRNG on Linux). No explicit seeding; no use of `Random`.

---

## 2. Private key storage

### 2.1 KEK (Key Encryption Key)

| Aspect | Value |
|---|---|
| Algorithm | AES-256-GCM (authenticated encryption) |
| Key length | 256 bits |
| Source | Environment variable `CRYPTO_KEK`, Base64-encoded raw bytes, injected at container start (see [tools.md](../../3-Implementation/tools.md)) |
| Storage | Never persisted by the Crypto API. The KEK lives only in container memory. |
| Identifier | A short string identifier (e.g., `kek-v1`, `kek-v2`) is set via env var `CRYPTO_KEK_ID`. Stored alongside ciphertext in `ca_private_keys.kek_id`. |

### 2.2 Encryption format

For each CA private key:

```
ciphertext = AES-256-GCM(KEK, IV, PKCS#8(private_key), AAD)
AAD = utf8("nexus-ca|ca_kind=<ROOT|INTERMEDIATE>|ca_id=<business_db_ca_id>|kek_id=<id>")
```

Stored columns (per [data-model.md — ca_private_keys](data-model.md#ca_private_keys)):

- `encrypted_private_key` = ciphertext
- `iv` = 96-bit random GCM nonce, per-record
- `gcm_tag` = 128-bit GCM authentication tag
- `kek_id` = id of the KEK used to encrypt

AAD inclusion of `ca_id` and `kek_id` defends against record swap and confused-deputy attacks (an attacker who obtains a Crypto DB row cannot reuse it under a different CA id without detection).

### 2.3 KEK rotation

KEK rotation runs as a maintenance operation, not a live request:

1. Inject the new KEK via env var, restart Crypto API instances with **both** old and new KEKs loaded (key-id-indexed).
2. Run the `kek-rotate` admin job (a Crypto API endpoint reachable only from VLAN 4 with admin token): decrypt each `ca_private_keys` row with its current `kek_id` KEK, re-encrypt with the new KEK, update row with new `kek_id`/`iv`/`gcm_tag`.
3. After all rows are re-encrypted, redeploy with only the new KEK loaded.

See [key-rotation-procedure.md](../../3-Implementation/key-rotation-procedure.md) for the operational runbook.

---

## 3. Password storage

| Aspect | Value |
|---|---|
| Algorithm | bcrypt |
| Cost | 12 |
| Library | Vert.x Auth includes a bcrypt implementation; alternatively use BouncyCastle's `BCrypt` |
| Storage | `users.password_hash` (VARCHAR(72)) — bcrypt encoded string includes salt |
| Reuse policy | The Force Password Reset flow rejects reusing the *current* password (bcrypt-compare new vs current). No N-history requirement in v1.0. |

Temporary password generation (WF-005, WF-014): 16-character random string drawn from `[A-Za-z0-9!@#$%^&*]` ensuring at least one each of upper, lower, digit, special. Plaintext exists only in the email body and is discarded after sending; only the bcrypt hash is persisted.

---

## 4. OTC (One-Time Code) mechanics

Used for:
- MFA second factor on login
- Forgot Password (WF-011)
- Force Password Reset (WF-012)

| Aspect | Value |
|---|---|
| Format | 6-digit numeric (`000000`–`999999`) |
| Generation | `SecureRandom.nextInt(1_000_000)`, zero-padded |
| Storage | `otc_tokens.code_sha256` = SHA-256 hex of the plaintext code; plaintext never stored |
| Validity window | `MFA One-Time Code Validity (minutes)` from System Configuration (default 10 minutes) |
| Single use | `consumed_at` is set on successful verification; verification rejects already-consumed tokens |
| Single outstanding | On new issuance, any prior unconsumed unexpired token for the same `(user_id, purpose)` is marked consumed; only the latest OTC is valid |
| Failure tracking | Failed verifications increment `users.mfa_failure_count`; reaching `MFA Attempt Limit` triggers account lockout (per BRD) |

OTC verification uses **constant-time comparison** on the SHA-256 hash to mitigate timing attacks.

---

## 5. JWT design

| Aspect | Value |
|---|---|
| Type | JWS, JWT format |
| Signing algorithm | HS256 (HMAC-SHA-256) |
| Signing key | `JWT_SECRET` env var, ≥ 256 bits, Base64-encoded |
| Token lifetime | `Session Timeout (minutes)` from System Configuration; encoded in `exp` claim |
| Issued by | Business Logic API only |
| Validated by | Business Logic API on every authenticated request |

Asymmetric JWS (RS256/ES256) is not used in v1.0 because the only verifier of the JWT is the same service that issues it — adding key distribution complexity yields no security benefit.

### 5.1 Claims

| Claim | Type | Notes |
|---|---|---|
| `iss` | string | `nexus-ca` |
| `sub` | string | User ID (decimal) |
| `username` | string | Username (informational) |
| `role` | string | One of the five roles |
| `session_version` | integer | Snapshot of `users.session_version` at issue time |
| `iat` | integer | Issued at (Unix seconds) |
| `exp` | integer | Expiry (Unix seconds) |
| `jti` | string (UUID) | Used for audit correlation |

### 5.2 Validation

On every authenticated request the Business Logic API performs (in order):
1. Signature verification (HS256 with `JWT_SECRET`).
2. `exp > now`.
3. `session_version` claim equals the current value of `users.session_version` — this enforces single active session and force-logout (per [architecture.md — Single Active Session Enforcement](../2.1-HLD/architecture.md#single-active-session-enforcement)).
4. `users.status = ACTIVE` and `users.locked_at IS NULL`.

Any failure: 401 with code `AUTH-0030`/`0031`/`0032` (see [error-catalog.md](error-catalog.md)) and client redirects to login.

---

## 6. Crypto API endpoint contract

All endpoints require header `X-Crypto-Api-Key: <CRYPTO_API_KEY>`. Missing or wrong key → 401 `AUTH-0040`. All responses JSON. Numeric IDs are decimal strings to avoid 64-bit precision loss on JSON consumers.

### 6.1 `POST /v1/ca/root`

Create a Root CA (generate keypair + self-sign).

Request:
```json
{
  "subject": { "cn": "Internal Root CA", "o": "Acme Corp", "c": "US" },
  "key_algorithm": "EC",
  "key_size_bits": 384,
  "validity_from": "2026-06-01T00:00:00Z",
  "validity_to": "2046-06-01T00:00:00Z",
  "business_db_ca_id": "1001",
  "max_hierarchy_depth": 3
}
```

Response 201:
```json
{
  "ca_kind": "ROOT",
  "business_db_ca_id": "1001",
  "serial_number_hex": "7ab3...",
  "certificate_pem": "-----BEGIN CERTIFICATE-----\n...",
  "signature_algorithm": "SHA384withECDSA"
}
```

### 6.2 `POST /v1/ca/intermediate`

Create an Intermediate CA (generate keypair + parent signs).

Request:
```json
{
  "subject": { "cn": "Issuing CA 1", "o": "Acme Corp", "c": "US" },
  "key_algorithm": "EC",
  "key_size_bits": 384,
  "validity_from": "...",
  "validity_to": "...",
  "business_db_ca_id": "2050",
  "parent_kind": "ROOT",
  "parent_business_db_ca_id": "1001",
  "depth": 1,
  "max_hierarchy_depth": 3
}
```

Response 201: same shape as `/v1/ca/root` with `ca_kind: "INTERMEDIATE"`.

### 6.3 `POST /v1/cert/issue`

Issue an end-entity certificate.

Request:
```json
{
  "csr_pem": "-----BEGIN CERTIFICATE REQUEST-----\n...",
  "csr_sha256": "abc123...",
  "issuing_intermediate_business_db_ca_id": "2050",
  "certificate_type": "SERVER",
  "valid_from": "2026-06-01T00:00:00Z",
  "valid_to": "2027-06-01T00:00:00Z",
  "business_db_certificate_id": "9001"
}
```

Response 201:
```json
{
  "serial_number_hex": "a8c1...",
  "certificate_pem": "...",
  "issued_at": "2026-06-01T10:00:00Z",
  "outputs": {
    "pem_cert_only": "...",
    "pem_full_chain": "...",
    "der_cert_only_b64": "...",
    "der_full_chain_b64": "...",
    "pkcs7_p7b_b64": "..."
  }
}
```

### 6.4 `GET /v1/ca/{ca_kind}/{business_db_ca_id}/certificate`

Returns the CA's public certificate in PEM and DER (Base64).

### 6.5 `GET /v1/cert/{business_db_certificate_id}/download?format=PEM_FULL_CHAIN`

Returns the stored bytes in the requested format. (The Business Logic API proxies this to the user.)

### 6.6 `POST /v1/admin/kek-rotate`

Admin job to re-encrypt all `ca_private_keys` from old KEK to new KEK. Requires both `X-Crypto-Api-Key` and an additional `X-Crypto-Admin-Token` header (separate env var `CRYPTO_ADMIN_TOKEN`). Reachable only from VLAN 4 management host. Idempotent; reports per-row outcome.

### 6.7 `GET /health`

Liveness and DB connectivity check. Returns 200 with `{"status":"UP"}` or 503.

### 6.8 Retry & idempotency

Crypto operations that mutate state (Root/Intermediate CA creation, certificate issuance) accept an optional `Idempotency-Key` header (UUID). If the Crypto API receives the same key twice within a 24h window, it returns the original response without re-doing the work. The Business Logic API generates this key from `(request_id, attempt_number=0)` so retries are safe.

The Business Logic API retries failed crypto calls with exponential backoff (3 attempts: 1s, 3s, 9s). After exhaustion the request is marked `EXECUTED` with `execution_failure_reason` set; the maker is notified.

---

## 7. CSR validation

A CSR is accepted only if:

1. It parses as PKCS#10.
2. The embedded signature verifies against the embedded public key.
3. The public-key algorithm is in *Allowed Key Algorithms*.
4. The public-key size is ≥ the configured minimum for that algorithm.
5. For EC: the curve is one of the three permitted curves.
6. `csr_sha256` (SHA-256 over DER) is not present in `certificates.csr_sha256` — enforces the *CSR used once* rule.

Requested extensions in the CSR are honored only to the extent that the profile permits (see [certificate-profiles.md](certificate-profiles.md)). Unknown or disallowed extensions are dropped; SAN values are copied verbatim subject to per-profile rules.

---

## Related

- [BRD — Authentication Requirements](../../1-Requirements/BRD.md#authentication-requirements)
- [data-model.md](data-model.md)
- [certificate-profiles.md](certificate-profiles.md)
- [key-rotation-procedure.md](../../3-Implementation/key-rotation-procedure.md)

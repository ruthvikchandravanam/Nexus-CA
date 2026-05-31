# Glossary

Definitions for project-specific and PKI terms used across Nexus CA documentation. When two documents use a term, this is the authoritative definition.

## Project terms

| Term | Definition |
|---|---|
| **Nexus CA** | The name of the platform. |
| **Maker** | A user who initiates a request that requires approval. The two maker roles are `ADMIN_MAKER` and `OPERATOR_MAKER`. |
| **Checker** | A user who reviews and approves or rejects a request submitted by a maker. The two checker roles are `ADMIN_CHECKER` and `OPERATOR_CHECKER`. |
| **Maker-Checker workflow** | The dual-control pattern in which one user submits an action and a different user approves it before execution. Implemented for all administrative and operational request types in Nexus CA. |
| **Self-approval** | The prohibited situation in which the same user is both the maker and the checker of a request. Prevented by both UI and server enforcement. |
| **Superseded request** | A `PENDING_APPROVAL` request that targets the same entity as another request which has now been `EXECUTED`. Per BRD, all such pending peers are auto-rejected with reason *"superseded by executed request."* |
| **Bootstrap** | The one-time procedure that creates the initial ADMIN_MAKER and ADMIN_CHECKER user accounts, bypassing maker-checker. The `/setup` endpoint is permanently disabled after first use. |
| **Audit record** | An immutable, append-only log entry that captures who did what, when, against which entity, with full payload and before/after snapshot. Stored in `audit_events` + `audit_field_changes`. |
| **Cascade revocation** | When a CA is revoked, all of its descendant Intermediate CAs are automatically and atomically revoked in the same transaction. |
| **VLAN 2 / 3 / 4** | The three internal network segments. VLAN 2 hosts the Web Tier, VLAN 3 the Business Logic API + Business DB, VLAN 4 the Crypto API + Crypto DB. See [architecture.md — VLANs](2-Design/2.1-HLD/architecture.md#vlans). |
| **Business DB** | The MySQL database in VLAN 3 holding non-cryptographic application state. |
| **Crypto DB** | The MySQL database in VLAN 4 holding all private keys and certificate bytes. |

## Request lifecycle terms

| Term | Definition |
|---|---|
| `PENDING_APPROVAL` | Initial state of a request after submission by a maker. |
| `APPROVED` | Checker has approved the request. Transient state pending execution. |
| `REJECTED` | Checker has rejected the request with a mandatory comment. Terminal. |
| `EXECUTED` | The system has applied the change implied by the approved request. For most request types, immediately transitions to `COMPLETED`. |
| `COMPLETED` | Terminal success state. For most request types this is automatic on `EXECUTED`; for certificate issuance it is triggered by the OPERATOR_MAKER downloading the certificate. |

## PKI terms

| Term | Definition |
|---|---|
| **CA (Certificate Authority)** | An entity that issues digital certificates. Nexus CA manages two kinds: Root CAs and Intermediate CAs. |
| **Root CA** | A self-signed CA at the top of a trust chain. In Nexus CA, multiple Root CAs may exist independently of each other. |
| **Intermediate CA** | A CA whose certificate is signed by another CA (Root or another Intermediate). Used to issue end-entity certificates and to subdivide responsibilities. |
| **End-entity certificate** | A non-CA certificate (`Basic Constraints cA: FALSE`) issued for a specific purpose: CLIENT, SERVER, or SIGNING. |
| **CN — Common Name** | An attribute of an X.509 Subject DN. Historically used for hostnames; modern TLS clients ignore it for hostname matching in favor of SAN. |
| **O — Organisation, C — Country** | X.509 Subject DN attributes. |
| **CSR (Certificate Signing Request)** | A PKCS#10 structure submitted by a key-holder to a CA, containing the public key and Subject information to be issued in a certificate. Nexus CA enforces *CSR used once* via SHA-256 digest uniqueness. |
| **DN (Distinguished Name)** | The X.500 identifier in a certificate's Subject or Issuer field. Composed of attribute-value pairs (CN, O, C, OU, …). |
| **Serial Number** | A unique-per-issuer identifier embedded in every certificate. Nexus CA uses 128 random bits. |
| **Validity Period** | The `notBefore` … `notAfter` window during which a certificate is valid. After `notAfter`, the certificate is `EXPIRED`. |
| **Basic Constraints** | X.509 extension distinguishing CA certs (`cA: TRUE`) from end-entity certs. Includes optional `pathLenConstraint`. |
| **Key Usage** | X.509 extension declaring what cryptographic operations the key may perform (e.g., `digitalSignature`, `keyCertSign`). |
| **EKU — Extended Key Usage** | X.509 extension narrowing the purposes for which a certificate may be used (e.g., `serverAuth`, `clientAuth`, `codeSigning`, `emailProtection`). |
| **SAN — Subject Alternative Name** | X.509 extension carrying additional identities (DNS names, IPs, email addresses). For SERVER certificates, modern TLS clients verify hostnames against SAN, not CN. |
| **SKI — Subject Key Identifier** | X.509 extension carrying a hash of the certificate's public key, used to match a cert to its key. |
| **AKI — Authority Key Identifier** | X.509 extension carrying a hash of the issuer's public key, used to find the issuing certificate during chain validation. |
| **PEM** | Base64-with-headers encoding of DER bytes (`-----BEGIN CERTIFICATE-----` blocks). |
| **DER** | The binary ASN.1 Distinguished Encoding Rules; the native byte form of X.509 certificates and CSRs. |
| **PKCS#7 / P7B** | A container format (RFC 5652 `SignedData`) commonly used to bundle a certificate with its issuing chain. Nexus CA emits P7B with empty `signerInfos` (chain only). |
| **PKCS#8** | Standard encoding for a private key including algorithm identifier. |
| **PKCS#10** | The CSR format. |
| **RFC 5280** | The IETF profile of X.509 certificates and CRLs used by the internet PKI. Nexus CA conforms to it. |
| **CRL — Certificate Revocation List** | A signed list of revoked certificates published by a CA. **Out of scope for Nexus CA v1.0.** |
| **OCSP — Online Certificate Status Protocol** | A real-time certificate revocation lookup protocol. **Out of scope for Nexus CA v1.0.** |
| **ACME — Automatic Certificate Management Environment** | RFC 8555 protocol for automated certificate issuance (e.g., Let's Encrypt). **Out of scope for v1.0.** |
| **HSM — Hardware Security Module** | A tamper-resistant device for private-key storage and crypto operations. **Out of scope for v1.0.** Nexus CA stores private keys software-encrypted in the Crypto DB. |
| **ASN.1** | The notation used to define the abstract structure of X.509 and many other PKI artifacts. |
| **OID — Object Identifier** | A dotted-decimal hierarchical identifier (e.g., `1.3.6.1.5.5.7.3.1` for `serverAuth` EKU). |

## Cryptographic terms

| Term | Definition |
|---|---|
| **RSA** | An asymmetric algorithm. Nexus CA permits 2048, 3072, 4096-bit keys. |
| **EC / ECDSA** | Elliptic curve digital signatures. Nexus CA permits NIST curves P-256, P-384, P-521. |
| **AES-256-GCM** | Authenticated symmetric encryption used to wrap CA private keys with the KEK. |
| **KEK — Key Encryption Key** | The AES-256 key used to encrypt CA private keys at rest in the Crypto DB. Injected via env var; never persisted by the application. |
| **DEK — Data Encryption Key** | The (here implicit) per-record AES key for GCM mode; in Nexus CA the KEK is used directly with per-record IV. |
| **bcrypt** | Adaptive password-hashing function. Nexus CA uses cost 12. |
| **OTC — One-Time Code** | The 6-digit numeric code emailed for MFA, forgot-password, and force-reset flows. Single-use, time-bounded. Earlier docs may use "OTP" or "verification code" — *OTC* is the canonical term. |
| **JWT — JSON Web Token** | Signed token carrying `sub`, `role`, `session_version`. Validated stateless on every request. |
| **JWS — JSON Web Signature** | Signature container for JWT. Nexus CA uses HS256. |
| **HMAC** | Keyed-hash message authentication. HMAC-SHA-256 is used as the JWS signing algorithm. |
| **SecureRandom** | The JDK CSPRNG abstraction; used for all keys, IVs, serials, OTCs, and tokens. |

## Roles (BRD-defined)

| Role | Scope |
|---|---|
| `ADMIN_MAKER` | Submits administrative requests: CA management, user management, system configuration, CA revocation. |
| `ADMIN_CHECKER` | Reviews and decides on administrative requests. |
| `OPERATOR_MAKER` | Submits certificate issuance requests. |
| `OPERATOR_CHECKER` | Reviews and decides on certificate issuance requests. |
| `AUDITOR` | Read-only across all data and requests. |

## See also

- [BRD](1-Requirements/BRD.md) — the canonical scope and roles document
- [architecture.md](2-Design/2.1-HLD/architecture.md) — system topology
- [crypto-design.md](2-Design/2.2-LLD/crypto-design.md) — algorithm policy

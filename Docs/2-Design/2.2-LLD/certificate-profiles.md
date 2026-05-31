# Certificate Profiles

This document defines the exact X.509 v3 extension set for every certificate the platform issues. The Crypto API constructs every certificate per the profile below; nothing is dynamic per request other than Subject DN, Subject Alternative Names (where allowed), validity window, serial number, public key, and signature.

Reference: RFC 5280 (Internet X.509 PKI Certificate and CRL Profile). All certificates issued by Nexus CA are X.509 v3 conforming to RFC 5280.

---

## Common attributes

| Attribute | Value |
|---|---|
| Version | v3 |
| Serial Number | 128-bit cryptographically random, positive, encoded as a non-negative integer (MSB cleared if it would otherwise be set). Generated per RFC 5280 §4.1.2.2. |
| Signature Algorithm | Determined by issuer key algorithm — see [crypto-design.md — Signature algorithm selection](crypto-design.md#signature-algorithm-selection). |
| Issuer | DN of the signing CA. |
| Subject | DN derived from the request payload (CA: from creation fields; end-entity: from CSR Subject). |
| Validity | UTC `notBefore` / `notAfter`. For end-entity certificates `notBefore = max(request.valid_from, now)`; `notAfter = request.valid_to`. |
| Subject Public Key Info | For CAs: the generated public key. For end-entity certs: copied from CSR. |
| Authority Key Identifier (AKI) | `keyIdentifier` = SHA-1 of the issuer's BIT STRING `subjectPublicKey` (RFC 5280 §4.2.1.1). Non-critical. Omitted only on a self-signed Root CA. |
| Subject Key Identifier (SKI) | SHA-1 of the BIT STRING `subjectPublicKey` (RFC 5280 §4.2.1.2). Non-critical. Mandatory on all certificates. |
| CRL Distribution Points | **Not included** — CRL is out of scope for v1.0 (per [BRD — Out of Scope](../../1-Requirements/BRD.md#out-of-scope)). |
| Authority Information Access | **Not included** — OCSP/AIA is out of scope for v1.0. |
| Certificate Policies | Not included in v1.0. |

> **No CRL/OCSP extensions.** Because v1.0 does not publish revocation information externally, relying parties have no way to verify revocation status from the certificate alone. This is acceptable because the platform's consumers are internal and revocation status is observable through the Nexus CA UI/API.

---

## Profile: Root CA

| Extension | Criticality | Value |
|---|---|---|
| Basic Constraints | **Critical** | `cA: TRUE`, `pathLenConstraint: <Maximum CA Hierarchy Depth − 1>` (so the chain length is bounded). Computed at issuance from the configured maximum depth at that moment. |
| Key Usage | **Critical** | `keyCertSign, cRLSign` (we include `cRLSign` for forward compatibility even though CRL publication is not implemented in v1.0). |
| Subject Key Identifier | Non-critical | SHA-1 of public key BIT STRING. |
| Authority Key Identifier | **Omitted** | Self-signed; not required by RFC 5280. |
| Extended Key Usage | **Omitted** | EKU on Root CAs is not specified by RFC 5280 and is undesirable (it would constrain all descendants). |
| Subject Alternative Name | **Omitted** | Not used for CAs. |

Validity period: 1..30 years per request, enforced by the BRD-defined CA validity rules.

---

## Profile: Intermediate CA

| Extension | Criticality | Value |
|---|---|---|
| Basic Constraints | **Critical** | `cA: TRUE`, `pathLenConstraint: <Maximum CA Hierarchy Depth − this CA's depth − 1>`. For a leaf-most Intermediate CA (one that can only sign end-entity certificates), pathLenConstraint = 0. |
| Key Usage | **Critical** | `keyCertSign, cRLSign`. |
| Subject Key Identifier | Non-critical | SHA-1 of public key BIT STRING. |
| Authority Key Identifier | Non-critical | SHA-1 of parent CA's public key BIT STRING. |
| Extended Key Usage | **Omitted** | We do **not** constrain Intermediate CAs by EKU in v1.0 — the simpler model (one Intermediate CA may sign any of CLIENT / SERVER / SIGNING leaves) is intentional. Operators who want per-purpose Intermediates create separate Intermediate CAs and select them appropriately when issuing. |
| Subject Alternative Name | **Omitted** | Not used for CAs. |

---

## Profile: CLIENT certificate

For client authentication of users or services to a server (e.g., mTLS client auth).

| Extension | Criticality | Value |
|---|---|---|
| Basic Constraints | **Critical** | `cA: FALSE`. |
| Key Usage | **Critical** | `digitalSignature, keyEncipherment` (`keyEncipherment` included only for RSA keys; for EC keys, only `digitalSignature` is set — RFC 5480 §3 prohibits `keyEncipherment` for ECDSA-only keys). |
| Extended Key Usage | **Critical** | `id-kp-clientAuth` (1.3.6.1.5.5.7.3.2). |
| Subject Key Identifier | Non-critical | SHA-1 of public key BIT STRING. |
| Authority Key Identifier | Non-critical | SHA-1 of issuing Intermediate CA's public key BIT STRING. |
| Subject Alternative Name | Non-critical | Copied from CSR if present (`rfc822Name`, `otherName/UPN`, `dNSName`, `iPAddress`). If CSR has no SAN, none is added. |

Maximum validity: governed by `Maximum Certificate Validity — CLIENT (days)` (default 365).

---

## Profile: SERVER certificate

For TLS server identity (e.g., internal web service, internal gRPC).

| Extension | Criticality | Value |
|---|---|---|
| Basic Constraints | **Critical** | `cA: FALSE`. |
| Key Usage | **Critical** | RSA: `digitalSignature, keyEncipherment`. EC: `digitalSignature` only. |
| Extended Key Usage | **Critical** | `id-kp-serverAuth` (1.3.6.1.5.5.7.3.1). `id-kp-clientAuth` is also set when the CSR contains `clientAuth` in its requested EKU (some service-to-service deployments need mutual TLS with the same cert). |
| Subject Key Identifier | Non-critical | SHA-1 of public key. |
| Authority Key Identifier | Non-critical | SHA-1 of issuing Intermediate CA's public key. |
| Subject Alternative Name | **Critical when the Subject CN is empty or contains no FQDN** | Required to contain at least one `dNSName` or `iPAddress`. The platform extracts SANs from the CSR; if the CSR has no SAN AND the Subject CN is not a valid DNS name or IP, issuance is rejected at submission with `VAL-0027 server certificate requires SAN`. Modern TLS clients (Chrome, Go since 1.15) ignore the CN for hostname verification — SAN is mandatory. |

Maximum validity: governed by `Maximum Certificate Validity — SERVER (days)` (default 365). Note: many public TLS programs cap at 398 days; the default 365 is intentionally below that ceiling.

---

## Profile: SIGNING certificate

For document or code signing (general-purpose digital signature, not certificate issuance).

| Extension | Criticality | Value |
|---|---|---|
| Basic Constraints | **Critical** | `cA: FALSE`. (SIGNING certs are end-entity only; they cannot sign other certificates. CA-style signing uses Intermediate CAs.) |
| Key Usage | **Critical** | `digitalSignature, nonRepudiation` (also called `contentCommitment` in RFC 5280). |
| Extended Key Usage | **Critical** | `id-kp-codeSigning` (1.3.6.1.5.5.7.3.3) **and** `id-kp-emailProtection` (1.3.6.1.5.5.7.3.4). The CSR may request a subset; if so, only the requested EKUs are placed in the issued certificate. At least one of the two must be present. |
| Subject Key Identifier | Non-critical | SHA-1 of public key. |
| Authority Key Identifier | Non-critical | SHA-1 of issuing Intermediate CA's public key. |
| Subject Alternative Name | Non-critical | Copied from CSR if present (typically `rfc822Name` for email-protection use). |

Maximum validity: governed by `Maximum Certificate Validity — SIGNING (days)` (default 730).

---

## Subject DN composition rules

For all end-entity certificates the Subject DN is taken **verbatim from the CSR Subject** with the following rejections at submission:

| Condition | Result |
|---|---|
| Subject CN contains characters outside printable ASCII | Reject `VAL-0028` |
| Subject DN contains duplicate attribute types | Reject `VAL-0029` |
| For SERVER certificates: Subject CN is non-empty, looks like a DNS name (contains `.`), but is not present in SAN | Auto-add CN as `dNSName` SAN AND log a warning event. |
| Subject DN length > 1000 bytes when DER-encoded | Reject `VAL-0028` |

For CA certificates the Subject DN is composed from the request as `CN=<cn>, O=<o>, C=<c>`.

---

## Serial number generation

- 128 random bits sourced from `SecureRandom` (NIST SP 800-90A DRBG via the JDK's default provider).
- Encoded as ASN.1 INTEGER with MSB cleared if necessary (positive integer requirement).
- Uniqueness within an issuing CA is enforced by storing `(issuer, serial)` and rejecting collisions; with 128 bits the probability of collision is negligible.

---

## Signature input

The Crypto API constructs the to-be-signed certificate (TBSCertificate per RFC 5280 §4.1.1.1), DER-encodes it, computes the hash per the signature algorithm, and signs with the issuer private key. No use of `null` AlgorithmIdentifier parameters for ECDSA (RFC 5758 §3.2).

---

## Output formats

The Crypto API produces all required output formats at issuance time and stores them in [`crypto_db.issued_certificates`](data-model.md#issued_certificates):

| Output Format | Contents |
|---|---|
| PEM — Certificate only | `-----BEGIN CERTIFICATE-----` block for the issued certificate only. |
| PEM — Full chain | Issued cert followed by issuing Intermediate CA, parent Intermediate CAs (if any), and Root CA, each as PEM blocks, in chain order. |
| DER — Certificate only | DER-encoded issued certificate. |
| DER — Full chain | DER concatenation is non-standard; instead a single `BEGIN CERTIFICATE` ... `END CERTIFICATE` PEM bundle is not a valid "DER" output. The platform's interpretation of *DER — Full chain* is a **PKCS#7 SignedData** structure whose `certificates` field carries the chain (functionally equivalent to PKCS#7 P7B but encoded as DER and labeled DER Full Chain in the UI). |
| PKCS#7 / P7B | A `SignedData` structure containing the issued certificate, the issuing Intermediate CA, all ancestor Intermediate CAs, and the Root CA, with empty `signerInfos` (chain-only PKCS#7). DER-encoded. |

---

## Related

- [BRD — Certificate Lifecycle](../../1-Requirements/BRD.md#certificate-lifecycle)
- [crypto-design.md](crypto-design.md)
- [data-model.md](data-model.md)

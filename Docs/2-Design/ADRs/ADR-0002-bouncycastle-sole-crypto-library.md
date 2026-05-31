# ADR-0002: BouncyCastle is the sole external crypto library

- **Status:** Accepted
- **Date:** 2026-04-15

## Context

The Crypto API performs X.509 certificate issuance: keypair generation (RSA, EC), CSR validation, self-signing of Root CAs, signing of Intermediate CAs, signing of end-entity certificates, and chain encoding into PEM/DER/PKCS#7. It also encrypts CA private keys at rest with AES-256-GCM.

Java's standard library (`java.security`, `java.security.cert`) provides interfaces to *consume* certificates but no public API to *build* them. Building X.509 v3 certificates, parsing PKCS#10 CSRs, and encoding PKCS#7 SignedData all require an external library.

## Decision

Use **Bouncy Castle 1.7x** as the sole external crypto library. Register the BC JCA/JCE provider. Use BC APIs (`org.bouncycastle.cert.X509v3CertificateBuilder`, `JcaPKCS10CertificationRequest`, `CMSSignedDataGenerator`, etc.) for all cert-building, CSR parsing, and PKCS#7 work. Use the JDK's standard `javax.crypto.Cipher` for AES-256-GCM (no BC needed for the AEAD itself), with BC providing the GCM mode if the platform default does not.

## Consequences

Pros:

- Mature, widely-deployed Java crypto library; FIPS variant available if compliance ever requires it.
- One library to scan in OWASP Dependency-Check, one transitive dep tree to track.
- Covers every X.509 feature we need including PKCS#7 chain output.

Cons / costs:

- BC's API surface is large and dated in places; expect verbose builders.
- Provider registration must be deterministic (do it once at startup, fail fast if not registered).

## Alternatives considered

| Option | Reason rejected |
|---|---|
| Don't use BouncyCastle; only stdlib | Not possible — stdlib cannot build X.509 v3 or PKCS#10 |
| Use multiple crypto libraries (e.g., BC for X.509 + Conscrypt for TLS) | Adds two libraries to track and double the surface for vulnerabilities |
| Write our own X.509 builder | Years of work and a guaranteed source of bugs; X.509 is famously easy to get subtly wrong |

## References

- [tools.md — Crypto API](../../3-Implementation/tools.md#crypto-api-vlan-4)
- [crypto-design.md](../2.2-LLD/crypto-design.md)
- [certificate-profiles.md](../2.2-LLD/certificate-profiles.md)

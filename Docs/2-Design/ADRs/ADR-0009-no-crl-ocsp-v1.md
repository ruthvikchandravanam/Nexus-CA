# ADR-0009: No CRL or OCSP publication in v1.0

- **Status:** Accepted
- **Date:** 2026-05-13

## Context

External revocation notification protocols (CRL, OCSP) let relying parties check whether a presented certificate has been revoked. The BRD explicitly lists both as **Out of Scope** for v1.0.

Implementing CRL would require: a CRL Distribution Points extension in every issued certificate (URL), a periodic CRL signing job per CA, a public endpoint serving signed CRLs, and CRL retention. OCSP would require: an Authority Information Access extension with an OCSP responder URL, a real-time signing OCSP responder, response caching, and clock-skew tolerance.

## Decision

Issue certificates **without** CRL Distribution Points or Authority Information Access extensions. Do not run a CRL signer or an OCSP responder. The Nexus CA UI and API are the sole source of truth for revocation status; consumers of Nexus CA-issued certificates rely on out-of-band knowledge of revocation (typically internal operational awareness).

When a CA is revoked, certificates issued under it remain in the system as historical records (per BRD) but consumers using them via TLS will continue to trust them until expiry.

## Consequences

Pros:

- Significant scope reduction for v1.0.
- No additional public-facing endpoints to operate.
- Simpler certificate profiles (no CDP/AIA URLs to manage and refresh).

Cons / costs:

- External relying parties cannot programmatically verify revocation.
- A revoked Intermediate CA's end-entity certificates are still "valid" from a TLS-handshake perspective until they expire.
- Acceptable because the consumer base is internal and small; out-of-band revocation communication is operationally feasible.

## Future direction

CRL is a candidate for v2.0 (lower-cost than OCSP). When added, it requires:

- A CRL signing scheduled task (one CRL per Issuing CA per `nextUpdate` window).
- The Crypto API key includes `cRLSign` already (see [certificate-profiles.md](../2.2-LLD/certificate-profiles.md)) — no Intermediate CA reissuance needed.
- A public CRL HTTP endpoint behind the LB.
- Issued certs after v2.0 carry the CDP URL; pre-v2.0 certs do not.

## References

- [BRD — Out of Scope](../../1-Requirements/BRD.md#out-of-scope)
- [certificate-profiles.md](../2.2-LLD/certificate-profiles.md)

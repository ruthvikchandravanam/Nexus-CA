# ADR-0001: Use Vert.x instead of Spring for backend services

- **Status:** Accepted
- **Date:** 2026-04-15

## Context

Both the Business Logic API and the Crypto API are HTTP services in Java 21. The two dominant choices in the JVM ecosystem are Spring Boot (synchronous, thread-per-request, vast ecosystem) and Eclipse Vert.x (reactive, event-loop, lighter footprint).

Workload characteristics:

- Mostly I/O-bound (DB, HTTP, SMTP) with short request lifetimes.
- Modest QPS (internal-only CA platform; expected single-digit RPS, with bursts during certificate issuance campaigns).
- Two services must be independently shippable in small container images and start fast for blue/green deploys.

## Decision

Use **Eclipse Vert.x 4.5.x** for both Business Logic API and Crypto API.

## Consequences

Pros:

- Smaller container image (`eclipse-temurin:21-jre-alpine` + Vert.x ≈ 80 MB JAR vs. Spring's typical 150–200 MB).
- Faster cold start — sub-second to first request.
- Non-blocking I/O without thread-pool tuning; backpressure built in.
- The full stack we need (Web router, JWT auth, MySQL client, mail client, periodic timers, health check, OpenAPI, metrics, tracing) is bundled in the Vert.x ecosystem.

Cons / costs:

- Smaller talent pool than Spring; new contributors will have a learning curve on the reactive model.
- Some libraries (e.g., bcrypt) are easier to integrate synchronously; reactive wrappers add minor boilerplate.
- Fewer "magic" annotations than Spring; explicit wiring is more verbose.

## Alternatives considered

| Option | Reason rejected |
|---|---|
| Spring Boot 3.x | Heavier, slower start, more dependency surface area; reactive (WebFlux) is not the team's strong suit either, so we'd default to synchronous Tomcat which loses the I/O efficiency we want |
| Quarkus | Strong cold-start, similar lightness, but team has more Vert.x experience and Quarkus's compile-time DI adds complexity to integration tests |
| Helidon / Micronaut | Lower adoption; smaller community |
| Node.js / TypeScript backend | Java was a fixed constraint due to BouncyCastle (see [ADR-0002](ADR-0002-bouncycastle-sole-crypto-library.md)) |

## References

- [tools.md — Business Logic API](../../3-Implementation/tools.md#business-logic-api-vlan-3)
- [tools.md — Crypto API](../../3-Implementation/tools.md#crypto-api-vlan-4)

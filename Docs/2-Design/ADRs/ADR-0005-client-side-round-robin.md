# ADR-0005: Client-side round-robin between internal service tiers

- **Status:** Accepted
- **Date:** 2026-04-22

## Context

The public Load Balancer (Nginx in DMZ) terminates inbound TLS and distributes to Web Tier instances. Internally, three further hops need their own distribution:

- Web Tier → Business Logic API
- Business Logic API → Crypto API
- Business Logic API → Business DB (handled by the Vert.x MySQL Client connection pool)

Options for the first two are: (a) deploy an additional internal LB (HAProxy, second Nginx), or (b) have each upstream client maintain the list of backend instances and round-robin requests itself.

## Decision

**Client-side round-robin.** Each Web Tier and each Business Logic API instance is configured with the full list of addresses for the next tier and selects an instance per request in round-robin order. Health checks are performed by the client; unhealthy instances are skipped.

No internal load balancer component is deployed.

## Consequences

Pros:

- One fewer component to deploy, monitor, and tune per environment.
- One fewer single point of failure on each hop.
- No new TLS termination/origination concerns inside trusted VLANs.

Cons / costs:

- Adding/removing a tier instance requires either a redeploy of upstream clients or a hot-reload mechanism (Vert.x `setPeriodic` reload of the upstream list from config every 60s).
- Configuration drift risk if upstream lists diverge across instances. Mitigated by sourcing the list from a single config file injected by the orchestrator.

## Alternatives considered

| Option | Reason rejected |
|---|---|
| HAProxy in each VLAN | Operational overhead; another component to monitor |
| Nginx in each VLAN | Same as above |
| Service discovery (Consul, etcd) | Adds a heavy dependency for a small upstream count |
| DNS-based round-robin | TTL caching gives stale results during deploys |

## References

- [architecture.md — Scalability](../2.1-HLD/architecture.md#scalability)

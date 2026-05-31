# ADR-0007: Single `requests` table for all maker-checker request types

- **Status:** Accepted
- **Date:** 2026-05-06

## Context

Nexus CA has 11 distinct request types subject to maker-checker (Root/Intermediate CA create / enable-disable / revoke; user create / enable-disable / role-assign; certificate issuance; system config update). They all share the same lifecycle (`PENDING_APPROVAL → APPROVED → EXECUTED → COMPLETED`, or `→ REJECTED`), the same audit semantics, the same approval and self-approval rules, and the same notification triggers.

## Decision

Persist all request types in **one `requests` table** with a `request_type` discriminator column and a JSON `payload_json` column. Type-specific shapes live in JSON, validated at the application layer per request type.

## Consequences

Pros:

- One lifecycle implementation, one supersede query, one audit-emission code path.
- Queue and history reports are simple `SELECT` queries on one table.
- Adding a new request type means adding an enum value and a payload schema — no new table.

Cons / costs:

- Type-specific columns are not indexable directly; queries that filter by a payload field need a generated column or JSON index.
- Loss of compile-time type safety on payload contents; the application must validate JSON at the boundary.

## Alternatives considered

| Option | Reason rejected |
|---|---|
| One table per request type | 11× the schema; 11× the lifecycle code; 11× the supersede query |
| Joined table inheritance (parent `requests` + per-type child tables) | Doubles the writes; foreign-key complexity; little benefit because most reads are by status, not by type |
| Event-sourced ledger | Overkill for v1.0; the simple state-machine semantics fit a row-with-status |

## References

- [data-model.md — requests](../2.2-LLD/data-model.md#requests)
- [BRD — Approval Matrix](../../1-Requirements/BRD.md#approval-matrix)

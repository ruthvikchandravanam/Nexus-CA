# ADR-0003: Manual test doubles instead of Mockito

- **Status:** Accepted
- **Date:** 2026-04-15

## Context

JVM test culture defaults to Mockito (or similar) for substituting collaborators. The team has prior experience where heavy mocking led to:

- Tests that pass against the mock but fail against the real collaborator.
- Brittle tests coupled to call-order rather than observable behavior.
- Implicit contracts in `verify(...)` calls that drift when the production code is refactored.

The Vert.x model encourages small handler classes with clear seams (a `MysqlPool`, an `HttpClient`, a `MailClient`). These seams are easy to substitute with hand-written stubs and fakes.

## Decision

Do **not** add Mockito (or any mocking framework) to the backend test dependencies. All test doubles are hand-written in `src/test/java/.../doubles/`.

Where a fake (e.g., an in-memory replacement for a small DB-backed component) is more expensive to maintain than running against a real Testcontainers MySQL, prefer the real DB.

## Consequences

Pros:

- Test code is plain Java; new contributors don't need to learn Mockito DSL.
- Fewer dependencies on the classpath; smaller test artifact; faster compilation.
- Easier to grep for the relevant test double — they have real class names, not anonymous mock builders.
- Forces refactoring of code that is hard to test, instead of papering over it with `mock(InternalThing.class)`.

Cons / costs:

- Argument captors and stub return-by-call patterns must be implemented by hand.
- Some tests will be longer than they would be with Mockito.

## Alternatives considered

| Option | Reason rejected |
|---|---|
| Mockito | See Context above |
| MockK / EasyMock | Same family of concerns |
| AssertJ + Mockito-Inline | Same as above |

## References

- [tools.md — Testing — Backend](../../3-Implementation/tools.md#testing--backend)
- [testing-strategy.md](../../3-Implementation/testing-strategy.md)

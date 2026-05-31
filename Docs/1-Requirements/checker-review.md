# Checker Approval Review UI

## Purpose

When a checker reviews a pending request, the UI must present every change that would result from approving the request in a single comparative view. The checker shall never be required to navigate elsewhere or perform manual record comparison to evaluate the request.

## What the Checker Must Be Able to View

For every request in `PENDING_APPROVAL`, the review screen displays:

| Element | Description |
|---|---|
| Request header | Request ID, Request Type, Submitted By, Submitted Date |
| Target entity | Name and ID of the entity affected (e.g., user ID, CA ID) |
| Request payload | The full set of values submitted by the maker |
| Before snapshot | The current persisted state of the target entity (empty for create operations) |
| After snapshot | The projected state of the entity if the request is approved |
| Changed fields | A field-by-field diff: field name, previous value, new value |
| Maker comment | Optional comment supplied by the maker at submission (if present) |

The Before and After snapshots are rendered side-by-side on desktop and stacked on smaller viewports. For create operations the Before snapshot is rendered as an empty pane labelled *No prior state — new entity*.

## Decision Controls

| Control | Behaviour |
|---|---|
| Approve | Confirms approval. An optional comment box is available. |
| Reject | Requires a non-empty comment (BRD: *A comment is mandatory when rejecting a request.*). The Reject submit button is disabled until the comment field contains at least one non-whitespace character. |

After the checker submits either decision, the screen transitions to a read-only confirmation panel with the decision outcome and disables further input on the same request.

## Visual Diff — Change Types and Colors

The diff renderer applies the colors defined in [branding.md — Checker Approval Diff](branding.md#checker-approval-diff). The full mapping (re-stated here for traceability) is:

| Change Type | Token (branding.md) | Use |
|---|---|---|
| Added | Success — `#16A34A` text on `#DCFCE7` background | A field present in the After snapshot but absent in the Before snapshot |
| Modified — previous value | Warning Text — `#92400E` text on `#FEF3C7` background | The Before-snapshot value of a field whose value has changed; rendered with strikethrough |
| Modified — new value | Action Blue — `#2563EB` text on `#DBEAFE` background | The After-snapshot value of a field whose value has changed |
| Removed | Danger — `#DC2626` text on `#FEE2E2` background | A field present in the Before snapshot but absent in the After snapshot |

> Branding is authoritative. If a value in this table conflicts with [branding.md](branding.md), branding.md wins.

For Modified rows the renderer shows both colors on the same row: the previous value (amber, strikethrough) followed by the new value (blue).

## Accessibility Requirements

- Diff color is decorative only. Each change row carries an `aria-label` describing the change type — e.g., `aria-label="Modified: role changed from OPERATOR_MAKER to OPERATOR_CHECKER"`.
- Strikethrough is applied via CSS `text-decoration` on the previous-value cell so screen readers announce the value once with the change context from the aria-label.
- Color contrast for all four change-type pairs meets WCAG 2.1 AA (verified in [branding.md — Accessibility](branding.md#accessibility)).

## Related Documents

- [BRD — Audit Requirements](BRD.md#audit-requirements)
- [BRD — Segregation of Duties](BRD.md#segregation-of-duties)
- [branding.md — Checker Approval Diff](branding.md#checker-approval-diff)

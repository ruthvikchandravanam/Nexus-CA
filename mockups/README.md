# Nexus CA — Frontend Mockups

High-fidelity static HTML/CSS mockups of every screen in
[`Docs/1-Requirements/ui-screens.md`](../Docs/1-Requirements/ui-screens.md),
styled to [`Docs/1-Requirements/branding.md`](../Docs/1-Requirements/branding.md).

These are the "frontend images": open them in any browser to view, screenshot,
or print-to-PDF. They also double as a visual head start on the real React/TS SPA.

There are **two ways in**, matching the two ways the BRD frames the system:

- **By role (persona)** — open **`personas.html`**. For each of the 5 roles it links to a
  role-correct dashboard and that role's signature screens, with the correct navigation
  and action visibility. This is the "user-wise" view.
- **By feature** — open **`index.html`**. A gallery with a live thumbnail of every screen
  in the UI inventory, grouped by feature area.

The two cross-link, and both reuse the same `assets/nexus.css`.

### RBAC role switcher (feature catalogue)

Every action-bearing feature screen loads `assets/rbac.js`, which adds a **“View as”**
role switcher (top-right). Switching role shows/hides options per BRD §Permissions:

- **Buttons** tagged `data-roles="…"` appear only for permitted roles (e.g. *Create Root
  CA* → ADMIN_MAKER; *Submit CSR* → OPERATOR_MAKER; *Download issued cert* →
  OPERATOR_MAKER + OPERATOR_CHECKER; *Reassign/Disable/Reset* → ADMIN_MAKER).
- **Nav items** Users / System Configuration / Pending Requests appear only for the roles
  that have them.
- **Whole pages** tagged `data-page-roles` (Create User/Reset/Revoke → ADMIN_MAKER only;
  Users & System Configuration → ADMIN_MAKER/ADMIN_CHECKER/AUDITOR) show a **403** for
  other roles.
- **System Configuration** inputs are editable only for ADMIN_MAKER; ADMIN_CHECKER and
  AUDITOR see it read-only.

The persona screens (`R-*`) are fixed single-role views, so they have no switcher.

## How to view

Open **`personas.html`** or **`index.html`** in a browser. No build step or server required
(the gallery thumbnails use `iframe`, which all modern browsers render from the
local filesystem).

## Role / persona files (`R-<role>-*`)

Role codes: `AM` ADMIN_MAKER · `AC` ADMIN_CHECKER · `OM` OPERATOR_MAKER ·
`OC` OPERATOR_CHECKER · `AU` AUDITOR. Each role has a dashboard plus its signature
screens. Key BRD facts these encode:

- **Makers cannot approve** — ADMIN_MAKER and OPERATOR_MAKER have **no Pending
  Requests** queue in their nav; they track submissions via *My Requests*.
- **Checkers** get the approval queue scoped to their domain (ADMIN_CHECKER → admin
  requests; OPERATOR_CHECKER → certificate issuance only).
- **Operators** have no Users / System Configuration in their nav.
- **AUDITOR** sees everything but every control is disabled (read-only).
- Certificate issuance request stays *EXECUTED* until the **maker's first download**,
  which transitions it to *COMPLETED* (a checker download does not).

> To capture PNGs: open a screen and use the browser's screenshot / "Capture full
> size screenshot" devtools command, or print-to-PDF. (No headless renderer is
> installed in this repo, so screenshots are a manual step.)

## Layout

| File | Purpose |
|---|---|
| `index.html` | Gallery of all screens |
| `assets/nexus.css` | The entire design system — palette, type, spacing, components. Edit once to retheme everything. |
| `assets/logo.svg` | Nexus CA logo mark |
| `S-0xx … S-9xx` | One file per screen, named by its `ui-screens.md` ID |

## Coverage (32 screens)

- **Auth:** S-000 Login · S-001 MFA · S-002 / S-002b Forgot password · S-003 Force reset
- **Global:** S-100 Dashboard · S-102 Profile
- **Root CA:** S-200 list · S-201 detail · S-202 create · S-203 revoke modal
- **Intermediate CA:** S-300 list · S-301 detail · S-302 create
- **Certificates:** S-400 list · S-401 detail · S-402 submit CSR
- **Requests:** S-500 pending · S-501 review (field-level diff) · S-502 history
- **Users:** S-600 list · S-601 detail · S-602 create · S-603 reset-password modal
- **Roles (RBAC engine):** S-610 list · S-611 detail · S-612 create/edit (archetype + permission grid) · S-613 delete modal
- **Config:** S-700 system configuration
- **Reports:** S-800–S-807 (Root CA, Intermediate CA, Certificate, User, Role, Pending Approval, Request History, Audit)
- **States:** S-900 error & empty states (404 / 403 / 500 / empty / lockout / toast)

Different roles are shown where relevant (ADMIN_MAKER, ADMIN_CHECKER,
OPERATOR_MAKER, AUDITOR) so the role-trimmed navigation is visible.

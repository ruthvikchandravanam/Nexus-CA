# Nexus CA — Brand Guidelines

---

## Platform Identity

| | |
|---|---|
| **Name** | Nexus CA |
| **Tagline** | Anchoring Trust. |
| **One-liner** | Nexus CA is an internal certificate authority platform for managing the full lifecycle of Root CAs, Intermediate CAs, and issued certificates — with enforced maker-checker controls and a complete audit trail. |

The name *Nexus* refers to the central connection point of a trust infrastructure — the hub from which all certificate trust chains originate. *Anchoring Trust.* reinforces the Root CA as the immovable foundation of that chain.

---

## Color Palette

### Primary

| Name | Hex | Usage |
|---|---|---|
| Nexus Navy | <span style="display:inline-block;width:14px;height:14px;background-color:#0F172A;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#0F172A` | Page headers, navigation background, primary headings |
| Trust Blue | <span style="display:inline-block;width:14px;height:14px;background-color:#1E3A5F;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#1E3A5F` | Secondary headings, sidebar backgrounds |
| Action Blue | <span style="display:inline-block;width:14px;height:14px;background-color:#2563EB;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#2563EB` | Primary buttons, links, focus rings |
| Light Blue | <span style="display:inline-block;width:14px;height:14px;background-color:#DBEAFE;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#DBEAFE` | Button hover states, selected row backgrounds |

### Accent

| Name | Hex | Usage |
|---|---|---|
| Nexus Teal | <span style="display:inline-block;width:14px;height:14px;background-color:#0891B2;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#0891B2` | Status badges, active indicators, graph accents |
| Teal Light | <span style="display:inline-block;width:14px;height:14px;background-color:#CFFAFE;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#CFFAFE` | Teal badge backgrounds |

### Neutrals

| Name | Hex | Usage |
|---|---|---|
| Background | <span style="display:inline-block;width:14px;height:14px;background-color:#F8FAFC;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#F8FAFC` | Page background |
| Surface | <span style="display:inline-block;width:14px;height:14px;background-color:#FFFFFF;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#FFFFFF` | Card and panel backgrounds |
| Border | <span style="display:inline-block;width:14px;height:14px;background-color:#E2E8F0;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#E2E8F0` | Dividers, input borders, table rules |
| Muted | <span style="display:inline-block;width:14px;height:14px;background-color:#64748B;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#64748B` | Secondary labels, helper text, placeholders |
| Body | <span style="display:inline-block;width:14px;height:14px;background-color:#1E293B;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#1E293B` | Primary body text |
| Heading | <span style="display:inline-block;width:14px;height:14px;background-color:#0F172A;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#0F172A` | All headings |

### Semantic

| Name | Hex | Usage |
|---|---|---|
| Success | <span style="display:inline-block;width:14px;height:14px;background-color:#16A34A;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#16A34A` | ACTIVE status, approval confirmed, success toasts |
| Warning | <span style="display:inline-block;width:14px;height:14px;background-color:#D97706;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#D97706` | Warning icons and decorative elements only — see note below |
| Warning Text | <span style="display:inline-block;width:14px;height:14px;background-color:#92400E;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#92400E` | Warning text on light backgrounds (badges, inline messages) |
| Danger | <span style="display:inline-block;width:14px;height:14px;background-color:#DC2626;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#DC2626` | REVOKED status, rejection, account lockout, error toasts |
| Disabled | <span style="display:inline-block;width:14px;height:14px;background-color:#94A3B8;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#94A3B8` | DISABLED status, inactive elements |

> **Note:** `#D97706` does not meet WCAG AA contrast on white or light backgrounds when used as text. Use `#92400E` for all warning text. `#D97706` is reserved for icons and decorative elements only.

---

## Typography

### Typefaces

| Role | Typeface | Fallback |
|---|---|---|
| UI (headings & body) | Inter | system-ui, -apple-system, sans-serif |
| Monospace (certificates, serial numbers, keys, hashes) | JetBrains Mono | Fira Code, Consolas, monospace |

### Scale

| Token | Size | Weight | Usage |
|---|---|---|---|
| `heading-1` | 28px | 700 | Page titles |
| `heading-2` | 22px | 600 | Section headings |
| `heading-3` | 18px | 600 | Card headings, panel titles |
| `body` | 14px | 400 | All body text |
| `body-sm` | 13px | 400 | Table cells, helper text |
| `label` | 12px | 500 | Form labels, column headers |
| `mono` | 13px | 400 | Certificate data, serial numbers, request payloads |

---

## Spacing & Layout

### Spacing Scale

Base unit: 4px. All spacing values are multiples of the base unit.

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Icon-to-label gap, badge internal padding |
| `space-2` | 8px | Input vertical padding, tight component gaps |
| `space-3` | 12px | Input horizontal padding |
| `space-4` | 16px | Card internal padding, form field vertical gaps |
| `space-6` | 24px | Between cards, between form sections |
| `space-8` | 32px | Page section spacing, panel padding |
| `space-12` | 48px | Major section breaks |
| `space-16` | 64px | Page top and bottom margin |

### Layout

| Property | Value |
|---|---|
| Max content width | 1280px |
| Page horizontal padding (desktop) | 32px |
| Page horizontal padding (tablet) | 16px |
| Navigation sidebar width | 240px |
| Form column max width | 640px |
| Table / report area | Full available width |

### Page Title Format

Browser tab and window titles follow this pattern:

```
[Page Name] — Nexus CA
```

For detail pages with a named entity:

```
[Entity Name] — [Section] — Nexus CA
```

Examples:
- `Root CA Management — Nexus CA`
- `Root CA #001 — Root CA Management — Nexus CA`
- `Nexus CA` (login page only — no separator)

---

## Logo

### Concept

The Nexus CA mark is a geometric network node: three filled circles connected by lines meeting at a central point, forming an abstract letter **N** and evoking a trust nexus. The wordmark *Nexus CA* sits to the right in Inter 600.

```
  ●
  |  \
  |    ●
  |  /
  ●

  Nexus CA
```

### Variants

| Variant | Usage |
|---|---|
| Full (mark + wordmark) | Application header, login page, email header |
| Mark only | Browser favicon, app icon |
| Monochrome (white) | Dark backgrounds (navigation bar) |
| Monochrome (navy) | Print, light backgrounds |

### Favicon Sizes

| Size | Format | Usage |
|---|---|---|
| 16×16 | ICO / PNG | Browser tab |
| 32×32 | PNG | Browser tab (high-DPI) |
| 180×180 | PNG | Apple touch icon |
| 192×192 | PNG | Android / PWA |
| 512×512 | PNG | PWA splash screen |

### Clear Space

Maintain a minimum clear space equal to the height of the letter **N** in the wordmark on all sides of the logo.

### Prohibited Uses

- Do not recolor the mark outside the defined palette.
- Do not stretch or distort proportions.
- Do not place the full-color mark on a dark background — use the white monochrome variant.

---

## UI Theme

### Navigation

- Background: Nexus Navy `#0F172A`
- Active item: left border in Nexus Teal `#0891B2`, text white
- Inactive item: text `#94A3B8`, hover text white

### Login Page

Two-column layout on desktop; single column on tablet and below.

**Left panel (40% width):**
- Background: Nexus Navy `#0F172A`
- Content centered vertically: white logo (full variant), tagline *Anchoring Trust.* in Muted `#94A3B8` below

**Right panel (60% width):**
- Background: Surface `#FFFFFF`
- Form centered vertically, max width 400px

**Sign In form:**
- Heading: *Sign in to Nexus CA* — `heading-2`
- Fields: Username, Password
- Primary button: *Sign In* — full width
- Forgot Password: right-aligned ghost link below button

**MFA verification step (same layout):**
- Heading: *Verify Your Identity* — `heading-2`
- Subtext: *A verification code has been sent to your registered email address.* — `body-sm`, Muted
- Field: Verification Code — monospace input
- Button: *Verify* — full width

**Error handling:**
- Field-level errors: inline below the field in Danger `#DC2626`
- Account lockout: full-width danger banner above the form, persistent

### Status Badges

Pill-shaped, 4px border-radius, `label` font size.

| Status | Text Color | Background |
|---|---|---|
| ACTIVE | <span style="display:inline-block;width:14px;height:14px;background-color:#16A34A;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#16A34A` | <span style="display:inline-block;width:14px;height:14px;background-color:#DCFCE7;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#DCFCE7` |
| DISABLED | <span style="display:inline-block;width:14px;height:14px;background-color:#64748B;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#64748B` | <span style="display:inline-block;width:14px;height:14px;background-color:#F1F5F9;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#F1F5F9` |
| REVOKED | <span style="display:inline-block;width:14px;height:14px;background-color:#DC2626;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#DC2626` | <span style="display:inline-block;width:14px;height:14px;background-color:#FEE2E2;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#FEE2E2` |
| EXPIRED | <span style="display:inline-block;width:14px;height:14px;background-color:#92400E;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#92400E` | <span style="display:inline-block;width:14px;height:14px;background-color:#FEF3C7;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#FEF3C7` |
| PENDING_APPROVAL | <span style="display:inline-block;width:14px;height:14px;background-color:#2563EB;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#2563EB` | <span style="display:inline-block;width:14px;height:14px;background-color:#DBEAFE;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#DBEAFE` |
| APPROVED | <span style="display:inline-block;width:14px;height:14px;background-color:#0891B2;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#0891B2` | <span style="display:inline-block;width:14px;height:14px;background-color:#CFFAFE;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#CFFAFE` |
| REJECTED | <span style="display:inline-block;width:14px;height:14px;background-color:#DC2626;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#DC2626` | <span style="display:inline-block;width:14px;height:14px;background-color:#FEE2E2;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#FEE2E2` |
| COMPLETED | <span style="display:inline-block;width:14px;height:14px;background-color:#16A34A;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#16A34A` | <span style="display:inline-block;width:14px;height:14px;background-color:#DCFCE7;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#DCFCE7` |

### Buttons

**Sizes:**

| Size | Height | Horizontal Padding | Font |
|---|---|---|---|
| Default | 36px | 12px | 14px / 500 |
| Small | 28px | 8px | 13px / 500 |
| Large | 44px | 16px | 15px / 600 |

**Variants:**

| Variant | Default | Hover | Active | Disabled | Usage |
|---|---|---|---|---|---|
| Primary | bg `#2563EB`, white text | bg `#1D4ED8` | bg `#1E40AF` | bg `#BFDBFE`, text `#93C5FD` | Main actions (Submit, Approve, Save) |
| Secondary | bg white, border `#E2E8F0`, body text | bg `#F8FAFC` | bg `#F1F5F9` | text `#94A3B8` | Secondary actions (Edit, View) |
| Danger | bg `#DC2626`, white text | bg `#B91C1C` | bg `#991B1B` | bg `#FECACA`, text `#F87171` | Destructive actions (Reject, Revoke) |
| Ghost | no bg, no border, `#2563EB` text | bg `#DBEAFE` | bg `#BFDBFE` | text `#94A3B8` | Tertiary actions (Cancel, Back, links in tables) |

Loading state (all variants): replace label with a spinner + *Processing…* text; button is non-interactive.

### Forms and Inputs

**Text input / select / textarea:**

| State | Border | Background | Text |
|---|---|---|---|
| Default | `#E2E8F0` 1px | `#FFFFFF` | `#1E293B` |
| Focus | `#2563EB` 1px + `rgba(37,99,235,0.15)` 3px ring | `#FFFFFF` | `#1E293B` |
| Error | `#DC2626` 1px | `#FFF5F5` | `#1E293B` |
| Disabled | `#E2E8F0` 1px | `#F8FAFC` | `#94A3B8` |

- Border radius: 6px
- Height (single-line): 36px
- Padding: 8px 12px
- Placeholder: Muted `#64748B`
- Textarea min-height: 80px; resize: vertical only

**Form labels:** `label` scale, Body color `#1E293B`, 4px below the label.

**Helper text:** `body-sm`, Muted `#64748B`, 4px above.

**Error message:** `body-sm`, Danger `#DC2626`, 4px above.

### Certificate and Key Data

All certificate fields, serial numbers, private key identifiers, request payloads, and audit snapshots use `mono` scale on a `#F8FAFC` background with a `#E2E8F0` 1px border and 6px border-radius.

### Checker Approval Diff

| Change Type | Text Color | Background |
|---|---|---|
| Added | <span style="display:inline-block;width:14px;height:14px;background-color:#16A34A;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#16A34A` | <span style="display:inline-block;width:14px;height:14px;background-color:#DCFCE7;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#DCFCE7` |
| Modified — previous value | <span style="display:inline-block;width:14px;height:14px;background-color:#92400E;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#92400E` | <span style="display:inline-block;width:14px;height:14px;background-color:#FEF3C7;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#FEF3C7` |
| Modified — new value | <span style="display:inline-block;width:14px;height:14px;background-color:#2563EB;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#2563EB` | <span style="display:inline-block;width:14px;height:14px;background-color:#DBEAFE;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#DBEAFE` |
| Removed | <span style="display:inline-block;width:14px;height:14px;background-color:#DC2626;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#DC2626` | <span style="display:inline-block;width:14px;height:14px;background-color:#FEE2E2;border-radius:2px;border:1px solid rgba(0,0,0,0.15);vertical-align:middle"></span> `#FEE2E2` |

---

## Date and Time Format

All timestamps displayed in the UI, reports, and system emails use the following formats.

| Context | Format | Example |
|---|---|---|
| Full timestamp (audit logs, request dates, event times) | `DD MMM YYYY HH:mm:ss UTC` | `15 Jan 2026 09:34:21 UTC` |
| Date only (certificate validity, password expiry) | `DD MMM YYYY` | `15 Jan 2026` |
| Relative count (Days Pending, Days Remaining in reports) | Integer days | `7 days` |

Relative formats such as *"2 hours ago"* are not used anywhere in the system. All times are displayed in UTC.

---

## Accessibility

Target: **WCAG 2.1 Level AA**.

### Color Contrast

| Foreground | Background | Ratio | AA Pass |
|---|---|---|---|
| Body `#1E293B` | White `#FFFFFF` | 14.4 : 1 | ✓ |
| Muted `#64748B` | White `#FFFFFF` | 4.6 : 1 | ✓ |
| Action Blue `#2563EB` | White `#FFFFFF` | 5.9 : 1 | ✓ |
| White `#FFFFFF` | Action Blue `#2563EB` | 5.9 : 1 | ✓ |
| White `#FFFFFF` | Nexus Navy `#0F172A` | 19.5 : 1 | ✓ |
| White `#FFFFFF` | Danger `#DC2626` | 4.9 : 1 | ✓ |
| Danger `#DC2626` | White `#FFFFFF` | 4.9 : 1 | ✓ |
| Success `#16A34A` | White `#FFFFFF` | 4.6 : 1 | ✓ |
| Warning Text `#92400E` | Warning Light `#FEF3C7` | 9.4 : 1 | ✓ |
| Warning `#D97706` | White `#FFFFFF` | 3.3 : 1 | ✗ — decorative/icon use only |

### Focus Indicators

All interactive elements (buttons, inputs, links, navigation items) must display a visible focus ring on keyboard navigation:

```
outline: 3px solid #2563EB;
outline-offset: 2px;
```

`outline: none` must never be used without an equivalent custom focus indicator in its place.

### Keyboard Navigation

- Full keyboard operability required across all screens.
- Tab order follows visual left-to-right, top-to-bottom reading order.
- Modal dialogs must trap focus within the dialog while open.
- The Escape key must close modals and dismissible panels.

### Screen Readers

- All form inputs must have a programmatically associated `<label>`.
- Status badges must include an `aria-label` with the full status text (e.g., `aria-label="Status: Active"`).
- Icon-only buttons must have an `aria-label` describing the action.
- Tables must use `<th scope="col">` for column headers.

---

## Email Guidelines

### Tone

All system-generated emails are **formal and institutional**. The system communicates as *Nexus CA*, not as an individual. Language is precise, impersonal, and action-oriented. Contractions, colloquialisms, and emoji are not used.

### Structural Rules

- **Subject line:** `Nexus CA — [Category]: [Specific subject]`
- **Salutation:** `Dear [Full Name],`
- **Body:** One short paragraph per point. State the fact, then the required action (if any). Do not editorialize.
- **Action links:** Labelled as the exact action they perform — `Log in to Nexus CA`, not `Click here`.
- **Closing:** `Regards,` on one line, `Nexus CA` on the next. No personal name, no title.
- **Footer:** `This is an automated message from Nexus CA. Do not reply to this email.`

### Subject Line Patterns

| Event | Subject |
|---|---|
| MFA one-time code | `Nexus CA — Login: Your One-Time Verification Code` |
| Temporary password | `Nexus CA — Account Created: Temporary Password Enclosed` |
| Request submitted (to checker) | `Nexus CA — Action Required: [Request Type] Request #[ID] Pending Approval` |
| Request approved (to maker) | `Nexus CA — Request Approved: [Request Type] Request #[ID]` |
| Request rejected (to maker) | `Nexus CA — Request Rejected: [Request Type] Request #[ID]` |
| Request executed (to maker) | `Nexus CA — Request Executed: [Request Type] Request #[ID]` |
| Pending escalation (to checker) | `Nexus CA — Escalation: [Request Type] Request #[ID] Awaiting Approval for [N] Days` |
| Certificate expiry warning | `Nexus CA — Expiry Warning: Certificate [ID] Expires in [N] Days` |
| CA expiry warning | `Nexus CA — Expiry Warning: [CA Name] Expires in [N] Days` |
| Account locked | `Nexus CA — Security Alert: Account [Username] Has Been Locked` |

### Body Templates

---

#### MFA One-Time Code

> Dear [Full Name],
>
> A login attempt has been initiated for your Nexus CA account. Use the verification code below to complete authentication.
>
> **Verification Code: [CODE]**
>
> This code expires in 10 minutes. If you did not initiate this login, your account credentials may be compromised. Contact your system administrator immediately.
>
> Regards,
> Nexus CA
>
> ---
> *This is an automated message from Nexus CA. Do not reply to this email.*

---

#### Account Created — Temporary Password

> Dear [Full Name],
>
> Your Nexus CA account has been created. Use the credentials below to log in for the first time.
>
> **Username:** [Username]
> **Temporary Password:** [PASSWORD]
>
> You will be required to change this password upon first login. This temporary password expires in 24 hours. If you do not log in within this period, contact your system administrator to request a new temporary password.
>
> Regards,
> Nexus CA
>
> ---
> *This is an automated message from Nexus CA. Do not reply to this email.*

---

#### Action Required — Request Pending Approval (to Checker)

> Dear [Full Name],
>
> A request has been submitted and requires your review and decision.
>
> **Request ID:** [ID]
> **Request Type:** [Type]
> **Submitted By:** [Maker Full Name] ([Role])
> **Submitted On:** [DD MMM YYYY HH:mm:ss UTC]
>
> Log in to Nexus CA to review the full request details, including the proposed changes and affected entity, before approving or rejecting.
>
> Regards,
> Nexus CA
>
> ---
> *This is an automated message from Nexus CA. Do not reply to this email.*

---

#### Request Approved (to Maker)

> Dear [Full Name],
>
> Your request has been approved and will be executed shortly.
>
> **Request ID:** [ID]
> **Request Type:** [Type]
> **Approved By:** [Checker Full Name] ([Role])
> **Approved On:** [DD MMM YYYY HH:mm:ss UTC]
>
> You will receive a further notification upon execution. Log in to Nexus CA to monitor the request status.
>
> Regards,
> Nexus CA
>
> ---
> *This is an automated message from Nexus CA. Do not reply to this email.*

---

#### Request Rejected (to Maker)

> Dear [Full Name],
>
> Your request has been rejected.
>
> **Request ID:** [ID]
> **Request Type:** [Type]
> **Rejected By:** [Checker Full Name] ([Role])
> **Rejected On:** [DD MMM YYYY HH:mm:ss UTC]
> **Rejection Reason:** [Comment]
>
> Log in to Nexus CA to review the full details of this decision.
>
> Regards,
> Nexus CA
>
> ---
> *This is an automated message from Nexus CA. Do not reply to this email.*

---

#### Request Executed (to Maker)

> Dear [Full Name],
>
> Your request has been executed successfully.
>
> **Request ID:** [ID]
> **Request Type:** [Type]
> **Executed On:** [DD MMM YYYY HH:mm:ss UTC]
>
> *For certificate issuance requests only:* Log in to Nexus CA to download the issued certificate. The request will be marked as Completed upon download.
>
> Regards,
> Nexus CA
>
> ---
> *This is an automated message from Nexus CA. Do not reply to this email.*

---

#### Pending Escalation (to Checker)

> Dear [Full Name],
>
> The following request has been awaiting your decision for [N] days and requires immediate attention.
>
> **Request ID:** [ID]
> **Request Type:** [Type]
> **Submitted By:** [Maker Full Name] ([Role])
> **Submitted On:** [DD MMM YYYY HH:mm:ss UTC]
> **Days Pending:** [N]
>
> Log in to Nexus CA to review and action this request.
>
> Regards,
> Nexus CA
>
> ---
> *This is an automated message from Nexus CA. Do not reply to this email.*

---

#### Certificate Expiry Warning (to OPERATOR_MAKER)

> Dear [Full Name],
>
> The following certificate is approaching its expiry date.
>
> **Certificate ID:** [ID]
> **Certificate Type:** [CLIENT / SERVER / SIGNING]
> **Subject Common Name:** [CN]
> **Issuing CA:** [CA Name]
> **Valid To:** [DD MMM YYYY]
> **Days Remaining:** [N]
>
> A new certificate request must be submitted before the expiry date to maintain uninterrupted service. Log in to Nexus CA to initiate a new certificate issuance request.
>
> Regards,
> Nexus CA
>
> ---
> *This is an automated message from Nexus CA. Do not reply to this email.*

---

#### CA Expiry Warning (to ADMIN_MAKER)

> Dear [Full Name],
>
> The following Certificate Authority is approaching its expiry date.
>
> **CA ID:** [ID]
> **Common Name:** [CN]
> **CA Type:** [Root CA / Intermediate CA]
> **Valid To:** [DD MMM YYYY]
> **Days Remaining:** [N]
>
> Please review the CA lifecycle and initiate the appropriate action. Log in to Nexus CA for further details.
>
> Regards,
> Nexus CA
>
> ---
> *This is an automated message from Nexus CA. Do not reply to this email.*

---

#### Account Locked (to Affected User and ADMIN_MAKER)

> Dear [Full Name],
>
> The Nexus CA account **[Username]** has been locked following [N] consecutive failed authentication attempts.
>
> To regain access, the affected user may use the Forgot Password option on the login page, or an administrator may initiate a password reset via Nexus CA.
>
> Regards,
> Nexus CA
>
> ---
> *This is an automated message from Nexus CA. Do not reply to this email.*

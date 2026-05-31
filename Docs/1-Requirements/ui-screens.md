# UI Screen Inventory

Inventory of every screen in Nexus CA, with the data displayed, actions available per role, and layout notes. The design system is in [branding.md](branding.md); this file enumerates the surfaces that consume it.

Convention: A screen marked **role-visible** means a user in that role can reach the screen; **action** rows note which controls are interactive for that role.

---

## 0. Public / unauthenticated

### S-000 Login

| Aspect | Detail |
|---|---|
| URL | `/login` |
| Layout | Two-column desktop / single-column mobile per [branding.md — Login Page](branding.md#login-page) |
| Data | Username, password |
| Actions | Sign in (primary), Forgot password (ghost link) |
| Transitions | On success → S-001 MFA; on locked → banner; on forced reset → S-003 Force Reset |

### S-001 MFA verification

| Aspect | Detail |
|---|---|
| URL | `/login/mfa` |
| Data | Verification code (6 digits, monospace input) |
| Actions | Verify (primary), Resend code (ghost — limited per rate config) |
| Transitions | On success → S-100 Dashboard for caller's role |

### S-002 Forgot password — request

| Aspect | Detail |
|---|---|
| URL | `/forgot-password` |
| Data | Username or email |
| Actions | Send recovery code |
| Transitions | → S-002b regardless of result (generic success) |

### S-002b Forgot password — verify and reset

| Aspect | Detail |
|---|---|
| URL | `/forgot-password/verify` |
| Data | OTC, new password, confirm new password |
| Actions | Reset password |
| Transitions | On success → S-000 Login with success toast |

### S-003 Force password reset

| Aspect | Detail |
|---|---|
| URL | `/force-reset` (only reachable from login flow with `force_reset:true`) |
| Data | OTC, new password, confirm new password |
| Actions | Save and continue |
| Transitions | On success → S-100 Dashboard |

---

## 1. Global / cross-cutting

### S-100 Dashboard

| Aspect | Detail |
|---|---|
| URL | `/` |
| Layout | Navigation sidebar (240px) + main content |
| Data | For makers: their open requests count; for checkers: queue size; for AUDITORs: links into reports; for all: system version, latest audit events (last 10) |
| Role-visible | All authenticated |
| Actions | Quick links to dominant flows for the role |

### S-101 Navigation sidebar

| Aspect | Detail |
|---|---|
| Always visible | Logo, current user (name + role badge), Sign out |
| Items (per role visibility) | Dashboard, Root CAs, Intermediate CAs, Certificates, Users, Roles, Requests (Pending + History), Reports, System Configuration, Audit Log, Profile |
| Items hidden | Users and Roles hidden for OPERATOR_*; System Configuration hidden for OPERATOR_*, AUDITOR (view-only); Pending Requests hidden for AUDITOR. Navigation items are derived from the signed-in role's permissions per [§Role Management](BRD.md#role-management-configurable-rbac), not a fixed list. |

### S-102 Profile

| Aspect | Detail |
|---|---|
| URL | `/profile` |
| Data | User ID (read-only), Username (read-only), Full Name (editable), Email (editable), Role (read-only), Status (read-only), Last login, Password expires on |
| Actions | Save (when changes pending) — implements WF-010 |
| Role-visible | All |

---

## 2. Root CA management

### S-200 Root CA list

| URL | Role-visible | Data | Actions |
|---|---|---|---|
| `/root-cas` | All | List: ID, CN, O, C, Algo/Size, Valid From/To, Status (badge), Created Date | Row click → S-201; **Create Root CA** button (ADMIN_MAKER only) → S-202 |

### S-201 Root CA detail

| URL | Role-visible | Data | Actions per role |
|---|---|---|---|
| `/root-cas/{id}` | All | Full metadata, descendant Intermediate CA list, public certificate (download), revocation metadata (if any) | All roles: Download Public Certificate (PEM/DER). ADMIN_MAKER: Enable / Disable (toggle), Revoke (danger). Reject if not in valid status (e.g., REVOKED hides both Enable/Disable and Revoke). |

### S-202 Create Root CA form

| URL | Role-visible | Data | Actions |
|---|---|---|---|
| `/root-cas/new` | ADMIN_MAKER | Form fields per WF-001 | Submit → creates request, navigates to S-401 |

### S-203 Revoke Root CA modal (within S-201)

| Data | Cascade impact summary (count of descendant Intermediates, count of active certs under chain), Revocation reason dropdown |
| Actions | Submit (danger button — opens confirmation), Cancel |

---

## 3. Intermediate CA management

### S-300 Intermediate CA list

| URL | Role-visible | Data | Actions |
|---|---|---|---|
| `/intermediate-cas` | All | List incl. Parent CA name, Depth, Status | Row → S-301; ADMIN_MAKER: Create Intermediate CA → S-302 |

### S-301 Intermediate CA detail

Same shape as S-201 with the parent CA reference shown in metadata.

### S-302 Create Intermediate CA form

| Role-visible | ADMIN_MAKER |
| Data | Parent CA picker (filtered to ACTIVE; excludes any whose depth+1 > max), CN, O, C, Algo, Size, Validity Years |
| Actions | Submit |

### S-303 Revoke Intermediate CA modal

Same shape as S-203.

---

## 4. Certificate issuance

### S-400 Certificate list

| URL | Role-visible | Data | Actions |
|---|---|---|---|
| `/certificates` | All | List: ID, Type, Subject CN, Serial, Issuing CA, Validity, Status, Submitted By, Created Date | Row → S-401; OPERATOR_MAKER: Submit CSR → S-402 |

### S-401 Certificate detail

| URL | Role-visible | Data | Actions per role |
|---|---|---|---|
| `/certificates/{id}` | All | CSR Subject, key info, SANs, issuing CA, validity, output format, status, full audit timeline of the issuance request | OPERATOR_MAKER and OPERATOR_CHECKER who are bound to the request: Download (in recorded format). Download triggers `COMPLETED` only for the OPERATOR_MAKER's first download. |

### S-402 Submit CSR

| URL | Role-visible | Data | Actions |
|---|---|---|---|
| `/certificates/new` | OPERATOR_MAKER | Three-step form: (1) Paste/upload CSR + Parse preview, (2) Select Intermediate CA + Type + Validity, (3) Select Output Format + Review | Submit → creates request, navigates to S-501 |

The CSR preview (step 1) shows Subject DN, key algorithm and size, SAN entries. If parsing fails, inline error.

---

## 5. Requests (maker-checker queue)

### S-500 Pending requests queue

| URL | Role-visible | Data | Actions |
|---|---|---|---|
| `/requests/pending` | All checker roles + AUDITOR (read-only) | List of `PENDING_APPROVAL` requests visible per BRD scope rules: Request ID, Type, Target, Submitted By, Submitted Date, Days Pending | Row → S-501 |

### S-501 Request review

| URL | Role-visible | Data | Actions per role |
|---|---|---|---|
| `/requests/{id}` | Per BRD visibility | Full request payload, before/after snapshots, field-level diff per [checker-review.md](checker-review.md), maker comment if any | Appropriate checker: Approve (primary, optional comment), Reject (danger, mandatory comment). Self-approval: controls disabled. AUDITOR: read-only. |

### S-502 Request history

| URL | Role-visible | Data | Actions |
|---|---|---|---|
| `/requests/history` | Per BRD visibility | COMPLETED + REJECTED requests | Row → S-501 (read-only mode for terminal states) |

---

## 6. User management

### S-600 User list

| URL | Role-visible | Data | Actions |
|---|---|---|---|
| `/users` | ADMIN_MAKER, ADMIN_CHECKER, AUDITOR | List: User ID, Full Name, Username, Email, Role, Status, Last Login | Row → S-601; ADMIN_MAKER: Create User → S-602 |

### S-601 User detail

| URL | Role-visible | Data | Actions per role |
|---|---|---|---|
| `/users/{id}` | ADMIN_MAKER, ADMIN_CHECKER, AUDITOR; or self | Full profile, password expiry, last login, request history initiated by this user | ADMIN_MAKER: Enable/Disable, Reassign Role, Reset Password. None for self (use S-102 instead). |

### S-602 Create User

| Role-visible | ADMIN_MAKER |
| Data | Full Name, Username, Email, Role |
| Actions | Submit → creates request |

### S-603 Reset Password confirm modal

| Data | Target username + warning text: temp password will be emailed; current session will be terminated |
| Actions | Confirm (primary), Cancel |

---

## 6.1 Role management

Surfaces for the configurable RBAC engine (BRD [§Role Management](BRD.md#role-management-configurable-rbac)). The five seeded roles and any custom roles are managed here.

### S-610 Role list

| URL | Role-visible | Data | Actions |
|---|---|---|---|
| `/roles` | ADMIN_MAKER, ADMIN_CHECKER, AUDITOR | List: ID, Name, Archetype (Maker/Checker/Viewer), Type (System/Custom), Permissions count, Assigned users, Status | Row → S-611; **Create Role** button (ADMIN_MAKER only) → S-612 |

### S-611 Role detail

| URL | Role-visible | Data | Actions per role |
|---|---|---|---|
| `/roles/{id}` | ADMIN_MAKER, ADMIN_CHECKER, AUDITOR | Name, archetype, system/custom flag, full permission grid (feature × operation), list of assigned users, created/approved metadata | ADMIN_MAKER: Edit → S-612, Delete → S-613. Archetype shown read-only. |

### S-612 Create / Edit Role form

| URL | Role-visible | Data | Actions |
|---|---|---|---|
| `/roles/new`, `/roles/{id}/edit` | ADMIN_MAKER | Step 1 — Name + **Archetype** (Maker / Checker / Viewer). Step 2 — permission grid scoped to the chosen archetype and to each feature's supported operations; **Edit/Delete columns appear only for User, Role, System Configuration**. | Submit → creates a `ROLE_CREATE` / `ROLE_EDIT` request, navigates to S-501 |

The archetype is chosen at creation and is **read-only when editing** (changing maker↔checker would break segregation of duties — clone instead). The grid hides operations not valid for the archetype (Checker → View/Approve only; Viewer → View only).

### S-613 Delete Role confirm modal (within S-611)

| Data | Role name, count of assigned users, **reassignment picker** (target role for current holders), minimum-viability warning if deletion would orphan an approver/admin path |
| Actions | Submit (danger button — opens confirmation, creates a `ROLE_DELETE` request), Cancel |

---

## 7. System configuration

### S-700 System Configuration

| URL | Role-visible | Data | Actions per role |
|---|---|---|---|
| `/system-configuration` | ADMIN_MAKER (edit), ADMIN_CHECKER, AUDITOR (read-only) | Each parameter with current value, default value, description per BRD | ADMIN_MAKER: edit any value, Submit creates a single change request encompassing all edits |

---

## 8. Reports

Each of the 7 reports per BRD gets its own screen. URL pattern: `/reports/<name>`. Layout: a single full-width table, sorted by Created Date descending, no filtering, no pagination, no export per BRD v1.0 scope.

| ID | URL | Role-visible | Content |
|---|---|---|---|
| S-800 | `/reports/root-cas` | All | BRD Root CA Report |
| S-801 | `/reports/intermediate-cas` | All | BRD Intermediate CA Report |
| S-802 | `/reports/certificates` | All | BRD Certificate Report |
| S-803 | `/reports/users` | ADMIN_MAKER, ADMIN_CHECKER, AUDITOR | BRD User Report |
| S-807 | `/reports/roles` | ADMIN_MAKER, ADMIN_CHECKER, AUDITOR | BRD Role Report |
| S-804 | `/reports/pending-approval` | All (per BRD visibility) | BRD Pending Approval Report |
| S-805 | `/reports/request-history` | All (per BRD visibility) | BRD Request History Report |
| S-806 | `/reports/audit` | All | BRD Audit Report |

---

## 9. Error and empty states

| Pattern | Where | Treatment |
|---|---|---|
| Empty list | Any list screen | Centered illustration placeholder + one-line message + (if applicable) primary call-to-action button |
| 404 | Unknown route or unknown entity | "Not found" + back to dashboard link |
| 403 | Role mismatch | "You do not have access to this resource" + back to dashboard link |
| 500 / 503 | Server / dependency | Generic error page with correlation ID displayed and copy-to-clipboard button |

---

## 10. Visibility per role (summary matrix)

| Screen | ADMIN_MAKER | ADMIN_CHECKER | OPERATOR_MAKER | OPERATOR_CHECKER | AUDITOR |
|---|:---:|:---:|:---:|:---:|:---:|
| S-200 Root CAs | ✓ | ✓ | ✓ | ✓ | ✓ |
| S-202 Create Root CA | ✓ | — | — | — | — |
| S-300 Intermediate CAs | ✓ | ✓ | ✓ | ✓ | ✓ |
| S-302 Create Intermediate CA | ✓ | — | — | — | — |
| S-400 Certificates | ✓ | ✓ | ✓ | ✓ | ✓ |
| S-402 Submit CSR | — | — | ✓ | — | — |
| S-500 Pending Requests | — | ✓ (admin) | — | ✓ (op) | ✓ (read-only) |
| S-501 Request review | — | ✓ (admin requests) | — | ✓ (cert requests) | ✓ (read-only) |
| S-600 Users | ✓ | ✓ | — | — | ✓ |
| S-602 Create User | ✓ | — | — | — | — |
| S-610 Roles | ✓ | ✓ | — | — | ✓ |
| S-612 Create / Edit Role | ✓ | — | — | — | — |
| S-700 System Configuration | ✓ (edit) | ✓ (view) | — | — | ✓ (view) |
| S-800..S-806 Reports | ✓ | ✓ | ✓ (relevant) | ✓ (relevant) | ✓ |

---

## Related

- [BRD — Permissions](BRD.md#permissions)
- [branding.md](branding.md)
- [checker-review.md](checker-review.md)
- [Workflows/](Workflows/)

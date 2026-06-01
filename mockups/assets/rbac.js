/* ============================================================
   Nexus CA mockups — RBAC role switcher
   Demonstrates how each screen's options change per role, per
   BRD §Permissions. Include on the feature catalogue screens.

   Markup contract:
   - [data-roles="ROLE_A ROLE_B"]  → element shown only for those roles
   - [data-edit-roles="ROLE_A"]    → inner form controls enabled only for those roles
   - <body data-page-roles="...">   → whole page accessible only to those roles (else 403)
   - <body data-role="ROLE">        → optional initial role (else inferred from sidebar badge)
   Roles: ADMIN_MAKER, ADMIN_CHECKER, OPERATOR_MAKER, OPERATOR_CHECKER, AUDITOR
   ============================================================ */
(function () {
  var ROLES = ['ADMIN_MAKER', 'ADMIN_CHECKER', 'OPERATOR_MAKER', 'OPERATOR_CHECKER', 'AUDITOR'];
  var PROFILE = {
    ADMIN_MAKER:      { name: 'Alex Maker',      initials: 'AM' },
    ADMIN_CHECKER:    { name: 'Carla Checker',   initials: 'CC' },
    OPERATOR_MAKER:   { name: 'Olivia Operator', initials: 'OM' },
    OPERATOR_CHECKER: { name: 'Paul Checker',    initials: 'PC' },
    AUDITOR:          { name: 'Aisha Khan',      initials: 'AU' }
  };

  function inList(attr, role) {
    return attr.split(/[\s,]+/).filter(Boolean).indexOf(role) !== -1;
  }

  // ---- Canonical navigation (single source of truth) ----------------------
  // Every feature screen renders the SAME sidebar; only the active item and
  // the role-based visibility change. This keeps navigation constant as the
  // user moves between screens.
  var ADMIN = 'ADMIN_MAKER ADMIN_CHECKER AUDITOR';
  var NAV = [
    { id: 'dashboard',        label: 'Dashboard',            icon: '▦', href: 'S-100-dashboard.html' },
    { section: 'Authorities' },
    { id: 'root-cas',         label: 'Root CAs',             icon: '◈', href: 'S-200-root-ca-list.html' },
    { id: 'intermediate-cas', label: 'Intermediate CAs',     icon: '◇', href: 'S-300-intermediate-ca-list.html' },
    { id: 'certificates',     label: 'Certificates',         icon: '▤', href: 'S-400-certificate-list.html' },
    { section: 'Requests' },
    // Makers track their own submissions ("My Requests"); they have no approval
    // queue. Checkers/Auditor get the approval queue + full history. The href for
    // My Requests is role-specific (each maker persona has its own page).
    { id: 'my-requests',      label: 'My Requests',          icon: '⟲', roles: 'ADMIN_MAKER OPERATOR_MAKER', hrefByRole: { ADMIN_MAKER: 'R-AM-my-requests.html', OPERATOR_MAKER: 'R-OM-my-requests.html' } },
    { id: 'pending',          label: 'Pending Requests',     icon: '◷', href: 'S-500-requests-pending.html', roles: 'ADMIN_CHECKER OPERATOR_CHECKER AUDITOR' },
    { id: 'history',          label: 'Request History',      icon: '⟲', href: 'S-502-request-history.html', roles: 'ADMIN_CHECKER OPERATOR_CHECKER AUDITOR' },
    { section: 'Administration' },
    { id: 'users',            label: 'Users',                icon: '◔', href: 'S-600-user-list.html', roles: ADMIN },
    { id: 'roles',            label: 'Roles',                icon: '◎', href: 'S-610-role-list.html', roles: ADMIN },
    { id: 'system-config',    label: 'System Configuration', icon: '⚙', href: 'S-700-system-configuration.html', roles: ADMIN },
    { endSection: true }, // close Administration; the trailing items below are loose (no header)
    { id: 'reports',          label: 'Reports',              icon: '▥', href: 'S-800-report-root-cas.html' },
    { id: 'audit',            label: 'Audit Log',            icon: '▣', href: 'S-806-report-audit.html' },
    { id: 'profile',          label: 'Profile',              icon: '◐', href: 'S-102-profile.html' }
  ];

  function activeNavId() {
    var f = (location.pathname.split('/').pop() || '').toLowerCase();
    if (/^s-100/.test(f)) return 'dashboard';
    if (/^s-102/.test(f)) return 'profile';
    if (/^s-2/.test(f)) return 'root-cas';
    if (/^s-3/.test(f)) return 'intermediate-cas';
    if (/^s-4/.test(f)) return 'certificates';
    if (/^s-50[01]/.test(f)) return 'pending';
    if (/^s-502/.test(f)) return 'history';
    if (/^s-60[0-3]/.test(f)) return 'users';
    if (/^s-61/.test(f)) return 'roles';
    if (/^s-700/.test(f)) return 'system-config';
    if (/^s-806/.test(f)) return 'audit';
    if (/^s-80/.test(f)) return 'reports';
    return '';
  }

  function buildNav(role) {
    var nav = document.querySelector('.sidebar__nav');
    if (!nav || nav.getAttribute('data-fixed-nav') === 'true') return; // skip persona/custom navs
    var active = activeNavId();
    var html = '';
    var pendingSection = null; // hold a section header until a visible item follows it
    NAV.forEach(function (n) {
      if (n.section) { pendingSection = n.section; return; }
      if (n.endSection) { pendingSection = null; return; } // close a section so trailing items stay loose
      if (n.roles && !inList(n.roles, role)) return; // not visible for this role
      if (pendingSection) { html += '<div class="sidebar__section">' + pendingSection + '</div>'; pendingSection = null; }
      var href = (n.hrefByRole && n.hrefByRole[role]) || n.href;
      var cls = 'nav-item' + (n.id === active ? ' is-active' : '');
      html += '<a class="' + cls + '" href="' + href + '"><span class="ico">' + n.icon + '</span> ' + n.label + '</a>';
    });
    nav.innerHTML = html;
  }

  var sel, denied;

  function buildDenied() {
    var el = document.createElement('div');
    el.id = 'rbac-denied';
    el.className = 'error-page rbac-denied';
    el.innerHTML =
      '<div class="code" style="font-size:64px">403</div>' +
      '<div class="muted">You do not have access to this resource in the selected role.</div>' +
      '<div class="muted body-sm">Switch to a permitted role using the control at the top right.</div>';
    document.body.appendChild(el);
    return el;
  }

  function apply(role) {
    document.body.setAttribute('data-role', role);
    try { sessionStorage.setItem('nexusRole', role); } catch (e) {}

    // Rebuild the sidebar for this role: the Requests section differs (makers see
    // "My Requests"; checkers/auditor see "Pending Requests" + "Request History")
    // and empty section headers are dropped. Identical structure on every screen.
    buildNav(role);

    document.querySelectorAll('[data-roles]').forEach(function (el) {
      el.hidden = !inList(el.getAttribute('data-roles'), role);
    });

    document.querySelectorAll('[data-edit-roles]').forEach(function (el) {
      var can = inList(el.getAttribute('data-edit-roles'), role);
      el.querySelectorAll('input, select, textarea, button').forEach(function (f) { f.disabled = !can; });
    });

    var p = PROFILE[role];
    var av = document.querySelector('.sidebar__user .avatar'); if (av) av.textContent = p.initials;
    var nm = document.querySelector('.sidebar__user .name');   if (nm) nm.textContent = p.name;
    var bd = document.querySelector('.sidebar__user .role-badge'); if (bd) bd.textContent = role;

    var allowedPage = document.body.getAttribute('data-page-roles');
    var app = document.querySelector('.app');
    if (allowedPage && !inList(allowedPage, role)) {
      if (!denied) denied = buildDenied();
      denied.hidden = false;
      if (app) app.style.display = 'none';
    } else {
      if (denied) denied.hidden = true;
      if (app) app.style.display = '';
    }

    if (sel) sel.value = role;
  }

  function fromQuery() {
    var m = /[?&]role=([^&]+)/.exec(location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function init() {
    // Resolve the role first; apply() then builds the role-correct sidebar (same
    // structure on every feature screen) and applies page-level visibility.
    // Resolution order: explicit ?role= → role carried from a persona (sessionStorage)
    // → page default (body[data-role]) → a single fixed default.
    // NB: we deliberately do NOT fall back to the screen's hardcoded sidebar
    // badge. Those badges differ per screen (reports=AUDITOR, certs=OPERATOR_MAKER,
    // requests=ADMIN_CHECKER, …), which made the landing role — and therefore the
    // visible nav items — depend on which screen you entered. Defaulting to one
    // role keeps navigation identical everywhere; the "View as" switcher (persisted
    // in sessionStorage) is the single control that changes it.
    var DEFAULT_ROLE = 'ADMIN_MAKER';
    var stored = null;
    try { stored = sessionStorage.getItem('nexusRole'); } catch (e) {}
    var initial = fromQuery() || stored || document.body.getAttribute('data-role');
    if (!initial || ROLES.indexOf(initial) === -1) {
      initial = DEFAULT_ROLE;
    }

    var box = document.createElement('div');
    box.className = 'rbac-switch';
    var lbl = document.createElement('span');
    lbl.className = 'rbac-switch__lbl';
    lbl.textContent = 'View as';
    sel = document.createElement('select');
    ROLES.forEach(function (r) {
      var o = document.createElement('option');
      o.value = r; o.textContent = r;
      sel.appendChild(o);
    });
    box.appendChild(lbl);
    box.appendChild(sel);
    document.body.appendChild(box);
    sel.addEventListener('change', function () { apply(sel.value); });

    apply(initial);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

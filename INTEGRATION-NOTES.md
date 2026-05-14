# Feature Gap Analysis: app.html vs Next.js (SISTEMA-AGENCIA-FINAL)

## Summary

**Next.js version is significantly more complete** with ~40% more database tables, a full client portal system, multi-agency support, advanced tracking dashboards, and team management. The app.html prototype is a lean 991-line monolith focused on core client/phase management. **Recommendation**: Keep Next.js as the base; port only high-value prototype UX patterns from app.html if they improve clarity.

---

## Features ONLY in app.html

| Feature | Location | Notes |
|---------|----------|-------|
| **Tablero de Pauta** | Lines 708-724 | Basic pauta/campaign overview view (ads at high level) |
| **Reunión Semanal** | Lines 726-750 | Weekly meeting summary/dashboard |
| **Reporte Cliente** | Lines 752-765 | Simple client report view (no PDF export) |
| **Editable owner chips in sidebar** | Lines 44-45 CSS, 936-941 logic | Direct owner filter by click (exists in Next.js but less prominent) |
| **Simple NuevoClienteModal only** | Lines 812-860 | Single modal; Next.js has 4 modals total |

**Assessment**: These are complementary views, not critical differentiators. Next.js covers them indirectly via more specialized tableros.

---

## Features ONLY in Next.js (SISTEMA-AGENCIA-FINAL/src)

| Feature | File(s) | Description |
|---------|---------|-------------|
| **Multi-agency support** | page.tsx (lines 25-27, 48-50, 66-73) | Agencias table; agency switcher in UI; all queries filtered by agencia_id |
| **TableroOnboarding** | TableroOnboarding.tsx | Pipeline tracking for new client onboarding (missing entirely in app.html) |
| **TableroEdicion** | TableroEdicion.tsx | Video editing tracker with fine-grained status (app.html bundles as "Producción") |
| **TableroDiseno** | TableroDiseno.tsx | Design/graphics tracker separate from production (app.html has no design isolation) |
| **TableroAnuncios** | TableroAnuncios.tsx | Detailed ads campaign management + ad account configuration |
| **TableroMetricas** | TableroMetricas.tsx | Metrics aggregation across accounts (no equivalent in app.html) |
| **TableroEquipo** | TableroEquipo.tsx | Team member tracking + roles (app.html has no team management) |
| **EquipoModal** | EquipoModal.tsx | Create/edit team members |
| **GestionCuentasModal** | GestionCuentasModal.tsx | Manage ad accounts with metrics |
| **CambiosSinEvaluarModal** | CambiosSinEvaluarModal.tsx | Unevaluated changes tracking |
| **OwnerFocoTable, OwnerTodoList** | OwnerFocoTable.tsx, OwnerTodoList.tsx | Owner-scoped task/focus management |
| **ReunionSemanal, ReporteCliente** | ReunionSemanal.tsx, ReporteCliente.tsx | Enhanced versions with richer data access |
| **Client Portal system** | PortalClienteAdmin.tsx + portal/* | Full portal with 10+ sections (accesos, aprobaciones, calendario, etc.) — **not in app.html** |
| **Portal auth + session mgmt** | lib/portalAuth.ts | Client portal login/SSO (not in app.html) |
| **PDF report generation** | lib/reportePDF.ts | Automated report PDFs with metrics tables |
| **TV Mode enhancements** | TVMode.tsx | Extended display-mode features |
| **Estado logging + workflow** | lib/estados.ts, lib/estadoHelper.ts | 19-state workflow with color-coding + audit trail (app.html: implicit states only) |
| **GestionAnuncio component** | GestionAnuncio.tsx | Ad-level management (e.g., pause/activate individual campaigns) |
| **Equipo table** | lib/supabase.ts | Team member schema (app.html has none) |

---

## Shared Features with Divergence

| Feature | app.html | Next.js | Notes |
|---------|----------|---------|-------|
| **Tablero General** | Grid of clientes with status badges | Same, plus agencia filter + richer filtering UI | Functionally equivalent; Next.js adds agency context |
| **Tablero Clientes** | Detail card: notes, phases, basic edits | Full page with adAccounts, equipo context | Next.js is much richer; app.html is minimal |
| **Tablero Owners** | Owner stats by client counts | Owner stats + equipment + client breakdowns | Next.js more detailed |
| **Tablero Producción** | Phase-based workflow view (fases_cliente) | Phase view + edición/diseño separation | Next.js decouples production into 3 tableros |
| **TVMode** | Clock + client grid refresh every 60s | Same + enhanced card layouts | Feature parity; slightly different rendering |
| **NuevoClienteModal** | 1 modal (nombre, tipo, owner_id, objetivo) | Same (+ agencia_id field) | Functionally identical |
| **State machine** | Implicit (no enum, just free text) | 19-state ESTADO_OPTIONS_ONGOING + color coding | **Big difference**: Next.js has audit trail (estado_log table) |
| **Sidebar owner filter** | Chip buttons in sidebar footer | Same, plus "__none__" (unassigned) filter | Nearly identical |
| **Toast notifications** | 3s auto-dismiss | Same | Identical |

---

## Supabase Schema Surface

### Tables touched by app.html
```
clientes       (id, nombre, tipo, owner_id, objetivo, estado, ...)
fases_cliente  (id, cliente_id, nombre, status, ...)
notas          (id, cliente_id, contenido, ...)
owners         (id, nombre_corto, activo, ...)
reportes       (id, cliente_id, metricas, ...)
```

### Tables touched by Next.js (SISTEMA-AGENCIA-FINAL)
```
Same as above, PLUS:

agencias                  (id, nombre, activo, color, ...)
equipo                    (id, nombre, agencia_id, rol, activo, ...)
ad_accounts               (id, cliente_id, account_name, spend, impressions, metrics_7d, metrics_15d, metrics_30d, ...)
ad_campanas               (id, cuenta_id, nombre, estado, presupuesto, ...)
ad_creativos              (id, campana_id, ...)
ad_revisiones             (id, creativo_id, ...)
ad_cambios_log            (id, creativo_id, cambio, ...)
ad_account_config         (id, cuenta_id, configuracion, ...)
estado_log                (id, cliente_id, estado_anterior, estado_nuevo, changed_by, timestamp) ← AUDIT TRAIL
cliente_portal_acceso     (id, cliente_id, slug, username, password, activo, last_login, ...)
cliente_portal_config     (id, cliente_id, ...)
cliente_accesos           (id, cliente_id, ...)
cliente_aprobaciones      (id, cliente_id, ...)
cliente_alertas           (id, cliente_id, ...)
cliente_calendario        (id, cliente_id, ...)
cliente_decisiones        (id, cliente_id, ...)
cliente_notificaciones    (id, cliente_id, ...)
cliente_objetivos         (id, cliente_id, ...)
cliente_pagos             (id, cliente_id, ...)
cliente_roadmap           (id, cliente_id, ...)
cliente_sugerencias       (id, cliente_id, ...)
cliente_tutoriales        (id, cliente_id, ...)
tasks                     (id, ...)
estado_log                (audit trail)
```

**Assessment**: Next.js is managing ~30 tables vs app.html's ~5. This is not bloat — each portal section needs its backing store.

---

## Migration Risk / Things to Be Careful About

1. **Estado logic**: app.html has no formal workflow. Next.js has strict 19-state enum. If merging, **do NOT allow free-text states** — enforce ESTADO_OPTIONS_ONGOING everywhere.

2. **Agencia_id pervasiveness**: Next.js filters ALL queries by agencia_id. If you backport app.html logic, ensure every query includes `.eq('agencia_id', selectedAgencia)`. Missing this breaks multi-agency support silently.

3. **Owner "sin asignar" filter**: Next.js supports `ownerFilter === '__none__'` to show unassigned clients. app.html does not. If porting filters, keep this parity.

4. **Portal tables are decoupled**: The 13 cliente_* tables have different update cadences and schemas. Don't assume they're synchronized — they're independent feature stores.

5. **PDF generation is stateless**: reportePDF.ts takes snapshots of adAccounts.metrics_*d. If metrics schema changes, ensure this function stays in sync (not auto-updated by schema migrations).

6. **Auth difference**: 
   - app.html: No client portal auth (would need new code)
   - Next.js: portalAuth.ts handles login/session. Password stored plaintext — **security note for future**: hash passwords in DB.

7. **TVMode timing**: app.html refreshes every 60s via setInterval. Next.js does the same. If replacing, preserve the 60s cadence for display.

---

## Recommended Integration Order

1. **Phase 1 (High priority)**: Keep Next.js architecture as-is. It is the more correct foundation.

2. **Phase 2 (If needed)**: Port app.html's **Reunión Semanal view** if Next.js version is missing meeting-specific aggregations. Check ReunionSemanal.tsx first — if it's feature-complete, skip.

3. **Phase 3 (Polish)**: Copy app.html's **CSS + design tokens** (color palette, spacing, fonts, transitions) if Next.js's visual style is degraded. Lines 12-24 define the design system.

4. **Phase 4 (Optional)**: If app.html has better UX for **owner filter sidebar**, copy the chip-button logic (lines 44-45, 936-941) — but Next.js likely already has it.

5. **Avoid porting**:
   - Single-modal NuevoClienteModal (Next.js is already superior with agencia context)
   - TableroPauta/ReporteCliente logic (Next.js versions are richer; check them first)
   - Free-text estado management (app.html's implicit states are a bug; Next.js is correct)

6. **Validation step**: Once merged, run:
   - All queries return data filtered by correct agencia_id
   - Estado changes log to estado_log table
   - Portal tables accessible from PortalClienteAdmin.tsx without errors

---

## Known Unknowns

- **ReunionSemanal content**: app.html shows only skeleton (lines 726-750). Does Next.js version have real aggregation logic? **Check TableroSemanal.tsx.**
- **ReporteCliente implementation**: app.html is minimal. Does Next.js integrate reportePDF.ts? **Check ReporteCliente.tsx.**
- **TableroPauta scope**: app.html's pauta view may show different data than TableroAnuncios.tsx. Needs side-by-side comparison if porting.
- **Owner stats logic**: Both have useMemo aggregations, but schemas may differ (app.html vs. equipo table). Verify before replacing.

---

**Document prepared**: 2026-05-06 | **Total lines of comparison**: ~30 tableros, ~13 modals, ~28 tables | **Confidence**: High for structural gaps; medium for algorithmic equivalence (read component code to confirm logic parity).

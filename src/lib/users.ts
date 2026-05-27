// USERS — autenticación interna del equipo (Phase 1: hardcoded).
// Phase 2+ migraremos a una tabla `usuarios` con `agencia_id` + RLS.
// Por ahora estos PINs son comunes a todas las agencias y viven solo client-side.

export type UserRole = 'admin' | 'semi-admin' | 'miembro'
export type UserArea = 'copys' | 'grab' | 'edit' | 'diseno' | 'subida' | 'anuncios'

export type UserDef = {
  pin: string
  role: UserRole
  areas: UserArea[]
  /** color opcional para el avatar; si no, se asigna por hash del nombre */
  color?: string
  /** Override por usuario: vistas ocultas aunque su rol normalmente las vería */
  hiddenViews?: string[]
  /** Override por usuario: vistas habilitadas aunque su rol normalmente NO las vería (whitelist) */
  extraVisibleViews?: string[]
  /** Override del view inicial al loguear (precede a defaultViewFor por rol) */
  defaultView?: string
}

export type CurrentUser = {
  name: string
  role: UserRole
  areas: UserArea[]
}

export const ALL_AREAS: UserArea[] = ['copys', 'grab', 'edit', 'diseno', 'subida', 'anuncios']

// USERS — alineado con el organigrama del equipo (Future Agency, mayo 2026):
//
//                         Leandro (CEO)
//                       /              \
//                  Tomas (COO)    Franco (Líder Producto)
//                   /  \           |   |   |   |   |   |
//             Ramiro Matias   Pablo Lucas Franco-Luna Santiago-T Brianna Lorenzo
//             (Owners)        (Estr) (Copy) (Ads)     (Edit Lead) (Dis/CM) (Film)
//                                                       |   |       |   |
//                                                  Gabriel Silv  Gerardo Cesar
//                                                   (Editores)    (Diseñadores)
export const USERS: Record<string, UserDef> = {
  // ── Admins (CEO + COO + Líder Producto) ──
  // Ven absolutamente todo, editan todo.
  Leandro:          { pin: '1234', role: 'admin', areas: ALL_AREAS, color: '#8965e0' },
  Tomas:            { pin: '1234', role: 'admin', areas: ALL_AREAS, color: '#11cdef' },
  Franco:           { pin: '1234', role: 'admin', areas: ALL_AREAS, color: '#2dce89' },

  // ── Owners (semi-admin cross-área, Owners filtrado a sus clientes) ──
  Ramiro:           { pin: '1234', role: 'semi-admin', areas: ALL_AREAS, color: '#f5a623' },
  Matias:           { pin: '1111', role: 'semi-admin', areas: ALL_AREAS, color: '#f5365c' },

  // ── Líderes de área (semi-admin enfocados en su sección) ──
  'Santiago Tucci': {
    pin: '1111', role: 'semi-admin', areas: ['edit'], color: '#84cc16',
    hiddenViews: ['onboarding', 'owners', 'anuncios', 'metricas'],
    defaultView: 'edicion',
  },
  Brianna:          {
    // Líder Diseño / CM → Diseño + Subida
    pin: '1111', role: 'semi-admin', areas: ['diseno', 'subida'], color: '#ec4ad8',
    hiddenViews: ['onboarding', 'owners', 'anuncios', 'metricas', 'copys'],
    defaultView: 'diseno',
  },
  Lorenzo:          {
    // Productor / Filmmaker → Grab (Producción)
    pin: '1111', role: 'semi-admin', areas: ['grab'], color: '#10b981',
    hiddenViews: ['onboarding', 'owners', 'anuncios', 'metricas'],
    defaultView: 'produccion',
  },

  // ── Miembros (solo su área + lo necesario) ──
  Pablo: {
    // Estratega → Copys + Onboarding (estrategia es upstream del copy)
    pin: '1111', role: 'miembro', areas: ['copys'], color: '#a855f7',
    hiddenViews: ['produccion', 'edicion', 'diseno'],
    defaultView: 'copys',
  },
  Lucas: {
    // CopyWriter → Copys + Edición (ve dónde van sus scripts)
    pin: '1111', role: 'miembro', areas: ['copys'], color: '#06b6d4',
    hiddenViews: ['onboarding', 'produccion', 'diseno'],
    defaultView: 'copys',
  },
  'Franco Luna': {
    // Ads Manager con acceso completo (admin) — ve y edita todo igual que CEO/COO/Líder Producto.
    pin: '1111', role: 'admin', areas: ALL_AREAS, color: '#fb6340',
    defaultView: 'anuncios',
  },
  Gabriel: {
    // Editor → Edición + ve copys read-only para entender script
    pin: '1111', role: 'miembro', areas: ['edit'], color: '#34d399',
    hiddenViews: ['onboarding', 'produccion', 'diseno'],
    defaultView: 'edicion',
  },
  Silvestre: {
    pin: '1111', role: 'miembro', areas: ['edit'], color: '#a78bfa',
    hiddenViews: ['onboarding', 'produccion', 'diseno'],
    defaultView: 'edicion',
  },
  Gerardo: {
    // Diseñador → solo Diseño
    pin: '1111', role: 'miembro', areas: ['diseno'], color: '#f59e0b',
    hiddenViews: ['onboarding', 'produccion', 'edicion'],
    defaultView: 'diseno',
  },
  Cesar: {
    pin: '1111', role: 'miembro', areas: ['diseno'], color: '#6366f1',
    hiddenViews: ['onboarding', 'produccion', 'edicion'],
    defaultView: 'diseno',
  },
}

// Subtítulos visibles en login + topbar (rol "humano" del organigrama)
export const USER_TITLES: Record<string, string> = {
  Leandro: 'CEO',
  Tomas: 'COO',
  Franco: 'Líder de Producto',
  Ramiro: 'Owner',
  Matias: 'Owner',
  'Santiago Tucci': 'Líder de Editores',
  Brianna: 'Líder Diseño / CM',
  Lorenzo: 'Productor / Filmmaker',
  Pablo: 'Estratega',
  Lucas: 'CopyWriter',
  'Franco Luna': 'Ads Manager',
  Gabriel: 'Editor',
  Silvestre: 'Editor',
  Gerardo: 'Diseñador',
  Cesar: 'Diseñador',
}

export function getUserDef(name: string): UserDef | null {
  return USERS[name] ?? null
}

export function authenticate(name: string, pin: string): CurrentUser | null {
  const u = USERS[name]
  if (!u) return null
  if (u.pin !== pin) return null
  return { name, role: u.role, areas: u.areas }
}

export function isAdmin(u: CurrentUser | null): boolean {
  return u?.role === 'admin'
}
export function isSemiAdmin(u: CurrentUser | null): boolean {
  return u?.role === 'semi-admin'
}
export function isMiembro(u: CurrentUser | null): boolean {
  return u?.role === 'miembro'
}

/** ¿Puede editar contenido en una sección/área dada? */
export function canEditArea(u: CurrentUser | null, area: UserArea): boolean {
  if (!u) return false
  if (u.role === 'admin') return true
  return u.areas.includes(area)
}

// Mapeo de las views de page.tsx → si requieren admin / semi-admin / cualquiera.
// Usado por canSeeView para restringir el sidebar.
type ViewVisibility = 'all' | 'admin+semi' | 'admin'

export const VIEW_VISIBILITY: Record<string, ViewVisibility> = {
  // Mis Tareas — todos
  mistareas:  'all',
  // Tableros operacionales — todos pueden ver (los miembros en read-only)
  general:    'admin+semi',
  onboarding: 'all',
  produccion: 'all',
  edicion:    'all',
  diseno:     'all',
  anuncios:   'admin+semi',
  // Phase 7 — pipelines per-area nuevos
  copys:        'all',
  grab:         'all',
  'grab-calendar': 'all',
  subida:       'admin+semi',
  // Phase 6c — calendario
  calendario:   'admin+semi',
  // Phase 9 — fechas especiales / pedidos
  fechas:       'admin+semi',
  pedidos:      'admin+semi',
  // B3 — deudas de contenido
  deudas:       'admin+semi',
  // Día de la Agencia
  'dia-agencia': 'all',
  // Vistas analíticas — solo admin
  gestion:      'admin',
  diagnostico:  'admin',
  metricas:     'admin+semi',
  owners:       'admin+semi',
  equipo:       'admin',
  // Vistas auxiliares
  reunion:      'admin+semi',
  reporte:      'admin+semi',
  detalle:      'all',
}

export function canSeeView(u: CurrentUser | null, view: string): boolean {
  if (!u) return false
  const def = USERS[u.name]
  // 1. hiddenViews — bloquea aunque el rol normalmente lo permitiría
  if (def?.hiddenViews?.includes(view)) return false
  // 2. extraVisibleViews — habilita aunque el rol normalmente NO lo permitiría
  if (def?.extraVisibleViews?.includes(view)) return true
  // 3. Default por rol
  const vis = VIEW_VISIBILITY[view] ?? 'admin'
  if (vis === 'all') return true
  if (vis === 'admin+semi') return u.role === 'admin' || u.role === 'semi-admin'
  return u.role === 'admin'
}

/** View por defecto al loguear: primero override per-user, después por rol. */
export function defaultViewFor(u: CurrentUser): string {
  const def = USERS[u.name]
  if (def?.defaultView) return def.defaultView
  if (u.role === 'admin') return 'general'
  if (u.role === 'semi-admin') return 'general'
  return 'mistareas'
}

/** Iniciales para el avatar. Multi-word: primera letra de hasta 2 palabras. */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map(p => p.charAt(0).toUpperCase()).join('')
}

/**
 * Match flexible entre dos nombres (ej: user "Ramiro" ↔ owner "Rami" o "Ramiro Pérez").
 * Compara case-insensitive, bidireccional includes y por primera palabra.
 */
export function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const A = a.toLowerCase().trim()
  const B = b.toLowerCase().trim()
  if (!A || !B) return false
  if (A === B) return true
  if (A.includes(B) || B.includes(A)) return true
  const a0 = A.split(/\s+/)[0]
  const b0 = B.split(/\s+/)[0]
  if (a0 && b0 && (a0.startsWith(b0) || b0.startsWith(a0))) return true
  return false
}

// ============== View-to-area mapping para read-only ==============

/**
 * Mapea cada view del sidebar a las `UserArea`s requeridas para edición.
 * - `null` = view es "transversal" (admin/semi-admin pueden, miembros leen)
 * - `UserArea[]` = user puede editar si tiene CUALQUIERA de esas áreas
 */
export const VIEW_TO_AREAS: Record<string, UserArea[] | null> = {
  mistareas: null,                            // tu propia vista
  general: null,                              // dashboard transversal
  gestion: null,                              // admin-only
  diagnostico: null,                          // admin-only
  onboarding: null,                           // transversal (lo edita el owner)
  owners: null,                               // transversal
  produccion: ['copys', 'grab', 'edit', 'diseno'], // produccion en lean-consult cubre varias áreas
  edicion: ['edit'],
  diseno: ['diseno'],
  anuncios: ['subida'],
  // Phase 7 — pipelines per-area
  copys:  ['copys'],
  grab:   ['grab'],
  'grab-calendar': ['grab'],
  subida: ['subida'],
  reporte: ['anuncios'],
  // Phase 6c
  calendario: null,
  // Phase 9
  fechas:  null,
  pedidos: null,
  deudas:  null,
  'dia-agencia': null,
  metricas: null,
  equipo: null,
}

/** ¿El user puede editar (no solo ver) la view actual? */
export function canEditView(u: CurrentUser | null, view: string): boolean {
  if (!u) return false
  if (u.role === 'admin') return true
  const required = VIEW_TO_AREAS[view]
  if (required === null) {
    // views transversales: solo semi-admin puede editar
    return u.role === 'semi-admin' && view !== 'gestion' && view !== 'diagnostico' && view !== 'equipo'
  }
  return required.some(a => u.areas.includes(a))
}

/** ¿El user es read-only en la view? = puede ver pero no editar. */
export function isReadOnlyView(u: CurrentUser | null, view: string): boolean {
  return canSeeView(u, view) && !canEditView(u, view)
}

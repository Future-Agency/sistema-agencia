// Per-area state machines (ciclo-dashboard parity).
// Cada área tiene su propio pipeline de estados, con prereqs por transición.
// Phase 7: las columnas estado_copys / estado_grab / estado_subida se agregan en sql/2026-05-08_phase_7_area_states.sql.
// estado_edicion / estado_diseno ya existen en clientes.

import type { UserArea } from './users'

export type AreaState = {
  id: number
  label: string
  short?: string
  icon: string
  /** Si true, requiere acción para salir (e.g. métricas listas) */
  isGate?: boolean
  /** Color override */
  color?: string
}

export type AreaDef = {
  id: UserArea
  label: string
  emoji: string
  primaryColor: string
  /** Estados regulares (cliente ongoing) */
  states: AreaState[]
  /** Estados onboarding (cuando cliente.is_onboarding === true) — opcional */
  onboardingStates?: AreaState[]
  /** Índice del estado "CORRECCIÓN" — al que se manda con el botón rojo */
  correctionStateId?: number
  /** Índice del estado de "REVISIÓN INTERNA" — antes de cliente */
  reviewInternalStateId?: number
  /** Índice del estado de "REVISIÓN CLIENTE" */
  reviewClientStateId?: number
  /** Estado de aprobado / cierre del área */
  approvedStateId: number
  /** Columna de cliente que guarda el estado actual de esta área */
  clienteColumn: string
}

// ============== COPYS ==============
// REGULAR_STATES (7)
const COPYS_REGULAR: AreaState[] = [
  { id: 0, label: 'PENDIENTE DE INFORMACIÓN', short: 'PEND.INFO', icon: '⏸️', isGate: true, color: '#f5a623' },
  { id: 1, label: 'MÉTRICAS',           short: 'MÉT',    icon: '📊', isGate: true },
  { id: 2, label: 'POR HACER SCRIPTS',  short: 'SCRIPT', icon: '✍️' },
  { id: 3, label: 'REVISIÓN FRAN',      short: 'R.FRAN', icon: '🔍' },
  { id: 4, label: 'REVISIÓN CLIENTE',   short: 'R.CLI',  icon: '👁' },
  { id: 5, label: 'CORRECCIÓN',         short: 'CORR',   icon: '🔧', color: '#f5365c' },
  { id: 6, label: 'LISTO PARA GRABAR',  short: 'LISTO',  icon: '🎬' },
]

const COPYS_ONBOARDING: AreaState[] = [
  { id: 0, label: 'PENDIENTE DE INFORMACIÓN', icon: '⏸️', color: '#f5a623' },
  { id: 1, label: 'INVESTIGACIÓN',      icon: '🔬' },
  { id: 2, label: 'ESTRATEGIA',         icon: '🧠' },
  { id: 3, label: 'MÉTRICAS',           icon: '📊' },
  { id: 4, label: 'POR HACER SCRIPTS',  icon: '✍️' },
  { id: 5, label: 'REVISIÓN FRAN',      icon: '🔍' },
  { id: 6, label: 'REVISIÓN CLIENTE',   icon: '👁' },
  { id: 7, label: 'CORRECCIÓN',         icon: '🔧', color: '#f5365c' },
  { id: 8, label: 'LISTO PARA GRABAR',  icon: '🎬' },
]

// Motivos canónicos del estado PENDIENTE DE INFORMACIÓN.
// Si se selecciona OTRO, el modal pide un texto libre en pendiente_info_otro.
export const MOTIVOS_PENDIENTE_INFO = [
  { value: 'ESPERANDO_OFERTA',    label: 'Esperando info de oferta' },
  { value: 'EXCEL_PRODUCTOS',     label: 'Excel de productos' },
  { value: 'PRECIOS',             label: 'Precios' },
  { value: 'STOCK',               label: 'Stock' },
  { value: 'LLAMADA',             label: 'Llamada con cliente' },
  { value: 'INFORMACION_EVENTO',  label: 'Información de evento' },
  { value: 'OTRO',                label: 'Otro (especificar)' },
] as const

export type MotivoPendiente = typeof MOTIVOS_PENDIENTE_INFO[number]['value']
export const ESTADO_PENDIENTE_INFO_LABEL = 'PENDIENTE DE INFORMACIÓN'

// ============== GRAB ==============
const GRAB_STATES: AreaState[] = [
  { id: 0, label: 'RECEPCIÓN',         icon: '📥' },
  { id: 1, label: 'PRE-PRODUCCIÓN',    icon: '📋' },
  { id: 2, label: 'AGENDA FILMACIÓN',  icon: '📅' },
  { id: 3, label: 'FILMACIÓN',         icon: '🎥' },
  { id: 4, label: 'SUBIDA DRIVE',      icon: '🔍' },
  { id: 5, label: 'MATERIAL SUBIDO',   icon: '✅' },
]

// ============== EDIT ==============
const EDIT_STATES: AreaState[] = [
  { id: 0, label: 'RECEPCIÓN',         icon: '📥' },
  { id: 1, label: 'EDICIÓN BORRADOR',  icon: '🎞️' },
  { id: 2, label: 'REVISIÓN INTERNA',  icon: '👀' },
  { id: 3, label: 'CORRECCIÓN',        icon: '🔄', color: '#f5365c' },
  { id: 4, label: 'REVISIÓN CLIENTE',  icon: '👁' },
  { id: 5, label: 'APROBADO',          icon: '✅' },
]

// ============== DISEÑO ==============
const DISENO_STATES: AreaState[] = [
  { id: 0, label: 'RECEPCIÓN',         icon: '📥' },
  { id: 1, label: 'DISEÑO EN CURSO',   icon: '🎨' },
  { id: 2, label: 'REVISIÓN INTERNA',  icon: '👀' },
  { id: 3, label: 'CORRECCIÓN',        icon: '🔄', color: '#f5365c' },
  { id: 4, label: 'REVISIÓN CLIENTE',  icon: '👁' },
  { id: 5, label: 'APROBADO',          icon: '✅' },
]

// ============== SUBIDA ==============
const SUBIDA_STATES: AreaState[] = [
  { id: 0, label: 'RECEPCIÓN',         icon: '📥' },
  { id: 1, label: 'PREPARAR CONTENIDO', icon: '🛠️' },
  { id: 2, label: 'COPYWRITING',       icon: '✍️' },
  { id: 3, label: 'PROGRAMACIÓN',      icon: '📅' },
  { id: 4, label: 'PUBLICADO',         icon: '🚀' },
]

// ============== ANUNCIOS (cierre de ciclo) ==============
// Loop interno post-publicación: activación de ads, monitoreo y reporte final.
// Reemplaza al estado legacy "METRICAS Y VOLVER A EMPEZAR" con un pipeline propio.
const ANUNCIOS_AREA_STATES: AreaState[] = [
  { id: 0, label: 'ANUNCIOS SIN ACTIVAR',    icon: '📣' },
  { id: 1, label: 'ANUNCIOS PRENDIDOS',      icon: '🔥' },
  { id: 2, label: 'ANUNCIOS CHECK',          icon: '✅' },
  { id: 3, label: 'REPORTE ADS + ORGÁNICO',  icon: '📊' },
  { id: 4, label: 'VOLVER A EMPEZAR',        icon: '🔄' },
]

export const AREA_DEFS: Record<UserArea, AreaDef> = {
  copys: {
    id: 'copys',
    label: 'Copys',
    emoji: '✍️',
    primaryColor: '#5e72e4',
    states: COPYS_REGULAR,
    onboardingStates: COPYS_ONBOARDING,
    correctionStateId: 5, // CORRECCIÓN (estado dedicado, pide link de correcciones)
    reviewInternalStateId: 3, // REVISIÓN FRAN actúa como gate de revisión interna
    reviewClientStateId: 4, // REVISIÓN CLIENTE
    approvedStateId: 6, // LISTO PARA GRABAR
    clienteColumn: 'estado_copys',
  },
  grab: {
    id: 'grab',
    label: 'Grab',
    emoji: '🎥',
    primaryColor: '#f5a623',
    states: GRAB_STATES,
    reviewInternalStateId: 4,
    approvedStateId: 5,
    clienteColumn: 'estado_grab',
  },
  edit: {
    id: 'edit',
    label: 'Edición',
    emoji: '✂️',
    primaryColor: '#fb6340',
    states: EDIT_STATES,
    correctionStateId: 3,
    reviewInternalStateId: 2,
    reviewClientStateId: 4,
    approvedStateId: 5,
    clienteColumn: 'estado_edicion',
  },
  diseno: {
    id: 'diseno',
    label: 'Diseño',
    emoji: '🎨',
    primaryColor: '#f5365c',
    states: DISENO_STATES,
    correctionStateId: 3,
    reviewInternalStateId: 2,
    reviewClientStateId: 4,
    approvedStateId: 5,
    clienteColumn: 'estado_diseno',
  },
  subida: {
    id: 'subida',
    label: 'Subida',
    emoji: '🚀',
    primaryColor: '#00d97e',
    states: SUBIDA_STATES,
    approvedStateId: 4, // PUBLICADO = cierre de subida (la pieza pasa a "anuncios")
    clienteColumn: 'estado_subida',
  },
  anuncios: {
    id: 'anuncios',
    label: 'Reportes',
    emoji: '📊',
    primaryColor: '#f5a623',
    states: ANUNCIOS_AREA_STATES,
    approvedStateId: 4, // VOLVER A EMPEZAR = cierre del ciclo completo
    clienteColumn: 'estado_anuncios',
  },
}

/** Prereqs por transición (sec:fromId:toId). v1: definidos sólo para los más críticos. */
export const STAGE_PREREQS: Record<string, string[]> = {
  // Copys
  'copys:1:2': ['Scripts redactados completos', 'Hook + CTA verificados'],
  'copys:2:3': ['Fran aprobó internamente', 'Sin notas pendientes'],
  'copys:3:4': ['Cliente aprobó por escrito', 'Listas las locaciones / props'],
  // Edit
  'edit:1:2': ['Edición borrador exportada', 'Subtítulos generados'],
  'edit:2:3': ['Notas de revisión interna registradas'],
  'edit:4:5': ['Cliente aprobó por escrito (chat / mail)'],
  // Diseño
  'diseno:1:2': ['Diseño en formato final exportado'],
  'diseno:4:5': ['Cliente aprobó por escrito'],
  // Subida
  'subida:2:3': ['Copy aprobado'],
  'subida:3:4': ['Confirmar fecha y hora de programación'],
  // Anuncios (cierre de ciclo)
  'anuncios:0:1': ['Anuncios creados en Ads Manager (campañas + sets + creatividades)', 'Presupuesto cargado'],
  'anuncios:1:2': ['Pasaron 48h+ con data suficiente para chequear performance'],
  'anuncios:2:3': ['Datos de ads + orgánico disponibles para armar el reporte'],
  'anuncios:3:4': ['Reporte enviado al cliente', 'Análisis copiado al loop del próximo ciclo'],
}

export function getStateById(area: AreaDef, id: number, isOnboarding = false): AreaState | null {
  const list = isOnboarding && area.onboardingStates ? area.onboardingStates : area.states
  return list.find(s => s.id === id) ?? null
}

export function getNextState(area: AreaDef, currentId: number, isOnboarding = false): AreaState | null {
  const list = isOnboarding && area.onboardingStates ? area.onboardingStates : area.states
  return list.find(s => s.id === currentId + 1) ?? null
}

export function getPrereqs(seccion: UserArea, fromId: number, toId: number): string[] {
  return STAGE_PREREQS[`${seccion}:${fromId}:${toId}`] ?? []
}

// Estados canónicos del workflow ongoing.
// Fuente de verdad: AREA_DEFS en areaStates.ts (per-area state machines).
// Este archivo genera el listado unificado para vistas que necesitan TODOS los estados
// (Owners FOCO dropdown, Producción Kanban) y mantiene aliases de back-compat.

import { AREA_DEFS } from './areaStates'

export type Fase = 'guion' | 'grabacion' | 'edicion' | 'diseno' | 'revision' | 'subida' | 'anuncios'

// Estados del área "anuncios" — están en AREA_DEFS.anuncios (areaStates.ts).
// Listado redundante acá para dropdowns que los agrupan como bucket "Anuncios" en optgroups.
const ANUNCIOS_STATES = AREA_DEFS.anuncios.states.map(s => s.label)

// Estados legacy (canonical antiguo de 17) que pueden seguir en DB de clientes viejos
// Los mantenemos como aliases para que sigan teniendo color
const LEGACY_STATE_FASE: Record<string, Fase> = {
  'GUIONES': 'guion',
  'REVISION GUIONES': 'guion',
  'CORRECION GUIONES': 'guion',
  'PRODUCCIÓN A CONFIRMAR': 'grabacion',
  'PRODUCCION CONFIRMADA': 'grabacion',
  'EDICIÓN': 'edicion',
  'REVISION - RAMI': 'revision',
  'CORRECION': 'edicion',
  'DISEÑO': 'diseno',
  'APROBADO - SUBIDA A CLICKUP': 'subida',
  'PROGRAMACION': 'subida',
  'PROGAMADO': 'subida',
  // Estado legacy del cierre de ciclo (reemplazado por REPORTE + VOLVER A EMPEZAR)
  'METRICAS Y VOLVER A EMPEZAR': 'anuncios',
  'MÉTRICAS Y VOLVER A EMPEZAR': 'anuncios',
}

// Estados shared (aparecen en más de un area) → fase agnóstica
const SHARED_STATE_FASE: Record<string, Fase> = {
  'RECEPCIÓN': 'edicion',           // se usa en grab/edit/diseno/subida — color neutro
  'REVISIÓN INTERNA': 'revision',
  'REVISIÓN CLIENTE': 'revision',
  'CORRECCIÓN': 'revision',
  'APROBADO': 'subida',
  'MÉTRICAS': 'guion',              // existe en copys (inicio) y subida (final)
}

// Colores por fase
const FASE_COLORS: Record<Fase, { bg: string; color: string }> = {
  guion:     { bg: 'rgba(137,101,224,.15)', color: '#a78bfa' },
  grabacion: { bg: 'rgba(94,114,228,.15)',  color: '#5e72e4' },
  edicion:   { bg: 'rgba(251,99,64,.15)',   color: '#fb6340' },
  diseno:    { bg: 'rgba(236,74,216,.15)',  color: '#ec4ad8' },
  revision:  { bg: 'rgba(245,214,35,.15)',  color: '#f5d623' },
  subida:    { bg: 'rgba(0,217,126,.18)',   color: '#00d97e' },
  anuncios:  { bg: 'rgba(245,166,35,.18)',  color: '#f5a623' },
}

// Build unified list: per-area states (dedup by label) + anuncios + legacy aliases
function buildUnifiedStateList(): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  const order: ('copys' | 'grab' | 'edit' | 'diseno' | 'subida' | 'anuncios')[] = ['copys', 'grab', 'edit', 'diseno', 'subida', 'anuncios']
  for (const area of order) {
    AREA_DEFS[area].states.forEach(s => {
      if (!seen.has(s.label)) { seen.add(s.label); result.push(s.label) }
    })
  }
  return result
}

export const ESTADO_OPTIONS_ONGOING: string[] = buildUnifiedStateList()

// Build ESTADO_FASE — incluye unified + shared overrides + legacy
function buildEstadoFase(): Record<string, Fase> {
  const map: Record<string, Fase> = {}
  // Per-area states (orden: shared overrides al final, no antes)
  AREA_DEFS.copys.states.forEach(s => map[s.label] = 'guion')
  AREA_DEFS.grab.states.forEach(s => map[s.label] = 'grabacion')
  AREA_DEFS.edit.states.forEach(s => map[s.label] = 'edicion')
  AREA_DEFS.diseno.states.forEach(s => map[s.label] = 'diseno')
  AREA_DEFS.subida.states.forEach(s => map[s.label] = 'subida')
  AREA_DEFS.anuncios.states.forEach(s => map[s.label] = 'anuncios')
  // Shared overrides (multi-area) — definen el color compartido
  Object.entries(SHARED_STATE_FASE).forEach(([k, v]) => { map[k] = v })
  // Legacy aliases (no se pisa lo de arriba si hay match exacto, pero estos no chocan)
  Object.entries(LEGACY_STATE_FASE).forEach(([k, v]) => { if (!(k in map)) map[k] = v })
  return map
}

export const ESTADO_FASE: Record<string, Fase> = buildEstadoFase()

// ESTADO_COLORS — derivado de ESTADO_FASE
export const ESTADO_COLORS: Record<string, { bg: string; color: string }> = (() => {
  const map: Record<string, { bg: string; color: string }> = {}
  for (const [estado, fase] of Object.entries(ESTADO_FASE)) {
    map[estado] = FASE_COLORS[fase]
  }
  // Onboarding (flujo aparte)
  map['Onboarding'] = { bg: 'rgba(245,166,35,.12)', color: '#fbbf24' }
  return map
})()

// Estados de ads activos / pendientes
export const ESTADOS_ADS_ACTIVOS = ['ANUNCIOS PRENDIDOS', 'ANUNCIOS CHECK']
export const ESTADOS_ADS_PENDIENTES = ['ANUNCIOS SIN ACTIVAR', 'PROGAMADO']

export function getEstadoStyle(estado: string): { bg: string; color: string } {
  return ESTADO_COLORS[estado] || { bg: 'rgba(94,114,228,0.1)', color: '#8b9cf7' }
}

// Helper: agrupar estados por area (para optgroups en dropdowns)
export type StateGroup = { area: string; label: string; estados: string[] }

export function getStatesGroupedByArea(): StateGroup[] {
  return [
    { area: 'copys',  label: '✍️ Copys',     estados: AREA_DEFS.copys.states.map(s => s.label) },
    { area: 'grab',   label: '🎥 Grab',      estados: AREA_DEFS.grab.states.map(s => s.label) },
    { area: 'edit',   label: '✂️ Edición',    estados: AREA_DEFS.edit.states.map(s => s.label) },
    { area: 'diseno', label: '🎨 Diseño',    estados: AREA_DEFS.diseno.states.map(s => s.label) },
    { area: 'subida', label: '🚀 Subida',    estados: AREA_DEFS.subida.states.map(s => s.label) },
    { area: 'anuncios', label: '📊 Reportes', estados: AREA_DEFS.anuncios.states.map(s => s.label) },
  ]
}

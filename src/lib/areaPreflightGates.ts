// Gates pre-transición: validaciones que se aplican ANTES de una transición específica.
// Distinto al "close modal" (que es al cerrar el área); estos son gates intermedios.
//
// Ejemplos:
// - Copys: antes de pasar de MÉTRICAS a POR HACER SCRIPTS exige estrategia + análisis + excel.
// - Grab: antes de PRE-PRODUCCIÓN → AGENDA FILMACIÓN exige fecha tentativa,
//         y antes de AGENDA FILMACIÓN → FILMACIÓN exige fecha confirmada.

import type { UserArea } from './users'
import type { Cliente, ClienteCicloRecursos } from './supabase'

export type PreflightFieldSource = 'cliente' | 'cliente_ciclo_recursos'
export type PreflightFieldType = 'url' | 'date'

export type PreflightField = {
  source: PreflightFieldSource
  field: string
  label: string
  icon: string
  placeholder: string
  helper?: string
  /** Tipo de input. Default 'url'. */
  type?: PreflightFieldType
}

export type PreflightGate = {
  fromState: string
  toState: string
  title: string
  description: string
  fields: PreflightField[]
}

/** Múltiples gates por área (ordenados; sólo dispara el que matchea la transición). */
export const AREA_PREFLIGHT_GATES: Partial<Record<UserArea, PreflightGate[]>> = {
  copys: [
    {
      fromState: 'MÉTRICAS',
      toState: 'POR HACER SCRIPTS',
      title: 'Requisitos pre-guionización',
      description: 'Antes de empezar los scripts del ciclo, hace falta tener cargado:',
      fields: [
        {
          source: 'cliente',
          field: 'estrategia_url',
          label: 'Estrategia general del cliente',
          icon: '🧠',
          placeholder: 'Link al doc de estrategia (única, persiste entre ciclos)',
          helper: 'Se carga UNA VEZ por cliente. Si ya está, no la pedimos en próximos ciclos.',
        },
        {
          source: 'cliente_ciclo_recursos',
          field: 'analisis_metricas_url',
          label: 'Análisis de métricas previas',
          icon: '📊',
          placeholder: 'Link al análisis del ciclo anterior',
          helper: 'Específico de este ciclo — qué funcionó, qué replicar, qué cambiar.',
        },
        {
          source: 'cliente_ciclo_recursos',
          field: 'productos_excel_url',
          label: 'Excel de productos del loop',
          icon: '📦',
          placeholder: 'Link al excel con productos a comunicar este mes',
          helper: 'Específico de este ciclo.',
        },
      ],
    },
  ],
  grab: [
    {
      fromState: 'PRE-PRODUCCIÓN',
      toState: 'AGENDA FILMACIÓN',
      title: 'Agendar fecha tentativa',
      description: 'Para pasar a Agenda, dejá la fecha tentativa interna. Va a aparecer en el Calendario Grab.',
      fields: [
        {
          source: 'cliente_ciclo_recursos',
          field: 'fecha_grabacion_tentativa',
          label: 'Fecha tentativa de filmación',
          icon: '📅',
          placeholder: 'AAAA-MM-DD',
          helper: 'Propuesta interna del equipo. Aparece en el Calendario Grab.',
          type: 'date',
        },
      ],
    },
    {
      fromState: 'AGENDA FILMACIÓN',
      toState: 'FILMACIÓN',
      title: 'Confirmar fecha de filmación',
      description: 'El cliente confirmó. Cargá la fecha confirmada antes de marcar el batch en filmación.',
      fields: [
        {
          source: 'cliente_ciclo_recursos',
          field: 'fecha_grabacion_confirmada',
          label: 'Fecha confirmada por cliente',
          icon: '✅',
          placeholder: 'AAAA-MM-DD',
          helper: 'Confirmada por el cliente — la que va al Calendario como definitiva.',
          type: 'date',
        },
      ],
    },
  ],
}

function fieldValueOk(field: PreflightField, value: string | null | undefined): boolean {
  const v = (value ?? '').trim()
  if (!v) return false
  if (field.type === 'date') {
    // Acepta YYYY-MM-DD o ISO; cualquier string no vacío parseable cuenta.
    return !isNaN(new Date(v).getTime())
  }
  return v.startsWith('http://') || v.startsWith('https://')
}

/** Devuelve campos faltantes / inválidos para el gate de una transición */
export function missingPreflightFields(
  area: UserArea,
  fromState: string,
  toState: string,
  cliente: Cliente | null,
  recursos: ClienteCicloRecursos | null
): PreflightField[] {
  const gate = getPreflightGate(area, fromState, toState)
  if (!gate) return []
  return gate.fields.filter(f => {
    const v = f.source === 'cliente'
      ? (cliente as Record<string, unknown> | null)?.[f.field] as string | null | undefined
      : (recursos as Record<string, unknown> | null)?.[f.field] as string | null | undefined
    return !fieldValueOk(f, v)
  })
}

/** Devuelve el gate aplicable a una transición (si existe) */
export function getPreflightGate(area: UserArea, fromState: string, toState: string): PreflightGate | null {
  const gates = AREA_PREFLIGHT_GATES[area]
  if (!gates) return null
  return gates.find(g => g.fromState === fromState && g.toState === toState) ?? null
}

/** Helper exportado para validar un valor contra el tipo del campo */
export function isPreflightFieldValid(field: PreflightField, value: string | null | undefined): boolean {
  return fieldValueOk(field, value)
}

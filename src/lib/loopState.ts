// Loop state — el "estado" de un (cliente × ciclo).
// Mismo cliente puede tener mayo en SUBIDA y junio en GUIONES en paralelo.
//
// Storage: cliente_ciclo_recursos.estado_loop (manual override)
// Derivación: si manual no existe, computa el estado dominante de las piezas.

import { supabase, type Pieza, type PiezaTipo } from './supabase'
import { PIPELINE_BY_TIPO } from './piezas'
import { currentCicloMes } from './cycles'
import { AREA_DEFS } from './areaStates'
import type { UserArea } from './users'

// Estado de "aprobado" depende del área. Esta función centraliza la heurística.
function isApprovedValue(value: string | null | undefined): boolean {
  if (!value) return false
  const v = value.toUpperCase()
  return (
    v === 'APROBADO' ||
    v === 'APROBADO - SUBIDA A CLICKUP' ||
    v === 'PUBLICADO' ||
    v === 'METRICAS' || v === 'MÉTRICAS' ||
    v === 'METRICAS Y VOLVER A EMPEZAR' || v === 'VOLVER A EMPEZAR' ||
    v === 'MATERIAL APROBADO' || v === 'MATERIAL SUBIDO' ||
    v === 'LISTO PARA GRABAR'
  )
}

function colNameFor(area: UserArea): keyof Pieza {
  if (area === 'edit') return 'estado_edicion'
  return `estado_${area}` as keyof Pieza
}

/**
 * Estado dominante derivado de las piezas de un (cliente × ciclo).
 * Heurística:
 *   1. Priorizamos videos (son el deliverable principal).
 *   2. Recorremos el pipeline (copys → grab → edit → diseno → subida).
 *   3. Encontramos el primer área donde HAY piezas no-aprobadas.
 *   4. Dentro de esa área, devolvemos el estado más frecuente entre las piezas pendientes.
 *   5. Si todas las piezas están aprobadas en todas las áreas → 'COMPLETADO'.
 */
export function deriveEstadoLoop(piezas: Pieza[]): string | null {
  if (piezas.length === 0) return null

  // Priorizar videos
  const videos = piezas.filter(p => p.tipo === 'video')
  const target = videos.length > 0 ? videos : piezas
  // Pipeline del primer tipo encontrado (videos > otros)
  const tipo: PiezaTipo = target[0].tipo
  const pipeline = PIPELINE_BY_TIPO[tipo]

  for (const area of pipeline) {
    const col = colNameFor(area)
    const pendientes = target.filter(p => !isApprovedValue(p[col] as string | null))
    if (pendientes.length === 0) continue

    // Estado más frecuente entre las pendientes (excluyendo vacíos)
    const counts = new Map<string, number>()
    for (const p of pendientes) {
      const v = (p[col] as string | null) || ''
      if (!v) continue
      counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    if (counts.size === 0) {
      // Todas las pendientes están vacías → recién entrando al área
      // Devolvemos el primer estado canónico del área
      return defaultStartStateForArea(area)
    }
    let max = 0, dom = ''
    counts.forEach((c, k) => { if (c > max) { max = c; dom = k } })
    return dom
  }

  return 'COMPLETADO'
}

// Estados de inicio canónicos para cada área (para cuando piezas existen pero estado vacío).
// Fuente de verdad: AREA_DEFS — primer estado de cada area pipeline.
function defaultStartStateForArea(area: UserArea): string {
  return AREA_DEFS[area].states[0]?.label ?? ''
}

// =============== Per-cycle persistence ===============

/**
 * Lee los estados_loop de varios clientes para un ciclo dado en una sola query.
 * Devuelve Map<cliente_id, estado>.
 */
export async function bulkQueryEstadoLoop(
  agenciaId: string,
  cicloMes: string,
  clienteIds: number[]
): Promise<Map<number, string>> {
  const result = new Map<number, string>()
  if (clienteIds.length === 0) return result
  const { data, error } = await supabase
    .from('cliente_ciclo_recursos')
    .select('cliente_id, estado_loop')
    .eq('agencia_id', agenciaId)
    .eq('ciclo_mes', cicloMes)
    .in('cliente_id', clienteIds)
  if (error) return result
  for (const row of data ?? []) {
    if (row.estado_loop) result.set(row.cliente_id, row.estado_loop)
  }
  return result
}

/**
 * Set the manual estado_loop for a (cliente, ciclo) pair via upsert.
 * Si estado es null → borra el override (deja que se derive de piezas).
 *
 * Si el ciclo target ES el ciclo primario del cliente (cliente.ciclo_mes o currentCicloMes()),
 * también actualiza cliente.estado (legacy) y estado_log para que las vistas viejas (Edición
 * tracker, etc.) se queden sincronizadas. Cambios en ciclos distintos del primario solo
 * tocan estado_loop — no afectan al cliente.estado legacy.
 */
export async function setEstadoLoop(input: {
  agenciaId: string
  clienteId: number
  cicloMes: string
  estado: string | null
  changedBy?: string
}): Promise<{ ok: boolean; error?: string }> {
  // 1. Upsert recursos
  const { error } = await supabase
    .from('cliente_ciclo_recursos')
    .upsert({
      agencia_id: input.agenciaId,
      cliente_id: input.clienteId,
      ciclo_mes: input.cicloMes,
      estado_loop: input.estado,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'cliente_id,ciclo_mes' })
  if (error) return { ok: false, error: error.message }

  // 2. Si el ciclo es el primario del cliente, mirror a cliente.estado
  try {
    const { data: cliente } = await supabase
      .from('clientes').select('estado, ciclo_mes').eq('id', input.clienteId).single()
    if (cliente) {
      const primaryCycle = cliente.ciclo_mes || currentCicloMes()
      const isPrimary = input.cicloMes === primaryCycle
      // Siempre logueamos el cambio (con ciclo_mes) — para que el timeline
      // del ciclo no-primario también se registre.
      const newEstadoStr = input.estado || ''
      const oldEstado = isPrimary ? (cliente.estado || null) : null
      // Para non-primary cycles necesitamos buscar el último estado_log de ese ciclo
      // para saber el "anterior". Pero por simplicidad insertamos el log siempre con
      // estado_anterior=null si no es primario. La timeline reconstruye el orden por changed_at.
      if (!isPrimary && newEstadoStr) {
        await supabase.from('estado_log').insert({
          cliente_id: input.clienteId,
          estado_anterior: null,
          estado_nuevo: newEstadoStr,
          changed_at: new Date().toISOString(),
          changed_by: input.changedBy || 'sistema',
          ciclo_mes: input.cicloMes,
        })
      }
      if (isPrimary) {
        const newEstado = newEstadoStr
        if (oldEstado !== newEstado) {
          await Promise.all([
            supabase.from('clientes').update({
              estado: newEstado,
              estado_changed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).eq('id', input.clienteId),
            supabase.from('estado_log').insert({
              cliente_id: input.clienteId,
              estado_anterior: oldEstado,
              estado_nuevo: newEstado,
              changed_by: input.changedBy || 'sistema',
            }),
          ])
        }
      }
    }
  } catch (e) {
    console.warn('[setEstadoLoop] mirror a cliente.estado falló:', e)
  }

  return { ok: true }
}

/**
 * Estado a mostrar para una pareja (cliente, ciclo):
 *   1. Si hay estado_loop manual en recursos → usarlo
 *   2. Sino, derivar de piezas
 *   3. Sino, null (vacío)
 */
export function effectiveEstadoLoop(
  manualOverride: string | null | undefined,
  piezas: Pieza[]
): string | null {
  if (manualOverride && manualOverride.length > 0) return manualOverride
  return deriveEstadoLoop(piezas)
}

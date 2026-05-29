// Phase A — Helpers para gestión de piezas (deliverables) por cliente x ciclo.
// Tabla: sql/2026-05-08_phase_A_piezas.sql

import { supabase, type Cliente, type Pieza, type PiezaTipo, type ClienteCicloRecursos } from './supabase'
import type { UserArea } from './users'

/**
 * Pipeline de áreas que atraviesa cada tipo de pieza, en orden.
 * Refleja la regla: copys → grab → edit → diseno → subida → anuncios.
 * Carrousel / historia no van por grab ni edit (son contenido estático con copy).
 * Portada va sólo por diseno → subida (depende del video padre estar editado).
 * Todas terminan en 'anuncios' (cierre de ciclo: activación de ads + reporte).
 */
export const PIPELINE_BY_TIPO: Record<PiezaTipo, UserArea[]> = {
  video:     ['copys', 'grab', 'edit', 'diseno', 'subida', 'anuncios'],
  portada:   ['diseno', 'subida', 'anuncios'],
  carrousel: ['copys', 'diseno', 'subida', 'anuncios'],
  historia:  ['copys', 'diseno', 'subida', 'anuncios'],
}

export const PIEZA_META: Record<PiezaTipo, { label: string; emoji: string; color: string; plural: string }> = {
  video:     { label: 'Video',     emoji: '🎬', color: '#5e72e4', plural: 'Videos' },
  portada:   { label: 'Portada',   emoji: '🖼️', color: '#f5a623', plural: 'Portadas' },
  carrousel: { label: 'Carrousel', emoji: '🎠', color: '#8965e0', plural: 'Carrouseles' },
  historia:  { label: 'Historia',  emoji: '📱', color: '#ec4ad8', plural: 'Historias' },
}

export type PlanPiezas = {
  plan_videos: number
  plan_portadas: number
  plan_carrouseles: number
  plan_historias: number
}

const MIN_PLAN: PlanPiezas = {
  plan_videos: 15,
  plan_portadas: 15,
  plan_carrouseles: 4,
  plan_historias: 4,
}

export function planFromCliente(c: Cliente): PlanPiezas {
  return {
    plan_videos:      c.plan_videos      ?? MIN_PLAN.plan_videos,
    plan_portadas:    c.plan_portadas    ?? MIN_PLAN.plan_portadas,
    plan_carrouseles: c.plan_carrouseles ?? MIN_PLAN.plan_carrouseles,
    plan_historias:   c.plan_historias   ?? MIN_PLAN.plan_historias,
  }
}

export function totalPiezasFromPlan(p: PlanPiezas): number {
  return p.plan_videos + p.plan_portadas + p.plan_carrouseles + p.plan_historias
}

/**
 * Genera el batch mensual de piezas para un cliente y ciclo dado.
 * Si ya existen piezas para ese (cliente, ciclo, tipo), agrega sólo las que faltan
 * para llegar al plan (sin duplicar números).
 */
export async function generateBatch(input: {
  agenciaId: string
  cliente: Cliente
  cicloMes: string
  /** Si se omite, usa el plan del cliente */
  plan?: PlanPiezas
}): Promise<{ inserted: number; existing: number; error?: string }> {
  const plan = input.plan ?? planFromCliente(input.cliente)
  const { cliente, cicloMes, agenciaId } = input

  // Cuáles ya existen
  const { data: existing, error: e1 } = await supabase
    .from('piezas')
    .select('tipo, numero')
    .eq('cliente_id', cliente.id)
    .eq('ciclo_mes', cicloMes)
  if (e1) return { inserted: 0, existing: 0, error: e1.message }

  const existsByTipo = new Map<PiezaTipo, Set<number>>()
  for (const r of existing ?? []) {
    const t = r.tipo as PiezaTipo
    if (!existsByTipo.has(t)) existsByTipo.set(t, new Set())
    existsByTipo.get(t)!.add(r.numero)
  }

  const targetCounts: Record<PiezaTipo, number> = {
    video:     plan.plan_videos,
    portada:   plan.plan_portadas,
    carrousel: plan.plan_carrouseles,
    historia:  plan.plan_historias,
  }

  const toInsert: Partial<Pieza>[] = []
  for (const tipo of ['video', 'portada', 'carrousel', 'historia'] as PiezaTipo[]) {
    const have = existsByTipo.get(tipo) ?? new Set()
    const target = targetCounts[tipo]
    for (let n = 1; n <= target; n++) {
      if (have.has(n)) continue
      toInsert.push({
        agencia_id: agenciaId,
        cliente_id: cliente.id,
        tipo,
        ciclo_mes: cicloMes,
        numero: n,
        // copywriter / editor / diseñador heredados del cliente como default
        copywriter_id: cliente.copy_id ?? null,
        editor_id: cliente.editor_id ?? null,
        disenador_id: cliente.disenador_id ?? null,
      })
    }
  }

  let existingCount = 0
  existsByTipo.forEach(set => { existingCount += set.size })

  if (toInsert.length === 0) {
    return { inserted: 0, existing: existingCount }
  }

  const { error: e2 } = await supabase.from('piezas').insert(toInsert)
  if (e2) return { inserted: 0, existing: existingCount, error: e2.message }

  return { inserted: toInsert.length, existing: existingCount }
}

export async function queryPiezasByCliente(
  clienteId: number,
  cicloMes?: string
): Promise<Pieza[]> {
  let q = supabase.from('piezas').select('*').eq('cliente_id', clienteId)
  if (cicloMes) q = q.eq('ciclo_mes', cicloMes)
  q = q.order('tipo').order('numero')
  const { data, error } = await q
  if (error) {
    if (error.message?.toLowerCase().includes('does not exist') || error.code === '42P01' || error.code === 'PGRST205') {
      console.warn('[piezas] tabla no existe — correr sql/2026-05-08_phase_A_piezas.sql')
      return []
    }
    console.error('[piezas] query error:', error)
    return []
  }
  return (data ?? []) as Pieza[]
}

export type PiezaSummary = {
  totalPiezas: number
  porTipo: Record<PiezaTipo, { total: number; aprobadas: number; enProgreso: number; pendientes: number }>
}

/** Devuelve resumen agregado de un set de piezas. */
export function summarizePiezas(piezas: Pieza[]): PiezaSummary {
  const init = (): PiezaSummary['porTipo'][PiezaTipo] => ({ total: 0, aprobadas: 0, enProgreso: 0, pendientes: 0 })
  const summary: PiezaSummary = {
    totalPiezas: piezas.length,
    porTipo: { video: init(), portada: init(), carrousel: init(), historia: init() },
  }
  for (const p of piezas) {
    const bucket = summary.porTipo[p.tipo]
    bucket.total++
    const lastArea = PIPELINE_BY_TIPO[p.tipo].at(-1) ?? 'subida'
    const lastEstado = (p as Record<string, unknown>)[`estado_${lastArea === 'edit' ? 'edicion' : lastArea}`] as string | null
    const isAprobado = lastEstado === 'APROBADO' || lastEstado === 'PUBLICADO' || lastEstado === 'VOLVER A EMPEZAR' || lastEstado === 'METRICAS Y VOLVER A EMPEZAR' || lastEstado === 'MÉTRICAS Y VOLVER A EMPEZAR'
    const hasAnyState = PIPELINE_BY_TIPO[p.tipo].some(area => {
      const col = `estado_${area === 'edit' ? 'edicion' : area}`
      const v = (p as Record<string, unknown>)[col] as string | null
      return v && v.length > 0
    })
    if (isAprobado) bucket.aprobadas++
    else if (hasAnyState) bucket.enProgreso++
    else bucket.pendientes++
  }
  return summary
}

// =================== Cadencia de publicación ===================

/** Cadencia default por tipo de pieza (días entre cada publicación).
 *  La CM puede confirmar/ajustar manualmente al cerrar Subida.
 *  Portada no aplica (es thumb del video, no se publica como ítem propio). */
export const CADENCIA_DIAS_DEFAULT: Record<PiezaTipo, number | null> = {
  video:     2,
  carrousel: 7,
  historia:  7,
  portada:   null,
}

/** Convierte 'junio-2026' → Date del 1° de junio. Default si null. */
export function primerDiaDelCiclo(cicloMes: string): Date {
  const [mesNombre, anioStr] = cicloMes.split('-')
  const meses: Record<string, number> = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
  }
  const m = meses[mesNombre?.toLowerCase()]
  const y = Number(anioStr)
  if (m === undefined || isNaN(y)) return new Date()
  return new Date(y, m, 1)
}

/** Estima la fecha del último contenido subido del batch en base al plan y la cadencia default.
 *  Para cada tipo activo, calcula (cantidad - 1) * cadencia días desde fechaInicio.
 *  Retorna la fecha más lejana (todos los tipos se publican en paralelo). */
export function calcularFechaUltimoContenidoEstimada(plan: PlanPiezas, fechaInicio: Date): Date | null {
  const dias = [
    plan.plan_videos > 0      ? (plan.plan_videos      - 1) * (CADENCIA_DIAS_DEFAULT.video     ?? 0) : -1,
    plan.plan_carrouseles > 0 ? (plan.plan_carrouseles - 1) * (CADENCIA_DIAS_DEFAULT.carrousel ?? 0) : -1,
    plan.plan_historias > 0   ? (plan.plan_historias   - 1) * (CADENCIA_DIAS_DEFAULT.historia  ?? 0) : -1,
  ].filter(d => d >= 0)
  if (dias.length === 0) return null
  const maxDias = Math.max(...dias)
  const r = new Date(fechaInicio)
  r.setDate(r.getDate() + maxDias)
  return r
}

// =================== Tiempo en estado ===================

/** Días que el batch lleva en su estado actual.
 *  Proxy: max(estado_changed_at) de sus piezas. Si null para todas, devuelve null. */
export function diasEnEstadoBatch(piezas: Pieza[]): number | null {
  if (piezas.length === 0) return null
  let lastChangeMs = 0
  for (const p of piezas) {
    if (!p.estado_changed_at) continue
    const t = new Date(p.estado_changed_at).getTime()
    if (t > lastChangeMs) lastChangeMs = t
  }
  if (lastChangeMs === 0) return null
  return Math.max(0, Math.floor((Date.now() - lastChangeMs) / 86400000))
}

/** Color para badge "hace Xd": gris <=1, azul 2, amarillo 3-5, rojo 6+. */
export function colorPorDiasEnEstado(d: number): { bg: string; border: string; color: string } {
  if (d <= 1) return { bg: 'rgba(106,106,128,.10)', border: 'rgba(106,106,128,.30)', color: '#a0a0b8' }
  if (d <= 2) return { bg: 'rgba(94,114,228,.10)',  border: 'rgba(94,114,228,.30)',  color: '#5e72e4' }
  if (d <= 5) return { bg: 'rgba(245,166,35,.10)',  border: 'rgba(245,166,35,.30)',  color: '#f5a623' }
  return         { bg: 'rgba(245,54,92,.10)',   border: 'rgba(245,54,92,.30)',   color: '#f5365c' }
}

// =================== Atraso predictivo en Copys ===================

/** Días entre la fecha de grabación y la última publicación del ciclo.
 *  Asumimos 14d: grabación + edit + diseño + subida + buffer.
 *  Editable globalmente si la agencia trabaja con otros tiempos. */
export const LEAD_GRABACION_A_PUBLICACION_DIAS = 14

/** Días que el copy debería estar listo ANTES de la grabación.
 *  Por SLA de la agencia, scripts se hacen 3 semanas antes de la próxima
 *  grabación prevista — aunque no haya fecha tentativa ni confirmada. */
export const ANTICIPACION_COPYS_DIAS = 21

/** Calcula la próxima fecha de grabación prevista con fallbacks:
 *  1. fecha_grabacion_confirmada (la verdadera, ya pactada).
 *  2. fecha_grabacion_tentativa (propuesta interna del equipo).
 *  3. fecha_ultimo_contenido_subido − LEAD_GRABACION_A_PUBLICACION_DIAS
 *     (estimada — si tenemos contenido hasta el 30/06, grabamos 14d antes).
 *  4. null si no hay datos suficientes. */
export function fechaGrabacionPrevista(
  fechaGrabConfirmada: string | null | undefined,
  fechaGrabTentativa: string | null | undefined,
  fechaUltimoContenido: Date | null,
): Date | null {
  if (fechaGrabConfirmada) {
    const d = new Date(fechaGrabConfirmada)
    if (!isNaN(d.getTime())) return d
  }
  if (fechaGrabTentativa) {
    const d = new Date(fechaGrabTentativa)
    if (!isNaN(d.getTime())) return d
  }
  if (fechaUltimoContenido) {
    const d = new Date(fechaUltimoContenido)
    d.setDate(d.getDate() - LEAD_GRABACION_A_PUBLICACION_DIAS)
    return d
  }
  return null
}

/** Días de atraso de copys: cuántos días pasaron desde que debería haber estado
 *  el script listo (próxima grabación − 21d). 0 = a tiempo. >0 = atrasado. */
export function diasAtrasoCopys(fechaGrabacion: Date | null): number {
  if (!fechaGrabacion) return 0
  const limite = new Date(fechaGrabacion)
  limite.setDate(limite.getDate() - ANTICIPACION_COPYS_DIAS)
  limite.setHours(0, 0, 0, 0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const dias = Math.floor((now.getTime() - limite.getTime()) / 86400000)
  return Math.max(0, dias)
}

// =================== Estado del loop / batch ===================

/** Una pieza está "terminada" si su última área del pipeline está aprobada.
 *  ⚠ NO incluir 'MÉTRICAS' solo: es el inicio del flujo de Copys, no el final.
 *  Sí 'METRICAS Y VOLVER A EMPEZAR' (cierre completo) y 'VOLVER A EMPEZAR'. */
export function isPiezaTerminada(p: Pieza): boolean {
  const lastArea = PIPELINE_BY_TIPO[p.tipo].at(-1) ?? 'subida'
  const col = `estado_${lastArea === 'edit' ? 'edicion' : lastArea}`
  const v = (p as Record<string, unknown>)[col] as string | null
  if (!v) return false
  const u = v.toUpperCase()
  return u === 'APROBADO' || u === 'APROBADO - SUBIDA A CLICKUP' ||
    u === 'PUBLICADO' ||
    u === 'VOLVER A EMPEZAR' || u === 'METRICAS Y VOLVER A EMPEZAR' || u === 'MÉTRICAS Y VOLVER A EMPEZAR'
}

/** Loop (cliente × ciclo) está completado si tiene piezas y TODAS están terminadas. */
export function loopEstaCompletado(piezasDelLoop: Pieza[]): boolean {
  if (piezasDelLoop.length === 0) return false
  return piezasDelLoop.every(isPiezaTerminada)
}

/** Agrupa piezas por `${cliente_id}::${ciclo_mes}` para chequeos rápidos por loop. */
export function indexPiezasByLoop(piezas: Pieza[]): Map<string, Pieza[]> {
  const m = new Map<string, Pieza[]>()
  for (const p of piezas) {
    const k = `${p.cliente_id}::${p.ciclo_mes}`
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(p)
  }
  return m
}

// =================== Recursos del ciclo (links consolidados) ===================

/** Lee los recursos de un cliente para un ciclo dado. Si no existen, devuelve null. */
export async function queryRecursosCiclo(
  clienteId: number,
  cicloMes: string
): Promise<ClienteCicloRecursos | null> {
  const { data, error } = await supabase
    .from('cliente_ciclo_recursos')
    .select('*')
    .eq('cliente_id', clienteId)
    .eq('ciclo_mes', cicloMes)
    .maybeSingle()
  if (error) {
    if (error.message?.toLowerCase().includes('does not exist') || error.code === '42P01' || error.code === 'PGRST205') {
      return null
    }
    console.error('[recursos] error:', error)
    return null
  }
  return (data as ClienteCicloRecursos) ?? null
}

/** Crea o actualiza los recursos de un cliente x ciclo. */
export async function upsertRecursosCiclo(input: {
  agenciaId: string
  clienteId: number
  cicloMes: string
  data: Partial<ClienteCicloRecursos>
}): Promise<{ ok: boolean; error?: string }> {
  const payload = {
    agencia_id: input.agenciaId,
    cliente_id: input.clienteId,
    ciclo_mes: input.cicloMes,
    ...input.data,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase
    .from('cliente_ciclo_recursos')
    .upsert(payload, { onConflict: 'cliente_id,ciclo_mes' })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// Mapping de "qué link aplica a qué tipo" para mostrar el link correcto en cada pieza
export const TIPO_TO_DRIVE_FIELD: Record<PiezaTipo, keyof ClienteCicloRecursos> = {
  video:     'drive_videos_editados_url',
  portada:   'drive_portadas_url',
  carrousel: 'drive_carrouseles_url',
  historia:  'drive_historias_url',
}

/** Para una pieza, devuelve el área activa (la primera del pipeline que NO esté aprobada). */
export function activeAreaOf(pieza: Pieza): UserArea | null {
  const pipeline = PIPELINE_BY_TIPO[pieza.tipo]
  for (const area of pipeline) {
    const col = `estado_${area === 'edit' ? 'edicion' : area}`
    const v = (pieza as Record<string, unknown>)[col] as string | null
    const isApproved = v === 'APROBADO' || v === 'PUBLICADO' || v === 'VOLVER A EMPEZAR' || v === 'METRICAS Y VOLVER A EMPEZAR' || v === 'MÉTRICAS Y VOLVER A EMPEZAR' || v === 'MATERIAL APROBADO' || v === 'MATERIAL SUBIDO' || v === 'LISTO PARA GRABAR'
    if (!isApproved) return area
  }
  return null
}

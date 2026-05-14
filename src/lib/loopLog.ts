// Loop Log — persistencia de correcciones (quilombo histórico).
// Por convención: un loop = retroceso ≥1 etapa por corrección, ya sea por error
// interno, cambio del cliente, o aprobación del owner.
// Tabla creada en sql/2026-05-07_phase_2_loop_log.sql.

import { supabase, type LoopLog, type LoopSeccion, type LoopReasonCategory } from './supabase'

export type LogLoopInput = {
  agenciaId: string
  clienteId: number | null
  seccion: LoopSeccion
  fromState?: string | null
  toState?: string | null
  stagesBack?: number
  cicloMes?: string | null
  costUSD?: number
  hourlyRate?: number | null
  stageHours?: number | null
  responsable?: string | null
  responsableId?: string | null
  reason?: string | null
  reasonCategory?: LoopReasonCategory | null
  loggedBy?: string | null
}

export type LoopQueryFilter = {
  agenciaId: string
  cicloMes?: string
  responsable?: string
  clienteId?: number
  seccion?: LoopSeccion
  /** ISO date — incluye loops a partir de esta fecha */
  since?: string
}

export type LoopSummary = {
  totalCount: number
  totalCostUSD: number
  bySection: Record<string, { count: number; cost: number }>
  byClient: Record<number, { count: number; cost: number }>
  byResponsable: Record<string, { count: number; cost: number }>
  byCycle: Record<string, { count: number; cost: number }>
}

const DEFAULT_HOURLY_RATE = 1.88
const DEFAULT_STAGE_HOURS: Record<LoopSeccion, number> = {
  copys: 2,
  grab: 4,
  edit: 4,
  diseno: 3,
  subida: 1,
  anuncios: 2,
}

export function calcLoopCost(input: {
  seccion: LoopSeccion
  stagesBack: number
  hourlyRate?: number | null
  stageHours?: number | null
}): number {
  const rate = input.hourlyRate ?? DEFAULT_HOURLY_RATE
  const hours = input.stageHours ?? DEFAULT_STAGE_HOURS[input.seccion]
  return Math.round(rate * hours * Math.max(1, input.stagesBack) * 100) / 100
}

/** Convención: ciclo_mes = mes de producción (no calendario). v1: usamos calendario. */
export function currentCicloMes(): string {
  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  const d = new Date()
  return `${months[d.getMonth()]}-${d.getFullYear()}`
}

/** Persiste un loop. Devuelve { ok, id?, error? }. */
export async function logLoop(input: LogLoopInput): Promise<{ ok: boolean; id?: number; error?: string }> {
  const stagesBack = input.stagesBack ?? 1
  const costUSD = input.costUSD ?? calcLoopCost({
    seccion: input.seccion,
    stagesBack,
    hourlyRate: input.hourlyRate,
    stageHours: input.stageHours,
  })

  const row = {
    agencia_id: input.agenciaId,
    cliente_id: input.clienteId,
    seccion: input.seccion,
    from_state: input.fromState ?? null,
    to_state: input.toState ?? null,
    stages_back: stagesBack,
    ciclo_mes: input.cicloMes ?? currentCicloMes(),
    cost_usd: costUSD,
    hourly_rate: input.hourlyRate ?? DEFAULT_HOURLY_RATE,
    stage_hours: input.stageHours ?? DEFAULT_STAGE_HOURS[input.seccion],
    responsable: input.responsable ?? null,
    responsable_id: input.responsableId ?? null,
    reason: input.reason ?? null,
    reason_category: input.reasonCategory ?? null,
    logged_by: input.loggedBy ?? null,
  }

  const { data, error } = await supabase
    .from('loop_log')
    .insert(row)
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, id: data?.id }
}

/** Lee loops según filtro. Devuelve [] silenciosamente si la tabla no existe. */
export async function queryLoops(filter: LoopQueryFilter): Promise<LoopLog[]> {
  let q = supabase.from('loop_log').select('*').eq('agencia_id', filter.agenciaId)
  if (filter.cicloMes) q = q.eq('ciclo_mes', filter.cicloMes)
  if (filter.responsable) q = q.eq('responsable', filter.responsable)
  if (filter.clienteId) q = q.eq('cliente_id', filter.clienteId)
  if (filter.seccion) q = q.eq('seccion', filter.seccion)
  if (filter.since) q = q.gte('date', filter.since)
  q = q.order('date', { ascending: false })
  const { data, error } = await q
  if (error) {
    // Tabla no existe (relation does not exist) o RLS bloqueante → degradar a vacío
    if (error.message?.toLowerCase().includes('does not exist') ||
        error.code === '42P01' ||
        error.code === 'PGRST205') {
      console.warn('[loopLog] loop_log table missing — run sql/2026-05-07_phase_2_loop_log.sql')
      return []
    }
    console.error('[loopLog] query error:', error)
    return []
  }
  return (data ?? []) as LoopLog[]
}

/** Agrega métricas a partir de un set de loops. */
export function summarizeLoops(loops: LoopLog[]): LoopSummary {
  const summary: LoopSummary = {
    totalCount: loops.length,
    totalCostUSD: 0,
    bySection: {},
    byClient: {},
    byResponsable: {},
    byCycle: {},
  }
  for (const l of loops) {
    summary.totalCostUSD += l.cost_usd ?? 0
    // Section
    summary.bySection[l.seccion] ??= { count: 0, cost: 0 }
    summary.bySection[l.seccion].count++
    summary.bySection[l.seccion].cost += l.cost_usd ?? 0
    // Client
    if (l.cliente_id != null) {
      summary.byClient[l.cliente_id] ??= { count: 0, cost: 0 }
      summary.byClient[l.cliente_id].count++
      summary.byClient[l.cliente_id].cost += l.cost_usd ?? 0
    }
    // Responsable
    const resp = l.responsable ?? '—'
    summary.byResponsable[resp] ??= { count: 0, cost: 0 }
    summary.byResponsable[resp].count++
    summary.byResponsable[resp].cost += l.cost_usd ?? 0
    // Cycle
    const cycle = l.ciclo_mes ?? '—'
    summary.byCycle[cycle] ??= { count: 0, cost: 0 }
    summary.byCycle[cycle].count++
    summary.byCycle[cycle].cost += l.cost_usd ?? 0
  }
  summary.totalCostUSD = Math.round(summary.totalCostUSD * 100) / 100
  return summary
}

export const SECCION_LABELS: Record<LoopSeccion, { label: string; icon: string; color: string }> = {
  copys:    { label: 'Copys',    icon: '✍️', color: '#5e72e4' },
  grab:     { label: 'Grab',     icon: '🎥', color: '#f5a623' },
  edit:     { label: 'Edit',     icon: '✂️', color: '#fb6340' },
  diseno:   { label: 'Diseño',   icon: '🎨', color: '#f5365c' },
  subida:   { label: 'Subida',   icon: '🚀', color: '#00d97e' },
  anuncios: { label: 'Reportes', icon: '📊', color: '#f5a623' },
}

export const REASON_CATEGORY_LABELS: Record<LoopReasonCategory, string> = {
  cliente_cambio_idea: 'Cliente cambió de idea',
  error_interno:       'Error interno',
  aprobacion_owner:    'Owner pidió cambio',
  otro:                'Otro',
}

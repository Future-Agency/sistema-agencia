// Quilombo Score — Criterios derivados del Cliente row para v1.
// v2 lo reemplazaremos con una tabla `quilombo_criteria` editable por admin.
// Función pura: 0-100, con breakdown para que la UI muestre el desglose.

import type { Cliente } from './supabase'

export type QuilomboBreakdown = {
  riesgo: number
  semaforo: number
  deadline: number
  estancado: number
  correccion: number
  onboarding: number
}

export type QuilomboResult = {
  score: number
  breakdown: QuilomboBreakdown
  tier: 'critico' | 'alto' | 'medio' | 'bajo' | 'ok'
  daysToHito: number | null
  daysSinceChange: number | null
}

const RIESGO_POINTS: Record<string, number> = {
  muy_alto: 25,
  alto: 18,
  medio: 10,
  bajo: 4,
  no: 0,
}

const SEMAFORO_POINTS: Record<string, number> = {
  red: 20,
  yellow: 10,
  green: 0,
  blue: 0,
}

// Estados que indican que el cliente está en un loop (correccion, retrabajo)
const ESTADOS_CORRECCION = new Set([
  'CORRECION',
  'CORRECION GUIONES',
  'REVISION GUIONES',
  'REVISION CLIENTE',
  'REVISION INTERNA',
])

function diffInDays(target: Date, ref: Date = new Date()): number {
  const ms = target.getTime() - ref.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function deadlineScore(daysToHito: number | null): number {
  if (daysToHito == null) return 0
  // Vencido = 25 (peor). Más vencido = más quilombo.
  if (daysToHito < 0) return Math.min(25, 20 + Math.abs(daysToHito) * 0.5)
  if (daysToHito <= 3) return 15
  if (daysToHito <= 7) return 10
  if (daysToHito <= 14) return 5
  return 0
}

function estancadoScore(daysSinceChange: number | null): number {
  if (daysSinceChange == null) return 0
  if (daysSinceChange > 14) return 15
  if (daysSinceChange > 7) return 8
  if (daysSinceChange > 3) return 3
  return 0
}

export function quilomboScore(c: Cliente, today: Date = new Date()): QuilomboResult {
  const hito = c.proximo_hito ? new Date(c.proximo_hito) : null
  const daysToHito = hito && !isNaN(hito.getTime()) ? diffInDays(hito, today) : null

  const lastChange = c.estado_changed_at ? new Date(c.estado_changed_at) : null
  const daysSinceChange = lastChange && !isNaN(lastChange.getTime())
    ? Math.max(0, -diffInDays(lastChange, today))
    : null

  const breakdown: QuilomboBreakdown = {
    riesgo: RIESGO_POINTS[c.riesgo_nivel ?? 'no'] ?? 0,
    semaforo: SEMAFORO_POINTS[c.semaforo_general] ?? 0,
    deadline: deadlineScore(daysToHito),
    estancado: estancadoScore(daysSinceChange),
    correccion: ESTADOS_CORRECCION.has(c.estado) ? 10 : 0,
    onboarding: c.is_onboarding ? 5 : 0,
  }

  const raw = breakdown.riesgo + breakdown.semaforo + breakdown.deadline +
              breakdown.estancado + breakdown.correccion + breakdown.onboarding
  const score = Math.min(100, Math.round(raw))

  let tier: QuilomboResult['tier'] = 'ok'
  if (score >= 70) tier = 'critico'
  else if (score >= 50) tier = 'alto'
  else if (score >= 30) tier = 'medio'
  else if (score >= 15) tier = 'bajo'

  return { score, breakdown, tier, daysToHito, daysSinceChange }
}

export const TIER_COLORS: Record<QuilomboResult['tier'], { color: string; bg: string; label: string }> = {
  critico: { color: '#f5365c', bg: 'rgba(245,54,92,.15)', label: 'Crítico' },
  alto:    { color: '#f5a623', bg: 'rgba(245,166,35,.15)', label: 'Alto' },
  medio:   { color: '#f5d623', bg: 'rgba(245,214,35,.12)', label: 'Medio' },
  bajo:    { color: '#5e72e4', bg: 'rgba(94,114,228,.12)', label: 'Bajo' },
  ok:      { color: '#00d97e', bg: 'rgba(0,217,126,.12)', label: 'OK' },
}

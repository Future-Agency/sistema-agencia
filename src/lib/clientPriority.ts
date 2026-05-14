// Client Priority — Score numérico para ordenar clientes por urgencia operativa.
// Wrap sobre quilomboScore; permite agregar weights persistidos en v2 sin tocar consumers.

import type { Cliente } from './supabase'
import { quilomboScore, type QuilomboResult } from './quilomboScore'

export type ClientPriority = {
  cliente: Cliente
  score: number          // 0-100 ya combinado, listo para sort desc
  quilombo: QuilomboResult
  weight: number         // multiplicador (v1 = 1.0, v2 leerá de cliente_priority_weights)
}

/**
 * Devuelve los clientes ordenados por prioridad operativa descendente.
 * v1: weight = 1.0 para todos. v2: leer de cliente_priority_weights por agencia_id.
 */
export function rankClientesByPriority(clientes: Cliente[], today: Date = new Date()): ClientPriority[] {
  return clientes
    .map(cliente => {
      const quilombo = quilomboScore(cliente, today)
      const weight = 1.0 // placeholder — futuro: lookup por cliente_id
      const score = Math.min(100, Math.round(quilombo.score * weight))
      return { cliente, score, quilombo, weight }
    })
    .sort((a, b) => b.score - a.score)
}

/**
 * Agrupa los rankings en buckets por tier. Útil para dashboards.
 */
export function bucketByTier(rankings: ClientPriority[]) {
  const buckets: Record<QuilomboResult['tier'], ClientPriority[]> = {
    critico: [], alto: [], medio: [], bajo: [], ok: [],
  }
  for (const r of rankings) buckets[r.quilombo.tier].push(r)
  return buckets
}

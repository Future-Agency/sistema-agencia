// Ciclos de producción (mes producción ≠ mes calendario)
// Convención: "mayo-2026" = lo que se sube en mayo 2026.

import type { Cliente } from './supabase'

export const MONTH_NAMES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export type CicloMes = string // 'mayo-2026'

export function currentCicloMes(d: Date = new Date()): CicloMes {
  return `${MONTH_NAMES_ES[d.getMonth()]}-${d.getFullYear()}`
}

export function nextCicloMes(current: CicloMes): CicloMes {
  const parsed = parseCicloMes(current)
  if (!parsed) return currentCicloMes()
  let m = parsed.monthIndex + 1
  let y = parsed.year
  if (m > 11) { m = 0; y++ }
  return `${MONTH_NAMES_ES[m]}-${y}`
}

export function prevCicloMes(current: CicloMes): CicloMes {
  const parsed = parseCicloMes(current)
  if (!parsed) return currentCicloMes()
  let m = parsed.monthIndex - 1
  let y = parsed.year
  if (m < 0) { m = 11; y-- }
  return `${MONTH_NAMES_ES[m]}-${y}`
}

export function parseCicloMes(c: CicloMes): { monthIndex: number; year: number; label: string } | null {
  if (!c) return null
  const parts = c.split('-')
  if (parts.length !== 2) return null
  const monthName = parts[0].toLowerCase()
  const year = parseInt(parts[1], 10)
  const monthIndex = MONTH_NAMES_ES.indexOf(monthName)
  if (monthIndex < 0 || isNaN(year)) return null
  return { monthIndex, year, label: `${monthName} ${year}` }
}

export function cicloMesLabel(c: CicloMes | null | undefined): string {
  if (!c) return 'Sin ciclo'
  const p = parseCicloMes(c)
  return p ? p.label : c
}

/** Lista de ciclos únicos en una colección de clientes, ordenados desc por fecha */
export function listCyclesInUse(clientes: Cliente[]): CicloMes[] {
  const set = new Set<CicloMes>()
  clientes.forEach(c => {
    if (c.ciclo_mes) set.add(c.ciclo_mes)
  })
  // ordenar por timestamp resultante de parseCicloMes
  return Array.from(set).sort((a, b) => {
    const pa = parseCicloMes(a)
    const pb = parseCicloMes(b)
    if (!pa || !pb) return 0
    return (pb.year * 12 + pb.monthIndex) - (pa.year * 12 + pa.monthIndex)
  })
}

export function comparteCiclo(cliente: Cliente, ciclo: CicloMes | null): boolean {
  if (!ciclo) return true
  // Si el cliente no tiene ciclo asignado, lo consideramos del ciclo actual
  if (!cliente.ciclo_mes) return ciclo === currentCicloMes()
  return cliente.ciclo_mes === ciclo
}

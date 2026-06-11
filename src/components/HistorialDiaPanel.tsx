'use client'
import { useMemo } from 'react'
import type { Cliente, Equipo, EstadoLog, Owner } from '@/lib/supabase'
import type { UserArea } from '@/lib/users'
import { AREA_DEFS } from '@/lib/areaStates'

const AREA_COLOR: Record<UserArea, string> = {
  copys: '#5e72e4', grab: '#f5a623', edit: '#fb6340',
  diseno: '#ec4ad8', subida: '#00d97e', anuncios: '#11cdef',
}

function areaFromEstado(estado: string): UserArea | null {
  const upper = (estado || '').toUpperCase()
  const areas: UserArea[] = ['copys', 'grab', 'edit', 'diseno', 'subida', 'anuncios']
  for (const a of areas) {
    if (AREA_DEFS[a].states.some(s => s.label.toUpperCase() === upper)) return a
  }
  return null
}

type Props = {
  logs: EstadoLog[]
  loading: boolean
  clienteById: Map<number, Cliente>
  equipo: Equipo[]
  owners: Owner[]
  filtroMiembro: string
}

export default function HistorialDiaPanel({ logs, loading, clienteById, equipo, owners, filtroMiembro }: Props) {
  const filteredLogs = useMemo(() => {
    if (!filtroMiembro) return logs
    if (filtroMiembro.startsWith('owner:')) {
      const oid = filtroMiembro.slice(6)
      const o = owners.find(x => x.id === oid)
      if (!o) return []
      return logs.filter(l => l.changed_by?.toLowerCase().includes(o.nombre.toLowerCase()))
    }
    const e = equipo.find(x => x.id === filtroMiembro)
    if (!e) return []
    return logs.filter(l => l.changed_by?.toLowerCase().includes(e.nombre.toLowerCase()))
  }, [logs, filtroMiembro, equipo, owners])

  const grupos = useMemo(() => {
    const m = new Map<string, EstadoLog[]>()
    for (const l of filteredLogs) {
      const k = l.changed_by ?? '(sistema)'
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(l)
    }
    const arr: Array<[string, EstadoLog[]]> = []
    m.forEach((v, k) => arr.push([k, v]))
    arr.sort((a, b) => b[1].length - a[1].length)
    return arr
  }, [filteredLogs])

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#6a6a80', fontSize: 12 }}>Cargando historial…</div>
  }
  if (filteredLogs.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#6a6a80' }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
        <p style={{ fontSize: 13 }}>Sin actividad registrada ese día con los filtros actuales.</p>
        <p style={{ fontSize: 11, marginTop: 4 }}>Los movimientos viejos pueden no estar loggeados — los registros con autor real empezaron a guardarse desde hoy.</p>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {grupos.map(([user, list]) => (
        <div key={user} style={{
          background: '#1a1a28', border: '1px solid #2a2a40',
          borderRadius: 10, padding: '12px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: '#5e72e4',
              color: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 13,
            }}>{user[0]?.toUpperCase()}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{user}</div>
              <div style={{ fontSize: 10, color: '#6a6a80' }}>{list.length} movimiento{list.length === 1 ? '' : 's'} ese día</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {list.slice(0, 50).map(l => {
              const c = clienteById.get(l.cliente_id)
              const area = areaFromEstado(l.estado_nuevo) || areaFromEstado(l.estado_anterior)
              const hora = new Date(l.changed_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
              const areaChip = area ? (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                  background: `${AREA_COLOR[area]}22`, color: AREA_COLOR[area],
                  textTransform: 'uppercase',
                }}>{area}</span>
              ) : null
              return (
                <div key={l.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: 5,
                  background: '#0f0f15', fontSize: 11,
                }}>
                  <span style={{ color: '#6a6a80', fontFamily: 'monospace', minWidth: 38 }}>{hora}</span>
                  {areaChip}
                  <span style={{ fontWeight: 700, flex: 1 }}>{c?.nombre ?? `#${l.cliente_id}`}</span>
                  <span style={{ color: '#6a6a80' }}>{l.estado_anterior || '—'} → <strong style={{ color: '#e8e8f0' }}>{l.estado_nuevo}</strong></span>
                </div>
              )
            })}
            {list.length > 50 && (
              <div style={{ fontSize: 10, color: '#6a6a80', textAlign: 'center' }}>+ {list.length - 50} movimientos más</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

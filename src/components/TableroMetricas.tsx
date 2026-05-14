'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase, type Cliente, type Owner, type EstadoLog } from '@/lib/supabase'
import { SemaforoIcon } from './ui'
import { getEstadoStyle, ESTADO_OPTIONS_ONGOING } from '@/lib/estados'

type Props = { clientes: Cliente[]; owners: Owner[] }
type Period = 'week' | 'month' | 'all'

function daysAgo(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
}

function periodStart(period: Period): Date {
  const d = new Date()
  if (period === 'week') { d.setDate(d.getDate() - 7) }
  else if (period === 'month') { d.setMonth(d.getMonth() - 1) }
  else { d.setFullYear(2020) }
  return d
}

export default function TableroMetricas({ clientes, owners }: Props) {
  const [logs, setLogs] = useState<EstadoLog[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('month')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('estado_log').select('*').order('changed_at', { ascending: true })
      if (data) setLogs(data)
      setLoading(false)
    }
    load()
  }, [])

  const filteredLogs = useMemo(() => {
    const start = periodStart(period)
    return logs.filter(l => new Date(l.changed_at) >= start)
  }, [logs, period])

  // Clients with estado_changed_at showing days stale
  const staleClients = useMemo(() => {
    return clientes
      .filter(c => c.estado_changed_at && !c.is_onboarding)
      .map(c => ({ ...c, days: daysAgo(c.estado_changed_at!) }))
      .filter(c => c.days >= 5)
      .sort((a, b) => b.days - a.days)
  }, [clientes])

  // Throughput: clients that restarted a cycle (estado_nuevo = 'GUIONES' after being in anuncios/metricas)
  const throughput = useMemo(() => {
    const restarts = filteredLogs.filter(l =>
      l.estado_nuevo === 'GUIONES' && l.estado_anterior &&
      ['METRICAS Y VOLVER A EMPEZAR', 'VOLVER A EMPEZAR', 'REPORTE ADS + ORGÁNICO', 'ANUNCIOS CHECK', 'ANUNCIOS PRENDIDOS', 'PROGAMADO'].includes(l.estado_anterior)
    )
    const unique = new Set(restarts.map(l => l.cliente_id))
    return unique.size
  }, [filteredLogs])

  // Correction rate: clients that went through any CORRECION state
  const correctionRate = useMemo(() => {
    const clientsWithLogs = new Set(filteredLogs.map(l => l.cliente_id))
    const clientsWithCorrection = new Set(
      filteredLogs.filter(l => l.estado_nuevo.includes('CORRECION')).map(l => l.cliente_id)
    )
    if (clientsWithLogs.size === 0) return 0
    return Math.round((clientsWithCorrection.size / clientsWithLogs.size) * 100)
  }, [filteredLogs])

  // Average time per estado
  const avgTimePerEstado = useMemo(() => {
    // Group logs by cliente, compute duration between consecutive entries
    const byCliente = new Map<number, EstadoLog[]>()
    filteredLogs.forEach(l => {
      const arr = byCliente.get(l.cliente_id) || []
      arr.push(l)
      byCliente.set(l.cliente_id, arr)
    })

    const durations: Record<string, number[]> = {}

    byCliente.forEach(clienteLogs => {
      for (let i = 0; i < clienteLogs.length - 1; i++) {
        const estado = clienteLogs[i].estado_nuevo
        const start = new Date(clienteLogs[i].changed_at)
        const end = new Date(clienteLogs[i + 1].changed_at)
        const days = (end.getTime() - start.getTime()) / 86400000
        if (days >= 0 && days < 365) {
          if (!durations[estado]) durations[estado] = []
          durations[estado].push(days)
        }
      }
    })

    return ESTADO_OPTIONS_ONGOING
      .filter(e => durations[e]?.length > 0)
      .map(estado => {
        const arr = durations[estado]!
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length
        const max = Math.max(...arr)
        return { estado, avg: Math.round(avg * 10) / 10, max: Math.round(max * 10) / 10, count: arr.length }
      })
  }, [filteredLogs])

  // Stats by owner
  const ownerStats = useMemo(() => {
    return owners.map(o => {
      const ownerClientes = clientes.filter(c => c.owner_id === o.id)
      const ownerClienteIds = new Set(ownerClientes.map(c => c.id))
      const ownerLogs = filteredLogs.filter(l => ownerClienteIds.has(l.cliente_id))

      const restarts = ownerLogs.filter(l =>
        l.estado_nuevo === 'GUIONES' && l.estado_anterior &&
        ['METRICAS Y VOLVER A EMPEZAR', 'VOLVER A EMPEZAR', 'REPORTE ADS + ORGÁNICO', 'ANUNCIOS CHECK', 'ANUNCIOS PRENDIDOS'].includes(l.estado_anterior)
      )
      const loopCount = new Set(restarts.map(l => l.cliente_id)).size

      const withLogs = new Set(ownerLogs.map(l => l.cliente_id))
      const withCorrection = new Set(ownerLogs.filter(l => l.estado_nuevo.includes('CORRECION')).map(l => l.cliente_id))
      const corrRate = withLogs.size > 0 ? Math.round((withCorrection.size / withLogs.size) * 100) : 0

      const stale = ownerClientes.filter(c => c.estado_changed_at && daysAgo(c.estado_changed_at) >= 5 && !c.is_onboarding).length

      return { owner: o, total: ownerClientes.length, loops: loopCount, correctionRate: corrRate, stale }
    })
  }, [owners, clientes, filteredLogs])

  const maxAvg = avgTimePerEstado.length > 0 ? Math.max(...avgTimePerEstado.map(e => e.avg)) : 1

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#6a6a80' }}>Cargando metricas...</div>

  return (
    <div className="fade-in">
      {/* Period selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {([['week', 'Semana'], ['month', 'Mes'], ['all', 'Todo']] as const).map(([p, label]) => (
          <button key={p} onClick={() => setPeriod(p)}
            style={{
              fontSize: 11, padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
              border: period === p ? '1px solid #5e72e4' : '1px solid #2a2a40',
              background: period === p ? 'rgba(94,114,228,.12)' : 'transparent',
              color: period === p ? '#5e72e4' : '#6a6a80', fontWeight: 600,
            }}>
            {label}
          </button>
        ))}
      </div>

      {logs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <i className="fas fa-chart-bar" style={{ fontSize: 32, color: '#2a2a40', marginBottom: 12 }} />
          <div style={{ fontSize: 14, color: '#6a6a80', marginBottom: 8 }}>Las metricas se calculan automaticamente</div>
          <div style={{ fontSize: 12, color: '#4a4a60' }}>Los datos apareceran a medida que los clientes avancen en el flujo de produccion.</div>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Loops Completados', value: throughput, color: '#00d97e', bg: 'rgba(0,217,126,.12)' },
              { label: 'Tasa Correcciones', value: `${correctionRate}%`, color: correctionRate > 50 ? '#f5365c' : '#f5a623', bg: correctionRate > 50 ? 'rgba(245,54,92,.12)' : 'rgba(245,166,35,.12)' },
              { label: 'Clientes Estancados', value: staleClients.length, color: staleClients.length > 3 ? '#f5365c' : '#f5a623', bg: staleClients.length > 3 ? 'rgba(245,54,92,.12)' : 'rgba(245,166,35,.12)' },
              { label: 'Cambios de Estado', value: filteredLogs.length, color: '#5e72e4', bg: 'rgba(94,114,228,.12)' },
            ].map(s => (
              <div key={s.label} className="card" style={{ flex: '1 1 180px' }}>
                <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#6a6a80' }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Time per estado */}
          {avgTimePerEstado.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header"><span style={{ fontWeight: 600, fontSize: 13 }}><i className="fas fa-clock" style={{ marginRight: 6, color: '#5e72e4' }} />Tiempo Promedio por Estado</span></div>
              <div className="card-body" style={{ padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={thS}>Estado</th>
                      <th style={thS}>Promedio</th>
                      <th style={{ ...thS, minWidth: 160 }}></th>
                      <th style={thS}>Max</th>
                      <th style={thS}>Muestras</th>
                    </tr>
                  </thead>
                  <tbody>
                    {avgTimePerEstado.map(e => {
                      const es = getEstadoStyle(e.estado)
                      const pct = (e.avg / maxAvg) * 100
                      return (
                        <tr key={e.estado} style={{ borderBottom: '1px solid #1a1a28' }}>
                          <td style={tdS}>
                            <span style={{ padding: '2px 6px', borderRadius: 3, background: es.bg, color: es.color, fontSize: 10, fontWeight: 600 }}>{e.estado}</span>
                          </td>
                          <td style={{ ...tdS, fontWeight: 700, color: e.avg > 5 ? '#f5365c' : e.avg > 3 ? '#f5a623' : '#00d97e' }}>{e.avg}d</td>
                          <td style={tdS}>
                            <div style={{ height: 8, borderRadius: 4, background: '#1a1a28', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: e.avg > 5 ? '#f5365c' : e.avg > 3 ? '#f5a623' : '#00d97e' }} />
                            </div>
                          </td>
                          <td style={{ ...tdS, color: '#6a6a80' }}>{e.max}d</td>
                          <td style={{ ...tdS, color: '#4a4a60' }}>{e.count}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Stale clients */}
          {staleClients.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  <i className="fas fa-exclamation-triangle" style={{ marginRight: 6, color: '#f5365c' }} />
                  Clientes Estancados ({staleClients.length})
                </span>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr><th style={thS}>Cliente</th><th style={thS}>Estado</th><th style={thS}>Dias</th><th style={thS}>Owner</th></tr></thead>
                  <tbody>
                    {staleClients.map(c => {
                      const es = getEstadoStyle(c.estado)
                      const owner = owners.find(o => o.id === c.owner_id)
                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid #1a1a28' }}>
                          <td style={tdS}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <SemaforoIcon color={c.semaforo_general} />
                              <span style={{ fontWeight: 600 }}>{c.nombre}</span>
                            </div>
                          </td>
                          <td style={tdS}><span style={{ padding: '2px 6px', borderRadius: 3, background: es.bg, color: es.color, fontSize: 10, fontWeight: 600 }}>{c.estado}</span></td>
                          <td style={{ ...tdS, fontWeight: 700, color: c.days > 7 ? '#f5365c' : '#f5a623' }}>{c.days}d</td>
                          <td style={{ ...tdS, color: owner?.color || '#4a4a60' }}>{owner?.nombre_corto || 'Sin asignar'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Owner comparison */}
          <div className="card">
            <div className="card-header"><span style={{ fontWeight: 600, fontSize: 13 }}><i className="fas fa-users" style={{ marginRight: 6, color: '#5e72e4' }} />Comparacion por Owner</span></div>
            <div className="card-body" style={{ padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr><th style={thS}>Owner</th><th style={thS}>Clientes</th><th style={thS}>Loops</th><th style={thS}>Correcciones</th><th style={thS}>Estancados</th></tr></thead>
                <tbody>
                  {ownerStats.map(s => (
                    <tr key={s.owner.id} style={{ borderBottom: '1px solid #1a1a28' }}>
                      <td style={tdS}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 6, background: s.owner.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.owner.color, fontWeight: 700, fontSize: 10 }}>{s.owner.nombre_corto[0]}</div>
                          <span style={{ fontWeight: 600 }}>{s.owner.nombre}</span>
                        </div>
                      </td>
                      <td style={tdS}>{s.total}</td>
                      <td style={{ ...tdS, fontWeight: 600, color: '#00d97e' }}>{s.loops}</td>
                      <td style={{ ...tdS, color: s.correctionRate > 50 ? '#f5365c' : '#f5a623' }}>{s.correctionRate}%</td>
                      <td style={{ ...tdS, color: s.stale > 0 ? '#f5365c' : '#00d97e' }}>{s.stale}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const thS: React.CSSProperties = {
  padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600,
  color: '#6a6a80', textTransform: 'uppercase', background: '#12121a',
  borderBottom: '1px solid #2a2a40',
}

const tdS: React.CSSProperties = { padding: '6px 10px', verticalAlign: 'middle' }

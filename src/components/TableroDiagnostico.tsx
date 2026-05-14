'use client'
import { useMemo, useState } from 'react'
import type { Cliente, Owner } from '@/lib/supabase'
import { getEstadoStyle, ESTADO_OPTIONS_ONGOING } from '@/lib/estados'
import { quilomboScore } from '@/lib/quilomboScore'

type Props = {
  clientes: Cliente[]
  owners: Owner[]
  onSelectCliente: (c: Cliente) => void
  ownerFilter?: string
}

type EstadoStat = {
  estado: string
  count: number
  avgDaysStuck: number
  maxDaysStuck: number
  worstCliente: Cliente | null
  clientes: Cliente[]
}

type Bucket = 'vencido' | 'urgente' | 'proximo' | 'cuidado' | 'ok'

const BUCKET_META: Record<Bucket, { label: string; color: string; bg: string }> = {
  vencido: { label: 'Vencido',   color: '#f5365c', bg: 'rgba(245,54,92,.12)' },
  urgente: { label: 'Urgente ≤3d', color: '#f5a623', bg: 'rgba(245,166,35,.12)' },
  proximo: { label: 'Próximo ≤7d', color: '#f5d623', bg: 'rgba(245,214,35,.12)' },
  cuidado: { label: 'Cuidado ≤14d', color: '#5e72e4', bg: 'rgba(94,114,228,.12)' },
  ok:      { label: 'OK >14d',   color: '#00d97e', bg: 'rgba(0,217,126,.12)' },
}

function diffDays(target: Date, ref: Date = new Date()): number {
  return Math.floor((target.getTime() - ref.getTime()) / 86400000)
}

function bucketForDeadline(daysToHito: number | null): Bucket | null {
  if (daysToHito == null) return null
  if (daysToHito < 0) return 'vencido'
  if (daysToHito <= 3) return 'urgente'
  if (daysToHito <= 7) return 'proximo'
  if (daysToHito <= 14) return 'cuidado'
  return 'ok'
}

export default function TableroDiagnostico({ clientes, owners, onSelectCliente, ownerFilter }: Props) {
  const [tab, setTab] = useState<'cuellos' | 'deadlines'>('cuellos')

  const visibles = useMemo(() => {
    if (!ownerFilter) return clientes
    if (ownerFilter === '__none__') return clientes.filter(c => !c.owner_id)
    return clientes.filter(c => c.owner_id === ownerFilter)
  }, [clientes, ownerFilter])

  const ownerById = useMemo(() => {
    const m = new Map<string, Owner>()
    owners.forEach(o => m.set(o.id, o))
    return m
  }, [owners])

  // ============== Cuellos de botella por estado ==============
  const estadoStats = useMemo<EstadoStat[]>(() => {
    const today = new Date()
    const groups = new Map<string, Cliente[]>()
    for (const c of visibles) {
      if (!c.estado) continue
      if (!groups.has(c.estado)) groups.set(c.estado, [])
      groups.get(c.estado)!.push(c)
    }

    const stats: EstadoStat[] = []
    Array.from(groups.entries()).forEach(([estado, list]) => {
      const dias = list.map(c => {
        if (!c.estado_changed_at) return 0
        const t = new Date(c.estado_changed_at)
        if (isNaN(t.getTime())) return 0
        return Math.max(0, -diffDays(t, today))
      })
      const totalDays = dias.reduce((s, d) => s + d, 0)
      const avg = list.length > 0 ? Math.round(totalDays / list.length) : 0
      const maxIdx = dias.indexOf(Math.max(...dias))
      stats.push({
        estado,
        count: list.length,
        avgDaysStuck: avg,
        maxDaysStuck: dias[maxIdx] ?? 0,
        worstCliente: list[maxIdx] ?? null,
        clientes: list,
      })
    })

    // Orden: por avgDaysStuck DESC, luego por count DESC
    return stats.sort((a, b) => b.avgDaysStuck - a.avgDaysStuck || b.count - a.count)
  }, [visibles])

  // ============== Deadlines en riesgo ==============
  const deadlineRows = useMemo(() => {
    const today = new Date()
    return visibles
      .map(c => {
        const hito = c.proximo_hito ? new Date(c.proximo_hito) : null
        const days = hito && !isNaN(hito.getTime()) ? diffDays(hito, today) : null
        const bucket = bucketForDeadline(days)
        const q = quilomboScore(c, today)
        return { cliente: c, days, bucket, score: q.score }
      })
      .filter(r => r.bucket && r.bucket !== 'ok')
      .sort((a, b) => {
        // Vencidos primero (más vencido = peor), luego por menos días
        const order: Record<Bucket, number> = { vencido: 0, urgente: 1, proximo: 2, cuidado: 3, ok: 4 }
        const oA = a.bucket ? order[a.bucket] : 99
        const oB = b.bucket ? order[b.bucket] : 99
        if (oA !== oB) return oA - oB
        return (a.days ?? 0) - (b.days ?? 0)
      })
  }, [visibles])

  const bucketCounts = useMemo(() => {
    const c: Record<Bucket, number> = { vencido: 0, urgente: 0, proximo: 0, cuidado: 0, ok: 0 }
    for (const r of deadlineRows) if (r.bucket) c[r.bucket]++
    // OK count = visibles - filtered
    c.ok = visibles.filter(v => {
      const h = v.proximo_hito ? new Date(v.proximo_hito) : null
      const d = h && !isNaN(h.getTime()) ? diffDays(h) : null
      return d != null && d > 14
    }).length
    return c
  }, [deadlineRows, visibles])

  const maxAvg = Math.max(...estadoStats.map(s => s.avgDaysStuck), 1)

  return (
    <div className="fade-in">
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #2a2a40' }}>
        <TabButton active={tab === 'cuellos'} onClick={() => setTab('cuellos')} icon="fa-stethoscope" label="Cuellos de botella" />
        <TabButton active={tab === 'deadlines'} onClick={() => setTab('deadlines')} icon="fa-bell" label="Deadlines en riesgo" />
      </div>

      {tab === 'cuellos' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
          {estadoStats.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#6a6a80', gridColumn: '1 / -1' }}>
              <i className="fas fa-circle-check" style={{ fontSize: 24, marginBottom: 8, color: '#00d97e' }} /><br />
              No hay clientes con estado asignado.
            </div>
          ) : estadoStats.map(s => {
            const style = getEstadoStyle(s.estado)
            const isCanon = ESTADO_OPTIONS_ONGOING.includes(s.estado)
            const tone = s.avgDaysStuck > 14 ? '#f5365c' : s.avgDaysStuck > 7 ? '#f5a623' : s.avgDaysStuck > 3 ? '#f5d623' : '#a0a0b8'
            const barPct = Math.round((s.avgDaysStuck / maxAvg) * 100)
            return (
              <div key={s.estado} className="card">
                <div className="card-header">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: 6, background: style.bg, color: style.color,
                      fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
                    }}>
                      {s.estado}
                      {!isCanon && <i className="fas fa-question-circle" title="Estado fuera del flujo canónico" style={{ marginLeft: 4, opacity: 0.5 }} />}
                    </span>
                    <span style={{ fontSize: 12, color: '#6a6a80' }}>{s.count} cliente{s.count !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="card-body">
                  {/* Avg + barra */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#6a6a80', textTransform: 'uppercase', letterSpacing: 0.3 }}>Tiempo promedio en este estado</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: tone }}>{s.avgDaysStuck}d</span>
                    </div>
                    <div style={{ width: '100%', height: 4, background: '#2a2a40', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${barPct}%`, height: '100%', background: tone, transition: 'width .3s' }} />
                    </div>
                    <div style={{ fontSize: 10, color: '#6a6a80', marginTop: 2 }}>
                      Máx: {s.maxDaysStuck}d
                      {s.worstCliente && (
                        <span> · <a onClick={(e) => { e.preventDefault(); onSelectCliente(s.worstCliente!) }}
                          style={{ color: '#5e72e4', cursor: 'pointer', textDecoration: 'none' }}>{s.worstCliente.nombre}</a></span>
                      )}
                    </div>
                  </div>

                  {/* Lista corta */}
                  <div>
                    {s.clientes.slice(0, 4).map(c => {
                      const days = c.estado_changed_at
                        ? Math.max(0, -diffDays(new Date(c.estado_changed_at)))
                        : 0
                      const owner = c.owner_id ? ownerById.get(c.owner_id) : null
                      return (
                        <div
                          key={c.id}
                          onClick={() => onSelectCliente(c)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                            fontSize: 12, transition: 'background .15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#1a1a28')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          {owner && (
                            <span style={{
                              width: 18, height: 18, borderRadius: 4, background: owner.color + '22',
                              color: owner.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 700, fontSize: 9,
                            }}>{owner.nombre_corto[0]}</span>
                          )}
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</span>
                          <span style={{ fontSize: 10, color: days > 7 ? '#f5365c' : days > 3 ? '#f5a623' : '#6a6a80', fontWeight: 600 }}>
                            {days}d
                          </span>
                        </div>
                      )
                    })}
                    {s.clientes.length > 4 && (
                      <div style={{ fontSize: 10, color: '#6a6a80', textAlign: 'center', marginTop: 4 }}>
                        +{s.clientes.length - 4} más
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        // ============== Deadlines tab ==============
        <div>
          {/* Bucket KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 18 }}>
            {(Object.keys(BUCKET_META) as Bucket[]).map(b => (
              <div key={b} style={{
                padding: 14, borderRadius: 10,
                background: BUCKET_META[b].bg,
                border: `1px solid ${BUCKET_META[b].color}33`,
              }}>
                <div style={{ fontSize: 10, color: '#6a6a80', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
                  {BUCKET_META[b].label}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: BUCKET_META[b].color }}>
                  {bucketCounts[b]}
                </div>
              </div>
            ))}
          </div>

          {/* Lista deadlines en riesgo */}
          <div className="card">
            <div className="card-header">
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                <i className="fas fa-bell" style={{ marginRight: 8, color: '#f5a623' }} />
                Próximos hitos
              </div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {deadlineRows.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#6a6a80' }}>
                  <i className="fas fa-circle-check" style={{ fontSize: 24, marginBottom: 8, color: '#00d97e' }} /><br />
                  Sin deadlines en riesgo en los próximos 14 días.
                </div>
              ) : deadlineRows.map(r => {
                const meta = r.bucket ? BUCKET_META[r.bucket] : null
                const owner = r.cliente.owner_id ? ownerById.get(r.cliente.owner_id) : null
                const estadoStyle = getEstadoStyle(r.cliente.estado)
                return (
                  <div
                    key={r.cliente.id}
                    onClick={() => onSelectCliente(r.cliente)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '90px 1fr auto auto',
                      alignItems: 'center', gap: 12,
                      padding: '10px 16px', borderBottom: '1px solid #2a2a40',
                      cursor: 'pointer', transition: 'background .15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#1a1a28')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Bucket badge */}
                    {meta && (
                      <span style={{
                        padding: '4px 8px', borderRadius: 4,
                        background: meta.bg, color: meta.color,
                        fontSize: 10, fontWeight: 700, textAlign: 'center',
                        textTransform: 'uppercase', letterSpacing: 0.3,
                      }}>
                        {r.days! < 0 ? `−${Math.abs(r.days!)}d` : `${r.days}d`}
                      </span>
                    )}

                    {/* Cliente + estado */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.cliente.nombre}
                      </div>
                      <div style={{ fontSize: 10, color: '#6a6a80', marginTop: 2 }}>
                        <span style={{ padding: '1px 6px', borderRadius: 3, background: estadoStyle.bg, color: estadoStyle.color, fontSize: 9, fontWeight: 600 }}>
                          {r.cliente.estado || '—'}
                        </span>
                        {r.cliente.proximo_hito && (
                          <span style={{ marginLeft: 8 }}>
                            <i className="fas fa-flag-checkered" style={{ marginRight: 3 }} />
                            {new Date(r.cliente.proximo_hito).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Owner */}
                    {owner ? (
                      <div title={owner.nombre} style={{
                        width: 24, height: 24, borderRadius: 6, background: owner.color + '22',
                        color: owner.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 10,
                      }}>{owner.nombre_corto[0]}</div>
                    ) : (
                      <div style={{ width: 24, height: 24 }} />
                    )}

                    {/* Score */}
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      padding: '3px 8px', borderRadius: 4,
                      background: r.score >= 50 ? 'rgba(245,54,92,.15)' : r.score >= 30 ? 'rgba(245,166,35,.15)' : '#1a1a28',
                      color: r.score >= 50 ? '#f5365c' : r.score >= 30 ? '#f5a623' : '#a0a0b8',
                    }}>
                      Q{r.score}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        padding: '10px 16px',
        color: active ? '#fff' : '#6a6a80',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        borderBottom: active ? '2px solid #5e72e4' : '2px solid transparent',
        transition: 'color .15s, border .15s',
      }}
    >
      <i className={`fas ${icon}`} style={{ marginRight: 6 }} />{label}
    </button>
  )
}

'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase, type Cliente, type Owner, type LoopLog, type EstadoLog } from '@/lib/supabase'
import { queryLoops, currentCicloMes, SECCION_LABELS } from '@/lib/loopLog'

type Props = {
  agenciaId: string
  clientes: Cliente[]
  owners: Owner[]
  onSelectCliente: (c: Cliente) => void
}

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const WEEKDAYS = ['L','M','X','J','V','S','D']

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfMonthOffset(d: Date): number {
  // Lunes = 0
  const day = new Date(d.getFullYear(), d.getMonth(), 1).getDay()
  return (day + 6) % 7
}

export default function TableroCalendario({ agenciaId, clientes, owners, onSelectCliente }: Props) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [loops, setLoops] = useState<LoopLog[]>([])
  const [estadoLogs, setEstadoLogs] = useState<EstadoLog[]>([])
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // Range del mes
  const monthStart = useMemo(() => new Date(cursor), [cursor])
  const monthEnd = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0), [cursor])

  // Cargar loops y estado_log del mes
  useEffect(() => {
    let cancelled = false
    const since = ymd(monthStart) + 'T00:00:00.000Z'
    const until = ymd(monthEnd) + 'T23:59:59.999Z'

    queryLoops({ agenciaId, since }).then(data => {
      if (cancelled) return
      const filtered = data.filter(l => l.date >= since && l.date <= until)
      setLoops(filtered)
    })

    supabase.from('estado_log').select('*')
      .gte('changed_at', since)
      .lte('changed_at', until)
      .then(({ data }) => {
        if (cancelled) return
        setEstadoLogs((data ?? []) as EstadoLog[])
      })

    return () => { cancelled = true }
  }, [agenciaId, monthStart, monthEnd])

  // Index by day
  const byDay = useMemo(() => {
    type Day = { deadlines: Cliente[]; loops: LoopLog[]; changes: EstadoLog[] }
    const m = new Map<string, Day>()

    const ensure = (k: string): Day => {
      if (!m.has(k)) m.set(k, { deadlines: [], loops: [], changes: [] })
      return m.get(k)!
    }

    // Deadlines
    for (const c of clientes) {
      if (!c.proximo_hito) continue
      const t = new Date(c.proximo_hito)
      if (isNaN(t.getTime())) continue
      if (t < monthStart || t > monthEnd) continue
      ensure(ymd(t)).deadlines.push(c)
    }

    // Loops
    for (const l of loops) {
      const t = new Date(l.date)
      ensure(ymd(t)).loops.push(l)
    }

    // Estado changes
    for (const e of estadoLogs) {
      const t = new Date(e.changed_at)
      ensure(ymd(t)).changes.push(e)
    }

    return m
  }, [clientes, loops, estadoLogs, monthStart, monthEnd])

  // Build grid (6 weeks max)
  const offset = startOfMonthOffset(cursor)
  const daysInMonth = monthEnd.getDate()
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7

  const cells: { date: Date | null; ymd?: string; today?: boolean }[] = []
  const todayYmd = ymd(new Date())
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - offset + 1
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells.push({ date: null })
    } else {
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), dayNum)
      const k = ymd(d)
      cells.push({ date: d, ymd: k, today: k === todayYmd })
    }
  }

  // Detail panel data
  const detail = selectedDay ? byDay.get(selectedDay) : null
  const clienteById = useMemo(() => {
    const m = new Map<number, Cliente>()
    clientes.forEach(c => m.set(c.id, c))
    return m
  }, [clientes])
  const ownerById = useMemo(() => {
    const m = new Map<string, Owner>()
    owners.forEach(o => m.set(o.id, o))
    return m
  }, [owners])

  return (
    <div className="fade-in">
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            style={btnIcon}><i className="fas fa-chevron-left" /></button>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, minWidth: 160, textAlign: 'center' }}>
            {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
          </h2>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            style={btnIcon}><i className="fas fa-chevron-right" /></button>
          <button onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)) }}
            style={{ ...btnIcon, padding: '6px 12px', width: 'auto', fontSize: 11 }}>Hoy</button>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6a6a80' }}>
          <Legend color="#5e72e4" icon="fa-flag-checkered" label="Deadline" />
          <Legend color="#f5365c" icon="fa-rotate" label="Loop" />
          <Legend color="#00d97e" icon="fa-arrow-right" label="Cambio" />
        </div>
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 4, marginBottom: 16,
      }}>
        {WEEKDAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, color: '#6a6a80', fontWeight: 700, padding: 6, textTransform: 'uppercase' }}>
            {d}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell.date) {
            return <div key={i} style={{ background: 'transparent', minHeight: 80 }} />
          }
          const data = byDay.get(cell.ymd!) ?? { deadlines: [], loops: [], changes: [] }
          const intensity = data.deadlines.length + data.loops.length + data.changes.length
          const isSelected = selectedDay === cell.ymd
          return (
            <button
              key={i}
              onClick={() => setSelectedDay(isSelected ? null : cell.ymd!)}
              style={{
                background: isSelected
                  ? 'rgba(94,114,228,.20)'
                  : intensity > 5
                    ? 'rgba(245,54,92,.10)'
                    : intensity > 2
                      ? 'rgba(245,166,35,.08)'
                      : intensity > 0
                        ? 'rgba(0,217,126,.05)'
                        : '#1a1a28',
                border: `1px solid ${isSelected ? '#5e72e4' : cell.today ? '#5e72e4' : '#2a2a40'}`,
                borderRadius: 8,
                minHeight: 80, padding: 8,
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column' as const, gap: 4,
                textAlign: 'left' as const,
              }}
            >
              <div style={{
                fontSize: 12, fontWeight: 700,
                color: cell.today ? '#5e72e4' : '#e8e8f0',
              }}>
                {cell.date.getDate()}
              </div>
              {data.deadlines.length > 0 && (
                <div style={{ fontSize: 10, color: '#5e72e4', fontWeight: 600 }}>
                  📅 {data.deadlines.length}
                </div>
              )}
              {data.loops.length > 0 && (
                <div style={{ fontSize: 10, color: '#f5365c', fontWeight: 600 }}>
                  🔄 {data.loops.length}{data.loops.reduce((s, l) => s + (l.cost_usd ?? 0), 0) > 0 ? ` · $${data.loops.reduce((s, l) => s + (l.cost_usd ?? 0), 0).toFixed(0)}` : ''}
                </div>
              )}
              {data.changes.length > 0 && (
                <div style={{ fontSize: 10, color: '#00d97e', fontWeight: 600 }}>
                  ↪ {data.changes.length}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Detail panel */}
      {selectedDay && detail && (
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                <i className="fas fa-calendar-day" style={{ marginRight: 8, color: '#5e72e4' }} />
                {new Date(selectedDay).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <button onClick={() => setSelectedDay(null)} style={{ background: 'transparent', border: 'none', color: '#6a6a80', cursor: 'pointer', fontSize: 14 }}>
                <i className="fas fa-xmark" />
              </button>
            </div>
          </div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {/* Deadlines */}
            <div>
              <Subhead icon="fa-flag-checkered" color="#5e72e4" label="Deadlines" count={detail.deadlines.length} />
              {detail.deadlines.length === 0 ? <Empty /> : detail.deadlines.map(c => {
                const owner = c.owner_id ? ownerById.get(c.owner_id) : null
                return (
                  <Row key={c.id} onClick={() => onSelectCliente(c)}>
                    {owner && <OwnerChip owner={owner} />}
                    <span style={{ flex: 1, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>{c.nombre}</span>
                    <span style={{ fontSize: 10, color: '#6a6a80' }}>{c.estado || '—'}</span>
                  </Row>
                )
              })}
            </div>
            {/* Loops */}
            <div>
              <Subhead icon="fa-rotate" color="#f5365c" label="Loops" count={detail.loops.length} />
              {detail.loops.length === 0 ? <Empty /> : detail.loops.map(l => {
                const c = l.cliente_id ? clienteById.get(l.cliente_id) : null
                const meta = SECCION_LABELS[l.seccion]
                return (
                  <Row key={l.id} onClick={() => c && onSelectCliente(c)}>
                    <span style={{ fontSize: 12 }}>{meta.icon}</span>
                    <span style={{ flex: 1, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>
                      {c?.nombre || '—'}
                      {l.responsable && <span style={{ marginLeft: 6, fontSize: 10, color: '#6a6a80' }}>· {l.responsable}</span>}
                    </span>
                    <span style={{ fontSize: 10, color: '#f5365c', fontWeight: 700 }}>
                      ${(l.cost_usd ?? 0).toFixed(0)}
                    </span>
                  </Row>
                )
              })}
            </div>
            {/* Changes */}
            <div>
              <Subhead icon="fa-arrow-right" color="#00d97e" label="Cambios de estado" count={detail.changes.length} />
              {detail.changes.length === 0 ? <Empty /> : detail.changes.slice(0, 12).map(e => {
                const c = clienteById.get(e.cliente_id)
                return (
                  <Row key={e.id} onClick={() => c && onSelectCliente(c)}>
                    <span style={{ flex: 1, fontSize: 11, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>
                      <strong>{c?.nombre || '—'}</strong>
                      <span style={{ color: '#6a6a80', marginLeft: 6 }}>
                        {e.estado_anterior || '—'} → {e.estado_nuevo}
                      </span>
                    </span>
                  </Row>
                )
              })}
              {detail.changes.length > 12 && (
                <div style={{ fontSize: 10, color: '#6a6a80', textAlign: 'center', marginTop: 4 }}>
                  + {detail.changes.length - 12} más
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const btnIcon: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  background: '#1a1a28', border: '1px solid #2a2a40',
  color: '#a0a0b8', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 12,
}

function Legend({ color, icon, label }: { color: string; icon: string; label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <i className={`fas ${icon}`} style={{ color, fontSize: 10 }} /> {label}
    </span>
  )
}

function Subhead({ icon, color, label, count }: { icon: string; color: string; label: string; count: number }) {
  return (
    <div style={{
      fontSize: 11, color: '#6a6a80', fontWeight: 700,
      textTransform: 'uppercase' as const, letterSpacing: 0.4,
      marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <i className={`fas ${icon}`} style={{ color }} />
      {label}
      <span style={{
        background: color + '22', color, padding: '0 6px',
        borderRadius: 8, fontSize: 10,
      }}>
        {count}
      </span>
    </div>
  )
}

function Row({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 8px', borderRadius: 6,
        background: '#1a1a28', marginBottom: 3,
        fontSize: 12, cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {children}
    </div>
  )
}

function Empty() {
  return <div style={{ fontSize: 11, color: '#6a6a80', fontStyle: 'italic', padding: '6px 8px' }}>—</div>
}

function OwnerChip({ owner }: { owner: Owner }) {
  return (
    <span style={{
      width: 18, height: 18, borderRadius: 5,
      background: owner.color + '22', color: owner.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: 9, flexShrink: 0,
    }}>
      {owner.nombre_corto[0]}
    </span>
  )
}

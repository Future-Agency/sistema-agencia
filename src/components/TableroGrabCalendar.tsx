'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase, type Cliente, type Owner, type ClienteCicloRecursos } from '@/lib/supabase'
import { cicloMesLabel } from '@/lib/cycles'

type Props = {
  agenciaId: string
  clientes: Cliente[]
  owners: Owner[]
  onSelectCliente: (c: Cliente) => void
}

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}

function startOfMonthOffset(d: Date): number {
  // Lunes = 0
  const day = new Date(d.getFullYear(), d.getMonth(), 1).getDay()
  return (day + 6) % 7
}

type Grab = {
  cliente: Cliente
  cicloMes: string
  date: Date
  isConfirmed: boolean
  actor: string | null
}

export default function TableroGrabCalendar({ agenciaId, clientes, owners, onSelectCliente }: Props) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [recursos, setRecursos] = useState<ClienteCicloRecursos[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [showTentative, setShowTentative] = useState(true)

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

  const monthStart = useMemo(() => new Date(cursor), [cursor])
  const monthEnd = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0), [cursor])

  // Cargar recursos con fechas en el rango
  const loadRecursos = async () => {
    setLoading(true)
    const startStr = ymd(monthStart)
    const endStr = ymd(monthEnd)
    const { data } = await supabase
      .from('cliente_ciclo_recursos')
      .select('*')
      .eq('agencia_id', agenciaId)
      .or(`fecha_grabacion_tentativa.gte.${startStr},fecha_grabacion_confirmada.gte.${startStr}`)
    const filtered = (data ?? []).filter(r => {
      const t = r.fecha_grabacion_tentativa
      const c = r.fecha_grabacion_confirmada
      return (t && t >= startStr && t <= endStr) || (c && c >= startStr && c <= endStr)
    })
    setRecursos(filtered as ClienteCicloRecursos[])
    setLoading(false)
  }

  useEffect(() => { loadRecursos() /* eslint-disable-line */ }, [agenciaId, monthStart.getTime(), monthEnd.getTime()])

  // Realtime
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => loadRecursos()
    window.addEventListener('estado-loop-changed', handler)
    return () => window.removeEventListener('estado-loop-changed', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agenciaId, monthStart.getTime(), monthEnd.getTime()])

  // Build grabs por día
  const byDay = useMemo(() => {
    const m = new Map<string, Grab[]>()
    for (const r of recursos) {
      const cliente = clienteById.get(r.cliente_id)
      if (!cliente) continue
      // Si hay confirmada, usar esa. Si no, usar tentativa.
      const conf = parseDate(r.fecha_grabacion_confirmada)
      const tent = parseDate(r.fecha_grabacion_tentativa)
      const isConfirmed = !!conf
      const date = conf || tent
      if (!date) continue
      if (!isConfirmed && !showTentative) continue
      const k = ymd(date)
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push({ cliente, cicloMes: r.ciclo_mes, date, isConfirmed, actor: r.actor_actriz })
    }
    return m
  }, [recursos, clienteById, showTentative])

  // Build grid
  const offset = startOfMonthOffset(cursor)
  const daysInMonth = monthEnd.getDate()
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7
  const cells: { date: Date | null; ymd?: string; today?: boolean }[] = []
  const todayYmd = ymd(new Date())
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - offset + 1
    if (dayNum < 1 || dayNum > daysInMonth) cells.push({ date: null })
    else {
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), dayNum)
      const k = ymd(d)
      cells.push({ date: d, ymd: k, today: k === todayYmd })
    }
  }

  // Totals
  const totals = useMemo(() => {
    let conf = 0, tent = 0
    recursos.forEach(r => {
      if (r.fecha_grabacion_confirmada) conf++
      else if (r.fecha_grabacion_tentativa) tent++
    })
    return { conf, tent }
  }, [recursos])

  const selectedDayGrabs = selectedDay ? (byDay.get(selectedDay) ?? []) : []

  return (
    <div className="fade-in">
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap' as const, gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} style={btnIcon}>
            <i className="fas fa-chevron-left" />
          </button>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, minWidth: 180, textAlign: 'center' as const }}>
            🎥 {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
          </h2>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} style={btnIcon}>
            <i className="fas fa-chevron-right" />
          </button>
          <button onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)) }}
            style={{ ...btnIcon, width: 'auto', padding: '6px 12px', fontSize: 11 }}>Hoy</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#a0a0b8', cursor: 'pointer' }}>
            <input type="checkbox" checked={showTentative} onChange={e => setShowTentative(e.target.checked)} />
            Tentativas
          </label>
          <span style={{ fontSize: 11, color: '#6a6a80' }}>
            <strong style={{ color: '#00d97e' }}>{totals.conf}</strong> confirmadas · <strong style={{ color: '#f5a623' }}>{totals.tent}</strong> tentativas
          </span>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center' as const, color: '#6a6a80' }}>Cargando grabaciones…</div>
      ) : (
        <>
          {/* Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 16 }}>
            {WEEKDAYS.map(d => (
              <div key={d} style={{ textAlign: 'center' as const, fontSize: 10, color: '#6a6a80', fontWeight: 700, padding: 6, textTransform: 'uppercase' as const, letterSpacing: 0.4 }}>
                {d}
              </div>
            ))}
            {cells.map((cell, i) => {
              if (!cell.date) return <div key={i} style={{ minHeight: 90 }} />
              const grabs = byDay.get(cell.ymd!) ?? []
              const hasConfirmed = grabs.some(g => g.isConfirmed)
              const hasTent = grabs.some(g => !g.isConfirmed)
              const intensity = grabs.length
              const isSelected = selectedDay === cell.ymd
              return (
                <button key={i} onClick={() => setSelectedDay(isSelected ? null : cell.ymd!)}
                  style={{
                    background: isSelected
                      ? 'rgba(94,114,228,.18)'
                      : intensity > 0
                        ? hasConfirmed ? 'rgba(0,217,126,.10)' : 'rgba(245,166,35,.08)'
                        : '#12121a',
                    border: `1px solid ${isSelected ? '#5e72e4' : cell.today ? '#5e72e4' : intensity > 0 ? hasConfirmed ? 'rgba(0,217,126,.30)' : 'rgba(245,166,35,.30)' : '#2a2a40'}`,
                    borderRadius: 8,
                    minHeight: 90, padding: 6, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column' as const, gap: 3,
                    textAlign: 'left' as const,
                  }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700,
                    color: cell.today ? '#5e72e4' : '#e8e8f0',
                  }}>
                    {cell.date.getDate()}
                  </div>
                  {grabs.slice(0, 3).map((g, k) => (
                    <div key={k} style={{
                      fontSize: 9, padding: '2px 5px', borderRadius: 3,
                      background: g.isConfirmed ? 'rgba(0,217,126,.18)' : 'rgba(245,166,35,.15)',
                      color: g.isConfirmed ? '#00d97e' : '#f5a623',
                      fontWeight: 700,
                      overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const,
                    }} title={`${g.cliente.nombre}${g.actor ? ' · ' + g.actor : ''}`}>
                      {g.isConfirmed ? '✓' : '◌'} {g.cliente.nombre}
                    </div>
                  ))}
                  {grabs.length > 3 && (
                    <div style={{ fontSize: 9, color: '#6a6a80', fontStyle: 'italic' as const }}>
                      + {grabs.length - 3} más
                    </div>
                  )}
                  {grabs.length === 0 && hasConfirmed === false && hasTent === false && (
                    <div style={{ flex: 1 }} />
                  )}
                </button>
              )
            })}
          </div>

          {/* Detail panel del día seleccionado */}
          {selectedDay && (
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    <i className="fas fa-calendar-day" style={{ marginRight: 8, color: '#5e72e4' }} />
                    {new Date(selectedDay + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    <span style={{ marginLeft: 10, fontSize: 11, color: '#6a6a80', fontWeight: 500 }}>
                      {selectedDayGrabs.length} grabacion{selectedDayGrabs.length !== 1 ? 'es' : ''}
                    </span>
                  </div>
                  <button onClick={() => setSelectedDay(null)} style={{ background: 'transparent', border: 'none', color: '#6a6a80', cursor: 'pointer', fontSize: 14 }}>
                    <i className="fas fa-xmark" />
                  </button>
                </div>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                {selectedDayGrabs.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center' as const, color: '#6a6a80', fontStyle: 'italic' as const }}>
                    Sin grabaciones registradas para este día.
                  </div>
                ) : selectedDayGrabs.map((g, idx) => {
                  const owner = g.cliente.owner_id ? ownerById.get(g.cliente.owner_id) : null
                  return (
                    <div key={idx} onClick={() => onSelectCliente(g.cliente)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                        background: g.isConfirmed ? 'rgba(0,217,126,.08)' : 'rgba(245,166,35,.06)',
                        border: `1px solid ${g.isConfirmed ? 'rgba(0,217,126,.25)' : 'rgba(245,166,35,.25)'}`,
                        borderRadius: 8, cursor: 'pointer',
                      }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                        background: g.isConfirmed ? '#00d97e' : '#f5a623', color: '#0a0a0f',
                        textTransform: 'uppercase' as const, letterSpacing: 0.3,
                      }}>
                        {g.isConfirmed ? '✓ Confirmada' : '◌ Tentativa'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{g.cliente.nombre}</div>
                        <div style={{ fontSize: 10, color: '#6a6a80', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                          <span><i className="fas fa-rotate" style={{ marginRight: 3 }} />{cicloMesLabel(g.cicloMes)}</span>
                          {g.actor && <span><i className="fas fa-user" style={{ marginRight: 3 }} />{g.actor}</span>}
                        </div>
                      </div>
                      {owner && (
                        <span style={{
                          width: 24, height: 24, borderRadius: 5,
                          background: owner.color + '22', color: owner.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: 10, flexShrink: 0,
                        }}>{owner.nombre_corto[0]}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
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

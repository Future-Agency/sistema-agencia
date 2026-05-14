'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase, type Cliente, type EstadoLog } from '@/lib/supabase'
import { ESTADO_OPTIONS_ONGOING, getEstadoStyle, ESTADO_FASE } from '@/lib/estados'
import { currentCicloMes, prevCicloMes, nextCicloMes, cicloMesLabel } from '@/lib/cycles'

type Props = {
  cliente: Cliente
  agenciaId: string
}

type CardStatus = 'completado' | 'activo' | 'pendiente' | 'saltado'

type EstadoCard = {
  estado: string
  status: CardStatus
  inicio: string | null
  fin: string | null
  durationMs: number
  visits: number
  fase: string
}

const FASE_META: Record<string, { color: string; icon: string; label: string }> = {
  guion:     { label: 'COPYS',     color: '#a78bfa', icon: 'fa-pen-fancy' },
  grabacion: { label: 'PRODUCCIÓN', color: '#5e72e4', icon: 'fa-video' },
  edicion:   { label: 'EDICIÓN',    color: '#fb6340', icon: 'fa-film' },
  diseno:    { label: 'DISEÑO',     color: '#ec4ad8', icon: 'fa-palette' },
  revision:  { label: 'REVISIÓN',   color: '#f5d623', icon: 'fa-magnifying-glass' },
  subida:    { label: 'SUBIDA',     color: '#00d97e', icon: 'fa-calendar-check' },
  anuncios:  { label: 'ANUNCIOS',   color: '#f5a623', icon: 'fa-bullhorn' },
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '—'
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  if (days >= 1) return hours > 0 && days < 7 ? `${days}d ${hours}h` : `${days}d`
  if (hours >= 1) return `${hours}h`
  return '< 1h'
}

function buildCards(logs: EstadoLog[], currentEstado: string | null): EstadoCard[] {
  const sorted = [...logs].sort((a, b) => a.changed_at.localeCompare(b.changed_at))
  const now = Date.now()
  const currentIdx = currentEstado ? ESTADO_OPTIONS_ONGOING.indexOf(currentEstado) : -1

  return ESTADO_OPTIONS_ONGOING.map(estado => {
    const enters = sorted.filter(l => l.estado_nuevo === estado)
    const exits = sorted.filter(l => l.estado_anterior === estado)
    const idx = ESTADO_OPTIONS_ONGOING.indexOf(estado)
    const fase = ESTADO_FASE[estado] ?? 'edicion'

    let inicio: string | null = null
    let fin: string | null = null
    let durationMs = 0

    if (enters.length > 0) {
      inicio = enters[0].changed_at
      enters.forEach(enterEntry => {
        const enterTime = new Date(enterEntry.changed_at).getTime()
        const exit = exits.find(e => new Date(e.changed_at).getTime() > enterTime)
        if (exit) {
          durationMs += new Date(exit.changed_at).getTime() - enterTime
        } else if (estado === currentEstado) {
          durationMs += now - enterTime
        }
      })
      const lastEnter = enters[enters.length - 1]
      const lastExit = exits[exits.length - 1]
      if (lastExit && new Date(lastExit.changed_at).getTime() > new Date(lastEnter.changed_at).getTime()) {
        fin = lastExit.changed_at
      }
    }

    let status: CardStatus
    if (estado === currentEstado) status = 'activo'
    else if (enters.length > 0 && fin) status = 'completado'
    else if (enters.length > 0 && !fin) status = 'activo'
    else if (currentIdx >= 0 && idx < currentIdx && enters.length === 0) status = 'saltado'
    else status = 'pendiente'

    return { estado, status, inicio, fin, durationMs, visits: enters.length, fase }
  })
}

const STATUS_VISUAL: Record<CardStatus, { bg: string; border: string; check: string; checkBg: string; opacity: number }> = {
  completado: { bg: '#0f1f15', border: '#00d97e44', check: '#00d97e', checkBg: '#00d97e22', opacity: 1 },
  activo:     { bg: 'rgba(94,114,228,.10)', border: '#5e72e4', check: '#5e72e4', checkBg: '#5e72e433', opacity: 1 },
  pendiente:  { bg: '#0f0f15', border: '#2a2a40', check: '#3a3a55', checkBg: '#1a1a28', opacity: 0.5 },
  saltado:    { bg: '#1a1525', border: '#a78bfa44', check: '#a78bfa', checkBg: '#a78bfa22', opacity: 0.7 },
}

export default function ProcesoTimeline({ cliente }: Props) {
  const primaryCycle = cliente.ciclo_mes || currentCicloMes()
  const [selectedCycle, setSelectedCycle] = useState<string>(primaryCycle)
  const [logs, setLogs] = useState<EstadoLog[]>([])
  const [loading, setLoading] = useState(true)
  const [estadoLoopForCycle, setEstadoLoopForCycle] = useState<string | null>(null)

  const cycleOptions = useMemo(() => {
    const set = new Set<string>([primaryCycle, currentCicloMes()])
    let p = primaryCycle
    for (let i = 0; i < 6; i++) { p = prevCicloMes(p); set.add(p) }
    let n = primaryCycle
    for (let i = 0; i < 6; i++) { n = nextCicloMes(n); set.add(n) }
    return Array.from(set).sort()
  }, [primaryCycle])

  const reload = async () => {
    setLoading(true)
    // Filtro ESTRICTO por ciclo — sin nulls. Los logs viejos sin ciclo_mes no entran.
    const { data: logsData } = await supabase
      .from('estado_log')
      .select('*')
      .eq('cliente_id', cliente.id)
      .eq('ciclo_mes', selectedCycle)
      .order('changed_at', { ascending: true })
    setLogs((logsData ?? []) as EstadoLog[])

    const { data: rec } = await supabase
      .from('cliente_ciclo_recursos')
      .select('estado_loop')
      .eq('cliente_id', cliente.id)
      .eq('ciclo_mes', selectedCycle)
      .maybeSingle()
    setEstadoLoopForCycle(rec?.estado_loop ?? null)
    setLoading(false)
  }

  useEffect(() => { reload() /* eslint-disable-line */ }, [cliente.id, selectedCycle])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => { reload() }
    window.addEventListener('estado-loop-changed', handler)
    window.addEventListener('clientes-refresh', handler)
    return () => {
      window.removeEventListener('estado-loop-changed', handler)
      window.removeEventListener('clientes-refresh', handler)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente.id, selectedCycle])

  const isPrimaryView = selectedCycle === primaryCycle
  const currentEstado = isPrimaryView
    ? (cliente.estado || estadoLoopForCycle || null)
    : estadoLoopForCycle

  const cards = useMemo(() => buildCards(logs, currentEstado), [logs, currentEstado])

  const stats = useMemo(() => {
    const c = { completados: 0, activos: 0, pendientes: 0, saltados: 0 }
    cards.forEach(card => {
      if (card.status === 'completado') c.completados++
      else if (card.status === 'activo') c.activos++
      else if (card.status === 'saltado') c.saltados++
      else c.pendientes++
    })
    return c
  }, [cards])

  const totalSteps = ESTADO_OPTIONS_ONGOING.length
  const completedPct = Math.round(((stats.completados + stats.activos * 0.5) / totalSteps) * 100)
  const activeCard = cards.find(c => c.status === 'activo')
  const totalDuration = cards.reduce((s, c) => s + c.durationMs, 0)

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      {/* Header con cycle selector */}
      <div style={{
        padding: '14px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap' as const, gap: 12,
        borderBottom: '1px solid #2a2a40',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' as const }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>
              {cliente.nombre}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
              Ciclo {cicloMesLabel(selectedCycle)}
            </span>
            {isPrimaryView && (
              <span style={{
                fontSize: 9, padding: '2px 7px', borderRadius: 3,
                background: 'rgba(94,114,228,.15)', color: '#5e72e4',
                fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.4,
              }}>primario</span>
            )}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: '#a0a0b8', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const }}>
            <span><strong style={{ color: '#00d97e' }}>{stats.completados}/{totalSteps}</strong> completados</span>
            {stats.saltados > 0 && <span style={{ color: '#a78bfa' }}>· {stats.saltados} saltados</span>}
            {totalDuration > 0 && <span>· tiempo activo: <strong>{formatDuration(totalDuration)}</strong></span>}
          </div>
        </div>
        <select value={selectedCycle} onChange={e => setSelectedCycle(e.target.value)}
          style={{
            padding: '6px 12px', background: '#1a1a28', border: '1px solid #2a2a40',
            borderRadius: 6, color: '#5e72e4', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', textTransform: 'capitalize' as const,
          }}>
          {cycleOptions.map(c => <option key={c} value={c}>{cicloMesLabel(c)}</option>)}
        </select>
      </div>

      {/* Cards horizontales */}
      <div style={{
        padding: 16, paddingBottom: 12,
        overflowX: 'auto' as const, position: 'relative' as const,
      }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center' as const, color: '#6a6a80', fontSize: 12 }}>
            Cargando timeline…
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' as const, minWidth: 'max-content' }}>
            {cards.map((card, idx) => {
              const v = STATUS_VISUAL[card.status]
              const fmeta = FASE_META[card.fase] ?? FASE_META.edicion
              const estadoStyle = getEstadoStyle(card.estado)
              const isLast = idx === cards.length - 1
              return (
                <div key={card.estado} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{
                    width: 138, padding: '10px 8px',
                    background: v.bg, border: `1px solid ${v.border}`,
                    borderRadius: 8,
                    opacity: v.opacity,
                    position: 'relative' as const,
                    minHeight: 110,
                    display: 'flex', flexDirection: 'column' as const, gap: 4,
                  }}>
                    {/* Status check top-right */}
                    <div style={{
                      position: 'absolute' as const, top: 6, right: 6,
                      width: 18, height: 18, borderRadius: '50%',
                      background: v.checkBg, color: v.check,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9,
                    }}>
                      {card.status === 'completado' && <i className="fas fa-check" />}
                      {card.status === 'activo' && <i className="fas fa-circle" style={{ fontSize: 7 }} />}
                      {card.status === 'saltado' && <i className="fas fa-forward" />}
                      {card.status === 'pendiente' && <span style={{ fontSize: 8 }}>○</span>}
                    </div>

                    {/* Fase chip arriba */}
                    <div style={{
                      fontSize: 8, fontWeight: 700, color: fmeta.color,
                      textTransform: 'uppercase' as const, letterSpacing: 0.4,
                      opacity: 0.7,
                    }}>
                      <i className={`fas ${fmeta.icon}`} style={{ marginRight: 4, fontSize: 8 }} />
                      {fmeta.label}
                    </div>

                    {/* Estado */}
                    <div style={{
                      fontSize: 10, fontWeight: 800,
                      color: card.status === 'pendiente' ? '#6a6a80' : estadoStyle.color,
                      lineHeight: 1.2,
                      paddingRight: 22, // reservar espacio para el check
                    }}>
                      {card.estado}
                    </div>

                    {/* Footer info */}
                    <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column' as const, gap: 2 }}>
                      {card.status === 'activo' && (
                        <div style={{ fontSize: 9, color: '#5e72e4', fontWeight: 700 }}>
                          <i className="fas fa-bolt" style={{ marginRight: 3 }} />
                          en curso
                        </div>
                      )}
                      {card.durationMs > 0 && (
                        <div style={{
                          fontSize: 10, fontWeight: 700,
                          color: card.durationMs > 7 * 86400000 ? '#f5a623' : '#a0a0b8',
                        }}>
                          {formatDuration(card.durationMs)}
                        </div>
                      )}
                      {card.inicio && (
                        <div style={{ fontSize: 9, color: '#6a6a80' }}>
                          {formatDate(card.inicio)}
                          {card.fin && <> → {formatDate(card.fin)}</>}
                          {card.status === 'activo' && !card.fin && <> →</>}
                        </div>
                      )}
                      {card.visits > 1 && (
                        <div style={{ fontSize: 9, color: '#f5365c', fontWeight: 700 }}>
                          🔄 {card.visits} visitas
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Connector arrow */}
                  {!isLast && (
                    <div style={{
                      width: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#3a3a55',
                    }}>
                      <i className="fas fa-chevron-right" style={{ fontSize: 8 }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Progress bar global */}
      <div style={{ padding: '0 18px 14px' }}>
        <div style={{ height: 4, background: '#1a1a28', borderRadius: 2, overflow: 'hidden' as const }}>
          <div style={{
            width: `${completedPct}%`, height: '100%',
            background: completedPct === 100 ? '#00d97e' : 'linear-gradient(90deg, #5e72e4 0%, #00d97e 100%)',
            transition: 'width .4s',
          }} />
        </div>
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#a0a0b8' }}>
          <span>
            {activeCard ? (
              <>
                <i className="fas fa-play-circle" style={{ color: '#5e72e4', marginRight: 6 }} />
                <strong style={{ color: '#5e72e4' }}>En curso:</strong> {activeCard.estado}
                {activeCard.inicio && (
                  <span style={{ color: '#6a6a80' }}>{' '}· desde {formatDate(activeCard.inicio)}</span>
                )}
                {activeCard.durationMs > 0 && (
                  <span style={{ color: '#6a6a80' }}>{' '}· {formatDuration(activeCard.durationMs)}</span>
                )}
              </>
            ) : (
              <span style={{ color: '#6a6a80', fontStyle: 'italic' as const }}>Sin estado activo</span>
            )}
          </span>
          <span style={{ fontWeight: 700, color: completedPct === 100 ? '#00d97e' : '#a0a0b8' }}>
            {completedPct}%
          </span>
        </div>
      </div>

      {logs.length === 0 && !loading && (
        <div style={{
          padding: '14px 18px', borderTop: '1px solid #2a2a40',
          fontSize: 11, color: '#6a6a80', fontStyle: 'italic' as const,
          background: '#0a0a0f',
        }}>
          <i className="fas fa-circle-info" style={{ marginRight: 6 }} />
          No hay movimientos de estado registrados para el ciclo <strong style={{ textTransform: 'capitalize' as const }}>{cicloMesLabel(selectedCycle)}</strong>. Cuando muevas el batch entre estados (Producción / Owners FOCO / Edición), las fechas aparecerán acá.
        </div>
      )}
    </div>
  )
}

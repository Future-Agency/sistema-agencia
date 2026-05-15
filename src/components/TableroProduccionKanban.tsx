'use client'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { SemaforoIcon } from './ui'
import { supabase, type Cliente, type Owner, type Equipo, type Pieza } from '@/lib/supabase'
import type { CurrentUser } from '@/lib/users'
import { ESTADO_OPTIONS_ONGOING, ESTADO_COLORS, ESTADO_FASE } from '@/lib/estados'
import { cicloMesLabel, parseCicloMes } from '@/lib/cycles'
import { PIPELINE_BY_TIPO } from '@/lib/piezas'
import { deriveEstadoLoop, setEstadoLoop } from '@/lib/loopState'

type Props = {
  agenciaId: string
  clientes: Cliente[]
  owners: Owner[]
  equipo: Equipo[]
  currentUser: CurrentUser
  onSelectCliente: (c: Cliente) => void
  ownerFilter: string
  onSwitchToMatrix: () => void
}

type Batch = {
  key: string                 // `${cliente_id}::${ciclo_mes}`
  cliente: Cliente
  cicloMes: string
  estadoEffective: string     // manual override OR derivado
  isManual: boolean
  piezas: Pieza[]
  totalPiezas: number
  aprobadas: number
}

const FASE_META: Record<string, { color: string; icon: string; label: string }> = {
  guion:     { label: 'Copys',      color: '#a78bfa', icon: 'fa-pen-fancy' },
  grabacion: { label: 'Producción', color: '#5e72e4', icon: 'fa-video' },
  edicion:   { label: 'Edición',    color: '#fb6340', icon: 'fa-film' },
  diseno:    { label: 'Diseño',     color: '#ec4ad8', icon: 'fa-palette' },
  revision:  { label: 'Revisión',   color: '#f5d623', icon: 'fa-magnifying-glass' },
  subida:    { label: 'Subida',     color: '#00d97e', icon: 'fa-calendar-check' },
  anuncios:  { label: 'Anuncios',   color: '#f5a623', icon: 'fa-bullhorn' },
}

// Color de chip de ciclo (consistente por hash del ciclo_mes)
function colorForCycle(cicloMes: string): string {
  const palette = ['#5e72e4', '#a78bfa', '#00d97e', '#f5a623', '#ec4ad8', '#11cdef', '#fb6340', '#84cc16']
  let h = 0
  for (let i = 0; i < cicloMes.length; i++) h = (h * 31 + cicloMes.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}

function isFullyApproved(p: Pieza): boolean {
  const pipeline = PIPELINE_BY_TIPO[p.tipo]
  for (const area of pipeline) {
    const col = area === 'edit' ? 'estado_edicion' : `estado_${area}`
    const v = (p as Record<string, unknown>)[col] as string | null
    const upper = (v || '').toUpperCase()
    const isApprovedHere =
      upper === 'APROBADO' || upper === 'PUBLICADO' || upper === 'METRICAS' || upper === 'MÉTRICAS' ||
      upper === 'METRICAS Y VOLVER A EMPEZAR' || upper === 'VOLVER A EMPEZAR' ||
      upper === 'MATERIAL APROBADO' || upper === 'MATERIAL SUBIDO' || upper === 'LISTO PARA GRABAR'
    if (!isApprovedHere) return false
  }
  return true
}

function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr.length === 10 ? dateStr + 'T12:00:00' : dateStr)
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export default function TableroProduccionKanban({
  agenciaId, clientes, owners, equipo, currentUser: _cu, onSelectCliente, ownerFilter, onSwitchToMatrix,
}: Props) {
  const [piezas, setPiezas] = useState<Pieza[]>([])
  const [estadosLoop, setEstadosLoop] = useState<Map<string, string>>(new Map())  // key: cliente_id-ciclo
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [search, setSearch] = useState('')
  // Optimistic overrides — para que el drag se vea instantáneo
  const [optimistic, setOptimistic] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  // Mostrar/ocultar estados vacíos
  const [hideEmpty, setHideEmpty] = useState(true)

  const ownerById = useMemo(() => {
    const m = new Map<string, Owner>()
    owners.forEach(o => m.set(o.id, o))
    return m
  }, [owners])

  const equipoById = useMemo(() => {
    const m = new Map<string, Equipo>()
    equipo.forEach(e => m.set(e.id, e))
    return m
  }, [equipo])

  // Para cross-cycle awareness — agrupar batches por cliente
  const batchesByCliente = useMemo(() => {
    // se llena después de calcular batches; ver useMemo abajo (hooks-order)
    return new Map<number, Batch[]>()
  }, [])

  const visibleClienteIds = useMemo(() => {
    // Onboarding también aparece en Producción — el equipo ve toda la producción acá,
    // no sólo los clientes "ciclo normal".
    let list = clientes
    if (ownerFilter === '__none__') list = list.filter(c => !c.owner_id)
    else if (ownerFilter) list = list.filter(c => c.owner_id === ownerFilter)
    return new Set(list.map(c => c.id))
  }, [clientes, ownerFilter])

  // Fetch silencioso — no toca loading. Para refreshes por eventos realtime.
  const fetchAll = async () => {
    const { data, error } = await supabase.from('piezas').select('*').eq('agencia_id', agenciaId)
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.toLowerCase().includes('does not exist')) {
        setTableMissing(true); setPiezas([]); return
      }
      console.error('[kanban piezas]', error); setPiezas([]); return
    }
    setPiezas((data ?? []) as Pieza[])
    const { data: rec } = await supabase
      .from('cliente_ciclo_recursos')
      .select('cliente_id, ciclo_mes, estado_loop')
      .eq('agencia_id', agenciaId)
      .not('estado_loop', 'is', null)
    const m = new Map<string, string>()
    for (const r of rec ?? []) {
      if (r.estado_loop) m.set(`${r.cliente_id}::${r.ciclo_mes}`, r.estado_loop as string)
    }
    setEstadosLoop(m)
  }

  // Carga "ruidosa" — muestra skeleton. Sólo para load inicial / cambio de agencia.
  const loadAll = async () => {
    setLoading(true)
    await fetchAll()
    setLoading(false)
  }

  useEffect(() => { loadAll() /* eslint-disable-line */ }, [agenciaId])

  // Realtime: cuando cambia estado-loop en otra pestaña/device, refetch silencioso (no parpadea)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => { fetchAll() }
    window.addEventListener('estado-loop-changed', handler)
    return () => window.removeEventListener('estado-loop-changed', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agenciaId])

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  // Limpiar optimistic cuando llega data fresca
  useEffect(() => {
    setOptimistic(prev => {
      const next = { ...prev }
      let changed = false
      for (const k of Object.keys(prev)) {
        if (estadosLoop.get(k) === prev[k]) {
          delete next[k]; changed = true
        }
      }
      return changed ? next : prev
    })
  }, [estadosLoop])

  // Construir batches
  const batches = useMemo<Batch[]>(() => {
    const map = new Map<string, Batch>()
    const filteredPiezas = piezas.filter(p => visibleClienteIds.has(p.cliente_id))
    for (const p of filteredPiezas) {
      const key = `${p.cliente_id}::${p.ciclo_mes}`
      let b = map.get(key)
      if (!b) {
        const cliente = clientes.find(c => c.id === p.cliente_id)
        if (!cliente) continue
        b = {
          key, cliente, cicloMes: p.ciclo_mes,
          estadoEffective: '', isManual: false,
          piezas: [], totalPiezas: 0, aprobadas: 0,
        }
        map.set(key, b)
      }
      b.piezas.push(p)
      b.totalPiezas++
      if (isFullyApproved(p)) b.aprobadas++
    }
    // Resolver estado efectivo: optimistic > manual > derivado
    Array.from(map.values()).forEach(b => {
      const opt = optimistic[b.key]
      if (opt) { b.estadoEffective = opt; b.isManual = true; return }
      const manual = estadosLoop.get(b.key)
      if (manual) { b.estadoEffective = manual; b.isManual = true; return }
      b.estadoEffective = deriveEstadoLoop(b.piezas) || ''
      b.isManual = false
    })
    let arr = Array.from(map.values())
    if (search.trim()) {
      const q = search.toLowerCase()
      arr = arr.filter(b => b.cliente.nombre.toLowerCase().includes(q))
    }
    // ordenar dentro de cada estado: por cliente y luego ciclo
    arr.sort((a, b) => a.cliente.nombre.localeCompare(b.cliente.nombre) || a.cicloMes.localeCompare(b.cicloMes))
    return arr
  }, [piezas, clientes, visibleClienteIds, estadosLoop, optimistic, search])

  // Group por estado
  const byEstado = useMemo(() => {
    const result: Record<string, Batch[]> = {}
    ESTADO_OPTIONS_ONGOING.forEach(e => { result[e] = [] })
    result['COMPLETADO'] = []  // bucket extra para batches 100% terminados
    // Fallback: estados legacy o vacíos caen acá → así nunca se pierde un batch silenciosamente
    const fallbackBucket = ESTADO_OPTIONS_ONGOING[0] ?? 'COMPLETADO'
    batches.forEach(b => {
      const k = b.estadoEffective || ''
      if (result[k] !== undefined) result[k].push(b)
      else result[fallbackBucket].push(b)
    })
    return result
  }, [batches])

  // Cross-cycle: por cliente, lista los OTROS batches (otros ciclos)
  const otherCyclesByCliente = useMemo(() => {
    const m = new Map<number, Batch[]>()
    batches.forEach(b => {
      if (!m.has(b.cliente.id)) m.set(b.cliente.id, [])
      m.get(b.cliente.id)!.push(b)
    })
    return m
  }, [batches])

  const totalBatches = batches.length

  // Lista de estados a mostrar
  const visibleStates = useMemo(() => {
    const all = [...ESTADO_OPTIONS_ONGOING, 'COMPLETADO']
    if (!hideEmpty) return all
    return all.filter(e => byEstado[e]?.length > 0)
  }, [byEstado, hideEmpty])

  const onDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination) return
    const destEstado = result.destination.droppableId
    const key = result.draggableId
    const batch = batches.find(b => b.key === key)
    if (!batch) return
    if (batch.estadoEffective === destEstado) return

    // 1. Optimistic — flushSync para que React committee ANTES de que el dnd haga snap-back
    flushSync(() => {
      setOptimistic(prev => ({ ...prev, [key]: destEstado }))
      setSavingKey(key)
    })

    // 2. Persistir
    const [cidStr, ciclo] = key.split('::')
    const res = await setEstadoLoop({
      agenciaId, clienteId: Number(cidStr), cicloMes: ciclo,
      estado: destEstado === 'COMPLETADO' ? null : destEstado,
    })
    setSavingKey(null)
    if (!res.ok) {
      setOptimistic(prev => { const n = { ...prev }; delete n[key]; return n })
      setToast({ msg: `Error: ${res.error}`, type: 'err' })
      return
    }
    // Mergear en estadosLoop local + limpiar optimistic
    setEstadosLoop(prev => {
      const next = new Map(prev)
      if (destEstado === 'COMPLETADO') next.delete(key)
      else next.set(key, destEstado)
      return next
    })
    setOptimistic(prev => { const n = { ...prev }; delete n[key]; return n })
    setToast({ msg: `${batch.cliente.nombre} · ${cicloMesLabel(batch.cicloMes).split(' ')[0]} → ${destEstado}`, type: 'ok' })
  }, [batches, agenciaId])

  return (
    <div className="fade-in">
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' as const }}>
        <input type="text" placeholder="Buscar cliente…" value={search} onChange={e => setSearch(e.target.value)}
          style={{
            padding: '6px 12px', minWidth: 200, flex: '0 1 240px',
            background: '#1a1a28', border: '1px solid #2a2a40', borderRadius: 6,
            color: '#e8e8f0', fontSize: 12, outline: 'none',
          }} />
        <button onClick={() => setHideEmpty(!hideEmpty)}
          style={{
            padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            background: hideEmpty ? '#1a1a28' : 'rgba(94,114,228,.15)',
            border: `1px solid ${hideEmpty ? '#2a2a40' : '#5e72e4'}`,
            color: hideEmpty ? '#a0a0b8' : '#5e72e4',
          }}>
          <i className={`fas ${hideEmpty ? 'fa-eye-slash' : 'fa-eye'}`} style={{ marginRight: 6 }} />
          {hideEmpty ? 'Ocultar vacíos' : 'Mostrar todos'}
        </button>
        <button onClick={onSwitchToMatrix}
          style={{
            padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            background: '#1a1a28', border: '1px solid #2a2a40', color: '#a0a0b8',
            marginLeft: 'auto',
          }}>
          <i className="fas fa-table-cells" style={{ marginRight: 6 }} />
          Vista matriz
        </button>
      </div>

      {/* Stats summary */}
      <div style={{
        display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 14,
        padding: 8, background: '#12121a', borderRadius: 8, border: '1px solid #2a2a40',
      }}>
        <span style={{ fontSize: 11, color: '#a0a0b8', alignSelf: 'center' as const, marginRight: 6 }}>
          <strong>{totalBatches}</strong> batches activos
        </span>
        {ESTADO_OPTIONS_ONGOING.map(estado => {
          const count = byEstado[estado]?.length ?? 0
          if (count === 0) return null
          const style = ESTADO_COLORS[estado] || { bg: '#22223a', color: '#a0a0b8' }
          return (
            <a key={estado} href={`#k-${estado.replace(/[^a-zA-Z0-9]/g, '-')}`}
              style={{
                fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                background: style.bg, color: style.color,
                border: `1px solid ${style.color}33`,
                textDecoration: 'none' as const,
                textTransform: 'uppercase' as const, letterSpacing: 0.3,
              }}>
              {estado.length > 18 ? estado.slice(0, 16) + '…' : estado} <strong style={{ marginLeft: 4 }}>{count}</strong>
            </a>
          )
        })}
        {byEstado['COMPLETADO']?.length > 0 && (
          <a href="#k-COMPLETADO"
            style={{
              fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
              background: 'rgba(0,217,126,.15)', color: '#00d97e',
              border: '1px solid rgba(0,217,126,.33)',
              textDecoration: 'none' as const, textTransform: 'uppercase' as const, letterSpacing: 0.3,
            }}>
            COMPLETADOS <strong style={{ marginLeft: 4 }}>{byEstado['COMPLETADO'].length}</strong>
          </a>
        )}
      </div>

      {tableMissing && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 14,
          background: 'rgba(245,54,92,.10)', border: '1px solid rgba(245,54,92,.25)',
          color: '#f5365c', fontSize: 12,
        }}>
          La tabla <code>piezas</code> no existe — aplicá <code>sql/2026-05-08_phase_A_piezas.sql</code>.
        </div>
      )}

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center' as const, color: '#6a6a80' }}>Cargando batches…</div>
      ) : totalBatches === 0 ? (
        <div style={{
          padding: 32, textAlign: 'center' as const, color: '#6a6a80',
          background: '#12121a', borderRadius: 10, border: '1px solid #2a2a40',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <p style={{ fontSize: 13 }}>Sin batches generados todavía.</p>
          <p style={{ fontSize: 11 }}>Abrí un cliente → tab <strong>Piezas del mes</strong> → <strong>Generar batch</strong>.</p>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
            {visibleStates.map(estado => {
              const list = byEstado[estado] ?? []
              const isCompletado = estado === 'COMPLETADO'
              const style = isCompletado
                ? { color: '#00d97e', bg: 'rgba(0,217,126,.15)' }
                : (ESTADO_COLORS[estado] || { color: '#a0a0b8', bg: '#22223a' })
              const fase = ESTADO_FASE[estado] ?? 'edicion'
              const faseMeta = isCompletado
                ? { color: '#00d97e', icon: 'fa-check-circle', label: 'Cerrado' }
                : (FASE_META[fase] ?? FASE_META.edicion)

              return (
                <Droppable key={estado} droppableId={estado} direction="horizontal">
                  {(provided, snapshot) => (
                    <div
                      id={`k-${estado.replace(/[^a-zA-Z0-9]/g, '-')}`}
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      style={{
                        borderRadius: 10,
                        background: snapshot.isDraggingOver ? `${style.color}10` : '#12121a',
                        border: `1px solid ${snapshot.isDraggingOver ? style.color : style.color + '33'}`,
                        scrollMarginTop: 100,
                      }}
                    >
                      {/* Section header */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 14px',
                        borderLeft: `4px solid ${style.color}`,
                        borderTopLeftRadius: 10,
                        borderBottomLeftRadius: list.length > 0 ? 0 : 10,
                        background: `${style.color}08`,
                      }}>
                        <i className={`fas ${faseMeta.icon}`} style={{ color: faseMeta.color, fontSize: 11, width: 14 }} />
                        <span style={{
                          fontSize: 10, color: faseMeta.color, fontWeight: 600,
                          textTransform: 'uppercase' as const, letterSpacing: 0.4, opacity: 0.7,
                        }}>
                          {faseMeta.label} ›
                        </span>
                        <span style={{
                          fontSize: 13, fontWeight: 800, color: style.color,
                          textTransform: 'uppercase' as const, letterSpacing: 0.4,
                        }}>
                          {estado}
                        </span>
                        <span style={{
                          background: list.length > 0 ? style.color + '22' : '#2a2a40',
                          color: list.length > 0 ? style.color : '#6a6a80',
                          padding: '1px 8px', borderRadius: 10,
                          fontSize: 10, fontWeight: 700,
                        }}>
                          {list.length}
                        </span>
                        {list.length === 0 && (
                          <span style={{ fontSize: 10, color: '#3a3a55', fontStyle: 'italic' as const, marginLeft: 'auto' }}>
                            arrastrá batches aquí
                          </span>
                        )}
                      </div>

                      {/* Cards row */}
                      {list.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, padding: 10 }}>
                          {list.map((b, index) => {
                            const cycleColor = colorForCycle(b.cicloMes)
                            const owner = b.cliente.owner_id ? ownerById.get(b.cliente.owner_id) : null
                            const cycleParsed = parseCicloMes(b.cicloMes)
                            const isSaving = savingKey === b.key
                            const pct = b.totalPiezas > 0 ? Math.round((b.aprobadas / b.totalPiezas) * 100) : 0
                            return (
                              <Draggable key={b.key} draggableId={b.key} index={index}>
                                {(dragProvided, dragSnapshot) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    style={{
                                      ...dragProvided.draggableProps.style,
                                      width: 220,
                                      padding: 10,
                                      background: dragSnapshot.isDragging ? '#22223a' : '#1a1a28',
                                      borderRadius: 8,
                                      borderLeft: `3px solid ${cycleColor}`,
                                      border: `1px solid ${isSaving ? style.color + '88' : '#2a2a40'}`,
                                      boxShadow: dragSnapshot.isDragging ? '0 8px 24px rgba(0,0,0,.5)'
                                        : isSaving ? `0 0 0 1px ${style.color}88` : 'none',
                                      cursor: 'grab',
                                      opacity: isSaving ? 0.7 : 1,
                                      transition: 'opacity .15s, box-shadow .15s',
                                    }}
                                  >
                                    {/* Cycle badge + manual indicator */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                      <span style={{
                                        fontSize: 9, fontWeight: 800,
                                        padding: '2px 6px', borderRadius: 3,
                                        background: cycleColor + '22', color: cycleColor,
                                        border: `1px solid ${cycleColor}44`,
                                        textTransform: 'uppercase' as const, letterSpacing: 0.4,
                                      }}>
                                        {cycleParsed?.label.split(' ')[0] || b.cicloMes}
                                      </span>
                                      {!b.isManual && (
                                        <span title="Estado derivado de las piezas (no manual)" style={{
                                          fontSize: 8, padding: '1px 5px', borderRadius: 3,
                                          background: 'rgba(167,139,250,.15)', color: '#a78bfa',
                                          fontWeight: 700,
                                        }}>auto</span>
                                      )}
                                    </div>

                                    {/* Cliente name (clickable to detail) */}
                                    <div onClick={(e) => { e.stopPropagation(); onSelectCliente(b.cliente) }}
                                      style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, cursor: 'pointer' }}
                                      onMouseEnter={e => (e.currentTarget.style.color = '#5e72e4')}
                                      onMouseLeave={e => (e.currentTarget.style.color = '#e8e8f0')}>
                                      {b.cliente.nombre}
                                    </div>

                                    {/* Owner */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 6 }}>
                                      {owner && (
                                        <span style={{
                                          width: 18, height: 18, borderRadius: 4,
                                          background: owner.color + '22', color: owner.color,
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          fontWeight: 700, fontSize: 9, flexShrink: 0,
                                        }}>{owner.nombre_corto[0]}</span>
                                      )}
                                      <span style={{ color: '#a0a0b8', fontSize: 10 }}>
                                        {owner?.nombre_corto || 'Sin asignar'}
                                      </span>
                                    </div>

                                    {/* Progress bar */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                                      <div style={{ flex: 1, height: 4, background: '#0a0a0f', borderRadius: 2, overflow: 'hidden' as const }}>
                                        <div style={{
                                          width: `${pct}%`, height: '100%',
                                          background: pct === 100 ? '#00d97e' : pct >= 50 ? '#5e72e4' : pct > 0 ? '#f5a623' : '#3a3a55',
                                          transition: 'width .3s',
                                        }} />
                                      </div>
                                      <span style={{ fontSize: 10, color: '#6a6a80', fontWeight: 700, minWidth: 36, textAlign: 'right' as const }}>
                                        {b.aprobadas}/{b.totalPiezas}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            )
                          })}
                          {provided.placeholder}
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              )
            })}
          </div>
        </DragDropContext>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 999,
          padding: '10px 16px', borderRadius: 8,
          background: toast.type === 'ok' ? 'rgba(0,217,126,.15)' : 'rgba(245,54,92,.15)',
          border: `1px solid ${toast.type === 'ok' ? '#00d97e' : '#f5365c'}`,
          color: toast.type === 'ok' ? '#00d97e' : '#f5365c',
          fontSize: 12, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,.3)',
        }}>
          <i className={`fas ${toast.type === 'ok' ? 'fa-check-circle' : 'fa-exclamation-circle'}`} style={{ marginRight: 6 }} />
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function teamBadge(color: string, _emoji: string): React.CSSProperties {
  return {
    fontSize: 9, padding: '1px 5px', borderRadius: 3,
    background: color + '22', color,
    fontWeight: 600, whiteSpace: 'nowrap' as const,
  }
}

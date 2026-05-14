'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase, type Cliente, type Owner, type Pieza, type PiezaTipo } from '@/lib/supabase'
import type { CurrentUser, UserArea } from '@/lib/users'
import { cicloMesLabel, listCyclesInUse, currentCicloMes } from '@/lib/cycles'
import { PIPELINE_BY_TIPO, PIEZA_META } from '@/lib/piezas'
import { deriveEstadoLoop, bulkQueryEstadoLoop } from '@/lib/loopState'
import { getEstadoStyle } from '@/lib/estados'

type Props = {
  agenciaId: string
  clientes: Cliente[]
  owners: Owner[]
  currentUser: CurrentUser
  onSelectCliente: (c: Cliente) => void
  ownerFilter: string
}

type AreaCell = {
  total: number
  aprobadas: number
  enProgreso: number
  pendientes: number
}

type BatchRow = {
  cliente: Cliente
  cicloMes: string
  porArea: Record<UserArea, AreaCell>
  totalPiezas: number
  totalAprobadas: number
}

const AREAS: UserArea[] = ['copys', 'grab', 'edit', 'diseno', 'subida', 'anuncios']
const AREA_META: Record<UserArea, { label: string; emoji: string; color: string }> = {
  copys:    { label: 'Copys',    emoji: '✍️', color: '#a78bfa' },
  grab:     { label: 'Grab',     emoji: '🎥', color: '#5e72e4' },
  edit:     { label: 'Edit',     emoji: '✂️', color: '#fb6340' },
  diseno:   { label: 'Diseño',   emoji: '🎨', color: '#ec4ad8' },
  subida:   { label: 'Subida',   emoji: '🚀', color: '#00d97e' },
  anuncios: { label: 'Reportes', emoji: '📊', color: '#f5a623' },
}

function colNameFor(area: UserArea): keyof Pieza {
  if (area === 'edit') return 'estado_edicion'
  return `estado_${area}` as keyof Pieza
}

function isApproved(value: string | null): boolean {
  if (!value) return false
  const v = value.toUpperCase()
  return v === 'APROBADO' || v === 'PUBLICADO' || v === 'MÉTRICAS' || v === 'METRICAS'
    || v === 'MATERIAL APROBADO' || v === 'MATERIAL SUBIDO' || v === 'LISTO PARA GRABAR'
    || v === 'METRICAS Y VOLVER A EMPEZAR' || v === 'VOLVER A EMPEZAR'
}

function isInProgress(value: string | null): boolean {
  return !!value && value.length > 0 && !isApproved(value)
}

function newCell(): AreaCell {
  return { total: 0, aprobadas: 0, enProgreso: 0, pendientes: 0 }
}

function aggregateBatches(piezas: Pieza[], clientesById: Map<number, Cliente>): BatchRow[] {
  const map = new Map<string, BatchRow>()
  for (const p of piezas) {
    const key = `${p.cliente_id}-${p.ciclo_mes}`
    let row = map.get(key)
    if (!row) {
      const cliente = clientesById.get(p.cliente_id)
      if (!cliente) continue
      row = {
        cliente, cicloMes: p.ciclo_mes,
        porArea: {
          copys: newCell(), grab: newCell(), edit: newCell(),
          diseno: newCell(), subida: newCell(), anuncios: newCell(),
        },
        totalPiezas: 0, totalAprobadas: 0,
      }
      map.set(key, row)
    }
    row.totalPiezas++
    // Para cada área del pipeline de la pieza, contar
    const pipeline = PIPELINE_BY_TIPO[p.tipo]
    let pieceFullyApproved = true
    for (const area of pipeline) {
      const col = colNameFor(area)
      const value = (p as Record<string, unknown>)[col] as string | null
      const cell = row.porArea[area]
      cell.total++
      if (isApproved(value)) cell.aprobadas++
      else if (isInProgress(value)) { cell.enProgreso++; pieceFullyApproved = false }
      else { cell.pendientes++; pieceFullyApproved = false }
    }
    if (pieceFullyApproved) row.totalAprobadas++
  }
  return Array.from(map.values()).sort((a, b) => {
    // primero por ciclo más reciente, después alfabético
    if (a.cicloMes !== b.cicloMes) return b.cicloMes.localeCompare(a.cicloMes)
    return a.cliente.nombre.localeCompare(b.cliente.nombre)
  })
}

// Color por progreso en una celda
function cellTone(cell: AreaCell): { color: string; bg: string; pct: number } | null {
  if (cell.total === 0) return null
  const pct = cell.aprobadas / cell.total
  if (pct === 1) return { color: '#00d97e', bg: 'rgba(0,217,126,.15)', pct }
  if (pct >= 0.66) return { color: '#5e72e4', bg: 'rgba(94,114,228,.12)', pct }
  if (pct >= 0.33) return { color: '#f5a623', bg: 'rgba(245,166,35,.12)', pct }
  if (pct > 0) return { color: '#fbbf24', bg: 'rgba(251,191,36,.10)', pct }
  // 0% pero piezas existen → recién empezando o pendiente
  if (cell.enProgreso > 0) return { color: '#a78bfa', bg: 'rgba(167,139,250,.10)', pct: 0 }
  return { color: '#3a3a55', bg: '#1a1a28', pct: 0 }
}

export default function TableroProduccionMatrix({
  agenciaId, clientes, owners, currentUser: _cu, onSelectCliente, ownerFilter
}: Props) {
  const [piezas, setPiezas] = useState<Pieza[]>([])
  const [loading, setLoading] = useState(true)
  const [cycleFilter, setCycleFilter] = useState<string | 'all'>('all')
  const [search, setSearch] = useState('')
  const [tableMissing, setTableMissing] = useState(false)
  const [expanded, setExpanded] = useState<{ key: string; area: UserArea | 'anuncios' } | null>(null)
  // Estados manuales del loop por (cliente, ciclo) — Map<"cliente-ciclo", estado>
  const [estadosLoop, setEstadosLoop] = useState<Map<string, string>>(new Map())

  const clientesById = useMemo(() => {
    const m = new Map<number, Cliente>()
    clientes.forEach(c => m.set(c.id, c))
    return m
  }, [clientes])

  // Aplicar filter de owner sobre clientes (onboarding también entra en producción)
  const visibleClientesIds = useMemo(() => {
    let list = clientes
    if (ownerFilter === '__none__') list = list.filter(c => !c.owner_id)
    else if (ownerFilter) list = list.filter(c => c.owner_id === ownerFilter)
    return new Set(list.map(c => c.id))
  }, [clientes, ownerFilter])

  // Cargar piezas (todas de la agencia, filtramos en JS)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase.from('piezas').select('*').eq('agencia_id', agenciaId).then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.toLowerCase().includes('does not exist')) {
          setTableMissing(true); setPiezas([]); setLoading(false); return
        }
        console.error('[piezas matrix]', error)
        setPiezas([]); setLoading(false); return
      }
      setPiezas((data ?? []) as Pieza[])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [agenciaId])

  // Cargar estados manuales del loop (cliente_ciclo_recursos.estado_loop) para todos los ciclos visibles
  const reloadEstadosLoop = async () => {
    if (piezas.length === 0) { setEstadosLoop(new Map()); return }
    const cyclesPresent = Array.from(new Set(piezas.map(p => p.ciclo_mes)))
    const clienteIds = Array.from(new Set(piezas.map(p => p.cliente_id)))
    const results = await Promise.all(cyclesPresent.map(c => bulkQueryEstadoLoop(agenciaId, c, clienteIds).then(m => ({ ciclo: c, m }))))
    const merged = new Map<string, string>()
    for (const { ciclo, m } of results) {
      m.forEach((estado, cid) => merged.set(`${cid}-${ciclo}`, estado))
    }
    setEstadosLoop(merged)
  }

  useEffect(() => { reloadEstadosLoop() /* eslint-disable-line */ }, [piezas, agenciaId])

  // Realtime sync: si otra pestaña/device cambia un estado-loop, refetch
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => { reloadEstadosLoop() }
    window.addEventListener('estado-loop-changed', handler)
    return () => window.removeEventListener('estado-loop-changed', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piezas, agenciaId])

  // Filtrar piezas por owner + cycle
  const filteredPiezas = useMemo(() => {
    return piezas.filter(p => {
      if (!visibleClientesIds.has(p.cliente_id)) return false
      if (cycleFilter !== 'all' && p.ciclo_mes !== cycleFilter) return false
      return true
    })
  }, [piezas, visibleClientesIds, cycleFilter])

  // Agregar batches
  const allBatches = useMemo(() => aggregateBatches(filteredPiezas, clientesById), [filteredPiezas, clientesById])

  const filteredBatches = useMemo(() => {
    if (!search.trim()) return allBatches
    const q = search.toLowerCase()
    return allBatches.filter(b => b.cliente.nombre.toLowerCase().includes(q))
  }, [allBatches, search])

  const cyclesAvailable = useMemo(() => {
    const set = new Set<string>([currentCicloMes()])
    listCyclesInUse(clientes).forEach(c => set.add(c))
    piezas.forEach(p => set.add(p.ciclo_mes))
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [clientes, piezas])

  // Clientes sin piezas (para mostrar como "sin batch generado")
  const clientesWithBatches = useMemo(() => new Set(allBatches.map(b => b.cliente.id)), [allBatches])
  const clientesSinBatch = useMemo(() => {
    return Array.from(visibleClientesIds)
      .map(id => clientesById.get(id))
      .filter((c): c is Cliente => !!c && !clientesWithBatches.has(c.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [visibleClientesIds, clientesById, clientesWithBatches])

  // Drill-down: piezas de la celda expandida
  const drillPiezas = useMemo(() => {
    if (!expanded) return []
    const [clienteIdStr, cicloMes] = expanded.key.split('-')
    const clienteId = Number(clienteIdStr)
    return filteredPiezas.filter(p => {
      if (p.cliente_id !== clienteId || p.ciclo_mes !== cicloMes) return false
      if (expanded.area === 'anuncios') return p.califica_ads
      return PIPELINE_BY_TIPO[p.tipo].includes(expanded.area as UserArea)
    })
  }, [expanded, filteredPiezas])

  // Total summary chips
  const summary = useMemo(() => {
    const m = { total: filteredBatches.length, completos: 0 }
    filteredBatches.forEach(b => { if (b.totalAprobadas === b.totalPiezas) m.completos++ })
    return m
  }, [filteredBatches])

  return (
    <div className="fade-in">
      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' as const, alignItems: 'center' }}>
        {/* Cycle filter */}
        <span style={{ fontSize: 11, color: '#6a6a80', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.4 }}>Ciclo:</span>
        <button onClick={() => setCycleFilter('all')}
          style={chipStyle(cycleFilter === 'all', '#5e72e4')}>
          Todos
        </button>
        {cyclesAvailable.map(c => (
          <button key={c} onClick={() => setCycleFilter(c)}
            style={chipStyle(cycleFilter === c, '#5e72e4')}>
            <span style={{ textTransform: 'capitalize' as const }}>{cicloMesLabel(c).split(' ')[0]}</span>
          </button>
        ))}
        <input type="text" placeholder="Buscar cliente…" value={search} onChange={e => setSearch(e.target.value)}
          style={{
            marginLeft: 'auto', padding: '6px 12px', minWidth: 200,
            background: '#1a1a28', border: '1px solid #2a2a40', borderRadius: 6,
            color: '#e8e8f0', fontSize: 12, outline: 'none',
          }} />
      </div>

      {/* Stat chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' as const }}>
        <Stat label="Batches activos" value={summary.total} color="#5e72e4" />
        <Stat label="Completos" value={summary.completos} color="#00d97e" />
        <Stat label="En progreso" value={summary.total - summary.completos} color="#f5a623" />
        <Stat label="Sin batch generado" value={clientesSinBatch.length} color="#6a6a80" />
      </div>

      {tableMissing && (
        <div style={{
          marginBottom: 14, padding: '10px 14px', borderRadius: 8,
          background: 'rgba(245,54,92,.10)', border: '1px solid rgba(245,54,92,.25)',
          color: '#f5365c', fontSize: 12,
        }}>
          La tabla <code>piezas</code> no existe. Aplicá <code>sql/2026-05-08_phase_A_piezas.sql</code>.
        </div>
      )}

      {/* Matrix */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center' as const, color: '#6a6a80' }}>Cargando…</div>
      ) : filteredBatches.length === 0 ? (
        <div style={{
          padding: 32, textAlign: 'center' as const, color: '#6a6a80',
          background: '#12121a', borderRadius: 10, border: '1px solid #2a2a40',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <p style={{ fontSize: 13, marginBottom: 4 }}>Sin batches activos en este filtro.</p>
          <p style={{ fontSize: 11 }}>
            Generá el batch de un cliente desde su detalle (tab <strong>Piezas del mes</strong>).
          </p>
        </div>
      ) : (
        <div style={{
          overflowX: 'auto' as const,
          background: '#12121a', borderRadius: 10, border: '1px solid #2a2a40',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#1a1a28', borderBottom: '1px solid #2a2a40' }}>
                <th style={thStyle('left', 220)}>Cliente · Ciclo</th>
                {AREAS.map(a => (
                  <th key={a} style={thStyle('center', 110)}>
                    <span style={{ color: AREA_META[a].color }}>{AREA_META[a].emoji} {AREA_META[a].label}</span>
                  </th>
                ))}
                <th style={thStyle('center', 110)}>
                  <span style={{ color: '#f5a623' }}>📢 Anuncios</span>
                </th>
                <th style={thStyle('center', 130)}>
                  <span style={{ color: '#a78bfa' }}>📍 Estado actual</span>
                </th>
                <th style={thStyle('center', 90)}>Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredBatches.map(batch => {
                const owner = batch.cliente.owner_id ? owners.find(o => o.id === batch.cliente.owner_id) : null
                const isCompleted = batch.totalAprobadas === batch.totalPiezas
                // Anuncios cell: contar piezas video que califican
                const adsPiezas = filteredPiezas.filter(p =>
                  p.cliente_id === batch.cliente.id && p.ciclo_mes === batch.cicloMes && p.califica_ads
                )
                const adsCell: AreaCell = {
                  total: adsPiezas.length,
                  aprobadas: adsPiezas.filter(p => isApproved(p.estado_anuncios)).length,
                  enProgreso: adsPiezas.filter(p => isInProgress(p.estado_anuncios)).length,
                  pendientes: 0,
                }
                adsCell.pendientes = adsCell.total - adsCell.aprobadas - adsCell.enProgreso

                return (
                  <tr key={`${batch.cliente.id}-${batch.cicloMes}`}
                    style={{ borderBottom: '1px solid #22223a' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#16161e')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {/* Cliente · Ciclo */}
                    <td style={tdStyle('left')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {owner && (
                          <span style={{
                            width: 22, height: 22, borderRadius: 5,
                            background: owner.color + '22', color: owner.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: 10, flexShrink: 0,
                          }}>{owner.nombre_corto[0]}</span>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div onClick={() => onSelectCliente(batch.cliente)}
                            style={{ fontWeight: 700, fontSize: 12, cursor: 'pointer', color: '#e8e8f0' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#5e72e4')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#e8e8f0')}>
                            {batch.cliente.nombre}
                          </div>
                          <div style={{ fontSize: 10, color: '#6a6a80', textTransform: 'capitalize' as const }}>
                            {cicloMesLabel(batch.cicloMes)}
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Áreas */}
                    {AREAS.map(area => {
                      const cell = batch.porArea[area]
                      const tone = cellTone(cell)
                      const isExpanded = expanded?.key === `${batch.cliente.id}-${batch.cicloMes}` && expanded.area === area
                      return (
                        <td key={area} style={tdStyle('center')}>
                          {tone === null ? (
                            <span style={{ color: '#3a3a55' }}>—</span>
                          ) : (
                            <button
                              onClick={() => setExpanded(isExpanded ? null : { key: `${batch.cliente.id}-${batch.cicloMes}`, area })}
                              style={{
                                background: tone.bg, border: `1px solid ${tone.color}33`,
                                color: tone.color, padding: '5px 8px', borderRadius: 6,
                                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 70,
                                outline: isExpanded ? `2px solid ${tone.color}` : 'none',
                              }}>
                              {cell.aprobadas}/{cell.total}
                              <span style={{ width: 30, height: 4, borderRadius: 2, background: '#0a0a0f', overflow: 'hidden' as const }}>
                                <span style={{ display: 'block', width: `${tone.pct * 100}%`, height: '100%', background: tone.color }} />
                              </span>
                            </button>
                          )}
                        </td>
                      )
                    })}
                    {/* Anuncios */}
                    <td style={tdStyle('center')}>
                      {adsCell.total === 0 ? (
                        <span style={{ color: '#3a3a55' }}>—</span>
                      ) : (() => {
                        const tone = cellTone(adsCell)!
                        const isExpanded = expanded?.key === `${batch.cliente.id}-${batch.cicloMes}` && expanded.area === 'anuncios'
                        return (
                          <button
                            onClick={() => setExpanded(isExpanded ? null : { key: `${batch.cliente.id}-${batch.cicloMes}`, area: 'anuncios' })}
                            style={{
                              background: tone.bg, border: `1px solid ${tone.color}33`,
                              color: tone.color, padding: '5px 8px', borderRadius: 6,
                              fontSize: 11, fontWeight: 700, cursor: 'pointer',
                              minWidth: 70, outline: isExpanded ? `2px solid ${tone.color}` : 'none',
                            }}>
                            {adsCell.aprobadas}/{adsCell.total}
                          </button>
                        )
                      })()}
                    </td>
                    {/* Estado actual del loop */}
                    {(() => {
                      const batchPiezas = filteredPiezas.filter(p => p.cliente_id === batch.cliente.id && p.ciclo_mes === batch.cicloMes)
                      const manual = estadosLoop.get(`${batch.cliente.id}-${batch.cicloMes}`)
                      const derived = manual || deriveEstadoLoop(batchPiezas) || ''
                      const estadoStyle = getEstadoStyle(derived)
                      const isCompleted2 = derived === 'COMPLETADO'
                      return (
                        <td style={tdStyle('center')}>
                          {derived ? (
                            <span title={manual ? 'Estado manual' : 'Derivado de piezas'} style={{
                              fontSize: 10, fontWeight: 700,
                              padding: '3px 8px', borderRadius: 4,
                              background: isCompleted2 ? 'rgba(0,217,126,.15)' : estadoStyle.bg,
                              color: isCompleted2 ? '#00d97e' : estadoStyle.color,
                              fontStyle: manual ? 'normal' : 'italic',
                              whiteSpace: 'nowrap' as const,
                            }}>
                              {derived}
                              {!manual && <span style={{ opacity: 0.5, marginLeft: 4 }}>·auto</span>}
                            </span>
                          ) : (
                            <span style={{ color: '#3a3a55' }}>—</span>
                          )}
                        </td>
                      )
                    })()}

                    {/* Total */}
                    <td style={tdStyle('center')}>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: isCompleted ? '#00d97e' : '#a0a0b8',
                      }}>
                        {batch.totalAprobadas}/{batch.totalPiezas}
                        {isCompleted && <span style={{ marginLeft: 4 }}>✓</span>}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Drill-down panel */}
      {expanded && drillPiezas.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, right: 0, left: 240,
          background: '#12121a', borderTop: '1px solid #2a2a40',
          maxHeight: '50vh', overflowY: 'auto' as const,
          padding: 16, zIndex: 90,
          boxShadow: '0 -8px 32px rgba(0,0,0,.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              {(() => {
                const [cidStr, ciclo] = expanded.key.split('-')
                const cliente = clientesById.get(Number(cidStr))
                const areaLabel = expanded.area === 'anuncios' ? 'Anuncios' : AREA_META[expanded.area as UserArea].label
                return <>{cliente?.nombre} · {cicloMesLabel(ciclo)} · <span style={{ color: '#5e72e4' }}>{areaLabel}</span> ({drillPiezas.length} piezas)</>
              })()}
            </div>
            <button onClick={() => setExpanded(null)}
              style={{ background: 'transparent', border: 'none', color: '#6a6a80', fontSize: 16, cursor: 'pointer' }}>
              <i className="fas fa-xmark" />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
            {drillPiezas.map(p => {
              const meta = PIEZA_META[p.tipo as PiezaTipo]
              const colKey = expanded.area === 'anuncios' ? 'estado_anuncios' : colNameFor(expanded.area as UserArea)
              const value = (p as Record<string, unknown>)[colKey] as string
              const approved = isApproved(value)
              const inProg = isInProgress(value)
              return (
                <div key={p.id} style={{
                  padding: '6px 8px', borderRadius: 5,
                  background: approved ? 'rgba(0,217,126,.10)' : inProg ? 'rgba(245,166,35,.10)' : '#1a1a28',
                  border: `1px solid ${approved ? '#00d97e44' : inProg ? '#f5a62344' : '#2a2a40'}`,
                  fontSize: 11,
                }}>
                  <div style={{ fontWeight: 600 }}>
                    {meta.emoji} {meta.label} #{p.numero}
                  </div>
                  <div style={{ fontSize: 9, color: approved ? '#00d97e' : inProg ? '#f5a623' : '#6a6a80', marginTop: 2 }}>
                    {value || 'pendiente'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Clientes sin batch generado */}
      {clientesSinBatch.length > 0 && (
        <div style={{ marginTop: 18, padding: 14, background: '#12121a', borderRadius: 10, border: '1px dashed #2a2a40' }}>
          <div style={{ fontSize: 11, color: '#6a6a80', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 10 }}>
            <i className="fas fa-circle-info" style={{ marginRight: 6 }} />
            Clientes sin batch generado ({clientesSinBatch.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
            {clientesSinBatch.map(c => (
              <button key={c.id} onClick={() => onSelectCliente(c)}
                style={{
                  padding: '4px 10px', background: '#1a1a28',
                  border: '1px solid #2a2a40', borderRadius: 14,
                  color: '#a0a0b8', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}>
                {c.nombre}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#6a6a80', marginTop: 8 }}>
            Click en un cliente → tab <strong>Piezas del mes</strong> → <strong>Generar batch</strong>.
          </div>
        </div>
      )}
    </div>
  )
}

function chipStyle(active: boolean, color: string): React.CSSProperties {
  return {
    padding: '4px 12px',
    background: active ? color + '22' : '#1a1a28',
    border: `1px solid ${active ? color : '#2a2a40'}`,
    borderRadius: 18, color: active ? color : '#a0a0b8',
    fontSize: 11, fontWeight: 600, cursor: 'pointer',
  }
}

function thStyle(align: 'left' | 'center', minWidth: number): React.CSSProperties {
  return {
    textAlign: align, padding: '10px 12px', minWidth,
    fontSize: 10, fontWeight: 700, color: '#a0a0b8',
    textTransform: 'uppercase' as const, letterSpacing: 0.4,
  }
}

function tdStyle(align: 'left' | 'center'): React.CSSProperties {
  return { padding: '10px 12px', textAlign: align, verticalAlign: 'middle' as const }
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      padding: '8px 14px', borderRadius: 8,
      background: color + '12', border: `1px solid ${color}33`,
    }}>
      <div style={{ fontSize: 9, color: '#6a6a80', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

'use client'
import { useMemo, useState, useCallback, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { SemaforoIcon } from './ui'
import { supabase } from '@/lib/supabase'
import type { Cliente, Owner, Equipo } from '@/lib/supabase'
import { updateEstado } from '@/lib/estadoHelper'
import { ESTADO_OPTIONS_ONGOING, ESTADO_FASE, ESTADO_COLORS } from '@/lib/estados'

type Props = {
  clientes: Cliente[]
  owners: Owner[]
  equipo: Equipo[]
  onUpdate: () => void
  ownerFilter: string
  onOwnerFilterChange: (id: string) => void
}

// Layout vertical — cada estado del flujo es una sección.
// Orden canónico definido en estados.ts ESTADO_OPTIONS_ONGOING.
// Visualmente agrupamos por fase (COPYS / PRODUCCIÓN / EDICIÓN / DISEÑO+REVISIÓN / SUBIDA / ANUNCIOS).

const FASE_META: Record<string, { label: string; color: string; icon: string }> = {
  guion:     { label: 'Copys',      color: '#a78bfa', icon: 'fa-pen-fancy' },
  grabacion: { label: 'Producción', color: '#5e72e4', icon: 'fa-video' },
  edicion:   { label: 'Edición',    color: '#fb6340', icon: 'fa-film' },
  diseno:    { label: 'Diseño',     color: '#ec4ad8', icon: 'fa-palette' },
  revision:  { label: 'Revisión',   color: '#f5d623', icon: 'fa-magnifying-glass' },
  subida:    { label: 'Subida',     color: '#00d97e', icon: 'fa-calendar-check' },
  anuncios:  { label: 'Anuncios',   color: '#f5a623', icon: 'fa-bullhorn' },
}

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function formatDateForInput(dateStr: string | null): string {
  if (!dateStr) return ''
  return dateStr.substring(0, 10)
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export default function TableroProduccion({ clientes, owners, equipo, onUpdate, ownerFilter, onOwnerFilterChange }: Props) {
  const prod = clientes.filter(c => c.estado && !c.is_onboarding)
  const filteredByOwner = ownerFilter === '__none__'
    ? prod.filter(c => !c.owner_id)
    : ownerFilter ? prod.filter(c => c.owner_id === ownerFilter) : prod

  // Optimistic overrides — para que el drag se vea instantáneo
  const [optimistic, setOptimistic] = useState<Record<number, string>>({})
  const [savingId, setSavingId] = useState<number | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  // Aplicar overrides ópticos
  const filtered = useMemo(() => {
    if (Object.keys(optimistic).length === 0) return filteredByOwner
    return filteredByOwner.map(c => optimistic[c.id] != null ? { ...c, estado: optimistic[c.id] } : c)
  }, [filteredByOwner, optimistic])

  // Limpiar overrides cuando la DB confirma
  useEffect(() => {
    setOptimistic(prev => {
      const next = { ...prev }
      let changed = false
      for (const idStr of Object.keys(prev)) {
        const id = Number(idStr)
        const real = clientes.find(c => c.id === id)
        if (real && real.estado === prev[id]) {
          delete next[id]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [clientes])

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  // Group by estado (todos los 16 estados aparecen, vacíos también)
  const byEstado = useMemo(() => {
    const result: Record<string, Cliente[]> = {}
    ESTADO_OPTIONS_ONGOING.forEach(e => { result[e] = [] })
    filtered.forEach(c => {
      if (result[c.estado] !== undefined) result[c.estado].push(c)
    })
    return result
  }, [filtered])

  // Estados editables
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingVideos, setEditingVideos] = useState<number | null>(null)
  const [editingFechas, setEditingFechas] = useState<number | null>(null)

  const onDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination) return
    const destEstado = result.destination.droppableId
    const clienteId = parseInt(result.draggableId)
    const cliente = filtered.find(c => c.id === clienteId)
    if (!cliente || cliente.estado === destEstado) return

    // 1. Optimistic
    setOptimistic(prev => ({ ...prev, [clienteId]: destEstado }))
    setSavingId(clienteId)

    // 2. Persistir + log
    try {
      await updateEstado(clienteId, destEstado, cliente.estado)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setOptimistic(prev => { const n = { ...prev }; delete n[clienteId]; return n })
      setSavingId(null)
      setToast({ msg: `Error: ${msg}`, type: 'err' })
      return
    }

    setSavingId(null)
    setToast({ msg: `${cliente.nombre} → ${destEstado}`, type: 'ok' })
    onUpdate()
  }, [filtered, onUpdate])

  async function updateFechaGrabacion(clienteId: number, fecha: string) {
    await supabase.from('clientes').update({ fecha_grabacion: fecha || null }).eq('id', clienteId)
    onUpdate()
  }
  async function toggleEstadoGrabacion(clienteId: number, currentEstado: string) {
    const newEstado = currentEstado === 'confirmada' ? 'tentativa' : 'confirmada'
    await supabase.from('clientes').update({ fecha_grabacion_estado: newEstado }).eq('id', clienteId)
    onUpdate()
  }
  async function toggleCorreccion(clienteId: number, current: boolean) {
    await supabase.from('clientes').update({ en_correccion: !current }).eq('id', clienteId)
    onUpdate()
  }
  async function updateCantidadVideos(clienteId: number, cantidad: number) {
    await supabase.from('clientes').update({ cantidad_videos: cantidad }).eq('id', clienteId)
    setEditingVideos(null)
    onUpdate()
  }
  async function updateFechaContenido(clienteId: number, field: 'fecha_contenido' | 'fecha_contenido_fin', value: string) {
    await supabase.from('clientes').update({ [field]: value || null }).eq('id', clienteId)
    onUpdate()
  }
  async function nuevoCiclo(clienteId: number, currentEstado: string) {
    await updateEstado(clienteId, 'GUIONES', currentEstado)
    await supabase.from('clientes').update({
      en_correccion: false, fecha_grabacion: null, fecha_grabacion_estado: 'tentativa',
    }).eq('id', clienteId)
    onUpdate()
  }

  return (
    <div className="fade-in">
      {/* Owner filter chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#6a6a80', fontWeight: 600, marginRight: 4 }}>PM:</span>
        <span className={`owner-chip ${ownerFilter === '' ? 'active' : ''}`} onClick={() => onOwnerFilterChange('')}>Todos</span>
        {owners.map(o => (
          <span key={o.id} className={`owner-chip ${ownerFilter === o.id ? 'active' : ''}`}
            onClick={() => onOwnerFilterChange(ownerFilter === o.id ? '' : o.id)}
            style={ownerFilter === o.id ? { borderColor: o.color, color: o.color, background: `${o.color}18` } : {}}>
            {o.nombre_corto}
          </span>
        ))}
        <span className={`owner-chip ${ownerFilter === '__none__' ? 'active' : ''}`}
          onClick={() => onOwnerFilterChange(ownerFilter === '__none__' ? '' : '__none__')}
          style={ownerFilter === '__none__' ? { borderColor: '#4a4a60', color: '#4a4a60', background: 'rgba(74,74,96,0.1)' } : { fontStyle: 'italic' }}>
          Sin asignar
        </span>
      </div>

      {/* Top stat bar */}
      <div style={{
        display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 16,
        padding: 8, background: '#12121a', borderRadius: 8, border: '1px solid #2a2a40',
      }}>
        {ESTADO_OPTIONS_ONGOING.map(estado => {
          const style = ESTADO_COLORS[estado] || { bg: '#22223a', color: '#a0a0b8' }
          const count = byEstado[estado].length
          return (
            <a
              key={estado}
              href={`#sec-${estado.replace(/[^a-zA-Z0-9]/g, '-')}`}
              style={{
                fontSize: 9, fontWeight: 700,
                padding: '3px 8px', borderRadius: 4,
                background: count > 0 ? style.bg : '#1a1a28',
                color: count > 0 ? style.color : '#3a3a55',
                border: `1px solid ${count > 0 ? style.color + '33' : '#2a2a40'}`,
                textTransform: 'uppercase' as const, letterSpacing: 0.3,
                textDecoration: 'none',
              }}
            >
              {estado.length > 18 ? estado.slice(0, 16) + '…' : estado} <strong style={{ marginLeft: 4 }}>{count}</strong>
            </a>
          )
        })}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
          {ESTADO_OPTIONS_ONGOING.map(estado => {
            const style = ESTADO_COLORS[estado] || { bg: '#22223a', color: '#a0a0b8' }
            const fase = ESTADO_FASE[estado] ?? 'edicion'
            const faseMeta = FASE_META[fase] ?? FASE_META.edicion
            const list = byEstado[estado]
            const sectionId = `sec-${estado.replace(/[^a-zA-Z0-9]/g, '-')}`

            return (
              <Droppable key={estado} droppableId={estado} direction="horizontal">
                {(provided, snapshot) => (
                  <div
                    id={sectionId}
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{
                      borderRadius: 10,
                      background: snapshot.isDraggingOver ? `${style.color}10` : '#12121a',
                      border: `1px solid ${snapshot.isDraggingOver ? style.color : style.color + '33'}`,
                      transition: 'background .15s, border-color .15s',
                      scrollMarginTop: 100,
                    }}
                  >
                    {/* Section header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 14px',
                      borderBottom: list.length > 0 ? `1px solid ${style.color}22` : 'none',
                      borderLeft: `4px solid ${style.color}`,
                      borderTopLeftRadius: 10, borderBottomLeftRadius: list.length > 0 ? 0 : 10,
                      background: `${style.color}08`,
                    }}>
                      <i className={`fas ${faseMeta.icon}`} style={{ color: faseMeta.color, fontSize: 11, width: 14 }} />
                      <span style={{
                        fontSize: 10, color: faseMeta.color, fontWeight: 600,
                        textTransform: 'uppercase' as const, letterSpacing: 0.4,
                        opacity: 0.7,
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
                        <span style={{ fontSize: 10, color: '#3a3a55', fontStyle: 'italic', marginLeft: 'auto' }}>
                          arrastrá clientes aquí
                        </span>
                      )}
                    </div>

                    {/* Cards row — flex-wrap horizontal */}
                    {list.length > 0 && (
                      <div style={{
                        display: 'flex', flexWrap: 'wrap' as const, gap: 8,
                        padding: 10, alignItems: 'flex-start',
                      }}>
                        {list.map((c, index) => {
                          const isConfirmada = c.fecha_grabacion_estado === 'confirmada'
                          const hasFecha = !!c.fecha_grabacion
                          const isEditing = editingId === c.id
                          const ownerObj = owners.find(o => o.id === c.owner_id)
                          const showCorreccion = ['GUIONES', 'EDICIÓN', 'CORRECION GUIONES', 'CORRECION'].includes(estado)
                          const isAnuncios = ['ANUNCIOS PRENDIDOS', 'ANUNCIOS CHECK', 'REPORTE ADS + ORGÁNICO', 'VOLVER A EMPEZAR', 'METRICAS Y VOLVER A EMPEZAR'].includes(estado)
                          const stuckDays = daysSince(c.estado_changed_at)
                          // Loop awareness — chips de áreas adicionales activas
                          const otherAreaActivity = [
                            c.estado_copys && c.estado_copys.length > 0 && c.estado_copys !== c.estado ? { area: 'C', label: c.estado_copys, color: '#a78bfa' } : null,
                            c.estado_edicion && c.estado_edicion.length > 0 && c.estado_edicion !== c.estado && c.estado_edicion !== estado ? { area: 'E', label: c.estado_edicion, color: '#fb6340' } : null,
                            c.estado_diseno && c.estado_diseno.length > 0 && c.estado_diseno !== c.estado && c.estado_diseno !== estado ? { area: 'D', label: c.estado_diseno, color: '#ec4ad8' } : null,
                          ].filter((x): x is { area: string; label: string; color: string } => x !== null)

                          return (
                            <Draggable key={c.id} draggableId={String(c.id)} index={index}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  style={{
                                    ...dragProvided.draggableProps.style,
                                    width: 240,
                                    padding: 10,
                                    background: dragSnapshot.isDragging ? '#22223a' : '#1a1a28',
                                    borderRadius: 8,
                                    borderLeft: `3px solid ${style.color}`,
                                    border: `1px solid ${savingId === c.id ? style.color + '88' : '#2a2a40'}`,
                                    boxShadow: dragSnapshot.isDragging ? '0 8px 24px rgba(0,0,0,.5)'
                                      : savingId === c.id ? `0 0 0 1px ${style.color}88` : 'none',
                                    cursor: 'grab',
                                    opacity: savingId === c.id ? 0.7 : 1,
                                    transition: 'opacity .15s, border .15s, box-shadow .15s',
                                  }}
                                >
                                  {/* Loop chips — pequeños, arriba-derecha */}
                                  {otherAreaActivity.length > 0 && (
                                    <div style={{ display: 'flex', gap: 3, marginBottom: 5, flexWrap: 'wrap' as const }}>
                                      {otherAreaActivity.map(o => (
                                        <span key={o.area} title={`Activo en ${o.area === 'C' ? 'Copys' : o.area === 'E' ? 'Edición' : 'Diseño'}: ${o.label}`} style={{
                                          fontSize: 8, fontWeight: 800,
                                          padding: '1px 4px', borderRadius: 3,
                                          background: o.color + '22', color: o.color,
                                          border: `1px solid ${o.color}44`,
                                        }}>
                                          ⟲ {o.area}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {/* Header: Cliente name + days + semaforo */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <span style={{ fontWeight: 700, fontSize: 12, flex: 1, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>
                                      {c.nombre}
                                    </span>
                                    {stuckDays > 0 && (
                                      <span style={{
                                        fontSize: 9, padding: '1px 5px', borderRadius: 3, fontWeight: 700,
                                        background: stuckDays > 7 ? 'rgba(245,54,92,.15)' : stuckDays > 3 ? 'rgba(245,166,35,.15)' : 'rgba(106,106,128,.1)',
                                        color: stuckDays > 7 ? '#f5365c' : stuckDays > 3 ? '#f5a623' : '#6a6a80',
                                      }}>
                                        {stuckDays}d
                                      </span>
                                    )}
                                    <SemaforoIcon color={c.semaforo_general} />
                                  </div>

                                  {/* Owner */}
                                  <div style={{ fontSize: 11, color: ownerObj?.color || '#4a4a60', fontWeight: 500, fontStyle: ownerObj ? 'normal' : 'italic', marginBottom: 6 }}>
                                    {ownerObj?.nombre_corto || 'Sin asignar'}
                                  </div>

                                  {/* Team badges */}
                                  {(() => {
                                    const editor = equipo.find(e => e.id === c.editor_id)
                                    const copy = equipo.find(e => e.id === c.copy_id)
                                    const disenador = equipo.find(e => e.id === c.disenador_id)
                                    if (!editor && !copy && !disenador) return null
                                    return (
                                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' as const, marginBottom: 6 }}>
                                        {copy && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: copy.color + '20', color: copy.color, fontWeight: 600 }}><i className="fas fa-pen-fancy" style={{ fontSize: 7, marginRight: 2 }} />{copy.nombre}</span>}
                                        {editor && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: editor.color + '20', color: editor.color, fontWeight: 600 }}><i className="fas fa-film" style={{ fontSize: 7, marginRight: 2 }} />{editor.nombre}</span>}
                                        {disenador && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: disenador.color + '20', color: disenador.color, fontWeight: 600 }}><i className="fas fa-palette" style={{ fontSize: 7, marginRight: 2 }} />{disenador.nombre}</span>}
                                      </div>
                                    )
                                  })()}

                                  {/* Videos count */}
                                  <div style={{ marginBottom: 4 }}>
                                    {editingVideos === c.id ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <i className="fas fa-clapperboard" style={{ fontSize: 9, color: '#6a6a80' }} />
                                        <input type="number" min={0} defaultValue={c.cantidad_videos || 0} className="editable-select"
                                          style={{ width: 50, fontSize: 10, padding: '2px 4px' }} autoFocus
                                          onBlur={e => updateCantidadVideos(c.id, parseInt(e.target.value) || 0)}
                                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                                        <span style={{ fontSize: 9, color: '#6a6a80' }}>videos</span>
                                      </div>
                                    ) : (
                                      <div onClick={() => setEditingVideos(c.id)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 10, color: c.cantidad_videos ? '#a0a0b8' : '#4a4a60' }}>
                                        <i className="fas fa-clapperboard" style={{ fontSize: 9 }} />
                                        <span>{c.cantidad_videos ? `${c.cantidad_videos} videos` : '+ videos'}</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Fechas de contenido */}
                                  <div style={{ marginBottom: 4 }}>
                                    {editingFechas === c.id ? (
                                      <div style={{ background: 'rgba(94,114,228,0.05)', borderRadius: 6, padding: 6, border: '1px solid #2a2a40' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                                          <span style={{ fontSize: 9, color: '#6a6a80', minWidth: 38 }}>Desde</span>
                                          <input type="date" className="editable-select" value={formatDateForInput(c.fecha_contenido)}
                                            onChange={e => updateFechaContenido(c.id, 'fecha_contenido', e.target.value)}
                                            style={{ flex: 1, fontSize: 10, padding: '2px 4px' }} />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                          <span style={{ fontSize: 9, color: '#6a6a80', minWidth: 38 }}>Hasta</span>
                                          <input type="date" className="editable-select" value={formatDateForInput(c.fecha_contenido_fin)}
                                            onChange={e => updateFechaContenido(c.id, 'fecha_contenido_fin', e.target.value)}
                                            style={{ flex: 1, fontSize: 10, padding: '2px 4px' }} />
                                        </div>
                                        <button onClick={() => setEditingFechas(null)}
                                          style={{ marginTop: 4, fontSize: 9, color: '#6a6a80', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'right' }}>cerrar</button>
                                      </div>
                                    ) : (c.fecha_contenido || c.fecha_contenido_fin) ? (
                                      <div onClick={() => setEditingFechas(c.id)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', borderRadius: 5, background: 'rgba(94,114,228,0.06)', border: '1px solid rgba(94,114,228,0.15)', cursor: 'pointer', fontSize: 10, color: '#8b9cf7' }}>
                                        <i className="fas fa-calendar-week" style={{ fontSize: 9 }} />
                                        <span>{formatDateShort(c.fecha_contenido)}</span>
                                        {c.fecha_contenido_fin && (<><span style={{ color: '#4a4a60' }}>→</span><span>{formatDateShort(c.fecha_contenido_fin)}</span></>)}
                                      </div>
                                    ) : (
                                      <div onClick={() => setEditingFechas(c.id)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', fontSize: 9, color: '#3a3a50' }}>
                                        <i className="fas fa-calendar-week" style={{ fontSize: 8 }} /> <span>+ fechas contenido</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Correccion */}
                                  {showCorreccion && (
                                    <div style={{ marginBottom: 4 }}>
                                      <button onClick={(e) => { e.stopPropagation(); toggleCorreccion(c.id, c.en_correccion) }}
                                        style={{
                                          display: 'inline-flex', alignItems: 'center', gap: 4,
                                          padding: '2px 7px', borderRadius: 4, fontSize: 9, fontWeight: 600,
                                          border: 'none', cursor: 'pointer',
                                          background: c.en_correccion ? 'rgba(245,54,92,0.15)' : 'rgba(106,106,128,0.1)',
                                          color: c.en_correccion ? '#f5365c' : '#4a4a60',
                                        }}>
                                        <i className="fas fa-rotate-left" style={{ fontSize: 8 }} />
                                        {c.en_correccion ? 'En Corrección' : 'Corrección'}
                                      </button>
                                    </div>
                                  )}

                                  {/* Fecha de grabación */}
                                  {isEditing ? (
                                    <div style={{ marginTop: 2 }}>
                                      <input type="date" className="editable-select" value={formatDateForInput(c.fecha_grabacion)}
                                        onChange={e => updateFechaGrabacion(c.id, e.target.value)}
                                        style={{ width: '100%', fontSize: 11, marginBottom: 4 }} />
                                      <div style={{ display: 'flex', gap: 4 }}>
                                        <button onClick={() => toggleEstadoGrabacion(c.id, c.fecha_grabacion_estado)}
                                          style={{ flex: 1, padding: '3px 6px', fontSize: 10, fontWeight: 600, borderRadius: 4, border: 'none', cursor: 'pointer',
                                            background: isConfirmada ? 'rgba(0,217,126,0.15)' : 'rgba(245,166,35,0.15)',
                                            color: isConfirmada ? '#00d97e' : '#f5a623',
                                          }}>
                                          {isConfirmada ? '✓ Confirmada' : '~ Tentativa'}
                                        </button>
                                        <button onClick={() => setEditingId(null)}
                                          style={{ padding: '3px 8px', fontSize: 10, borderRadius: 4, border: '1px solid #2a2a40', background: 'transparent', color: '#6a6a80', cursor: 'pointer' }}>✕</button>
                                      </div>
                                    </div>
                                  ) : hasFecha ? (
                                    <div onClick={() => setEditingId(c.id)}
                                      style={{
                                        marginTop: 2, display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '3px 7px', borderRadius: 5, cursor: 'pointer',
                                        background: isConfirmada ? 'rgba(0,217,126,0.08)' : 'rgba(245,166,35,0.08)',
                                        border: `1px ${isConfirmada ? 'solid' : 'dashed'} ${isConfirmada ? 'rgba(0,217,126,0.3)' : 'rgba(245,166,35,0.3)'}`,
                                      }}>
                                      <i className={`fas ${isConfirmada ? 'fa-calendar-check' : 'fa-calendar-day'}`} style={{ fontSize: 9, color: isConfirmada ? '#00d97e' : '#f5a623' }} />
                                      <span style={{ fontSize: 10, fontWeight: 600, color: isConfirmada ? '#00d97e' : '#f5a623' }}>{formatDateShort(c.fecha_grabacion)}</span>
                                      <span style={{ fontSize: 9, marginLeft: 'auto', padding: '0 4px', borderRadius: 3, fontWeight: 600,
                                        background: isConfirmada ? 'rgba(0,217,126,0.15)' : 'rgba(245,166,35,0.15)',
                                        color: isConfirmada ? '#00d97e' : '#f5a623',
                                      }}>{isConfirmada ? 'CONF' : 'TENT'}</span>
                                    </div>
                                  ) : (
                                    <div onClick={() => setEditingId(c.id)}
                                      style={{ marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '3px 6px', borderRadius: 5, cursor: 'pointer', border: '1px dashed #2a2a40', color: '#4a4a60', fontSize: 10 }}>
                                      <i className="fas fa-plus" style={{ fontSize: 8 }} /> Grabación
                                    </div>
                                  )}

                                  {/* Nuevo Ciclo (solo en estados de anuncios/cierre) */}
                                  {isAnuncios && (
                                    <button onClick={(e) => { e.stopPropagation(); nuevoCiclo(c.id, c.estado) }}
                                      style={{
                                        marginTop: 6, width: '100%', padding: '4px 6px', fontSize: 10, fontWeight: 600,
                                        borderRadius: 5, border: '1px dashed rgba(94,114,228,0.4)', cursor: 'pointer',
                                        background: 'rgba(94,114,228,0.06)', color: '#5e72e4',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                      }}
                                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(94,114,228,0.15)' }}
                                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(94,114,228,0.06)' }}>
                                      <i className="fas fa-rotate" style={{ fontSize: 9 }} /> Nuevo Ciclo
                                    </button>
                                  )}
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

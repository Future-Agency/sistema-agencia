'use client'
import { useMemo, useState, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { SemaforoIcon } from './ui'
import { supabase } from '@/lib/supabase'
import type { Cliente, Owner, Equipo } from '@/lib/supabase'
import { updateEstado } from '@/lib/estadoHelper'
import { getEstadoStyle } from '@/lib/estados'

type Props = { clientes: Cliente[]; owners: Owner[]; equipo: Equipo[]; onUpdate: () => void; ownerFilter: string; onOwnerFilterChange: (id: string) => void }

type ColumnKey = 'guiones' | 'produccion' | 'edicion' | 'revision' | 'diseno' | 'programacion' | 'anuncios'

// Canonical estado value when dropping into a column
const COLUMN_ESTADO: Record<ColumnKey, string> = {
  guiones: 'GUIONES',
  produccion: 'PRODUCCIÓN A CONFIRMAR',
  edicion: 'EDICIÓN',
  revision: 'REVISION - RAMI',
  diseno: 'DISEÑO',
  programacion: 'PROGRAMACION',
  anuncios: 'ANUNCIOS SIN ACTIVAR',
}

// Which estados map to which column
const ESTADO_MAP: Record<ColumnKey, string[]> = {
  guiones: ['GUIONES', 'REVISION GUIONES', 'CORRECION GUIONES'],
  produccion: ['PRODUCCIÓN A CONFIRMAR', 'PRODUCCION CONFIRMADA'],
  edicion: ['EDICIÓN', 'CORRECION'],
  revision: ['REVISION - RAMI', 'REVISION CLIENTE'],
  diseno: ['DISEÑO'],
  programacion: ['APROBADO - SUBIDA A CLICKUP', 'PROGRAMACION', 'PROGAMADO'],
  anuncios: ['ANUNCIOS SIN ACTIVAR', 'ANUNCIOS PRENDIDOS', 'ANUNCIOS CHECK', 'METRICAS Y VOLVER A EMPEZAR'],
}

// Short labels for sub-estado badges
const SUB_ESTADO_SHORT: Record<string, string> = {
  'GUIONES': 'ESCRIBIENDO',
  'REVISION GUIONES': 'REV. GUIONES',
  'CORRECION GUIONES': 'CORR. GUIONES',
  'PRODUCCIÓN A CONFIRMAR': 'POR CONFIRMAR',
  'PRODUCCION CONFIRMADA': 'CONFIRMADA',
  'EDICIÓN': 'EDITANDO',
  'CORRECION': 'CORRECCIÓN',
  'REVISION - RAMI': 'REV. RAMI',
  'REVISION CLIENTE': 'REV. CLIENTE',
  'DISEÑO': 'DISEÑANDO',
  'APROBADO - SUBIDA A CLICKUP': 'SUBIR CLICKUP',
  'PROGRAMACION': 'PROGRAMANDO',
  'PROGAMADO': 'PROGRAMADO',
  'ANUNCIOS SIN ACTIVAR': 'SIN ACTIVAR',
  'ANUNCIOS PRENDIDOS': 'PRENDIDOS',
  'ANUNCIOS CHECK': 'CHECK',
  'METRICAS Y VOLVER A EMPEZAR': 'MÉTRICAS',
}

// Vivid colors for sub-estado badges
const SUB_ESTADO_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  'GUIONES':                      { bg: 'rgba(137,101,224,.15)', color: '#a78bfa', border: '#a78bfa30' },
  'REVISION GUIONES':             { bg: 'rgba(245,214,35,.15)',  color: '#f5d623', border: '#f5d62330' },
  'CORRECION GUIONES':            { bg: 'rgba(245,54,92,.15)',   color: '#f5365c', border: '#f5365c30' },
  'PRODUCCIÓN A CONFIRMAR':       { bg: 'rgba(245,166,35,.15)',  color: '#f5a623', border: '#f5a62330' },
  'PRODUCCION CONFIRMADA':        { bg: 'rgba(0,217,126,.18)',   color: '#00d97e', border: '#00d97e30' },
  'EDICIÓN':                      { bg: 'rgba(94,114,228,.15)',  color: '#5e72e4', border: '#5e72e430' },
  'CORRECION':                    { bg: 'rgba(245,54,92,.18)',   color: '#f5365c', border: '#f5365c30' },
  'REVISION - RAMI':              { bg: 'rgba(245,214,35,.15)',  color: '#f5d623', border: '#f5d62330' },
  'REVISION CLIENTE':             { bg: 'rgba(251,191,36,.15)',  color: '#fbbf24', border: '#fbbf2430' },
  'DISEÑO':                       { bg: 'rgba(245,54,92,.12)',   color: '#fb7185', border: '#fb718530' },
  'APROBADO - SUBIDA A CLICKUP':  { bg: 'rgba(94,114,228,.12)', color: '#8b9cf7', border: '#8b9cf730' },
  'PROGRAMACION':                 { bg: 'rgba(0,217,126,.12)',   color: '#00d97e', border: '#00d97e30' },
  'PROGAMADO':                    { bg: 'rgba(0,217,126,.2)',    color: '#00d97e', border: '#00d97e40' },
  'ANUNCIOS SIN ACTIVAR':         { bg: 'rgba(245,54,92,.15)',   color: '#f5365c', border: '#f5365c30' },
  'ANUNCIOS PRENDIDOS':           { bg: 'rgba(0,217,126,.2)',    color: '#00d97e', border: '#00d97e40' },
  'ANUNCIOS CHECK':               { bg: 'rgba(245,214,35,.18)', color: '#f5d623', border: '#f5d62340' },
  'METRICAS Y VOLVER A EMPEZAR':  { bg: 'rgba(137,101,224,.15)', color: '#a78bfa', border: '#a78bfa30' },
}

function getSubEstadoStyle(estado: string) {
  return SUB_ESTADO_COLORS[estado] || { bg: 'rgba(106,106,128,.1)', color: '#6a6a80', border: '#6a6a8030' }
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

export default function TableroProduccion({ clientes, owners, equipo, onUpdate, ownerFilter, onOwnerFilterChange }: Props) {
  const prod = clientes.filter(c => c.estado && !c.is_onboarding)
  const filtered = ownerFilter === '__none__' ? prod.filter(c => !c.owner_id) : ownerFilter ? prod.filter(c => c.owner_id === ownerFilter) : prod

  const byFase = useMemo(() => {
    const result: Record<ColumnKey, Cliente[]> = {
      guiones: [], produccion: [], edicion: [], revision: [], diseno: [], programacion: [], anuncios: [],
    }
    filtered.forEach(c => {
      for (const [key, estados] of Object.entries(ESTADO_MAP)) {
        if (estados.includes(c.estado)) {
          result[key as ColumnKey].push(c)
          return
        }
      }
    })
    return result
  }, [filtered])

  const columns: { key: ColumnKey; label: string; icon: string; color: string }[] = [
    { key: 'guiones', label: 'Guiones', icon: 'fa-pen-fancy', color: '#8965e0' },
    { key: 'produccion', label: 'Producción', icon: 'fa-video', color: '#5e72e4' },
    { key: 'edicion', label: 'Edición', icon: 'fa-film', color: '#f5a623' },
    { key: 'revision', label: 'Revisión', icon: 'fa-magnifying-glass', color: '#a78bfa' },
    { key: 'diseno', label: 'Diseño', icon: 'fa-palette', color: '#f5365c' },
    { key: 'programacion', label: 'Programación', icon: 'fa-calendar', color: '#00d97e' },
    { key: 'anuncios', label: 'Anuncios', icon: 'fa-bullhorn', color: '#f5a623' },
  ]

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingVideos, setEditingVideos] = useState<number | null>(null)
  const [editingFechas, setEditingFechas] = useState<number | null>(null)

  const onDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination) return
    const destCol = result.destination.droppableId as ColumnKey
    const clienteId = parseInt(result.draggableId)
    const cliente = filtered.find(c => c.id === clienteId)
    if (!cliente) return
    if (ESTADO_MAP[destCol].includes(cliente.estado)) return
    const newEstado = COLUMN_ESTADO[destCol]
    await updateEstado(clienteId, newEstado, cliente.estado)
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
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

      {/* Sub-estado legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, color: '#4a4a60', marginRight: 2 }}>Estados:</span>
        {Object.entries(SUB_ESTADO_SHORT).map(([estado, label]) => {
          const s = getSubEstadoStyle(estado)
          const count = filtered.filter(c => c.estado === estado).length
          if (count === 0) return null
          return (
            <span key={estado} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: s.bg, color: s.color, fontWeight: 600, border: `1px solid ${s.border}` }}>
              {label} {count}
            </span>
          )
        })}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, minmax(200px, 1fr))`, gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
          {columns.map(col => (
            <div key={col.key} style={{ minWidth: 200 }}>
              {/* Column header */}
              <div style={{
                padding: '10px 14px',
                background: `linear-gradient(135deg, ${col.color}15, #12121a)`,
                border: `1px solid ${col.color}30`,
                borderRadius: '10px 10px 0 0',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <i className={`fas ${col.icon}`} style={{ color: col.color, fontSize: 14 }} />
                <span style={{ fontWeight: 700, fontSize: 13, color: '#e8e8f0' }}>{col.label}</span>
                <span style={{ marginLeft: 'auto', background: `${col.color}20`, color: col.color, padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 800 }}>
                  {byFase[col.key].length}
                </span>
              </div>

              {/* Sub-estados inside this column */}
              {ESTADO_MAP[col.key].length > 1 && byFase[col.key].length > 0 && (
                <div style={{ display: 'flex', gap: 3, padding: '4px 8px', background: '#0f0f18', borderLeft: `1px solid ${col.color}30`, borderRight: `1px solid ${col.color}30`, flexWrap: 'wrap' }}>
                  {ESTADO_MAP[col.key].map(subEstado => {
                    const count = byFase[col.key].filter(c => c.estado === subEstado).length
                    if (count === 0) return null
                    const s = getSubEstadoStyle(subEstado)
                    return (
                      <span key={subEstado} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: s.bg, color: s.color, fontWeight: 700, border: `1px solid ${s.border}` }}>
                        {SUB_ESTADO_SHORT[subEstado] || subEstado} ({count})
                      </span>
                    )
                  })}
                </div>
              )}

              {/* Droppable column */}
              <Droppable droppableId={col.key}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{
                      background: snapshot.isDraggingOver ? `${col.color}08` : '#12121a',
                      border: `1px solid ${snapshot.isDraggingOver ? col.color : `${col.color}30`}`,
                      borderTop: 'none',
                      borderRadius: '0 0 10px 10px',
                      padding: 8,
                      minHeight: 200,
                      transition: 'background .2s, border-color .2s',
                    }}
                  >
                    {byFase[col.key].map((c, index) => {
                      const isConfirmada = c.fecha_grabacion_estado === 'confirmada'
                      const hasFecha = !!c.fecha_grabacion
                      const isEditing = editingId === c.id
                      const ownerObj = owners.find(o => o.id === c.owner_id)
                      const showCorreccion = col.key === 'guiones' || col.key === 'edicion'
                      const subStyle = getSubEstadoStyle(c.estado)
                      const hasMultipleEstados = ESTADO_MAP[col.key].length > 1

                      return (
                        <Draggable key={c.id} draggableId={String(c.id)} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{
                                ...provided.draggableProps.style,
                                padding: 12,
                                background: snapshot.isDragging ? '#22223a' : '#1a1a28',
                                borderRadius: 8,
                                marginBottom: 8,
                                borderLeft: `3px solid ${subStyle.color}`,
                                boxShadow: snapshot.isDragging ? '0 8px 24px rgba(0,0,0,.5)' : 'none',
                                cursor: 'grab',
                              }}
                            >
                              {/* Sub-estado badge (prominent, at top) */}
                              {hasMultipleEstados && (
                                <div style={{ marginBottom: 6 }}>
                                  <span style={{
                                    fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                                    background: subStyle.bg, color: subStyle.color,
                                    border: `1px solid ${subStyle.border}`,
                                    letterSpacing: 0.3,
                                  }}>
                                    {SUB_ESTADO_SHORT[c.estado] || c.estado}
                                  </span>
                                </div>
                              )}

                              {/* Name + days + semaforo */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{c.nombre}</span>
                                {(() => {
                                  if (!c.estado_changed_at) return null
                                  const days = Math.floor((Date.now() - new Date(c.estado_changed_at).getTime()) / 86400000)
                                  if (days <= 0) return null
                                  return <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, fontWeight: 700, background: days > 5 ? 'rgba(245,54,92,.15)' : 'rgba(106,106,128,.1)', color: days > 5 ? '#f5365c' : '#6a6a80' }}>{days}d</span>
                                })()}
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
                                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                                    {copy && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: copy.color + '20', color: copy.color, fontWeight: 600 }}><i className="fas fa-pen-fancy" style={{ fontSize: 7, marginRight: 3 }} />{copy.nombre}</span>}
                                    {editor && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: editor.color + '20', color: editor.color, fontWeight: 600 }}><i className="fas fa-film" style={{ fontSize: 7, marginRight: 3 }} />{editor.nombre}</span>}
                                    {disenador && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: disenador.color + '20', color: disenador.color, fontWeight: 600 }}><i className="fas fa-palette" style={{ fontSize: 7, marginRight: 3 }} />{disenador.nombre}</span>}
                                  </div>
                                )
                              })()}

                              {/* Videos */}
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

                              {/* Fecha de grabacion */}
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
                                    padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
                                    background: isConfirmada ? 'rgba(0,217,126,0.08)' : 'rgba(245,166,35,0.08)',
                                    border: `1px ${isConfirmada ? 'solid' : 'dashed'} ${isConfirmada ? 'rgba(0,217,126,0.3)' : 'rgba(245,166,35,0.3)'}`,
                                  }}>
                                  <i className={`fas ${isConfirmada ? 'fa-calendar-check' : 'fa-calendar-day'}`} style={{ fontSize: 10, color: isConfirmada ? '#00d97e' : '#f5a623' }} />
                                  <span style={{ fontSize: 11, fontWeight: 600, color: isConfirmada ? '#00d97e' : '#f5a623' }}>{formatDateShort(c.fecha_grabacion)}</span>
                                  <span style={{ fontSize: 9, marginLeft: 'auto', padding: '1px 5px', borderRadius: 3, fontWeight: 600,
                                    background: isConfirmada ? 'rgba(0,217,126,0.15)' : 'rgba(245,166,35,0.15)',
                                    color: isConfirmada ? '#00d97e' : '#f5a623',
                                  }}>{isConfirmada ? 'CONF' : 'TENT'}</span>
                                </div>
                              ) : (
                                <div onClick={() => setEditingId(c.id)}
                                  style={{ marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, cursor: 'pointer', border: '1px dashed #2a2a40', color: '#4a4a60', fontSize: 10 }}>
                                  <i className="fas fa-plus" style={{ fontSize: 8 }} /> Grabación
                                </div>
                              )}

                              {/* Nuevo Ciclo */}
                              {col.key === 'anuncios' && (
                                <button onClick={(e) => { e.stopPropagation(); nuevoCiclo(c.id, c.estado) }}
                                  style={{
                                    marginTop: 6, width: '100%', padding: '5px 8px', fontSize: 10, fontWeight: 600,
                                    borderRadius: 6, border: '1px dashed rgba(94,114,228,0.4)', cursor: 'pointer',
                                    background: 'rgba(94,114,228,0.06)', color: '#5e72e4',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                  }}
                                  onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(94,114,228,0.15)' }}
                                  onMouseLeave={e => { (e.currentTarget).style.background = 'rgba(94,114,228,0.06)' }}>
                                  <i className="fas fa-rotate" style={{ fontSize: 9 }} /> Nuevo Ciclo
                                </button>
                              )}
                            </div>
                          )}
                        </Draggable>
                      )
                    })}
                    {provided.placeholder}
                    {byFase[col.key].length === 0 && (
                      <div style={{ padding: 24, textAlign: 'center', color: '#4a4a60', fontSize: 11 }}>Sin items</div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  )
}

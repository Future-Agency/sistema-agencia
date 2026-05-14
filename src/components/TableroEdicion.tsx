'use client'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { supabase, type Cliente, type Owner, type Equipo } from '@/lib/supabase'

type Props = { clientes: Cliente[]; owners: Owner[]; equipo: Equipo[]; onUpdate: () => void }

const ESTADO_ORDER = [
  'CORRECCIÓN',
  'REVISIÓN',
  'EDICION',
  'GRABACION',
  'SUBIDO',
  'SUBIR AL CLICK UP',
]

const ESTADO_STYLES: Record<string, { bg: string; rowBg: string; color: string; icon: string }> = {
  'CORRECCIÓN':       { bg: 'rgba(245,54,92,.25)',   rowBg: 'rgba(245,54,92,.10)',   color: '#f5365c', icon: 'fa-rotate-left' },
  'REVISIÓN':         { bg: 'rgba(245,214,35,.25)',  rowBg: 'rgba(245,214,35,.08)',  color: '#f5d623', icon: 'fa-magnifying-glass' },
  'EDICION':          { bg: 'rgba(94,114,228,.25)',  rowBg: 'rgba(94,114,228,.08)',  color: '#5e72e4', icon: 'fa-film' },
  'GRABACION':        { bg: 'rgba(245,166,35,.25)',  rowBg: 'rgba(245,166,35,.08)',  color: '#f5a623', icon: 'fa-video' },
  'SUBIDO':           { bg: 'rgba(0,217,126,.25)',   rowBg: 'rgba(0,217,126,.08)',   color: '#00d97e', icon: 'fa-check-circle' },
  'SUBIR AL CLICK UP':{ bg: 'rgba(0,180,100,.2)',    rowBg: 'rgba(0,180,100,.06)',   color: '#00b464', icon: 'fa-arrow-up' },
}

function getStyle(estado: string) {
  return ESTADO_STYLES[estado] || { bg: 'rgba(106,106,128,.1)', rowBg: 'rgba(106,106,128,.05)', color: '#6a6a80', icon: 'fa-circle' }
}

export default function TableroEdicion({ clientes, owners, equipo, onUpdate }: Props) {
  const [editingCell, setEditingCell] = useState<{ id: number; field: string } | null>(null)
  const [filterEditor, setFilterEditor] = useState('')
  // Optimistic overrides — mapeo cliente.id → estado_edicion forzado mientras se persiste
  const [optimistic, setOptimistic] = useState<Record<number, string>>({})
  const [savingId, setSavingId] = useState<number | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  const editors = equipo.filter(e => e.rol === 'editor')

  // Aplica overrides optimistas sobre clientes prop
  const clientesEffective = useMemo(() => {
    if (Object.keys(optimistic).length === 0) return clientes
    return clientes.map(c => optimistic[c.id] != null ? { ...c, estado_edicion: optimistic[c.id] } : c)
  }, [clientes, optimistic])

  const ongoing = clientesEffective.filter(c => !c.is_onboarding && c.estado)

  // Limpiar overrides cuando la DB confirma (clientes prop ya tiene el valor esperado)
  useEffect(() => {
    setOptimistic(prev => {
      const next = { ...prev }
      let changed = false
      for (const idStr of Object.keys(prev)) {
        const id = Number(idStr)
        const real = clientes.find(c => c.id === id)
        if (real && real.estado_edicion === prev[id]) {
          delete next[id]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [clientes])

  // Auto-clear toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const filtered = useMemo(() => {
    if (!filterEditor) return ongoing
    if (filterEditor === '__none__') return ongoing.filter(c => !c.editor_id)
    return ongoing.filter(c => c.editor_id === filterEditor)
  }, [ongoing, filterEditor])

  // Group by estado
  const groups = useMemo(() => {
    return ESTADO_ORDER.map(estado => ({
      estado,
      style: getStyle(estado),
      clientes: filtered.filter(c => c.estado_edicion === estado).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    })).filter(g => g.clientes.length > 0)
  }, [filtered])

  // Stats
  const stats = useMemo(() => {
    const counts: Record<string, number> = {}
    ESTADO_ORDER.forEach(e => { counts[e] = 0 })
    ongoing.forEach(c => { if (counts[c.estado_edicion] !== undefined) counts[c.estado_edicion]++ })
    return counts
  }, [ongoing])

  const onDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination) return
    const destEstado = result.destination.droppableId
    const clienteId = parseInt(result.draggableId)
    const cliente = filtered.find(c => c.id === clienteId)
    if (!cliente || cliente.estado_edicion === destEstado) return

    // 1. Optimistic — mover visualmente al instante
    setOptimistic(prev => ({ ...prev, [clienteId]: destEstado }))
    setSavingId(clienteId)

    // 2. Persistir
    const { error } = await supabase.from('clientes')
      .update({ estado_edicion: destEstado, updated_at: new Date().toISOString() })
      .eq('id', clienteId)

    setSavingId(null)

    // 3. Si falla, revertir + toast
    if (error) {
      setOptimistic(prev => {
        const next = { ...prev }
        delete next[clienteId]
        return next
      })
      setToast({ msg: `Error guardando: ${error.message}`, type: 'err' })
      return
    }

    setToast({ msg: `${cliente.nombre} → ${destEstado}`, type: 'ok' })
    onUpdate()
  }, [filtered, onUpdate])

  async function updateField(id: number, field: string, value: string | null) {
    const { error } = await supabase.from('clientes')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', id)
    setEditingCell(null)
    if (error) {
      setToast({ msg: `Error: ${error.message}`, type: 'err' })
      return
    }
    onUpdate()
  }

  return (
    <div className="fade-in">
      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {ESTADO_ORDER.map(e => {
          const s = getStyle(e)
          const count = stats[e] || 0
          return (
            <div key={e} style={{
              flex: '1 1 100px', textAlign: 'center', padding: '8px 6px', borderRadius: 8,
              background: count > 0 ? s.bg : '#12121a',
              border: `1px solid ${count > 0 ? s.color + '40' : '#2a2a40'}`,
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{count}</div>
              <div style={{ fontSize: 9, color: s.color, fontWeight: 600, opacity: count > 0 ? 1 : 0.5 }}>{e}</div>
            </div>
          )
        })}
      </div>

      {/* Editor filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#6a6a80', fontWeight: 600, marginRight: 4 }}>Editor:</span>
        <span className={`owner-chip ${filterEditor === '' ? 'active' : ''}`} onClick={() => setFilterEditor('')}>Todos</span>
        {editors.map(e => (
          <span key={e.id} className={`owner-chip ${filterEditor === e.id ? 'active' : ''}`}
            onClick={() => setFilterEditor(filterEditor === e.id ? '' : e.id)}
            style={filterEditor === e.id ? { borderColor: e.color, color: e.color, background: `${e.color}18` } : {}}>
            {e.nombre}
          </span>
        ))}
        <span className={`owner-chip ${filterEditor === '__none__' ? 'active' : ''}`}
          onClick={() => setFilterEditor(filterEditor === '__none__' ? '' : '__none__')}
          style={filterEditor === '__none__' ? {} : { fontStyle: 'italic' }}>
          Sin asignar
        </span>
      </div>

      {/* Grouped table with DnD */}
      <DragDropContext onDragEnd={onDragEnd}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr 0.7fr 1.2fr 0.6fr 1fr', gap: 0, background: '#12121a', borderRadius: '10px 10px 0 0', border: '1px solid #2a2a40', borderBottom: 'none' }}>
          {['CLIENTE', 'COPY', 'FECHA EDICIÓN', 'EDITOR', 'REELS', 'ADS', 'REELS TERMINADOS'].map(h => (
            <div key={h} style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: '#6a6a80', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</div>
          ))}
        </div>

        {/* Groups */}
        {ESTADO_ORDER.map(estado => {
          const s = getStyle(estado)
          const groupClientes = (groups.find(g => g.estado === estado)?.clientes) || []

          return (
            <Droppable key={estado} droppableId={estado}>
              {(provided, snapshot) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {/* Section header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 12px',
                    background: snapshot.isDraggingOver ? s.bg : s.rowBg,
                    borderLeft: `4px solid ${s.color}`,
                    borderRight: '1px solid #2a2a40',
                    transition: 'background .2s',
                  }}>
                    <i className={`fas ${s.icon}`} style={{ color: s.color, fontSize: 12 }} />
                    <span style={{ fontSize: 12, fontWeight: 800, color: s.color }}>{estado}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.color, opacity: 0.7 }}>({groupClientes.length})</span>
                    {groupClientes.length === 0 && (
                      <span style={{ fontSize: 10, color: '#4a4a60', fontStyle: 'italic', marginLeft: 8 }}>Arrastrá clientes aquí</span>
                    )}
                  </div>

                  {/* Rows */}
                  {groupClientes.map((c, index) => {
                    const editor = editors.find(e => e.id === c.editor_id)
                    const copyMember = equipo.find(e => e.id === c.copy_id)

                    return (
                      <Draggable key={c.id} draggableId={String(c.id)} index={index}>
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            style={{
                              ...dragProvided.draggableProps.style,
                              display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr 0.7fr 1.2fr 0.6fr 1fr',
                              background: dragSnapshot.isDragging ? s.bg : s.rowBg,
                              borderLeft: `4px solid ${s.color}`,
                              borderBottom: `1px solid ${s.color}15`,
                              borderRight: '1px solid #2a2a40',
                              cursor: 'grab',
                              opacity: dragSnapshot.isDragging ? 0.9 : savingId === c.id ? 0.7 : 1,
                              boxShadow: dragSnapshot.isDragging ? `0 4px 20px ${s.color}30` : savingId === c.id ? `0 0 0 1px ${s.color}88` : 'none',
                              transition: dragSnapshot.isDragging ? 'none' : 'background .15s, opacity .2s',
                            }}
                            onMouseEnter={e => { if (!dragSnapshot.isDragging) (e.currentTarget as HTMLElement).style.background = s.bg }}
                            onMouseLeave={e => { if (!dragSnapshot.isDragging) (e.currentTarget as HTMLElement).style.background = s.rowBg }}
                          >
                            {/* Cliente */}
                            <div style={cellS}>
                              <span style={{ fontWeight: 700, fontSize: 12 }}>{c.nombre}</span>
                            </div>

                            {/* Copy */}
                            <div style={cellS}>
                              {editingCell?.id === c.id && editingCell.field === 'copy_id_ed' ? (
                                <select className="editable-select" autoFocus value={c.copy_id || ''}
                                  style={{ fontSize: 10, padding: '2px 4px', minWidth: 70 }}
                                  onChange={e => updateField(c.id, 'copy_id', e.target.value || null)}
                                  onBlur={() => setEditingCell(null)}>
                                  <option value="">--</option>
                                  {equipo.filter(e => e.rol === 'copy').map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                                </select>
                              ) : (
                                <span onClick={() => setEditingCell({ id: c.id, field: 'copy_id_ed' })}
                                  style={{ cursor: 'pointer', fontSize: 11, fontWeight: 600, color: copyMember?.color || '#4a4a60' }}>
                                  {copyMember?.nombre || '--'}
                                </span>
                              )}
                            </div>

                            {/* Fecha */}
                            <div style={cellS}>
                              {editingCell?.id === c.id && editingCell.field === 'fecha_edicion' ? (
                                <input type="date" className="editable-select" autoFocus defaultValue={c.fecha_edicion || ''}
                                  style={{ fontSize: 10, padding: '2px 4px' }}
                                  onBlur={e => updateField(c.id, 'fecha_edicion', e.target.value || null)}
                                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                />
                              ) : (
                                <span onClick={() => setEditingCell({ id: c.id, field: 'fecha_edicion' })}
                                  style={{ cursor: 'pointer', fontSize: 11, color: c.fecha_edicion ? '#e8e8f0' : '#3a3a50', fontWeight: c.fecha_edicion ? 600 : 400 }}>
                                  {c.fecha_edicion || '+ fecha'}
                                </span>
                              )}
                            </div>

                            {/* Editor */}
                            <div style={cellS}>
                              {editingCell?.id === c.id && editingCell.field === 'editor_id_ed' ? (
                                <select className="editable-select" autoFocus value={c.editor_id || ''}
                                  style={{ fontSize: 10, padding: '2px 4px', minWidth: 70 }}
                                  onChange={e => updateField(c.id, 'editor_id', e.target.value || null)}
                                  onBlur={() => setEditingCell(null)}>
                                  <option value="">--</option>
                                  {editors.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                                </select>
                              ) : (
                                <span onClick={() => setEditingCell({ id: c.id, field: 'editor_id_ed' })}
                                  style={{
                                    cursor: 'pointer', fontSize: 11, fontWeight: 700,
                                    color: editor ? '#fff' : '#4a4a60',
                                    background: editor ? editor.color : 'transparent',
                                    padding: editor ? '2px 8px' : 0, borderRadius: 4,
                                  }}>
                                  {editor?.nombre || '--'}
                                </span>
                              )}
                            </div>

                            {/* Reels */}
                            <div style={cellS}>
                              {editingCell?.id === c.id && editingCell.field === 'reels_info' ? (
                                <input className="editable-select" autoFocus defaultValue={c.reels_info || ''}
                                  style={{ width: '100%', fontSize: 10, padding: '2px 4px' }}
                                  onBlur={e => updateField(c.id, 'reels_info', e.target.value || null)}
                                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingCell(null) }}
                                />
                              ) : (
                                <span onClick={() => setEditingCell({ id: c.id, field: 'reels_info' })}
                                  style={{ cursor: 'pointer', fontSize: 10, color: c.reels_info ? '#a0a0b8' : '#3a3a50' }}>
                                  {c.reels_info || '+ info'}
                                </span>
                              )}
                            </div>

                            {/* Ads */}
                            <div style={cellS}>
                              {editingCell?.id === c.id && editingCell.field === 'ads_info' ? (
                                <input className="editable-select" autoFocus defaultValue={c.ads_info || ''}
                                  style={{ width: '100%', fontSize: 10, padding: '2px 4px' }}
                                  onBlur={e => updateField(c.id, 'ads_info', e.target.value || null)}
                                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingCell(null) }}
                                />
                              ) : (
                                <span onClick={() => setEditingCell({ id: c.id, field: 'ads_info' })}
                                  style={{ cursor: 'pointer', fontSize: 10, color: c.ads_info ? '#a0a0b8' : '#3a3a50' }}>
                                  {c.ads_info || '+ info'}
                                </span>
                              )}
                            </div>

                            {/* Reels Terminados */}
                            <div style={cellS}>
                              {editingCell?.id === c.id && editingCell.field === 'reels_terminados' ? (
                                <input className="editable-select" autoFocus defaultValue={c.reels_terminados || ''}
                                  style={{ width: '100%', fontSize: 10, padding: '2px 4px' }}
                                  onBlur={e => updateField(c.id, 'reels_terminados', e.target.value || null)}
                                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingCell(null) }}
                                />
                              ) : (
                                <span onClick={() => setEditingCell({ id: c.id, field: 'reels_terminados' })}
                                  style={{ cursor: 'pointer', fontSize: 10, color: c.reels_terminados ? '#a0a0b8' : '#3a3a50' }}>
                                  {c.reels_terminados || '+ info'}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    )
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          )
        })}
      </DragDropContext>

      {/* Toast de feedback */}
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

const cellS: React.CSSProperties = {
  padding: '8px 12px', display: 'flex', alignItems: 'center', minHeight: 36,
  overflow: 'hidden',
}

'use client'
import { useState, useMemo, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { supabase, type Cliente, type Owner, type Equipo } from '@/lib/supabase'

type Props = { clientes: Cliente[]; owners: Owner[]; equipo: Equipo[]; onUpdate: () => void }

const ESTADO_ORDER = [
  'TRABAJANDO',
  'DISEÑO',
  'SUBIDO',
]

const ESTADO_STYLES: Record<string, { bg: string; rowBg: string; color: string; icon: string }> = {
  'TRABAJANDO': { bg: 'rgba(245,166,35,.25)', rowBg: 'rgba(245,166,35,.08)', color: '#f5a623', icon: 'fa-pen-ruler' },
  'DISEÑO':     { bg: 'rgba(94,114,228,.25)', rowBg: 'rgba(94,114,228,.08)', color: '#5e72e4', icon: 'fa-palette' },
  'SUBIDO':     { bg: 'rgba(0,217,126,.25)',   rowBg: 'rgba(0,217,126,.08)', color: '#00d97e', icon: 'fa-check-circle' },
}

function getStyle(estado: string) {
  return ESTADO_STYLES[estado] || { bg: 'rgba(106,106,128,.1)', rowBg: 'rgba(106,106,128,.05)', color: '#6a6a80', icon: 'fa-circle' }
}

export default function TableroDiseno({ clientes, owners, equipo, onUpdate }: Props) {
  const [editingCell, setEditingCell] = useState<{ id: number; field: string } | null>(null)
  const [filterDisenador, setFilterDisenador] = useState('')

  const disenadores = equipo.filter(e => e.rol === 'diseñador')
  const ongoing = clientes.filter(c => !c.is_onboarding && c.estado)

  const filtered = useMemo(() => {
    if (!filterDisenador) return ongoing
    if (filterDisenador === '__none__') return ongoing.filter(c => !c.disenador_id)
    return ongoing.filter(c => c.disenador_id === filterDisenador)
  }, [ongoing, filterDisenador])

  const groups = useMemo(() => {
    return ESTADO_ORDER.map(estado => ({
      estado,
      style: getStyle(estado),
      clientes: filtered.filter(c => c.estado_diseno === estado).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    })).filter(g => g.clientes.length > 0)
  }, [filtered])

  const stats = useMemo(() => {
    const counts: Record<string, number> = {}
    ESTADO_ORDER.forEach(e => { counts[e] = 0 })
    ongoing.forEach(c => { if (counts[c.estado_diseno] !== undefined) counts[c.estado_diseno]++ })
    return counts
  }, [ongoing])

  const onDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination) return
    const destEstado = result.destination.droppableId
    const clienteId = parseInt(result.draggableId)
    const cliente = filtered.find(c => c.id === clienteId)
    if (!cliente || cliente.estado_diseno === destEstado) return
    await supabase.from('clientes').update({ estado_diseno: destEstado, updated_at: new Date().toISOString() }).eq('id', clienteId)
    onUpdate()
  }, [filtered, onUpdate])

  async function updateField(id: number, field: string, value: string | null) {
    await supabase.from('clientes').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', id)
    setEditingCell(null)
    onUpdate()
  }

  return (
    <div className="fade-in">
      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {ESTADO_ORDER.map(e => {
          const s = getStyle(e)
          const count = stats[e] || 0
          return (
            <div key={e} style={{
              flex: '1 1 160px', textAlign: 'center', padding: '10px 8px', borderRadius: 10,
              background: count > 0 ? s.bg : '#12121a',
              border: `1px solid ${count > 0 ? s.color + '40' : '#2a2a40'}`,
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{count}</div>
              <div style={{ fontSize: 10, color: s.color, fontWeight: 600, opacity: count > 0 ? 1 : 0.5 }}>{e}</div>
            </div>
          )
        })}
      </div>

      {/* Diseñador filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#6a6a80', fontWeight: 600, marginRight: 4 }}>Diseñador:</span>
        <span className={`owner-chip ${filterDisenador === '' ? 'active' : ''}`} onClick={() => setFilterDisenador('')}>Todos</span>
        {disenadores.map(e => (
          <span key={e.id} className={`owner-chip ${filterDisenador === e.id ? 'active' : ''}`}
            onClick={() => setFilterDisenador(filterDisenador === e.id ? '' : e.id)}
            style={filterDisenador === e.id ? { borderColor: e.color, color: e.color, background: `${e.color}18` } : {}}>
            {e.nombre}
          </span>
        ))}
        <span className={`owner-chip ${filterDisenador === '__none__' ? 'active' : ''}`}
          onClick={() => setFilterDisenador(filterDisenador === '__none__' ? '' : '__none__')}
          style={filterDisenador === '__none__' ? {} : { fontStyle: 'italic' }}>
          Sin asignar
        </span>
      </div>

      {/* Grouped table with DnD */}
      <DragDropContext onDragEnd={onDragEnd}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr 0.8fr 1fr 1fr 1fr', gap: 0, background: '#12121a', borderRadius: '10px 10px 0 0', border: '1px solid #2a2a40', borderBottom: 'none' }}>
          {['CLIENTE', 'COPY', 'FECHA DISEÑO', 'DISEÑADOR', 'HISTORIAS', 'CARROUSELES', 'PORTADAS'].map(h => (
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
                    const disenador = disenadores.find(e => e.id === c.disenador_id)
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
                              display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr 0.8fr 1fr 1fr 1fr',
                              background: dragSnapshot.isDragging ? s.bg : s.rowBg,
                              borderLeft: `4px solid ${s.color}`,
                              borderBottom: `1px solid ${s.color}15`,
                              borderRight: '1px solid #2a2a40',
                              cursor: 'grab',
                              opacity: dragSnapshot.isDragging ? 0.9 : 1,
                              boxShadow: dragSnapshot.isDragging ? `0 4px 20px ${s.color}30` : 'none',
                              transition: dragSnapshot.isDragging ? 'none' : 'background .15s',
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
                              {editingCell?.id === c.id && editingCell.field === 'copy_id_dis' ? (
                                <select className="editable-select" autoFocus value={c.copy_id || ''}
                                  style={{ fontSize: 10, padding: '2px 4px', minWidth: 70 }}
                                  onChange={e => updateField(c.id, 'copy_id', e.target.value || null)}
                                  onBlur={() => setEditingCell(null)}>
                                  <option value="">--</option>
                                  {equipo.filter(e => e.rol === 'copy').map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                                </select>
                              ) : (
                                <span onClick={() => setEditingCell({ id: c.id, field: 'copy_id_dis' })}
                                  style={{ cursor: 'pointer', fontSize: 11, fontWeight: 600, color: copyMember?.color || '#4a4a60' }}>
                                  {copyMember?.nombre || '--'}
                                </span>
                              )}
                            </div>

                            {/* Fecha */}
                            <div style={cellS}>
                              {editingCell?.id === c.id && editingCell.field === 'fecha_diseno' ? (
                                <input type="date" className="editable-select" autoFocus defaultValue={c.fecha_diseno || ''}
                                  style={{ fontSize: 10, padding: '2px 4px' }}
                                  onBlur={e => updateField(c.id, 'fecha_diseno', e.target.value || null)}
                                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                />
                              ) : (
                                <span onClick={() => setEditingCell({ id: c.id, field: 'fecha_diseno' })}
                                  style={{ cursor: 'pointer', fontSize: 11, color: c.fecha_diseno ? '#e8e8f0' : '#3a3a50', fontWeight: c.fecha_diseno ? 600 : 400 }}>
                                  {c.fecha_diseno || '+ fecha'}
                                </span>
                              )}
                            </div>

                            {/* Diseñador */}
                            <div style={cellS}>
                              {editingCell?.id === c.id && editingCell.field === 'disenador_id_dis' ? (
                                <select className="editable-select" autoFocus value={c.disenador_id || ''}
                                  style={{ fontSize: 10, padding: '2px 4px', minWidth: 70 }}
                                  onChange={e => updateField(c.id, 'disenador_id', e.target.value || null)}
                                  onBlur={() => setEditingCell(null)}>
                                  <option value="">--</option>
                                  {disenadores.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                                </select>
                              ) : (
                                <span onClick={() => setEditingCell({ id: c.id, field: 'disenador_id_dis' })}
                                  style={{
                                    cursor: 'pointer', fontSize: 11, fontWeight: 700,
                                    color: disenador ? '#fff' : '#4a4a60',
                                    background: disenador ? disenador.color : 'transparent',
                                    padding: disenador ? '2px 8px' : 0, borderRadius: 4,
                                  }}>
                                  {disenador?.nombre || '--'}
                                </span>
                              )}
                            </div>

                            {/* Historias */}
                            <div style={cellS}>
                              {editingCell?.id === c.id && editingCell.field === 'historias_info' ? (
                                <input className="editable-select" autoFocus defaultValue={c.historias_info || ''}
                                  style={{ width: '100%', fontSize: 10, padding: '2px 4px' }}
                                  onBlur={e => updateField(c.id, 'historias_info', e.target.value || null)}
                                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingCell(null) }}
                                />
                              ) : (
                                <span onClick={() => setEditingCell({ id: c.id, field: 'historias_info' })}
                                  style={{ cursor: 'pointer', fontSize: 10, color: c.historias_info ? '#a0a0b8' : '#3a3a50' }}>
                                  {c.historias_info || '+ info'}
                                </span>
                              )}
                            </div>

                            {/* Carrouseles */}
                            <div style={cellS}>
                              {editingCell?.id === c.id && editingCell.field === 'carrouseles_info' ? (
                                <input className="editable-select" autoFocus defaultValue={c.carrouseles_info || ''}
                                  style={{ width: '100%', fontSize: 10, padding: '2px 4px' }}
                                  onBlur={e => updateField(c.id, 'carrouseles_info', e.target.value || null)}
                                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingCell(null) }}
                                />
                              ) : (
                                <span onClick={() => setEditingCell({ id: c.id, field: 'carrouseles_info' })}
                                  style={{ cursor: 'pointer', fontSize: 10, color: c.carrouseles_info ? '#a0a0b8' : '#3a3a50' }}>
                                  {c.carrouseles_info || '+ info'}
                                </span>
                              )}
                            </div>

                            {/* Portadas */}
                            <div style={cellS}>
                              {editingCell?.id === c.id && editingCell.field === 'portadas_info' ? (
                                <input className="editable-select" autoFocus defaultValue={c.portadas_info || ''}
                                  style={{ width: '100%', fontSize: 10, padding: '2px 4px' }}
                                  onBlur={e => updateField(c.id, 'portadas_info', e.target.value || null)}
                                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingCell(null) }}
                                />
                              ) : (
                                <span onClick={() => setEditingCell({ id: c.id, field: 'portadas_info' })}
                                  style={{ cursor: 'pointer', fontSize: 10, color: c.portadas_info ? '#a0a0b8' : '#3a3a50' }}>
                                  {c.portadas_info || '+ info'}
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
    </div>
  )
}

const cellS: React.CSSProperties = {
  padding: '8px 12px', display: 'flex', alignItems: 'center', minHeight: 36,
  overflow: 'hidden',
}

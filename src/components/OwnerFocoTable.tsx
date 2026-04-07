'use client'
import { useState, useMemo } from 'react'
import { SemaforoIcon, Badge } from './ui'
import { supabase, type Cliente, type Owner, type Equipo } from '@/lib/supabase'
import { updateEstado } from '@/lib/estadoHelper'
import { ESTADO_OPTIONS_ONGOING, getEstadoStyle } from '@/lib/estados'

type Props = {
  clientes: Cliente[]
  owner: Owner
  equipo: Equipo[]
  onUpdate: () => void
  onSelectCliente: (c: Cliente) => void
}

const SEMAFORO_OPTIONS = [
  { value: 'green', color: '#00d97e' },
  { value: 'yellow', color: '#f5a623' },
  { value: 'red', color: '#f5365c' },
]

const RIESGO_OPTIONS: { value: string; label: string; color: string; bg: string }[] = [
  { value: 'muy_alto', label: 'Muy Alto', color: '#f5365c', bg: 'rgba(245,54,92,.15)' },
  { value: 'alto', label: 'Alto', color: '#f5a623', bg: 'rgba(245,166,35,.15)' },
  { value: 'medio', label: 'Medio', color: '#f5d623', bg: 'rgba(245,214,35,.12)' },
  { value: 'bajo', label: 'Bajo', color: '#00d97e', bg: 'rgba(0,217,126,.12)' },
  { value: 'no', label: 'NO', color: '#6a6a80', bg: 'rgba(106,106,128,.1)' },
]

const ESTADO_OPTIONS = [...ESTADO_OPTIONS_ONGOING, 'Onboarding']

const SEMAFORO_ORDER: Record<string, number> = { red: 0, yellow: 1, blue: 2, green: 3 }

type SortMode = 'semaforo' | 'manual' | 'nombre'

export default function OwnerFocoTable({ clientes, owner, equipo, onUpdate, onSelectCliente }: Props) {
  const editors = equipo.filter(e => e.rol === 'editor')
  const copys = equipo.filter(e => e.rol === 'copy')
  const disenadores = equipo.filter(e => e.rol === 'diseñador')

  const [editingCell, setEditingCell] = useState<{ id: number; field: string } | null>(null)
  const [expandedNota, setExpandedNota] = useState<number | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('semaforo')

  const sorted = useMemo(() => {
    const arr = [...clientes]
    if (sortMode === 'semaforo') {
      arr.sort((a, b) => (SEMAFORO_ORDER[a.semaforo_general] ?? 2) - (SEMAFORO_ORDER[b.semaforo_general] ?? 2))
    } else if (sortMode === 'nombre') {
      arr.sort((a, b) => a.nombre.localeCompare(b.nombre))
    } else {
      arr.sort((a, b) => (a.orden_owner ?? 999) - (b.orden_owner ?? 999))
    }
    return arr
  }, [clientes, sortMode])

  async function updateCliente(id: number, field: string, value: string | null) {
    if (field === 'estado') {
      const oldEstado = sorted.find(c => c.id === id)?.estado || null
      await updateEstado(id, value || '', oldEstado)
    } else {
      await supabase.from('clientes').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', id)
    }
    setEditingCell(null)
    onUpdate()
  }

  async function moveRow(clienteId: number, direction: 'up' | 'down') {
    const idx = sorted.findIndex(c => c.id === clienteId)
    if (idx === -1) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === sorted.length - 1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const updates = sorted.map((c, i) => {
      if (i === idx) return { id: c.id, orden: swapIdx }
      if (i === swapIdx) return { id: c.id, orden: idx }
      return { id: c.id, orden: i }
    })
    await Promise.all(updates.map(u => supabase.from('clientes').update({ orden_owner: u.orden }).eq('id', u.id)))
    setSortMode('manual')
    onUpdate()
  }

  function getRiesgoInfo(nivel: string | null) {
    return RIESGO_OPTIONS.find(r => r.value === nivel) || null
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>
          <i className="fas fa-crosshairs" style={{ color: owner.color, marginRight: 6 }} />
          FOCO — Clientes
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {(['semaforo', 'manual', 'nombre'] as SortMode[]).map(m => (
            <button key={m} onClick={() => setSortMode(m)}
              style={{
                fontSize: 10, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                border: sortMode === m ? `1px solid ${owner.color}` : '1px solid #2a2a40',
                background: sortMode === m ? `${owner.color}15` : 'transparent',
                color: sortMode === m ? owner.color : '#6a6a80',
                fontWeight: 600,
              }}>
              {m === 'semaforo' ? '🔴🟡🟢' : m === 'manual' ? '↕ Manual' : 'A-Z'}
            </button>
          ))}
        </div>
      </div>
      <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {sortMode === 'manual' && <th style={{ ...thStyle, width: 30 }}></th>}
              <th style={thStyle}></th>
              <th style={thStyle}>Cliente</th>
              <th style={thStyle}>Estado</th>
              <th style={thStyle}>Últ. Contacto</th>
              <th style={thStyle}>Últ. Pub</th>
              <th style={{ ...thStyle, minWidth: 180 }}>Próximo Hito</th>
              <th style={thStyle}>Editor</th>
              <th style={thStyle}>Copy</th>
              <th style={thStyle}>Diseño</th>
              <th style={thStyle}>Riesgo</th>
              <th style={{ ...thStyle, minWidth: 160 }}>¿Por qué?</th>
              <th style={{ ...thStyle, minWidth: 140 }}>Notas</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, idx) => {
              const riesgoInfo = getRiesgoInfo(c.riesgo_nivel)
              const estadoStyle = getEstadoStyle(c.estado)
              const isEven = idx % 2 === 0

              return (
                <tr key={c.id} style={{ background: isEven ? 'transparent' : 'rgba(255,255,255,0.015)', borderBottom: '1px solid #1a1a28' }}
                  className="foco-row">
                  {/* Manual reorder arrows */}
                  {sortMode === 'manual' && (
                    <td style={{ ...tdStyle, padding: '2px 4px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => moveRow(c.id, 'up')} disabled={idx === 0}
                        style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? '#2a2a40' : '#6a6a80', fontSize: 10, padding: '0 1px' }}>
                        <i className="fas fa-chevron-up" />
                      </button>
                      <button onClick={() => moveRow(c.id, 'down')} disabled={idx === sorted.length - 1}
                        style={{ background: 'none', border: 'none', cursor: idx === sorted.length - 1 ? 'default' : 'pointer', color: idx === sorted.length - 1 ? '#2a2a40' : '#6a6a80', fontSize: 10, padding: '0 1px' }}>
                        <i className="fas fa-chevron-down" />
                      </button>
                    </td>
                  )}
                  {/* Semáforo */}
                  <td style={tdStyle}>
                    {editingCell?.id === c.id && editingCell?.field === 'semaforo' ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {SEMAFORO_OPTIONS.map(s => (
                          <button key={s.value} onClick={() => updateCliente(c.id, 'semaforo_general', s.value)}
                            style={{ width: 18, height: 18, borderRadius: '50%', background: s.color, border: c.semaforo_general === s.value ? '2px solid white' : '2px solid transparent', cursor: 'pointer' }} />
                        ))}
                        <button onClick={() => setEditingCell(null)} style={{ background: 'none', border: 'none', color: '#6a6a80', cursor: 'pointer', fontSize: 9 }}>✕</button>
                      </div>
                    ) : (
                      <div onClick={() => setEditingCell({ id: c.id, field: 'semaforo' })} style={{ cursor: 'pointer' }}>
                        <SemaforoIcon color={c.semaforo_general} />
                      </div>
                    )}
                  </td>

                  {/* Cliente */}
                  <td style={{ ...tdStyle, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => onSelectCliente(c)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {c.nombre}
                      {c.is_onboarding && <Badge color="yellow">OB</Badge>}
                    </div>
                  </td>

                  {/* Estado */}
                  <td style={tdStyle}>
                    {editingCell?.id === c.id && editingCell?.field === 'estado' ? (
                      <select className="editable-select" autoFocus value={c.estado}
                        style={{ fontSize: 10, padding: '2px 4px', minWidth: 120 }}
                        onChange={e => updateCliente(c.id, 'estado', e.target.value)}
                        onBlur={() => setEditingCell(null)}>
                        {ESTADO_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                        {!ESTADO_OPTIONS.includes(c.estado) && <option value={c.estado}>{c.estado}</option>}
                      </select>
                    ) : (
                      <span onClick={() => setEditingCell({ id: c.id, field: 'estado' })}
                        style={{ cursor: 'pointer', padding: '2px 6px', borderRadius: 4, background: estadoStyle.bg, color: estadoStyle.color, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {c.estado || '-'}
                      </span>
                    )}
                  </td>

                  {/* Último contacto */}
                  <td style={tdStyle}>
                    {editingCell?.id === c.id && editingCell?.field === 'ultimo_contacto' ? (
                      <input className="editable-select" autoFocus defaultValue={c.ultimo_contacto}
                        style={{ width: 70, fontSize: 11, padding: '2px 4px' }}
                        onBlur={e => updateCliente(c.id, 'ultimo_contacto', e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingCell(null) }}
                      />
                    ) : (
                      <span onClick={() => setEditingCell({ id: c.id, field: 'ultimo_contacto' })}
                        style={{ cursor: 'pointer', color: '#a0a0b8', fontSize: 11 }}>
                        {c.ultimo_contacto || '-'}
                      </span>
                    )}
                  </td>

                  {/* Última publicación */}
                  <td style={tdStyle}>
                    {editingCell?.id === c.id && editingCell?.field === 'ultima_publicacion' ? (
                      <input className="editable-select" autoFocus defaultValue={c.ultima_publicacion}
                        style={{ width: 70, fontSize: 11, padding: '2px 4px' }}
                        onBlur={e => updateCliente(c.id, 'ultima_publicacion', e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingCell(null) }}
                      />
                    ) : (
                      <span onClick={() => setEditingCell({ id: c.id, field: 'ultima_publicacion' })}
                        style={{ cursor: 'pointer', color: '#a0a0b8', fontSize: 11 }}>
                        {c.ultima_publicacion || '-'}
                      </span>
                    )}
                  </td>

                  {/* Próximo hito */}
                  <td style={tdStyle}>
                    {editingCell?.id === c.id && editingCell?.field === 'proximo_hito' ? (
                      <textarea className="editable-select" autoFocus defaultValue={c.proximo_hito}
                        style={{ width: '100%', fontSize: 11, padding: '3px 5px', minHeight: 40, resize: 'vertical' }}
                        onBlur={e => updateCliente(c.id, 'proximo_hito', e.target.value)}
                        onKeyDown={e => { if (e.key === 'Escape') setEditingCell(null) }}
                      />
                    ) : (
                      <span onClick={() => setEditingCell({ id: c.id, field: 'proximo_hito' })}
                        style={{ cursor: 'pointer', color: '#e8e8f0', fontSize: 11, lineHeight: 1.4, display: 'block', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: c.proximo_hito?.length > 60 ? 'normal' : 'nowrap' }}>
                        {c.proximo_hito || <span style={{ color: '#3a3a50' }}>+ hito</span>}
                      </span>
                    )}
                  </td>

                  {/* Editor */}
                  <td style={tdStyle}>
                    {editingCell?.id === c.id && editingCell?.field === 'editor_id' ? (
                      <select className="editable-select" autoFocus value={c.editor_id || ''}
                        style={{ fontSize: 10, padding: '2px 4px', minWidth: 80 }}
                        onChange={e => updateCliente(c.id, 'editor_id', e.target.value || null)}
                        onBlur={() => setEditingCell(null)}>
                        <option value="">—</option>
                        {editors.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                      </select>
                    ) : (
                      <span onClick={() => setEditingCell({ id: c.id, field: 'editor_id' })}
                        style={{ cursor: 'pointer', fontSize: 10, fontWeight: 600, color: editors.find(e => e.id === c.editor_id)?.color || '#3a3a50' }}>
                        {editors.find(e => e.id === c.editor_id)?.nombre || '—'}
                      </span>
                    )}
                  </td>

                  {/* Copy */}
                  <td style={tdStyle}>
                    {editingCell?.id === c.id && editingCell?.field === 'copy_id' ? (
                      <select className="editable-select" autoFocus value={c.copy_id || ''}
                        style={{ fontSize: 10, padding: '2px 4px', minWidth: 80 }}
                        onChange={e => updateCliente(c.id, 'copy_id', e.target.value || null)}
                        onBlur={() => setEditingCell(null)}>
                        <option value="">—</option>
                        {copys.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                      </select>
                    ) : (
                      <span onClick={() => setEditingCell({ id: c.id, field: 'copy_id' })}
                        style={{ cursor: 'pointer', fontSize: 10, fontWeight: 600, color: copys.find(e => e.id === c.copy_id)?.color || '#3a3a50' }}>
                        {copys.find(e => e.id === c.copy_id)?.nombre || '—'}
                      </span>
                    )}
                  </td>

                  {/* Diseño */}
                  <td style={tdStyle}>
                    {editingCell?.id === c.id && editingCell?.field === 'disenador_id' ? (
                      <select className="editable-select" autoFocus value={c.disenador_id || ''}
                        style={{ fontSize: 10, padding: '2px 4px', minWidth: 80 }}
                        onChange={e => updateCliente(c.id, 'disenador_id', e.target.value || null)}
                        onBlur={() => setEditingCell(null)}>
                        <option value="">—</option>
                        {disenadores.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                      </select>
                    ) : (
                      <span onClick={() => setEditingCell({ id: c.id, field: 'disenador_id' })}
                        style={{ cursor: 'pointer', fontSize: 10, fontWeight: 600, color: disenadores.find(e => e.id === c.disenador_id)?.color || '#3a3a50' }}>
                        {disenadores.find(e => e.id === c.disenador_id)?.nombre || '—'}
                      </span>
                    )}
                  </td>

                  {/* Riesgo nivel */}
                  <td style={tdStyle}>
                    {editingCell?.id === c.id && editingCell?.field === 'riesgo_nivel' ? (
                      <select className="editable-select" autoFocus value={c.riesgo_nivel || ''}
                        style={{ fontSize: 10, padding: '2px 4px' }}
                        onChange={e => updateCliente(c.id, 'riesgo_nivel', e.target.value || null)}
                        onBlur={() => setEditingCell(null)}>
                        <option value="">-</option>
                        {RIESGO_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    ) : (
                      <span onClick={() => setEditingCell({ id: c.id, field: 'riesgo_nivel' })}
                        style={{
                          cursor: 'pointer', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
                          background: riesgoInfo?.bg || 'transparent',
                          color: riesgoInfo?.color || '#4a4a60',
                        }}>
                        {riesgoInfo?.label || '-'}
                      </span>
                    )}
                  </td>

                  {/* Por qué (riesgo detalle) */}
                  <td style={tdStyle}>
                    {editingCell?.id === c.id && editingCell?.field === 'riesgo' ? (
                      <textarea className="editable-select" autoFocus defaultValue={c.riesgo}
                        style={{ width: '100%', fontSize: 11, padding: '3px 5px', minHeight: 40, resize: 'vertical' }}
                        onBlur={e => updateCliente(c.id, 'riesgo', e.target.value)}
                        onKeyDown={e => { if (e.key === 'Escape') setEditingCell(null) }}
                      />
                    ) : (
                      <span onClick={() => setEditingCell({ id: c.id, field: 'riesgo' })}
                        style={{ cursor: 'pointer', color: c.riesgo ? '#f5a623' : '#3a3a50', fontSize: 11, lineHeight: 1.4, display: 'block', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: c.riesgo?.length > 50 ? 'normal' : 'nowrap' }}>
                        {c.riesgo || '+ detalle'}
                      </span>
                    )}
                  </td>

                  {/* Notas */}
                  <td style={tdStyle}>
                    {expandedNota === c.id ? (
                      <div>
                        <textarea className="editable-select" autoFocus defaultValue={c.notas}
                          style={{ width: '100%', fontSize: 11, padding: '3px 5px', minHeight: 60, resize: 'vertical' }}
                          onBlur={e => { updateCliente(c.id, 'notas', e.target.value); setExpandedNota(null) }}
                        />
                        <button onClick={() => setExpandedNota(null)} style={{ fontSize: 9, color: '#6a6a80', background: 'none', border: 'none', cursor: 'pointer', marginTop: 2 }}>cerrar</button>
                      </div>
                    ) : (
                      <span onClick={() => setExpandedNota(c.id)}
                        style={{ cursor: 'pointer', color: c.notas ? '#a0a0b8' : '#3a3a50', fontSize: 10, lineHeight: 1.3, display: 'block', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.notas ? (c.notas.length > 50 ? c.notas.substring(0, 50) + '...' : c.notas) : '+ notas'}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '6px 8px', textAlign: 'left', fontSize: 10, fontWeight: 600,
  color: '#6a6a80', textTransform: 'uppercase', letterSpacing: 0.5,
  whiteSpace: 'nowrap', background: '#12121a', position: 'sticky', top: 0, zIndex: 10,
  borderBottom: '1px solid #2a2a40',
}

const tdStyle: React.CSSProperties = {
  padding: '5px 8px', verticalAlign: 'middle',
}

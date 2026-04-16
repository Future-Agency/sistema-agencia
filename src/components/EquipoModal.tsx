'use client'
import { useState } from 'react'
import { supabase, type Equipo } from '@/lib/supabase'

type Props = { equipo: Equipo[]; agenciaId?: string; onClose: () => void; onUpdate: () => void }

const ROL_OPTIONS: { value: Equipo['rol']; label: string; icon: string }[] = [
  { value: 'copy', label: 'Copy', icon: 'fa-pen-fancy' },
  { value: 'editor', label: 'Editor', icon: 'fa-film' },
  { value: 'diseñador', label: 'Diseñador', icon: 'fa-palette' },
  { value: 'cm', label: 'CM', icon: 'fa-calendar' },
]

const COLORS = ['#5e72e4', '#f5a623', '#00d97e', '#f5365c', '#a78bfa', '#fb7185', '#34d399', '#fbbf24', '#818cf8', '#f472b6']

export default function EquipoModal({ equipo, agenciaId = 'future', onClose, onUpdate }: Props) {
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState<Equipo['rol']>('editor')
  const [color, setColor] = useState('#5e72e4')
  const [saving, setSaving] = useState(false)

  async function addMember() {
    if (!nombre.trim()) return
    setSaving(true)
    await supabase.from('equipo').insert({ nombre: nombre.trim(), rol, color, agencia_id: agenciaId })
    setSaving(false)
    setNombre('')
    onUpdate()
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('equipo').update({ activo: !current }).eq('id', id)
    onUpdate()
  }

  const byRol = ROL_OPTIONS.map(r => ({
    ...r,
    members: equipo.filter(e => e.rol === r.value),
  }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 550 }}>
        <div className="modal-header">
          <h3 style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>
            <i className="fas fa-users-gear" style={{ marginRight: 8, color: '#5e72e4' }} />
            Gestionar Equipo
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6a6a80', cursor: 'pointer', fontSize: 18 }}>&times;</button>
        </div>
        <div className="modal-body">
          {/* Add form */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label className="label">Nombre</label>
              <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre..."
                onKeyDown={e => { if (e.key === 'Enter') addMember() }} />
            </div>
            <div>
              <label className="label">Rol</label>
              <select className="select-custom" value={rol} onChange={e => setRol(e.target.value as Equipo['rol'])}>
                {ROL_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Color</label>
              <div style={{ display: 'flex', gap: 3 }}>
                {COLORS.slice(0, 5).map(c => (
                  <div key={c} onClick={() => setColor(c)}
                    style={{ width: 20, height: 20, borderRadius: 4, background: c, cursor: 'pointer', border: color === c ? '2px solid white' : '2px solid transparent' }} />
                ))}
              </div>
            </div>
            <button className="btn btn-primary" onClick={addMember} disabled={saving} style={{ whiteSpace: 'nowrap' }}>
              <i className="fas fa-plus" /> Agregar
            </button>
          </div>

          {/* Members by rol */}
          {byRol.map(group => (
            <div key={group.value} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6a6a80', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className={`fas ${group.icon}`} style={{ fontSize: 10 }} />
                {group.label} ({group.members.length})
              </div>
              {group.members.length === 0 ? (
                <div style={{ fontSize: 11, color: '#3a3a50', padding: '4px 0' }}>Sin miembros</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {group.members.map(m => (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                      background: '#1a1a28', borderRadius: 6, borderLeft: `3px solid ${m.color}`,
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: m.color }}>{m.nombre}</span>
                      <button onClick={() => toggleActive(m.id, m.activo)}
                        style={{ background: 'none', border: 'none', color: '#4a4a60', cursor: 'pointer', fontSize: 10 }}
                        title="Desactivar">
                        <i className="fas fa-times" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

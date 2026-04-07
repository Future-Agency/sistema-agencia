'use client'
import { useMemo } from 'react'
import { SemaforoIcon } from './ui'
import { supabase, type Cliente, type Equipo, type Owner } from '@/lib/supabase'
import { getEstadoStyle } from '@/lib/estados'

type Props = { clientes: Cliente[]; equipo: Equipo[]; owners: Owner[]; onUpdate: () => void }

const ROL_SECTIONS: { rol: Equipo['rol']; label: string; icon: string; color: string }[] = [
  { rol: 'copy', label: 'COPY', icon: 'fa-pen-fancy', color: '#8965e0' },
  { rol: 'editor', label: 'EDITORES', icon: 'fa-film', color: '#f5a623' },
  { rol: 'diseñador', label: 'DISEÑO', icon: 'fa-palette', color: '#f5365c' },
  { rol: 'cm', label: 'CM', icon: 'fa-calendar', color: '#00d97e' },
]

function daysInState(c: Cliente): number | null {
  if (!c.estado_changed_at) return null
  return Math.floor((Date.now() - new Date(c.estado_changed_at).getTime()) / 86400000)
}

function loadColor(count: number): { color: string; bg: string; label: string } {
  if (count === 0) return { color: '#6a6a80', bg: 'rgba(106,106,128,.1)', label: 'Disponible' }
  if (count <= 2) return { color: '#00d97e', bg: 'rgba(0,217,126,.12)', label: 'Normal' }
  if (count <= 4) return { color: '#f5a623', bg: 'rgba(245,166,35,.12)', label: 'Cargado' }
  return { color: '#f5365c', bg: 'rgba(245,54,92,.12)', label: 'Sobrecargado' }
}

export default function TableroEquipo({ clientes, equipo, owners, onUpdate }: Props) {
  const assignmentMap = useMemo(() => {
    const map = new Map<string, Cliente[]>()
    equipo.forEach(e => {
      const assigned = clientes.filter(c =>
        (e.rol === 'editor' && c.editor_id === e.id) ||
        (e.rol === 'copy' && c.copy_id === e.id) ||
        (e.rol === 'diseñador' && c.disenador_id === e.id) ||
        (e.rol === 'cm' && c.editor_id === e.id) // cm uses general assignment
      )
      map.set(e.id, assigned)
    })
    return map
  }, [clientes, equipo])

  // Unassigned counts per role
  const unassigned = useMemo(() => {
    const ongoing = clientes.filter(c => !c.is_onboarding && c.estado)
    return {
      copy: ongoing.filter(c => !c.copy_id).length,
      editor: ongoing.filter(c => !c.editor_id).length,
      diseñador: ongoing.filter(c => !c.disenador_id).length,
    }
  }, [clientes])

  async function assignCliente(clienteId: number, field: string, equipoId: string | null) {
    await supabase.from('clientes').update({ [field]: equipoId }).eq('id', clienteId)
    onUpdate()
  }

  return (
    <div className="fade-in">
      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {ROL_SECTIONS.filter(r => r.rol !== 'cm').map(section => {
          const members = equipo.filter(e => e.rol === section.rol)
          const totalClients = members.reduce((sum, m) => sum + (assignmentMap.get(m.id)?.length || 0), 0)
          return (
            <div key={section.rol} className="card" style={{ flex: '1 1 200px' }}>
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: `${section.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={`fas ${section.icon}`} style={{ fontSize: 20, color: section.color }} />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: section.color }}>{members.length}</div>
                  <div style={{ fontSize: 11, color: '#6a6a80' }}>{section.label} — {totalClients} clientes</div>
                </div>
                {(unassigned as any)[section.rol] > 0 && (
                  <div style={{ marginLeft: 'auto', fontSize: 10, color: '#f5a623', background: 'rgba(245,166,35,.1)', padding: '2px 6px', borderRadius: 4 }}>
                    {(unassigned as any)[section.rol]} sin asignar
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Sections by role */}
      {ROL_SECTIONS.map(section => {
        const members = equipo.filter(e => e.rol === section.rol)
        if (members.length === 0) return null

        return (
          <div key={section.rol} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <i className={`fas ${section.icon}`} style={{ color: section.color, fontSize: 14 }} />
              <span style={{ fontSize: 15, fontWeight: 700 }}>{section.label}</span>
              <span style={{ fontSize: 12, color: '#6a6a80' }}>({members.length})</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {members.map(member => {
                const assigned = assignmentMap.get(member.id) || []
                const load = loadColor(assigned.length)

                return (
                  <div key={member.id} className="card" style={{ borderLeft: `3px solid ${member.color}` }}>
                    <div className="card-header" style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 8, background: member.color + '22',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: member.color, fontWeight: 700, fontSize: 12,
                          }}>
                            {member.nombre[0]}
                          </div>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{member.nombre}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: load.bg, color: load.color }}>
                            {assigned.length} — {load.label}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="card-body" style={{ padding: assigned.length ? '0' : '12px 14px' }}>
                      {assigned.length === 0 ? (
                        <div style={{ fontSize: 11, color: '#3a3a50', textAlign: 'center' }}>Sin clientes asignados</div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                          <tbody>
                            {assigned.map(c => {
                              const es = getEstadoStyle(c.estado)
                              const days = daysInState(c)
                              const owner = owners.find(o => o.id === c.owner_id)
                              return (
                                <tr key={c.id} style={{ borderBottom: '1px solid #1a1a28' }}>
                                  <td style={{ padding: '6px 10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <SemaforoIcon color={c.semaforo_general} />
                                      <span style={{ fontWeight: 600 }}>{c.nombre}</span>
                                    </div>
                                  </td>
                                  <td style={{ padding: '6px 8px' }}>
                                    <span style={{ padding: '1px 5px', borderRadius: 3, background: es.bg, color: es.color, fontSize: 9, fontWeight: 600 }}>{c.estado}</span>
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                                    {days !== null && days > 0 && (
                                      <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: days > 5 ? 'rgba(245,54,92,.15)' : 'rgba(106,106,128,.1)', color: days > 5 ? '#f5365c' : '#6a6a80' }}>
                                        {days}d
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {equipo.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <i className="fas fa-users-gear" style={{ fontSize: 32, color: '#2a2a40', marginBottom: 12 }} />
          <div style={{ fontSize: 14, color: '#6a6a80', marginBottom: 8 }}>No hay miembros del equipo</div>
          <div style={{ fontSize: 12, color: '#4a4a60' }}>Usa "Gestionar Equipo" en el sidebar para agregar editores, copys y diseñadores.</div>
        </div>
      )}
    </div>
  )
}

'use client'
import { useMemo, useState } from 'react'
import { SemaforoIcon } from './ui'
import type { Cliente, Owner, Equipo } from '@/lib/supabase'
import OwnerFocoTable from './OwnerFocoTable'
import OwnerTodoList from './OwnerTodoList'

type Props = { clientes: Cliente[]; owners: Owner[]; equipo: Equipo[]; onSelectCliente: (c: Cliente) => void; onUpdate: () => void }

export default function TableroOwners({ clientes, owners, equipo, onSelectCliente, onUpdate }: Props) {
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null)

  const ownerStats = useMemo(() => {
    return owners.map(o => {
      const owned = clientes.filter(c => c.owner_id === o.id)
      return {
        ...o, total: owned.length,
        green: owned.filter(c => c.semaforo_general === 'green' || c.semaforo_general === 'blue').length,
        yellow: owned.filter(c => c.semaforo_general === 'yellow').length,
        red: owned.filter(c => c.semaforo_general === 'red').length,
        clientes: owned,
      }
    }).filter(o => o.total > 0)
  }, [clientes, owners])

  const unassigned = useMemo(() => clientes.filter(c => !c.owner_id), [clientes])

  const ownerClientes = useMemo(() => {
    if (!selectedOwner) return []
    return clientes.filter(c => c.owner_id === selectedOwner.id)
  }, [clientes, selectedOwner])

  // ===== DETAIL VIEW =====
  if (selectedOwner) {
    const stats = ownerStats.find(o => o.id === selectedOwner.id)
    return (
      <div className="fade-in">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button className="btn btn-ghost" onClick={() => setSelectedOwner(null)}>
            <i className="fas fa-arrow-left" />
          </button>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: selectedOwner.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectedOwner.color, fontWeight: 700, fontSize: 16 }}>
            {selectedOwner.nombre_corto[0]}
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{selectedOwner.nombre}</h2>
            <span style={{ fontSize: 12, color: '#6a6a80' }}>{ownerClientes.length} clientes activos</span>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {[
            { v: stats?.green || 0, l: 'En tiempo', c: '#00d97e', bg: 'rgba(0,217,126,.1)' },
            { v: stats?.yellow || 0, l: 'En riesgo', c: '#f5a623', bg: 'rgba(245,166,35,.1)' },
            { v: stats?.red || 0, l: 'Críticos', c: '#f5365c', bg: 'rgba(245,54,92,.1)' },
          ].map(s => (
            <div key={s.l} style={{ flex: 1, textAlign: 'center', padding: '10px 8px', background: s.bg, borderRadius: 10, border: `1px solid ${s.c}20` }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* FOCO Table */}
        <OwnerFocoTable clientes={ownerClientes} owner={selectedOwner} equipo={equipo} onUpdate={onUpdate} onSelectCliente={onSelectCliente} />

        {/* TO DO List */}
        <OwnerTodoList owner={selectedOwner} clientes={ownerClientes} />
      </div>
    )
  }

  // ===== OVERVIEW =====
  return (
    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))', gap: 16 }}>
      {ownerStats.map(o => (
        <div key={o.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setSelectedOwner(o)}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: o.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', color: o.color, fontWeight: 700, fontSize: 14 }}>{o.nombre_corto[0]}</div>
              <div><div style={{ fontWeight: 700 }}>{o.nombre}</div><div style={{ fontSize: 12, color: '#6a6a80' }}>{o.total} clientes</div></div>
              <i className="fas fa-chevron-right" style={{ marginLeft: 'auto', color: '#4a4a60', fontSize: 12 }} />
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              {[{ v: o.green, l: 'En tiempo', c: '#00d97e', bg: 'rgba(0,217,126,.12)' }, { v: o.yellow, l: 'En riesgo', c: '#f5a623', bg: 'rgba(245,166,35,.12)' }, { v: o.red, l: 'Críticos', c: '#f5365c', bg: 'rgba(245,54,92,.12)' }].map(s => (
                <div key={s.l} style={{ flex: 1, textAlign: 'center', padding: 10, background: s.bg, borderRadius: 8 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 11, color: '#6a6a80' }}>{s.l}</div>
                </div>
              ))}
            </div>
            {o.clientes.filter(c => c.semaforo_general === 'red').length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#f5365c', marginBottom: 6 }}><i className="fas fa-bell" /> Requieren atención</div>
                {o.clientes.filter(c => c.semaforo_general === 'red').slice(0, 3).map(a => (
                  <div key={a.id} style={{ padding: '6px 10px', background: 'rgba(245,54,92,.08)', borderRadius: 6, marginBottom: 3, fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>{a.nombre}</span><span style={{ color: '#6a6a80', fontSize: 11 }}>{a.estado}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Sin asignar */}
      {unassigned.length > 0 && (
        <div className="card" style={{ opacity: 0.7 }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#2a2a40', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6a6a80', fontWeight: 700, fontSize: 14 }}>?</div>
              <div><div style={{ fontWeight: 700, fontStyle: 'italic' }}>Sin asignar</div><div style={{ fontSize: 12, color: '#6a6a80' }}>{unassigned.length} clientes</div></div>
            </div>
          </div>
          <div className="card-body">
            {unassigned.map(c => (
              <div key={c.id} onClick={(e) => { e.stopPropagation(); onSelectCliente(c) }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #2a2a40' }}>
                <SemaforoIcon color={c.semaforo_general} /><span>{c.nombre}</span><span style={{ marginLeft: 'auto', fontSize: 11, color: '#6a6a80' }}>{c.estado}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

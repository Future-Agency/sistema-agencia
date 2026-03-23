'use client'
import { useMemo } from 'react'
import { SemaforoIcon, Badge } from './ui'
import type { Cliente, Owner } from '@/lib/supabase'

type Props = { clientes: Cliente[]; owners: Owner[]; onSelectCliente: (c: Cliente) => void }

export default function TableroOwners({ clientes, owners, onSelectCliente }: Props) {
  const ownerStats = useMemo(() => {
    return owners.map(o => {
      const owned = clientes.filter(c => c.owner_id === o.id)
      return {
        ...o, total: owned.length,
        green: owned.filter(c => c.semaforo_general === 'green' || c.semaforo_general === 'blue').length,
        yellow: owned.filter(c => c.semaforo_general === 'yellow').length,
        red: owned.filter(c => c.semaforo_general === 'red').length,
        clientes: owned,
        alertas: owned.filter(c => c.semaforo_general === 'red'),
      }
    }).filter(o => o.total > 0)
  }, [clientes, owners])

  return (
    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))', gap: 16 }}>
      {ownerStats.map(o => (
        <div key={o.id} className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: o.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', color: o.color, fontWeight: 700, fontSize: 14 }}>{o.nombre_corto[0]}</div>
              <div><div style={{ fontWeight: 700 }}>{o.nombre}</div><div style={{ fontSize: 12, color: '#6a6a80' }}>{o.total} clientes</div></div>
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
            {o.alertas.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#f5365c', marginBottom: 8 }}><i className="fas fa-bell" /> Requieren atención</div>
                {o.alertas.map(a => (
                  <div key={a.id} onClick={() => onSelectCliente(a)} style={{ padding: '8px 10px', background: 'rgba(245,54,92,.12)', borderRadius: 6, marginBottom: 4, cursor: 'pointer', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>{a.nombre}</span><span style={{ color: '#6a6a80' }}>{a.estado}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#a0a0b8', marginBottom: 8 }}>Todos los clientes</div>
              {o.clientes.map(c => (
                <div key={c.id} onClick={() => onSelectCliente(c)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #2a2a40' }}>
                  <SemaforoIcon color={c.semaforo_general} /><span>{c.nombre}</span><span style={{ marginLeft: 'auto', fontSize: 11, color: '#6a6a80' }}>{c.estado}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

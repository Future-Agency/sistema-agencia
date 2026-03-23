'use client'
import { SemaforoIcon, Badge } from './ui'
import type { Cliente, Owner } from '@/lib/supabase'

type Props = { clientes: Cliente[]; owners: Owner[] }

export default function TableroPauta({ clientes, owners }: Props) {
  const active = clientes.filter(c => c.estado && c.estado !== '')
  const stats = [
    { label: 'Campañas Activas', value: active.filter(c => ['ADS Prendidos','Completo','FIN DEL LOOP'].includes(c.estado)).length, c: '#00d97e', bg: 'rgba(0,217,126,.12)' },
    { label: 'Pendientes ADs', value: active.filter(c => c.estado === 'Anuncios pendientes' || c.is_onboarding).length, c: '#f5a623', bg: 'rgba(245,166,35,.12)' },
    { label: 'Solo Orgánico', value: active.filter(c => !['ADS Prendidos','Completo','FIN DEL LOOP','Anuncios pendientes'].includes(c.estado) && !c.is_onboarding).length, c: '#5e72e4', bg: 'rgba(94,114,228,.12)' },
  ]

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {stats.map(s => (
          <div key={s.label} className="card" style={{ flex: '1 1 200px' }}>
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: s.c }}>{s.value}</span>
              </div>
              <div style={{ fontSize: 13, color: '#a0a0b8' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-header"><span style={{ fontWeight: 600 }}>Estado de Pauta por Cliente</span></div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>Cliente</th><th>Owner</th><th>Tipo</th><th>Estado Pauta</th><th>Semáforo</th></tr></thead>
            <tbody>
              {active.map(c => {
                const pe = ['ADS Prendidos','Completo','FIN DEL LOOP'].includes(c.estado) ? 'Activa' : c.estado === 'Anuncios pendientes' ? 'Pendiente' : c.is_onboarding ? 'En onboarding' : 'En producción'
                const pc = pe === 'Activa' ? 'green' : pe === 'Pendiente' ? 'red' : 'yellow'
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                    <td style={{ color: owners.find(o => o.id === c.owner_id)?.color }}>{owners.find(o => o.id === c.owner_id)?.nombre_corto}</td>
                    <td><Badge color={c.tipo === 'CRM' ? 'blue' : 'purple'}>{c.tipo}</Badge></td>
                    <td><Badge color={pc}>{pe}</Badge></td>
                    <td><SemaforoIcon color={pc} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

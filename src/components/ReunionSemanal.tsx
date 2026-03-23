'use client'
import { SemaforoIcon, Badge } from './ui'
import type { Cliente, Owner } from '@/lib/supabase'

type Props = { clientes: Cliente[]; owners: Owner[] }

export default function ReunionSemanal({ clientes, owners }: Props) {
  const escalables = clientes.filter(c => c.semaforo_general === 'red' || c.semaforo_general === 'yellow')
  const byOwner = owners.map(o => ({ ...o, escalables: escalables.filter(c => c.owner_id === o.id) })).filter(o => o.escalables.length > 0)

  return (
    <div className="fade-in">
      <div className="alert-banner alert-red" style={{ marginBottom: 20 }}>
        <i className="fas fa-users" /><span><strong>Vista Reunión Semanal</strong> — Clientes que requieren escalamiento</span>
      </div>
      {byOwner.map(o => (
        <div key={o.id} className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: o.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', color: o.color, fontWeight: 700, fontSize: 12 }}>{o.nombre_corto[0]}</div>
              <span style={{ fontWeight: 700 }}>{o.nombre}</span>
              <Badge color="red">{o.escalables.length} a escalar</Badge>
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="table">
              <thead><tr><th>Cliente</th><th>Estado</th><th>Riesgo</th><th>Próximo Hito</th></tr></thead>
              <tbody>
                {o.escalables.map(c => (
                  <tr key={c.id}>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><SemaforoIcon color={c.semaforo_general} /><span style={{ fontWeight: 600 }}>{c.nombre}</span></div></td>
                    <td><Badge color={c.semaforo_general}>{c.estado || '-'}</Badge></td>
                    <td style={{ fontSize: 12, maxWidth: 200 }}>{c.riesgo || '-'}</td>
                    <td style={{ fontSize: 12, maxWidth: 250 }}>{c.proximo_hito ? (c.proximo_hito.length > 60 ? c.proximo_hito.substring(0, 60) + '...' : c.proximo_hito) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

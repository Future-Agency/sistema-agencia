'use client'
import { useMemo } from 'react'
import { SemaforoIcon, Badge } from './ui'
import type { Cliente, Owner } from '@/lib/supabase'

type Props = {
  clientes: Cliente[]
  owners: Owner[]
  onSelectCliente: (c: Cliente) => void
  ownerFilter: string
  tipoFilter: string
  estadoFilter: string
}

export default function TableroGeneral({ clientes, owners, onSelectCliente, ownerFilter, tipoFilter, estadoFilter }: Props) {
  const filtered = useMemo(() => {
    return clientes.filter(c => {
      if (ownerFilter && c.owner_id !== ownerFilter) return false
      if (tipoFilter && c.tipo !== tipoFilter) return false
      if (estadoFilter === 'red' && c.semaforo_general !== 'red') return false
      if (estadoFilter === 'yellow' && c.semaforo_general !== 'yellow') return false
      if (estadoFilter === 'green' && c.semaforo_general !== 'green' && c.semaforo_general !== 'blue') return false
      return true
    })
  }, [clientes, ownerFilter, tipoFilter, estadoFilter])

  const counts = useMemo(() => ({
    total: clientes.length,
    green: clientes.filter(c => c.semaforo_general === 'green' || c.semaforo_general === 'blue').length,
    yellow: clientes.filter(c => c.semaforo_general === 'yellow').length,
    red: clientes.filter(c => c.semaforo_general === 'red').length,
  }), [clientes])

  const stats = [
    { label: 'Total Clientes', value: counts.total, color: '#5e72e4', bg: 'rgba(94,114,228,.12)' },
    { label: 'En tiempo', value: counts.green, color: '#00d97e', bg: 'rgba(0,217,126,.12)' },
    { label: 'En riesgo', value: counts.yellow, color: '#f5a623', bg: 'rgba(245,166,35,.12)' },
    { label: 'Críticos', value: counts.red, color: '#f5365c', bg: 'rgba(245,54,92,.12)' },
  ]

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {stats.map(s => (
          <div key={s.label} className="card" style={{ flex: '1 1 200px', minWidth: 180 }}>
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</span>
              </div>
              <div style={{ fontSize: 12, color: '#6a6a80' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>
      {counts.red > 0 && (
        <div className="alert-banner alert-red">
          <i className="fas fa-exclamation-triangle" style={{ color: '#f5365c' }} />
          <span><strong>{counts.red} cliente{counts.red > 1 ? 's' : ''}</strong> en estado crítico</span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {filtered.map(c => {
          const owner = owners.find(o => o.id === c.owner_id)
          const bc = (c.semaforo_general === 'green' || c.semaforo_general === 'blue') ? '#00d97e' : c.semaforo_general === 'yellow' ? '#f5a623' : '#f5365c'
          return (
            <div key={c.id} className="card card-clickable" onClick={() => onSelectCliente(c)} style={{ borderLeft: `3px solid ${bc}` }}>
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{c.nombre}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Badge color={c.tipo === 'CRM' ? 'blue' : 'purple'}>{c.tipo}</Badge>
                      <Badge color={c.is_onboarding ? 'yellow' : 'default'}>{c.is_onboarding ? 'Onboarding' : 'Ongoing'}</Badge>
                    </div>
                  </div>
                  <SemaforoIcon color={c.semaforo_general} size="lg" />
                </div>
                <div className="stat-row"><span className="stat-label">Owner</span><span className="stat-value" style={{ color: owner?.color }}>{owner?.nombre_corto}</span></div>
                <div className="stat-row"><span className="stat-label">Estado</span><span className="stat-value" style={{ fontSize: 12 }}>{c.estado || 'Sin asignar'}</span></div>
                {c.proximo_hito && (
                  <div style={{ marginTop: 8, padding: '8px 10px', background: '#1a1a28', borderRadius: 6, fontSize: 12, color: '#a0a0b8', lineHeight: 1.4 }}>
                    <i className="fas fa-flag" style={{ marginRight: 6, fontSize: 10, color: '#5e72e4' }} />
                    {c.proximo_hito.length > 80 ? c.proximo_hito.substring(0, 80) + '...' : c.proximo_hito}
                  </div>
                )}
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6a6a80' }}>
                  <span>Contacto: {c.ultimo_contacto}</span>
                  <span>Pub: {c.ultima_publicacion}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

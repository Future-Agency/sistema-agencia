'use client'
import { useState, useEffect } from 'react'
import { SemaforoIcon } from './ui'
import type { Cliente, Owner } from '@/lib/supabase'
import { getEstadoStyle } from '@/lib/estados'

type Props = { clientes: Cliente[]; owners: Owner[] }

export default function TVMode({ clientes, owners }: Props) {
  const [time, setTime] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 60000); return () => clearInterval(t) }, [])

  const counts = [
    { l: 'OK', c: clientes.filter(c => c.semaforo_general === 'green' || c.semaforo_general === 'blue').length, cl: '#00d97e' },
    { l: 'Riesgo', c: clientes.filter(c => c.semaforo_general === 'yellow').length, cl: '#f5a623' },
    { l: 'Crítico', c: clientes.filter(c => c.semaforo_general === 'red').length, cl: '#f5365c' },
  ]

  return (
    <div style={{ padding: 20, background: '#0a0a0f', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo-future.jpg" alt="Future" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }} />
          <span style={{ fontSize: 22, fontWeight: 800 }}>Future Agency</span>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {counts.map(s => (
            <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: s.cl }} />
              <span style={{ fontSize: 16, fontWeight: 700 }}>{s.c}</span>
              <span style={{ fontSize: 13, color: '#6a6a80' }}>{s.l}</span>
            </div>
          ))}
          <span style={{ fontSize: 18, fontWeight: 600, color: '#a0a0b8' }}>{time.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
      <div className="tv-grid">
        {clientes.map(c => {
          const bg = (c.semaforo_general === 'green' || c.semaforo_general === 'blue') ? 'rgba(0,217,126,.12)' : c.semaforo_general === 'yellow' ? 'rgba(245,166,35,.12)' : 'rgba(245,54,92,.12)'
          const bc = (c.semaforo_general === 'green' || c.semaforo_general === 'blue') ? '#00d97e' : c.semaforo_general === 'yellow' ? '#f5a623' : '#f5365c'
          return (
            <div key={c.id} className="tv-card" style={{ background: bg, border: `1px solid ${bc}30` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{c.nombre}</span>
                <SemaforoIcon color={c.semaforo_general} size="lg" />
              </div>
              <div style={{ fontSize: 12, color: '#a0a0b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{owners.find(o => o.id === c.owner_id)?.nombre_corto || 'Sin asignar'}</span>
                {c.estado && (() => { const es = getEstadoStyle(c.estado); return <span style={{ padding: '1px 5px', borderRadius: 3, background: es.bg, color: es.color, fontSize: 10, fontWeight: 600 }}>{c.estado}</span> })()}
              </div>
              {c.proximo_hito && <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 4 }}>{c.proximo_hito.length > 60 ? c.proximo_hito.substring(0, 60) + '...' : c.proximo_hito}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

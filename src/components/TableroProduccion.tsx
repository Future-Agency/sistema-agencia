'use client'
import { useMemo } from 'react'
import { SemaforoIcon } from './ui'
import type { Cliente, Owner } from '@/lib/supabase'

type Props = { clientes: Cliente[]; owners: Owner[] }

export default function TableroProduccion({ clientes, owners }: Props) {
  const prod = clientes.filter(c => c.estado && !c.is_onboarding)
  const byFase = useMemo(() => ({
    guiones: prod.filter(c => ['GUIONES','GUIONES/DISEÑO','COPY','copy','Revision Guiones (yo)'].includes(c.estado)),
    grabacion: prod.filter(c => ['PRODUCCIÓN / B-ROLLS','Producción','COPY / GRABACION','Edición / Filmar'].includes(c.estado)),
    edicion: prod.filter(c => ['EDICIÓN','VIDEOS SUBIDOS, FALTAN DISEÑOS'].includes(c.estado)),
    diseno: prod.filter(c => ['DISEÑO','PLACAS TN','PORTADAS'].includes(c.estado)),
    programacion: prod.filter(c => c.estado === 'PROGRAMACION'),
    completo: prod.filter(c => ['Completo','FIN DEL LOOP','ADS Prendidos'].includes(c.estado)),
  }), [prod])

  const columns = [
    { key: 'guiones' as const, label: 'Guiones', icon: 'fa-pen-fancy', color: '#8965e0' },
    { key: 'grabacion' as const, label: 'Grabación', icon: 'fa-video', color: '#5e72e4' },
    { key: 'edicion' as const, label: 'Edición', icon: 'fa-film', color: '#f5a623' },
    { key: 'diseno' as const, label: 'Diseño', icon: 'fa-palette', color: '#f5365c' },
    { key: 'programacion' as const, label: 'Programación', icon: 'fa-calendar', color: '#00d97e' },
    { key: 'completo' as const, label: 'Completo', icon: 'fa-check', color: '#00d97e' },
  ]

  return (
    <div className="fade-in">
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, 1fr)`, gap: 12, overflowX: 'auto' }}>
        {columns.map(col => (
          <div key={col.key}>
            <div style={{ padding: '10px 12px', background: '#12121a', border: '1px solid #2a2a40', borderRadius: '10px 10px 0 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className={`fas ${col.icon}`} style={{ color: col.color, fontSize: 13 }} />
              <span style={{ fontWeight: 600, fontSize: 13 }}>{col.label}</span>
              <span style={{ marginLeft: 'auto', background: '#1a1a28', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{byFase[col.key].length}</span>
            </div>
            <div style={{ background: '#12121a', border: '1px solid #2a2a40', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 8, minHeight: 200 }}>
              {byFase[col.key].map(c => (
                <div key={c.id} style={{ padding: 10, background: '#1a1a28', borderRadius: 8, marginBottom: 6, borderLeft: `3px solid ${c.semaforo_general === 'green' ? '#00d97e' : c.semaforo_general === 'yellow' ? '#f5a623' : '#f5365c'}` }}>
                  <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>{c.nombre}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#6a6a80' }}>{owners.find(o => o.id === c.owner_id)?.nombre_corto}</span>
                    <SemaforoIcon color={c.semaforo_general} />
                  </div>
                </div>
              ))}
              {byFase[col.key].length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#6a6a80', fontSize: 12 }}>Sin items</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

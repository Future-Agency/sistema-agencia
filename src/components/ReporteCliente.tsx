'use client'
import { useState } from 'react'
import type { Cliente } from '@/lib/supabase'

type Props = { clientes: Cliente[] }

export default function ReporteCliente({ clientes }: Props) {
  const [selectedId, setSelectedId] = useState(clientes[0]?.id)
  const cliente = clientes.find(c => c.id === selectedId)
  if (!cliente) return null

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
        <select className="select-custom" value={selectedId} onChange={e => setSelectedId(Number(e.target.value))}>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <button className="btn btn-primary"><i className="fas fa-download" /> Exportar PDF</button>
        <button className="btn btn-green"><i className="fab fa-whatsapp" /> Enviar WhatsApp</button>
      </div>
      <div className="reporte-section">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 60, height: 60, background: 'linear-gradient(135deg, #5e72e4, #8965e0)', borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><span style={{ color: 'white', fontWeight: 800, fontSize: 20 }}>LC</span></div>
          <h1>Reporte Semanal</h1>
          <p style={{ color: '#888' }}>{cliente.nombre} — Semana del 17 al 23 de Marzo 2026</p>
        </div>
        <h2>Resultados de la Semana</h2>
        <div className="reporte-metric"><span>Publicaciones realizadas</span><span>4 posts</span></div>
        <div className="reporte-metric"><span>Alcance total</span><span>12.450 cuentas</span></div>
        <div className="reporte-metric"><span>Interacciones</span><span>847</span></div>
        <div className="reporte-metric"><span>Nuevos seguidores</span><span>+126</span></div>
        {cliente.tipo === 'CRM' && <div className="reporte-metric"><span>Leads generados</span><span>23</span></div>}
        {cliente.tipo === 'Tienda Online' && <div className="reporte-metric"><span>Visitas a tienda</span><span>342</span></div>}
        <h2>Próximos Pasos</h2>
        <p>{cliente.proximo_hito || 'Continuar con el plan de contenido semanal.'}</p>
        <h2>Próximo Entregable</h2>
        <div className="reporte-metric"><span>Fecha estimada</span><span>28 de Marzo 2026</span></div>
        <div className="reporte-metric"><span>Contenido</span><span>5 videos + 3 diseños</span></div>
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '2px solid #eee', textAlign: 'center', fontSize: 12, color: '#aaa' }}>Lean Consult — Reporte generado automáticamente</div>
      </div>
    </div>
  )
}

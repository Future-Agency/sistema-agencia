'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { cicloMesLabel } from '@/lib/cycles'

type Reporte = {
  cicloMes: string
  stats: {
    clientesActivos: number; clientesConPiezas: number; clientesCompletados: number
    porcentajeCompletado: number
    totalPiezas: number; piezasTerminadas: number; porcentajePiezas: number
    notasPorTipo: Record<string, number>
    notasPorArea: Record<string, number>
    deudasCount: number; deudasNeto: number
    recursosCargados: number
  }
  notas: { id: number; area: string; tipo: string; texto: string; autor: string | null; created_at: string }[]
  deudas: any[]
  fechas: any[]
  analisis: { resumen: string; fortalezas: string[]; debilidades: string[]; recomendaciones: string[]; generadoPor: 'claude' | 'local' }
  generadoEn: string
}

export default function ReportePage() {
  const params = useParams<{ ciclo: string }>()
  const ciclo = decodeURIComponent(params.ciclo as string)
  const [data, setData] = useState<Reporte | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/reporte-cierre', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ agenciaId: 'future', cicloMes: ciclo }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json() as Reporte
        setData(json)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [ciclo])

  if (loading) return <div style={pageStyle}><p>Generando reporte…</p></div>
  if (error) return <div style={pageStyle}><p style={{ color: '#f5365c' }}>Error: {error}</p></div>
  if (!data) return null

  return (
    <div style={pageStyle}>
      {/* Print button (hidden when printing) */}
      <div className="no-print" style={{
        position: 'sticky' as const, top: 0, zIndex: 10,
        background: '#fff', borderBottom: '1px solid #e5e5e5',
        padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <strong style={{ fontSize: 14, color: '#1a1a28' }}>📊 Reporte de Cierre</strong>
          <span style={{ marginLeft: 12, fontSize: 12, color: '#6a6a80', textTransform: 'capitalize' as const }}>
            {cicloMesLabel(data.cicloMes)}
          </span>
          <span style={{ marginLeft: 12, fontSize: 11, color: '#a0a0b8' }}>
            Generado por {data.analisis.generadoPor === 'claude' ? '🤖 Claude' : '📊 estadísticas locales'}
          </span>
        </div>
        <button onClick={() => window.print()} style={{
          padding: '8px 16px', background: '#5e72e4', color: '#fff',
          border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>🖨 Exportar PDF / Imprimir</button>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
        {/* Header */}
        <header style={{ marginBottom: 28, paddingBottom: 16, borderBottom: '2px solid #1a1a28' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6a6a80', textTransform: 'uppercase' as const, letterSpacing: 1 }}>
            Future Agency · Reporte de cierre de ciclo
          </div>
          <h1 style={{ fontSize: 28, margin: '6px 0 4px', color: '#1a1a28', textTransform: 'capitalize' as const }}>
            {cicloMesLabel(data.cicloMes)}
          </h1>
          <div style={{ fontSize: 12, color: '#6a6a80' }}>
            Generado el {new Date(data.generadoEn).toLocaleString('es-AR')}
          </div>
        </header>

        {/* Resumen ejecutivo */}
        <section style={section}>
          <h2 style={h2}>📋 Resumen ejecutivo</h2>
          <p style={{ fontSize: 14, color: '#1a1a28', lineHeight: 1.6, margin: 0 }}>{data.analisis.resumen}</p>
        </section>

        {/* Stats grid */}
        <section style={section}>
          <h2 style={h2}>📊 Métricas del ciclo</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <Metric label="Clientes activos" value={String(data.stats.clientesActivos)} color="#5e72e4" />
            <Metric label="Completaron" value={`${data.stats.clientesCompletados}/${data.stats.clientesConPiezas}`} sub={`${data.stats.porcentajeCompletado}%`} color="#00d97e" />
            <Metric label="Piezas terminadas" value={`${data.stats.piezasTerminadas}/${data.stats.totalPiezas}`} sub={`${data.stats.porcentajePiezas}%`} color="#a78bfa" />
            <Metric label="Deuda neta" value={String(data.stats.deudasNeto)} sub={`${data.stats.deudasCount} mov.`} color={data.stats.deudasNeto > 0 ? '#f5365c' : '#00d97e'} />
          </div>
          {/* Progress bar */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10, color: '#6a6a80', marginBottom: 4 }}>Avance global del ciclo</div>
            <div style={{ height: 10, background: '#e5e5e5', borderRadius: 5, overflow: 'hidden' as const }}>
              <div style={{
                width: `${data.stats.porcentajePiezas}%`, height: '100%',
                background: data.stats.porcentajePiezas === 100 ? '#00d97e' : 'linear-gradient(90deg, #5e72e4, #00d97e)',
              }} />
            </div>
          </div>
        </section>

        {/* Análisis */}
        <section style={section}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <h3 style={h3}>✅ Fortalezas</h3>
              <ul style={ul}>{data.analisis.fortalezas.map((f, i) => <li key={i} style={li}>{f}</li>)}</ul>
            </div>
            <div>
              <h3 style={h3}>⚠️ A mejorar</h3>
              <ul style={ul}>{data.analisis.debilidades.map((d, i) => <li key={i} style={li}>{d}</li>)}</ul>
            </div>
          </div>
        </section>

        <section style={section}>
          <h3 style={h3}>💡 Recomendaciones</h3>
          <ul style={ul}>{data.analisis.recomendaciones.map((r, i) => <li key={i} style={li}>{r}</li>)}</ul>
        </section>

        {/* Notas por tipo */}
        {Object.values(data.stats.notasPorTipo).some(v => v > 0) && (
          <section style={section}>
            <h3 style={h3}>📒 Notas registradas ({data.notas.length})</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
              {Object.entries(data.stats.notasPorTipo).map(([tipo, n]) => (
                <div key={tipo} style={{ background: '#f5f5fa', padding: '8px', borderRadius: 4, textAlign: 'center' as const }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a28' }}>{n}</div>
                  <div style={{ fontSize: 10, color: '#6a6a80', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{tipo}</div>
                </div>
              ))}
            </div>
            {data.notas.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                {data.notas.slice(0, 30).map(n => (
                  <div key={n.id} style={{ padding: '8px 10px', background: '#f9f9fc', borderRadius: 4, fontSize: 12, borderLeft: `3px solid ${tipoColor(n.tipo)}` }}>
                    <div style={{ fontSize: 9, color: '#6a6a80', textTransform: 'uppercase' as const, marginBottom: 2 }}>
                      [{n.area}] {n.tipo} · {n.autor ?? 'Anónimo'}
                    </div>
                    <div style={{ color: '#1a1a28' }}>{n.texto}</div>
                  </div>
                ))}
                {data.notas.length > 30 && <div style={{ fontSize: 11, color: '#6a6a80', textAlign: 'center' as const }}>+ {data.notas.length - 30} notas más</div>}
              </div>
            )}
          </section>
        )}

        {/* Deudas */}
        {data.deudas.length > 0 && (
          <section style={section}>
            <h3 style={h3}>📒 Deudas del ciclo ({data.deudas.length})</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f5f5fa', textAlign: 'left' as const }}>
                  <th style={th}>Cant.</th><th style={th}>Cliente</th><th style={th}>Motivo</th><th style={th}>Estado</th><th style={th}>Origen</th>
                </tr>
              </thead>
              <tbody>
                {data.deudas.map((d: any) => (
                  <tr key={d.id} style={{ borderTop: '1px solid #e5e5e5' }}>
                    <td style={{ ...td, color: d.cantidad > 0 ? '#f5365c' : '#00d97e', fontWeight: 700 }}>{d.cantidad > 0 ? '+' : ''}{d.cantidad}</td>
                    <td style={td}>#{d.cliente_id}</td>
                    <td style={td}>{d.motivo ?? '—'}</td>
                    <td style={{ ...td, textTransform: 'uppercase' as const }}>{d.estado}</td>
                    <td style={td}>{d.origen === 'auto_subida' ? 'Auto' : 'Manual'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <footer style={{ marginTop: 28, paddingTop: 16, borderTop: '1px solid #e5e5e5', fontSize: 10, color: '#a0a0b8', textAlign: 'center' as const }}>
          Future Agency — Sistema de Gestión · Reporte generado automáticamente
        </footer>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          @page { margin: 12mm; }
        }
      `}</style>
    </div>
  )
}

function tipoColor(t: string) {
  return t === 'falla' ? '#f5365c' : t === 'correccion' ? '#f5a623' : t === 'mejora' ? '#00d97e' : '#5e72e4'
}

function Metric({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ padding: '10px', borderRadius: 6, background: '#f9f9fc', borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 9, color: '#6a6a80', textTransform: 'uppercase' as const, letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

const pageStyle: React.CSSProperties = { minHeight: '100vh', background: '#fff', color: '#1a1a28', fontFamily: 'system-ui, -apple-system, sans-serif' }
const section: React.CSSProperties = { marginBottom: 24 }
const h2: React.CSSProperties = { fontSize: 16, margin: '0 0 12px', color: '#1a1a28', borderBottom: '1px solid #e5e5e5', paddingBottom: 6 }
const h3: React.CSSProperties = { fontSize: 14, margin: '0 0 10px', color: '#1a1a28' }
const ul: React.CSSProperties = { margin: 0, paddingLeft: 18 }
const li: React.CSSProperties = { fontSize: 13, color: '#1a1a28', marginBottom: 6, lineHeight: 1.5 }
const th: React.CSSProperties = { padding: '6px 8px', fontSize: 10, color: '#6a6a80', textTransform: 'uppercase' as const, letterSpacing: 0.4, fontWeight: 700 }
const td: React.CSSProperties = { padding: '8px', color: '#1a1a28' }

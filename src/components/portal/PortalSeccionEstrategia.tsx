'use client'
import type { ClientePortalConfig, Cliente } from '@/lib/supabase'

type Props = { config: ClientePortalConfig | null; cliente: Cliente; colorPrimario: string }

export default function PortalSeccionEstrategia({ config, cliente, colorPrimario }: Props) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 0, marginBottom: 4 }}>Estrategia</h2>
      <p style={{ fontSize: 13, color: '#a0a0b8', marginTop: 0, marginBottom: 24 }}>El plan que vamos a ejecutar para alcanzar tus objetivos</p>

      {config?.estrategia ? (
        <div style={{
          padding: 24,
          background: '#14142a',
          border: `1px solid ${colorPrimario}30`,
          borderRadius: 14,
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, color: colorPrimario, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 }}>
            <i className="fas fa-chess" style={{ marginRight: 6 }} /> Plan estrategico
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{config.estrategia}</div>
        </div>
      ) : (
        <div style={{ padding: 32, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 12, textAlign: 'center', color: '#6a6a80' }}>
          <i className="fas fa-chess" style={{ fontSize: 36, marginBottom: 12, color: '#3a3a55' }} />
          <div>La estrategia se va a publicar pronto</div>
        </div>
      )}

      {cliente.objetivo && (
        <div style={{ padding: 18, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#6a6a80', textTransform: 'uppercase', marginBottom: 6 }}>Objetivo principal</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{cliente.objetivo}</div>
        </div>
      )}

      {cliente.proximo_hito && (
        <div style={{ padding: 18, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: '#6a6a80', textTransform: 'uppercase', marginBottom: 6 }}>Proximo hito</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{cliente.proximo_hito}</div>
        </div>
      )}
    </div>
  )
}

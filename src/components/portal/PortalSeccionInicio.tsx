'use client'
import type { Cliente, Owner, ClientePortalConfig, AdAccount } from '@/lib/supabase'

type Props = {
  cliente: Cliente
  owner: Owner | null
  config: ClientePortalConfig | null
  aprobacionesPendientes: number
  totalObjetivosLogrados: number
  adAccounts: AdAccount[]
  colorPrimario: string
}

const SEMAFORO_LABEL: Record<string, { label: string; color: string }> = {
  green: { label: 'En tiempo', color: '#00d97e' },
  yellow: { label: 'En riesgo', color: '#f5a623' },
  red: { label: 'Critico', color: '#f5365c' },
  blue: { label: 'Onboarding', color: '#5e72e4' },
}

export default function PortalSeccionInicio({ cliente, owner, config, aprobacionesPendientes, totalObjetivosLogrados, adAccounts, colorPrimario }: Props) {
  const semaforo = SEMAFORO_LABEL[cliente.semaforo_general] || SEMAFORO_LABEL.green
  const totalSpend30d = adAccounts.reduce((sum, a) => sum + (a.metrics_30d?.spend || 0), 0)
  const totalCompras30d = adAccounts.reduce((sum, a) => sum + (a.metrics_30d?.purchases || 0), 0)
  const totalLeads30d = adAccounts.reduce((sum, a) => sum + (a.metrics_30d?.leads || 0), 0)
  const totalMessages30d = adAccounts.reduce((sum, a) => sum + (a.metrics_30d?.messages || 0), 0)

  return (
    <div>
      {config?.bienvenida && (
        <div style={{
          padding: '20px 24px',
          background: `linear-gradient(135deg, ${colorPrimario}15, ${colorPrimario}05)`,
          border: `1px solid ${colorPrimario}30`,
          borderRadius: 14,
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 13, color: colorPrimario, fontWeight: 600, marginBottom: 6 }}>
            <i className="fas fa-hand-wave" style={{ marginRight: 6 }} /> Bienvenido
          </div>
          <div style={{ fontSize: 14, color: '#e8e8f0', lineHeight: 1.6 }}>{config.bienvenida}</div>
        </div>
      )}

      {/* Estado del servicio */}
      <div style={{
        padding: 24,
        background: '#14142a',
        border: '1px solid #1a1a2e',
        borderRadius: 14,
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: '#6a6a80', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Estado del Servicio</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{cliente.estado || 'Activo'}</h2>
          </div>
          <div style={{
            padding: '6px 14px',
            background: `${semaforo.color}22`,
            border: `1px solid ${semaforo.color}55`,
            borderRadius: 20,
            color: semaforo.color,
            fontSize: 12,
            fontWeight: 600,
          }}>
            <i className="fas fa-circle" style={{ fontSize: 8, marginRight: 6 }} />
            {semaforo.label}
          </div>
        </div>

        {cliente.objetivo && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#6a6a80', marginBottom: 6 }}>Objetivo principal</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{cliente.objetivo}</div>
            <div style={{ height: 8, background: '#0a0a14', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${cliente.progreso}%`, background: `linear-gradient(90deg, ${colorPrimario}, ${colorPrimario}aa)`, transition: 'width 0.5s' }} />
            </div>
            <div style={{ fontSize: 11, color: '#a0a0b8', marginTop: 4 }}>{cliente.progreso}% completado</div>
          </div>
        )}

        {cliente.proximo_hito && (
          <div style={{ padding: 14, background: '#0a0a14', borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: '#6a6a80', marginBottom: 4 }}>
              <i className="fas fa-flag" style={{ marginRight: 6, color: colorPrimario }} /> Proximo Hito
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{cliente.proximo_hito}</div>
          </div>
        )}
      </div>

      {/* Resumen rapido */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <Card icon="fa-clipboard-check" label="Aprobaciones pendientes" value={aprobacionesPendientes} color={aprobacionesPendientes > 0 ? '#f5a623' : '#00d97e'} />
        <Card icon="fa-trophy" label="Objetivos logrados" value={totalObjetivosLogrados} color="#00d97e" />
        <Card icon="fa-rectangle-ad" label="Cuentas activas" value={adAccounts.length} color={colorPrimario} />
        {totalSpend30d > 0 && <Card icon="fa-dollar-sign" label="Inversion 30d" value={`$${formatNum(totalSpend30d)}`} color={colorPrimario} />}
        {totalCompras30d > 0 && <Card icon="fa-shopping-cart" label="Compras 30d" value={totalCompras30d} color="#00d97e" />}
        {totalLeads30d > 0 && <Card icon="fa-user-plus" label="Leads 30d" value={totalLeads30d} color={colorPrimario} />}
        {totalMessages30d > 0 && <Card icon="fa-comment" label="Mensajes 30d" value={totalMessages30d} color="#8965e0" />}
      </div>

      {/* Account manager */}
      {owner && (
        <div style={{
          padding: 18,
          background: '#14142a',
          border: '1px solid #1a1a2e',
          borderRadius: 12,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 24,
            background: `linear-gradient(135deg, ${owner.color}, ${owner.color}aa)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 18, fontWeight: 700,
          }}>
            {owner.nombre.charAt(0)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#6a6a80' }}>Tu Account Manager</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{owner.nombre}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ icon, label, value, color }: { icon: string; label: string; value: any; color: string }) {
  return (
    <div style={{ padding: 16, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 11, color: '#6a6a80' }}>
        <i className={`fas ${icon}`} style={{ color }} />
        <span style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f0' }}>{value}</div>
    </div>
  )
}

function formatNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K'
  return n.toFixed(0)
}

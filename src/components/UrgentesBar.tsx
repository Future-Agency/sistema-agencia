'use client'
import { useMemo } from 'react'
import type { Cliente, Owner } from '@/lib/supabase'

type Props = {
  clientes: Cliente[]
  owners: Owner[]
  onSelectCliente: (c: Cliente) => void
}

function diffDays(target: Date, ref: Date = new Date()): number {
  return Math.floor((target.getTime() - ref.getTime()) / 86400000)
}

export default function UrgentesBar({ clientes, owners, onSelectCliente }: Props) {
  const today = useMemo(() => new Date(), [])

  const urgentes = useMemo(() => {
    return clientes
      .map(c => {
        if (!c.proximo_hito) return null
        const t = new Date(c.proximo_hito)
        if (isNaN(t.getTime())) return null
        const days = diffDays(t, today)
        if (days > 3) return null
        return { cliente: c, days }
      })
      .filter((x): x is { cliente: Cliente; days: number } => x !== null)
      .sort((a, b) => a.days - b.days)
  }, [clientes, today])

  if (urgentes.length === 0) return null

  const ownerById = new Map<string, Owner>()
  owners.forEach(o => ownerById.set(o.id, o))

  return (
    <div style={{
      marginBottom: 16,
      padding: '12px 16px',
      background: 'linear-gradient(90deg, rgba(245,54,92,.08) 0%, rgba(245,54,92,.02) 100%)',
      border: '1px solid rgba(245,54,92,.20)',
      borderRadius: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>🚨</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#f5365c', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Urgente · {urgentes.length} cliente{urgentes.length !== 1 ? 's' : ''} con deadline ≤ 3 días
        </span>
      </div>
      <div style={{
        display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4,
        scrollbarWidth: 'thin' as const,
      }}>
        {urgentes.map(({ cliente, days }) => {
          const owner = cliente.owner_id ? ownerById.get(cliente.owner_id) : null
          const isVencido = days < 0
          const isHoy = days === 0
          return (
            <button
              key={cliente.id}
              onClick={() => onSelectCliente(cliente)}
              title={cliente.proximo_hito ? `Hito: ${new Date(cliente.proximo_hito).toLocaleDateString('es-AR')}` : ''}
              style={{
                flex: '0 0 auto',
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 12px',
                background: isVencido ? 'rgba(245,54,92,.18)' : isHoy ? 'rgba(245,166,35,.15)' : '#1a1a28',
                border: `1px solid ${isVencido ? '#f5365c' : isHoy ? '#f5a623' : '#2a2a40'}`,
                borderRadius: 20,
                cursor: 'pointer',
                color: '#e8e8f0',
                fontSize: 12, fontWeight: 600,
                whiteSpace: 'nowrap' as const,
                transition: 'all .15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = isVencido ? 'rgba(245,54,92,.28)' : isHoy ? 'rgba(245,166,35,.25)' : '#22223a')}
              onMouseLeave={e => (e.currentTarget.style.background = isVencido ? 'rgba(245,54,92,.18)' : isHoy ? 'rgba(245,166,35,.15)' : '#1a1a28')}
            >
              {owner && (
                <span style={{
                  width: 18, height: 18, borderRadius: 5,
                  background: owner.color + '33', color: owner.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 9,
                  flexShrink: 0,
                }}>
                  {owner.nombre_corto[0]}
                </span>
              )}
              <span>{cliente.nombre}</span>
              <span style={{
                fontSize: 10, fontWeight: 700,
                padding: '2px 6px', borderRadius: 3,
                background: isVencido ? '#f5365c' : isHoy ? '#f5a623' : '#5e72e4',
                color: '#fff',
              }}>
                {isVencido ? `${Math.abs(days)}d vencido` : isHoy ? 'HOY' : `${days}d`}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

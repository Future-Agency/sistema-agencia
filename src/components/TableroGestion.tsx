'use client'
import { useMemo, useState } from 'react'
import { SemaforoIcon } from './ui'
import type { Cliente, Owner, Equipo } from '@/lib/supabase'
import type { CurrentUser } from '@/lib/users'
import { rankClientesByPriority, bucketByTier, type ClientPriority } from '@/lib/clientPriority'
import { TIER_COLORS, type QuilomboBreakdown } from '@/lib/quilomboScore'
import { getEstadoStyle } from '@/lib/estados'
import LoopsPanel from './LoopsPanel'

type Props = {
  clientes: Cliente[]
  owners: Owner[]
  onSelectCliente: (c: Cliente) => void
  ownerFilter?: string
  // Phase 2 props (loops)
  agenciaId?: string
  currentUser?: CurrentUser
  equipo?: Equipo[]
  // Phase 4 — ciclo activo (null/undefined = current calendar)
  cicloMes?: string
}

const BREAKDOWN_LABELS: Record<keyof QuilomboBreakdown, { label: string; icon: string }> = {
  riesgo:     { label: 'Riesgo',     icon: 'fa-triangle-exclamation' },
  semaforo:   { label: 'Semáforo',   icon: 'fa-traffic-light' },
  deadline:   { label: 'Deadline',   icon: 'fa-clock' },
  estancado:  { label: 'Estancado',  icon: 'fa-hourglass-half' },
  correccion: { label: 'Loop',       icon: 'fa-rotate' },
  onboarding: { label: 'Onboarding', icon: 'fa-rocket' },
}

export default function TableroGestion({ clientes, owners, onSelectCliente, ownerFilter, agenciaId, currentUser, equipo, cicloMes }: Props) {
  const [tierFilter, setTierFilter] = useState<'all' | 'critico' | 'alto' | 'medio'>('all')
  const [expanded, setExpanded] = useState<number | null>(null)

  const visibles = useMemo(() => {
    if (!ownerFilter) return clientes
    if (ownerFilter === '__none__') return clientes.filter(c => !c.owner_id)
    return clientes.filter(c => c.owner_id === ownerFilter)
  }, [clientes, ownerFilter])

  const ranked = useMemo(() => rankClientesByPriority(visibles), [visibles])
  const buckets = useMemo(() => bucketByTier(ranked), [ranked])

  const filtered = useMemo(() => {
    if (tierFilter === 'all') return ranked
    return ranked.filter(r => r.quilombo.tier === tierFilter)
  }, [ranked, tierFilter])

  const avgScore = ranked.length > 0
    ? Math.round(ranked.reduce((s, r) => s + r.score, 0) / ranked.length)
    : 0

  const ownerById = useMemo(() => {
    const m = new Map<string, Owner>()
    owners.forEach(o => m.set(o.id, o))
    return m
  }, [owners])

  return (
    <div className="fade-in">
      {/* Loops del ciclo (Phase 2) — solo si tenemos contexto de agency + user */}
      {agenciaId && currentUser && equipo && (
        <LoopsPanel
          agenciaId={agenciaId}
          currentUser={currentUser}
          clientes={clientes}
          equipo={equipo}
          cicloMes={cicloMes}
        />
      )}

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <KpiCard
          label="Total clientes"
          value={ranked.length}
          icon="fa-users"
          tone="default"
        />
        <KpiCard
          label="Score promedio"
          value={avgScore}
          icon="fa-gauge-high"
          tone={avgScore >= 50 ? 'red' : avgScore >= 30 ? 'yellow' : 'green'}
          suffix="/100"
        />
        <KpiCard
          label="Críticos"
          value={buckets.critico.length}
          icon="fa-fire"
          tone="red"
          onClick={() => setTierFilter(tierFilter === 'critico' ? 'all' : 'critico')}
          active={tierFilter === 'critico'}
        />
        <KpiCard
          label="Alto"
          value={buckets.alto.length}
          icon="fa-triangle-exclamation"
          tone="yellow"
          onClick={() => setTierFilter(tierFilter === 'alto' ? 'all' : 'alto')}
          active={tierFilter === 'alto'}
        />
        <KpiCard
          label="Medio"
          value={buckets.medio.length}
          icon="fa-circle-half-stroke"
          tone="blue"
          onClick={() => setTierFilter(tierFilter === 'medio' ? 'all' : 'medio')}
          active={tierFilter === 'medio'}
        />
        <KpiCard
          label="OK / bajo"
          value={buckets.ok.length + buckets.bajo.length}
          icon="fa-check"
          tone="green"
        />
      </div>

      {/* Filtro activo indicador */}
      {tierFilter !== 'all' && (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#6a6a80' }}>Filtrando por:</span>
          <span style={{ ...badgeStyleFor(tierFilter) }}>{TIER_COLORS[tierFilter].label}</span>
          <button onClick={() => setTierFilter('all')}
            style={{ background: 'transparent', border: '1px solid #2a2a40', borderRadius: 6, padding: '4px 10px', color: '#a0a0b8', fontSize: 11, cursor: 'pointer' }}>
            <i className="fas fa-xmark" style={{ marginRight: 4 }} />Quitar
          </button>
        </div>
      )}

      {/* Ranking */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              <i className="fas fa-fire" style={{ marginRight: 8, color: '#f5365c' }} />
              Ranking de quilombo
            </div>
            <span style={{ fontSize: 11, color: '#6a6a80' }}>{filtered.length} clientes</span>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#6a6a80', fontSize: 13 }}>
              <i className="fas fa-circle-check" style={{ fontSize: 24, marginBottom: 8, color: '#00d97e' }} /><br />
              Sin clientes en este tier.
            </div>
          ) : (
            <div>
              {filtered.map((r, idx) => (
                <ClienteRow
                  key={r.cliente.id}
                  rank={idx + 1}
                  priority={r}
                  owner={r.cliente.owner_id ? ownerById.get(r.cliente.owner_id) ?? null : null}
                  expanded={expanded === r.cliente.id}
                  onToggle={() => setExpanded(expanded === r.cliente.id ? null : r.cliente.id)}
                  onSelect={() => onSelectCliente(r.cliente)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============== Subcomponentes ==============

function KpiCard({
  label, value, icon, tone, suffix, onClick, active,
}: {
  label: string; value: number; icon: string; tone: 'red' | 'yellow' | 'green' | 'blue' | 'default'
  suffix?: string; onClick?: () => void; active?: boolean
}) {
  const colors: Record<string, string> = {
    red: '#f5365c', yellow: '#f5a623', green: '#00d97e', blue: '#5e72e4', default: '#a0a0b8',
  }
  const bgs: Record<string, string> = {
    red: 'rgba(245,54,92,.10)', yellow: 'rgba(245,166,35,.10)',
    green: 'rgba(0,217,126,.10)', blue: 'rgba(94,114,228,.10)', default: '#1a1a28',
  }
  const c = colors[tone]
  const bg = bgs[tone]
  return (
    <div
      onClick={onClick}
      style={{
        background: bg,
        border: `1px solid ${active ? c : c + '33'}`,
        borderRadius: 10,
        padding: '14px 16px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all .2s',
        outline: active ? `2px solid ${c}77` : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: '#6a6a80', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
        <i className={`fas ${icon}`} style={{ color: c, fontSize: 13 }} />
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: c }}>
        {value}{suffix && <span style={{ fontSize: 13, color: '#6a6a80', marginLeft: 2 }}>{suffix}</span>}
      </div>
    </div>
  )
}

function ClienteRow({
  rank, priority, owner, expanded, onToggle, onSelect,
}: {
  rank: number
  priority: ClientPriority
  owner: Owner | null
  expanded: boolean
  onToggle: () => void
  onSelect: () => void
}) {
  const { cliente, score, quilombo } = priority
  const tierColor = TIER_COLORS[quilombo.tier]
  const estadoStyle = getEstadoStyle(cliente.estado)

  return (
    <div style={{ borderBottom: '1px solid #2a2a40' }}>
      <div
        onClick={onToggle}
        style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr auto auto auto',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          cursor: 'pointer',
          transition: 'background .15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#1a1a28')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        {/* Rank */}
        <div style={{ fontWeight: 700, fontSize: 14, color: rank <= 3 ? tierColor.color : '#6a6a80' }}>
          {rank <= 3 ? <i className="fas fa-fire" style={{ marginRight: 4 }} /> : null}#{rank}
        </div>

        {/* Cliente + estado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <SemaforoIcon color={cliente.semaforo_general} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cliente.nombre}
              {cliente.is_onboarding && (
                <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,166,35,.15)', color: '#f5a623', fontWeight: 600 }}>
                  ONBOARDING
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ padding: '1px 6px', borderRadius: 4, background: estadoStyle.bg, color: estadoStyle.color, fontSize: 10, fontWeight: 600 }}>
                {cliente.estado || '—'}
              </span>
              {quilombo.daysToHito != null && (
                <span style={{ color: quilombo.daysToHito < 0 ? '#f5365c' : quilombo.daysToHito <= 3 ? '#f5a623' : '#6a6a80' }}>
                  <i className="fas fa-clock" style={{ marginRight: 3 }} />
                  {quilombo.daysToHito < 0 ? `vencido ${Math.abs(quilombo.daysToHito)}d` : `${quilombo.daysToHito}d al hito`}
                </span>
              )}
              {quilombo.daysSinceChange != null && quilombo.daysSinceChange > 7 && (
                <span style={{ color: '#f5a623' }}>
                  <i className="fas fa-hourglass-half" style={{ marginRight: 3 }} />
                  {quilombo.daysSinceChange}d sin cambios
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Owner */}
        {owner ? (
          <div title={owner.nombre} style={{
            width: 28, height: 28, borderRadius: 8, background: owner.color + '22',
            color: owner.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 11,
          }}>
            {owner.nombre_corto[0]}
          </div>
        ) : (
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#2a2a40', color: '#6a6a80', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11 }}>?</div>
        )}

        {/* Score con barra */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 80, height: 6, borderRadius: 3, background: '#2a2a40', overflow: 'hidden' }}>
            <div style={{ width: `${score}%`, height: '100%', background: tierColor.color, transition: 'width .3s' }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: tierColor.color, minWidth: 32, textAlign: 'right' }}>{score}</span>
        </div>

        {/* Tier badge */}
        <span style={badgeStyleFor(quilombo.tier)}>
          {tierColor.label}
        </span>
      </div>

      {/* Expanded breakdown */}
      {expanded && (
        <div style={{ padding: '0 16px 14px 56px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
          {(Object.keys(quilombo.breakdown) as Array<keyof QuilomboBreakdown>).map(key => {
            const v = quilombo.breakdown[key]
            const meta = BREAKDOWN_LABELS[key]
            return (
              <div key={key} style={{
                padding: '8px 10px', borderRadius: 6,
                background: v > 0 ? 'rgba(245,54,92,.08)' : '#1a1a28',
                border: `1px solid ${v > 0 ? 'rgba(245,54,92,.20)' : '#2a2a40'}`,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <i className={`fas ${meta.icon}`} style={{ color: v > 0 ? '#f5365c' : '#6a6a80', fontSize: 12 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: '#6a6a80', textTransform: 'uppercase', letterSpacing: 0.3 }}>{meta.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: v > 0 ? '#f5365c' : '#a0a0b8' }}>+{v}</div>
                </div>
              </div>
            )
          })}
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onSelect() }}
              className="btn"
              style={{
                background: '#5e72e4', border: 'none', borderRadius: 6,
                padding: '6px 14px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <i className="fas fa-arrow-right" style={{ marginRight: 6 }} />Abrir cliente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function badgeStyleFor(tier: keyof typeof TIER_COLORS): React.CSSProperties {
  const c = TIER_COLORS[tier]
  return {
    fontSize: 10,
    fontWeight: 700,
    padding: '4px 8px',
    borderRadius: 4,
    background: c.bg,
    color: c.color,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  }
}

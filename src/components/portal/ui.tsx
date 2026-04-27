'use client'
import type { FunnelStage } from '@/lib/supabase'

export const FUNNEL_INFO: Record<FunnelStage, { label: string; short: string; color: string; icon: string; desc: string }> = {
  tofu: { label: 'TOFU · Awareness', short: 'TOFU', color: 'var(--tofu)', icon: 'fa-bullhorn', desc: 'Atrae gente nueva' },
  mofu: { label: 'MOFU · Consideración', short: 'MOFU', color: 'var(--mofu)', icon: 'fa-magnifying-glass-chart', desc: 'Educa y enamora' },
  bofu: { label: 'BOFU · Conversión', short: 'BOFU', color: 'var(--bofu)', icon: 'fa-bullseye', desc: 'Cierra la venta' },
}

export function FunnelPill({ stage, full = false }: { stage: FunnelStage | null | undefined; full?: boolean }) {
  if (!stage) return null
  const i = FUNNEL_INFO[stage]
  if (!i) return null
  return (
    <span className={`fa-funnel-pill fa-funnel-${stage}`} title={i.desc}>
      <span className="dot" />
      {full ? i.label : i.short}
    </span>
  )
}

const TIPO_INFO: Record<string, { icon: string; color: string }> = {
  reel: { icon: 'fa-film', color: 'var(--brand-blue)' },
  historia: { icon: 'fa-book-open', color: 'var(--warn)' },
  carrousel: { icon: 'fa-layer-group', color: 'var(--brand-violet)' },
  anuncio: { icon: 'fa-bullhorn', color: 'var(--bad)' },
  guion: { icon: 'fa-scroll', color: 'var(--brand-cyan)' },
  post: { icon: 'fa-image', color: 'var(--ok)' },
}

export function TipoIcon({ tipo }: { tipo: string }) {
  const t = TIPO_INFO[tipo] || { icon: 'fa-file', color: 'var(--text-muted)' }
  return <i className={`fas ${t.icon}`} style={{ color: t.color }} />
}

export function TipoBadge({ tipo }: { tipo: string }) {
  const t = TIPO_INFO[tipo] || { icon: 'fa-file', color: 'var(--text-muted)' }
  return (
    <span style={{
      padding: '3px 9px',
      background: `color-mix(in srgb, ${t.color} 15%, transparent)`,
      color: t.color,
      borderRadius: 12,
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.05,
      display: 'inline-flex',
      gap: 5,
      alignItems: 'center',
    }}>
      <i className={`fas ${t.icon}`} />{tipo}
    </span>
  )
}

export function Delta({ value, invert = false }: { value: number | undefined | null; invert?: boolean }) {
  if (value === undefined || value === null) return null
  const pos = invert ? value < 0 : value > 0
  const color = pos ? 'var(--ok)' : 'var(--bad)'
  const arrow = value > 0 ? '↑' : value < 0 ? '↓' : '→'
  const pct = Math.abs(value * 100).toFixed(0)
  return (
    <span style={{ color, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {arrow} {pct}%
    </span>
  )
}

export function StatusDot({ kind }: { kind: 'ok' | 'warn' | 'bad' | string }) {
  const c = kind === 'ok' ? 'var(--ok)' : kind === 'warn' ? 'var(--warn)' : kind === 'bad' ? 'var(--bad)' : 'var(--brand-blue)'
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 50, background: c, boxShadow: `0 0 10px ${c}` }} />
}

export function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K'
  return Math.round(n).toString()
}

export function fmtMoney(n: number, cur: string = 'ARS') {
  const sign = cur === 'USD' ? 'US$' : '$'
  return sign + n.toLocaleString('es-AR')
}

export function fmtMoneyShort(n: number, cur: string = 'ARS') {
  const sign = cur === 'USD' ? 'US$' : '$'
  return sign + fmtNum(n)
}

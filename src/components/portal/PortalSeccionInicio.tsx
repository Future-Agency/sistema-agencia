'use client'
import type { Cliente, Owner, ClientePortalConfig, ClienteAlerta, AdAccount } from '@/lib/supabase'
import { Delta, fmtMoneyShort } from './ui'

type Props = {
  cliente: Cliente
  owner: Owner | null
  config: ClientePortalConfig | null
  alertas: ClienteAlerta[]
  adAccounts: AdAccount[]
  diasConFuture: number
}

export default function PortalSeccionInicio({ cliente, config, alertas, diasConFuture }: Props) {
  const r = config?.roas_30d
  const salud = config?.salud || []
  const semana = config?.semana_items || []
  const recursos = config?.recursos
  const kpis = config?.kpis_30d || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* ===== HERO ROAS NARRATIVO ===== */}
      {r && (
        <div className="fa-hero-shine fa-card" style={{ padding: '32px 36px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(60% 100% at 100% 0%, rgba(0,212,255,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Tu plata, últimos 30 días</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: 'rgba(0,217,126,0.12)', color: 'var(--ok)', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                <i className="fas fa-circle" style={{ fontSize: 6 }} /> RINDIENDO
              </span>
            </div>

            <div className="fa-display" style={{ fontSize: 'clamp(36px, 5vw, 64px)', marginBottom: 18, color: 'var(--text)' }}>
              Pusiste <span className="fa-grad-text">{fmtMoneyShort(r.invertido)}</span>,<br />
              te volvieron <span className="fa-underline">{fmtMoneyShort(r.retornado)}</span>.
            </div>

            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.5px' }}>Cada $1 te devuelve</div>
                <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 56, lineHeight: 1, color: 'var(--text)' }}>
                  ${r.multiplicador.toFixed(1)}<span style={{ fontSize: 32, color: 'var(--text-muted)' }}>x</span>
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 280, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {r.multiplicador_prev !== undefined && r.delta_roas !== undefined && (
                  <ComparativaPill label="vs mes pasado" valor={`${r.multiplicador_prev.toFixed(1)}x`} delta={r.delta_roas} invert />
                )}
                {r.delta_compras !== undefined && (
                  <ComparativaPill label="Compras" valor={`+${(r.delta_compras * 100).toFixed(0)}%`} delta={r.delta_compras} />
                )}
                {r.invertido_prev !== undefined && (
                  <ComparativaPill label="Inversión" valor={fmtMoneyShort(r.invertido)} delta={(r.invertido - r.invertido_prev) / r.invertido_prev} />
                )}
              </div>
            </div>

            {r.delta_roas !== undefined && r.delta_roas < -0.1 && r.nota_agencia && (
              <div style={{ marginTop: 18, padding: 14, background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 10, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <i className="fas fa-circle-info" style={{ color: 'var(--warn)', fontSize: 16, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--warn)', marginBottom: 3 }}>El ROAS bajó vs mes pasado — pero estamos arriba</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{r.nota_agencia}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Esta semana + Salud ===== */}
      <div className="fa-grid-2-1" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 22 }}>
        {/* Esta semana */}
        <div className="fa-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div>
              <div className="fa-display-up" style={{ fontSize: 22, marginBottom: 4 }}>Esta semana</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Qué está haciendo el equipo · qué te toca a vos</div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>20 — 24 abr</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {semana.map((it, i) => {
              const done = it.estado === 'done'
              const pending = it.estado === 'pending'
              const c = pending ? 'var(--brand-blue)' : done ? 'var(--ok)' : 'var(--text-dim)'
              const ico = done ? 'fa-circle-check' : pending ? 'fa-circle-dot' : 'fa-circle'
              return (
                <div key={i} style={{
                  display: 'flex', gap: 14, alignItems: 'center',
                  padding: '12px 14px',
                  background: pending ? 'rgba(36,56,255,0.07)' : 'var(--bg-1)',
                  border: `1px solid ${pending ? 'rgba(36,56,255,0.4)' : 'var(--border)'}`,
                  borderRadius: 10,
                }}>
                  <div style={{ width: 56, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{it.dia}</div>
                  <i className={`fas ${ico}`} style={{ color: c, fontSize: 14 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{it.titulo}</span>
                      {it.quien === 'cliente' && <span style={{ fontSize: 9, padding: '2px 7px', background: 'var(--brand-blue)', color: '#fff', borderRadius: 6, fontWeight: 700, letterSpacing: '0.5px' }}>TE TOCA</span>}
                    </div>
                    {it.detalle && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{it.detalle}</div>}
                  </div>
                  {pending && <button className="fa-btn fa-btn-primary" style={{ padding: '7px 14px', fontSize: 12 }}>Abrir</button>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Salud técnica */}
        <div className="fa-card">
          <div style={{ marginBottom: 18 }}>
            <div className="fa-display-up" style={{ fontSize: 22, marginBottom: 4 }}>Salud técnica</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Lo que te debería preocupar — pero no</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {salud.map((s, i) => {
              const ok = s.ok === true
              const warn = s.ok === 'warn'
              const c = ok ? 'var(--ok)' : warn ? 'var(--warn)' : 'var(--bad)'
              const ico = ok ? 'fa-check' : warn ? 'fa-triangle-exclamation' : 'fa-xmark'
              return (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderBottom: i < salud.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: `color-mix(in srgb, ${c} 15%, transparent)`, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <i className={`fas ${ico}`} style={{ fontSize: 11 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.label}</div>
                    {s.detalle && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.detalle}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ===== Alertas / Timeline AM ===== */}
      {alertas.length > 0 && (
        <div className="fa-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div>
              <div className="fa-display-up" style={{ fontSize: 22, marginBottom: 4 }}>Novedades del equipo</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Te avisamos antes de que preguntes</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {alertas.map((a, i) => {
              const c = a.tone === 'ok' ? 'var(--ok)' : a.tone === 'warn' ? 'var(--warn)' : a.tone === 'bad' ? 'var(--bad)' : 'var(--brand-blue)'
              return (
                <div key={a.id} style={{ display: 'flex', gap: 16, padding: '14px 0', borderBottom: i < alertas.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 60, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                    {new Date(a.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                  </div>
                  <div style={{ width: 4, background: c, borderRadius: 2, alignSelf: 'stretch', flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{a.texto}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ===== KPIs comparativos ===== */}
      {kpis.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div className="fa-display-up" style={{ fontSize: 18 }}>Métricas — últimos 30d</div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Comparado con mes pasado</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {kpis.map((k, i) => (
              <div key={i} className="fa-card fa-card-tight">
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
                  <i className={`fas ${k.icon}`} style={{ color: 'var(--brand-blue)' }} />
                  {k.label}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{k.value}</div>
                  <Delta value={k.delta} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== Objetivo + Recursos + Días ===== */}
      <div className="fa-grid-2-1" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 22 }}>
        {/* Objetivo principal */}
        <div className="fa-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <i className="fas fa-bullseye" style={{ color: 'var(--brand-blue)', fontSize: 16 }} />
            <span className="fa-display-up" style={{ fontSize: 18 }}>Objetivo principal</span>
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 14, lineHeight: 1.3 }}>{cliente.objetivo || 'Sin objetivo definido'}</div>
          <div className="fa-bar"><i style={{ width: cliente.progreso + '%' }} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            <span>{cliente.progreso}% completado</span>
            {cliente.objetivo_meta && <span>Meta: {cliente.objetivo_meta}</span>}
          </div>

          {cliente.proximo_hito && (
            <div style={{ marginTop: 18, padding: 14, background: 'var(--bg-1)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                <i className="fas fa-flag" style={{ color: 'var(--brand-blue)' }} /> Próximo Hito
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{cliente.proximo_hito}</div>
            </div>
          )}
        </div>

        {/* Recursos + counter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="fa-card" style={{ background: 'var(--brand-grad)', color: '#fff', border: 'none', position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: 11, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600, marginBottom: 6 }}>Hace</div>
            <div className="fa-display" style={{ fontSize: 44, color: '#fff', lineHeight: 1 }}>{diasConFuture} días</div>
            <div style={{ fontSize: 13, opacity: 0.95, marginTop: 8 }}>que confiás en Future Agency 🚀</div>
          </div>
          {recursos && (
            <div className="fa-card">
              <div className="fa-display-up" style={{ fontSize: 16, marginBottom: 12 }}>Tu marca tiene</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                <RecursoMini n={recursos.reels} label="reels" icon="fa-film" />
                <RecursoMini n={recursos.historias} label="historias" icon="fa-book-open" />
                <RecursoMini n={recursos.anuncios} label="anuncios" icon="fa-bullhorn" />
                <RecursoMini n={recursos.fotos} label="fotos" icon="fa-image" />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, textAlign: 'center' }}>producidos por Future · descargables</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ComparativaPill({ label, valor, delta, invert = false }: { label: string; valor: string; delta?: number; invert?: boolean }) {
  return (
    <div style={{ padding: '10px 14px', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>{valor}</div>
        {delta !== undefined && <Delta value={delta} invert={invert} />}
      </div>
    </div>
  )
}

function RecursoMini({ n, label, icon }: { n: number; label: string; icon: string }) {
  return (
    <div style={{ padding: 10, background: 'var(--bg-1)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
      <i className={`fas ${icon}`} style={{ color: 'var(--brand-blue)', fontSize: 14 }} />
      <div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{n}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      </div>
    </div>
  )
}

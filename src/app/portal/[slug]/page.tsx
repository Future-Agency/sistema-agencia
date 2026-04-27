'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, type Cliente, type Owner, type AdAccount, type ClientePortalConfig, type ClienteAprobacion, type ClienteObjetivo, type ClienteSugerencia, type ClientePago, type ClienteAcceso, type ClienteTutorial, type ClienteCalendario, type ClienteAlerta, type ClienteNotificacion } from '@/lib/supabase'
import { getSession, clearSession } from '@/lib/portalAuth'
import PortalSeccionInicio from '@/components/portal/PortalSeccionInicio'
import PortalSeccionCalendario from '@/components/portal/PortalSeccionCalendario'
import PortalSeccionAprobaciones from '@/components/portal/PortalSeccionAprobaciones'
import PortalSeccionPauta from '@/components/portal/PortalSeccionPauta'
import PortalSeccionEstrategia from '@/components/portal/PortalSeccionEstrategia'
import PortalSeccionObjetivos from '@/components/portal/PortalSeccionObjetivos'
import PortalSeccionSugerencias from '@/components/portal/PortalSeccionSugerencias'
import PortalSeccionPagos from '@/components/portal/PortalSeccionPagos'
import PortalSeccionAccesos from '@/components/portal/PortalSeccionAccesos'
import PortalSeccionTutoriales from '@/components/portal/PortalSeccionTutoriales'

type Section = 'inicio' | 'aprobaciones' | 'pauta' | 'calendario' | 'objetivos' | 'estrategia' | 'pagos' | 'accesos' | 'sugerencias' | 'tutoriales'

const NAV_PRINCIPAL: { id: Section; label: string; icon: string }[] = [
  { id: 'inicio', label: 'Inicio', icon: 'fa-house' },
  { id: 'aprobaciones', label: 'Aprobaciones', icon: 'fa-circle-check' },
  { id: 'pauta', label: 'Pauta', icon: 'fa-bullseye' },
  { id: 'calendario', label: 'Calendario', icon: 'fa-calendar-days' },
  { id: 'objetivos', label: 'Objetivos', icon: 'fa-flag-checkered' },
  { id: 'estrategia', label: 'Estrategia', icon: 'fa-chess' },
]

const NAV_CUENTA: { id: Section; label: string; icon: string }[] = [
  { id: 'pagos', label: 'Pagos', icon: 'fa-credit-card' },
  { id: 'accesos', label: 'Accesos', icon: 'fa-key' },
  { id: 'sugerencias', label: 'Sugerencias', icon: 'fa-lightbulb' },
  { id: 'tutoriales', label: 'Tutoriales', icon: 'fa-graduation-cap' },
]

export default function PortalClientePage() {
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const slug = params?.slug

  const [section, setSection] = useState<Section>('inicio')
  const [loading, setLoading] = useState(true)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [owner, setOwner] = useState<Owner | null>(null)
  const [config, setConfig] = useState<ClientePortalConfig | null>(null)
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([])
  const [aprobaciones, setAprobaciones] = useState<ClienteAprobacion[]>([])
  const [objetivos, setObjetivos] = useState<ClienteObjetivo[]>([])
  const [sugerencias, setSugerencias] = useState<ClienteSugerencia[]>([])
  const [pagos, setPagos] = useState<ClientePago[]>([])
  const [accesos, setAccesos] = useState<ClienteAcceso[]>([])
  const [tutoriales, setTutoriales] = useState<ClienteTutorial[]>([])
  const [calendario, setCalendario] = useState<ClienteCalendario[]>([])
  const [alertas, setAlertas] = useState<ClienteAlerta[]>([])
  const [notificaciones, setNotificaciones] = useState<ClienteNotificacion[]>([])
  const [collapsed, setCollapsed] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  const loadAll = useCallback(async (clienteId: number, agenciaId: string) => {
    const [conf, ads, aprov, obj, sug, pag, acc, tut, cal, alr, noti] = await Promise.all([
      supabase.from('cliente_portal_config').select('*').eq('cliente_id', clienteId).maybeSingle(),
      supabase.from('ad_accounts').select('*').eq('cliente_id', clienteId).eq('activo', true),
      supabase.from('cliente_aprobaciones').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
      supabase.from('cliente_objetivos').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
      supabase.from('cliente_sugerencias').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
      supabase.from('cliente_pagos').select('*').eq('cliente_id', clienteId).order('fecha', { ascending: false }),
      supabase.from('cliente_accesos').select('*').eq('cliente_id', clienteId).order('created_at'),
      supabase.from('cliente_tutoriales').select('*').eq('agencia_id', agenciaId).eq('activo', true).order('orden'),
      supabase.from('cliente_calendario').select('*').eq('cliente_id', clienteId).order('fecha'),
      supabase.from('cliente_alertas').select('*').eq('cliente_id', clienteId).order('fecha', { ascending: false }).limit(10),
      supabase.from('cliente_notificaciones').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(20),
    ])
    if (conf.data) setConfig(conf.data)
    if (ads.data) setAdAccounts(ads.data)
    if (aprov.data) setAprobaciones(aprov.data)
    if (obj.data) setObjetivos(obj.data)
    if (sug.data) setSugerencias(sug.data)
    if (pag.data) setPagos(pag.data)
    if (acc.data) setAccesos(acc.data)
    if (tut.data) setTutoriales(tut.data)
    if (cal.data) setCalendario(cal.data)
    if (alr.data) setAlertas(alr.data)
    if (noti.data) setNotificaciones(noti.data)
  }, [])

  const refresh = useCallback(async () => {
    if (!cliente) return
    await loadAll(cliente.id, cliente.agencia_id || 'future')
  }, [cliente, loadAll])

  useEffect(() => {
    const session = getSession()
    if (!session || session.slug !== slug) {
      router.replace('/portal/login?slug=' + (slug || ''))
      return
    }

    async function init() {
      const { data: c } = await supabase.from('clientes').select('*').eq('id', session!.cliente_id).maybeSingle()
      if (!c) { clearSession(); router.replace('/portal/login'); return }
      setCliente(c)
      const { data: o } = await supabase.from('owners').select('*').eq('id', c.owner_id).maybeSingle()
      if (o) setOwner(o)
      await loadAll(c.id, c.agencia_id || 'future')
      setLoading(false)
    }
    init()
  }, [slug, router, loadAll])

  // Realtime
  useEffect(() => {
    if (!cliente) return
    const channel = supabase
      .channel(`portal-cliente-${cliente.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes', filter: `id=eq.${cliente.id}` }, async () => {
        const { data } = await supabase.from('clientes').select('*').eq('id', cliente.id).maybeSingle()
        if (data) setCliente(data)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cliente_aprobaciones', filter: `cliente_id=eq.${cliente.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cliente_calendario', filter: `cliente_id=eq.${cliente.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cliente_objetivos', filter: `cliente_id=eq.${cliente.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cliente_pagos', filter: `cliente_id=eq.${cliente.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cliente_alertas', filter: `cliente_id=eq.${cliente.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cliente_notificaciones', filter: `cliente_id=eq.${cliente.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ad_accounts', filter: `cliente_id=eq.${cliente.id}` }, refresh)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [cliente, refresh])

  function logout() {
    clearSession()
    router.replace('/portal/login')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-muted)' }}>
        <div style={{ textAlign: 'center' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 32, color: 'var(--brand-blue)' }} />
          <div style={{ marginTop: 12, fontSize: 13 }}>Cargando portal...</div>
        </div>
      </div>
    )
  }
  if (!cliente) return null

  const aprobacionesPendientes = aprobaciones.filter(a => a.estado === 'pendiente').length
  const sugerenciasNuevas = sugerencias.filter(s => s.estado === 'nueva').length
  const notisNoLeidas = notificaciones.filter(n => !n.leida).length
  const diasConFuture = config?.fecha_inicio_servicio
    ? Math.max(0, Math.floor((Date.now() - new Date(config.fecha_inicio_servicio).getTime()) / (1000 * 60 * 60 * 24)))
    : 0
  const ownerIniciales = owner?.iniciales || (owner?.nombre ? owner.nombre.split(' ').map(p => p[0]).slice(0, 2).join('') : 'AM')
  const whatsappLink = owner?.whatsapp ? `https://wa.me/${owner.whatsapp.replace(/\D/g, '')}` : '#'
  const sectionLabel = [...NAV_PRINCIPAL, ...NAV_CUENTA].find(s => s.id === section)?.label || ''
  const clienteIniciales = cliente.nombre.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
  const portalName = config?.nombre_interfaz || `Portal · ${cliente.nombre}`

  return (
    <div className="fa-app">
      {/* ===== SIDEBAR ===== */}
      <aside
        className="fa-sidebar"
        data-collapsed={collapsed ? 'true' : 'false'}
        data-open={sidebarOpen ? 'true' : 'false'}
      >
        <div style={{ padding: '18px 18px 22px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--brand-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: '#fff', fontSize: 18, fontWeight: 900 }}>F</span>
          </div>
          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, lineHeight: 1, letterSpacing: '-0.4px' }}>FUTURE</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.6px', marginTop: 2 }}>AGENCY · PORTAL</div>
            </div>
          )}
        </div>

        {/* Cliente card */}
        {!collapsed && (
          <div style={{ padding: '14px 14px', display: 'flex', gap: 10, alignItems: 'center', background: 'var(--bg-1)', margin: 12, borderRadius: 10 }}>
            {config?.logo_url ? (
              <img src={config.logo_url} alt={cliente.nombre} style={{ width: 38, height: 38, borderRadius: 7, objectFit: 'cover' }} />
            ) : (
              <div className="fa-stripes" style={{ width: 38, height: 38, borderRadius: 7, fontSize: 9 }}>
                <i className="fas fa-building" style={{ color: 'var(--text)' }} />
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cliente.nombre}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{cliente.industria || cliente.tipo}</div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '4px 10px', overflowY: 'auto' }}>
          {!collapsed && <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '10px 12px 6px', fontWeight: 700 }}>Tu marca</div>}
          {NAV_PRINCIPAL.map(s => {
            const badge = s.id === 'aprobaciones' ? aprobacionesPendientes : 0
            return <NavItem key={s.id} id={s.id} label={s.label} icon={s.icon} active={section === s.id} collapsed={collapsed} badge={badge} onClick={() => { setSection(s.id); setSidebarOpen(false) }} />
          })}

          {!collapsed && <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '14px 12px 6px', fontWeight: 700 }}>Cuenta</div>}
          {NAV_CUENTA.map(s => {
            const badge = s.id === 'sugerencias' ? sugerenciasNuevas : 0
            return <NavItem key={s.id} id={s.id} label={s.label} icon={s.icon} active={section === s.id} collapsed={collapsed} badge={badge} onClick={() => { setSection(s.id); setSidebarOpen(false) }} />
          })}
        </nav>

        {/* AM card */}
        {!collapsed && owner && (
          <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ padding: 14, background: 'var(--bg-1)', borderRadius: 10, border: '1px solid var(--border-2)' }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8, fontWeight: 600 }}>Tu Account Manager</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 50, background: 'var(--brand-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>{ownerIniciales}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{owner.nombre}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 50, background: 'var(--ok)' }} />
                    {owner.avg_response ? `Responde en ~${owner.avg_response}` : 'En línea'}
                  </div>
                </div>
              </div>
              {owner.whatsapp && (
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: '8px 10px', background: 'var(--ok)', color: '#0a0a0a', borderRadius: 7, fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>
                  <i className="fab fa-whatsapp" /> Escribir por WhatsApp
                </a>
              )}
            </div>
          </div>
        )}

        <button onClick={() => setCollapsed(!collapsed)} style={{ padding: 12, background: 'none', border: 'none', borderTop: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 8 }}>
          <i className={`fas ${collapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`} />{!collapsed && 'Colapsar'}
        </button>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 80 }} />
      )}

      {/* ===== MAIN ===== */}
      <main className="fa-main">
        <header className="fa-header" style={{ position: 'sticky', top: 0 }}>
          <button className="fa-burger fa-header-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <i className="fas fa-bars" />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{portalName}</div>
            <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{sectionLabel}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
            {owner?.whatsapp && (
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="fa-btn-whatsapp" style={{ padding: '8px 14px', fontSize: 12 }}>
                <i className="fab fa-whatsapp" /> WhatsApp
              </a>
            )}
            <button className="fa-header-btn" onClick={() => setNotifOpen(!notifOpen)} style={{ position: 'relative' }}>
              <i className="fas fa-bell" />
              {notisNoLeidas > 0 && (
                <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, background: 'var(--bad)', borderRadius: 50, border: '2px solid var(--card)' }} />
              )}
            </button>
            <button onClick={logout} className="fa-header-btn" title="Cerrar sesión"><i className="fas fa-sign-out-alt" /></button>
            <div style={{ width: 32, height: 32, borderRadius: 50, background: 'var(--brand-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 11, marginLeft: 6 }}>{clienteIniciales}</div>

            {notifOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 360, background: 'var(--card)', border: '1px solid var(--border-2)', borderRadius: 12, padding: 12, zIndex: 100, boxShadow: '0 18px 40px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 6px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Notificaciones</div>
                  <button onClick={() => setNotifOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><i className="fas fa-xmark" /></button>
                </div>
                {notificaciones.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Sin notificaciones</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
                    {notificaciones.map(n => (
                      <div key={n.id} style={{ padding: 10, background: !n.leida ? 'rgba(36,56,255,0.08)' : 'transparent', borderRadius: 8, display: 'flex', gap: 10 }}>
                        <i className={`fas ${n.icon || 'fa-bell'}`} style={{ color: 'var(--brand-blue-soft)', marginTop: 2, fontSize: 13, width: 16 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>{n.texto}</div>
                          {n.cuando && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{n.cuando}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <div className="fa-content">
          {section === 'inicio' && <PortalSeccionInicio cliente={cliente} owner={owner} config={config} alertas={alertas} adAccounts={adAccounts} diasConFuture={diasConFuture} />}
          {section === 'aprobaciones' && <PortalSeccionAprobaciones aprobaciones={aprobaciones} clienteId={cliente.id} onUpdate={refresh} />}
          {section === 'pauta' && <PortalSeccionPauta adAccounts={adAccounts} config={config} />}
          {section === 'calendario' && <PortalSeccionCalendario calendario={calendario} />}
          {section === 'objetivos' && <PortalSeccionObjetivos objetivos={objetivos} />}
          {section === 'estrategia' && <PortalSeccionEstrategia config={config} cliente={cliente} />}
          {section === 'pagos' && <PortalSeccionPagos pagos={pagos} />}
          {section === 'accesos' && <PortalSeccionAccesos accesos={accesos} />}
          {section === 'sugerencias' && <PortalSeccionSugerencias sugerencias={sugerencias} clienteId={cliente.id} onUpdate={refresh} />}
          {section === 'tutoriales' && <PortalSeccionTutoriales tutoriales={tutoriales} />}
        </div>
      </main>
    </div>
  )
}

function NavItem({ id, label, icon, active, collapsed, badge, onClick }: { id: string; label: string; icon: string; active: boolean; collapsed: boolean; badge: number; onClick: () => void }) {
  return (
    <button onClick={onClick} title={collapsed ? label : undefined} className={'fa-nav-item' + (active ? ' active' : '')} style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}>
      <i className={`fas ${icon}`} style={{ width: 16, fontSize: 13 }} />
      {!collapsed && <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>}
      {!collapsed && badge > 0 && (
        <span style={{ padding: '2px 7px', background: 'var(--brand-blue)', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>{badge}</span>
      )}
    </button>
  )
}

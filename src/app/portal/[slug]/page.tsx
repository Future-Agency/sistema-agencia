'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, type Cliente, type Owner, type AdAccount, type ClientePortalConfig, type ClienteAprobacion, type ClienteObjetivo, type ClienteSugerencia, type ClientePago, type ClienteAcceso, type ClienteTutorial, type ClienteCalendario } from '@/lib/supabase'
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

type Section = 'inicio' | 'objetivos' | 'calendario' | 'aprobaciones' | 'pauta' | 'estrategia' | 'accesos' | 'sugerencias' | 'tutoriales' | 'pagos'

const NAV: { id: Section; label: string; icon: string }[] = [
  { id: 'inicio', label: 'Inicio', icon: 'fa-home' },
  { id: 'objetivos', label: 'Objetivos', icon: 'fa-bullseye' },
  { id: 'calendario', label: 'Calendario', icon: 'fa-calendar-alt' },
  { id: 'aprobaciones', label: 'Aprobaciones', icon: 'fa-check-double' },
  { id: 'pauta', label: 'Pauta', icon: 'fa-rectangle-ad' },
  { id: 'estrategia', label: 'Estrategia', icon: 'fa-chess' },
  { id: 'accesos', label: 'Accesos', icon: 'fa-key' },
  { id: 'sugerencias', label: 'Sugerencias', icon: 'fa-lightbulb' },
  { id: 'tutoriales', label: 'Tutoriales', icon: 'fa-graduation-cap' },
  { id: 'pagos', label: 'Pagos', icon: 'fa-credit-card' },
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
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const loadAll = useCallback(async (clienteId: number, agenciaId: string) => {
    const [conf, ads, aprov, obj, sug, pag, acc, tut, cal] = await Promise.all([
      supabase.from('cliente_portal_config').select('*').eq('cliente_id', clienteId).maybeSingle(),
      supabase.from('ad_accounts').select('*').eq('cliente_id', clienteId).eq('activo', true),
      supabase.from('cliente_aprobaciones').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
      supabase.from('cliente_objetivos').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
      supabase.from('cliente_sugerencias').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
      supabase.from('cliente_pagos').select('*').eq('cliente_id', clienteId).order('fecha', { ascending: false }),
      supabase.from('cliente_accesos').select('*').eq('cliente_id', clienteId).order('created_at'),
      supabase.from('cliente_tutoriales').select('*').eq('agencia_id', agenciaId).eq('activo', true).order('orden'),
      supabase.from('cliente_calendario').select('*').eq('cliente_id', clienteId).order('fecha'),
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

  // Realtime: escuchar cambios del cliente
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a14', color: '#a0a0b8' }}>
        <div style={{ textAlign: 'center' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 32, color: '#5e72e4' }} />
          <div style={{ marginTop: 12, fontSize: 13 }}>Cargando portal...</div>
        </div>
      </div>
    )
  }
  if (!cliente) return null

  const colorPrimario = config?.color_primario || '#5e72e4'
  const nombreInterfaz = config?.nombre_interfaz || `Portal ${cliente.nombre}`
  const aprobacionesPendientes = aprobaciones.filter(a => a.estado === 'pendiente').length
  const sugerenciasNuevas = sugerencias.filter(s => s.estado === 'nueva').length

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a14', color: '#e8e8f0', display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{
        width: 260,
        background: 'linear-gradient(180deg, #14142a 0%, #0a0a14 100%)',
        borderRight: '1px solid #1a1a2e',
        padding: '24px 0',
        position: 'fixed',
        top: 0, left: sidebarOpen ? 0 : -260, bottom: 0,
        zIndex: 100,
        transition: 'left 0.3s',
        display: 'flex', flexDirection: 'column',
      }} className="portal-sidebar">
        <div style={{ padding: '0 22px 20px', borderBottom: '1px solid #1a1a2e', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {config?.logo_url ? (
              <img src={config.logo_url} alt={cliente.nombre} style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg, ${colorPrimario}, ${colorPrimario}aa)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color: 'white' }}>
                {cliente.nombre.charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cliente.nombre}</div>
              <div style={{ fontSize: 10, color: '#6a6a80', textTransform: 'uppercase', letterSpacing: 0.5 }}>{cliente.tipo}</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
          {NAV.map(item => {
            const active = section === item.id
            const badge = item.id === 'aprobaciones' ? aprobacionesPendientes : item.id === 'sugerencias' ? sugerenciasNuevas : 0
            return (
              <button key={item.id}
                onClick={() => { setSection(item.id); setSidebarOpen(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px', marginBottom: 2,
                  background: active ? `${colorPrimario}22` : 'transparent',
                  border: active ? `1px solid ${colorPrimario}55` : '1px solid transparent',
                  borderRadius: 10,
                  color: active ? colorPrimario : '#a0a0b8',
                  fontSize: 13, fontWeight: active ? 600 : 500,
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <i className={`fas ${item.icon}`} style={{ width: 18, fontSize: 14 }} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {badge > 0 && (
                  <span style={{
                    background: '#f5365c', color: 'white',
                    fontSize: 10, fontWeight: 700,
                    padding: '2px 7px', borderRadius: 10,
                    minWidth: 18, textAlign: 'center',
                  }}>{badge}</span>
                )}
              </button>
            )
          })}
        </nav>

        <div style={{ padding: '16px 18px', borderTop: '1px solid #1a1a2e' }}>
          <div style={{ fontSize: 11, color: '#6a6a80', marginBottom: 6 }}>Account Manager</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: owner?.color || '#e8e8f0' }}>{owner?.nombre || '-'}</div>
          <button onClick={logout} style={{
            marginTop: 12, width: '100%',
            padding: '8px 12px', background: 'transparent',
            border: '1px solid #2a2a40', borderRadius: 8,
            color: '#a0a0b8', fontSize: 12, cursor: 'pointer',
          }}>
            <i className="fas fa-sign-out-alt" style={{ marginRight: 6 }} /> Cerrar sesion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, marginLeft: 260, minHeight: '100vh' }} className="portal-main">
        <header style={{
          padding: '20px 32px',
          background: 'rgba(20, 20, 32, 0.6)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid #1a1a2e',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="portal-burger" style={{
              display: 'none', background: 'transparent', border: 'none', color: '#e8e8f0', fontSize: 18, cursor: 'pointer',
            }}>
              <i className="fas fa-bars" />
            </button>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{nombreInterfaz}</h1>
              <div style={{ fontSize: 11, color: '#00d97e', marginTop: 2 }}>
                <i className="fas fa-circle" style={{ fontSize: 6, marginRight: 6 }} />
                Conectado en tiempo real
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#6a6a80' }}>
            <i className="fas fa-calendar" style={{ marginRight: 6 }} />
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </header>

        <div style={{ padding: '28px 32px' }}>
          {section === 'inicio' && <PortalSeccionInicio cliente={cliente} owner={owner} config={config} aprobacionesPendientes={aprobacionesPendientes} totalObjetivosLogrados={objetivos.filter(o => o.estado === 'logrado').length} adAccounts={adAccounts} colorPrimario={colorPrimario} />}
          {section === 'objetivos' && <PortalSeccionObjetivos objetivos={objetivos} colorPrimario={colorPrimario} />}
          {section === 'calendario' && <PortalSeccionCalendario calendario={calendario} colorPrimario={colorPrimario} />}
          {section === 'aprobaciones' && <PortalSeccionAprobaciones aprobaciones={aprobaciones} clienteId={cliente.id} onUpdate={refresh} colorPrimario={colorPrimario} />}
          {section === 'pauta' && <PortalSeccionPauta adAccounts={adAccounts} colorPrimario={colorPrimario} />}
          {section === 'estrategia' && <PortalSeccionEstrategia config={config} cliente={cliente} colorPrimario={colorPrimario} />}
          {section === 'accesos' && <PortalSeccionAccesos accesos={accesos} colorPrimario={colorPrimario} />}
          {section === 'sugerencias' && <PortalSeccionSugerencias sugerencias={sugerencias} clienteId={cliente.id} onUpdate={refresh} colorPrimario={colorPrimario} />}
          {section === 'tutoriales' && <PortalSeccionTutoriales tutoriales={tutoriales} colorPrimario={colorPrimario} />}
          {section === 'pagos' && <PortalSeccionPagos pagos={pagos} config={config} colorPrimario={colorPrimario} />}
        </div>
      </main>

      <style jsx>{`
        @media (max-width: 768px) {
          .portal-sidebar { left: ${sidebarOpen ? 0 : -260}px !important; }
          .portal-main { margin-left: 0 !important; }
          .portal-burger { display: block !important; }
        }
      `}</style>
    </div>
  )
}

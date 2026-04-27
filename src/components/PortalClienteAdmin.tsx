'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, type Cliente, type Owner, type ClientePortalAcceso, type ClientePortalConfig, type ClienteAprobacion, type ClienteObjetivo, type ClienteCalendario, type ClienteAcceso, type ClientePago, type ClienteSugerencia, type ClienteAlerta, type ClienteDecision, type ClienteRoadmap, type ClienteNotificacion, type FunnelStage, type RoasHero, type SaludItem, type SemanaItem, type Recursos, type Benchmark, type TopCreativo, type KpiItem, type EstrategiaSeccion } from '@/lib/supabase'

type SectionId =
  | 'acceso' | 'branding'
  | 'inicio' | 'semana' | 'salud' | 'alertas' | 'topcreativo' | 'kpis' | 'recursosBench'
  | 'estrategia'
  | 'aprobaciones' | 'objetivos' | 'calendario'
  | 'accesos' | 'pagos' | 'sugerencias'
  | 'decisiones' | 'roadmap' | 'notificaciones'
  | 'cliente'

const NAV: { group: string; items: { id: SectionId; label: string; icon: string }[] }[] = [
  { group: 'Configuración', items: [
    { id: 'acceso', label: 'Acceso', icon: 'fa-key' },
    { id: 'branding', label: 'Branding y Servicio', icon: 'fa-palette' },
    { id: 'cliente', label: 'Datos del Cliente', icon: 'fa-id-card' },
  ]},
  { group: 'Inicio (Hero)', items: [
    { id: 'inicio', label: 'Hero ROAS', icon: 'fa-chart-line' },
    { id: 'semana', label: 'Esta semana', icon: 'fa-calendar-week' },
    { id: 'salud', label: 'Salud técnica', icon: 'fa-heart-pulse' },
    { id: 'alertas', label: 'Novedades / Alertas', icon: 'fa-bell' },
    { id: 'topcreativo', label: 'Top Creativo', icon: 'fa-trophy' },
    { id: 'kpis', label: 'KPIs 30d', icon: 'fa-chart-bar' },
    { id: 'recursosBench', label: 'Recursos + Benchmark', icon: 'fa-cubes' },
  ]},
  { group: 'Plan', items: [
    { id: 'estrategia', label: 'Estrategia (TOFU/MOFU/BOFU)', icon: 'fa-chess' },
    { id: 'objetivos', label: 'Objetivos', icon: 'fa-bullseye' },
    { id: 'roadmap', label: 'Roadmap', icon: 'fa-route' },
    { id: 'decisiones', label: 'Decisiones del mes', icon: 'fa-lightbulb' },
  ]},
  { group: 'Contenido', items: [
    { id: 'aprobaciones', label: 'Aprobaciones', icon: 'fa-check-double' },
    { id: 'calendario', label: 'Calendario', icon: 'fa-calendar-days' },
  ]},
  { group: 'Cliente', items: [
    { id: 'accesos', label: 'Accesos del cliente', icon: 'fa-link' },
    { id: 'pagos', label: 'Pagos', icon: 'fa-credit-card' },
    { id: 'sugerencias', label: 'Sugerencias', icon: 'fa-comments' },
    { id: 'notificaciones', label: 'Notificaciones', icon: 'fa-bell-concierge' },
  ]},
]

type Props = { cliente: Cliente; onClose: () => void; showToast: (msg: string, type: 'success' | 'error') => void }

export default function PortalClienteAdmin({ cliente, onClose, showToast }: Props) {
  const [section, setSection] = useState<SectionId>('acceso')
  const [loading, setLoading] = useState(true)
  const [acceso, setAcceso] = useState<ClientePortalAcceso | null>(null)
  const [config, setConfig] = useState<ClientePortalConfig | null>(null)
  const [aprobaciones, setAprobaciones] = useState<ClienteAprobacion[]>([])
  const [objetivos, setObjetivos] = useState<ClienteObjetivo[]>([])
  const [calendario, setCalendario] = useState<ClienteCalendario[]>([])
  const [accesos, setAccesos] = useState<ClienteAcceso[]>([])
  const [pagos, setPagos] = useState<ClientePago[]>([])
  const [sugerencias, setSugerencias] = useState<ClienteSugerencia[]>([])
  const [alertas, setAlertas] = useState<ClienteAlerta[]>([])
  const [decisiones, setDecisiones] = useState<ClienteDecision[]>([])
  const [roadmap, setRoadmap] = useState<ClienteRoadmap[]>([])
  const [notificaciones, setNotificaciones] = useState<ClienteNotificacion[]>([])
  const [owner, setOwner] = useState<Owner | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [acc, conf, apr, obj, cal, accs, pag, sug, alr, dec, rdm, noti, own] = await Promise.all([
      supabase.from('cliente_portal_acceso').select('*').eq('cliente_id', cliente.id).maybeSingle(),
      supabase.from('cliente_portal_config').select('*').eq('cliente_id', cliente.id).maybeSingle(),
      supabase.from('cliente_aprobaciones').select('*').eq('cliente_id', cliente.id).order('created_at', { ascending: false }),
      supabase.from('cliente_objetivos').select('*').eq('cliente_id', cliente.id).order('created_at', { ascending: false }),
      supabase.from('cliente_calendario').select('*').eq('cliente_id', cliente.id).order('fecha'),
      supabase.from('cliente_accesos').select('*').eq('cliente_id', cliente.id).order('created_at'),
      supabase.from('cliente_pagos').select('*').eq('cliente_id', cliente.id).order('fecha', { ascending: false }),
      supabase.from('cliente_sugerencias').select('*').eq('cliente_id', cliente.id).order('created_at', { ascending: false }),
      supabase.from('cliente_alertas').select('*').eq('cliente_id', cliente.id).order('fecha', { ascending: false }),
      supabase.from('cliente_decisiones').select('*').eq('cliente_id', cliente.id).order('fecha', { ascending: false }),
      supabase.from('cliente_roadmap').select('*').eq('cliente_id', cliente.id).order('orden'),
      supabase.from('cliente_notificaciones').select('*').eq('cliente_id', cliente.id).order('created_at', { ascending: false }),
      supabase.from('owners').select('*').eq('id', cliente.owner_id).maybeSingle(),
    ])
    setAcceso(acc.data || null)
    setConfig(conf.data || null)
    setAprobaciones(apr.data || [])
    setObjetivos(obj.data || [])
    setCalendario(cal.data || [])
    setAccesos(accs.data || [])
    setPagos(pag.data || [])
    setSugerencias(sug.data || [])
    setAlertas(alr.data || [])
    setDecisiones(dec.data || [])
    setRoadmap(rdm.data || [])
    setNotificaciones(noti.data || [])
    setOwner(own.data || null)
    setLoading(false)
  }, [cliente.id, cliente.owner_id])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex' }}>
      <div style={{ width: 270, background: '#0e0e18', borderRight: '1px solid #1a1a2e', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #1a1a2e' }}>
          <div style={{ fontSize: 11, color: '#6a6a80', textTransform: 'uppercase', letterSpacing: 0.5 }}>Portal de</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{cliente.nombre}</div>
        </div>
        <nav style={{ flex: 1, padding: 10, overflowY: 'auto' }}>
          {NAV.map(g => (
            <div key={g.group} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: '#5a5a70', textTransform: 'uppercase', letterSpacing: 0.8, padding: '8px 12px 4px', fontWeight: 700 }}>{g.group}</div>
              {g.items.map(item => {
                const active = section === item.id
                let badge = 0
                if (item.id === 'sugerencias') badge = sugerencias.filter(s => !s.visto_por_agencia).length
                else if (item.id === 'aprobaciones') badge = aprobaciones.filter(a => a.estado === 'cambios_solicitados' && !a.visto_por_agencia).length
                return (
                  <button key={item.id} onClick={() => setSection(item.id)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', marginBottom: 1,
                    background: active ? '#5e72e422' : 'transparent',
                    border: active ? '1px solid #5e72e455' : '1px solid transparent',
                    borderRadius: 7, color: active ? '#5e72e4' : '#a0a0b8',
                    fontSize: 12, fontWeight: active ? 600 : 500,
                    cursor: 'pointer', textAlign: 'left',
                  }}>
                    <i className={`fas ${item.icon}`} style={{ width: 14, fontSize: 11 }} />
                    <span style={{ flex: 1, fontSize: 12 }}>{item.label}</span>
                    {badge > 0 && <span style={{ background: '#f5365c', color: 'white', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 8 }}>{badge}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
        <button onClick={onClose} style={{ margin: 14, padding: '10px', background: 'transparent', border: '1px solid #2a2a40', borderRadius: 8, color: '#a0a0b8', cursor: 'pointer', fontSize: 12 }}>
          <i className="fas fa-times" style={{ marginRight: 6 }} /> Cerrar
        </button>
      </div>

      <div style={{ flex: 1, background: '#0a0a14', overflowY: 'auto' }}>
        <div style={{ padding: '20px 28px', borderBottom: '1px solid #1a1a2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#0a0a14', zIndex: 10 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{NAV.flatMap(g => g.items).find(i => i.id === section)?.label}</h2>
            <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 2 }}>Configuración del portal</div>
          </div>
          {acceso?.slug && (
            <a href={`/portal/${acceso.slug}`} target="_blank" rel="noreferrer" style={{ padding: '8px 14px', background: '#5e72e4', borderRadius: 8, color: 'white', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>
              <i className="fas fa-external-link-alt" style={{ marginRight: 6 }} /> Ver portal del cliente
            </a>
          )}
        </div>

        <div style={{ padding: 28 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#6a6a80', padding: 40 }}><i className="fas fa-spinner fa-spin" style={{ fontSize: 24 }} /></div>
          ) : (
            <>
              {section === 'acceso' && <SeccionAcceso cliente={cliente} acceso={acceso} onUpdate={load} showToast={showToast} />}
              {section === 'branding' && <SeccionBranding cliente={cliente} config={config} onUpdate={load} showToast={showToast} />}
              {section === 'cliente' && <SeccionCliente cliente={cliente} owner={owner} onUpdate={load} showToast={showToast} />}
              {section === 'inicio' && <SeccionHero cliente={cliente} config={config} onUpdate={load} showToast={showToast} />}
              {section === 'semana' && <SeccionSemana cliente={cliente} config={config} onUpdate={load} showToast={showToast} />}
              {section === 'salud' && <SeccionSalud cliente={cliente} config={config} onUpdate={load} showToast={showToast} />}
              {section === 'alertas' && <SeccionAlertas cliente={cliente} alertas={alertas} onUpdate={load} showToast={showToast} />}
              {section === 'topcreativo' && <SeccionTopCreativo cliente={cliente} config={config} onUpdate={load} showToast={showToast} />}
              {section === 'kpis' && <SeccionKpis cliente={cliente} config={config} onUpdate={load} showToast={showToast} />}
              {section === 'recursosBench' && <SeccionRecursosBench cliente={cliente} config={config} onUpdate={load} showToast={showToast} />}
              {section === 'estrategia' && <SeccionEstrategia cliente={cliente} config={config} onUpdate={load} showToast={showToast} />}
              {section === 'aprobaciones' && <SeccionAprobaciones cliente={cliente} aprobaciones={aprobaciones} onUpdate={load} showToast={showToast} />}
              {section === 'objetivos' && <SeccionObjetivos cliente={cliente} objetivos={objetivos} onUpdate={load} showToast={showToast} />}
              {section === 'calendario' && <SeccionCalendario cliente={cliente} calendario={calendario} onUpdate={load} showToast={showToast} />}
              {section === 'accesos' && <SeccionAccesos cliente={cliente} accesos={accesos} onUpdate={load} showToast={showToast} />}
              {section === 'pagos' && <SeccionPagos cliente={cliente} pagos={pagos} onUpdate={load} showToast={showToast} />}
              {section === 'sugerencias' && <SeccionSugerencias sugerencias={sugerencias} onUpdate={load} showToast={showToast} />}
              {section === 'decisiones' && <SeccionDecisiones cliente={cliente} decisiones={decisiones} onUpdate={load} showToast={showToast} />}
              {section === 'roadmap' && <SeccionRoadmap cliente={cliente} roadmap={roadmap} onUpdate={load} showToast={showToast} />}
              {section === 'notificaciones' && <SeccionNotificaciones cliente={cliente} notificaciones={notificaciones} onUpdate={load} showToast={showToast} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// =============== ACCESO ===============
function SeccionAcceso({ cliente, acceso, onUpdate, showToast }: { cliente: Cliente; acceso: ClientePortalAcceso | null; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const [slug, setSlug] = useState(acceso?.slug || cliente.nombre.toLowerCase().replace(/[^a-z0-9]/g, ''))
  const [username, setUsername] = useState(acceso?.username || cliente.nombre.toLowerCase().replace(/[^a-z0-9]/g, ''))
  const [password, setPassword] = useState(acceso?.password || '')
  const [activo, setActivo] = useState(acceso?.activo ?? true)
  const [showPwd, setShowPwd] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (acceso) {
      setSlug(acceso.slug); setUsername(acceso.username); setPassword(acceso.password); setActivo(acceso.activo)
    }
  }, [acceso])

  async function save() {
    if (!slug.trim() || !username.trim() || !password.trim()) { showToast('Completa todos los campos', 'error'); return }
    setSaving(true)
    if (acceso) {
      const { error } = await supabase.from('cliente_portal_acceso').update({ slug: slug.trim().toLowerCase(), username: username.trim(), password, activo }).eq('id', acceso.id)
      if (error) showToast('Error: ' + error.message, 'error'); else { showToast('Acceso actualizado', 'success'); onUpdate() }
    } else {
      const { error } = await supabase.from('cliente_portal_acceso').insert({ cliente_id: cliente.id, slug: slug.trim().toLowerCase(), username: username.trim(), password, activo })
      if (error) showToast('Error: ' + error.message, 'error'); else { showToast('Acceso creado', 'success'); onUpdate() }
    }
    setSaving(false)
  }

  function genPwd() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let p = ''; for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)]
    setPassword(p)
  }

  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/portal/login?slug=${slug}` : `/portal/login?slug=${slug}`
  const copy = (t: string, l: string) => { navigator.clipboard.writeText(t); showToast(`${l} copiado`, 'success') }

  return (
    <div style={{ maxWidth: 600 }}>
      <Card title="Credenciales de acceso" desc="Datos que el cliente usa para entrar a su portal">
        <Field label="Slug (URL)">
          <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} style={inputStyle} />
          <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 4 }}>URL: <code style={{ color: '#5e72e4' }}>/portal/{slug}</code></div>
        </Field>
        <Field label="Usuario"><input value={username} onChange={e => setUsername(e.target.value)} style={inputStyle} /></Field>
        <Field label="Contraseña">
          <div style={{ display: 'flex', gap: 6 }}>
            <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => setShowPwd(!showPwd)} style={btnGhost}><i className={`fas ${showPwd ? 'fa-eye-slash' : 'fa-eye'}`} /></button>
            <button onClick={genPwd} style={btnGhost} title="Generar"><i className="fas fa-dice" /></button>
          </div>
        </Field>
        <Field label="Estado"><label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} /> <span style={{ fontSize: 13 }}>Acceso activo</span></label></Field>
        <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Guardando...' : (acceso ? 'Actualizar acceso' : 'Crear acceso')}</button>
      </Card>

      {acceso && (
        <Card title="Compartir con el cliente" desc="">
          <div style={{ padding: 14, background: '#0a0a14', borderRadius: 10, fontSize: 13, lineHeight: 1.8, fontFamily: 'monospace' }}>
            <div><span style={{ color: '#6a6a80' }}>URL:</span> {portalUrl}</div>
            <div><span style={{ color: '#6a6a80' }}>Usuario:</span> {username}</div>
            <div><span style={{ color: '#6a6a80' }}>Contraseña:</span> {showPwd ? password : '••••••••'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button onClick={() => copy(portalUrl, 'URL')} style={btnGhost}><i className="fas fa-copy" /> URL</button>
            <button onClick={() => copy(`Hola! Te dejo los accesos a tu portal:\n\nURL: ${portalUrl}\nUsuario: ${username}\nContraseña: ${password}`, 'Mensaje')} style={{ ...btnGhost, background: '#5e72e422', color: '#5e72e4', border: '1px solid #5e72e455' }}><i className="fas fa-paper-plane" /> Copiar mensaje completo</button>
          </div>
          {acceso.last_login && <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 12 }}><i className="fas fa-clock" /> Último ingreso: {new Date(acceso.last_login).toLocaleString('es-AR')}</div>}
        </Card>
      )}
    </div>
  )
}

// =============== BRANDING ===============
function SeccionBranding({ cliente, config, onUpdate, showToast }: { cliente: Cliente; config: ClientePortalConfig | null; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const [form, setForm] = useState({
    nombre_interfaz: config?.nombre_interfaz || `Portal ${cliente.nombre}`,
    logo_url: config?.logo_url || '',
    color_primario: config?.color_primario || '#5e72e4',
    bienvenida: config?.bienvenida || '',
    fecha_inicio_servicio: config?.fecha_inicio_servicio || '',
    monto_mensual: config?.monto_mensual?.toString() || '',
    moneda: config?.moneda || 'ARS',
    dia_pago: config?.dia_pago?.toString() || '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (config) setForm({
      nombre_interfaz: config.nombre_interfaz || `Portal ${cliente.nombre}`,
      logo_url: config.logo_url || '',
      color_primario: config.color_primario || '#5e72e4',
      bienvenida: config.bienvenida || '',
      fecha_inicio_servicio: config.fecha_inicio_servicio || '',
      monto_mensual: config.monto_mensual?.toString() || '',
      moneda: config.moneda || 'ARS',
      dia_pago: config.dia_pago?.toString() || '',
    })
  }, [config, cliente.nombre])

  async function save() {
    setSaving(true)
    const payload: any = {
      cliente_id: cliente.id,
      nombre_interfaz: form.nombre_interfaz || null,
      logo_url: form.logo_url || null,
      color_primario: form.color_primario || '#5e72e4',
      bienvenida: form.bienvenida || null,
      fecha_inicio_servicio: form.fecha_inicio_servicio || null,
      monto_mensual: form.monto_mensual ? Number(form.monto_mensual) : null,
      moneda: form.moneda || 'ARS',
      dia_pago: form.dia_pago ? Number(form.dia_pago) : null,
      updated_at: new Date().toISOString(),
    }
    if (config) {
      const { error } = await supabase.from('cliente_portal_config').update(payload).eq('id', config.id)
      if (error) showToast('Error: ' + error.message, 'error'); else { showToast('Configuración guardada', 'success'); onUpdate() }
    } else {
      const { error } = await supabase.from('cliente_portal_config').insert(payload)
      if (error) showToast('Error: ' + error.message, 'error'); else { showToast('Configuración creada', 'success'); onUpdate() }
    }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <Card title="Branding" desc="">
        <Field label="Nombre de la interfaz"><input value={form.nombre_interfaz} onChange={e => setForm({ ...form, nombre_interfaz: e.target.value })} style={inputStyle} /></Field>
        <Field label="Logo del cliente">
          <LogoUploader clienteId={cliente.id} value={form.logo_url} onChange={url => setForm({ ...form, logo_url: url })} showToast={showToast} />
        </Field>
        <Field label="Color primario">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={form.color_primario} onChange={e => setForm({ ...form, color_primario: e.target.value })} style={{ width: 50, height: 38, border: '1px solid #2a2a40', borderRadius: 8, cursor: 'pointer', background: 'transparent' }} />
            <input value={form.color_primario} onChange={e => setForm({ ...form, color_primario: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          </div>
        </Field>
        <Field label="Mensaje de bienvenida"><textarea value={form.bienvenida} onChange={e => setForm({ ...form, bienvenida: e.target.value })} style={{ ...inputStyle, minHeight: 70, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
      </Card>
      <Card title="Servicio" desc="">
        <Field label="Fecha inicio del servicio"><input type="date" value={form.fecha_inicio_servicio} onChange={e => setForm({ ...form, fecha_inicio_servicio: e.target.value })} style={inputStyle} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px', gap: 10 }}>
          <Field label="Monto mensual"><input type="number" value={form.monto_mensual} onChange={e => setForm({ ...form, monto_mensual: e.target.value })} style={inputStyle} /></Field>
          <Field label="Moneda"><select value={form.moneda} onChange={e => setForm({ ...form, moneda: e.target.value })} style={inputStyle}><option>ARS</option><option>USD</option></select></Field>
          <Field label="Día pago"><input type="number" min="1" max="31" value={form.dia_pago} onChange={e => setForm({ ...form, dia_pago: e.target.value })} style={inputStyle} /></Field>
        </div>
      </Card>
      <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar'}</button>
    </div>
  )
}

// =============== CLIENTE (datos básicos) ===============
function SeccionCliente({ cliente, owner, onUpdate, showToast }: { cliente: Cliente; owner: Owner | null; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const [industria, setIndustria] = useState(cliente.industria || '')
  const [objetivoMeta, setObjetivoMeta] = useState(cliente.objetivo_meta || '')
  const [whatsapp, setWhatsapp] = useState(owner?.whatsapp || '')
  const [iniciales, setIniciales] = useState(owner?.iniciales || '')
  const [avgResponse, setAvgResponse] = useState(owner?.avg_response || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const u1 = await supabase.from('clientes').update({ industria: industria || null, objetivo_meta: objetivoMeta || null }).eq('id', cliente.id)
    if (owner) {
      await supabase.from('owners').update({ whatsapp: whatsapp || null, iniciales: iniciales || null, avg_response: avgResponse || null }).eq('id', owner.id)
    }
    setSaving(false)
    if (u1.error) showToast('Error: ' + u1.error.message, 'error'); else { showToast('Datos guardados', 'success'); onUpdate() }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <Card title="Cliente" desc="Datos que ve el cliente en su portal">
        <Field label="Industria / rubro"><input value={industria} onChange={e => setIndustria(e.target.value)} style={inputStyle} placeholder="ej: CRM · Climatizacion" /></Field>
        <Field label="Meta del objetivo principal"><input value={objetivoMeta} onChange={e => setObjetivoMeta(e.target.value)} style={inputStyle} placeholder="ej: 160 leads/mes" /></Field>
      </Card>
      {owner && (
        <Card title={`Account Manager (${owner.nombre})`} desc="Lo que el cliente ve del AM">
          <Field label="WhatsApp"><input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} style={inputStyle} placeholder="+54 11 6234 5678" /></Field>
          <Field label="Iniciales"><input value={iniciales} onChange={e => setIniciales(e.target.value)} style={inputStyle} placeholder="MP" maxLength={3} /></Field>
          <Field label="Tiempo de respuesta"><input value={avgResponse} onChange={e => setAvgResponse(e.target.value)} style={inputStyle} placeholder="2hs" /></Field>
        </Card>
      )}
      <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar'}</button>
    </div>
  )
}

// =============== HERO ROAS ===============
function SeccionHero({ cliente, config, onUpdate, showToast }: { cliente: Cliente; config: ClientePortalConfig | null; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const r = config?.roas_30d || ({} as RoasHero)
  const [form, setForm] = useState({
    invertido: r.invertido?.toString() || '',
    retornado: r.retornado?.toString() || '',
    multiplicador: r.multiplicador?.toString() || '',
    invertido_prev: r.invertido_prev?.toString() || '',
    retornado_prev: r.retornado_prev?.toString() || '',
    multiplicador_prev: r.multiplicador_prev?.toString() || '',
    delta_compras: r.delta_compras?.toString() || '',
    delta_roas: r.delta_roas?.toString() || '',
    nota_agencia: r.nota_agencia || '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (config?.roas_30d) {
      const r2 = config.roas_30d
      setForm({
        invertido: r2.invertido?.toString() || '',
        retornado: r2.retornado?.toString() || '',
        multiplicador: r2.multiplicador?.toString() || '',
        invertido_prev: r2.invertido_prev?.toString() || '',
        retornado_prev: r2.retornado_prev?.toString() || '',
        multiplicador_prev: r2.multiplicador_prev?.toString() || '',
        delta_compras: r2.delta_compras?.toString() || '',
        delta_roas: r2.delta_roas?.toString() || '',
        nota_agencia: r2.nota_agencia || '',
      })
    }
  }, [config])

  async function save() {
    setSaving(true)
    const payload: RoasHero = {
      invertido: Number(form.invertido) || 0,
      retornado: Number(form.retornado) || 0,
      multiplicador: Number(form.multiplicador) || 0,
      invertido_prev: form.invertido_prev ? Number(form.invertido_prev) : undefined,
      retornado_prev: form.retornado_prev ? Number(form.retornado_prev) : undefined,
      multiplicador_prev: form.multiplicador_prev ? Number(form.multiplicador_prev) : undefined,
      delta_compras: form.delta_compras ? Number(form.delta_compras) : undefined,
      delta_roas: form.delta_roas ? Number(form.delta_roas) : undefined,
      nota_agencia: form.nota_agencia || undefined,
    }
    await upsertConfig(cliente.id, config, { roas_30d: payload }, showToast)
    setSaving(false)
    onUpdate()
  }

  function autocalcular() {
    const inv = Number(form.invertido) || 0
    const ret = Number(form.retornado) || 0
    const mult = inv > 0 ? ret / inv : 0
    setForm(f => ({ ...f, multiplicador: mult.toFixed(2) }))
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <Card title="Hero de Inicio — Tu plata, últimos 30 días" desc="Lo primero que ve el cliente cuando entra. Sé directo y honesto.">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <Field label="Invertido"><input type="number" value={form.invertido} onChange={e => setForm({ ...form, invertido: e.target.value })} style={inputStyle} placeholder="650000" /></Field>
          <Field label="Retornado"><input type="number" value={form.retornado} onChange={e => setForm({ ...form, retornado: e.target.value })} style={inputStyle} placeholder="4225000" /></Field>
          <Field label="Multiplicador (ROAS)">
            <div style={{ display: 'flex', gap: 4 }}>
              <input type="number" step="0.1" value={form.multiplicador} onChange={e => setForm({ ...form, multiplicador: e.target.value })} style={{ ...inputStyle, flex: 1 }} placeholder="6.5" />
              <button onClick={autocalcular} style={btnGhost} title="Autocalcular"><i className="fas fa-calculator" /></button>
            </div>
          </Field>
        </div>
      </Card>
      <Card title="Comparativa vs mes pasado" desc="Para mostrar tendencia. Deltas en decimal: 0.34 = +34%, -0.31 = -31%">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <Field label="Invertido prev"><input type="number" value={form.invertido_prev} onChange={e => setForm({ ...form, invertido_prev: e.target.value })} style={inputStyle} /></Field>
          <Field label="Retornado prev"><input type="number" value={form.retornado_prev} onChange={e => setForm({ ...form, retornado_prev: e.target.value })} style={inputStyle} /></Field>
          <Field label="ROAS prev"><input type="number" step="0.1" value={form.multiplicador_prev} onChange={e => setForm({ ...form, multiplicador_prev: e.target.value })} style={inputStyle} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Delta compras (decimal)"><input type="number" step="0.01" value={form.delta_compras} onChange={e => setForm({ ...form, delta_compras: e.target.value })} style={inputStyle} placeholder="0.34" /></Field>
          <Field label="Delta ROAS (decimal)"><input type="number" step="0.01" value={form.delta_roas} onChange={e => setForm({ ...form, delta_roas: e.target.value })} style={inputStyle} placeholder="-0.31" /></Field>
        </div>
      </Card>
      <Card title="Nota del AM (opcional)" desc="Si el ROAS cae mucho, explicá por qué. Aparece como banner amarillo abajo del hero.">
        <textarea value={form.nota_agencia} onChange={e => setForm({ ...form, nota_agencia: e.target.value })} style={{ ...inputStyle, minHeight: 80, fontFamily: 'inherit' }} placeholder="El ROAS bajó porque metimos $60K más en testeo. En 10 días vuelve a subir." />
      </Card>
      <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar Hero'}</button>
    </div>
  )
}

// =============== SEMANA ===============
function SeccionSemana({ cliente, config, onUpdate, showToast }: { cliente: Cliente; config: ClientePortalConfig | null; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const [items, setItems] = useState<SemanaItem[]>(config?.semana_items || [])
  const [saving, setSaving] = useState(false)

  useEffect(() => { setItems(config?.semana_items || []) }, [config])

  function add() {
    setItems([...items, { dia: 'Lun', estado: 'todo', quien: 'agencia', icon: 'fa-circle', titulo: '', detalle: '' }])
  }
  function update(i: number, patch: Partial<SemanaItem>) {
    setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it))
  }
  function remove(i: number) {
    setItems(items.filter((_, idx) => idx !== i))
  }

  async function save() {
    setSaving(true)
    await upsertConfig(cliente.id, config, { semana_items: items }, showToast)
    setSaving(false); onUpdate()
  }

  return (
    <div>
      <Card title="Esta semana" desc="Qué hace el equipo cada día y qué le toca al cliente">
        {items.map((it, i) => (
          <div key={i} style={{ padding: 12, background: '#0e0e18', border: '1px solid #1a1a2e', borderRadius: 10, marginBottom: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '90px 110px 110px 1fr 40px', gap: 8, alignItems: 'center' }}>
              <input value={it.dia} onChange={e => update(i, { dia: e.target.value })} style={inputStyle} placeholder="Lun 20" />
              <select value={it.estado} onChange={e => update(i, { estado: e.target.value as any })} style={inputStyle}>
                <option value="done">Hecho</option>
                <option value="pending">Pendiente</option>
                <option value="todo">Por hacer</option>
              </select>
              <select value={it.quien} onChange={e => update(i, { quien: e.target.value as any })} style={inputStyle}>
                <option value="agencia">Agencia</option>
                <option value="cliente">Cliente</option>
              </select>
              <input value={it.icon} onChange={e => update(i, { icon: e.target.value })} style={inputStyle} placeholder="fa-video" />
              <button onClick={() => remove(i)} style={{ ...btnGhost, color: '#f5365c' }}><i className="fas fa-trash" /></button>
            </div>
            <input value={it.titulo} onChange={e => update(i, { titulo: e.target.value })} style={{ ...inputStyle, marginTop: 8 }} placeholder="Título" />
            <input value={it.detalle || ''} onChange={e => update(i, { detalle: e.target.value })} style={{ ...inputStyle, marginTop: 8 }} placeholder="Detalle" />
          </div>
        ))}
        <button onClick={add} style={btnGhost}><i className="fas fa-plus" /> Agregar día</button>
      </Card>
      <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar'}</button>
    </div>
  )
}

// =============== SALUD ===============
function SeccionSalud({ cliente, config, onUpdate, showToast }: { cliente: Cliente; config: ClientePortalConfig | null; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const [items, setItems] = useState<SaludItem[]>(config?.salud || [])
  const [saving, setSaving] = useState(false)

  useEffect(() => { setItems(config?.salud || []) }, [config])

  function add() { setItems([...items, { ok: true, label: '', detalle: '' }]) }
  function update(i: number, patch: Partial<SaludItem>) { setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it)) }
  function remove(i: number) { setItems(items.filter((_, idx) => idx !== i)) }

  async function save() {
    setSaving(true)
    await upsertConfig(cliente.id, config, { salud: items }, showToast)
    setSaving(false); onUpdate()
  }

  return (
    <div>
      <Card title="Salud técnica" desc="Pixel, catálogo, token, CRM... lo que le da tranquilidad al cliente">
        {items.map((it, i) => (
          <div key={i} style={{ padding: 12, background: '#0e0e18', border: '1px solid #1a1a2e', borderRadius: 10, marginBottom: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 40px', gap: 8 }}>
              <select value={it.ok === true ? 'ok' : it.ok === 'warn' ? 'warn' : 'bad'} onChange={e => update(i, { ok: e.target.value === 'ok' ? true : e.target.value === 'warn' ? 'warn' : false })} style={inputStyle}>
                <option value="ok">OK (verde)</option>
                <option value="warn">Warning (amarillo)</option>
                <option value="bad">Critico (rojo)</option>
              </select>
              <input value={it.label} onChange={e => update(i, { label: e.target.value })} style={inputStyle} placeholder="Pixel midiendo OK" />
              <button onClick={() => remove(i)} style={{ ...btnGhost, color: '#f5365c' }}><i className="fas fa-trash" /></button>
            </div>
            <input value={it.detalle || ''} onChange={e => update(i, { detalle: e.target.value })} style={{ ...inputStyle, marginTop: 8 }} placeholder="Detalle: Última conversión hace 12 min" />
          </div>
        ))}
        <button onClick={add} style={btnGhost}><i className="fas fa-plus" /> Agregar item</button>
      </Card>
      <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar'}</button>
    </div>
  )
}

// =============== ALERTAS ===============
function SeccionAlertas({ cliente, alertas, onUpdate, showToast }: { cliente: Cliente; alertas: ClienteAlerta[]; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const [creando, setCreando] = useState(false)
  const [form, setForm] = useState({ fecha: new Date().toISOString().split('T')[0], tone: 'ok' as 'ok' | 'warn' | 'bad' | 'info', texto: '' })

  async function crear() {
    if (!form.texto.trim()) return
    const { error } = await supabase.from('cliente_alertas').insert({ cliente_id: cliente.id, ...form })
    if (error) showToast('Error: ' + error.message, 'error'); else { showToast('Alerta creada', 'success'); setCreando(false); setForm({ fecha: new Date().toISOString().split('T')[0], tone: 'ok', texto: '' }); onUpdate() }
  }
  async function eliminar(id: number) { if (!confirm('Eliminar?')) return; await supabase.from('cliente_alertas').delete().eq('id', id); showToast('Eliminada', 'success'); onUpdate() }

  return (
    <div>
      {!creando ? <button onClick={() => setCreando(true)} style={{ ...btnPrimary, marginBottom: 16 }}><i className="fas fa-plus" /> Nueva novedad / alerta</button> : (
        <Card title="Nueva novedad" desc="Te avisamos antes de que preguntes">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Fecha"><input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} style={inputStyle} /></Field>
            <Field label="Tono"><select value={form.tone} onChange={e => setForm({ ...form, tone: e.target.value as any })} style={inputStyle}>
              <option value="ok">Buena (verde)</option>
              <option value="info">Info (azul)</option>
              <option value="warn">Warning (amarillo)</option>
              <option value="bad">Mala (rojo)</option>
            </select></Field>
          </div>
          <Field label="Texto"><textarea value={form.texto} onChange={e => setForm({ ...form, texto: e.target.value })} style={{ ...inputStyle, minHeight: 80, fontFamily: 'inherit' }} placeholder="Subimos el presupuesto de servicio técnico, está rindiendo 8x." /></Field>
          <div style={{ display: 'flex', gap: 8 }}><button onClick={crear} style={btnPrimary}>Crear</button><button onClick={() => setCreando(false)} style={btnGhost}>Cancelar</button></div>
        </Card>
      )}
      {alertas.length === 0 ? <Empty icon="fa-bell" text="Sin novedades" /> : alertas.map(a => {
        const c = a.tone === 'ok' ? '#00d97e' : a.tone === 'warn' ? '#f5a623' : a.tone === 'bad' ? '#f5365c' : '#5e72e4'
        return (
          <div key={a.id} style={{ display: 'flex', gap: 14, padding: 14, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 10, marginBottom: 8 }}>
            <div style={{ width: 80, fontSize: 11, color: '#6a6a80', fontFamily: 'monospace' }}>{new Date(a.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</div>
            <div style={{ width: 4, background: c, borderRadius: 2 }} />
            <div style={{ flex: 1, fontSize: 13 }}>{a.texto}</div>
            <button onClick={() => eliminar(a.id)} style={{ ...btnGhost, color: '#f5365c' }}><i className="fas fa-trash" /></button>
          </div>
        )
      })}
    </div>
  )
}

// =============== TOP CREATIVO ===============
function SeccionTopCreativo({ cliente, config, onUpdate, showToast }: { cliente: Cliente; config: ClientePortalConfig | null; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const tc = config?.top_creativo || ({ titulo: '', metricas: { vistas: 0, compras: 0, valor: 0, roas: 0, ctr: 0 } } as TopCreativo)
  const [form, setForm] = useState({
    titulo: tc.titulo || '',
    fecha_pub: tc.fecha_pub || '',
    funnel: (tc.funnel || 'tofu') as FunnelStage,
    angle: tc.angle || '',
    thumb_label: tc.thumb_label || '',
    vistas: tc.metricas?.vistas?.toString() || '',
    compras: tc.metricas?.compras?.toString() || '',
    valor: tc.metricas?.valor?.toString() || '',
    roas: tc.metricas?.roas?.toString() || '',
    ctr: tc.metricas?.ctr?.toString() || '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (config?.top_creativo) {
      const t2 = config.top_creativo
      setForm({
        titulo: t2.titulo || '',
        fecha_pub: t2.fecha_pub || '',
        funnel: (t2.funnel || 'tofu'),
        angle: t2.angle || '',
        thumb_label: t2.thumb_label || '',
        vistas: t2.metricas?.vistas?.toString() || '',
        compras: t2.metricas?.compras?.toString() || '',
        valor: t2.metricas?.valor?.toString() || '',
        roas: t2.metricas?.roas?.toString() || '',
        ctr: t2.metricas?.ctr?.toString() || '',
      })
    }
  }, [config])

  async function save() {
    setSaving(true)
    const payload: TopCreativo = {
      titulo: form.titulo,
      fecha_pub: form.fecha_pub || undefined,
      funnel: form.funnel,
      angle: form.angle || undefined,
      thumb_label: form.thumb_label || undefined,
      metricas: {
        vistas: Number(form.vistas) || 0,
        compras: Number(form.compras) || 0,
        valor: Number(form.valor) || 0,
        roas: Number(form.roas) || 0,
        ctr: Number(form.ctr) || 0,
      },
    }
    await upsertConfig(cliente.id, config, { top_creativo: payload }, showToast)
    setSaving(false); onUpdate()
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <Card title="Top Creativo del mes" desc="El reel/anuncio que más rindió. Aparece destacado en Pauta.">
        <Field label="Título"><input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} style={inputStyle} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <Field label="Fecha publicación"><input type="date" value={form.fecha_pub} onChange={e => setForm({ ...form, fecha_pub: e.target.value })} style={inputStyle} /></Field>
          <Field label="Funnel"><select value={form.funnel} onChange={e => setForm({ ...form, funnel: e.target.value as FunnelStage })} style={inputStyle}>
            <option value="tofu">TOFU</option><option value="mofu">MOFU</option><option value="bofu">BOFU</option>
          </select></Field>
          <Field label="Label thumbnail"><input value={form.thumb_label} onChange={e => setForm({ ...form, thumb_label: e.target.value })} style={inputStyle} placeholder="REEL — ACTOR EN LOCAL" /></Field>
        </div>
        <Field label="Por qué funcionó"><textarea value={form.angle} onChange={e => setForm({ ...form, angle: e.target.value })} style={{ ...inputStyle, minHeight: 60, fontFamily: 'inherit' }} placeholder="Pregunta directa que pone al cliente en el lugar del comprador real" /></Field>
      </Card>
      <Card title="Métricas del creativo" desc="">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          <Field label="Vistas"><input type="number" value={form.vistas} onChange={e => setForm({ ...form, vistas: e.target.value })} style={inputStyle} /></Field>
          <Field label="Compras"><input type="number" value={form.compras} onChange={e => setForm({ ...form, compras: e.target.value })} style={inputStyle} /></Field>
          <Field label="Valor"><input type="number" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} style={inputStyle} /></Field>
          <Field label="ROAS"><input type="number" step="0.1" value={form.roas} onChange={e => setForm({ ...form, roas: e.target.value })} style={inputStyle} /></Field>
          <Field label="CTR %"><input type="number" step="0.1" value={form.ctr} onChange={e => setForm({ ...form, ctr: e.target.value })} style={inputStyle} /></Field>
        </div>
      </Card>
      <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar Top Creativo'}</button>
    </div>
  )
}

// =============== KPIs 30d ===============
function SeccionKpis({ cliente, config, onUpdate, showToast }: { cliente: Cliente; config: ClientePortalConfig | null; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const [items, setItems] = useState<KpiItem[]>(config?.kpis_30d || [])
  const [saving, setSaving] = useState(false)

  useEffect(() => { setItems(config?.kpis_30d || []) }, [config])

  function add() { setItems([...items, { label: '', value: '', icon: 'fa-chart-line', delta: 0 }]) }
  function update(i: number, patch: Partial<KpiItem>) { setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it)) }
  function remove(i: number) { setItems(items.filter((_, idx) => idx !== i)) }

  async function save() {
    setSaving(true)
    await upsertConfig(cliente.id, config, { kpis_30d: items }, showToast)
    setSaving(false); onUpdate()
  }

  return (
    <div>
      <Card title="KPIs últimos 30 días" desc="Métricas con comparativa vs mes pasado (delta en decimal: 0.34 = +34%)">
        {items.map((it, i) => (
          <div key={i} style={{ padding: 12, background: '#0e0e18', border: '1px solid #1a1a2e', borderRadius: 10, marginBottom: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 90px 40px', gap: 8 }}>
              <input value={it.label} onChange={e => update(i, { label: e.target.value })} style={inputStyle} placeholder="Compras" />
              <input value={it.value} onChange={e => update(i, { value: e.target.value })} style={inputStyle} placeholder="187" />
              <input value={it.icon} onChange={e => update(i, { icon: e.target.value })} style={inputStyle} placeholder="fa-shopping-cart" />
              <input type="number" step="0.01" value={it.delta?.toString() || ''} onChange={e => update(i, { delta: Number(e.target.value) || 0 })} style={inputStyle} placeholder="0.34" />
              <button onClick={() => remove(i)} style={{ ...btnGhost, color: '#f5365c' }}><i className="fas fa-trash" /></button>
            </div>
          </div>
        ))}
        <button onClick={add} style={btnGhost}><i className="fas fa-plus" /> Agregar KPI</button>
      </Card>
      <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar'}</button>
    </div>
  )
}

// =============== RECURSOS + BENCHMARK ===============
function SeccionRecursosBench({ cliente, config, onUpdate, showToast }: { cliente: Cliente; config: ClientePortalConfig | null; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const r = config?.recursos || ({ reels: 0, historias: 0, anuncios: 0, fotos: 0 } as Recursos)
  const b = config?.benchmark || ({} as Benchmark)
  const [recursos, setRecursos] = useState({ reels: r.reels.toString(), historias: r.historias.toString(), anuncios: r.anuncios.toString(), fotos: r.fotos.toString() })
  const [bench, setBench] = useState({ ctrTu: b.ctr?.tu?.toString() || '', ctrProm: b.ctr?.promedio?.toString() || '', roasTu: b.roas?.tu?.toString() || '', roasProm: b.roas?.promedio?.toString() || '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (config) {
      const r2 = config.recursos || ({ reels: 0, historias: 0, anuncios: 0, fotos: 0 } as Recursos)
      const b2 = config.benchmark || ({} as Benchmark)
      setRecursos({ reels: r2.reels.toString(), historias: r2.historias.toString(), anuncios: r2.anuncios.toString(), fotos: r2.fotos.toString() })
      setBench({ ctrTu: b2.ctr?.tu?.toString() || '', ctrProm: b2.ctr?.promedio?.toString() || '', roasTu: b2.roas?.tu?.toString() || '', roasProm: b2.roas?.promedio?.toString() || '' })
    }
  }, [config])

  async function save() {
    setSaving(true)
    const recursosVal: Recursos = { reels: Number(recursos.reels) || 0, historias: Number(recursos.historias) || 0, anuncios: Number(recursos.anuncios) || 0, fotos: Number(recursos.fotos) || 0 }
    const benchVal: Benchmark = {}
    if (bench.ctrTu && bench.ctrProm) benchVal.ctr = { tu: Number(bench.ctrTu), promedio: Number(bench.ctrProm), label: 'CTR vs retail Argentina' }
    if (bench.roasTu && bench.roasProm) benchVal.roas = { tu: Number(bench.roasTu), promedio: Number(bench.roasProm), label: 'ROAS vs retail Argentina' }
    await upsertConfig(cliente.id, config, { recursos: recursosVal, benchmark: benchVal }, showToast)
    setSaving(false); onUpdate()
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <Card title="Recursos producidos" desc="Lo que vos produciste para el cliente. Aparece en Inicio.">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Reels"><input type="number" value={recursos.reels} onChange={e => setRecursos({ ...recursos, reels: e.target.value })} style={inputStyle} /></Field>
          <Field label="Historias"><input type="number" value={recursos.historias} onChange={e => setRecursos({ ...recursos, historias: e.target.value })} style={inputStyle} /></Field>
          <Field label="Anuncios"><input type="number" value={recursos.anuncios} onChange={e => setRecursos({ ...recursos, anuncios: e.target.value })} style={inputStyle} /></Field>
          <Field label="Fotos"><input type="number" value={recursos.fotos} onChange={e => setRecursos({ ...recursos, fotos: e.target.value })} style={inputStyle} /></Field>
        </div>
      </Card>
      <Card title="Benchmark de rubro" desc="Comparativa con el promedio del rubro. Aparece en Pauta.">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Tu CTR (%)"><input type="number" step="0.1" value={bench.ctrTu} onChange={e => setBench({ ...bench, ctrTu: e.target.value })} style={inputStyle} /></Field>
          <Field label="CTR promedio rubro (%)"><input type="number" step="0.1" value={bench.ctrProm} onChange={e => setBench({ ...bench, ctrProm: e.target.value })} style={inputStyle} /></Field>
          <Field label="Tu ROAS (x)"><input type="number" step="0.1" value={bench.roasTu} onChange={e => setBench({ ...bench, roasTu: e.target.value })} style={inputStyle} /></Field>
          <Field label="ROAS promedio rubro (x)"><input type="number" step="0.1" value={bench.roasProm} onChange={e => setBench({ ...bench, roasProm: e.target.value })} style={inputStyle} /></Field>
        </div>
      </Card>
      <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar'}</button>
    </div>
  )
}

// =============== ESTRATEGIA ===============
function SeccionEstrategia({ cliente, config, onUpdate, showToast }: { cliente: Cliente; config: ClientePortalConfig | null; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const [tesis, setTesis] = useState(config?.estrategia_tesis || config?.estrategia || '')
  const [tofu, setTofu] = useState<EstrategiaSeccion>(config?.estrategia_tofu || { que_hacemos: [], kpis: [] })
  const [mofu, setMofu] = useState<EstrategiaSeccion>(config?.estrategia_mofu || { que_hacemos: [], kpis: [] })
  const [bofu, setBofu] = useState<EstrategiaSeccion>(config?.estrategia_bofu || { que_hacemos: [], kpis: [] })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (config) {
      setTesis(config.estrategia_tesis || config.estrategia || '')
      setTofu(config.estrategia_tofu || { que_hacemos: [], kpis: [] })
      setMofu(config.estrategia_mofu || { que_hacemos: [], kpis: [] })
      setBofu(config.estrategia_bofu || { que_hacemos: [], kpis: [] })
    }
  }, [config])

  async function save() {
    setSaving(true)
    await upsertConfig(cliente.id, config, { estrategia_tesis: tesis, estrategia_tofu: tofu, estrategia_mofu: mofu, estrategia_bofu: bofu }, showToast)
    setSaving(false); onUpdate()
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <Card title="Tesis del trimestre" desc="El plan en 1-2 oraciones. Lo más importante.">
        <textarea value={tesis} onChange={e => setTesis(e.target.value)} style={{ ...inputStyle, minHeight: 100, fontFamily: 'inherit' }} placeholder="Bajar CPA de servicio técnico de $4.200 a < $2.500..." />
      </Card>
      <FunnelEditor stage="tofu" data={tofu} onChange={setTofu} />
      <FunnelEditor stage="mofu" data={mofu} onChange={setMofu} />
      <FunnelEditor stage="bofu" data={bofu} onChange={setBofu} />
      <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar Estrategia'}</button>
    </div>
  )
}

function FunnelEditor({ stage, data, onChange }: { stage: FunnelStage; data: EstrategiaSeccion; onChange: (d: EstrategiaSeccion) => void }) {
  const labels: Record<FunnelStage, { label: string; color: string; desc: string }> = {
    tofu: { label: 'TOFU · Awareness', color: '#00D4FF', desc: 'Atrae gente nueva' },
    mofu: { label: 'MOFU · Consideración', color: '#6E5BFF', desc: 'Educa y enamora' },
    bofu: { label: 'BOFU · Conversión', color: '#00D97E', desc: 'Cierra la venta' },
  }
  const info = labels[stage]
  const [nuevoQue, setNuevoQue] = useState('')
  const [nuevoKpi, setNuevoKpi] = useState('')

  return (
    <Card title={info.label} desc={info.desc}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#a0a0b8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Qué hacemos</div>
        {data.que_hacemos.map((it, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            <input value={it} onChange={e => onChange({ ...data, que_hacemos: data.que_hacemos.map((x, idx) => idx === i ? e.target.value : x) })} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => onChange({ ...data, que_hacemos: data.que_hacemos.filter((_, idx) => idx !== i) })} style={{ ...btnGhost, color: '#f5365c' }}><i className="fas fa-times" /></button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <input value={nuevoQue} onChange={e => setNuevoQue(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Reels testimoniales..." />
          <button onClick={() => { if (nuevoQue.trim()) { onChange({ ...data, que_hacemos: [...data.que_hacemos, nuevoQue.trim()] }); setNuevoQue('') } }} style={btnGhost}><i className="fas fa-plus" /> Agregar</button>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, color: '#a0a0b8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Qué medimos (KPIs)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          {data.kpis.map((it, i) => (
            <span key={i} style={{ padding: '4px 10px', background: '#0a0a14', border: '1px solid #2a2a40', borderRadius: 8, fontSize: 11, fontWeight: 600, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              {it}
              <button onClick={() => onChange({ ...data, kpis: data.kpis.filter((_, idx) => idx !== i) })} style={{ background: 'none', border: 'none', color: '#f5365c', cursor: 'pointer', padding: 0 }}><i className="fas fa-times" style={{ fontSize: 10 }} /></button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={nuevoKpi} onChange={e => setNuevoKpi(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="CTR > 2.5%" />
          <button onClick={() => { if (nuevoKpi.trim()) { onChange({ ...data, kpis: [...data.kpis, nuevoKpi.trim()] }); setNuevoKpi('') } }} style={btnGhost}><i className="fas fa-plus" /> Agregar</button>
        </div>
      </div>
    </Card>
  )
}

// =============== APROBACIONES ===============
function SeccionAprobaciones({ cliente, aprobaciones, onUpdate, showToast }: { cliente: Cliente; aprobaciones: ClienteAprobacion[]; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<ClienteAprobacion | null>(null)
  const blank = { tipo: 'reel', titulo: '', descripcion: '', url_preview: '', funnel: 'tofu' as FunnelStage, dur: '', texto_guion: '' }
  const [form, setForm] = useState(blank)

  async function crear() {
    if (!form.titulo.trim()) { showToast('Falta título', 'error'); return }
    const { error } = await supabase.from('cliente_aprobaciones').insert({
      cliente_id: cliente.id, tipo: form.tipo, titulo: form.titulo, descripcion: form.descripcion || null,
      url_preview: form.url_preview || null, estado: 'pendiente', funnel: form.funnel, dur: form.dur || null,
      texto_guion: form.texto_guion || null,
    })
    if (error) showToast('Error: ' + error.message, 'error'); else { showToast('Subida', 'success'); setCreando(false); setForm(blank); onUpdate() }
  }

  async function actualizar() {
    if (!editando) return
    const { error } = await supabase.from('cliente_aprobaciones').update({
      tipo: form.tipo, titulo: form.titulo, descripcion: form.descripcion || null,
      url_preview: form.url_preview || null, funnel: form.funnel, dur: form.dur || null,
      texto_guion: form.texto_guion || null, updated_at: new Date().toISOString(),
    }).eq('id', editando.id)
    if (error) showToast('Error: ' + error.message, 'error'); else { showToast('Actualizada', 'success'); setEditando(null); setForm(blank); onUpdate() }
  }

  function abrirEdit(a: ClienteAprobacion) {
    setEditando(a)
    setForm({
      tipo: a.tipo, titulo: a.titulo, descripcion: a.descripcion || '', url_preview: a.url_preview || '',
      funnel: a.funnel || 'tofu', dur: a.dur || '', texto_guion: a.texto_guion || '',
    })
    setCreando(false)
  }

  async function eliminar(id: number) { if (!confirm('Eliminar?')) return; await supabase.from('cliente_aprobaciones').delete().eq('id', id); showToast('Eliminada', 'success'); onUpdate() }

  const formActivo = creando || editando !== null

  return (
    <div>
      {!formActivo ? (
        <button onClick={() => { setCreando(true); setForm(blank) }} style={{ ...btnPrimary, marginBottom: 16 }}><i className="fas fa-plus" /> Subir aprobación</button>
      ) : (
        <Card title={editando ? 'Editar aprobación' : 'Nueva aprobación'} desc="">
          <div style={{ display: 'grid', gridTemplateColumns: '180px 180px 100px 1fr', gap: 10 }}>
            <Field label="Tipo">
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} style={inputStyle}>
                <option value="reel">Reel</option><option value="historia">Historia</option><option value="carrousel">Carrousel</option><option value="anuncio">Anuncio</option><option value="guion">Guion</option>
              </select>
            </Field>
            <Field label="Funnel">
              <select value={form.funnel} onChange={e => setForm({ ...form, funnel: e.target.value as FunnelStage })} style={inputStyle}>
                <option value="tofu">TOFU</option><option value="mofu">MOFU</option><option value="bofu">BOFU</option>
              </select>
            </Field>
            <Field label="Duración"><input value={form.dur} onChange={e => setForm({ ...form, dur: e.target.value })} style={inputStyle} placeholder="35s" /></Field>
            <Field label="Título"><input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} style={inputStyle} /></Field>
          </div>
          <Field label="Descripción"><textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} style={{ ...inputStyle, minHeight: 60, fontFamily: 'inherit' }} /></Field>
          <Field label="URL del video (Drive / YouTube / Vimeo / mp4 directo)">
            <input value={form.url_preview} onChange={e => setForm({ ...form, url_preview: e.target.value })} style={inputStyle} placeholder="https://drive.google.com/file/d/..." />
            <div style={{ fontSize: 10, color: '#6a6a80', marginTop: 4 }}>Soportamos Drive (con preview), YouTube, Vimeo, y .mp4/.webm directos.</div>
          </Field>
          {form.tipo === 'guion' && (
            <Field label="Texto del guion (lo que el cliente lee al hacer click)">
              <textarea value={form.texto_guion} onChange={e => setForm({ ...form, texto_guion: e.target.value })} style={{ ...inputStyle, minHeight: 200, fontFamily: 'monospace', fontSize: 12 }} placeholder="[ESCENA 1 — 0:00-0:08]&#10;PLANO: ..." />
            </Field>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={editando ? actualizar : crear} style={btnPrimary}>{editando ? 'Guardar cambios' : 'Subir'}</button>
            <button onClick={() => { setCreando(false); setEditando(null); setForm(blank) }} style={btnGhost}>Cancelar</button>
          </div>
        </Card>
      )}

      {aprobaciones.length === 0 ? <Empty icon="fa-inbox" text="Sin aprobaciones" /> : aprobaciones.map(a => {
        const c = a.estado === 'aprobado' ? '#00d97e' : a.estado === 'cambios_solicitados' ? '#f5a623' : '#5e72e4'
        const fc = a.funnel === 'tofu' ? '#00D4FF' : a.funnel === 'mofu' ? '#6E5BFF' : a.funnel === 'bofu' ? '#00D97E' : '#6a6a80'
        return (
          <div key={a.id} style={{ padding: 14, background: '#14142a', border: `1px solid ${a.estado === 'cambios_solicitados' && !a.visto_por_agencia ? '#f5a62355' : '#1a1a2e'}`, borderRadius: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, padding: '2px 8px', background: '#0a0a14', borderRadius: 8, color: '#a0a0b8', textTransform: 'uppercase', fontWeight: 600 }}>{a.tipo}</span>
                  {a.funnel && <span style={{ fontSize: 10, padding: '2px 8px', background: fc + '22', color: fc, borderRadius: 8, fontWeight: 700, textTransform: 'uppercase' }}>{a.funnel}</span>}
                  {a.dur && <span style={{ fontSize: 10, color: '#6a6a80' }}>{a.dur}</span>}
                  <span style={{ fontSize: 10, padding: '2px 8px', background: `${c}22`, color: c, borderRadius: 8, fontWeight: 600, textTransform: 'uppercase' }}>{a.estado.replace('_', ' ')}</span>
                  {!a.visto_por_agencia && a.estado === 'cambios_solicitados' && <span style={{ fontSize: 10, color: '#f5365c', fontWeight: 700 }}>NUEVO</span>}
                </div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{a.titulo}</div>
                {a.descripcion && <div style={{ fontSize: 12, color: '#a0a0b8', marginTop: 2 }}>{a.descripcion}</div>}
                {a.comentario_cliente && (
                  <div style={{ marginTop: 8, padding: 10, background: '#f5a62315', borderLeft: '3px solid #f5a623', borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: '#f5a623', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Comentario del cliente</div>
                    <div style={{ fontSize: 13 }}>{a.comentario_cliente}</div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {a.url_preview && <a href={a.url_preview} target="_blank" rel="noreferrer" style={btnGhost}><i className="fas fa-external-link-alt" /></a>}
                <button onClick={() => abrirEdit(a)} style={btnGhost}><i className="fas fa-pen" /></button>
                <button onClick={() => eliminar(a.id)} style={{ ...btnGhost, color: '#f5365c', borderColor: '#f5365c44' }}><i className="fas fa-trash" /></button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// =============== OBJETIVOS ===============
function SeccionObjetivos({ cliente, objetivos, onUpdate, showToast }: { cliente: Cliente; objetivos: ClienteObjetivo[]; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const [creando, setCreando] = useState(false)
  const [edId, setEdId] = useState<number | null>(null)
  const blank = { titulo: '', descripcion: '', area: '', meta: '', actual: '', por_que: '', progreso: '0' }
  const [form, setForm] = useState(blank)

  async function crear() {
    if (!form.titulo.trim()) return
    const { error } = await supabase.from('cliente_objetivos').insert({
      cliente_id: cliente.id, titulo: form.titulo, descripcion: form.descripcion || null, estado: 'activo',
      fecha_inicio: new Date().toISOString().split('T')[0],
      area: form.area || null, meta: form.meta || null, actual: form.actual || null, por_que: form.por_que || null,
      progreso: form.progreso ? Number(form.progreso) : null,
    })
    if (error) showToast('Error: ' + error.message, 'error'); else { showToast('Creado', 'success'); setCreando(false); setForm(blank); onUpdate() }
  }
  async function guardarEdit() {
    if (edId === null) return
    const { error } = await supabase.from('cliente_objetivos').update({
      titulo: form.titulo, descripcion: form.descripcion || null,
      area: form.area || null, meta: form.meta || null, actual: form.actual || null, por_que: form.por_que || null,
      progreso: form.progreso ? Number(form.progreso) : null,
    }).eq('id', edId)
    if (error) showToast('Error: ' + error.message, 'error'); else { showToast('Actualizado', 'success'); setEdId(null); setForm(blank); onUpdate() }
  }
  function abrirEdit(o: ClienteObjetivo) {
    setEdId(o.id); setCreando(false)
    setForm({ titulo: o.titulo, descripcion: o.descripcion || '', area: o.area || '', meta: o.meta || '', actual: o.actual || '', por_que: o.por_que || '', progreso: (o.progreso ?? 0).toString() })
  }
  async function marcarLogrado(id: number) {
    const r = prompt('Resultado del objetivo (texto que verá el cliente):')
    if (!r) return
    await supabase.from('cliente_objetivos').update({ estado: 'logrado', fecha_logrado: new Date().toISOString().split('T')[0], resultado: r, progreso: 100 }).eq('id', id)
    showToast('Marcado como logrado', 'success'); onUpdate()
  }
  async function eliminar(id: number) { if (!confirm('Eliminar?')) return; await supabase.from('cliente_objetivos').delete().eq('id', id); showToast('Eliminado', 'success'); onUpdate() }

  const formActivo = creando || edId !== null

  return (
    <div>
      {!formActivo ? <button onClick={() => { setCreando(true); setForm(blank) }} style={{ ...btnPrimary, marginBottom: 16 }}><i className="fas fa-plus" /> Nuevo objetivo</button> : (
        <Card title={edId ? 'Editar objetivo' : 'Nuevo objetivo'} desc="">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Área"><input value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} style={inputStyle} placeholder="Servicio Tecnico" /></Field>
            <Field label="Progreso (%)"><input type="number" min="0" max="100" value={form.progreso} onChange={e => setForm({ ...form, progreso: e.target.value })} style={inputStyle} /></Field>
          </div>
          <Field label="Título"><input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} style={inputStyle} placeholder="Aumentar leads calificados" /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Actual"><input value={form.actual} onChange={e => setForm({ ...form, actual: e.target.value })} style={inputStyle} placeholder="112" /></Field>
            <Field label="Meta"><input value={form.meta} onChange={e => setForm({ ...form, meta: e.target.value })} style={inputStyle} placeholder="160" /></Field>
          </div>
          <Field label="Por qué importa (lo verá el cliente)">
            <textarea value={form.por_que} onChange={e => setForm({ ...form, por_que: e.target.value })} style={{ ...inputStyle, minHeight: 70, fontFamily: 'inherit' }} />
          </Field>
          <div style={{ display: 'flex', gap: 8 }}><button onClick={edId ? guardarEdit : crear} style={btnPrimary}>{edId ? 'Guardar' : 'Crear'}</button><button onClick={() => { setCreando(false); setEdId(null); setForm(blank) }} style={btnGhost}>Cancelar</button></div>
        </Card>
      )}

      {objetivos.length === 0 ? <Empty icon="fa-bullseye" text="Sin objetivos" /> : objetivos.map(o => (
        <div key={o.id} style={{ padding: 14, background: '#14142a', border: `1px solid ${o.estado === 'logrado' ? '#00d97e30' : '#1a1a2e'}`, borderRadius: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
            <div style={{ flex: 1 }}>
              {o.area && <div style={{ fontSize: 10, color: '#6a6a80', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{o.area}</div>}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                <i className={o.estado === 'logrado' ? 'fas fa-check-circle' : 'fas fa-bullseye'} style={{ color: o.estado === 'logrado' ? '#00d97e' : '#5e72e4' }} />
                <span style={{ fontWeight: 600 }}>{o.titulo}</span>
                {o.progreso !== null && o.progreso !== undefined && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#a0a0b8' }}>{o.progreso}%</span>}
              </div>
              {(o.actual || o.meta) && <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 4 }}>{o.actual || '-'} / {o.meta || '-'}</div>}
              {o.por_que && <div style={{ fontSize: 12, color: '#a0a0b8', marginTop: 6 }}>{o.por_que}</div>}
              {o.resultado && <div style={{ marginTop: 8, padding: 8, background: '#0a0a14', borderRadius: 6, fontSize: 12 }}><span style={{ color: '#00d97e', fontWeight: 600 }}>Resultado:</span> {o.resultado}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={() => abrirEdit(o)} style={btnGhost}><i className="fas fa-pen" /></button>
              {o.estado === 'activo' && <button onClick={() => marcarLogrado(o.id)} style={{ ...btnGhost, color: '#00d97e', borderColor: '#00d97e44' }}><i className="fas fa-trophy" /></button>}
              <button onClick={() => eliminar(o.id)} style={{ ...btnGhost, color: '#f5365c', borderColor: '#f5365c44' }}><i className="fas fa-trash" /></button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// =============== CALENDARIO ===============
function SeccionCalendario({ cliente, calendario, onUpdate, showToast }: { cliente: Cliente; calendario: ClienteCalendario[]; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const [creando, setCreando] = useState(false)
  const blank = { fecha: new Date().toISOString().split('T')[0], tipo: 'reel', titulo: '', descripcion: '', estado: 'programado', url: '', funnel: 'tofu' as FunnelStage }
  const [form, setForm] = useState(blank)

  async function crear() {
    if (!form.titulo.trim()) return
    const { error } = await supabase.from('cliente_calendario').insert({
      cliente_id: cliente.id, ...form, descripcion: form.descripcion || null, url: form.url || null,
    })
    if (error) showToast('Error: ' + error.message, 'error'); else { showToast('Agregado', 'success'); setCreando(false); setForm(blank); onUpdate() }
  }
  async function setEstado(id: number, estado: string) { await supabase.from('cliente_calendario').update({ estado }).eq('id', id); onUpdate() }
  async function setFunnel(id: number, funnel: FunnelStage) { await supabase.from('cliente_calendario').update({ funnel }).eq('id', id); onUpdate() }
  async function eliminar(id: number) { if (!confirm('Eliminar?')) return; await supabase.from('cliente_calendario').delete().eq('id', id); showToast('Eliminado', 'success'); onUpdate() }

  return (
    <div>
      {!creando ? <button onClick={() => setCreando(true)} style={{ ...btnPrimary, marginBottom: 16 }}><i className="fas fa-plus" /> Agregar publicación</button> : (
        <Card title="Nueva publicación" desc="">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Field label="Fecha"><input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} style={inputStyle} /></Field>
            <Field label="Tipo"><select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} style={inputStyle}>
              <option value="reel">Reel</option><option value="historia">Historia</option><option value="carrousel">Carrousel</option><option value="anuncio">Anuncio</option><option value="post">Post</option>
            </select></Field>
            <Field label="Funnel"><select value={form.funnel} onChange={e => setForm({ ...form, funnel: e.target.value as FunnelStage })} style={inputStyle}>
              <option value="tofu">TOFU</option><option value="mofu">MOFU</option><option value="bofu">BOFU</option>
            </select></Field>
          </div>
          <Field label="Título"><input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} style={inputStyle} /></Field>
          <div style={{ display: 'flex', gap: 8 }}><button onClick={crear} style={btnPrimary}>Agregar</button><button onClick={() => setCreando(false)} style={btnGhost}>Cancelar</button></div>
        </Card>
      )}

      {calendario.length === 0 ? <Empty icon="fa-calendar-times" text="Sin publicaciones" /> : calendario.map(c => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 10, marginBottom: 8 }}>
          <div style={{ width: 50, padding: 8, background: '#0a0a14', borderRadius: 8, textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: '#6a6a80', textTransform: 'uppercase' }}>{new Date(c.fecha).toLocaleDateString('es-AR', { month: 'short' })}</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{new Date(c.fecha).getDate()}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: '#a0a0b8', textTransform: 'uppercase', fontWeight: 600 }}>{c.tipo}</div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{c.titulo}</div>
          </div>
          <select value={c.funnel || 'tofu'} onChange={e => setFunnel(c.id, e.target.value as FunnelStage)} style={{ ...inputStyle, width: 80 }}>
            <option value="tofu">TOFU</option><option value="mofu">MOFU</option><option value="bofu">BOFU</option>
          </select>
          <select value={c.estado} onChange={e => setEstado(c.id, e.target.value)} style={{ ...inputStyle, width: 130 }}>
            <option value="programado">Programado</option><option value="publicado">Publicado</option><option value="cancelado">Cancelado</option>
          </select>
          <button onClick={() => eliminar(c.id)} style={{ ...btnGhost, color: '#f5365c' }}><i className="fas fa-trash" /></button>
        </div>
      ))}
    </div>
  )
}

// =============== ACCESOS ===============
function SeccionAccesos({ cliente, accesos, onUpdate, showToast }: { cliente: Cliente; accesos: ClienteAcceso[]; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const [creando, setCreando] = useState(false)
  const blank = { tipo: 'meta', plataforma: 'Meta Business', cuenta: '', estado: 'conectado', color: '#1877F2', icon: 'fa-meta', url: '', notas: '' }
  const [form, setForm] = useState(blank)

  const PRESETS: Record<string, Partial<typeof blank>> = {
    meta: { tipo: 'meta', plataforma: 'Meta Business', icon: 'fa-meta', color: '#1877F2' },
    instagram: { tipo: 'instagram', plataforma: 'Instagram', icon: 'fa-instagram', color: '#E1306C' },
    whatsapp: { tipo: 'whatsapp', plataforma: 'WhatsApp Business', icon: 'fa-whatsapp', color: '#25D366' },
    google_ads: { tipo: 'google_ads', plataforma: 'Google Ads', icon: 'fa-google', color: '#4285F4' },
    tiktok: { tipo: 'tiktok', plataforma: 'TikTok', icon: 'fa-tiktok', color: '#000000' },
    crm: { tipo: 'crm', plataforma: 'CRM', icon: 'fa-address-book', color: '#FF7A59' },
    drive: { tipo: 'drive', plataforma: 'Google Drive', icon: 'fa-google-drive', color: '#1FA463' },
    web: { tipo: 'web', plataforma: 'Sitio web', icon: 'fa-globe', color: '#5e72e4' },
  }

  async function crear() {
    if (!form.plataforma.trim()) return
    const { error } = await supabase.from('cliente_accesos').insert({
      cliente_id: cliente.id, tipo: form.tipo, nombre: form.plataforma, plataforma: form.plataforma,
      cuenta: form.cuenta || null, estado: form.estado, color: form.color, icon: form.icon,
      url: form.url || null, usuario: form.cuenta || null, notas: form.notas || null,
    })
    if (error) showToast('Error: ' + error.message, 'error'); else { showToast('Agregado', 'success'); setCreando(false); setForm(blank); onUpdate() }
  }
  async function setEstado(id: number, estado: string) { await supabase.from('cliente_accesos').update({ estado }).eq('id', id); onUpdate() }
  async function eliminar(id: number) { if (!confirm('Eliminar?')) return; await supabase.from('cliente_accesos').delete().eq('id', id); showToast('Eliminado', 'success'); onUpdate() }

  return (
    <div>
      {!creando ? <button onClick={() => setCreando(true)} style={{ ...btnPrimary, marginBottom: 16 }}><i className="fas fa-plus" /> Agregar acceso</button> : (
        <Card title="Nuevo acceso" desc="">
          <Field label="Plataforma (preset)">
            <select value={form.tipo} onChange={e => { const p = PRESETS[e.target.value]; if (p) setForm({ ...form, ...p } as any) }} style={inputStyle}>
              {Object.entries(PRESETS).map(([k, v]) => <option key={k} value={k}>{v.plataforma}</option>)}
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Nombre/Plataforma"><input value={form.plataforma} onChange={e => setForm({ ...form, plataforma: e.target.value })} style={inputStyle} /></Field>
            <Field label="Cuenta/usuario"><input value={form.cuenta} onChange={e => setForm({ ...form, cuenta: e.target.value })} style={inputStyle} placeholder="aircloud@meta" /></Field>
          </div>
          <Field label="URL"><input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} style={inputStyle} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px', gap: 10 }}>
            <Field label="Estado"><select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} style={inputStyle}>
              <option value="conectado">Conectado</option><option value="desconectado">Desconectado</option>
            </select></Field>
            <Field label="Icon (FA)"><input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} style={inputStyle} /></Field>
            <Field label="Color"><input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} style={{ ...inputStyle, padding: 4, height: 36 }} /></Field>
          </div>
          <Field label="Notas"><input value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} style={inputStyle} /></Field>
          <div style={{ display: 'flex', gap: 8 }}><button onClick={crear} style={btnPrimary}>Agregar</button><button onClick={() => setCreando(false)} style={btnGhost}>Cancelar</button></div>
        </Card>
      )}

      {accesos.length === 0 ? <Empty icon="fa-link" text="Sin accesos" /> : accesos.map(a => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 10, marginBottom: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: a.color || '#5e72e4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className={`${(a.icon || '').includes('-') ? 'fab' : 'fas'} ${a.icon || 'fa-link'}`} style={{ color: 'white' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{a.plataforma || a.nombre}</div>
            <div style={{ fontSize: 11, color: '#a0a0b8', fontFamily: 'monospace' }}>{a.cuenta || a.usuario || '—'}</div>
          </div>
          <select value={a.estado || 'conectado'} onChange={e => setEstado(a.id, e.target.value)} style={{ ...inputStyle, width: 130 }}>
            <option value="conectado">Conectado</option><option value="desconectado">Desconectado</option>
          </select>
          <button onClick={() => eliminar(a.id)} style={{ ...btnGhost, color: '#f5365c' }}><i className="fas fa-trash" /></button>
        </div>
      ))}
    </div>
  )
}

// =============== PAGOS ===============
function SeccionPagos({ cliente, pagos, onUpdate, showToast }: { cliente: Cliente; pagos: ClientePago[]; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const [creando, setCreando] = useState(false)
  const blank = { fecha: new Date().toISOString().split('T')[0], monto: '', moneda: 'ARS', concepto: 'Servicio mensual', estado: 'pendiente', metodo: '', factura: '' }
  const [form, setForm] = useState(blank)

  async function crear() {
    if (!form.monto) return
    const { error } = await supabase.from('cliente_pagos').insert({
      cliente_id: cliente.id, fecha: form.fecha, monto: Number(form.monto), moneda: form.moneda,
      concepto: form.concepto, estado: form.estado, metodo: form.metodo || null, factura: form.factura || null,
    })
    if (error) showToast('Error: ' + error.message, 'error'); else { showToast('Registrado', 'success'); setCreando(false); setForm(blank); onUpdate() }
  }
  async function setEstado(id: number, estado: string) { await supabase.from('cliente_pagos').update({ estado }).eq('id', id); onUpdate() }
  async function setFactura(id: number, factura: string) { await supabase.from('cliente_pagos').update({ factura }).eq('id', id); onUpdate() }
  async function eliminar(id: number) { if (!confirm('Eliminar?')) return; await supabase.from('cliente_pagos').delete().eq('id', id); showToast('Eliminado', 'success'); onUpdate() }

  return (
    <div>
      {!creando ? <button onClick={() => setCreando(true)} style={{ ...btnPrimary, marginBottom: 16 }}><i className="fas fa-plus" /> Registrar pago</button> : (
        <Card title="Nuevo pago" desc="">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: 10 }}>
            <Field label="Fecha"><input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} style={inputStyle} /></Field>
            <Field label="Monto"><input type="number" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} style={inputStyle} /></Field>
            <Field label="Moneda"><select value={form.moneda} onChange={e => setForm({ ...form, moneda: e.target.value })} style={inputStyle}><option>ARS</option><option>USD</option></select></Field>
          </div>
          <Field label="Concepto"><input value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })} style={inputStyle} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Field label="Estado"><select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} style={inputStyle}>
              <option value="pendiente">Pendiente</option><option value="pagado">Pagado</option><option value="vencido">Vencido</option>
            </select></Field>
            <Field label="Método"><input value={form.metodo} onChange={e => setForm({ ...form, metodo: e.target.value })} style={inputStyle} placeholder="transferencia" /></Field>
            <Field label="Factura N°"><input value={form.factura} onChange={e => setForm({ ...form, factura: e.target.value })} style={inputStyle} placeholder="A-0001-00187" /></Field>
          </div>
          <div style={{ display: 'flex', gap: 8 }}><button onClick={crear} style={btnPrimary}>Registrar</button><button onClick={() => setCreando(false)} style={btnGhost}>Cancelar</button></div>
        </Card>
      )}

      {pagos.length === 0 ? <Empty icon="fa-credit-card" text="Sin pagos" /> : pagos.map(p => {
        const ec = p.estado === 'pagado' ? '#00d97e' : p.estado === 'vencido' ? '#f5365c' : '#f5a623'
        return (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 10, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{p.concepto || 'Pago'}</div>
              <div style={{ fontSize: 11, color: '#6a6a80' }}>{new Date(p.fecha).toLocaleDateString('es-AR')}{p.metodo && ` · ${p.metodo}`}</div>
            </div>
            <input value={p.factura || ''} onChange={e => setFactura(p.id, e.target.value)} placeholder="Factura N°" style={{ ...inputStyle, width: 140, fontSize: 11 }} />
            <div style={{ fontWeight: 700, fontSize: 13, minWidth: 90, textAlign: 'right' }}>{p.moneda} ${Number(p.monto).toLocaleString('es-AR')}</div>
            <select value={p.estado} onChange={e => setEstado(p.id, e.target.value)} style={{ ...inputStyle, width: 110, color: ec }}>
              <option value="pendiente">Pendiente</option><option value="pagado">Pagado</option><option value="vencido">Vencido</option>
            </select>
            <button onClick={() => eliminar(p.id)} style={{ ...btnGhost, color: '#f5365c' }}><i className="fas fa-trash" /></button>
          </div>
        )
      })}
    </div>
  )
}

// =============== SUGERENCIAS ===============
function SeccionSugerencias({ sugerencias, onUpdate, showToast }: { sugerencias: ClienteSugerencia[]; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const [respondiendo, setRespondiendo] = useState<number | null>(null)
  const [respuesta, setRespuesta] = useState('')

  async function responder(id: number, estado: string) {
    await supabase.from('cliente_sugerencias').update({ estado, respuesta_agencia: respuesta || null, visto_por_agencia: true }).eq('id', id)
    setRespondiendo(null); setRespuesta(''); showToast('Respuesta enviada', 'success'); onUpdate()
  }
  async function marcarVisto(id: number) { await supabase.from('cliente_sugerencias').update({ visto_por_agencia: true }).eq('id', id); onUpdate() }

  return (
    <div>
      {sugerencias.length === 0 ? <Empty icon="fa-lightbulb" text="El cliente no envió sugerencias todavía" /> : sugerencias.map(s => {
        const c = s.estado === 'implementada' ? '#00d97e' : s.estado === 'descartada' ? '#6a6a80' : s.estado === 'en_revision' ? '#f5a623' : '#5e72e4'
        return (
          <div key={s.id} style={{ padding: 16, background: '#14142a', border: `1px solid ${!s.visto_por_agencia ? '#5e72e455' : '#1a1a2e'}`, borderRadius: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#6a6a80' }}>{new Date(s.created_at).toLocaleDateString('es-AR')}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {!s.visto_por_agencia && <span style={{ fontSize: 10, color: '#5e72e4', fontWeight: 700 }}>NUEVO</span>}
                <span style={{ padding: '2px 10px', background: `${c}22`, color: c, borderRadius: 12, fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>{s.estado.replace('_', ' ')}</span>
              </div>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 10 }}>{s.texto}</div>
            {s.respuesta_agencia && <div style={{ padding: 10, background: '#0a0a14', borderLeft: '3px solid #5e72e4', borderRadius: 6, fontSize: 13, marginBottom: 10 }}><strong style={{ color: '#5e72e4' }}>Tu respuesta:</strong> {s.respuesta_agencia}</div>}
            {respondiendo === s.id ? (
              <div>
                <textarea value={respuesta} onChange={e => setRespuesta(e.target.value)} placeholder="Tu respuesta..." style={{ ...inputStyle, minHeight: 60, fontFamily: 'inherit' }} />
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => responder(s.id, 'en_revision')} style={{ ...btnGhost, color: '#f5a623', borderColor: '#f5a62355' }}>En revisión</button>
                  <button onClick={() => responder(s.id, 'implementada')} style={{ ...btnGhost, color: '#00d97e', borderColor: '#00d97e55' }}>Implementada</button>
                  <button onClick={() => responder(s.id, 'descartada')} style={{ ...btnGhost, color: '#6a6a80' }}>Descartar</button>
                  <button onClick={() => setRespondiendo(null)} style={btnGhost}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { setRespondiendo(s.id); setRespuesta(s.respuesta_agencia || '') }} style={btnGhost}><i className="fas fa-reply" /> Responder</button>
                {!s.visto_por_agencia && <button onClick={() => marcarVisto(s.id)} style={btnGhost}><i className="fas fa-eye" /> Marcar visto</button>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// =============== DECISIONES ===============
function SeccionDecisiones({ cliente, decisiones, onUpdate, showToast }: { cliente: Cliente; decisiones: ClienteDecision[]; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const [creando, setCreando] = useState(false)
  const blank = { fecha: new Date().toISOString().split('T')[0], titulo: '', razon: '' }
  const [form, setForm] = useState(blank)

  async function crear() {
    if (!form.titulo.trim()) return
    const { error } = await supabase.from('cliente_decisiones').insert({ cliente_id: cliente.id, ...form })
    if (error) showToast('Error: ' + error.message, 'error'); else { showToast('Creado', 'success'); setCreando(false); setForm(blank); onUpdate() }
  }
  async function eliminar(id: number) { if (!confirm('Eliminar?')) return; await supabase.from('cliente_decisiones').delete().eq('id', id); showToast('Eliminado', 'success'); onUpdate() }

  return (
    <div>
      {!creando ? <button onClick={() => setCreando(true)} style={{ ...btnPrimary, marginBottom: 16 }}><i className="fas fa-plus" /> Nueva decisión</button> : (
        <Card title="Nueva decisión estratégica" desc="Para que el cliente entienda qué decisiones tomamos y por qué">
          <Field label="Fecha"><input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} style={inputStyle} /></Field>
          <Field label="Título"><input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} style={inputStyle} placeholder="Pausamos historias para enfocar en reels" /></Field>
          <Field label="Razón"><textarea value={form.razon} onChange={e => setForm({ ...form, razon: e.target.value })} style={{ ...inputStyle, minHeight: 80, fontFamily: 'inherit' }} /></Field>
          <div style={{ display: 'flex', gap: 8 }}><button onClick={crear} style={btnPrimary}>Crear</button><button onClick={() => setCreando(false)} style={btnGhost}>Cancelar</button></div>
        </Card>
      )}
      {decisiones.length === 0 ? <Empty icon="fa-lightbulb" text="Sin decisiones cargadas" /> : decisiones.map(d => (
        <div key={d.id} style={{ padding: 14, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 10, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#6a6a80', fontFamily: 'monospace', marginBottom: 4 }}>{new Date(d.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.titulo}</div>
              {d.razon && <div style={{ fontSize: 13, color: '#a0a0b8', lineHeight: 1.5 }}>{d.razon}</div>}
            </div>
            <button onClick={() => eliminar(d.id)} style={{ ...btnGhost, color: '#f5365c' }}><i className="fas fa-trash" /></button>
          </div>
        </div>
      ))}
    </div>
  )
}

// =============== ROADMAP ===============
function SeccionRoadmap({ cliente, roadmap, onUpdate, showToast }: { cliente: Cliente; roadmap: ClienteRoadmap[]; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const [creando, setCreando] = useState(false)
  const blank = { mes: '', hito: '', descripcion: '', orden: 0 }
  const [form, setForm] = useState(blank)

  async function crear() {
    if (!form.hito.trim() || !form.mes.trim()) return
    const { error } = await supabase.from('cliente_roadmap').insert({ cliente_id: cliente.id, ...form })
    if (error) showToast('Error: ' + error.message, 'error'); else { showToast('Creado', 'success'); setCreando(false); setForm(blank); onUpdate() }
  }
  async function eliminar(id: number) { if (!confirm('Eliminar?')) return; await supabase.from('cliente_roadmap').delete().eq('id', id); showToast('Eliminado', 'success'); onUpdate() }

  // Agrupar por mes
  const grupos = roadmap.reduce((acc, r) => { (acc[r.mes] = acc[r.mes] || []).push(r); return acc }, {} as Record<string, ClienteRoadmap[]>)

  return (
    <div>
      {!creando ? <button onClick={() => setCreando(true)} style={{ ...btnPrimary, marginBottom: 16 }}><i className="fas fa-plus" /> Nuevo hito del roadmap</button> : (
        <Card title="Nuevo hito" desc="">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10 }}>
            <Field label="Mes"><input value={form.mes} onChange={e => setForm({ ...form, mes: e.target.value })} style={inputStyle} placeholder="Mayo 2026" /></Field>
            <Field label="Orden"><input type="number" value={form.orden} onChange={e => setForm({ ...form, orden: Number(e.target.value) })} style={inputStyle} /></Field>
          </div>
          <Field label="Hito"><input value={form.hito} onChange={e => setForm({ ...form, hito: e.target.value })} style={inputStyle} /></Field>
          <Field label="Descripción"><input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} style={inputStyle} /></Field>
          <div style={{ display: 'flex', gap: 8 }}><button onClick={crear} style={btnPrimary}>Crear</button><button onClick={() => setCreando(false)} style={btnGhost}>Cancelar</button></div>
        </Card>
      )}

      {Object.keys(grupos).length === 0 ? <Empty icon="fa-route" text="Sin roadmap" /> : Object.entries(grupos).map(([mes, items]) => (
        <Card key={mes} title={mes} desc="">
          {items.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: 10, background: '#0e0e18', border: '1px solid #1a1a2e', borderRadius: 8, marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{r.hito}</div>
                {r.descripcion && <div style={{ fontSize: 12, color: '#a0a0b8', marginTop: 2 }}>{r.descripcion}</div>}
              </div>
              <button onClick={() => eliminar(r.id)} style={{ ...btnGhost, color: '#f5365c' }}><i className="fas fa-trash" /></button>
            </div>
          ))}
        </Card>
      ))}
    </div>
  )
}

// =============== NOTIFICACIONES ===============
function SeccionNotificaciones({ cliente, notificaciones, onUpdate, showToast }: { cliente: Cliente; notificaciones: ClienteNotificacion[]; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const [creando, setCreando] = useState(false)
  const blank = { icon: 'fa-bell', texto: '', cuando: 'Hace 1h' }
  const [form, setForm] = useState(blank)

  async function crear() {
    if (!form.texto.trim()) return
    const { error } = await supabase.from('cliente_notificaciones').insert({ cliente_id: cliente.id, ...form, leida: false })
    if (error) showToast('Error: ' + error.message, 'error'); else { showToast('Creada', 'success'); setCreando(false); setForm(blank); onUpdate() }
  }
  async function eliminar(id: number) { if (!confirm('Eliminar?')) return; await supabase.from('cliente_notificaciones').delete().eq('id', id); showToast('Eliminada', 'success'); onUpdate() }

  return (
    <div>
      {!creando ? <button onClick={() => setCreando(true)} style={{ ...btnPrimary, marginBottom: 16 }}><i className="fas fa-plus" /> Nueva notificación</button> : (
        <Card title="Nueva notificación" desc="Aparece en el dropdown del header del cliente">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 10 }}>
            <Field label="Icon (Font Awesome)"><input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} style={inputStyle} placeholder="fa-circle-check" /></Field>
            <Field label="Cuándo (texto)"><input value={form.cuando} onChange={e => setForm({ ...form, cuando: e.target.value })} style={inputStyle} placeholder="Hace 2h" /></Field>
          </div>
          <Field label="Texto"><input value={form.texto} onChange={e => setForm({ ...form, texto: e.target.value })} style={inputStyle} placeholder="3 piezas nuevas esperando tu aprobación" /></Field>
          <div style={{ display: 'flex', gap: 8 }}><button onClick={crear} style={btnPrimary}>Crear</button><button onClick={() => setCreando(false)} style={btnGhost}>Cancelar</button></div>
        </Card>
      )}
      {notificaciones.length === 0 ? <Empty icon="fa-bell-slash" text="Sin notificaciones" /> : notificaciones.map(n => (
        <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 10, marginBottom: 8 }}>
          <i className={`fas ${n.icon || 'fa-bell'}`} style={{ color: '#5e72e4' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13 }}>{n.texto}</div>
            {n.cuando && <div style={{ fontSize: 10, color: '#6a6a80' }}>{n.cuando}</div>}
          </div>
          {!n.leida && <span style={{ fontSize: 9, padding: '2px 7px', background: '#5e72e4', color: 'white', borderRadius: 8, fontWeight: 700 }}>NO LEÍDA</span>}
          <button onClick={() => eliminar(n.id)} style={{ ...btnGhost, color: '#f5365c' }}><i className="fas fa-trash" /></button>
        </div>
      ))}
    </div>
  )
}

// =============== LOGO UPLOADER ===============
function LogoUploader({ clienteId, value, onChange, showToast }: { clienteId: number; value: string; onChange: (url: string) => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const [uploading, setUploading] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) { showToast('Solo imágenes', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { showToast('Máximo 5MB', 'error'); return }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const path = `cliente-${clienteId}/logo-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('client-logos').upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('client-logos').getPublicUrl(path)
      onChange(pub.publicUrl); showToast('Logo subido', 'success')
    } catch (e: any) { showToast('Error: ' + (e.message || ''), 'error') }
    finally { setUploading(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 100, height: 100, flexShrink: 0, background: '#0a0a14', border: '1px solid #2a2a40', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {value ? <img src={value} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <i className="fas fa-image" style={{ fontSize: 28, color: '#3a3a55' }} />}
        </div>
        <div style={{ flex: 1 }}>
          <label
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f) }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '18px 14px', minHeight: 100, background: '#0a0a14', border: '2px dashed #2a2a40', borderRadius: 12, cursor: uploading ? 'wait' : 'pointer', gap: 6 }}
          >
            <input type="file" accept="image/*" disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} style={{ display: 'none' }} />
            {uploading ? <><i className="fas fa-spinner fa-spin" style={{ fontSize: 22, color: '#5e72e4' }} /><span style={{ fontSize: 12 }}>Subiendo...</span></> : <><i className="fas fa-cloud-upload-alt" style={{ fontSize: 22, color: '#5e72e4' }} /><span style={{ fontSize: 13, fontWeight: 600 }}>Subir o arrastrar</span><span style={{ fontSize: 10, color: '#6a6a80' }}>PNG/JPG/SVG · max 5MB</span></>}
          </label>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {value && <button onClick={() => onChange('')} style={{ ...btnGhost, fontSize: 11, color: '#f5365c', borderColor: '#f5365c44' }}><i className="fas fa-times" /> Quitar</button>}
        <button onClick={() => setShowUrlInput(!showUrlInput)} style={{ ...btnGhost, fontSize: 11 }}><i className="fas fa-link" /> {showUrlInput ? 'Ocultar' : 'Pegar URL'}</button>
      </div>
      {showUrlInput && <input value={value} onChange={e => onChange(e.target.value)} placeholder="https://..." style={{ ...inputStyle, marginTop: 8 }} />}
    </div>
  )
}

// =============== HELPERS ===============
async function upsertConfig(clienteId: number, config: ClientePortalConfig | null, patch: Partial<ClientePortalConfig>, showToast: (m: string, t: 'success' | 'error') => void) {
  const payload: any = { ...patch, updated_at: new Date().toISOString() }
  if (config) {
    const { error } = await supabase.from('cliente_portal_config').update(payload).eq('id', config.id)
    if (error) showToast('Error: ' + error.message, 'error'); else showToast('Guardado', 'success')
  } else {
    const { error } = await supabase.from('cliente_portal_config').insert({ cliente_id: clienteId, ...payload })
    if (error) showToast('Error: ' + error.message, 'error'); else showToast('Creado', 'success')
  }
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', background: '#0a0a14', border: '1px solid #2a2a40', borderRadius: 8, color: '#e8e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
const btnPrimary: React.CSSProperties = { padding: '10px 18px', background: 'linear-gradient(135deg, #5e72e4, #8965e0)', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnGhost: React.CSSProperties = { padding: '8px 12px', background: 'transparent', border: '1px solid #2a2a40', borderRadius: 8, color: '#a0a0b8', fontSize: 12, cursor: 'pointer' }

function Card({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 18, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 12, marginBottom: 16 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
        {desc && <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 2 }}>{desc}</div>}
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#a0a0b8', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
      {children}
    </div>
  )
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return <div style={{ padding: 30, textAlign: 'center', color: '#6a6a80', background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 10 }}><i className={`fas ${icon}`} style={{ fontSize: 28, color: '#3a3a55', marginBottom: 8 }} /><div style={{ fontSize: 13 }}>{text}</div></div>
}

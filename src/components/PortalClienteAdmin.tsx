'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, type Cliente, type ClientePortalAcceso, type ClientePortalConfig, type ClienteAprobacion, type ClienteObjetivo, type ClienteCalendario, type ClienteAcceso, type ClientePago, type ClienteSugerencia } from '@/lib/supabase'

type Section = 'acceso' | 'branding' | 'aprobaciones' | 'objetivos' | 'calendario' | 'accesos' | 'pagos' | 'sugerencias'
const NAV: { id: Section; label: string; icon: string }[] = [
  { id: 'acceso', label: 'Acceso', icon: 'fa-key' },
  { id: 'branding', label: 'Branding y Servicio', icon: 'fa-palette' },
  { id: 'aprobaciones', label: 'Aprobaciones', icon: 'fa-check-double' },
  { id: 'objetivos', label: 'Objetivos', icon: 'fa-bullseye' },
  { id: 'calendario', label: 'Calendario', icon: 'fa-calendar-alt' },
  { id: 'accesos', label: 'Accesos del cliente', icon: 'fa-link' },
  { id: 'pagos', label: 'Pagos', icon: 'fa-credit-card' },
  { id: 'sugerencias', label: 'Sugerencias', icon: 'fa-lightbulb' },
]

type Props = { cliente: Cliente; onClose: () => void; showToast: (msg: string, type: 'success' | 'error') => void }

export default function PortalClienteAdmin({ cliente, onClose, showToast }: Props) {
  const [section, setSection] = useState<Section>('acceso')
  const [loading, setLoading] = useState(true)
  const [acceso, setAcceso] = useState<ClientePortalAcceso | null>(null)
  const [config, setConfig] = useState<ClientePortalConfig | null>(null)
  const [aprobaciones, setAprobaciones] = useState<ClienteAprobacion[]>([])
  const [objetivos, setObjetivos] = useState<ClienteObjetivo[]>([])
  const [calendario, setCalendario] = useState<ClienteCalendario[]>([])
  const [accesos, setAccesos] = useState<ClienteAcceso[]>([])
  const [pagos, setPagos] = useState<ClientePago[]>([])
  const [sugerencias, setSugerencias] = useState<ClienteSugerencia[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [acc, conf, apr, obj, cal, accs, pag, sug] = await Promise.all([
      supabase.from('cliente_portal_acceso').select('*').eq('cliente_id', cliente.id).maybeSingle(),
      supabase.from('cliente_portal_config').select('*').eq('cliente_id', cliente.id).maybeSingle(),
      supabase.from('cliente_aprobaciones').select('*').eq('cliente_id', cliente.id).order('created_at', { ascending: false }),
      supabase.from('cliente_objetivos').select('*').eq('cliente_id', cliente.id).order('created_at', { ascending: false }),
      supabase.from('cliente_calendario').select('*').eq('cliente_id', cliente.id).order('fecha'),
      supabase.from('cliente_accesos').select('*').eq('cliente_id', cliente.id).order('created_at'),
      supabase.from('cliente_pagos').select('*').eq('cliente_id', cliente.id).order('fecha', { ascending: false }),
      supabase.from('cliente_sugerencias').select('*').eq('cliente_id', cliente.id).order('created_at', { ascending: false }),
    ])
    setAcceso(acc.data || null)
    setConfig(conf.data || null)
    setAprobaciones(apr.data || [])
    setObjetivos(obj.data || [])
    setCalendario(cal.data || [])
    setAccesos(accs.data || [])
    setPagos(pag.data || [])
    setSugerencias(sug.data || [])
    setLoading(false)
  }, [cliente.id])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex' }}>
      <div style={{ width: 240, background: '#0e0e18', borderRight: '1px solid #1a1a2e', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #1a1a2e' }}>
          <div style={{ fontSize: 11, color: '#6a6a80', textTransform: 'uppercase', letterSpacing: 0.5 }}>Portal de</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{cliente.nombre}</div>
        </div>
        <nav style={{ flex: 1, padding: 10, overflowY: 'auto' }}>
          {NAV.map(item => {
            const active = section === item.id
            const badge = item.id === 'sugerencias' ? sugerencias.filter(s => !s.visto_por_agencia).length
              : item.id === 'aprobaciones' ? aprobaciones.filter(a => a.estado === 'cambios_solicitados' && !a.visto_por_agencia).length : 0
            return (
              <button key={item.id} onClick={() => setSection(item.id)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', marginBottom: 2,
                background: active ? '#5e72e422' : 'transparent',
                border: active ? '1px solid #5e72e455' : '1px solid transparent',
                borderRadius: 8, color: active ? '#5e72e4' : '#a0a0b8',
                fontSize: 13, fontWeight: active ? 600 : 500,
                cursor: 'pointer', textAlign: 'left',
              }}>
                <i className={`fas ${item.icon}`} style={{ width: 16 }} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {badge > 0 && <span style={{ background: '#f5365c', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 8 }}>{badge}</span>}
              </button>
            )
          })}
        </nav>
        <button onClick={onClose} style={{ margin: 14, padding: '10px', background: 'transparent', border: '1px solid #2a2a40', borderRadius: 8, color: '#a0a0b8', cursor: 'pointer', fontSize: 12 }}>
          <i className="fas fa-times" style={{ marginRight: 6 }} /> Cerrar
        </button>
      </div>

      <div style={{ flex: 1, background: '#0a0a14', overflowY: 'auto' }}>
        <div style={{ padding: '20px 28px', borderBottom: '1px solid #1a1a2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#0a0a14', zIndex: 10 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{NAV.find(n => n.id === section)?.label}</h2>
            <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 2 }}>Configuracion del portal</div>
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
              {section === 'aprobaciones' && <SeccionAprobaciones cliente={cliente} aprobaciones={aprobaciones} onUpdate={load} showToast={showToast} />}
              {section === 'objetivos' && <SeccionObjetivos cliente={cliente} objetivos={objetivos} onUpdate={load} showToast={showToast} />}
              {section === 'calendario' && <SeccionCalendario cliente={cliente} calendario={calendario} onUpdate={load} showToast={showToast} />}
              {section === 'accesos' && <SeccionAccesos cliente={cliente} accesos={accesos} onUpdate={load} showToast={showToast} />}
              {section === 'pagos' && <SeccionPagos cliente={cliente} pagos={pagos} onUpdate={load} showToast={showToast} />}
              {section === 'sugerencias' && <SeccionSugerencias sugerencias={sugerencias} onUpdate={load} showToast={showToast} />}
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
      if (error) showToast('Error: ' + error.message, 'error')
      else { showToast('Acceso actualizado', 'success'); onUpdate() }
    } else {
      const { error } = await supabase.from('cliente_portal_acceso').insert({ cliente_id: cliente.id, slug: slug.trim().toLowerCase(), username: username.trim(), password, activo })
      if (error) showToast('Error: ' + error.message, 'error')
      else { showToast('Acceso creado', 'success'); onUpdate() }
    }
    setSaving(false)
  }

  function genPwd() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let p = ''
    for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)]
    setPassword(p)
  }

  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/portal/login?slug=${slug}` : `/portal/login?slug=${slug}`

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    showToast(`${label} copiado`, 'success')
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <Card title="Credenciales de acceso" desc="Estos son los datos que el cliente usa para entrar a su portal">
        <Field label="Slug (URL)">
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} style={inputStyle} />
          </div>
          <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 4 }}>URL: <code style={{ color: '#5e72e4' }}>/portal/{slug}</code></div>
        </Field>
        <Field label="Usuario"><input value={username} onChange={e => setUsername(e.target.value)} style={inputStyle} /></Field>
        <Field label="Contraseña">
          <div style={{ display: 'flex', gap: 6 }}>
            <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => setShowPwd(!showPwd)} style={btnGhost} title={showPwd ? 'Ocultar' : 'Mostrar'}><i className={`fas ${showPwd ? 'fa-eye-slash' : 'fa-eye'}`} /></button>
            <button onClick={genPwd} style={btnGhost} title="Generar"><i className="fas fa-dice" /></button>
          </div>
        </Field>
        <Field label="Estado"><label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} /> <span style={{ fontSize: 13 }}>Acceso activo</span></label></Field>
        <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Guardando...' : (acceso ? 'Actualizar acceso' : 'Crear acceso')}</button>
      </Card>

      {acceso && (
        <Card title="Compartir con el cliente" desc="Envia esta info para que pueda ingresar">
          <div style={{ padding: 14, background: '#0a0a14', borderRadius: 10, fontSize: 13, lineHeight: 1.8, fontFamily: 'monospace' }}>
            <div><span style={{ color: '#6a6a80' }}>URL:</span> {portalUrl}</div>
            <div><span style={{ color: '#6a6a80' }}>Usuario:</span> {username}</div>
            <div><span style={{ color: '#6a6a80' }}>Contraseña:</span> {showPwd ? password : '••••••••'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button onClick={() => copy(portalUrl, 'URL')} style={btnGhost}><i className="fas fa-copy" /> URL</button>
            <button onClick={() => copy(username, 'Usuario')} style={btnGhost}><i className="fas fa-copy" /> Usuario</button>
            <button onClick={() => copy(password, 'Contraseña')} style={btnGhost}><i className="fas fa-copy" /> Contraseña</button>
            <button onClick={() => copy(`Hola! Te dejo los accesos a tu portal:\n\nURL: ${portalUrl}\nUsuario: ${username}\nContraseña: ${password}`, 'Mensaje completo')} style={{ ...btnGhost, background: '#5e72e422', color: '#5e72e4', border: '1px solid #5e72e455' }}><i className="fas fa-paper-plane" /> Copiar mensaje completo</button>
          </div>
          {acceso.last_login && <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 12 }}><i className="fas fa-clock" style={{ marginRight: 5 }} /> Ultimo ingreso: {new Date(acceso.last_login).toLocaleString('es-AR')}</div>}
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
    estrategia: config?.estrategia || '',
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
      estrategia: config.estrategia || '',
      fecha_inicio_servicio: config.fecha_inicio_servicio || '',
      monto_mensual: config.monto_mensual?.toString() || '',
      moneda: config.moneda || 'ARS',
      dia_pago: config.dia_pago?.toString() || '',
    })
  }, [config, cliente.nombre])

  async function save() {
    setSaving(true)
    const payload = {
      cliente_id: cliente.id,
      nombre_interfaz: form.nombre_interfaz || null,
      logo_url: form.logo_url || null,
      color_primario: form.color_primario || '#5e72e4',
      bienvenida: form.bienvenida || null,
      estrategia: form.estrategia || null,
      fecha_inicio_servicio: form.fecha_inicio_servicio || null,
      monto_mensual: form.monto_mensual ? Number(form.monto_mensual) : null,
      moneda: form.moneda || 'ARS',
      dia_pago: form.dia_pago ? Number(form.dia_pago) : null,
      updated_at: new Date().toISOString(),
    }
    if (config) {
      const { error } = await supabase.from('cliente_portal_config').update(payload).eq('id', config.id)
      if (error) showToast('Error: ' + error.message, 'error'); else { showToast('Configuracion guardada', 'success'); onUpdate() }
    } else {
      const { error } = await supabase.from('cliente_portal_config').insert(payload)
      if (error) showToast('Error: ' + error.message, 'error'); else { showToast('Configuracion creada', 'success'); onUpdate() }
    }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <Card title="Branding del portal" desc="Como se ve el portal para tu cliente">
        <Field label="Nombre de la interfaz"><input value={form.nombre_interfaz} onChange={e => setForm({ ...form, nombre_interfaz: e.target.value })} style={inputStyle} placeholder={`Portal ${cliente.nombre}`} /></Field>
        <Field label="Logo URL (opcional)"><input value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} style={inputStyle} placeholder="https://..." /></Field>
        <Field label="Color primario">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={form.color_primario} onChange={e => setForm({ ...form, color_primario: e.target.value })} style={{ width: 50, height: 38, border: '1px solid #2a2a40', borderRadius: 8, cursor: 'pointer', background: 'transparent' }} />
            <input value={form.color_primario} onChange={e => setForm({ ...form, color_primario: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          </div>
        </Field>
        <Field label="Mensaje de bienvenida"><textarea value={form.bienvenida} onChange={e => setForm({ ...form, bienvenida: e.target.value })} style={{ ...inputStyle, minHeight: 70, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Hola equipo! Aca van a poder ver..." /></Field>
      </Card>

      <Card title="Servicio" desc="Datos del contrato que el cliente ve en su portal">
        <Field label="Fecha inicio del servicio"><input type="date" value={form.fecha_inicio_servicio} onChange={e => setForm({ ...form, fecha_inicio_servicio: e.target.value })} style={inputStyle} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px', gap: 10 }}>
          <Field label="Monto mensual"><input type="number" value={form.monto_mensual} onChange={e => setForm({ ...form, monto_mensual: e.target.value })} style={inputStyle} placeholder="650000" /></Field>
          <Field label="Moneda">
            <select value={form.moneda} onChange={e => setForm({ ...form, moneda: e.target.value })} style={inputStyle}>
              <option value="ARS">ARS</option><option value="USD">USD</option>
            </select>
          </Field>
          <Field label="Dia pago"><input type="number" min="1" max="31" value={form.dia_pago} onChange={e => setForm({ ...form, dia_pago: e.target.value })} style={inputStyle} placeholder="10" /></Field>
        </div>
      </Card>

      <Card title="Estrategia" desc="Plan estrategico que mostras al cliente">
        <textarea value={form.estrategia} onChange={e => setForm({ ...form, estrategia: e.target.value })} style={{ ...inputStyle, minHeight: 140, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Optimizar ADS 4 pilares..." />
      </Card>

      <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Guardando...' : 'Guardar configuracion'}</button>
    </div>
  )
}

// =============== APROBACIONES ===============
function SeccionAprobaciones({ cliente, aprobaciones, onUpdate, showToast }: { cliente: Cliente; aprobaciones: ClienteAprobacion[]; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const [creando, setCreando] = useState(false)
  const [form, setForm] = useState({ tipo: 'reel', titulo: '', descripcion: '', url_preview: '' })

  async function crear() {
    if (!form.titulo.trim()) { showToast('Falta titulo', 'error'); return }
    const { error } = await supabase.from('cliente_aprobaciones').insert({
      cliente_id: cliente.id, tipo: form.tipo, titulo: form.titulo, descripcion: form.descripcion || null, url_preview: form.url_preview || null, estado: 'pendiente',
    })
    if (error) showToast('Error: ' + error.message, 'error')
    else { showToast('Aprobacion creada', 'success'); setCreando(false); setForm({ tipo: 'reel', titulo: '', descripcion: '', url_preview: '' }); onUpdate() }
  }

  async function eliminar(id: number) {
    if (!confirm('Eliminar esta aprobacion?')) return
    await supabase.from('cliente_aprobaciones').delete().eq('id', id)
    showToast('Eliminada', 'success'); onUpdate()
  }

  async function marcarVisto(id: number) {
    await supabase.from('cliente_aprobaciones').update({ visto_por_agencia: true }).eq('id', id)
    onUpdate()
  }

  return (
    <div>
      {!creando ? (
        <button onClick={() => setCreando(true)} style={{ ...btnPrimary, marginBottom: 16 }}><i className="fas fa-plus" /> Subir nueva aprobacion</button>
      ) : (
        <Card title="Nueva aprobacion" desc="">
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 10 }}>
            <Field label="Tipo">
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} style={inputStyle}>
                <option value="reel">Reel</option><option value="historia">Historia</option><option value="carrousel">Carrousel</option><option value="anuncio">Anuncio</option><option value="guion">Guion</option>
              </select>
            </Field>
            <Field label="Titulo"><input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} style={inputStyle} /></Field>
          </div>
          <Field label="Descripcion"><textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} style={{ ...inputStyle, minHeight: 60, fontFamily: 'inherit' }} /></Field>
          <Field label="URL preview (Drive, Vimeo, etc.)"><input value={form.url_preview} onChange={e => setForm({ ...form, url_preview: e.target.value })} style={inputStyle} placeholder="https://drive.google.com/..." /></Field>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={crear} style={btnPrimary}>Subir</button>
            <button onClick={() => setCreando(false)} style={btnGhost}>Cancelar</button>
          </div>
        </Card>
      )}

      {aprobaciones.length === 0 ? <Empty icon="fa-inbox" text="Sin aprobaciones cargadas" /> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {aprobaciones.map(a => {
            const colorEstado = a.estado === 'aprobado' ? '#00d97e' : a.estado === 'cambios_solicitados' ? '#f5a623' : '#5e72e4'
            return (
              <div key={a.id} style={{ padding: 14, background: '#14142a', border: `1px solid ${a.estado === 'cambios_solicitados' && !a.visto_por_agencia ? '#f5a62355' : '#1a1a2e'}`, borderRadius: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', background: '#0a0a14', borderRadius: 8, color: '#a0a0b8', textTransform: 'uppercase', fontWeight: 600 }}>{a.tipo}</span>
                      <span style={{ fontSize: 10, padding: '2px 8px', background: `${colorEstado}22`, color: colorEstado, borderRadius: 8, fontWeight: 600, textTransform: 'uppercase' }}>{a.estado.replace('_', ' ')}</span>
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
                    {!a.visto_por_agencia && a.estado === 'cambios_solicitados' && <button onClick={() => marcarVisto(a.id)} style={btnGhost}><i className="fas fa-eye" /> Visto</button>}
                    <button onClick={() => eliminar(a.id)} style={{ ...btnGhost, color: '#f5365c', borderColor: '#f5365c44' }}><i className="fas fa-trash" /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// =============== OBJETIVOS ===============
function SeccionObjetivos({ cliente, objetivos, onUpdate, showToast }: { cliente: Cliente; objetivos: ClienteObjetivo[]; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const [creando, setCreando] = useState(false)
  const [form, setForm] = useState({ titulo: '', descripcion: '' })
  const [logrando, setLogrando] = useState<number | null>(null)
  const [resultado, setResultado] = useState('')

  async function crear() {
    if (!form.titulo.trim()) return
    const { error } = await supabase.from('cliente_objetivos').insert({ cliente_id: cliente.id, titulo: form.titulo, descripcion: form.descripcion || null, estado: 'activo', fecha_inicio: new Date().toISOString().split('T')[0] })
    if (error) showToast('Error: ' + error.message, 'error')
    else { showToast('Objetivo creado', 'success'); setCreando(false); setForm({ titulo: '', descripcion: '' }); onUpdate() }
  }

  async function marcarLogrado(id: number) {
    if (!resultado.trim()) { showToast('Agrega un resultado', 'error'); return }
    await supabase.from('cliente_objetivos').update({ estado: 'logrado', fecha_logrado: new Date().toISOString().split('T')[0], resultado }).eq('id', id)
    setLogrando(null); setResultado(''); showToast('Marcado como logrado', 'success'); onUpdate()
  }

  async function eliminar(id: number) {
    if (!confirm('Eliminar objetivo?')) return
    await supabase.from('cliente_objetivos').delete().eq('id', id); showToast('Eliminado', 'success'); onUpdate()
  }

  return (
    <div>
      {!creando ? (
        <button onClick={() => setCreando(true)} style={{ ...btnPrimary, marginBottom: 16 }}><i className="fas fa-plus" /> Nuevo objetivo</button>
      ) : (
        <Card title="Nuevo objetivo" desc="">
          <Field label="Titulo"><input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} style={inputStyle} placeholder="Aumentar leads calificados" /></Field>
          <Field label="Descripcion"><textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} style={{ ...inputStyle, minHeight: 70, fontFamily: 'inherit' }} /></Field>
          <div style={{ display: 'flex', gap: 8 }}><button onClick={crear} style={btnPrimary}>Crear</button><button onClick={() => setCreando(false)} style={btnGhost}>Cancelar</button></div>
        </Card>
      )}

      {objetivos.length === 0 ? <Empty icon="fa-bullseye" text="Sin objetivos" /> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {objetivos.map(o => (
            <div key={o.id} style={{ padding: 14, background: '#14142a', border: `1px solid ${o.estado === 'logrado' ? '#00d97e30' : '#1a1a2e'}`, borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <i className={o.estado === 'logrado' ? 'fas fa-check-circle' : 'fas fa-bullseye'} style={{ color: o.estado === 'logrado' ? '#00d97e' : '#5e72e4' }} />
                  <span style={{ fontWeight: 600 }}>{o.titulo}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {o.estado === 'activo' && <button onClick={() => { setLogrando(o.id); setResultado('') }} style={{ ...btnGhost, color: '#00d97e', borderColor: '#00d97e44' }}><i className="fas fa-trophy" /> Logrado</button>}
                  <button onClick={() => eliminar(o.id)} style={{ ...btnGhost, color: '#f5365c', borderColor: '#f5365c44' }}><i className="fas fa-trash" /></button>
                </div>
              </div>
              {o.descripcion && <div style={{ fontSize: 12, color: '#a0a0b8' }}>{o.descripcion}</div>}
              {o.resultado && <div style={{ marginTop: 8, padding: 10, background: '#0a0a14', borderRadius: 6, fontSize: 12 }}><span style={{ color: '#00d97e', fontWeight: 600 }}>Resultado:</span> {o.resultado}</div>}
              {logrando === o.id && (
                <div style={{ marginTop: 10 }}>
                  <textarea value={resultado} onChange={e => setResultado(e.target.value)} placeholder="Que se logro? (ej: CTR alcanzo 3.4% en marzo)" style={{ ...inputStyle, minHeight: 60, fontFamily: 'inherit' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => marcarLogrado(o.id)} style={{ ...btnPrimary, background: '#00d97e' }}>Confirmar logro</button>
                    <button onClick={() => setLogrando(null)} style={btnGhost}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// =============== CALENDARIO ===============
function SeccionCalendario({ cliente, calendario, onUpdate, showToast }: { cliente: Cliente; calendario: ClienteCalendario[]; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const [creando, setCreando] = useState(false)
  const [form, setForm] = useState({ fecha: new Date().toISOString().split('T')[0], tipo: 'reel', titulo: '', descripcion: '', estado: 'programado', url: '' })

  async function crear() {
    if (!form.titulo.trim()) return
    const { error } = await supabase.from('cliente_calendario').insert({ cliente_id: cliente.id, ...form, descripcion: form.descripcion || null, url: form.url || null })
    if (error) showToast('Error: ' + error.message, 'error')
    else { showToast('Publicacion agregada', 'success'); setCreando(false); setForm({ fecha: new Date().toISOString().split('T')[0], tipo: 'reel', titulo: '', descripcion: '', estado: 'programado', url: '' }); onUpdate() }
  }

  async function setEstado(id: number, estado: string) {
    await supabase.from('cliente_calendario').update({ estado }).eq('id', id); onUpdate()
  }

  async function eliminar(id: number) {
    if (!confirm('Eliminar?')) return
    await supabase.from('cliente_calendario').delete().eq('id', id); showToast('Eliminado', 'success'); onUpdate()
  }

  return (
    <div>
      {!creando ? <button onClick={() => setCreando(true)} style={{ ...btnPrimary, marginBottom: 16 }}><i className="fas fa-plus" /> Agregar publicacion</button> : (
        <Card title="Nueva publicacion" desc="">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Fecha"><input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} style={inputStyle} /></Field>
            <Field label="Tipo">
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} style={inputStyle}>
                <option value="reel">Reel</option><option value="historia">Historia</option><option value="carrousel">Carrousel</option><option value="anuncio">Anuncio</option><option value="post">Post</option><option value="guion">Guion</option>
              </select>
            </Field>
          </div>
          <Field label="Titulo"><input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} style={inputStyle} /></Field>
          <Field label="Descripcion"><input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} style={inputStyle} /></Field>
          <Field label="URL"><input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} style={inputStyle} placeholder="https://..." /></Field>
          <div style={{ display: 'flex', gap: 8 }}><button onClick={crear} style={btnPrimary}>Agregar</button><button onClick={() => setCreando(false)} style={btnGhost}>Cancelar</button></div>
        </Card>
      )}

      {calendario.length === 0 ? <Empty icon="fa-calendar-times" text="Sin publicaciones" /> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {calendario.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 10 }}>
              <div style={{ width: 50, padding: 8, background: '#0a0a14', borderRadius: 8, textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 9, color: '#6a6a80', textTransform: 'uppercase' }}>{new Date(c.fecha).toLocaleDateString('es-AR', { month: 'short' })}</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{new Date(c.fecha).getDate()}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#a0a0b8', textTransform: 'uppercase', fontWeight: 600 }}>{c.tipo}</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{c.titulo}</div>
                {c.descripcion && <div style={{ fontSize: 11, color: '#a0a0b8' }}>{c.descripcion}</div>}
              </div>
              <select value={c.estado} onChange={e => setEstado(c.id, e.target.value)} style={{ ...inputStyle, width: 130 }}>
                <option value="programado">Programado</option><option value="publicado">Publicado</option><option value="cancelado">Cancelado</option>
              </select>
              <button onClick={() => eliminar(c.id)} style={{ ...btnGhost, color: '#f5365c' }}><i className="fas fa-trash" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// =============== ACCESOS ===============
function SeccionAccesos({ cliente, accesos, onUpdate, showToast }: { cliente: Cliente; accesos: ClienteAcceso[]; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const [creando, setCreando] = useState(false)
  const [form, setForm] = useState({ tipo: 'meta', nombre: '', url: '', usuario: '', notas: '' })

  async function crear() {
    if (!form.nombre.trim()) return
    const { error } = await supabase.from('cliente_accesos').insert({ cliente_id: cliente.id, tipo: form.tipo, nombre: form.nombre, url: form.url || null, usuario: form.usuario || null, notas: form.notas || null })
    if (error) showToast('Error: ' + error.message, 'error'); else { showToast('Acceso agregado', 'success'); setCreando(false); setForm({ tipo: 'meta', nombre: '', url: '', usuario: '', notas: '' }); onUpdate() }
  }

  async function eliminar(id: number) {
    if (!confirm('Eliminar?')) return
    await supabase.from('cliente_accesos').delete().eq('id', id); showToast('Eliminado', 'success'); onUpdate()
  }

  return (
    <div>
      {!creando ? <button onClick={() => setCreando(true)} style={{ ...btnPrimary, marginBottom: 16 }}><i className="fas fa-plus" /> Agregar acceso</button> : (
        <Card title="Nuevo acceso" desc="">
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 10 }}>
            <Field label="Tipo"><select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} style={inputStyle}>
              <option value="meta">Meta Ads</option><option value="crm">CRM</option><option value="drive">Drive</option><option value="web">Web</option><option value="email">Email</option><option value="otro">Otro</option>
            </select></Field>
            <Field label="Nombre"><input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} style={inputStyle} placeholder="Meta Ads Manager" /></Field>
          </div>
          <Field label="URL"><input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} style={inputStyle} /></Field>
          <Field label="Usuario"><input value={form.usuario} onChange={e => setForm({ ...form, usuario: e.target.value })} style={inputStyle} /></Field>
          <Field label="Notas"><input value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} style={inputStyle} /></Field>
          <div style={{ display: 'flex', gap: 8 }}><button onClick={crear} style={btnPrimary}>Agregar</button><button onClick={() => setCreando(false)} style={btnGhost}>Cancelar</button></div>
        </Card>
      )}

      {accesos.length === 0 ? <Empty icon="fa-link" text="Sin accesos" /> : accesos.map(a => (
        <div key={a.id} style={{ padding: 14, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 10, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: '#6a6a80', textTransform: 'uppercase' }}>{a.tipo}</div>
            <div style={{ fontWeight: 600 }}>{a.nombre}</div>
            {a.usuario && <div style={{ fontSize: 12, color: '#a0a0b8' }}><i className="fas fa-user" /> {a.usuario}</div>}
            {a.url && <div style={{ fontSize: 12, color: '#5e72e4' }}><i className="fas fa-link" /> {a.url}</div>}
            {a.notas && <div style={{ fontSize: 11, color: '#a0a0b8', marginTop: 4 }}>{a.notas}</div>}
          </div>
          <button onClick={() => eliminar(a.id)} style={{ ...btnGhost, color: '#f5365c' }}><i className="fas fa-trash" /></button>
        </div>
      ))}
    </div>
  )
}

// =============== PAGOS ===============
function SeccionPagos({ cliente, pagos, onUpdate, showToast }: { cliente: Cliente; pagos: ClientePago[]; onUpdate: () => void; showToast: (m: string, t: 'success' | 'error') => void }) {
  const [creando, setCreando] = useState(false)
  const [form, setForm] = useState({ fecha: new Date().toISOString().split('T')[0], monto: '', moneda: 'ARS', concepto: 'Servicio mensual', estado: 'pendiente', metodo: '' })

  async function crear() {
    if (!form.monto) return
    const { error } = await supabase.from('cliente_pagos').insert({ cliente_id: cliente.id, fecha: form.fecha, monto: Number(form.monto), moneda: form.moneda, concepto: form.concepto, estado: form.estado, metodo: form.metodo || null })
    if (error) showToast('Error: ' + error.message, 'error'); else { showToast('Pago registrado', 'success'); setCreando(false); setForm({ fecha: new Date().toISOString().split('T')[0], monto: '', moneda: 'ARS', concepto: 'Servicio mensual', estado: 'pendiente', metodo: '' }); onUpdate() }
  }

  async function setEstado(id: number, estado: string) { await supabase.from('cliente_pagos').update({ estado }).eq('id', id); onUpdate() }
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Estado"><select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} style={inputStyle}>
              <option value="pendiente">Pendiente</option><option value="pagado">Pagado</option><option value="vencido">Vencido</option>
            </select></Field>
            <Field label="Metodo"><input value={form.metodo} onChange={e => setForm({ ...form, metodo: e.target.value })} style={inputStyle} placeholder="transferencia" /></Field>
          </div>
          <div style={{ display: 'flex', gap: 8 }}><button onClick={crear} style={btnPrimary}>Registrar</button><button onClick={() => setCreando(false)} style={btnGhost}>Cancelar</button></div>
        </Card>
      )}

      {pagos.length === 0 ? <Empty icon="fa-credit-card" text="Sin pagos" /> : pagos.map(p => {
        const estadoColor = p.estado === 'pagado' ? '#00d97e' : p.estado === 'vencido' ? '#f5365c' : '#f5a623'
        return (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 10, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{p.concepto || 'Pago'}</div>
              <div style={{ fontSize: 11, color: '#6a6a80' }}>{new Date(p.fecha).toLocaleDateString('es-AR')} {p.metodo && `· ${p.metodo}`}</div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{p.moneda} ${Number(p.monto).toLocaleString('es-AR')}</div>
            <select value={p.estado} onChange={e => setEstado(p.id, e.target.value)} style={{ ...inputStyle, width: 120, color: estadoColor }}>
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

  async function marcarVisto(id: number) {
    await supabase.from('cliente_sugerencias').update({ visto_por_agencia: true }).eq('id', id); onUpdate()
  }

  return (
    <div>
      {sugerencias.length === 0 ? <Empty icon="fa-lightbulb" text="El cliente no envio sugerencias todavia" /> : sugerencias.map(s => {
        const estadoColor = s.estado === 'implementada' ? '#00d97e' : s.estado === 'descartada' ? '#6a6a80' : s.estado === 'en_revision' ? '#f5a623' : '#5e72e4'
        return (
          <div key={s.id} style={{ padding: 16, background: '#14142a', border: `1px solid ${!s.visto_por_agencia ? '#5e72e455' : '#1a1a2e'}`, borderRadius: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#6a6a80' }}>{new Date(s.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {!s.visto_por_agencia && <span style={{ fontSize: 10, color: '#5e72e4', fontWeight: 700 }}>NUEVO</span>}
                <span style={{ padding: '2px 10px', background: `${estadoColor}22`, color: estadoColor, borderRadius: 12, fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>{s.estado.replace('_', ' ')}</span>
              </div>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 10 }}>{s.texto}</div>
            {s.respuesta_agencia && <div style={{ padding: 10, background: '#0a0a14', borderLeft: '3px solid #5e72e4', borderRadius: 6, fontSize: 13, marginBottom: 10 }}><strong style={{ color: '#5e72e4' }}>Tu respuesta:</strong> {s.respuesta_agencia}</div>}

            {respondiendo === s.id ? (
              <div>
                <textarea value={respuesta} onChange={e => setRespuesta(e.target.value)} placeholder="Tu respuesta para el cliente..." style={{ ...inputStyle, minHeight: 60, fontFamily: 'inherit' }} />
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => responder(s.id, 'en_revision')} style={{ ...btnGhost, color: '#f5a623', borderColor: '#f5a62355' }}>En revision</button>
                  <button onClick={() => responder(s.id, 'implementada')} style={{ ...btnGhost, color: '#00d97e', borderColor: '#00d97e55' }}>Implementada</button>
                  <button onClick={() => responder(s.id, 'descartada')} style={{ ...btnGhost, color: '#6a6a80' }}>Descartar</button>
                  <button onClick={() => setRespondiendo(null)} style={btnGhost}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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

// =============== HELPERS ===============
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', background: '#0a0a14', border: '1px solid #2a2a40', borderRadius: 8, color: '#e8e8f0', fontSize: 13, outline: 'none' }
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

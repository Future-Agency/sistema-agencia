'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase, type AdAccount, type AdAccountConfig, type AdCambioLog, type AdCreativo, type AdCampana, type PeriodMetrics, type Cliente, type AdRevision, type TipoCuenta, type KanbanEstado, type KanbanSub } from '@/lib/supabase'

export const TIPO_CUENTA_OPTS: { id: TipoCuenta; label: string; icon: string; color: string }[] = [
  { id: 'ecommerce', label: 'Ecommerce', icon: 'fa-cart-shopping', color: '#00d97e' },
  { id: 'formularios', label: 'Formularios', icon: 'fa-file-lines', color: '#5e72e4' },
  { id: 'mensajeria', label: 'Mensajería', icon: 'fa-comment-dots', color: '#f5a623' },
]

export const KANBAN_OPTS: { id: KanbanEstado; label: string; color: string; icon: string; desc: string }[] = [
  { id: 'problemas', label: 'Problemas', color: '#f5365c', icon: 'fa-triangle-exclamation', desc: 'Pago, entrega, links, creativos mal' },
  { id: 'corriendo', label: 'Ads Corriendo', color: '#00d97e', icon: 'fa-rocket', desc: 'Normalidad o esperando resultados' },
  { id: 'optimizar', label: 'Ads a Optimizar', color: '#f5a623', icon: 'fa-screwdriver-wrench', desc: 'Resultados negativos, hay que mover' },
  { id: 'escalar', label: 'Ads a Escalar', color: '#11cdef', icon: 'fa-chart-line', desc: 'Invertir más para maximizar' },
  { id: 'onboarding', label: 'Onboarding', color: '#8965e0', icon: 'fa-rocket-launch', desc: 'Configuración, estrategia, listos' },
  { id: 'reestructuracion', label: 'Re-estructuración', color: '#9333ea', icon: 'fa-arrows-rotate', desc: 'Optin grave, nueva estrategia de base' },
]

type Props = {
  account: AdAccount
  cliente: Cliente | null
  onBack: () => void
}

const ESTADOS_CUENTA = ['activa', 'pausada', 'en_revision', 'scaling', 'testing', 'nueva']
const TIPOS_CONVERSION = ['purchase', 'lead', 'message', 'registration', 'add_to_cart', 'view_content']
const TIPOS_CAMBIO = ['optimizacion', 'cambio_estructura', 'creativo', 'presupuesto', 'audiencia', 'copy', 'otro']
const TIPOS_CREATIVO = ['imagen', 'video', 'carrusel', 'stories', 'reel', 'ugc']
const ESTADOS_CREATIVO = ['activo', 'pausado', 'agotado', 'testing']
const OBJETIVOS_CAMPANA = ['conversiones', 'trafico', 'mensajes', 'leads', 'alcance', 'engagement', 'app_installs']
const TIPOS_AUDIENCIA = ['broad', 'lookalike', 'retargeting', 'interest', 'custom', 'adv_shopping']

const fmtNum = (n: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n || 0)
const fmtMoney = (n: number, c = 'ARS') => new Intl.NumberFormat('es-AR', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n || 0)
const fmtPct = (n: number) => (n || 0).toFixed(2) + '%'

function extractMetrics(acc: AdAccount, period: '7d' | '15d' | '30d'): PeriodMetrics {
  const m = period === '7d' ? acc.metrics_7d : period === '15d' ? acc.metrics_15d : acc.metrics_30d
  if (m && Object.keys(m).length > 0) return m
  return { spend: acc.spend, impressions: acc.impressions, clicks: acc.clicks, ctr: acc.ctr, cpc: acc.cpc, messages: acc.messages, purchases: acc.purchases, leads: acc.leads, purchase_value: 0 }
}

export default function GestionAnuncio({ account, cliente, onBack }: Props) {
  const [tab, setTab] = useState<'overview' | 'estrategia' | 'creativos' | 'campanas' | 'cambios' | 'revisiones'>('overview')
  const [period, setPeriod] = useState<'7d' | '15d' | '30d'>('30d')
  const [config, setConfig] = useState<AdAccountConfig | null>(null)
  const [cambios, setCambios] = useState<AdCambioLog[]>([])
  const [creativos, setCreativos] = useState<AdCreativo[]>([])
  const [campanas, setCampanas] = useState<AdCampana[]>([])
  const [revisiones, setRevisiones] = useState<AdRevision[]>([])
  const [revisionPeriodo, setRevisionPeriodo] = useState<'semana' | 'mes'>('semana')
  const [revisionForm, setRevisionForm] = useState<{ id: number | null; periodo: 'semana' | 'mes'; fecha: string; titulo: string; informe: string; insights: string; plan_accion: string }>({ id: null, periodo: 'semana', fecha: new Date().toISOString().split('T')[0], titulo: '', informe: '', insights: '', plan_accion: '' })
  const [showRevisionForm, setShowRevisionForm] = useState(false)
  const [revisionExpandida, setRevisionExpandida] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [tiposCuenta, setTiposCuenta] = useState<TipoCuenta[]>(account.tipos_cuenta || [])
  const [kanbanEstado, setKanbanEstado] = useState<KanbanEstado>(account.kanban_estado || 'corriendo')
  const [kanbanSub, setKanbanSub] = useState<KanbanSub | null>(account.kanban_sub || null)
  const [revMensualAt, setRevMensualAt] = useState<string | null>(account.revision_mensual_at || null)
  const [reporteAt, setReporteAt] = useState<string | null>(account.reporte_at || null)

  function toggleTipoCuenta(t: TipoCuenta) {
    setTiposCuenta(arr => arr.includes(t) ? arr.filter(x => x !== t) : [...arr, t])
  }

  // Form states
  const [configForm, setConfigForm] = useState({ estado_cuenta: 'activa', estrategia: '', roas_break_even: '', tipo_conversion: '', objetivo_mensual: '', notas: '' })
  const [cambioForm, setCambioForm] = useState({ fecha: new Date().toISOString().split('T')[0], tipo: 'optimizacion', descripcion: '', resultado: '' })
  const [creativoForm, setCreativoForm] = useState({ nombre: '', tipo: 'imagen', estado: 'activo', spend: '', resultados: '', cpr: '', notas: '' })
  const [campanaForm, setCampanaForm] = useState({ nombre: '', objetivo: 'conversiones', tipo_audiencia: 'broad', presupuesto_diario: '', estado: 'activo', notas: '' })
  const [showCambioForm, setShowCambioForm] = useState(false)
  const [showCreativoForm, setShowCreativoForm] = useState(false)
  const [showCampanaForm, setShowCampanaForm] = useState(false)

  const metrics = useMemo(() => extractMetrics(account, period), [account, period])
  const roas = (metrics.spend || 0) > 0 ? (metrics.purchase_value || 0) / (metrics.spend || 1) : 0
  const mainResult = (metrics.purchases || 0) || (metrics.leads || 0) || (metrics.messages || 0)
  const mainLabel = (metrics.purchases || 0) ? 'compra' : (metrics.leads || 0) ? 'lead' : 'mensaje'
  const cpr = mainResult > 0 ? (metrics.spend || 0) / mainResult : 0
  const isEcommerce = cliente?.tipo === 'Tienda Online' || (metrics.purchases || 0) > 0

  useEffect(() => { loadData() }, [account.id])

  async function loadData() {
    const [cfgRes, cambiosRes, creativosRes, campanasRes, revisionesRes] = await Promise.all([
      supabase.from('ad_account_config').select('*').eq('ad_account_id', account.id).maybeSingle(),
      supabase.from('ad_cambios_log').select('*').eq('ad_account_id', account.id).order('fecha', { ascending: false }),
      supabase.from('ad_creativos').select('*').eq('ad_account_id', account.id).order('created_at', { ascending: false }),
      supabase.from('ad_campanas').select('*').eq('ad_account_id', account.id).order('created_at', { ascending: false }),
      supabase.from('ad_revisiones').select('*').eq('ad_account_id', account.id).order('fecha', { ascending: false }),
    ])
    if (revisionesRes.data) setRevisiones(revisionesRes.data)
    if (cfgRes.data) {
      setConfig(cfgRes.data)
      setConfigForm({
        estado_cuenta: cfgRes.data.estado_cuenta || 'activa',
        estrategia: cfgRes.data.estrategia || '',
        roas_break_even: cfgRes.data.roas_break_even?.toString() || '',
        tipo_conversion: cfgRes.data.tipo_conversion || '',
        objetivo_mensual: cfgRes.data.objetivo_mensual || '',
        notas: cfgRes.data.notas || '',
      })
    }
    if (cambiosRes.data) setCambios(cambiosRes.data)
    if (creativosRes.data) setCreativos(creativosRes.data)
    if (campanasRes.data) setCampanas(campanasRes.data)
  }

  async function saveConfig() {
    setSaving(true)
    const payload = {
      ad_account_id: account.id,
      estado_cuenta: configForm.estado_cuenta,
      estrategia: configForm.estrategia,
      roas_break_even: configForm.roas_break_even ? parseFloat(configForm.roas_break_even) : null,
      tipo_conversion: configForm.tipo_conversion,
      objetivo_mensual: configForm.objetivo_mensual,
      notas: configForm.notas,
      updated_at: new Date().toISOString(),
    }
    if (config) {
      await supabase.from('ad_account_config').update(payload).eq('id', config.id)
    } else {
      await supabase.from('ad_account_config').insert(payload)
    }
    // Persistir clasificacion + kanban + checks en ad_accounts
    const adPayload: any = {
      tipos_cuenta: tiposCuenta,
      kanban_estado: kanbanEstado,
      kanban_sub: kanbanEstado === 'onboarding' ? (kanbanSub || 'config') : null,
      revision_mensual_at: revMensualAt,
      reporte_at: reporteAt,
    }
    if (account.kanban_estado !== kanbanEstado) {
      adPayload.kanban_changed_at = new Date().toISOString()
    }
    await supabase.from('ad_accounts').update(adPayload).eq('id', account.id)
    await loadData()
    setSaving(false)
  }

  async function addCambio() {
    if (!cambioForm.descripcion.trim()) return
    await supabase.from('ad_cambios_log').insert({ ad_account_id: account.id, ...cambioForm })
    setCambioForm({ fecha: new Date().toISOString().split('T')[0], tipo: 'optimizacion', descripcion: '', resultado: '' })
    setShowCambioForm(false)
    loadData()
  }

  async function deleteCambio(id: number) {
    if (!confirm('Eliminar este cambio del historial?')) return
    await supabase.from('ad_cambios_log').delete().eq('id', id)
    loadData()
  }

  const [editingCambio, setEditingCambio] = useState<number | null>(null)
  const [editCambioForm, setEditCambioForm] = useState({ fecha: '', tipo: '', descripcion: '', resultado: '' })

  function startEditCambio(c: AdCambioLog) {
    setEditingCambio(c.id)
    setEditCambioForm({ fecha: c.fecha, tipo: c.tipo, descripcion: c.descripcion, resultado: c.resultado })
  }

  async function saveCambioEdit() {
    if (editingCambio === null) return
    await supabase.from('ad_cambios_log').update({
      fecha: editCambioForm.fecha,
      tipo: editCambioForm.tipo,
      descripcion: editCambioForm.descripcion,
      resultado: editCambioForm.resultado,
    }).eq('id', editingCambio)
    setEditingCambio(null)
    loadData()
  }

  // ===== Revisiones =====
  function nuevaRevision(periodo: 'semana' | 'mes') {
    const hoy = new Date().toISOString().split('T')[0]
    setRevisionForm({ id: null, periodo, fecha: hoy, titulo: '', informe: '', insights: '', plan_accion: '' })
    setShowRevisionForm(true)
  }

  function editarRevision(r: AdRevision) {
    setRevisionForm({
      id: r.id, periodo: r.periodo, fecha: r.fecha,
      titulo: r.titulo || '', informe: r.informe || '', insights: r.insights || '', plan_accion: r.plan_accion || '',
    })
    setShowRevisionForm(true)
  }

  async function saveRevision() {
    if (!revisionForm.informe.trim() && !revisionForm.insights.trim() && !revisionForm.plan_accion.trim()) return
    const snapshot: PeriodMetrics = {
      spend: metrics.spend, impressions: metrics.impressions, clicks: metrics.clicks,
      ctr: metrics.ctr, cpc: metrics.cpc, purchases: metrics.purchases, leads: metrics.leads,
      messages: metrics.messages, purchase_value: metrics.purchase_value,
    }
    const payload = {
      ad_account_id: account.id,
      periodo: revisionForm.periodo, fecha: revisionForm.fecha,
      titulo: revisionForm.titulo || null,
      informe: revisionForm.informe || null,
      insights: revisionForm.insights || null,
      plan_accion: revisionForm.plan_accion || null,
      metricas_snapshot: revisionForm.id ? undefined : snapshot,
      updated_at: new Date().toISOString(),
    }
    if (revisionForm.id) {
      await supabase.from('ad_revisiones').update(payload).eq('id', revisionForm.id)
    } else {
      await supabase.from('ad_revisiones').insert(payload)
    }
    setShowRevisionForm(false)
    loadData()
  }

  async function deleteRevision(id: number) {
    if (!confirm('Eliminar esta revision?')) return
    await supabase.from('ad_revisiones').delete().eq('id', id)
    loadData()
  }

  async function addCreativo() {
    if (!creativoForm.nombre.trim()) return
    await supabase.from('ad_creativos').insert({
      ad_account_id: account.id, nombre: creativoForm.nombre, tipo: creativoForm.tipo,
      estado: creativoForm.estado, spend: parseFloat(creativoForm.spend) || 0,
      resultados: parseInt(creativoForm.resultados) || 0, cpr: parseFloat(creativoForm.cpr) || 0,
      notas: creativoForm.notas,
    })
    setCreativoForm({ nombre: '', tipo: 'imagen', estado: 'activo', spend: '', resultados: '', cpr: '', notas: '' })
    setShowCreativoForm(false)
    loadData()
  }

  async function deleteCreativo(id: number) {
    await supabase.from('ad_creativos').delete().eq('id', id)
    loadData()
  }

  async function toggleCreativoEstado(cr: AdCreativo) {
    const next = cr.estado === 'activo' ? 'pausado' : cr.estado === 'pausado' ? 'agotado' : 'activo'
    await supabase.from('ad_creativos').update({ estado: next }).eq('id', cr.id)
    loadData()
  }

  async function addCampana() {
    if (!campanaForm.nombre.trim()) return
    await supabase.from('ad_campanas').insert({
      ad_account_id: account.id, nombre: campanaForm.nombre, objetivo: campanaForm.objetivo,
      tipo_audiencia: campanaForm.tipo_audiencia, presupuesto_diario: parseFloat(campanaForm.presupuesto_diario) || null,
      estado: campanaForm.estado, notas: campanaForm.notas,
    })
    setCampanaForm({ nombre: '', objetivo: 'conversiones', tipo_audiencia: 'broad', presupuesto_diario: '', estado: 'activo', notas: '' })
    setShowCampanaForm(false)
    loadData()
  }

  async function deleteCampana(id: number) {
    await supabase.from('ad_campanas').delete().eq('id', id)
    loadData()
  }

  async function toggleCampanaEstado(c: AdCampana) {
    const next = c.estado === 'activo' ? 'pausado' : c.estado === 'pausado' ? 'testing' : 'activo'
    await supabase.from('ad_campanas').update({ estado: next }).eq('id', c.id)
    loadData()
  }

  const estadoColor: Record<string, string> = {
    activa: '#00d97e', pausada: '#f5a623', en_revision: '#5e72e4', scaling: '#2dcecc', testing: '#8965e0', nueva: '#45aaf2',
  }

  const creativoEstadoColor: Record<string, string> = {
    activo: '#00d97e', pausado: '#f5a623', agotado: '#f5365c', testing: '#8965e0',
  }

  const campanaEstadoColor: Record<string, string> = {
    activo: '#00d97e', pausado: '#f5a623', testing: '#8965e0',
  }

  const tipoIcon: Record<string, string> = {
    optimizacion: 'fa-sliders-h', cambio_estructura: 'fa-sitemap', creativo: 'fa-paint-brush',
    presupuesto: 'fa-dollar-sign', audiencia: 'fa-users', copy: 'fa-pen', otro: 'fa-ellipsis-h',
  }

  const roasBreakEven = config?.roas_break_even || (configForm.roas_break_even ? parseFloat(configForm.roas_break_even) : null)
  const roasVsBE = roasBreakEven && roasBreakEven > 0 ? roas / roasBreakEven : null

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost" onClick={onBack}><i className="fas fa-arrow-left" /></button>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #5e72e4, #8965e0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="fab fa-meta" style={{ color: 'white', fontSize: 18 }} />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{account.account_name}</h2>
          <div style={{ fontSize: 12, color: '#6a6a80', display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
            <span>{account.account_id}</span>
            {cliente && <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(94,114,228,.15)', color: '#5e72e4', fontWeight: 600 }}>{cliente.nombre}</span>}
            <span style={{ padding: '1px 6px', borderRadius: 10, background: estadoColor[configForm.estado_cuenta] + '22', color: estadoColor[configForm.estado_cuenta], fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>
              {configForm.estado_cuenta}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['7d', '15d', '30d'] as const).map(p => (
            <button key={p} className="btn btn-sm" onClick={() => setPeriod(p)}
              style={{ background: period === p ? 'linear-gradient(135deg, #5e72e4, #8965e0)' : 'transparent', color: period === p ? 'white' : '#6a6a80', border: period === p ? 'none' : '1px solid #2a2a40', fontSize: 11 }}>
              {p === '7d' ? '7 dias' : p === '15d' ? '15 dias' : '30 dias'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Inversion', value: fmtMoney(metrics.spend || 0, account.currency), icon: 'fa-wallet', color: '#5e72e4', bg: 'rgba(94,114,228,.12)' },
          { label: 'ROAS', value: roas.toFixed(2) + 'x', icon: 'fa-chart-line', color: roas >= 3 ? '#00d97e' : roas >= 1.5 ? '#f5a623' : '#f5365c', bg: roas >= 3 ? 'rgba(0,217,126,.12)' : roas >= 1.5 ? 'rgba(245,166,35,.12)' : 'rgba(245,54,92,.12)' },
          ...(isEcommerce && roasBreakEven ? [{
            label: `ROAS vs BE (${roasBreakEven}x)`,
            value: roasVsBE! >= 1 ? `+${((roasVsBE! - 1) * 100).toFixed(0)}%` : `${((roasVsBE! - 1) * 100).toFixed(0)}%`,
            icon: 'fa-bullseye', color: roasVsBE! >= 1 ? '#00d97e' : '#f5365c',
            bg: roasVsBE! >= 1 ? 'rgba(0,217,126,.12)' : 'rgba(245,54,92,.12)',
          }] : []),
          { label: 'Valor Compras', value: fmtMoney(metrics.purchase_value || 0, account.currency), icon: 'fa-shopping-bag', color: '#2dcecc', bg: 'rgba(45,206,204,.12)' },
          { label: `Costo / ${mainLabel}`, value: mainResult > 0 ? fmtMoney(cpr, account.currency) : '--', icon: 'fa-tag', color: '#f5a623', bg: 'rgba(245,166,35,.12)' },
          { label: 'Impresiones', value: fmtNum(metrics.impressions || 0), icon: 'fa-eye', color: '#45aaf2', bg: 'rgba(69,170,242,.12)' },
          { label: 'Clicks', value: fmtNum(metrics.clicks || 0), icon: 'fa-mouse-pointer', color: '#8965e0', bg: 'rgba(137,101,224,.12)' },
          { label: 'CTR', value: fmtPct(metrics.ctr || 0), icon: 'fa-percentage', color: '#fc6e51', bg: 'rgba(252,110,81,.12)' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ margin: 0 }}>
            <div className="card-body" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fas ${kpi.icon}`} style={{ color: kpi.color, fontSize: 14 }} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                <div style={{ fontSize: 10, color: '#6a6a80' }}>{kpi.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Conversions row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Mensajes', value: metrics.messages || 0, icon: 'fa-comment-dots', color: '#45aaf2' },
          { label: 'Compras', value: metrics.purchases || 0, icon: 'fa-shopping-cart', color: '#00d97e' },
          { label: 'Leads', value: metrics.leads || 0, icon: 'fa-user-plus', color: '#f5a623' },
        ].map(c => (
          <div key={c.label} className="card" style={{ flex: 1, margin: 0 }}>
            <div className="card-body" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#6a6a80' }}><i className={`fas ${c.icon}`} style={{ color: c.color, marginRight: 6 }} />{c.label}</span>
              <span style={{ fontSize: 18, fontWeight: 700 }}>{fmtNum(c.value)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {([
          { key: 'overview', label: 'Config', icon: 'fa-cog' },
          { key: 'estrategia', label: 'Estrategia', icon: 'fa-chess' },
          { key: 'campanas', label: `Campanas (${campanas.length})`, icon: 'fa-sitemap' },
          { key: 'creativos', label: `Creativos (${creativos.length})`, icon: 'fa-paint-brush' },
          { key: 'cambios', label: `Cambios (${cambios.length})`, icon: 'fa-history' },
          { key: 'revisiones', label: `Revisiones (${revisiones.length})`, icon: 'fa-clipboard-check' },
        ] as const).map(t => (
          <div key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key as any)}>
            <i className={`fas ${t.icon}`} style={{ marginRight: 4, fontSize: 11 }} />{t.label}
          </div>
        ))}
      </div>

      {/* TAB: Config */}
      {tab === 'overview' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>Configuracion de la Cuenta</span>
            <button className="btn btn-primary btn-sm" onClick={saveConfig} disabled={saving}>
              <i className="fas fa-save" /> {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="label">Estado de la Cuenta</label>
                <select className="select-custom" style={{ width: '100%' }} value={configForm.estado_cuenta} onChange={e => setConfigForm({ ...configForm, estado_cuenta: e.target.value })}>
                  {ESTADOS_CUENTA.map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1).replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Tipo de Conversion</label>
                <select className="select-custom" style={{ width: '100%' }} value={configForm.tipo_conversion} onChange={e => setConfigForm({ ...configForm, tipo_conversion: e.target.value })}>
                  <option value="">Sin definir</option>
                  {TIPOS_CONVERSION.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">ROAS Break Even {isEcommerce && <span style={{ color: '#f5a623', fontSize: 10 }}>(E-comm)</span>}</label>
                <input className="input" type="number" step="0.1" placeholder="Ej: 2.5" value={configForm.roas_break_even} onChange={e => setConfigForm({ ...configForm, roas_break_even: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="label">Objetivo Mensual</label>
              <input className="input" placeholder="Ej: Llegar a 500 compras con ROAS > 3x" value={configForm.objetivo_mensual} onChange={e => setConfigForm({ ...configForm, objetivo_mensual: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="label">Notas</label>
              <textarea className="input textarea" placeholder="Notas internas sobre esta cuenta..." value={configForm.notas} onChange={e => setConfigForm({ ...configForm, notas: e.target.value })} />
            </div>

            {/* Tipos de cuenta + Estado Kanban */}
            <div style={{ marginTop: 12, padding: 14, background: '#0a0a14', borderRadius: 8, border: '1px solid #2a2a40' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: '#a0a0b8', marginBottom: 10 }}>
                <i className="fas fa-tags" style={{ marginRight: 6, color: '#5e72e4' }} />Clasificación
              </div>
              <div className="form-group">
                <label className="label">Tipos de cuenta (puede ser más de uno)</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {TIPO_CUENTA_OPTS.map(opt => {
                    const sel = tiposCuenta.includes(opt.id)
                    return (
                      <button key={opt.id} type="button" onClick={() => toggleTipoCuenta(opt.id)} style={{
                        padding: '7px 14px',
                        background: sel ? `${opt.color}22` : 'transparent',
                        border: `1px solid ${sel ? opt.color + '88' : '#2a2a40'}`,
                        borderRadius: 999,
                        color: sel ? opt.color : '#a0a0b8',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}>
                        <i className={`fas ${opt.icon}`} style={{ marginRight: 6 }} />{opt.label}
                        {sel && <i className="fas fa-check" style={{ marginLeft: 6, fontSize: 10 }} />}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="label">Estado del Kanban</label>
                  <select className="select-custom" style={{ width: '100%' }} value={kanbanEstado} onChange={e => setKanbanEstado(e.target.value as KanbanEstado)}>
                    {KANBAN_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
                {kanbanEstado === 'onboarding' && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="label">Sub-fase de Onboarding</label>
                    <select className="select-custom" style={{ width: '100%' }} value={kanbanSub || 'config'} onChange={e => setKanbanSub(e.target.value as KanbanSub)}>
                      <option value="config">Configuración (CP / CRM / E-comm)</option>
                      <option value="estrategia">Estrategia</option>
                      <option value="listos">Listos para publicar</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Checks: revision mensual + reporte */}
            <div style={{ marginTop: 12, padding: 14, background: '#0a0a14', borderRadius: 8, border: '1px solid #2a2a40' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: '#a0a0b8', marginBottom: 10 }}>
                <i className="fas fa-clipboard-check" style={{ marginRight: 6, color: '#00d97e' }} />Estado del mes
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <CheckCard
                  label="Revisión mensual"
                  icon="fa-magnifying-glass-chart"
                  fechaIso={revMensualAt}
                  onToggle={() => setRevMensualAt(revMensualAt ? null : new Date().toISOString())}
                />
                <CheckCard
                  label="Reporte enviado"
                  icon="fa-file-export"
                  fechaIso={reporteAt}
                  onToggle={() => setReporteAt(reporteAt ? null : new Date().toISOString())}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Estrategia */}
      {tab === 'estrategia' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>Estrategia Publicitaria</span>
            <button className="btn btn-primary btn-sm" onClick={saveConfig} disabled={saving}>
              <i className="fas fa-save" /> {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
          <div className="card-body">
            <textarea className="input textarea" style={{ minHeight: 200, lineHeight: 1.8, fontSize: 13 }}
              placeholder={"Descripcion de la estrategia publicitaria.\n\nEjemplo:\n- Funnel: TOFU (broad) -> MOFU (retargeting) -> BOFU (lookalike compras)\n- Tipo de contenido: UGC + testimonios\n- Objetivo: Escalar a $X con ROAS > 3x\n- Segmentacion: Mujeres 25-45, intereses XYZ\n- Exclusiones: compradores ultimos 30 dias"}
              value={configForm.estrategia} onChange={e => setConfigForm({ ...configForm, estrategia: e.target.value })} />
            {isEcommerce && roasBreakEven && (
              <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: roasVsBE && roasVsBE >= 1 ? 'rgba(0,217,126,.08)' : 'rgba(245,54,92,.08)', border: `1px solid ${roasVsBE && roasVsBE >= 1 ? '#00d97e33' : '#f5365c33'}` }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: roasVsBE && roasVsBE >= 1 ? '#00d97e' : '#f5365c' }}>
                  <i className="fas fa-bullseye" style={{ marginRight: 6 }} />
                  ROAS Break Even: {roasBreakEven}x | ROAS Actual: {roas.toFixed(2)}x | Margen: {roasVsBE ? ((roasVsBE - 1) * 100).toFixed(0) + '%' : '--'}
                </div>
                <div style={{ fontSize: 11, color: '#a0a0b8' }}>
                  {roasVsBE && roasVsBE >= 1.3 ? 'Margen saludable. Oportunidad de escalar presupuesto.' :
                    roasVsBE && roasVsBE >= 1 ? 'Rentable pero ajustado. Optimizar antes de escalar.' :
                      'Por debajo del punto de equilibrio. Revisar estrategia urgente.'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: Campanas */}
      {tab === 'campanas' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>Estructura de Campanas</span>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCampanaForm(!showCampanaForm)}>
              <i className={`fas ${showCampanaForm ? 'fa-times' : 'fa-plus'}`} /> {showCampanaForm ? 'Cancelar' : 'Agregar'}
            </button>
          </div>
          <div className="card-body">
            {showCampanaForm && (
              <div style={{ padding: 16, background: '#1a1a28', borderRadius: 8, marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group"><label className="label">Nombre Campana</label><input className="input" placeholder="Ej: Conversiones - Broad - Mujeres 25-45" value={campanaForm.nombre} onChange={e => setCampanaForm({ ...campanaForm, nombre: e.target.value })} /></div>
                  <div className="form-group"><label className="label">Objetivo</label>
                    <select className="select-custom" style={{ width: '100%' }} value={campanaForm.objetivo} onChange={e => setCampanaForm({ ...campanaForm, objetivo: e.target.value })}>
                      {OBJETIVOS_CAMPANA.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label className="label">Tipo Audiencia</label>
                    <select className="select-custom" style={{ width: '100%' }} value={campanaForm.tipo_audiencia} onChange={e => setCampanaForm({ ...campanaForm, tipo_audiencia: e.target.value })}>
                      {TIPOS_AUDIENCIA.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label className="label">Presupuesto Diario</label><input className="input" type="number" placeholder="$" value={campanaForm.presupuesto_diario} onChange={e => setCampanaForm({ ...campanaForm, presupuesto_diario: e.target.value })} /></div>
                </div>
                <div className="form-group"><label className="label">Notas</label><input className="input" placeholder="Segmentacion, exclusiones, etc." value={campanaForm.notas} onChange={e => setCampanaForm({ ...campanaForm, notas: e.target.value })} /></div>
                <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={addCampana}><i className="fas fa-plus" /> Crear Campana</button>
              </div>
            )}
            {campanas.length === 0 && !showCampanaForm && (
              <div style={{ textAlign: 'center', padding: 32, color: '#6a6a80' }}>
                <i className="fas fa-sitemap" style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }} />
                <div>Sin campanas registradas</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Agrega la estructura de tus campanas para documentar tu funnel</div>
              </div>
            )}
            {campanas.map(c => (
              <div key={c.id} style={{ padding: 12, background: '#1a1a28', borderRadius: 8, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12, borderLeft: `3px solid ${campanaEstadoColor[c.estado] || '#5e72e4'}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{c.nombre}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(94,114,228,.15)', color: '#5e72e4' }}>{c.objetivo}</span>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(137,101,224,.15)', color: '#8965e0' }}>{c.tipo_audiencia}</span>
                    {c.presupuesto_diario && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(0,217,126,.15)', color: '#00d97e' }}>{fmtMoney(c.presupuesto_diario, account.currency)}/dia</span>}
                  </div>
                  {c.notas && <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 4 }}>{c.notas}</div>}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => toggleCampanaEstado(c)} style={{ color: campanaEstadoColor[c.estado], fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>{c.estado}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => deleteCampana(c.id)} style={{ color: '#f5365c', fontSize: 12 }}><i className="fas fa-trash" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: Creativos */}
      {tab === 'creativos' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>Creativos</span>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreativoForm(!showCreativoForm)}>
              <i className={`fas ${showCreativoForm ? 'fa-times' : 'fa-plus'}`} /> {showCreativoForm ? 'Cancelar' : 'Agregar'}
            </button>
          </div>
          <div className="card-body">
            {showCreativoForm && (
              <div style={{ padding: 16, background: '#1a1a28', borderRadius: 8, marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div className="form-group"><label className="label">Nombre</label><input className="input" placeholder="Ej: UGC Testimonio v2" value={creativoForm.nombre} onChange={e => setCreativoForm({ ...creativoForm, nombre: e.target.value })} /></div>
                  <div className="form-group"><label className="label">Tipo</label>
                    <select className="select-custom" style={{ width: '100%' }} value={creativoForm.tipo} onChange={e => setCreativoForm({ ...creativoForm, tipo: e.target.value })}>
                      {TIPOS_CREATIVO.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label className="label">Estado</label>
                    <select className="select-custom" style={{ width: '100%' }} value={creativoForm.estado} onChange={e => setCreativoForm({ ...creativoForm, estado: e.target.value })}>
                      {ESTADOS_CREATIVO.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div className="form-group"><label className="label">Spend</label><input className="input" type="number" placeholder="$" value={creativoForm.spend} onChange={e => setCreativoForm({ ...creativoForm, spend: e.target.value })} /></div>
                  <div className="form-group"><label className="label">Resultados</label><input className="input" type="number" placeholder="0" value={creativoForm.resultados} onChange={e => setCreativoForm({ ...creativoForm, resultados: e.target.value })} /></div>
                  <div className="form-group"><label className="label">CPR</label><input className="input" type="number" placeholder="$" value={creativoForm.cpr} onChange={e => setCreativoForm({ ...creativoForm, cpr: e.target.value })} /></div>
                </div>
                <div className="form-group"><label className="label">Notas</label><input className="input" placeholder="Hook, CTA, angulo..." value={creativoForm.notas} onChange={e => setCreativoForm({ ...creativoForm, notas: e.target.value })} /></div>
                <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={addCreativo}><i className="fas fa-plus" /> Agregar Creativo</button>
              </div>
            )}
            {creativos.length === 0 && !showCreativoForm && (
              <div style={{ textAlign: 'center', padding: 32, color: '#6a6a80' }}>
                <i className="fas fa-paint-brush" style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }} />
                <div>Sin creativos registrados</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Trackea el rendimiento de cada creativo</div>
              </div>
            )}
            {creativos.length > 0 && (
              <table className="table">
                <thead>
                  <tr><th>Creativo</th><th>Tipo</th><th style={{ textAlign: 'right' }}>Spend</th><th style={{ textAlign: 'right' }}>Resultados</th><th style={{ textAlign: 'right' }}>CPR</th><th>Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {creativos.map(cr => (
                    <tr key={cr.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{cr.nombre}</div>
                        {cr.notas && <div style={{ fontSize: 10, color: '#6a6a80' }}>{cr.notas}</div>}
                      </td>
                      <td><span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(137,101,224,.15)', color: '#8965e0' }}>{cr.tipo}</span></td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{cr.spend > 0 ? fmtMoney(cr.spend, account.currency) : '--'}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{cr.resultados || '--'}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{cr.cpr > 0 ? fmtMoney(cr.cpr, account.currency) : '--'}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleCreativoEstado(cr)} style={{ color: creativoEstadoColor[cr.estado], fontSize: 10, textTransform: 'uppercase', fontWeight: 700, padding: '2px 6px' }}>{cr.estado}</button>
                      </td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => deleteCreativo(cr.id)} style={{ color: '#f5365c', fontSize: 11 }}><i className="fas fa-trash" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB: Cambios */}
      {tab === 'cambios' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>Cambios y Optimizaciones</span>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCambioForm(!showCambioForm)}>
              <i className={`fas ${showCambioForm ? 'fa-times' : 'fa-plus'}`} /> {showCambioForm ? 'Cancelar' : 'Registrar'}
            </button>
          </div>
          <div className="card-body">
            {showCambioForm && (
              <div style={{ padding: 16, background: '#1a1a28', borderRadius: 8, marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 12 }}>
                  <div className="form-group"><label className="label">Fecha</label><input className="input" type="date" value={cambioForm.fecha} onChange={e => setCambioForm({ ...cambioForm, fecha: e.target.value })} /></div>
                  <div className="form-group"><label className="label">Tipo</label>
                    <select className="select-custom" style={{ width: '100%' }} value={cambioForm.tipo} onChange={e => setCambioForm({ ...cambioForm, tipo: e.target.value })}>
                      {TIPOS_CAMBIO.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group"><label className="label">Que se hizo</label><textarea className="input textarea" placeholder="Ej: Se pausaron 3 adsets con CPR > $15K. Se duplico el adset ganador con nueva audiencia lookalike 2%." value={cambioForm.descripcion} onChange={e => setCambioForm({ ...cambioForm, descripcion: e.target.value })} /></div>
                <div className="form-group"><label className="label">Resultado (completar despues)</label><textarea className="input textarea" placeholder="Ej: CPR bajo de $15K a $9K en 48hs. ROAS subio de 2.1x a 3.4x." value={cambioForm.resultado} onChange={e => setCambioForm({ ...cambioForm, resultado: e.target.value })} /></div>
                <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={addCambio}><i className="fas fa-plus" /> Registrar Cambio</button>
              </div>
            )}
            {cambios.length === 0 && !showCambioForm && (
              <div style={{ textAlign: 'center', padding: 32, color: '#6a6a80' }}>
                <i className="fas fa-history" style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }} />
                <div>Sin cambios registrados</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Registra cada optimizacion con fecha y resultado para trackear el impacto</div>
              </div>
            )}
            {cambios.map(c => editingCambio === c.id ? (
              <div key={c.id} style={{ padding: 12, borderLeft: '3px solid #f5a623', background: 'rgba(245,166,35,.08)', borderRadius: '0 8px 8px 0', marginBottom: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, marginBottom: 8 }}>
                  <input className="input" type="date" value={editCambioForm.fecha} onChange={e => setEditCambioForm({ ...editCambioForm, fecha: e.target.value })} style={{ fontSize: 11 }} />
                  <select className="select-custom" style={{ width: '100%', fontSize: 11 }} value={editCambioForm.tipo} onChange={e => setEditCambioForm({ ...editCambioForm, tipo: e.target.value })}>
                    {TIPOS_CAMBIO.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <textarea className="input textarea" placeholder="Que se hizo" value={editCambioForm.descripcion} onChange={e => setEditCambioForm({ ...editCambioForm, descripcion: e.target.value })} style={{ fontSize: 12, marginBottom: 6 }} />
                <textarea className="input textarea" placeholder="Resultado medido (CPR, ROAS, tiempo, etc.)" value={editCambioForm.resultado} onChange={e => setEditCambioForm({ ...editCambioForm, resultado: e.target.value })} style={{ fontSize: 12, marginBottom: 8 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary btn-sm" onClick={saveCambioEdit}><i className="fas fa-save" /> Guardar</button>
                  <button className="btn btn-outline btn-sm" onClick={() => setEditingCambio(null)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div key={c.id} style={{ padding: 12, borderLeft: '3px solid #5e72e4', background: '#1a1a28', borderRadius: '0 8px 8px 0', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#e8e8f0' }}>{new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(94,114,228,.15)', color: '#5e72e4', fontWeight: 600 }}>
                      <i className={`fas ${tipoIcon[c.tipo] || 'fa-ellipsis-h'}`} style={{ marginRight: 4, fontSize: 9 }} />{c.tipo.replace('_', ' ')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => startEditCambio(c)} style={{ color: '#5e72e4', fontSize: 11 }} title="Editar">
                      <i className="fas fa-pen" />
                    </button>
                    {!c.resultado && (
                      <button className="btn btn-ghost btn-sm" onClick={() => startEditCambio(c)} style={{ color: '#00d97e', fontSize: 11, padding: '3px 8px' }} title="Medir resultado">
                        <i className="fas fa-chart-line" /> Medir
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => deleteCambio(c.id)} style={{ color: '#f5365c', fontSize: 11 }}><i className="fas fa-trash" /></button>
                  </div>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{c.descripcion}</div>
                {c.resultado ? (
                  <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(0,217,126,.06)', border: '1px solid #00d97e22', fontSize: 12, color: '#00d97e' }}>
                    <i className="fas fa-chart-line" style={{ marginRight: 6, fontSize: 10 }} />{c.resultado}
                  </div>
                ) : (
                  <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(245,166,35,.06)', border: '1px dashed #f5a62344', fontSize: 11, color: '#f5a623', fontStyle: 'italic' }}>
                    <i className="fas fa-hourglass-half" style={{ marginRight: 6, fontSize: 10 }} />Pendiente medir resultado — click en Medir cuando tengas datos
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: Revisiones */}
      {tab === 'revisiones' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 600 }}>Revisiones del Equipo</span>
              <div style={{ display: 'flex', gap: 4, background: '#0a0a14', border: '1px solid #2a2a40', borderRadius: 8, padding: 3 }}>
                {(['semana', 'mes'] as const).map(p => (
                  <button key={p} onClick={() => setRevisionPeriodo(p)} style={{
                    padding: '5px 12px',
                    background: revisionPeriodo === p ? '#5e72e4' : 'transparent',
                    border: 'none', borderRadius: 6,
                    color: revisionPeriodo === p ? '#fff' : '#a0a0b8',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}>
                    {p === 'semana' ? 'Semanal' : 'Mensual'} ({revisiones.filter(r => r.periodo === p).length})
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => nuevaRevision(revisionPeriodo)}>
              <i className="fas fa-plus" /> Nueva revision {revisionPeriodo === 'semana' ? 'semanal' : 'mensual'}
            </button>
          </div>
          <div className="card-body">
            {showRevisionForm && (
              <div style={{ padding: 16, background: '#1a1a28', borderRadius: 8, marginBottom: 16, border: '1px solid #5e72e455' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#5e72e4' }}>
                    <i className={`fas ${revisionForm.id ? 'fa-pen' : 'fa-plus'}`} style={{ marginRight: 6 }} />
                    {revisionForm.id ? 'Editar' : 'Nueva'} revision {revisionForm.periodo === 'semana' ? 'semanal' : 'mensual'}
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowRevisionForm(false)}><i className="fas fa-times" /></button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 140px 1fr', gap: 12, marginBottom: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="label">Periodo</label>
                    <select className="select-custom" style={{ width: '100%' }} value={revisionForm.periodo} onChange={e => setRevisionForm({ ...revisionForm, periodo: e.target.value as 'semana' | 'mes' })}>
                      <option value="semana">Semanal</option>
                      <option value="mes">Mensual</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="label">Fecha</label>
                    <input className="input" type="date" value={revisionForm.fecha} onChange={e => setRevisionForm({ ...revisionForm, fecha: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="label">Titulo (opcional)</label>
                    <input className="input" placeholder={revisionForm.periodo === 'semana' ? 'Ej: Semana 17 abr — testeo audiencias' : 'Ej: Cierre abril 2026'} value={revisionForm.titulo} onChange={e => setRevisionForm({ ...revisionForm, titulo: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="label"><i className="fas fa-file-lines" style={{ marginRight: 5, color: '#5e72e4' }} />Informe — que paso esta {revisionForm.periodo === 'semana' ? 'semana' : 'mes'}</label>
                  <textarea className="input textarea" placeholder={'Resumen ejecutivo: que se hizo, que paso con la inversion, las metricas, las campanas...'} style={{ minHeight: 100 }} value={revisionForm.informe} onChange={e => setRevisionForm({ ...revisionForm, informe: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="label"><i className="fas fa-lightbulb" style={{ marginRight: 5, color: '#f5a623' }} />Insights — que aprendimos</label>
                  <textarea className="input textarea" placeholder={'Hallazgos, patrones, hipotesis validadas o caidas. Lo que el equipo no quiere olvidar.'} style={{ minHeight: 90 }} value={revisionForm.insights} onChange={e => setRevisionForm({ ...revisionForm, insights: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="label"><i className="fas fa-bullseye" style={{ marginRight: 5, color: '#00d97e' }} />Plan de accion — que hacemos la {revisionForm.periodo === 'semana' ? 'proxima semana' : 'proximo mes'}</label>
                  <textarea className="input textarea" placeholder={'Acciones concretas: subir presupuesto X, lanzar creativo Y, pausar Z, testear W...'} style={{ minHeight: 90 }} value={revisionForm.plan_accion} onChange={e => setRevisionForm({ ...revisionForm, plan_accion: e.target.value })} />
                </div>
                {!revisionForm.id && (
                  <div style={{ padding: '8px 12px', background: 'rgba(94,114,228,.08)', border: '1px solid #5e72e433', borderRadius: 6, fontSize: 11, color: '#a0a0b8', marginBottom: 10 }}>
                    <i className="fas fa-camera" style={{ marginRight: 6, color: '#5e72e4' }} />
                    Vamos a guardar un snapshot de las metricas actuales ({period}) para poder comparar despues.
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={saveRevision}><i className="fas fa-save" /> {revisionForm.id ? 'Guardar cambios' : 'Crear revision'}</button>
                  <button className="btn btn-outline btn-sm" onClick={() => setShowRevisionForm(false)}>Cancelar</button>
                </div>
              </div>
            )}

            {(() => {
              const list = revisiones.filter(r => r.periodo === revisionPeriodo)
              if (list.length === 0 && !showRevisionForm) {
                return (
                  <div style={{ textAlign: 'center', padding: 32, color: '#6a6a80' }}>
                    <i className="fas fa-clipboard-check" style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }} />
                    <div>Sin revisiones {revisionPeriodo === 'semana' ? 'semanales' : 'mensuales'}</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>Cargá la primera revisión cuando termines la reunión del equipo</div>
                  </div>
                )
              }
              return list.map(r => {
                const isOpen = revisionExpandida === r.id
                const f = new Date(r.fecha + 'T12:00:00')
                const fechaLabel = f.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
                const snap = r.metricas_snapshot
                return (
                  <div key={r.id} style={{ marginBottom: 10, background: '#1a1a28', borderRadius: 8, border: isOpen ? '1px solid #5e72e466' : '1px solid #2a2a40', overflow: 'hidden' }}>
                    <div onClick={() => setRevisionExpandida(isOpen ? null : r.id)} style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                        <i className={`fas fa-chevron-${isOpen ? 'down' : 'right'}`} style={{ color: '#6a6a80', fontSize: 11 }} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#e8e8f0' }}>{fechaLabel}</span>
                            <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, background: r.periodo === 'semana' ? 'rgba(94,114,228,.15)' : 'rgba(245,166,35,.15)', color: r.periodo === 'semana' ? '#5e72e4' : '#f5a623', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              {r.periodo === 'semana' ? 'Semanal' : 'Mensual'}
                            </span>
                          </div>
                          {r.titulo ? (
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{r.titulo}</div>
                          ) : (
                            <div style={{ fontSize: 12, color: '#a0a0b8', fontStyle: 'italic' }}>Sin titulo</div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-ghost btn-sm" onClick={() => editarRevision(r)} style={{ color: '#5e72e4' }}><i className="fas fa-pen" /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => deleteRevision(r.id)} style={{ color: '#f5365c' }}><i className="fas fa-trash" /></button>
                      </div>
                    </div>
                    {isOpen && (
                      <div style={{ padding: '0 14px 14px 36px', borderTop: '1px solid #2a2a40' }}>
                        {snap && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '10px 12px', background: '#0a0a14', border: '1px solid #2a2a40', borderRadius: 6, marginTop: 12, fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>
                            <span style={{ color: '#6a6a80' }}>SNAPSHOT:</span>
                            {snap.spend !== undefined && <span><span style={{ color: '#6a6a80' }}>spend</span> <strong>{fmtMoney(snap.spend, account.currency)}</strong></span>}
                            {snap.purchase_value !== undefined && snap.purchase_value > 0 && <span><span style={{ color: '#6a6a80' }}>valor</span> <strong>{fmtMoney(snap.purchase_value, account.currency)}</strong></span>}
                            {snap.spend !== undefined && (snap.purchase_value || 0) > 0 && <span><span style={{ color: '#6a6a80' }}>roas</span> <strong>{((snap.purchase_value || 0) / (snap.spend || 1)).toFixed(2)}x</strong></span>}
                            {snap.purchases !== undefined && snap.purchases > 0 && <span><span style={{ color: '#6a6a80' }}>compras</span> <strong>{snap.purchases}</strong></span>}
                            {snap.leads !== undefined && snap.leads > 0 && <span><span style={{ color: '#6a6a80' }}>leads</span> <strong>{snap.leads}</strong></span>}
                            {snap.messages !== undefined && snap.messages > 0 && <span><span style={{ color: '#6a6a80' }}>msj</span> <strong>{snap.messages}</strong></span>}
                            {snap.ctr !== undefined && <span><span style={{ color: '#6a6a80' }}>ctr</span> <strong>{fmtPct(snap.ctr)}</strong></span>}
                          </div>
                        )}
                        {r.informe && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#5e72e4', marginBottom: 4 }}>
                              <i className="fas fa-file-lines" style={{ marginRight: 5 }} />Informe
                            </div>
                            <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: '#e8e8f0' }}>{r.informe}</div>
                          </div>
                        )}
                        {r.insights && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#f5a623', marginBottom: 4 }}>
                              <i className="fas fa-lightbulb" style={{ marginRight: 5 }} />Insights
                            </div>
                            <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: '#e8e8f0' }}>{r.insights}</div>
                          </div>
                        )}
                        {r.plan_accion && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#00d97e', marginBottom: 4 }}>
                              <i className="fas fa-bullseye" style={{ marginRight: 5 }} />Plan de accion
                            </div>
                            <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: '#e8e8f0' }}>{r.plan_accion}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

function CheckCard({ label, icon, fechaIso, onToggle }: { label: string; icon: string; fechaIso: string | null; onToggle: () => void }) {
  const done = !!fechaIso
  return (
    <button onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      background: done ? 'rgba(0,217,126,.08)' : '#1a1a28',
      border: `1px solid ${done ? '#00d97e55' : '#2a2a40'}`,
      borderRadius: 10,
      cursor: 'pointer',
      width: '100%',
      textAlign: 'left',
      transition: 'all .15s',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: done ? '#00d97e' : 'transparent',
        border: `2px solid ${done ? '#00d97e' : '#3a3a55'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        color: done ? '#04130a' : '#6a6a80',
        fontSize: 13,
      }}>
        {done ? <i className="fas fa-check" /> : <i className={`fas ${icon}`} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: done ? '#00d97e' : '#e8e8f0' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#a0a0b8', marginTop: 2 }}>
          {done
            ? <>Marcado el {new Date(fechaIso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })} · click para desmarcar</>
            : <>No hecho · click para marcar como hecho</>}
        </div>
      </div>
    </button>
  )
}

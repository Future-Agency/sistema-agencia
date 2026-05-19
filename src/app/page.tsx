'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase, type Cliente, type Owner, type Equipo, type AdAccount, type Agencia, type Pieza, type DeudaContenido } from '@/lib/supabase'
import { indexPiezasByLoop, loopEstaCompletado } from '@/lib/piezas'
import { Loading, Toast } from '@/components/ui'
import ConfirmNuevoCicloModal from '@/components/ConfirmNuevoCicloModal'
import TableroGeneral from '@/components/TableroGeneral'
import TableroOnboarding from '@/components/TableroOnboarding'
import TableroCliente from '@/components/TableroCliente'
import TableroOwners from '@/components/TableroOwners'
import TableroProduccion from '@/components/TableroProduccion'
import TableroProduccionMatrix from '@/components/TableroProduccionMatrix'
import TableroProduccionKanban from '@/components/TableroProduccionKanban'
import TableroAnuncios from '@/components/TableroAnuncios'
import ReunionSemanal from '@/components/ReunionSemanal'
import ReporteCliente from '@/components/ReporteCliente'
import TVMode from '@/components/TVMode'
import NuevoClienteModal from '@/components/NuevoClienteModal'
import TableroMetricas from '@/components/TableroMetricas'
import TableroEquipo from '@/components/TableroEquipo'
import TableroEdicion from '@/components/TableroEdicion'
import TableroDiseno from '@/components/TableroDiseno'
import TableroGestion from '@/components/TableroGestion'
import TableroDiagnostico from '@/components/TableroDiagnostico'
import TableroMisTareas from '@/components/TableroMisTareas'
import LoginOverlay from '@/components/LoginOverlay'
import CycleHeader from '@/components/CycleHeader'
import UrgentesBar from '@/components/UrgentesBar'
import StandbyExclusionesModal from '@/components/StandbyExclusionesModal'
import TableroPipeline from '@/components/TableroPipeline'
import TableroGrabCalendar from '@/components/TableroGrabCalendar'
import TableroFechasEspeciales from '@/components/TableroFechasEspeciales'
import TableroPedidosClientes from '@/components/TableroPedidosClientes'
import TableroDeudasContenido from '@/components/TableroDeudasContenido'
import CycleSelector from '@/components/CycleSelector'
import { currentCicloMes, nextCicloMes, comparteCiclo, cicloMesLabel, type CicloMes } from '@/lib/cycles'
import EquipoModal from '@/components/EquipoModal'
import { canSeeView, canEditView, isReadOnlyView, defaultViewFor, initialsFor, type CurrentUser } from '@/lib/users'
import { loadSession, saveSession, clearSession } from '@/lib/session'

type ToastData = { message: string; type: 'success' | 'error' } | null

export default function Home() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [view, setView] = useState('general')
  const [agencias, setAgencias] = useState<Agencia[]>([])
  const [agenciaId, setAgenciaId] = useState<string>('future')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [equipo, setEquipo] = useState<Equipo[]>([])
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([])
  const [piezasAgencia, setPiezasAgencia] = useState<Pieza[]>([])
  const [deudasAgencia, setDeudasAgencia] = useState<DeudaContenido[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)
  const [ownerFilter, setOwnerFilter] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showStandby, setShowStandby] = useState(false)
  const [cycleFilter, setCycleFilter] = useState<CicloMes | null>(currentCicloMes())
  const [startingNewCycle, setStartingNewCycle] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showEquipoModal, setShowEquipoModal] = useState(false)
  const [showStandbyModal, setShowStandbyModal] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [tvMode, setTvMode] = useState(false)
  const [toast, setToast] = useState<ToastData>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error') => setToast({ message, type }), [])

  // Auth: cargar sesión existente al montar
  useEffect(() => {
    const u = loadSession()
    if (u) {
      setCurrentUser(u)
      setView(defaultViewFor(u))
    }
    setAuthChecked(true)
  }, [])

  const handleLogin = useCallback((u: CurrentUser) => {
    saveSession(u)
    setCurrentUser(u)
    setView(defaultViewFor(u))
  }, [])

  const handleLogout = useCallback(() => {
    clearSession()
    setCurrentUser(null)
    setShowUserMenu(false)
  }, [])

  const loadData = useCallback(async () => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('agencia_id') : null
    const ag = stored || 'future'
    const [agenciasRes, ownersRes, clientesRes, equipoRes, adRes] = await Promise.all([
      supabase.from('agencias').select('*').eq('activo', true).order('nombre'),
      supabase.from('owners').select('*').eq('activo', true).eq('agencia_id', ag).order('nombre_corto'),
      supabase.from('clientes').select('*').eq('activo', true).eq('agencia_id', ag).order('nombre'),
      supabase.from('equipo').select('*').eq('activo', true).eq('agencia_id', ag).order('nombre'),
      supabase.from('ad_accounts').select('*').eq('activo', true).eq('agencia_id', ag).order('spend', { ascending: false }),
    ])
    if (agenciasRes.data) setAgencias(agenciasRes.data)
    setAgenciaId(ag)
    if (ownersRes.data) setOwners(ownersRes.data)
    if (clientesRes.data) {
      const newClientes = clientesRes.data
      setClientes(newClientes)
      // Si hay un cliente abierto en detalle, refrescar su row con la versión nueva
      // (sino las actualizaciones de plan/estado/etc no se ven hasta cerrar y reabrir)
      setSelectedCliente(prev => {
        if (!prev) return prev
        const updated = newClientes.find(c => c.id === prev.id)
        return updated ?? prev
      })
    }
    if (equipoRes.data) setEquipo(equipoRes.data)
    if (adRes.data) setAdAccounts(adRes.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (currentUser) loadData()
  }, [loadData, currentUser])

  // Carga global de piezas (toda la agencia, paginado por el límite de 1000 de Supabase).
  // Se usa para: derivar "clientes con piezas en X ciclo" y "loops completados".
  const loadPiezasAgencia = useCallback(async () => {
    const PAGE = 1000
    const all: Pieza[] = []
    for (let page = 0; ; page++) {
      const { data, error } = await supabase
        .from('piezas')
        .select('*')
        .eq('agencia_id', agenciaId)
        .range(page * PAGE, (page + 1) * PAGE - 1)
      if (error) { console.warn('[loadPiezasAgencia]', error); break }
      const rows = (data ?? []) as Pieza[]
      all.push(...rows)
      if (rows.length < PAGE) break
    }
    setPiezasAgencia(all)
  }, [agenciaId])

  useEffect(() => {
    if (currentUser && agenciaId) loadPiezasAgencia()
  }, [currentUser, agenciaId, loadPiezasAgencia])

  // Carga global de deudas pendientes (para gate de cliente completado + badges)
  const loadDeudasAgencia = useCallback(async () => {
    const { data } = await supabase
      .from('deudas_contenido')
      .select('*')
      .eq('agencia_id', agenciaId)
      .eq('estado', 'pendiente')
    setDeudasAgencia((data ?? []) as DeudaContenido[])
  }, [agenciaId])

  useEffect(() => {
    if (currentUser && agenciaId) loadDeudasAgencia()
  }, [currentUser, agenciaId, loadDeudasAgencia])

  // Listener: refrescar piezas y deudas cuando hay cambios cross-tab / realtime (silencioso)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => { loadPiezasAgencia(); loadDeudasAgencia() }
    window.addEventListener('estado-loop-changed', handler)
    window.addEventListener('clientes-refresh', handler)
    return () => {
      window.removeEventListener('estado-loop-changed', handler)
      window.removeEventListener('clientes-refresh', handler)
    }
  }, [loadPiezasAgencia, loadDeudasAgencia])

  // Índice piezas por loop (cliente × ciclo) para chequeos rápidos
  const piezasByLoop = useMemo(() => indexPiezasByLoop(piezasAgencia), [piezasAgencia])

  // Set de cliente_id que tienen piezas en cada ciclo_mes
  const clientesConPiezasEnCiclo = useMemo(() => {
    const m = new Map<string, Set<number>>()
    for (const p of piezasAgencia) {
      if (!m.has(p.ciclo_mes)) m.set(p.ciclo_mes, new Set())
      m.get(p.ciclo_mes)!.add(p.cliente_id)
    }
    return m
  }, [piezasAgencia])

  // Map<cliente_id, count> de deudas pendientes ASIGNADAS al ciclo actual del filtro.
  // Usado por CycleHeader para no marcar como "completado" a clientes con deudas pendientes.
  const deudasPendientesByClienteEnCiclo = useMemo(() => {
    const cycle = cycleFilter ?? currentCicloMes()
    const m = new Map<number, number>()
    for (const d of deudasAgencia) {
      if (d.ciclo_asignado !== cycle) continue
      m.set(d.cliente_id, (m.get(d.cliente_id) ?? 0) + 1)
    }
    return m
  }, [deudasAgencia, cycleFilter])

  // Modal de confirmación pesada antes de mover masivamente todos los clientes al ciclo siguiente.
  const [showNuevoCicloModal, setShowNuevoCicloModal] = useState(false)
  const nuevoCicloFrom = cycleFilter ?? currentCicloMes()
  const nuevoCicloTo = nextCicloMes(nuevoCicloFrom)
  const nuevoCicloAfectados = useMemo(
    () => clientes.filter(c => c.agencia_id === agenciaId && c.activo && !c.standby).length,
    [clientes, agenciaId]
  )

  // Abre el modal — el confirm definitivo está adentro (requiere tipear "NUEVO CICLO")
  const startNewCycle = useCallback(() => {
    setShowNuevoCicloModal(true)
  }, [])

  // Ejecuta el avance de ciclo después de que el modal valida
  const confirmStartNewCycle = useCallback(async () => {
    setShowNuevoCicloModal(false)
    setStartingNewCycle(true)
    const { error } = await supabase
      .from('clientes')
      .update({
        ciclo_mes: nuevoCicloTo,
        estado_copys: '',
        estado_grab: '',
        estado_edicion: '',
        estado_diseno: '',
        estado_subida: '',
        estado_changed_at: new Date().toISOString(),
      })
      .eq('agencia_id', agenciaId)
      .eq('activo', true)
      .or('standby.is.null,standby.eq.false')
    setStartingNewCycle(false)
    if (error) {
      showToast(`Error: ${error.message}`, 'error')
      return
    }
    showToast(`Ciclo "${nuevoCicloTo}" iniciado`, 'success')
    setCycleFilter(nuevoCicloTo)
    loadData()
  }, [agenciaId, nuevoCicloTo, loadData, showToast])

  // Listener: cuando un componente hijo (TableroPipeline) cambia state, recarga
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => { if (currentUser) loadData() }
    window.addEventListener('clientes-refresh', handler)
    return () => window.removeEventListener('clientes-refresh', handler)
  }, [loadData, currentUser])

  // Phase 8 — Realtime sync via Supabase channels
  // Suscripción a cambios en clientes + loop_log para esta agencia.
  // Multi-pestaña / multi-device: cuando otro user cambia algo, refresca.
  const [realtimeStatus, setRealtimeStatus] = useState<'idle' | 'connected' | 'disconnected'>('idle')
  useEffect(() => {
    if (!currentUser || !agenciaId) return
    let pending: ReturnType<typeof setTimeout> | null = null
    const debouncedReload = () => {
      if (pending) clearTimeout(pending)
      pending = setTimeout(() => loadData(), 600)
    }
    const channel = supabase
      .channel(`agencia-${agenciaId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'clientes', filter: `agencia_id=eq.${agenciaId}` },
        debouncedReload
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'loop_log', filter: `agencia_id=eq.${agenciaId}` },
        () => {
          if (typeof window !== 'undefined') window.dispatchEvent(new Event('loops-refresh'))
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'cliente_ciclo_recursos', filter: `agencia_id=eq.${agenciaId}` },
        () => {
          // Cualquier vista que muestre estados por ciclo (OwnerFocoTable, ProduccionKanban, Matrix)
          // se subscribe a este evento y refetchea sus estados manuales
          if (typeof window !== 'undefined') window.dispatchEvent(new Event('estado-loop-changed'))
        }
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setRealtimeStatus('disconnected')
      })
    return () => {
      if (pending) clearTimeout(pending)
      supabase.removeChannel(channel)
      setRealtimeStatus('idle')
    }
  }, [currentUser, agenciaId, loadData])

  const switchAgencia = (id: string) => {
    localStorage.setItem('agencia_id', id)
    setAgenciaId(id)
    setSelectedCliente(null)
    setOwnerFilter('')
    setLoading(true)
    setTimeout(loadData, 50)
  }

  const filteredClientes = useMemo(() => {
    let list = clientes
    if (!showStandby) list = list.filter(c => !c.standby)
    if (cycleFilter !== null) {
      // Un cliente "pertenece al ciclo X" si:
      //   - su cliente.ciclo_mes matchea X (legacy), O
      //   - tiene piezas con ciclo_mes=X (derivado de piezas — fix para que junio aparezca)
      const idsConPiezas = clientesConPiezasEnCiclo.get(cycleFilter) ?? new Set<number>()
      list = list.filter(c => comparteCiclo(c, cycleFilter) || idsConPiezas.has(c.id))
    }
    if (search) list = list.filter(c => c.nombre.toLowerCase().includes(search.toLowerCase()))
    return list
  }, [clientes, search, showStandby, cycleFilter, clientesConPiezasEnCiclo])

  const standbyCount = useMemo(() => clientes.filter(c => c.standby).length, [clientes])

  // Antes de renderizar la app, decidir auth state
  if (!authChecked) {
    return <div style={{ minHeight: '100vh', background: '#0a0a0f' }} />
  }
  if (!currentUser) {
    return <LoginOverlay onLogin={handleLogin} />
  }

  if (tvMode) {
    return (
      <div>
        <TVMode clientes={filteredClientes} owners={owners} />
        <button onClick={() => setTvMode(false)} style={{ position: 'fixed', top: 16, right: 16, background: '#1a1a28', border: '1px solid #2a2a40', borderRadius: 8, padding: '8px 14px', color: '#a0a0b8', cursor: 'pointer', fontSize: 12, zIndex: 999 }}>
          <i className="fas fa-compress" /> Salir TV
        </button>
      </div>
    )
  }

  const allNavItems = [
    // Vista general + flujo de producción (en orden del proceso)
    { id: 'general', icon: 'fa-th-large', label: 'Tablero General' },
    { id: 'produccion', icon: 'fa-clapperboard', label: 'Producción' },
    { id: 'owners', icon: 'fa-user-tie', label: 'Owners' },
    { id: 'copys', icon: 'fa-pen-nib', label: 'Copys (pipeline)' },
    { id: 'grab', icon: 'fa-video', label: 'Grabaciones' },
    { id: 'grab-calendar', icon: 'fa-calendar', label: 'Calendario Grab' },
    { id: 'edicion', icon: 'fa-film', label: 'Edición' },
    { id: 'diseno', icon: 'fa-palette', label: 'Diseño' },
    { id: 'subida', icon: 'fa-rocket', label: 'Subida (pipeline)' },
    { id: 'reporte', icon: 'fa-chart-line', label: 'Reportes (cierre)' },
    { id: 'anuncios', icon: 'fa-rectangle-ad', label: 'Anuncios' },
    // Resto: vistas auxiliares, analítica, admin
    { id: 'mistareas', icon: 'fa-clipboard-list', label: 'Mis Tareas' },
    { id: 'onboarding', icon: 'fa-handshake', label: 'Onboarding' },
    { id: 'gestion', icon: 'fa-fire', label: 'Gestión Operativa' },
    { id: 'diagnostico', icon: 'fa-stethoscope', label: 'Diagnóstico' },
    { id: 'metricas', icon: 'fa-chart-bar', label: 'Métricas' },
    { id: 'fechas', icon: 'fa-star', label: 'Fechas Especiales' },
    { id: 'pedidos', icon: 'fa-box-open', label: 'Pedidos' },
    { id: 'deudas', icon: 'fa-book', label: 'Deudas' },
    { id: 'equipo', icon: 'fa-users-gear', label: 'Equipo' },
  ]
  const navItems = allNavItems.filter(item => canSeeView(currentUser, item.id))

  const viewTitles: Record<string, string> = {
    mistareas: 'Mis Tareas',
    general: 'Tablero General', gestion: 'Gestión Operativa', diagnostico: 'Diagnóstico de Pipeline',
    calendario: 'Calendario del Equipo',
    onboarding: 'Pipeline de Onboarding', owners: 'Tablero de Owners',
    copys: 'Pipeline de Copys', grab: 'Grabaciones', 'grab-calendar': 'Calendario de Grabaciones', subida: 'Pipeline de Subida',
    produccion: 'Tablero de Producción',
    edicion: 'Edición Tracker', diseno: 'Diseño Tracker',
    anuncios: 'Anuncios', metricas: 'Métricas', equipo: 'Equipo',
    fechas: 'Fechas Especiales', pedidos: 'Pedidos Clientes',
    reunion: 'Reunión Semanal', reporte: 'Reportes · Cierre de ciclo',
    detalle: selectedCliente?.nombre || 'Detalle',
  }

  return (
    <div>
      <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="logo">
          <img src="/logo-future.jpg" alt="Future" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
          <span className="logo-text">{agencias.find(a => a.id === agenciaId)?.nombre || 'Future Agency'}</span>
        </div>
        {!sidebarCollapsed && agencias.length > 1 && (
          <div style={{ padding: '0 14px 10px' }}>
            <select value={agenciaId} onChange={e => switchAgencia(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#1a1a28', border: `1px solid ${agencias.find(a => a.id === agenciaId)?.color || '#2a2a40'}55`, color: '#e8e8f0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {agencias.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
        )}
        <div className="nav">
          <div className="nav-label">Tableros</div>
          {navItems.map(item => {
            const isExternalMisTareas = item.id === 'mistareas'
            return (
              <div key={item.id} className={`nav-item ${view === item.id && !selectedCliente ? 'active' : ''}`}
                onClick={() => {
                  if (isExternalMisTareas) {
                    window.open('https://future-gestor.vercel.app/dashboard', '_blank', 'noopener,noreferrer')
                    return
                  }
                  setView(item.id); setSelectedCliente(null)
                }}>
                <i className={`fas ${item.icon}`} />
                {!sidebarCollapsed && (
                  <span>
                    {item.label}
                    {isExternalMisTareas && <i className="fas fa-arrow-up-right-from-square" style={{ marginLeft: 6, fontSize: 9, opacity: 0.6 }} />}
                  </span>
                )}
              </div>
            )
          })}
          <div className="nav-label" style={{ marginTop: 12 }}>Acciones</div>
          <div className="nav-item" onClick={() => setTvMode(true)}><i className="fas fa-tv" />{!sidebarCollapsed && <span>Modo TV</span>}</div>
          {(currentUser.role === 'admin' || currentUser.role === 'semi-admin') && (
            <>
              <div className="nav-item" onClick={() => window.open(`/reporte/${encodeURIComponent(cycleFilter ?? currentCicloMes())}`, '_blank')}>
                <i className="fas fa-file-pdf" />{!sidebarCollapsed && <span>Reporte de cierre</span>}
              </div>
              <div className="nav-item" onClick={() => setShowNewModal(true)}><i className="fas fa-plus-circle" />{!sidebarCollapsed && <span>Nuevo Cliente</span>}</div>
            </>
          )}
          {currentUser.role === 'admin' && (
            <div className="nav-item" onClick={() => setShowEquipoModal(true)}><i className="fas fa-user-plus" />{!sidebarCollapsed && <span>Gestionar Equipo</span>}</div>
          )}
          {currentUser.role === 'admin' && (
            <div className="nav-item" onClick={() => setShowStandbyModal(true)}><i className="fas fa-pause-circle" />{!sidebarCollapsed && <span>Standby & Exclusiones</span>}</div>
          )}
          {currentUser.role === 'admin' && (
            <div className="nav-item" onClick={startNewCycle}
              style={startingNewCycle ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
              <i className="fas fa-rotate-right" />{!sidebarCollapsed && <span>{startingNewCycle ? 'Iniciando…' : 'Iniciar nuevo ciclo'}</span>}
            </div>
          )}
        </div>
        {!sidebarCollapsed && (
          <div className="owner-filter-section">
            <div style={{ fontSize: 11, color: '#6a6a80', marginBottom: 6, fontWeight: 600 }}>FILTRAR POR OWNER</div>
            <div>
              <span className={`owner-chip ${ownerFilter === '' ? 'active' : ''}`} onClick={() => setOwnerFilter('')}>Todos</span>
              {owners.map(o => <span key={o.id} className={`owner-chip ${ownerFilter === o.id ? 'active' : ''}`} onClick={() => setOwnerFilter(ownerFilter === o.id ? '' : o.id)}>{o.nombre_corto}</span>)}
              <span className={`owner-chip ${ownerFilter === '__none__' ? 'active' : ''}`} onClick={() => setOwnerFilter(ownerFilter === '__none__' ? '' : '__none__')} style={ownerFilter === '__none__' ? {} : { fontStyle: 'italic' }}>Sin asignar</span>
            </div>
          </div>
        )}
      </div>

      <div className={`main ${sidebarCollapsed ? 'expanded' : ''}`}>
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-ghost" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}><i className="fas fa-bars" /></button>
            <span className="topbar-title">{viewTitles[selectedCliente ? 'detalle' : view]}</span>
            <span title={realtimeStatus === 'connected' ? 'Realtime sync activo' : realtimeStatus === 'disconnected' ? 'Sin sincronización en tiempo real' : 'Inicializando…'}
              style={{
                fontSize: 11,
                color: realtimeStatus === 'connected' ? '#00d97e' : realtimeStatus === 'disconnected' ? '#f5a623' : '#6a6a80',
                fontWeight: 500,
              }}>
              <i className="fas fa-circle" style={{ fontSize: 6, marginRight: 4 }} />
              {realtimeStatus === 'connected' ? 'Sincronizado' : realtimeStatus === 'disconnected' ? 'Sin sync' : 'Conectando'}
            </span>
          </div>
          <div className="topbar-actions">
            <div className="search-wrap"><i className="fas fa-search" /><input className="search-input" placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} /></div>
            {view === 'general' && !selectedCliente && (
              <>
                <select className="select-custom" value={tipoFilter} onChange={e => setTipoFilter(e.target.value)}>
                  <option value="">Todos los tipos</option><option value="CRM">CRM</option><option value="Tienda Online">Tienda Online</option>
                </select>
                <select className="select-custom" value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)}>
                  <option value="">Todos los estados</option><option value="green">En tiempo</option><option value="yellow">En riesgo</option><option value="red">Críticos</option>
                </select>
              </>
            )}
            <CycleSelector clientes={clientes} value={cycleFilter} onChange={setCycleFilter} />
            {standbyCount > 0 && (
              <button
                onClick={() => setShowStandby(!showStandby)}
                title={showStandby ? 'Ocultar clientes en standby' : `Ver ${standbyCount} en standby`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: showStandby ? 'rgba(245,166,35,.15)' : '#1a1a28',
                  border: `1px solid ${showStandby ? '#f5a623' : '#2a2a40'}`,
                  borderRadius: 8, padding: '6px 10px',
                  color: showStandby ? '#f5a623' : '#a0a0b8',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <i className="fas fa-pause-circle" />
                {showStandby ? 'En standby' : 'Standby'}
                <span style={{ background: showStandby ? '#f5a623' : '#2a2a40', color: showStandby ? '#0a0a0f' : '#a0a0b8', padding: '0 6px', borderRadius: 8, fontSize: 10 }}>{standbyCount}</span>
              </button>
            )}
            <button className="btn btn-ghost" onClick={loadData} title="Refrescar"><i className="fas fa-sync-alt" /></button>
            {/* User chip + logout */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                title={`${currentUser.name} (${currentUser.role})`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: '#1a1a28', border: '1px solid #2a2a40',
                  borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
                  color: '#e8e8f0', fontSize: 12, fontWeight: 600,
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: 6,
                  background: '#5e72e4' + '22', color: '#5e72e4',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 11,
                }}>{initialsFor(currentUser.name)}</span>
                <span style={{ display: 'none' }} className="user-name-show">{currentUser.name}</span>
                <i className="fas fa-chevron-down" style={{ fontSize: 9, color: '#6a6a80' }} />
              </button>
              {showUserMenu && (
                <>
                  <div onClick={() => setShowUserMenu(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
                  <div style={{
                    position: 'absolute', right: 0, top: '100%', marginTop: 6,
                    background: '#1a1a28', border: '1px solid #2a2a40',
                    borderRadius: 10, padding: 6, minWidth: 200, zIndex: 51,
                    boxShadow: '0 8px 24px rgba(0,0,0,.4)',
                  }}>
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid #2a2a40', marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{currentUser.name}</div>
                      <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 2 }}>
                        <i className={`fas ${currentUser.role === 'admin' ? 'fa-shield-halved' : currentUser.role === 'semi-admin' ? 'fa-star' : 'fa-user'}`} style={{ marginRight: 4 }} />
                        {currentUser.role === 'admin' ? 'Admin' : currentUser.role === 'semi-admin' ? 'Líder' : 'Equipo'}
                        {currentUser.role !== 'admin' && currentUser.areas.length > 0 && (
                          <span style={{ marginLeft: 4 }}>· {currentUser.areas.join(', ')}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      style={{
                        width: '100%', textAlign: 'left',
                        background: 'transparent', border: 'none',
                        padding: '8px 12px', borderRadius: 6,
                        color: '#f5365c', fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,54,92,.10)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <i className="fas fa-right-from-bracket" />
                      Cerrar sesión
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="content" style={{ padding: 24 }}>
          {/* Read-only banner */}
          {!loading && !selectedCliente && isReadOnlyView(currentUser, view) && (
            <div style={{
              marginBottom: 16, padding: '10px 14px',
              background: 'rgba(94,114,228,.10)',
              border: '1px solid rgba(94,114,228,.30)',
              borderRadius: 8,
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 12, color: '#a0b4f5',
            }}>
              <i className="fas fa-eye" style={{ color: '#5e72e4' }} />
              <div>
                <strong style={{ color: '#fff' }}>Modo lectura</strong> — esta vista no es de tu área.
                {currentUser.areas.length > 0 && (
                  <> Editás en: <code style={{ background: 'rgba(255,255,255,.06)', padding: '1px 5px', borderRadius: 3 }}>{currentUser.areas.join(', ')}</code></>
                )}
                {' · '}
                <span style={{ opacity: 0.7 }}>los cambios los hacen los admin / responsables del área.</span>
              </div>
            </div>
          )}
          {loading ? <Loading /> : selectedCliente ? (
            <TableroCliente cliente={selectedCliente} owners={owners} equipo={equipo} adAccounts={adAccounts} onBack={() => { setSelectedCliente(null); loadData() }} onUpdate={loadData} onDelete={() => { setSelectedCliente(null); loadData() }} showToast={showToast} agenciaId={agenciaId} currentUser={currentUser} />
          ) : view === 'mistareas' ? (
            <TableroMisTareas user={currentUser} clientes={filteredClientes} owners={owners} equipo={equipo} onSelectCliente={setSelectedCliente} agenciaId={agenciaId} />
          ) : view === 'general' ? (
            <>
              <UrgentesBar clientes={filteredClientes} owners={owners} onSelectCliente={setSelectedCliente} />
              <CycleHeader clientes={filteredClientes} piezasByLoop={piezasByLoop} deudasPendientesByCliente={deudasPendientesByClienteEnCiclo} cicloActual={cycleFilter ?? currentCicloMes()} cycleLabel={cicloMesLabel(cycleFilter ?? currentCicloMes()).split(' ')[0]} />
              <TableroGeneral clientes={filteredClientes} owners={owners} onSelectCliente={setSelectedCliente} ownerFilter={ownerFilter} tipoFilter={tipoFilter} estadoFilter={estadoFilter} />
            </>
          ) : view === 'copys' ? (
            <TableroPipeline area="copys" agenciaId={agenciaId} currentUser={currentUser} clientes={clientes} owners={owners} onSelectCliente={setSelectedCliente} ownerFilter={ownerFilter} cycleFilter={cycleFilter} deudasPendientesByCliente={deudasPendientesByClienteEnCiclo} />
          ) : view === 'grab' ? (
            <TableroPipeline area="grab" agenciaId={agenciaId} currentUser={currentUser} clientes={clientes} owners={owners} onSelectCliente={setSelectedCliente} ownerFilter={ownerFilter} cycleFilter={cycleFilter} deudasPendientesByCliente={deudasPendientesByClienteEnCiclo} />
          ) : view === 'grab-calendar' ? (
            <TableroGrabCalendar agenciaId={agenciaId} clientes={filteredClientes} owners={owners} onSelectCliente={setSelectedCliente} />
          ) : view === 'subida' ? (
            <TableroPipeline area="subida" agenciaId={agenciaId} currentUser={currentUser} clientes={clientes} owners={owners} onSelectCliente={setSelectedCliente} ownerFilter={ownerFilter} cycleFilter={cycleFilter} deudasPendientesByCliente={deudasPendientesByClienteEnCiclo} />
          ) : view === 'reporte' ? (
            <TableroPipeline
              area="anuncios"
              agenciaId={agenciaId}
              currentUser={currentUser}
              clientes={clientes}
              owners={owners}
              onSelectCliente={setSelectedCliente}
              ownerFilter={ownerFilter}
              cycleFilter={cycleFilter}
              deudasPendientesByCliente={deudasPendientesByClienteEnCiclo}
              titleOverride={{
                emoji: '📊',
                title: 'Reportes · Cierre de ciclo',
                subtitle: 'Loops que terminaron subida. Activación de ads, monitoreo y reporte final del mes.',
              }}
            />
          ) : view === 'fechas' ? (
            <TableroFechasEspeciales agenciaId={agenciaId} currentUser={currentUser} clientes={clientes} />
          ) : view === 'pedidos' ? (
            <TableroPedidosClientes agenciaId={agenciaId} clientes={filteredClientes} currentUser={currentUser} />
          ) : view === 'deudas' ? (
            <TableroDeudasContenido agenciaId={agenciaId} clientes={clientes} currentUser={currentUser} />
          ) : view === 'gestion' ? (
            <TableroGestion clientes={filteredClientes} owners={owners} onSelectCliente={setSelectedCliente} ownerFilter={ownerFilter} agenciaId={agenciaId} currentUser={currentUser} equipo={equipo} cicloMes={cycleFilter ?? undefined} />
          ) : view === 'diagnostico' ? (
            <TableroDiagnostico clientes={filteredClientes} owners={owners} onSelectCliente={setSelectedCliente} ownerFilter={ownerFilter} />
          ) : view === 'onboarding' ? (
            <TableroOnboarding clientes={filteredClientes} owners={owners} onSelectCliente={setSelectedCliente} />
          ) : view === 'owners' ? (
            <TableroOwners clientes={filteredClientes} owners={owners} equipo={equipo} onSelectCliente={setSelectedCliente} onUpdate={loadData} currentUser={currentUser} agenciaId={agenciaId} />
          ) : view === 'produccion' ? (
            <TableroProduccionKanban
              agenciaId={agenciaId}
              clientes={filteredClientes}
              owners={owners}
              equipo={equipo}
              currentUser={currentUser}
              onSelectCliente={setSelectedCliente}
              ownerFilter={ownerFilter}
              onSwitchToMatrix={() => setView('produccion-matrix')}
            />
          ) : view === 'produccion-matrix' ? (
            <div>
              <button onClick={() => setView('produccion')}
                style={{ marginBottom: 12, padding: '6px 12px', background: '#1a1a28', border: '1px solid #2a2a40', borderRadius: 6, color: '#a0a0b8', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                <i className="fas fa-arrow-left" style={{ marginRight: 6 }} />Volver al kanban
              </button>
              <TableroProduccionMatrix
                agenciaId={agenciaId}
                clientes={filteredClientes}
                owners={owners}
                currentUser={currentUser}
                onSelectCliente={setSelectedCliente}
                ownerFilter={ownerFilter}
              />
            </div>
          ) : view === 'produccion-legacy' ? (
            <TableroProduccion clientes={filteredClientes} owners={owners} equipo={equipo} onUpdate={loadData} ownerFilter={ownerFilter} onOwnerFilterChange={setOwnerFilter} />
          ) : view === 'edicion' ? (
            <TableroPipeline area="edit" agenciaId={agenciaId} currentUser={currentUser} clientes={clientes} owners={owners} onSelectCliente={setSelectedCliente} ownerFilter={ownerFilter} cycleFilter={cycleFilter} deudasPendientesByCliente={deudasPendientesByClienteEnCiclo} />
          ) : view === 'diseno' ? (
            <TableroPipeline area="diseno" agenciaId={agenciaId} currentUser={currentUser} clientes={clientes} owners={owners} onSelectCliente={setSelectedCliente} ownerFilter={ownerFilter} cycleFilter={cycleFilter} deudasPendientesByCliente={deudasPendientesByClienteEnCiclo} />
          ) : view === 'edicion-legacy' ? (
            <TableroEdicion clientes={filteredClientes} owners={owners} equipo={equipo} onUpdate={loadData} />
          ) : view === 'diseno-legacy' ? (
            <TableroDiseno clientes={filteredClientes} owners={owners} equipo={equipo} onUpdate={loadData} />
          ) : view === 'anuncios' ? (
            <TableroAnuncios clientes={filteredClientes} owners={owners} adAccounts={adAccounts} onUpdate={loadData} agencias={agencias} agenciaId={agenciaId} />
          ) : view === 'metricas' ? (
            <TableroMetricas clientes={filteredClientes} owners={owners} />
          ) : view === 'equipo' ? (
            <TableroEquipo clientes={filteredClientes} equipo={equipo} owners={owners} onUpdate={loadData} />
          ) : view === 'reunion' ? (
            <ReunionSemanal clientes={filteredClientes} owners={owners} />
          ) : view === 'reporte' ? (
            <ReporteCliente clientes={filteredClientes} />
          ) : null}
        </div>
      </div>

      {showNewModal && <NuevoClienteModal owners={owners} agenciaId={agenciaId} onClose={() => setShowNewModal(false)} onSave={() => { setShowNewModal(false); loadData(); showToast('Cliente creado', 'success') }} />}
      {showEquipoModal && <EquipoModal equipo={equipo} agenciaId={agenciaId} onClose={() => setShowEquipoModal(false)} onUpdate={() => { loadData(); setShowEquipoModal(false) }} />}
      {showStandbyModal && (
        <StandbyExclusionesModal
          clientes={clientes}
          onClose={() => setShowStandbyModal(false)}
          onSaved={() => { setShowStandbyModal(false); loadData(); showToast('Cambios guardados', 'success') }}
        />
      )}
      <ConfirmNuevoCicloModal
        open={showNuevoCicloModal}
        fromCiclo={nuevoCicloFrom}
        toCiclo={nuevoCicloTo}
        clientesAfectados={nuevoCicloAfectados}
        onCancel={() => setShowNuevoCicloModal(false)}
        onConfirm={confirmStartNewCycle}
      />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase, type Cliente, type Owner, type Equipo, type AdAccount, type Agencia } from '@/lib/supabase'
import { Loading, Toast } from '@/components/ui'
import TableroGeneral from '@/components/TableroGeneral'
import TableroOnboarding from '@/components/TableroOnboarding'
import TableroCliente from '@/components/TableroCliente'
import TableroOwners from '@/components/TableroOwners'
import TableroProduccion from '@/components/TableroProduccion'
import TableroAnuncios from '@/components/TableroAnuncios'
import ReunionSemanal from '@/components/ReunionSemanal'
import ReporteCliente from '@/components/ReporteCliente'
import TVMode from '@/components/TVMode'
import NuevoClienteModal from '@/components/NuevoClienteModal'
import TableroMetricas from '@/components/TableroMetricas'
import TableroEquipo from '@/components/TableroEquipo'
import TableroEdicion from '@/components/TableroEdicion'
import TableroDiseno from '@/components/TableroDiseno'
import EquipoModal from '@/components/EquipoModal'

type ToastData = { message: string; type: 'success' | 'error' } | null

export default function Home() {
  const [view, setView] = useState('general')
  const [agencias, setAgencias] = useState<Agencia[]>([])
  const [agenciaId, setAgenciaId] = useState<string>('future')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [equipo, setEquipo] = useState<Equipo[]>([])
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)
  const [ownerFilter, setOwnerFilter] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [search, setSearch] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showEquipoModal, setShowEquipoModal] = useState(false)
  const [tvMode, setTvMode] = useState(false)
  const [toast, setToast] = useState<ToastData>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error') => setToast({ message, type }), [])

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
    if (clientesRes.data) setClientes(clientesRes.data)
    if (equipoRes.data) setEquipo(equipoRes.data)
    if (adRes.data) setAdAccounts(adRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const switchAgencia = (id: string) => {
    localStorage.setItem('agencia_id', id)
    setAgenciaId(id)
    setSelectedCliente(null)
    setOwnerFilter('')
    setLoading(true)
    setTimeout(loadData, 50)
  }

  const filteredClientes = useMemo(() => {
    if (!search) return clientes
    return clientes.filter(c => c.nombre.toLowerCase().includes(search.toLowerCase()))
  }, [clientes, search])

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

  const navItems = [
    { id: 'general', icon: 'fa-th-large', label: 'Tablero General' },
    { id: 'onboarding', icon: 'fa-rocket', label: 'Onboarding' },
    { id: 'owners', icon: 'fa-user-tie', label: 'Owners' },
    { id: 'produccion', icon: 'fa-clapperboard', label: 'Producción' },
    { id: 'edicion', icon: 'fa-film', label: 'Edición' },
    { id: 'diseno', icon: 'fa-palette', label: 'Diseño' },
    { id: 'anuncios', icon: 'fa-rectangle-ad', label: 'Anuncios' },
    { id: 'metricas', icon: 'fa-chart-bar', label: 'Métricas' },
    { id: 'equipo', icon: 'fa-users-gear', label: 'Equipo' },
  ]

  const viewTitles: Record<string, string> = {
    general: 'Tablero General', onboarding: 'Pipeline de Onboarding', owners: 'Tablero de Owners', produccion: 'Tablero de Producción',
    edicion: 'Edición Tracker', diseno: 'Diseño Tracker',
    anuncios: 'Anuncios', metricas: 'Métricas', equipo: 'Equipo',
    reunion: 'Reunión Semanal', reporte: 'Reporte para Cliente',
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
          {navItems.map(item => (
            <div key={item.id} className={`nav-item ${view === item.id && !selectedCliente ? 'active' : ''}`}
              onClick={() => { setView(item.id); setSelectedCliente(null) }}>
              <i className={`fas ${item.icon}`} />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </div>
          ))}
          <div className="nav-label" style={{ marginTop: 12 }}>Acciones</div>
          <div className="nav-item" onClick={() => setTvMode(true)}><i className="fas fa-tv" />{!sidebarCollapsed && <span>Modo TV</span>}</div>
          <div className="nav-item" onClick={() => setShowNewModal(true)}><i className="fas fa-plus-circle" />{!sidebarCollapsed && <span>Nuevo Cliente</span>}</div>
          <div className="nav-item" onClick={() => setShowEquipoModal(true)}><i className="fas fa-user-plus" />{!sidebarCollapsed && <span>Gestionar Equipo</span>}</div>
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
            <span style={{ fontSize: 11, color: '#00d97e', fontWeight: 500 }}><i className="fas fa-circle" style={{ fontSize: 6, marginRight: 4 }} />Conectado</span>
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
            <button className="btn btn-ghost" onClick={loadData} title="Refrescar"><i className="fas fa-sync-alt" /></button>
          </div>
        </div>

        <div className="content" style={{ padding: 24 }}>
          {loading ? <Loading /> : selectedCliente ? (
            <TableroCliente cliente={selectedCliente} owners={owners} equipo={equipo} adAccounts={adAccounts} onBack={() => { setSelectedCliente(null); loadData() }} onUpdate={loadData} onDelete={() => { setSelectedCliente(null); loadData() }} showToast={showToast} />
          ) : view === 'general' ? (
            <TableroGeneral clientes={filteredClientes} owners={owners} onSelectCliente={setSelectedCliente} ownerFilter={ownerFilter} tipoFilter={tipoFilter} estadoFilter={estadoFilter} />
          ) : view === 'onboarding' ? (
            <TableroOnboarding clientes={filteredClientes} owners={owners} onSelectCliente={setSelectedCliente} />
          ) : view === 'owners' ? (
            <TableroOwners clientes={filteredClientes} owners={owners} equipo={equipo} onSelectCliente={setSelectedCliente} onUpdate={loadData} />
          ) : view === 'produccion' ? (
            <TableroProduccion clientes={filteredClientes} owners={owners} equipo={equipo} onUpdate={loadData} ownerFilter={ownerFilter} onOwnerFilterChange={setOwnerFilter} />
          ) : view === 'edicion' ? (
            <TableroEdicion clientes={filteredClientes} owners={owners} equipo={equipo} onUpdate={loadData} />
          ) : view === 'diseno' ? (
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
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase, FASES_ONBOARDING, type Cliente, type Owner, type FaseCliente } from '@/lib/supabase'

type Props = {
  clientes: Cliente[]
  owners: Owner[]
  onSelectCliente: (c: Cliente) => void
}

type ClienteWithFases = Cliente & {
  fases: FaseCliente[]
  faseActualIdx: number
  completadas: number
  atrasadas: number
  progreso: number
}

export default function TableroOnboarding({ clientes, owners, onSelectCliente }: Props) {
  const [fasesAll, setFasesAll] = useState<FaseCliente[]>([])
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'pipeline' | 'kanban'>('pipeline')

  const onboardingClientes = useMemo(() => clientes.filter(c => c.is_onboarding && c.activo), [clientes])

  useEffect(() => {
    async function load() {
      if (onboardingClientes.length === 0) { setLoading(false); return }
      const ids = onboardingClientes.map(c => c.id)
      const { data } = await supabase.from('fases_cliente').select('*').in('cliente_id', ids).eq('tipo', 'onboarding').order('orden')
      if (data) setFasesAll(data)
      setLoading(false)
    }
    load()
  }, [onboardingClientes.length])

  async function updateFase(faseId: number, newStatus: string) {
    const sm: Record<string, string> = { done: 'green', active: 'yellow', pending: 'pending' }
    const updates: Record<string, any> = { status: newStatus, semaforo: sm[newStatus] }
    if (newStatus === 'active') updates.fecha_inicio = new Date().toISOString()
    if (newStatus === 'done') updates.fecha_fin = new Date().toISOString()
    await supabase.from('fases_cliente').update(updates).eq('id', faseId)
    const { data } = await supabase.from('fases_cliente').select('*').in('cliente_id', onboardingClientes.map(c => c.id)).eq('tipo', 'onboarding').order('orden')
    if (data) setFasesAll(data)
  }

  const enriched: ClienteWithFases[] = useMemo(() => {
    return onboardingClientes.map(c => {
      const fases = fasesAll.filter(f => f.cliente_id === c.id).sort((a, b) => a.orden - b.orden)
      const completadas = fases.filter(f => f.status === 'done').length
      const activeIdx = fases.findIndex(f => f.status === 'active')
      const faseActualIdx = activeIdx >= 0 ? activeIdx : completadas
      const atrasadas = fases.filter(f => f.status !== 'done' && f.fecha_fin && new Date(f.fecha_fin) < new Date()).length
      const progreso = fases.length > 0 ? (completadas / fases.length) * 100 : 0
      return { ...c, fases, faseActualIdx, completadas, atrasadas, progreso }
    })
  }, [onboardingClientes, fasesAll])

  const filtered = useMemo(() => {
    if (ownerFilter === 'all') return enriched
    return enriched.filter(c => c.owner_id === ownerFilter)
  }, [enriched, ownerFilter])

  const ownersWithCount = useMemo(() => {
    return owners.map(o => ({
      ...o,
      count: enriched.filter(c => c.owner_id === o.id).length,
    })).filter(o => o.count > 0)
  }, [owners, enriched])

  const faseStats = useMemo(() => {
    return FASES_ONBOARDING.map((f, i) => {
      const active = filtered.filter(c => c.fases[i]?.status === 'active').length
      const done = filtered.filter(c => c.fases[i]?.status === 'done').length
      const pending = filtered.length - active - done
      return { ...f, idx: i, active, done, pending }
    })
  }, [filtered])

  const stats = {
    total: filtered.length,
    kickoff: filtered.filter(c => c.faseActualIdx <= 2).length,
    estrategia: filtered.filter(c => c.faseActualIdx >= 3 && c.faseActualIdx <= 7).length,
    produccion: filtered.filter(c => c.faseActualIdx >= 8 && c.faseActualIdx <= 11).length,
    medicion: filtered.filter(c => c.faseActualIdx >= 12).length,
    terminados: filtered.filter(c => c.faseActualIdx >= FASES_ONBOARDING.length).length,
    atrasadas: filtered.filter(c => c.atrasadas > 0).length,
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#6a6a80' }}><i className="fas fa-spinner fa-spin" style={{ fontSize: 24 }} /></div>

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Pipeline de Onboarding</h2>
          <div style={{ fontSize: 12, color: '#6a6a80', marginTop: 2 }}>
            {stats.total} clientes en proceso
            {stats.atrasadas > 0 && <span style={{ color: '#f5365c', marginLeft: 8 }}><i className="fas fa-exclamation-triangle" style={{ marginRight: 4 }} />{stats.atrasadas} con fases atrasadas</span>}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, background: '#1a1a28', padding: 4, borderRadius: 10 }}>
          {(['pipeline', 'kanban'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '6px 12px', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 600,
              background: view === v ? 'linear-gradient(135deg, #5e72e4, #8965e0)' : 'transparent',
              color: view === v ? 'white' : '#8a8aa0',
            }}>
              <i className={`fas ${v === 'pipeline' ? 'fa-stream' : 'fa-columns'}`} style={{ marginRight: 4 }} />
              {v === 'pipeline' ? 'Pipeline' : 'Kanban'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Kick Off', value: stats.kickoff, icon: 'fa-handshake', color: '#5e72e4' },
          { label: 'Estrategia', value: stats.estrategia, icon: 'fa-brain', color: '#8965e0' },
          { label: 'Produccion', value: stats.produccion, icon: 'fa-video', color: '#f5a623' },
          { label: 'Medicion', value: stats.medicion, icon: 'fa-chart-line', color: '#00d97e' },
        ].map(s => (
          <div key={s.label} className="card" style={{ margin: 0 }}>
            <div className="card-body" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: s.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`fas ${s.icon}`} style={{ color: s.color, fontSize: 16 }} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: '#6a6a80', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Owner filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#6a6a80', fontWeight: 600, marginRight: 4 }}>OWNER:</span>
        <button onClick={() => setOwnerFilter('all')} style={{
          padding: '5px 12px', border: 'none', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 600,
          background: ownerFilter === 'all' ? 'linear-gradient(135deg, #5e72e4, #8965e0)' : '#1a1a28',
          color: ownerFilter === 'all' ? 'white' : '#8a8aa0',
        }}>
          Todos ({enriched.length})
        </button>
        {ownersWithCount.map(o => (
          <button key={o.id} onClick={() => setOwnerFilter(o.id)} style={{
            padding: '5px 12px', border: 'none', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 600,
            background: ownerFilter === o.id ? o.color : '#1a1a28',
            color: ownerFilter === o.id ? 'white' : '#8a8aa0',
          }}>
            {o.nombre_corto} ({o.count})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#6a6a80' }}>
          <i className="fas fa-rocket" style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Sin clientes en onboarding</div>
          <div style={{ fontSize: 12 }}>Cuando marques un cliente como onboarding, aparece aca</div>
        </div>
      ) : view === 'pipeline' ? (
        <PipelineView clientes={filtered} owners={owners} onSelectCliente={onSelectCliente} onUpdateFase={updateFase} />
      ) : (
        <KanbanView clientes={filtered} owners={owners} faseStats={faseStats} onSelectCliente={onSelectCliente} />
      )}
    </div>
  )
}

// ============ PIPELINE VIEW (flujo tipo cañerias) ============
function PipelineView({ clientes, owners, onSelectCliente, onUpdateFase }: {
  clientes: ClienteWithFases[]
  owners: Owner[]
  onSelectCliente: (c: Cliente) => void
  onUpdateFase: (faseId: number, status: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {clientes.map(c => {
        const owner = owners.find(o => o.id === c.owner_id)
        return (
          <div key={c.id} className="card" style={{ margin: 0, overflow: 'hidden' }}>
            <div className="card-body" style={{ padding: 16 }}>
              {/* Cliente header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div onClick={() => onSelectCliente(c)} style={{ cursor: 'pointer', flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8f0' }}>{c.nombre}</div>
                  <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
                    {owner && <span style={{ color: owner.color, fontWeight: 600 }}>{owner.nombre_corto}</span>}
                    <span>·</span>
                    <span>{c.tipo}</span>
                    <span>·</span>
                    <span>{c.completadas}/{c.fases.length} fases</span>
                    {c.atrasadas > 0 && (
                      <>
                        <span>·</span>
                        <span style={{ color: '#f5365c', fontWeight: 600 }}><i className="fas fa-exclamation-triangle" style={{ marginRight: 3 }} />{c.atrasadas} atrasada{c.atrasadas > 1 ? 's' : ''}</span>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ minWidth: 120, textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: c.progreso >= 75 ? '#00d97e' : c.progreso >= 40 ? '#f5a623' : '#5e72e4' }}>
                    {Math.round(c.progreso)}%
                  </div>
                  <div style={{ fontSize: 10, color: '#6a6a80' }}>completado</div>
                </div>
              </div>

              {/* Pipeline tipo canerias */}
              <div style={{ display: 'flex', alignItems: 'stretch', gap: 2, overflowX: 'auto', padding: '4px 0' }}>
                {FASES_ONBOARDING.map((fase, idx) => {
                  const f = c.fases.find(x => x.orden === idx)
                  if (!f) return null
                  const isLast = idx === FASES_ONBOARDING.length - 1
                  const isDone = f.status === 'done'
                  const isActive = f.status === 'active'
                  const isOverdue = f.fecha_fin && f.status !== 'done' && new Date(f.fecha_fin) < new Date()

                  const bg = isDone ? 'linear-gradient(90deg, #00d97e22, #00d97e08)'
                    : isActive ? `linear-gradient(90deg, ${owner?.color || '#5e72e4'}44, ${owner?.color || '#5e72e4'}15)`
                      : isOverdue ? 'linear-gradient(90deg, #f5365c22, #f5365c08)'
                        : 'transparent'

                  const border = isDone ? '#00d97e' : isActive ? (owner?.color || '#5e72e4') : isOverdue ? '#f5365c' : '#2a2a40'
                  const textColor = isDone ? '#00d97e' : isActive ? '#fff' : isOverdue ? '#f5365c' : '#4a4a60'

                  return (
                    <div key={fase.id} style={{ position: 'relative', flex: '1 0 110px', display: 'flex', alignItems: 'stretch' }}>
                      <div
                        onClick={() => {
                          const next = f.status === 'pending' ? 'active' : f.status === 'active' ? 'done' : 'pending'
                          onUpdateFase(f.id, next)
                        }}
                        title={`${fase.name} — ${f.status === 'pending' ? 'Pendiente' : f.status === 'active' ? 'En curso' : 'Completado'} (click para cambiar)`}
                        style={{
                          flex: 1,
                          padding: '8px 10px',
                          background: bg,
                          border: `1px solid ${border}55`,
                          borderLeftWidth: idx === 0 ? 1 : 0,
                          borderRadius: idx === 0 ? '8px 0 0 8px' : isLast ? '0 8px 8px 0' : 0,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 3,
                          minWidth: 100,
                          position: 'relative',
                          transition: 'all .15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <i className={`fas ${fase.icon}`} style={{ fontSize: 10, color: textColor }} />
                          {isDone && <i className="fas fa-check-circle" style={{ fontSize: 9, color: '#00d97e', marginLeft: 'auto' }} />}
                          {isActive && <div style={{ width: 6, height: 6, borderRadius: '50%', background: owner?.color || '#5e72e4', marginLeft: 'auto', animation: 'pulse 1.5s infinite' }} />}
                          {isOverdue && !isDone && <i className="fas fa-exclamation-triangle" style={{ fontSize: 9, color: '#f5365c', marginLeft: 'auto' }} />}
                        </div>
                        <div style={{ fontSize: 9, fontWeight: 600, color: textColor, lineHeight: 1.2, minHeight: 20 }}>
                          {fase.name}
                        </div>
                      </div>
                      {!isLast && (
                        <div style={{
                          width: 0, borderTop: '8px solid transparent', borderBottom: '8px solid transparent',
                          borderLeft: `8px solid ${isDone ? '#00d97e66' : '#2a2a4066'}`,
                          alignSelf: 'center', zIndex: 2, marginLeft: -4,
                        }} />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Info del proximo paso */}
              {(() => {
                const activa = c.fases.find(f => f.status === 'active')
                const siguiente = c.fases.find(f => f.status === 'pending')
                const info = activa || siguiente
                if (!info) return null
                return (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: '#0a0a14', borderRadius: 8, fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className={`fas ${activa ? 'fa-play-circle' : 'fa-forward'}`} style={{ color: activa ? (owner?.color || '#5e72e4') : '#6a6a80' }} />
                    <span style={{ color: '#6a6a80' }}>{activa ? 'En curso:' : 'Proximo:'}</span>
                    <span style={{ fontWeight: 600, color: '#e8e8f0' }}>{info.nombre}</span>
                    {info.fecha_fin && (
                      <span style={{ marginLeft: 'auto', color: new Date(info.fecha_fin) < new Date() ? '#f5365c' : '#6a6a80' }}>
                        <i className="fas fa-calendar" style={{ marginRight: 4, fontSize: 9 }} />
                        {new Date(info.fecha_fin).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        )
      })}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}

// ============ KANBAN VIEW (columna por fase) ============
function KanbanView({ clientes, owners, faseStats, onSelectCliente }: {
  clientes: ClienteWithFases[]
  owners: Owner[]
  faseStats: Array<{ id: string; name: string; icon: string; idx: number; active: number; done: number; pending: number }>
  onSelectCliente: (c: Cliente) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 12 }}>
      {faseStats.map(fs => {
        const inThisFase = clientes.filter(c => c.faseActualIdx === fs.idx && !c.fases[fs.idx]?.status?.includes('done'))
        const activosAqui = clientes.filter(c => c.fases[fs.idx]?.status === 'active')
        return (
          <div key={fs.id} style={{ flex: '0 0 240px', background: '#0a0a14', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 6, borderBottom: '1px solid #1a1a28' }}>
              <i className={`fas ${fs.icon}`} style={{ color: '#5e72e4', fontSize: 12 }} />
              <div style={{ fontSize: 11, fontWeight: 700, flex: 1, lineHeight: 1.2 }}>{fs.name}</div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10, background: '#1a1a28', color: '#5e72e4' }}>{activosAqui.length}</span>
            </div>
            {activosAqui.length === 0 && (
              <div style={{ fontSize: 10, color: '#4a4a60', padding: '16px 4px', textAlign: 'center', fontStyle: 'italic' }}>Sin clientes</div>
            )}
            {activosAqui.map(c => {
              const owner = owners.find(o => o.id === c.owner_id)
              const activa = c.fases[fs.idx]
              const overdue = activa?.fecha_fin && new Date(activa.fecha_fin) < new Date()
              return (
                <div key={c.id} onClick={() => onSelectCliente(c)} style={{
                  padding: 10, background: '#1a1a28', borderRadius: 8, cursor: 'pointer',
                  borderLeft: `3px solid ${overdue ? '#f5365c' : owner?.color || '#5e72e4'}`,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{c.nombre}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#6a6a80' }}>
                    {owner && <span style={{ color: owner.color, fontWeight: 600 }}>{owner.nombre_corto}</span>}
                    <span>{Math.round(c.progreso)}%</span>
                  </div>
                  {overdue && (
                    <div style={{ fontSize: 9, color: '#f5365c', marginTop: 4, fontWeight: 600 }}>
                      <i className="fas fa-exclamation-triangle" style={{ marginRight: 3 }} />Atrasado
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

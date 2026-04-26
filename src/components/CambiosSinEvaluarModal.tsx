'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase, type AdAccount } from '@/lib/supabase'

type Props = {
  agenciaId: string
  onClose: () => void
}

type CambioPendiente = {
  id: number
  ad_account_id: number
  fecha: string
  tipo: string
  descripcion: string
  resultado: string
  created_at: string
  account_name: string
  account_id: string
  cliente_nombre: string | null
  owner_id: string | null
}

const TIPOS_CAMBIO = ['optimizacion', 'cambio_estructura', 'creativo', 'presupuesto', 'audiencia', 'copy', 'otro']
const tipoIcon: Record<string, string> = {
  optimizacion: 'fa-sliders-h', cambio_estructura: 'fa-sitemap', creativo: 'fa-paint-brush',
  presupuesto: 'fa-dollar-sign', audiencia: 'fa-users', copy: 'fa-pen', otro: 'fa-ellipsis-h',
}

function diasAtras(fecha: string): { texto: string; color: string } {
  const f = new Date(fecha + 'T12:00:00')
  const dias = Math.floor((Date.now() - f.getTime()) / (1000 * 60 * 60 * 24))
  if (dias === 0) return { texto: 'Hoy', color: '#5e72e4' }
  if (dias === 1) return { texto: 'Ayer', color: '#5e72e4' }
  if (dias <= 3) return { texto: `Hace ${dias}d`, color: '#5e72e4' }
  if (dias <= 7) return { texto: `Hace ${dias}d`, color: '#f5a623' }
  if (dias <= 14) return { texto: `Hace ${dias}d`, color: '#fc6e51' }
  return { texto: `Hace ${dias}d`, color: '#f5365c' }
}

export default function CambiosSinEvaluarModal({ agenciaId, onClose }: Props) {
  const [cambios, setCambios] = useState<CambioPendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [filterOwner, setFilterOwner] = useState<string>('all')
  const [filterTipo, setFilterTipo] = useState<string>('all')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ resultado: '', fecha: '', tipo: '', descripcion: '' })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    // Traer cambios sin resultado, joineando ad_accounts (filtrado por agencia) y clientes
    const { data: ads } = await supabase.from('ad_accounts').select('id, account_name, account_id, cliente_id, agencia_id').eq('agencia_id', agenciaId).eq('activo', true)
    if (!ads || ads.length === 0) { setCambios([]); setLoading(false); return }

    const accountIds = ads.map(a => a.id)
    const { data: cambiosRaw } = await supabase
      .from('ad_cambios_log')
      .select('*')
      .in('ad_account_id', accountIds)
      .or('resultado.is.null,resultado.eq.')
      .order('fecha', { ascending: true })

    if (!cambiosRaw) { setCambios([]); setLoading(false); return }

    // Traer clientes para nombres y owner
    const clienteIdsArr = ads.map(a => a.cliente_id).filter(Boolean) as number[]
    const clienteIds = Array.from(new Set(clienteIdsArr))
    const { data: clis } = clienteIds.length > 0
      ? await supabase.from('clientes').select('id, nombre, owner_id').in('id', clienteIds)
      : { data: [] as any[] }

    const clienteMap = new Map((clis || []).map(c => [c.id, c]))
    const accountMap = new Map(ads.map(a => [a.id, a]))

    const enriched: CambioPendiente[] = cambiosRaw.map(c => {
      const acc = accountMap.get(c.ad_account_id)
      const cli = acc?.cliente_id ? clienteMap.get(acc.cliente_id) : null
      return {
        id: c.id,
        ad_account_id: c.ad_account_id,
        fecha: c.fecha,
        tipo: c.tipo,
        descripcion: c.descripcion,
        resultado: c.resultado || '',
        created_at: c.created_at,
        account_name: acc?.account_name || '—',
        account_id: acc?.account_id || '',
        cliente_nombre: cli?.nombre || null,
        owner_id: cli?.owner_id || null,
      }
    })

    setCambios(enriched)
    setLoading(false)
  }

  const owners = useMemo(() => {
    const map = new Map<string, number>()
    cambios.forEach(c => { if (c.owner_id) map.set(c.owner_id, (map.get(c.owner_id) || 0) + 1) })
    return Array.from(map.entries()).map(([id, count]) => ({ id, count }))
  }, [cambios])

  const filtered = useMemo(() => {
    return cambios.filter(c => {
      if (filterOwner !== 'all' && c.owner_id !== filterOwner) return false
      if (filterTipo !== 'all' && c.tipo !== filterTipo) return false
      return true
    })
  }, [cambios, filterOwner, filterTipo])

  function startEdit(c: CambioPendiente) {
    setEditingId(c.id)
    setEditForm({ resultado: '', fecha: c.fecha, tipo: c.tipo, descripcion: c.descripcion })
  }

  async function saveEdit() {
    if (!editingId) return
    await supabase.from('ad_cambios_log').update({
      resultado: editForm.resultado,
      fecha: editForm.fecha,
      tipo: editForm.tipo,
      descripcion: editForm.descripcion,
    }).eq('id', editingId)
    setEditingId(null)
    load()
  }

  async function deleteCambio(id: number) {
    if (!confirm('Eliminar este cambio?')) return
    await supabase.from('ad_cambios_log').delete().eq('id', id)
    load()
  }

  // Stats por antiguedad
  const stats = {
    total: filtered.length,
    masDeUnaSemana: filtered.filter(c => {
      const dias = Math.floor((Date.now() - new Date(c.fecha + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24))
      return dias > 7
    }).length,
    masDe14: filtered.filter(c => {
      const dias = Math.floor((Date.now() - new Date(c.fecha + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24))
      return dias > 14
    }).length,
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 1100, width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              <i className="fas fa-hourglass-half" style={{ color: '#f5a623', marginRight: 8 }} />
              Cambios sin Evaluar
            </div>
            <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 2 }}>
              {stats.total} pendientes
              {stats.masDeUnaSemana > 0 && <span style={{ color: '#fc6e51', marginLeft: 8 }}>· {stats.masDeUnaSemana} con +7 dias</span>}
              {stats.masDe14 > 0 && <span style={{ color: '#f5365c', marginLeft: 8 }}>· {stats.masDe14} con +14 dias</span>}
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose}><i className="fas fa-times" /></button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#6a6a80', fontWeight: 600 }}>OWNER:</span>
            <button onClick={() => setFilterOwner('all')} style={{
              padding: '4px 10px', border: 'none', borderRadius: 14, cursor: 'pointer', fontSize: 11, fontWeight: 600,
              background: filterOwner === 'all' ? 'linear-gradient(135deg, #5e72e4, #8965e0)' : '#1a1a28',
              color: filterOwner === 'all' ? 'white' : '#8a8aa0',
            }}>Todos ({cambios.length})</button>
            {owners.map(o => (
              <button key={o.id} onClick={() => setFilterOwner(o.id)} style={{
                padding: '4px 10px', border: 'none', borderRadius: 14, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                background: filterOwner === o.id ? 'linear-gradient(135deg, #5e72e4, #8965e0)' : '#1a1a28',
                color: filterOwner === o.id ? 'white' : '#8a8aa0', textTransform: 'capitalize',
              }}>{o.id} ({o.count})</button>
            ))}
            <span style={{ marginLeft: 12, fontSize: 10, color: '#6a6a80', fontWeight: 600 }}>TIPO:</span>
            <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className="select-custom" style={{ fontSize: 11, padding: '4px 8px' }}>
              <option value="all">Todos</option>
              {TIPOS_CAMBIO.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>

          {/* Listado */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6a6a80' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: 24 }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#6a6a80' }}>
              <i className="fas fa-check-circle" style={{ fontSize: 40, marginBottom: 14, color: '#00d97e', opacity: 0.4 }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Todos los cambios estan evaluados</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>No hay optimizaciones pendientes de medir resultados</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(c => {
                const ant = diasAtras(c.fecha)
                const isEditing = editingId === c.id
                return isEditing ? (
                  <div key={c.id} style={{ padding: 14, borderLeft: '3px solid #f5a623', background: 'rgba(245,166,35,.08)', borderRadius: '0 8px 8px 0' }}>
                    <div style={{ fontSize: 11, color: '#f5a623', fontWeight: 700, marginBottom: 8 }}>
                      <i className="fas fa-pen" style={{ marginRight: 6 }} />
                      Editando · {c.cliente_nombre || c.account_name}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, marginBottom: 8 }}>
                      <input className="input" type="date" value={editForm.fecha} onChange={e => setEditForm({ ...editForm, fecha: e.target.value })} style={{ fontSize: 11 }} />
                      <select className="select-custom" style={{ width: '100%', fontSize: 11 }} value={editForm.tipo} onChange={e => setEditForm({ ...editForm, tipo: e.target.value })}>
                        {TIPOS_CAMBIO.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                      </select>
                    </div>
                    <textarea className="input textarea" placeholder="Que se hizo" value={editForm.descripcion} onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })} style={{ fontSize: 12, marginBottom: 6 }} />
                    <textarea className="input textarea" placeholder="Resultado medido (CPR, ROAS, conversion, tiempo...)" value={editForm.resultado} onChange={e => setEditForm({ ...editForm, resultado: e.target.value })} style={{ fontSize: 12, marginBottom: 8, borderColor: '#00d97e', minHeight: 60 }} autoFocus />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={saveEdit}><i className="fas fa-save" /> Guardar</button>
                      <button className="btn btn-outline btn-sm" onClick={() => setEditingId(null)}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div key={c.id} style={{
                    padding: 12, borderLeft: `3px solid ${ant.color}`, background: '#1a1a28', borderRadius: '0 8px 8px 0',
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                  }}>
                    {/* Antiguedad */}
                    <div style={{ minWidth: 80, textAlign: 'center', paddingTop: 2 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: ant.color }}>{ant.texto}</div>
                      <div style={{ fontSize: 9, color: '#6a6a80', marginTop: 2 }}>
                        {new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>

                    {/* Contenido */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#e8e8f0' }}>
                          {c.cliente_nombre || c.account_name}
                        </span>
                        {c.cliente_nombre && c.cliente_nombre !== c.account_name && (
                          <span style={{ fontSize: 10, color: '#6a6a80' }}>· {c.account_name}</span>
                        )}
                        {c.owner_id && (
                          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#0a0a14', color: '#8a8aa0', textTransform: 'capitalize' }}>
                            {c.owner_id}
                          </span>
                        )}
                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(94,114,228,.15)', color: '#5e72e4', fontWeight: 600 }}>
                          <i className={`fas ${tipoIcon[c.tipo] || 'fa-ellipsis-h'}`} style={{ marginRight: 3, fontSize: 8 }} />{c.tipo.replace('_', ' ')}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#a0a0b8', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.descripcion}</div>
                    </div>

                    {/* Acciones */}
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => startEdit(c)} className="btn btn-sm" style={{
                        background: 'linear-gradient(135deg, #00d97e, #1cb878)', color: 'white', fontSize: 10, padding: '4px 10px',
                      }}>
                        <i className="fas fa-chart-line" /> Medir
                      </button>
                      <button onClick={() => deleteCambio(c.id)} className="btn btn-ghost btn-sm" style={{ color: '#f5365c', fontSize: 11 }}>
                        <i className="fas fa-trash" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ background: '#0a0a14', borderTop: '1px solid #1a1a28', padding: 12 }}>
          <div style={{ fontSize: 10, color: '#6a6a80', flex: 1 }}>
            <i className="fas fa-info-circle" style={{ marginRight: 4 }} />
            Ordenado de mas viejo a mas reciente. Click en "Medir" para registrar el resultado.
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

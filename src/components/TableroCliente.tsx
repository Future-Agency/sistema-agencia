'use client'
import { useState, useEffect } from 'react'
import { supabase, type Cliente, type Owner, type Equipo, type FaseCliente, type Nota, type Reporte, type AdAccount, type PeriodMetrics } from '@/lib/supabase'
import { updateEstado } from '@/lib/estadoHelper'
import { SemaforoIcon, Badge } from './ui'
import { generarReportePDF } from '@/lib/reportePDF'

type Props = { cliente: Cliente; owners: Owner[]; equipo: Equipo[]; adAccounts: AdAccount[]; onBack: () => void; onUpdate: () => void; onDelete: () => void; showToast: (msg: string, type: 'success' | 'error') => void }

export default function TableroCliente({ cliente, owners, equipo, adAccounts, onBack, onUpdate, onDelete, showToast }: Props) {
  const [reportePeriod, setReportePeriod] = useState<'7d' | '15d' | '30d'>('30d')
  const cuentasCliente = adAccounts.filter(a => a.cliente_id === cliente.id)
  const [tab, setTab] = useState('proceso')
  const [nota, setNota] = useState('')
  const [notas, setNotas] = useState<Nota[]>([])
  const [fases, setFases] = useState<FaseCliente[]>([])
  const [reportes, setReportes] = useState<Reporte[]>([])
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState({ ...cliente })
  const owner = owners.find(o => o.id === cliente.owner_id)

  useEffect(() => { loadDetails() }, [cliente.id])

  async function loadDetails() {
    const [f, n, r] = await Promise.all([
      supabase.from('fases_cliente').select('*').eq('cliente_id', cliente.id).order('orden'),
      supabase.from('notas').select('*').eq('cliente_id', cliente.id).order('created_at', { ascending: false }),
      supabase.from('reportes').select('*').eq('cliente_id', cliente.id).order('created_at', { ascending: false }),
    ])
    if (f.data) setFases(f.data)
    if (n.data) setNotas(n.data)
    if (r.data) setReportes(r.data)
  }

  async function saveCliente() {
    // Si el estado cambió, registrar en estado_log
    if (form.estado !== cliente.estado) {
      await updateEstado(cliente.id, form.estado, cliente.estado)
    }
    const { error } = await supabase.from('clientes').update({
      nombre: form.nombre, estado: form.estado, semaforo_general: form.semaforo_general,
      proximo_hito: form.proximo_hito, riesgo: form.riesgo, objetivo: form.objetivo,
      progreso: Number(form.progreso) || 0, owner_id: form.owner_id, tipo: form.tipo,
      ultimo_contacto: form.ultimo_contacto, ultima_publicacion: form.ultima_publicacion,
      editor_id: form.editor_id || null, copy_id: form.copy_id || null, disenador_id: form.disenador_id || null,
      updated_at: new Date().toISOString(),
    }).eq('id', cliente.id)
    if (!error) { showToast('Cliente actualizado', 'success'); setEditing(false); onUpdate() }
    else showToast('Error al guardar', 'error')
  }

  async function addNota() {
    if (!nota.trim()) return
    const { error } = await supabase.from('notas').insert({ cliente_id: cliente.id, texto: nota, autor: owner?.nombre_corto || '' })
    if (!error) { setNota(''); loadDetails(); showToast('Nota guardada', 'success') }
  }

  async function updateFase(faseId: number, newStatus: string) {
    const sm: Record<string, string> = { done: 'green', active: 'yellow', pending: 'pending' }
    const updates: Record<string, any> = { status: newStatus, semaforo: sm[newStatus] }
    if (newStatus === 'active' ) updates.fecha_inicio = new Date().toISOString()
    if (newStatus === 'done') updates.fecha_fin = new Date().toISOString()
    await supabase.from('fases_cliente').update(updates).eq('id', faseId)
    loadDetails()
  }

  async function updateFaseDeadline(faseId: number, field: 'fecha_inicio' | 'fecha_fin', value: string) {
    await supabase.from('fases_cliente').update({ [field]: value ? new Date(value).toISOString() : null }).eq('id', faseId)
    loadDetails()
  }

  function formatDateForInput(dateStr: string | null): string {
    if (!dateStr) return ''
    try { return new Date(dateStr).toISOString().split('T')[0] } catch { return '' }
  }

  function isOverdue(f: FaseCliente): boolean {
    if (f.status === 'done' || !f.fecha_fin) return false
    return new Date() > new Date(f.fecha_fin)
  }

  function getDaysLeft(f: FaseCliente): string | null {
    if (f.status === 'done' || !f.fecha_fin) return null
    const diff = Math.ceil((new Date(f.fecha_fin).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return `${Math.abs(diff)}d vencido`
    if (diff === 0) return 'Hoy'
    return `${diff}d restantes`
  }

  async function deleteCliente() {
    const { error } = await supabase.from('clientes').delete().eq('id', cliente.id)
    if (!error) {
      showToast(`${cliente.nombre} eliminado`, 'success')
      onDelete()
    } else {
      showToast('Error al eliminar: ' + error.message, 'error')
    }
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-ghost" onClick={onBack}><i className="fas fa-arrow-left" /></button>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>{cliente.nombre}</h2>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
            <Badge color={cliente.tipo === 'CRM' ? 'blue' : 'purple'}>{cliente.tipo}</Badge>
            <Badge color={cliente.is_onboarding ? 'yellow' : 'default'}>{cliente.is_onboarding ? 'Onboarding' : 'Ongoing'}</Badge>
            <span style={{ fontSize: 12, color: owner?.color, fontWeight: 600 }}>Owner: {owner?.nombre}</span>
            {[
              { member: equipo.find(e => e.id === cliente.editor_id), icon: 'fa-film' },
              { member: equipo.find(e => e.id === cliente.copy_id), icon: 'fa-pen-fancy' },
              { member: equipo.find(e => e.id === cliente.disenador_id), icon: 'fa-palette' },
            ].filter(t => t.member).map(t => (
              <span key={t.member!.id} style={{ fontSize: 11, color: t.member!.color, fontWeight: 500 }}>
                <i className={`fas ${t.icon}`} style={{ fontSize: 9, marginRight: 3 }} />{t.member!.nombre}
              </span>
            ))}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginRight: 4 }}>
            <select className="editable-select" value={reportePeriod} onChange={e => setReportePeriod(e.target.value as any)} style={{ fontSize: 11 }}>
              <option value="7d">7 días</option>
              <option value="15d">15 días</option>
              <option value="30d">30 días</option>
            </select>
            <button className="btn btn-sm" style={{ background: 'linear-gradient(135deg, #5e72e4, #8965e0)', color: 'white' }}
              title={cuentasCliente.length === 0 ? 'Vincula una cuenta desde Anuncios para incluir metricas' : `${cuentasCliente.length} cuenta(s) vinculada(s)`}
              onClick={() => {
                if (cuentasCliente.length === 0) {
                  showToast('Este cliente no tiene cuentas de Meta Ads vinculadas. Vincula una desde el tablero Anuncios.', 'error')
                  return
                }
                try {
                  generarReportePDF({ cliente, owner, cuentas: cuentasCliente, period: reportePeriod })
                  showToast('Reporte generado', 'success')
                } catch (err: any) {
                  showToast('Error: ' + err.message, 'error')
                }
              }}>
              <i className="fas fa-file-pdf" /> Reporte PDF {cuentasCliente.length > 0 ? `(${cuentasCliente.length})` : ''}
            </button>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => setEditing(!editing)}>
            <i className={`fas ${editing ? 'fa-times' : 'fa-pen'}`} /> {editing ? 'Cancelar' : 'Editar'}
          </button>
          {editing && <button className="btn btn-primary btn-sm" onClick={saveCliente}><i className="fas fa-save" /> Guardar</button>}
          {!confirmDelete ? (
            <button className="btn btn-sm" style={{ background: 'transparent', border: '1px solid #f5365c', color: '#f5365c' }} onClick={() => setConfirmDelete(true)}>
              <i className="fas fa-trash" /> Eliminar
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#f5365c', marginRight: 4 }}>¿Seguro?</span>
              <button className="btn btn-sm" style={{ background: '#f5365c', color: 'white' }} onClick={deleteCliente}>Sí, eliminar</button>
              <button className="btn btn-outline btn-sm" onClick={() => setConfirmDelete(false)}>No</button>
            </div>
          )}
        </div>
      </div>

      {editing ? (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group"><label className="label">Nombre</label><input className="input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></div>
              <div className="form-group"><label className="label">Estado</label><input className="input" value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} /></div>
              <div className="form-group"><label className="label">Semáforo</label>
                <select className="select-custom" style={{ width: '100%' }} value={form.semaforo_general} onChange={e => setForm({ ...form, semaforo_general: e.target.value as any })}>
                  <option value="green">🟢 Verde</option><option value="yellow">🟡 Amarillo</option><option value="red">🔴 Rojo</option><option value="blue">🔵 Onboarding</option>
                </select>
              </div>
              <div className="form-group"><label className="label">Owner</label>
                <select className="select-custom" style={{ width: '100%' }} value={form.owner_id} onChange={e => setForm({ ...form, owner_id: e.target.value })}>
                  {owners.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="label">Tipo</label>
                <select className="select-custom" style={{ width: '100%' }} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as any })}>
                  <option value="CRM">CRM</option><option value="Tienda Online">Tienda Online</option>
                </select>
              </div>
              <div className="form-group"><label className="label">Progreso (%)</label><input className="input" type="number" min="0" max="100" value={form.progreso} onChange={e => setForm({ ...form, progreso: Number(e.target.value) })} /></div>
              <div className="form-group"><label className="label">Último Contacto</label><input className="input" value={form.ultimo_contacto} onChange={e => setForm({ ...form, ultimo_contacto: e.target.value })} /></div>
              <div className="form-group"><label className="label">Última Publicación</label><input className="input" value={form.ultima_publicacion} onChange={e => setForm({ ...form, ultima_publicacion: e.target.value })} /></div>
              <div className="form-group"><label className="label"><i className="fas fa-film" style={{ marginRight: 4, color: '#f5a623' }} />Editor</label>
                <select className="select-custom" style={{ width: '100%' }} value={form.editor_id || ''} onChange={e => setForm({ ...form, editor_id: e.target.value || null })}>
                  <option value="">Sin asignar</option>
                  {equipo.filter(e => e.rol === 'editor').map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="label"><i className="fas fa-pen-fancy" style={{ marginRight: 4, color: '#8965e0' }} />Copy</label>
                <select className="select-custom" style={{ width: '100%' }} value={form.copy_id || ''} onChange={e => setForm({ ...form, copy_id: e.target.value || null })}>
                  <option value="">Sin asignar</option>
                  {equipo.filter(e => e.rol === 'copy').map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="label"><i className="fas fa-palette" style={{ marginRight: 4, color: '#f5365c' }} />Diseñador</label>
                <select className="select-custom" style={{ width: '100%' }} value={form.disenador_id || ''} onChange={e => setForm({ ...form, disenador_id: e.target.value || null })}>
                  <option value="">Sin asignar</option>
                  {equipo.filter(e => e.rol === 'diseñador').map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group"><label className="label">Objetivo</label><input className="input" value={form.objetivo} onChange={e => setForm({ ...form, objetivo: e.target.value })} /></div>
            <div className="form-group"><label className="label">Próximo Hito</label><textarea className="input textarea" value={form.proximo_hito} onChange={e => setForm({ ...form, proximo_hito: e.target.value })} /></div>
            <div className="form-group"><label className="label">Riesgo Detectado</label><textarea className="input textarea" value={form.riesgo} onChange={e => setForm({ ...form, riesgo: e.target.value })} /></div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <div className="card" style={{ flex: '1 1 300px' }}>
            <div className="card-body">
              <div className="label">Objetivo</div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{cliente.objetivo || 'Sin definir'}</div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${cliente.progreso}%`, background: 'linear-gradient(90deg, #5e72e4, #8965e0)' }} /></div>
              <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 4 }}>{cliente.progreso}% completado</div>
            </div>
          </div>
          <div className="card" style={{ flex: '1 1 200px' }}><div className="card-body"><div className="label">Próximo Hito</div><div style={{ fontSize: 13 }}>{cliente.proximo_hito || 'Sin definir'}</div></div></div>
          <div className="card" style={{ flex: '1 1 200px' }}><div className="card-body"><div className="label">Riesgo Detectado</div>
            <div style={{ fontSize: 13, color: cliente.semaforo_general === 'red' ? '#f5365c' : cliente.semaforo_general === 'yellow' ? '#f5a623' : '#00d97e' }}>{cliente.riesgo || 'Sin riesgos detectados'}</div>
          </div></div>
        </div>
      )}

      <div className="tabs" style={{ marginBottom: 20 }}>
        {(['proceso', 'reportes', 'notas'] as const).map(t => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'proceso' ? 'Proceso' : t === 'reportes' ? 'Reportes' : `Notas (${notas.length})`}
          </div>
        ))}
      </div>

      {tab === 'proceso' && (
        <div className="card">
          <div className="card-header">
            <span style={{ fontWeight: 600 }}>Fases del {cliente.is_onboarding ? 'Onboarding' : 'Ciclo Ongoing'}</span>
          </div>
          <div className="card-body">
            {fases.map(f => {
              const overdue = isOverdue(f)
              const daysLeft = getDaysLeft(f)
              return (
                <div key={f.id} className="fase-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: overdue ? '3px solid #f5365c' : undefined, paddingLeft: overdue ? 8 : undefined }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto' }}>
                    {f.status === 'done' ? <i className="fas fa-check-circle" style={{ color: '#00d97e', fontSize: 16 }} />
                      : f.status === 'active' ? <i className="fas fa-circle-dot" style={{ color: '#5e72e4', fontSize: 16 }} />
                      : <i className="far fa-circle" style={{ color: '#6a6a80', fontSize: 16 }} />}
                    <span className="fase-name" style={{ color: f.status === 'pending' ? '#6a6a80' : '#e8e8f0' }}>{f.nombre}</span>
                  </div>

                  <div style={{ flex: 1 }} />

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: '0 0 auto' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontSize: 9, color: '#6a6a80', textTransform: 'uppercase', letterSpacing: 0.5 }}>Inicio</span>
                      <input type="date" className="editable-select" value={formatDateForInput(f.fecha_inicio)} onChange={e => updateFaseDeadline(f.id, 'fecha_inicio', e.target.value)} style={{ width: 130, fontSize: 11 }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontSize: 9, color: overdue ? '#f5365c' : '#6a6a80', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: overdue ? 700 : 400 }}>
                        {daysLeft ? daysLeft : 'Deadline'}
                      </span>
                      <input type="date" className="editable-select" value={formatDateForInput(f.fecha_fin)} onChange={e => updateFaseDeadline(f.id, 'fecha_fin', e.target.value)} style={{ width: 130, fontSize: 11, borderColor: overdue ? '#f5365c' : undefined }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontSize: 9, color: '#6a6a80', textTransform: 'uppercase', letterSpacing: 0.5 }}>Estado</span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <select className="editable-select" value={f.status} onChange={e => updateFase(f.id, e.target.value)}>
                          <option value="pending">Pendiente</option><option value="active">En curso</option><option value="done">Completado</option>
                        </select>
                        {f.status !== 'pending' && <SemaforoIcon color={overdue ? 'red' : f.semaforo} />}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'reportes' && (
        <div className="card">
          <div className="card-header"><span style={{ fontWeight: 600 }}>Historial de Reportes</span></div>
          <div className="card-body">
            <table className="table">
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Estado</th></tr></thead>
              <tbody>
                {reportes.map(r => (<tr key={r.id}><td>{r.fecha}</td><td>{r.tipo}</td><td><Badge color="green">Enviado</Badge></td></tr>))}
                {reportes.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: '#6a6a80' }}>Sin reportes</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'notas' && (
        <div className="card">
          <div className="card-header"><span style={{ fontWeight: 600 }}>Notas Internas</span></div>
          <div className="card-body">
            {notas.map(n => (
              <div key={n.id} style={{ padding: 12, background: '#1a1a28', borderRadius: 8, marginBottom: 8, fontSize: 13, lineHeight: 1.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: '#5e72e4', fontSize: 11 }}>{n.autor}</span>
                  <span style={{ fontSize: 11, color: '#6a6a80' }}>{new Date(n.created_at).toLocaleDateString('es-AR')}</span>
                </div>
                {n.texto}
              </div>
            ))}
            <div style={{ marginTop: 12 }}>
              <textarea className="input textarea" placeholder="Agregar nota interna..." value={nota} onChange={e => setNota(e.target.value)} />
              <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={addNota}><i className="fas fa-plus" /> Agregar Nota</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

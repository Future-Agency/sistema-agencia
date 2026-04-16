'use client'
import { useState } from 'react'
import { supabase, FASES_ONBOARDING, type Owner } from '@/lib/supabase'

type Props = { owners: Owner[]; agenciaId?: string; onClose: () => void; onSave: () => void }

export default function NuevoClienteModal({ owners, agenciaId = 'future', onClose, onSave }: Props) {
  const [form, setForm] = useState({ nombre: '', tipo: 'CRM', owner_id: owners[0]?.id || 'rami', objetivo: '' })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.nombre.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('clientes').insert({
      nombre: form.nombre, tipo: form.tipo, owner_id: form.owner_id,
      estado: 'Onboarding', is_onboarding: true, semaforo_general: 'blue',
      objetivo: form.objetivo, progreso: 0, agencia_id: agenciaId,
      ultimo_contacto: new Date().toLocaleDateString('es-AR'),
      ultima_publicacion: '-', proximo_hito: form.objetivo, riesgo: '',
    }).select().single()

    if (data) {
      const fases = FASES_ONBOARDING.map((f, i) => ({
        cliente_id: data.id, fase_id: f.id, nombre: f.name, tipo: 'onboarding' as const,
        orden: i, status: i === 0 ? 'active' : 'pending',
        semaforo: i === 0 ? 'blue' : 'pending', dias_default: f.defaultDays,
      }))
      await supabase.from('fases_cliente').insert(fases)
      onSave()
    }
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span style={{ fontWeight: 700, fontSize: 16 }}>Nuevo Cliente</span>
          <button className="btn btn-ghost" onClick={onClose}><i className="fas fa-times" /></button>
        </div>
        <div className="modal-body">
          <div className="form-group"><label className="label">Nombre del Cliente</label><input className="input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Empresa ABC" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group"><label className="label">Tipo de Cliente</label>
              <select className="select-custom" style={{ width: '100%' }} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                <option value="CRM">CRM</option><option value="Tienda Online">Tienda Online</option>
              </select>
            </div>
            <div className="form-group"><label className="label">Owner Asignado</label>
              <select className="select-custom" style={{ width: '100%' }} value={form.owner_id} onChange={e => setForm({ ...form, owner_id: e.target.value })}>
                {owners.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group"><label className="label">Objetivo del Cliente</label><textarea className="input textarea" value={form.objetivo} onChange={e => setForm({ ...form, objetivo: e.target.value })} placeholder="Ej: Llegar a $1.000.000 en ventas" /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Crear Cliente'}</button>
        </div>
      </div>
    </div>
  )
}

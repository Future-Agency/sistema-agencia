'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, type Task, type Cliente, type Owner } from '@/lib/supabase'

type Props = {
  owner: Owner
  clientes: Cliente[]
}

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const
const DIA_LABELS: Record<string, string> = {
  lunes: 'LUNES', martes: 'MARTES', miercoles: 'MIÉRCOLES',
  jueves: 'JUEVES', viernes: 'VIERNES', sabado: 'SÁBADO', domingo: 'DOMINGO',
}

function getTodayDia(): string {
  const d = new Date()
  return DIAS[d.getDay() === 0 ? 6 : d.getDay() - 1]
}

function getDiaDate(dia: string): string {
  const today = new Date()
  const todayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1
  const targetIdx = DIAS.indexOf(dia as typeof DIAS[number])
  if (targetIdx === -1) return ''
  let diff = targetIdx - todayIdx
  if (diff < 0) diff += 7
  const target = new Date(today)
  target.setDate(today.getDate() + diff)
  return target.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString()
}

const PRIORIDAD_COLORS: Record<string, { border: string; badge: string; bg: string; label: string }> = {
  urgente: { border: '#f5365c', badge: '#f5365c', bg: 'rgba(245,54,92,.15)', label: 'URGENTE' },
  alta: { border: '#f5a623', badge: '#f5a623', bg: 'rgba(245,166,35,.15)', label: 'ALTA' },
  media: { border: '#2a2a40', badge: '', bg: '', label: '' },
  baja: { border: '#1a1a28', badge: '#6a6a80', bg: 'rgba(106,106,128,.08)', label: 'BAJA' },
}

export default function OwnerTodoList({ owner, clientes }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [completedTasks, setCompletedTasks] = useState<Task[]>([])
  const [newTask, setNewTask] = useState('')
  const [newTaskCliente, setNewTaskCliente] = useState('')
  const [newTaskDia, setNewTaskDia] = useState(getTodayDia())
  const [newTaskPrioridad, setNewTaskPrioridad] = useState('media')
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [editingDesc, setEditingDesc] = useState('')

  const loadTasks = useCallback(async () => {
    const [pendingRes, doneRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('owner_id', owner.id).neq('estado', 'listo').order('orden', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }),
      supabase.from('tasks').select('*').eq('owner_id', owner.id).eq('estado', 'listo').gte('fecha_completado', getWeekStart()).order('fecha_completado', { ascending: false }),
    ])
    if (pendingRes.data) setTasks(pendingRes.data)
    if (doneRes.data) setCompletedTasks(doneRes.data)
  }, [owner.id])

  useEffect(() => { loadTasks() }, [loadTasks])

  const todayDia = getTodayDia()

  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {}
    // HOY first (today's dia_asignado)
    groups['__hoy__'] = tasks.filter(t => t.dia_asignado === todayDia)
    // Other days
    for (const dia of DIAS) {
      if (dia === todayDia) continue
      const dayTasks = tasks.filter(t => t.dia_asignado === dia)
      if (dayTasks.length > 0) groups[dia] = dayTasks
    }
    // Unassigned
    const unassigned = tasks.filter(t => !t.dia_asignado)
    if (unassigned.length > 0) groups['__none__'] = unassigned
    return groups
  }, [tasks, todayDia])

  async function addTask() {
    if (!newTask.trim()) return
    await supabase.from('tasks').insert({
      titulo: newTask,
      cliente: newTaskCliente,
      owner_id: owner.id,
      dia_asignado: newTaskDia || null,
      categoria: newTaskCliente ? 'cliente' : 'agencia',
      estado: 'pendiente',
      prioridad: newTaskPrioridad,
    })
    setNewTask('')
    setNewTaskCliente('')
    loadTasks()
  }

  async function toggleTask(task: Task) {
    if (task.estado === 'listo') {
      await supabase.from('tasks').update({ estado: 'pendiente', fecha_completado: null }).eq('id', task.id)
    } else {
      await supabase.from('tasks').update({ estado: 'listo', fecha_completado: new Date().toISOString() }).eq('id', task.id)
    }
    loadTasks()
  }

  async function deleteTask(taskId: string) {
    await supabase.from('tasks').delete().eq('id', taskId)
    loadTasks()
  }

  async function saveDescription(taskId: string, desc: string) {
    await supabase.from('tasks').update({ descripcion: desc }).eq('id', taskId)
    setExpandedTask(null)
    loadTasks()
  }

  function toggleExpand(taskId: string, currentDesc: string) {
    if (expandedTask === taskId) {
      setExpandedTask(null)
    } else {
      setExpandedTask(taskId)
      setEditingDesc(currentDesc || '')
    }
  }

  function renderTask(t: Task, isDone = false) {
    const pri = PRIORIDAD_COLORS[t.prioridad] || PRIORIDAD_COLORS.media
    const isExpanded = expandedTask === t.id

    return (
      <div key={t.id}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
          borderRadius: 6, marginBottom: 2, background: '#1a1a28',
          borderLeft: `3px solid ${isDone ? '#2a2a40' : pri.border}`,
          opacity: isDone ? 0.45 : 1,
          textDecoration: isDone ? 'line-through' : 'none',
        }}>
          {/* Checkbox */}
          <button onClick={() => toggleTask(t)} style={{
            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
            border: isDone ? '2px solid #00d97e' : '2px solid #4a4a60',
            background: isDone ? 'rgba(0,217,126,.2)' : 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#00d97e', fontSize: 9,
          }}>
            {isDone && <i className="fas fa-check" />}
          </button>

          {/* Expand chevron */}
          <button onClick={() => toggleExpand(t.id, t.descripcion)} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#4a4a60', fontSize: 9, padding: 0,
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s',
          }}>
            <i className="fas fa-chevron-right" />
          </button>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: isDone ? '#6a6a80' : '#e8e8f0' }}>{t.titulo}</span>
            {t.cliente && (
              <span style={{ fontSize: 10, color: owner.color, fontWeight: 500, marginLeft: 6 }}>{t.cliente}</span>
            )}
          </div>

          {/* Badges */}
          {!isDone && t.estado === 'bloqueado' && (
            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(245,54,92,0.15)', color: '#f5365c', fontWeight: 600 }}>BLOQ</span>
          )}
          {!isDone && pri.label && (
            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: pri.bg, color: pri.badge, fontWeight: 600 }}>{pri.label}</span>
          )}

          {/* Delete */}
          {!isDone && (
            <button onClick={() => deleteTask(t.id)} style={{ background: 'none', border: 'none', color: '#3a3a50', cursor: 'pointer', fontSize: 10, padding: 2 }}>
              <i className="fas fa-trash" />
            </button>
          )}
        </div>

        {/* Expanded description */}
        {isExpanded && !isDone && (
          <div style={{ marginLeft: 36, marginBottom: 6, padding: '6px 10px', background: 'rgba(94,114,228,0.04)', borderRadius: 6, border: '1px solid #1a1a28' }}>
            <textarea
              className="editable-select"
              value={editingDesc}
              onChange={e => setEditingDesc(e.target.value)}
              placeholder="Comentarios / descripción..."
              style={{ width: '100%', fontSize: 11, padding: '4px 6px', minHeight: 50, resize: 'vertical', background: 'transparent', border: '1px solid #2a2a40', borderRadius: 4, color: '#a0a0b8' }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 4, justifyContent: 'flex-end' }}>
              <button onClick={() => setExpandedTask(null)} style={{ fontSize: 10, color: '#6a6a80', background: 'none', border: 'none', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => saveDescription(t.id, editingDesc)} className="btn btn-primary btn-sm" style={{ fontSize: 10, padding: '2px 8px' }}>Guardar</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderGroup(key: string, groupTasks: Task[]) {
    let label: string
    let dateStr: string
    if (key === '__hoy__') {
      label = 'HOY'
      dateStr = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' })
    } else if (key === '__none__') {
      label = 'SIN DÍA ASIGNADO'
      dateStr = ''
    } else {
      label = DIA_LABELS[key] || key.toUpperCase()
      dateStr = getDiaDate(key)
    }

    return (
      <div key={key} style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '4px 0' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: key === '__hoy__' ? owner.color : '#6a6a80', letterSpacing: 0.5 }}>{label}</span>
          {dateStr && <span style={{ fontSize: 10, color: '#4a4a60' }}>{dateStr}</span>}
          <span style={{ fontSize: 10, color: '#3a3a50', marginLeft: 'auto' }}>{groupTasks.length}</span>
        </div>
        {groupTasks.map(t => renderTask(t))}
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>
          <i className="fas fa-list-check" style={{ color: owner.color, marginRight: 6 }} />
          TO DO LIST
        </span>
        <span style={{ fontSize: 11, color: '#6a6a80' }}>{tasks.length} pendientes</span>
      </div>
      <div className="card-body" style={{ padding: '12px 16px' }}>
        {/* Add task form */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            className="input"
            placeholder="Nueva tarea..."
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addTask() }}
            style={{ flex: '1 1 200px', fontSize: 12, padding: '6px 10px' }}
          />
          <select className="select-custom" value={newTaskCliente} onChange={e => setNewTaskCliente(e.target.value)} style={{ width: 120, fontSize: 11 }}>
            <option value="">Sin cliente</option>
            {clientes.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
          </select>
          <select className="select-custom" value={newTaskDia} onChange={e => setNewTaskDia(e.target.value)} style={{ width: 90, fontSize: 11 }}>
            <option value="">Sin día</option>
            {DIAS.map(d => <option key={d} value={d}>{d === getTodayDia() ? `HOY (${DIA_LABELS[d]})` : DIA_LABELS[d]}</option>)}
          </select>
          {/* Priority dots */}
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {(['urgente', 'alta', 'media', 'baja'] as const).map(p => (
              <button key={p} onClick={() => setNewTaskPrioridad(p)} title={p}
                style={{
                  width: 14, height: 14, borderRadius: '50%', cursor: 'pointer', border: newTaskPrioridad === p ? '2px solid white' : '2px solid transparent',
                  background: p === 'urgente' ? '#f5365c' : p === 'alta' ? '#f5a623' : p === 'media' ? '#4a4a60' : '#2a2a40',
                }} />
            ))}
          </div>
          <button className="btn btn-primary btn-sm" onClick={addTask} disabled={!newTask.trim()} style={{ padding: '6px 12px' }}>
            <i className="fas fa-plus" />
          </button>
        </div>

        {/* Grouped tasks */}
        {Object.keys(groupedTasks).length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#4a4a60', fontSize: 12 }}>
            <i className="fas fa-check-double" style={{ fontSize: 18, marginBottom: 6, display: 'block' }} />
            Sin tareas pendientes
          </div>
        ) : (
          Object.entries(groupedTasks).map(([key, gt]) => renderGroup(key, gt))
        )}

        {/* Completed this week */}
        {completedTasks.length > 0 && (
          <div style={{ marginTop: 16, borderTop: '1px solid #1a1a28', paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#00d97e', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fas fa-check-circle" style={{ fontSize: 10 }} />
              Hechas esta semana ({completedTasks.length})
            </div>
            {completedTasks.map(t => renderTask(t, true))}
          </div>
        )}
      </div>
    </div>
  )
}

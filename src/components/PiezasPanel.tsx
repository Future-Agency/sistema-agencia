'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase, type Cliente, type Equipo, type Pieza, type PiezaTipo } from '@/lib/supabase'
import type { CurrentUser, UserArea } from '@/lib/users'
import { currentCicloMes, nextCicloMes, cicloMesLabel } from '@/lib/cycles'
import {
  PIPELINE_BY_TIPO, PIEZA_META,
  generateBatch, queryPiezasByCliente, summarizePiezas, activeAreaOf,
  planFromCliente, totalPiezasFromPlan, type PlanPiezas,
} from '@/lib/piezas'
import RecursosCicloEditor from './RecursosCicloEditor'
import GrabacionWidget from './GrabacionWidget'

type Props = {
  agenciaId: string
  cliente: Cliente
  equipo: Equipo[]
  currentUser?: CurrentUser
  onUpdate: () => void
}

const AREA_LABELS: Record<UserArea, { short: string; full: string }> = {
  copys:  { short: 'COPY', full: 'Copys' },
  grab:   { short: 'GRAB', full: 'Grab' },
  edit:   { short: 'EDIT', full: 'Edición' },
  diseno: { short: 'DIS',  full: 'Diseño' },
  subida: { short: 'SUB',  full: 'Subida' },
  anuncios: { short: 'RPT', full: 'Reportes' },
}

function colNameFor(area: UserArea): keyof Pieza {
  if (area === 'edit') return 'estado_edicion'
  return `estado_${area}` as keyof Pieza
}

export default function PiezasPanel({ agenciaId, cliente, currentUser, onUpdate }: Props) {
  const [cicloMes, setCicloMes] = useState<string>(cliente.ciclo_mes || currentCicloMes())
  const [piezas, setPiezas] = useState<Pieza[]>([])
  const [allCyclePiezas, setAllCyclePiezas] = useState<Pieza[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [startingNext, setStartingNext] = useState(false)
  const [tipoFilter, setTipoFilter] = useState<'all' | PiezaTipo>('all')
  const [editingPlan, setEditingPlan] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)
  const [planForm, setPlanForm] = useState<PlanPiezas>(planFromCliente(cliente))
  const [error, setError] = useState<string | null>(null)
  const [editingPieza, setEditingPieza] = useState<Pieza | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'semi-admin'

  const loadPiezas = async () => {
    setLoading(true)
    const [thisCycle, allCycles] = await Promise.all([
      queryPiezasByCliente(cliente.id, cicloMes),
      queryPiezasByCliente(cliente.id),  // all cycles
    ])
    setPiezas(thisCycle)
    setAllCyclePiezas(allCycles)
    setLoading(false)
  }

  useEffect(() => { loadPiezas() }, [cliente.id, cicloMes])

  // Auto-clear toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // Cycle disponibles: current + cualquier ciclo que ya tenga piezas para este cliente
  const cyclesAvailable = useMemo(() => {
    const set = new Set<string>([currentCicloMes()])
    if (cliente.ciclo_mes) set.add(cliente.ciclo_mes)
    allCyclePiezas.forEach(p => set.add(p.ciclo_mes))
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [cliente.ciclo_mes, allCyclePiezas])

  // Detectar si el próximo ciclo ya tiene piezas o no
  const proxCiclo = useMemo(() => nextCicloMes(cicloMes), [cicloMes])
  const proxCicloPiezasCount = useMemo(
    () => allCyclePiezas.filter(p => p.ciclo_mes === proxCiclo).length,
    [allCyclePiezas, proxCiclo]
  )

  const summary = useMemo(() => summarizePiezas(piezas), [piezas])
  const filtered = useMemo(() => {
    if (tipoFilter === 'all') return piezas
    return piezas.filter(p => p.tipo === tipoFilter)
  }, [piezas, tipoFilter])

  const plan = useMemo(() => planFromCliente(cliente), [cliente])
  const totalEsperado = totalPiezasFromPlan(plan)
  const faltantes = Math.max(0, totalEsperado - piezas.length)

  // ===== Plan editor =====
  const savePlan = async () => {
    setSavingPlan(true)
    setError(null)
    const { error: e } = await supabase
      .from('clientes')
      .update({
        plan_videos:      Math.max(1, planForm.plan_videos),
        plan_portadas:    Math.max(0, planForm.plan_portadas),
        plan_carrouseles: Math.max(0, planForm.plan_carrouseles),
        plan_historias:   Math.max(0, planForm.plan_historias),
        updated_at: new Date().toISOString(),
      })
      .eq('id', cliente.id)
    setSavingPlan(false)
    if (e) { setError(e.message); return }
    setEditingPlan(false)
    onUpdate()
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    const res = await generateBatch({ agenciaId, cliente, cicloMes })
    setGenerating(false)
    if (res.error) { setError(res.error); return }
    await loadPiezas()
  }

  // Inicia el próximo ciclo: genera el batch del siguiente mes y se posiciona ahí.
  // Esto NO toca las piezas del ciclo actual — los dos coexisten en paralelo.
  const handleStartNextCycle = async () => {
    if (proxCicloPiezasCount > 0) {
      const ok = window.confirm(`El ciclo ${cicloMesLabel(proxCiclo)} ya tiene ${proxCicloPiezasCount} piezas. ¿Querés re-verificar y agregar las faltantes?`)
      if (!ok) return
    }
    setStartingNext(true); setError(null)
    const res = await generateBatch({ agenciaId, cliente, cicloMes: proxCiclo })
    setStartingNext(false)
    if (res.error) {
      setError(res.error)
      setToast({ msg: `Error: ${res.error}`, type: 'err' })
      return
    }
    setCicloMes(proxCiclo)
    await loadPiezas()
    setToast({
      msg: res.inserted > 0
        ? `🚀 Ciclo ${cicloMesLabel(proxCiclo)} iniciado · ${res.inserted} piezas creadas`
        : `Ciclo ${cicloMesLabel(proxCiclo)} ya estaba completo`,
      type: 'ok',
    })
  }

  return (
    <div className="fade-in" style={{ marginTop: 16 }}>
      {/* ===== Header con plan + ciclo ===== */}
      <div style={{
        marginBottom: 16, padding: 16,
        background: 'linear-gradient(135deg, rgba(94,114,228,.10) 0%, rgba(137,101,224,.05) 100%)',
        border: '1px solid rgba(94,114,228,.20)',
        borderRadius: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: '#a0b4f5', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.6 }}>
              Plan mensual de producción
            </div>
            <div style={{ fontSize: 14, color: '#fff', marginTop: 2 }}>
              <strong>{plan.plan_videos}</strong> videos
              {' · '}<strong>{plan.plan_portadas}</strong> portadas
              {' · '}<strong>{plan.plan_carrouseles}</strong> carrouseles
              {' · '}<strong>{plan.plan_historias}</strong> historias
              <span style={{ color: '#6a6a80', marginLeft: 8 }}>= {totalEsperado} piezas/mes</span>
            </div>
          </div>
          {isAdmin && !editingPlan && (
            <button onClick={() => { setPlanForm(plan); setEditingPlan(true) }}
              style={btnSecondary}>
              <i className="fas fa-pen" style={{ marginRight: 6 }} />Editar plan
            </button>
          )}
        </div>

        {editingPlan && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginTop: 8 }}>
            <PlanInput label="Videos" value={planForm.plan_videos} min={1}
              onChange={v => setPlanForm({ ...planForm, plan_videos: v })} />
            <PlanInput label="Portadas" value={planForm.plan_portadas} min={0}
              onChange={v => setPlanForm({ ...planForm, plan_portadas: v })} />
            <PlanInput label="Carrouseles" value={planForm.plan_carrouseles} min={0}
              onChange={v => setPlanForm({ ...planForm, plan_carrouseles: v })} />
            <PlanInput label="Historias" value={planForm.plan_historias} min={0}
              onChange={v => setPlanForm({ ...planForm, plan_historias: v })} />
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
              <button onClick={() => setEditingPlan(false)} disabled={savingPlan} style={btnSecondary}>
                Cancelar
              </button>
              <button onClick={savePlan} disabled={savingPlan} style={btnPrimary}>
                {savingPlan ? 'Guardando…' : 'Guardar plan'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== Selector de ciclo + acciones ===== */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap' as const, gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
          <span style={{ fontSize: 11, color: '#6a6a80', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.4 }}>Ciclo:</span>
          <select value={cicloMes} onChange={e => setCicloMes(e.target.value)}
            style={{
              padding: '6px 10px', background: '#1a1a28',
              border: '1px solid #2a2a40', borderRadius: 6,
              color: '#e8e8f0', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              textTransform: 'capitalize' as const,
            }}>
            {cyclesAvailable.map(c => <option key={c} value={c}>{cicloMesLabel(c)}</option>)}
          </select>
          <span style={{ fontSize: 11, color: '#6a6a80' }}>
            {piezas.length} de {totalEsperado} piezas
            {faltantes > 0 && <span style={{ color: '#f5a623', marginLeft: 6 }}>· faltan {faltantes}</span>}
          </span>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            <button onClick={handleGenerate} disabled={generating}
              style={faltantes > 0 ? btnPrimary : btnSecondary}>
              <i className="fas fa-bolt" style={{ marginRight: 6 }} />
              {generating ? 'Generando…' : faltantes > 0 ? `Generar ${faltantes} faltantes` : 'Re-verificar batch'}
            </button>
            <button onClick={handleStartNextCycle} disabled={startingNext}
              title={`Genera el batch del próximo mes (${cicloMesLabel(proxCiclo)}) y mantiene este ciclo intacto`}
              style={{
                padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: startingNext ? 'wait' : 'pointer',
                background: 'linear-gradient(135deg, #00d97e 0%, #00b76a 100%)',
                color: '#0a0a0f', border: 'none',
                opacity: startingNext ? 0.6 : 1,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
              <i className="fas fa-rocket" />
              {startingNext
                ? 'Iniciando…'
                : proxCicloPiezasCount > 0
                  ? `Ciclo ${cicloMesLabel(proxCiclo).split(' ')[0]} (${proxCicloPiezasCount} piezas) →`
                  : `Iniciar ciclo ${cicloMesLabel(proxCiclo).split(' ')[0]}`}
            </button>
          </div>
        )}
      </div>

      {/* ===== Datos de grabación del ciclo ===== */}
      <GrabacionWidget
        agenciaId={agenciaId}
        clienteId={cliente.id}
        cicloMes={cicloMes}
        canEdit={isAdmin}
      />

      {/* ===== Recursos consolidados del ciclo ===== */}
      <RecursosCicloEditor
        agenciaId={agenciaId}
        clienteId={cliente.id}
        cicloMes={cicloMes}
        canEdit={isAdmin}
      />

      {/* ===== Filter chips por tipo ===== */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' as const }}>
        <FilterChip label={`Todas (${summary.totalPiezas})`} active={tipoFilter === 'all'} color="#a0a0b8"
          onClick={() => setTipoFilter('all')} />
        {(['video', 'portada', 'carrousel', 'historia'] as PiezaTipo[]).map(t => {
          const meta = PIEZA_META[t]
          const stats = summary.porTipo[t]
          return (
            <FilterChip
              key={t}
              label={`${meta.emoji} ${meta.plural} (${stats.total})`}
              count={stats.aprobadas > 0 ? `✓${stats.aprobadas}` : undefined}
              active={tipoFilter === t}
              color={meta.color}
              onClick={() => setTipoFilter(t)}
            />
          )
        })}
      </div>

      {error && (
        <div style={errorBox}>
          <i className="fas fa-circle-exclamation" style={{ marginRight: 6 }} />{error}
        </div>
      )}

      {/* ===== Matrix ===== */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center' as const, color: '#6a6a80', fontSize: 13 }}>
          Cargando piezas…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center' as const, color: '#6a6a80' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
          <p style={{ fontSize: 13, marginBottom: 4 }}>
            {piezas.length === 0
              ? `Sin piezas para ${cicloMesLabel(cicloMes)}.`
              : `Sin piezas del tipo ${tipoFilter}.`}
          </p>
          {piezas.length === 0 && isAdmin && (
            <p style={{ fontSize: 11 }}>Tocá <strong>Generar</strong> arriba para crear el batch del mes.</p>
          )}
        </div>
      ) : (
        <PiezasGrid piezas={filtered} onClickPieza={setEditingPieza} />
      )}

      {/* Modal de edición de pieza */}
      {editingPieza && (
        <PiezaEditModal
          pieza={editingPieza}
          onClose={() => setEditingPieza(null)}
          onSaved={() => { setEditingPieza(null); loadPiezas() }}
        />
      )}

      {/* Toast feedback */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 999,
          padding: '10px 16px', borderRadius: 8,
          background: toast.type === 'ok' ? 'rgba(0,217,126,.15)' : 'rgba(245,54,92,.15)',
          border: `1px solid ${toast.type === 'ok' ? '#00d97e' : '#f5365c'}`,
          color: toast.type === 'ok' ? '#00d97e' : '#f5365c',
          fontSize: 12, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,.3)',
        }}>
          <i className={`fas ${toast.type === 'ok' ? 'fa-check-circle' : 'fa-exclamation-circle'}`} style={{ marginRight: 6 }} />
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ============== Subcomponents ==============

function PlanInput({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10, color: '#6a6a80', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 4 }}>
        {label}
      </label>
      <input
        type="number"
        value={value}
        min={min}
        onChange={e => onChange(Math.max(min, Number(e.target.value) || min))}
        style={{
          width: '100%', padding: '8px 10px',
          background: '#0a0a0f', border: '1px solid #2a2a40',
          borderRadius: 6, color: '#e8e8f0', fontSize: 14, fontWeight: 700,
          outline: 'none',
        }}
      />
    </div>
  )
}

function FilterChip({ label, count, active, onClick, color }: { label: string; count?: string; active: boolean; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '5px 10px',
      background: active ? color + '22' : '#1a1a28',
      border: `1px solid ${active ? color : '#2a2a40'}`,
      borderRadius: 18,
      color: active ? color : '#a0a0b8',
      fontSize: 11, fontWeight: 600, cursor: 'pointer',
    }}>
      {label}
      {count && (
        <span style={{ background: '#0a0a0f', color: '#00d97e', padding: '0 5px', borderRadius: 8, fontSize: 9, fontWeight: 700 }}>
          {count}
        </span>
      )}
    </button>
  )
}

function PiezasGrid({ piezas, onClickPieza }: { piezas: Pieza[]; onClickPieza: (p: Pieza) => void }) {
  // Agrupar por tipo
  const grouped = useMemo(() => {
    const m = new Map<PiezaTipo, Pieza[]>()
    piezas.forEach(p => {
      if (!m.has(p.tipo)) m.set(p.tipo, [])
      m.get(p.tipo)!.push(p)
    })
    return m
  }, [piezas])

  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
      {Array.from(grouped.entries()).map(([tipo, list]) => {
        const meta = PIEZA_META[tipo]
        const pipeline = PIPELINE_BY_TIPO[tipo]
        return (
          <div key={tipo} style={{
            background: '#1a1a28', borderRadius: 10,
            border: `1px solid ${meta.color}33`,
            overflow: 'hidden' as const,
          }}>
            <div style={{
              padding: '10px 14px', background: meta.color + '15',
              borderBottom: `1px solid ${meta.color}33`,
              fontSize: 12, fontWeight: 700, color: meta.color,
              textTransform: 'uppercase' as const, letterSpacing: 0.4,
            }}>
              {meta.emoji} {meta.plural} ({list.length})
            </div>
            {/* Header columns */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `60px 1fr repeat(${pipeline.length}, minmax(80px, 1fr)) 60px`,
              gap: 4, padding: '6px 14px',
              fontSize: 9, color: '#6a6a80', fontWeight: 700,
              textTransform: 'uppercase' as const, letterSpacing: 0.3,
              background: '#12121a',
              borderBottom: '1px solid #2a2a40',
            }}>
              <span>#</span>
              <span>Título</span>
              {pipeline.map(area => (
                <span key={area} style={{ textAlign: 'center' as const }}>{AREA_LABELS[area].short}</span>
              ))}
              <span style={{ textAlign: 'center' as const }}>Live</span>
            </div>
            {/* Rows */}
            {list.map(p => (
              <PiezaRow key={p.id} pieza={p} pipeline={pipeline} tipoColor={meta.color} onClick={() => onClickPieza(p)} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

function PiezaRow({ pieza, pipeline, tipoColor, onClick }: {
  pieza: Pieza; pipeline: UserArea[]; tipoColor: string; onClick: () => void
}) {
  const active = activeAreaOf(pieza)
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: `60px 1fr repeat(${pipeline.length}, minmax(80px, 1fr)) 60px`,
        gap: 4, padding: '8px 14px', alignItems: 'center',
        borderBottom: '1px solid #22223a',
        cursor: 'pointer',
        transition: 'background .15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#22223a')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ fontSize: 11, color: '#6a6a80', fontWeight: 700 }}>#{pieza.numero}</span>
      <span style={{ fontSize: 12, color: '#e8e8f0', overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>
        {pieza.titulo || `${pieza.tipo} ${pieza.numero}`}
      </span>
      {pipeline.map(area => {
        const colKey = colNameFor(area)
        const value = (pieza[colKey] as string) || ''
        const isActive = active === area
        const isApproved = value === 'APROBADO' || value === 'PUBLICADO' || value === 'MÉTRICAS' || value === 'VOLVER A EMPEZAR' || value === 'METRICAS Y VOLVER A EMPEZAR' || value === 'MATERIAL APROBADO' || value === 'MATERIAL SUBIDO' || value === 'LISTO PARA GRABAR'
        return (
          <span key={area} style={{
            textAlign: 'center' as const, padding: '3px 6px', borderRadius: 4,
            fontSize: 9, fontWeight: 700,
            background: isApproved ? 'rgba(0,217,126,.15)' : isActive ? tipoColor + '22' : value ? '#22223a' : 'transparent',
            color: isApproved ? '#00d97e' : isActive ? tipoColor : value ? '#a0a0b8' : '#3a3a55',
            border: isActive ? `1px solid ${tipoColor}55` : 'none',
            overflow: 'hidden' as const,
            textOverflow: 'ellipsis' as const,
            whiteSpace: 'nowrap' as const,
          }} title={value}>
            {isApproved ? '✓' : value ? value.split(' ')[0].slice(0, 6) : '—'}
          </span>
        )
      })}
      <span style={{ textAlign: 'center' as const }} title={pieza.publicacion_url ? 'Post publicado' : 'Sin publicar'}>
        {pieza.publicacion_url
          ? <a href={pieza.publicacion_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}><i className="fas fa-up-right-from-square" style={{ color: '#00d97e', fontSize: 11 }} /></a>
          : pieza.fecha_publicacion ? <i className="fas fa-clock" style={{ color: '#f5a623', fontSize: 11 }} />
          : <i className="fas fa-circle" style={{ color: '#3a3a55', fontSize: 6 }} />}
      </span>
    </div>
  )
}

function PiezaEditModal({ pieza, onClose, onSaved }: { pieza: Pieza; onClose: () => void; onSaved: () => void }) {
  const meta = PIEZA_META[pieza.tipo]
  const [titulo, setTitulo] = useState(pieza.titulo ?? '')
  const [previewUrl, setPreviewUrl] = useState(pieza.preview_url ?? '')
  const [publicacionUrl, setPublicacionUrl] = useState(pieza.publicacion_url ?? '')
  const [fechaGrab, setFechaGrab] = useState(pieza.fecha_grabacion ?? '')
  const [fechaPub, setFechaPub] = useState(pieza.fecha_publicacion ?? '')
  const [notas, setNotas] = useState(pieza.notas ?? '')
  const [calificaAds, setCalificaAds] = useState(!!pieza.califica_ads)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    setSaving(true); setErr(null)
    const { error } = await supabase.from('piezas').update({
      titulo: titulo.trim() || null,
      preview_url: previewUrl.trim() || null,
      publicacion_url: publicacionUrl.trim() || null,
      fecha_grabacion: fechaGrab || null,
      fecha_publicacion: fechaPub || null,
      notas: notas.trim() || null,
      califica_ads: calificaAds,
      updated_at: new Date().toISOString(),
    }).eq('id', pieza.id)
    setSaving(false)
    if (error) { setErr(error.message); return }
    onSaved()
  }

  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()} style={modalBox}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: '#6a6a80', textTransform: 'uppercase' as const, letterSpacing: 0.6 }}>
              {meta.emoji} {meta.label} #{pieza.numero}
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#fff' }}>
              Editar pieza
            </h3>
            <p style={{ fontSize: 11, color: '#6a6a80', margin: 0, marginTop: 4 }}>
              <i className="fas fa-circle-info" style={{ marginRight: 4 }} />
              Los links de Drive / Metricool se cargan a nivel ciclo (botón <strong>Editar recursos del ciclo</strong> arriba).
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#6a6a80', fontSize: 18, cursor: 'pointer' }}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        <Field label="Título / topic">
          <input value={titulo} onChange={e => setTitulo(e.target.value)}
            placeholder={`${meta.label} ${pieza.numero}`} style={inputStyle} />
        </Field>

        {pieza.tipo === 'video' && (
          <Field label="Preview específico de esta pieza (opcional)">
            <input value={previewUrl} onChange={e => setPreviewUrl(e.target.value)}
              placeholder="Link al video editado puntual (si tiene su propio link)" style={inputStyle} />
          </Field>
        )}

        <Field label="Post publicado (link al post live)">
          <input value={publicacionUrl} onChange={e => setPublicacionUrl(e.target.value)}
            placeholder="https://instagram.com/p/..." style={inputStyle} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {pieza.tipo === 'video' && (
            <Field label="Fecha de grabación">
              <input type="date" value={fechaGrab} onChange={e => setFechaGrab(e.target.value)} style={inputStyle} />
            </Field>
          )}
          <Field label="Fecha de publicación">
            <input type="date" value={fechaPub} onChange={e => setFechaPub(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        {pieza.tipo === 'video' && (
          <Field label="">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={calificaAds} onChange={e => setCalificaAds(e.target.checked)} />
              <span style={{ fontSize: 13, color: '#e8e8f0' }}>
                <i className="fas fa-bullhorn" style={{ marginRight: 6, color: '#f5a623' }} />
                Califica para anuncios
              </span>
            </label>
          </Field>
        )}

        <Field label="Notas">
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
            style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' as const }} />
        </Field>

        {err && <div style={errorBox}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} disabled={saving} style={btnSecondary}>Cancelar</button>
          <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && (
        <label style={{ display: 'block', fontSize: 11, color: '#6a6a80', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 6 }}>
          {label}
        </label>
      )}
      {children}
    </div>
  )
}

// ============== Styles ==============
const btnPrimary: React.CSSProperties = {
  padding: '8px 16px', background: '#5e72e4', color: '#fff',
  border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const btnSecondary: React.CSSProperties = {
  padding: '6px 14px', background: 'transparent', border: '1px solid #2a2a40',
  color: '#a0a0b8', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px',
  background: '#0a0a0f', border: '1px solid #2a2a40',
  borderRadius: 6, color: '#e8e8f0', fontSize: 13, outline: 'none',
}
const modalBackdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 200,
  background: 'rgba(0,0,0,.65)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 20, overflow: 'auto' as const,
}
const modalBox: React.CSSProperties = {
  width: '100%', maxWidth: 540,
  background: '#12121a', border: '1px solid #2a2a40',
  borderRadius: 14, padding: '22px 24px',
  maxHeight: '90vh', overflowY: 'auto' as const,
}
const errorBox: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 6,
  background: 'rgba(245,54,92,.10)', border: '1px solid rgba(245,54,92,.25)',
  color: '#f5365c', fontSize: 12, fontWeight: 600, marginBottom: 12,
}

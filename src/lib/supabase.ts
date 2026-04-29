import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Agencia = {
  id: string
  nombre: string
  color: string
  activo: boolean
}

export type Owner = {
  id: string
  nombre: string
  nombre_corto: string
  color: string
  activo: boolean
  agencia_id?: string
  whatsapp?: string | null
  iniciales?: string | null
  avg_response?: string | null
}

export type Cliente = {
  id: number
  nombre: string
  owner_id: string
  tipo: 'CRM' | 'Tienda Online'
  estado: string
  fase_actual: string
  semaforo_general: 'green' | 'yellow' | 'red' | 'blue'
  is_onboarding: boolean
  objetivo: string
  progreso: number
  ultimo_contacto: string
  ultima_publicacion: string
  proximo_hito: string
  riesgo: string
  riesgo_nivel: 'muy_alto' | 'alto' | 'medio' | 'bajo' | 'no' | null
  notas: string
  activo: boolean
  fecha_grabacion: string | null
  fecha_grabacion_estado: 'tentativa' | 'confirmada'
  cantidad_videos: number
  fecha_contenido: string | null
  fecha_contenido_fin: string | null
  en_correccion: boolean
  orden_owner: number | null
  estado_changed_at: string | null
  editor_id: string | null
  copy_id: string | null
  disenador_id: string | null
  estado_edicion: string
  estado_diseno: string
  fecha_edicion: string | null
  fecha_diseno: string | null
  reels_info: string | null
  ads_info: string | null
  reels_terminados: string | null
  historias_info: string | null
  carrouseles_info: string | null
  portadas_info: string | null
  created_at: string
  updated_at: string
  agencia_id?: string
  industria?: string | null
  objetivo_meta?: string | null
}

export type FaseCliente = {
  id: number
  cliente_id: number
  fase_id: string
  nombre: string
  tipo: 'onboarding' | 'ongoing'
  orden: number
  status: 'pending' | 'active' | 'done'
  semaforo: string
  dias_default: number
  fecha_inicio: string | null
  fecha_fin: string | null
}

export type Nota = {
  id: number
  cliente_id: number
  texto: string
  autor: string
  created_at: string
}

export type Reporte = {
  id: number
  cliente_id: number
  fecha: string
  tipo: string
  enviado: boolean
  created_at: string
}

export type Task = {
  id: string
  titulo: string
  descripcion: string
  categoria: 'cliente' | 'agencia' | 'ventas' | 'admin' | 'personal' | 'aprendizaje'
  estado: 'pendiente' | 'en_progreso' | 'bloqueado' | 'listo'
  prioridad: 'urgente' | 'alta' | 'media' | 'baja'
  cliente: string
  owner_id: string | null
  dia_asignado: string | null
  fecha_limite: string | null
  fecha_completado: string | null
  orden: number | null
  notas: string
  created_at: string
}

export type EstadoLog = {
  id: number
  cliente_id: number
  estado_anterior: string | null
  estado_nuevo: string
  changed_at: string
  changed_by: string
}

export type PeriodMetrics = {
  spend?: number
  impressions?: number
  clicks?: number
  ctr?: number
  cpc?: number
  purchases?: number
  leads?: number
  messages?: number
  purchase_value?: number
}

export type AdAccount = {
  id: number
  account_id: string
  account_name: string
  platform: string
  currency: string
  cliente_id: number | null
  activo: boolean
  account_status: number
  spend: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  messages: number
  purchases: number
  leads: number
  last_synced_at: string | null
  created_at: string
  metrics_7d: PeriodMetrics | null
  metrics_15d: PeriodMetrics | null
  metrics_30d: PeriodMetrics | null
  metrics_30d_prev: PeriodMetrics | null
  agencia_id?: string
  funnel?: FunnelStage | null
  tipos_cuenta?: TipoCuenta[] | null
  kanban_estado?: KanbanEstado | null
  kanban_sub?: KanbanSub | null
  kanban_changed_at?: string | null
  revision_mensual_at?: string | null
  reporte_at?: string | null
}

export type TipoCuenta = 'ecommerce' | 'formularios' | 'mensajeria'
export type KanbanEstado = 'problemas' | 'corriendo' | 'optimizar' | 'escalar' | 'onboarding'
export type KanbanSub = 'config' | 'estrategia' | 'listos'

export type AdAccountConfig = {
  id: number
  ad_account_id: number
  estado_cuenta: string
  estrategia: string
  roas_break_even: number | null
  tipo_conversion: string
  objetivo_mensual: string
  notas: string
  created_at: string
  updated_at: string
}

export type AdCambioLog = {
  id: number
  ad_account_id: number
  fecha: string
  tipo: string
  descripcion: string
  resultado: string
  created_at: string
}

export type AdCreativo = {
  id: number
  ad_account_id: number
  nombre: string
  tipo: string
  estado: string
  spend: number
  resultados: number
  cpr: number
  notas: string
  created_at: string
}

export type AdCampana = {
  id: number
  ad_account_id: number
  nombre: string
  objetivo: string
  tipo_audiencia: string
  presupuesto_diario: number | null
  estado: string
  notas: string
  created_at: string
}

export type AdRevision = {
  id: number
  ad_account_id: number
  periodo: 'semana' | 'mes'
  fecha: string
  titulo: string | null
  informe: string | null
  insights: string | null
  plan_accion: string | null
  metricas_snapshot: PeriodMetrics | null
  creada_por: string | null
  created_at: string
  updated_at: string
}

export type Equipo = {
  id: string
  nombre: string
  rol: 'copy' | 'editor' | 'diseñador' | 'cm'
  color: string
  activo: boolean
}

// ============== PORTAL CLIENTE ==============

export type ClientePortalAcceso = {
  id: number
  cliente_id: number
  slug: string
  username: string
  password: string
  activo: boolean
  last_login: string | null
  created_at: string
}

export type FunnelStage = 'tofu' | 'mofu' | 'bofu'

export type RoasHero = {
  invertido: number
  retornado: number
  multiplicador: number
  invertido_prev?: number
  retornado_prev?: number
  multiplicador_prev?: number
  delta_compras?: number
  delta_roas?: number
  nota_agencia?: string
}

export type SaludItem = { ok: boolean | 'warn'; label: string; detalle?: string }
export type SemanaItem = { dia: string; estado: 'done' | 'pending' | 'todo'; quien: 'agencia' | 'cliente'; icon: string; titulo: string; detalle?: string }
export type Recursos = { reels: number; historias: number; anuncios: number; fotos: number }
export type BenchmarkItem = { tu: number; promedio: number; label?: string }
export type Benchmark = { ctr?: BenchmarkItem; roas?: BenchmarkItem }
export type TopCreativoMetricas = { vistas: number; compras: number; valor: number; roas: number; ctr: number }
export type TopCreativo = { titulo: string; fecha_pub?: string; funnel?: FunnelStage; metricas: TopCreativoMetricas; angle?: string; thumb_label?: string }
export type KpiItem = { label: string; value: string; icon: string; delta?: number; tone?: string }
export type EstrategiaSeccion = { que_hacemos: string[]; kpis: string[] }

export type ClientePortalConfig = {
  id: number
  cliente_id: number
  nombre_interfaz: string | null
  logo_url: string | null
  color_primario: string
  fecha_inicio_servicio: string | null
  monto_mensual: number | null
  moneda: string
  dia_pago: number | null
  notas_cliente: string | null
  estrategia: string | null
  bienvenida: string | null
  roas_30d: RoasHero | null
  salud: SaludItem[] | null
  recursos: Recursos | null
  benchmark: Benchmark | null
  semana_items: SemanaItem[] | null
  top_creativo: TopCreativo | null
  estrategia_tesis: string | null
  estrategia_tofu: EstrategiaSeccion | null
  estrategia_mofu: EstrategiaSeccion | null
  estrategia_bofu: EstrategiaSeccion | null
  kpis_30d: KpiItem[] | null
  created_at: string
  updated_at: string
}

export type ClienteAlerta = {
  id: number
  cliente_id: number
  fecha: string
  tone: 'ok' | 'warn' | 'bad' | 'info'
  texto: string
  created_at: string
}

export type ClienteDecision = {
  id: number
  cliente_id: number
  fecha: string
  titulo: string
  razon: string | null
  created_at: string
}

export type ClienteRoadmap = {
  id: number
  cliente_id: number
  mes: string
  hito: string
  descripcion: string | null
  orden: number
  created_at: string
}

export type ClienteNotificacion = {
  id: number
  cliente_id: number
  icon: string | null
  texto: string
  cuando: string | null
  leida: boolean
  created_at: string
}

export type ClienteAprobacion = {
  id: number
  cliente_id: number
  tipo: 'reel' | 'historia' | 'carrousel' | 'anuncio' | 'guion'
  titulo: string
  descripcion: string | null
  url_preview: string | null
  estado: 'pendiente' | 'aprobado' | 'cambios_solicitados'
  comentario_cliente: string | null
  fecha_aprobacion: string | null
  visto_por_cliente: boolean
  visto_por_agencia: boolean
  funnel: FunnelStage | null
  dur: string | null
  texto_guion: string | null
  created_at: string
  updated_at: string
}

export type ClienteObjetivo = {
  id: number
  cliente_id: number
  titulo: string
  descripcion: string | null
  estado: 'activo' | 'logrado' | 'cancelado'
  fecha_inicio: string
  fecha_logrado: string | null
  resultado: string | null
  area: string | null
  meta: string | null
  actual: string | null
  por_que: string | null
  progreso: number | null
  created_at: string
}

export type ClienteSugerencia = {
  id: number
  cliente_id: number
  texto: string
  estado: 'nueva' | 'en_revision' | 'implementada' | 'descartada'
  respuesta_agencia: string | null
  visto_por_agencia: boolean
  created_at: string
}

export type ClientePago = {
  id: number
  cliente_id: number
  fecha: string
  monto: number
  moneda: string
  concepto: string | null
  estado: 'pendiente' | 'pagado' | 'vencido'
  metodo: string | null
  comprobante_url: string | null
  factura: string | null
  created_at: string
}

export type ClienteAcceso = {
  id: number
  cliente_id: number
  tipo: string
  nombre: string
  url: string | null
  usuario: string | null
  notas: string | null
  plataforma: string | null
  cuenta: string | null
  estado: string | null
  color: string | null
  icon: string | null
  created_at: string
}

export type ClienteTutorial = {
  id: number
  agencia_id: string
  titulo: string
  descripcion: string | null
  categoria: string | null
  url: string
  orden: number
  activo: boolean
  created_at: string
}

export type ClienteCalendario = {
  id: number
  cliente_id: number
  fecha: string
  tipo: string | null
  titulo: string
  descripcion: string | null
  estado: 'programado' | 'publicado' | 'cancelado'
  url: string | null
  funnel: FunnelStage | null
  created_at: string
}

export type ClienteTutorialExt = {
  id: number
  agencia_id: string
  titulo: string
  descripcion: string | null
  categoria: string | null
  url: string
  orden: number
  activo: boolean
  duracion: string | null
  created_at: string
}

export const FASES_ONBOARDING = [
  { id: 'crear_grupo', name: 'Crear Grupo', defaultDays: 1, icon: 'fa-users' },
  { id: 'envio_form', name: 'Envio Formulario Onboarding', defaultDays: 2, icon: 'fa-file-alt' },
  { id: 'kickoff', name: 'Reunion Kick Off', defaultDays: 3, icon: 'fa-handshake' },
  { id: 'accesos_meta', name: 'Accesos Meta', defaultDays: 3, icon: 'fa-key' },
  { id: 'proceso_estrategia', name: 'Proceso de Estrategia', defaultDays: 5, icon: 'fa-brain' },
  { id: 'presentar_estrategia', name: 'Presentar Estrategia', defaultDays: 2, icon: 'fa-chalkboard' },
  { id: 'presentar_guiones', name: 'Presentar Primeros Guiones', defaultDays: 3, icon: 'fa-scroll' },
  { id: 'coord_primera_grab', name: 'Coordinar Primera Grabacion', defaultDays: 2, icon: 'fa-calendar-check' },
  { id: 'crear_crm', name: 'Crear CRM', defaultDays: 3, icon: 'fa-address-book' },
  { id: 'crear_landing', name: 'Crear Landing', defaultDays: 3, icon: 'fa-globe' },
  { id: 'primera_grab_pago', name: 'Primera Grabacion / Pago', defaultDays: 1, icon: 'fa-video' },
  { id: 'edicion_diseno', name: 'Edicion y Diseno', defaultDays: 4, icon: 'fa-palette' },
  { id: 'aprob_publicacion', name: 'Aprobacion y Publicacion', defaultDays: 2, icon: 'fa-check-circle' },
  { id: 'rev_ads_1d', name: 'Revision ADS (+1 dia)', defaultDays: 1, icon: 'fa-bullhorn' },
  { id: 'rev_resultados_3d', name: 'Primeros Resultados (+3 dias)', defaultDays: 3, icon: 'fa-chart-bar' },
  { id: 'rev_mini_reporte_7d', name: 'Mini Reporte (+7 dias)', defaultDays: 7, icon: 'fa-chart-line' },
]

export const FASES_ONGOING = [
  { id: 'coord_grab', name: 'Coordinar Grabacion', defaultDays: 3 },
  { id: 'grabacion', name: 'Grabacion', defaultDays: 2 },
  { id: 'subida_material', name: 'Subida Material', defaultDays: 1 },
  { id: 'edicion', name: 'Edicion', defaultDays: 4 },
  { id: 'diseno', name: 'Diseno', defaultDays: 3 },
  { id: 'aprob_interna', name: 'Aprobacion Interna', defaultDays: 1 },
  { id: 'aprob_cliente', name: 'Aprobacion Cliente', defaultDays: 2 },
  { id: 'subida_prog', name: 'Subida y Programacion', defaultDays: 1 },
  { id: 'pauta', name: 'Pauta / Anuncios', defaultDays: 2 },
  { id: 'reporte_int', name: 'Reporte Interno', defaultDays: 1 },
  { id: 'reporte_ext', name: 'Reporte Externo', defaultDays: 1 },
]

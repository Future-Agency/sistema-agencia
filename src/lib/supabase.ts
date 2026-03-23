import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Owner = {
  id: string
  nombre: string
  nombre_corto: string
  color: string
  activo: boolean
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
  notas: string
  activo: boolean
  created_at: string
  updated_at: string
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

export const FASES_ONBOARDING = [
  { id: 'estrategia_org', name: 'Estrategia Orgánica', defaultDays: 5 },
  { id: 'estrategia_pauta', name: 'Estrategia Pauta', defaultDays: 5 },
  { id: 'aprob_estrategia', name: 'Aprobación Estrategia', defaultDays: 3 },
  { id: 'guiones_org', name: 'Guiones Orgánico', defaultDays: 5 },
  { id: 'guiones_pauta', name: 'Guiones Pauta', defaultDays: 5 },
  { id: 'aprob_guiones', name: 'Aprobación Guiones', defaultDays: 3 },
  { id: 'optimizacion', name: 'Optimización (CRM/E-comm/Acción)', defaultDays: 7 },
  { id: 'accesos', name: 'Accesos', defaultDays: 3 },
  { id: 'coord_grabacion', name: 'Coordinar Grabación', defaultDays: 3 },
  { id: 'grabacion', name: 'Grabación', defaultDays: 2 },
]

export const FASES_ONGOING = [
  { id: 'coord_grab', name: 'Coordinar Grabación', defaultDays: 3 },
  { id: 'grabacion', name: 'Grabación', defaultDays: 2 },
  { id: 'subida_material', name: 'Subida Material', defaultDays: 1 },
  { id: 'edicion', name: 'Edición', defaultDays: 4 },
  { id: 'diseno', name: 'Diseño', defaultDays: 3 },
  { id: 'aprob_interna', name: 'Aprobación Interna', defaultDays: 1 },
  { id: 'aprob_cliente', name: 'Aprobación Cliente', defaultDays: 2 },
  { id: 'subida_prog', name: 'Subida y Programación', defaultDays: 1 },
  { id: 'pauta', name: 'Pauta / Anuncios', defaultDays: 2 },
  { id: 'reporte_int', name: 'Reporte Interno', defaultDays: 1 },
  { id: 'reporte_ext', name: 'Reporte Externo', defaultDays: 1 },
]

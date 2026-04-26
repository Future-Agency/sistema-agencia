'use client'
import { supabase, type ClientePortalAcceso } from './supabase'

const STORAGE_KEY = 'portal_session'

export type PortalSession = {
  acceso_id: number
  cliente_id: number
  slug: string
  username: string
  loggedAt: number
}

export function getSession(): PortalSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as PortalSession
    // 30 dias de duracion
    if (Date.now() - s.loggedAt > 30 * 24 * 3600 * 1000) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return s
  } catch {
    return null
  }
}

export function saveSession(s: PortalSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY)
}

export async function loginPortal(slug: string, username: string, password: string): Promise<{ ok: boolean; error?: string; session?: PortalSession }> {
  const slugClean = slug.trim().toLowerCase()
  const { data, error } = await supabase
    .from('cliente_portal_acceso')
    .select('*')
    .eq('slug', slugClean)
    .eq('activo', true)
    .maybeSingle()

  if (error) return { ok: false, error: 'Error de conexion: ' + error.message }
  const acceso = data as ClientePortalAcceso | null
  if (!acceso) return { ok: false, error: 'Portal no encontrado' }
  if (acceso.username !== username.trim() || acceso.password !== password) {
    return { ok: false, error: 'Usuario o contraseña incorrectos' }
  }

  await supabase.from('cliente_portal_acceso').update({ last_login: new Date().toISOString() }).eq('id', acceso.id)

  const session: PortalSession = {
    acceso_id: acceso.id,
    cliente_id: acceso.cliente_id,
    slug: acceso.slug,
    username: acceso.username,
    loggedAt: Date.now(),
  }
  saveSession(session)
  return { ok: true, session }
}

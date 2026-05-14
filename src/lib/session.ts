// Session — persistencia de login en localStorage. 30 días de exp.
// Solo guarda el nombre, NO el PIN (mismo trade-off que cualquier "remember me").

import { USERS, type CurrentUser } from './users'

const SESSION_KEY = 'ciclo_user'
const EXP_MS = 30 * 24 * 60 * 60 * 1000

type StoredSession = {
  name: string
  ts: number
  exp: number
}

export function saveSession(user: CurrentUser): void {
  if (typeof window === 'undefined') return
  const data: StoredSession = {
    name: user.name,
    ts: Date.now(),
    exp: Date.now() + EXP_MS,
  }
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data))
  } catch {
    // ignore storage errors
  }
}

export function loadSession(): CurrentUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as StoredSession
    if (!data?.name || !data.exp) return null
    if (Date.now() > data.exp) return null
    const def = USERS[data.name]
    if (!def) return null
    return { name: data.name, role: def.role, areas: def.areas }
  } catch {
    return null
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}

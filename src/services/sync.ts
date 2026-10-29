// Synchronisation distante optionnelle via Supabase (REST, sans SDK).
// Activée uniquement si VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont définies au build.
// La clé « anon » est publique par conception ; la sécurité repose sur les règles RLS (voir docs/SUPABASE.md).
import { exportData, useApp } from '../lib/store'
import type { PersistedState } from '../lib/types'

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const SESSION_KEY = 'vv-supabase-session'

export const syncConfigured = () => !!(URL_ && ANON)

interface Session {
  access_token: string
  refresh_token: string
  expires_at: number
  email?: string
  user_id: string
}

function readSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
  } catch {
    return null
  }
}
function writeSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* stockage indisponible */
  }
}

export const currentSession = () => readSession()

function decodeJwt(token: string): { sub: string; email?: string; exp: number } {
  const p = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(p))
}

/** Envoie un lien de connexion par e-mail (magic link). */
export async function sendMagicLink(email: string) {
  if (!syncConfigured()) throw new Error('Synchronisation non configurée')
  const res = await fetch(`${URL_}/auth/v1/otp`, {
    method: 'POST',
    headers: { apikey: ANON!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, create_user: true, options: { email_redirect_to: location.origin + import.meta.env.BASE_URL } }),
  })
  if (!res.ok) throw new Error('Envoi du lien impossible')
}

/** Récupère la session renvoyée dans l'URL après clic sur le lien. */
export function captureSessionFromUrl(): boolean {
  if (!location.hash.includes('access_token=')) return false
  const params = new URLSearchParams(location.hash.slice(1))
  const access = params.get('access_token')
  const refresh = params.get('refresh_token')
  if (!access || !refresh) return false
  const claims = decodeJwt(access)
  writeSession({ access_token: access, refresh_token: refresh, expires_at: claims.exp * 1000, email: claims.email, user_id: claims.sub })
  history.replaceState(null, '', location.pathname + location.search)
  return true
}

async function validSession(): Promise<Session> {
  const s = readSession()
  if (!s) throw new Error('Non connecté')
  if (Date.now() < s.expires_at - 60000) return s
  const res = await fetch(`${URL_}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: ANON!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: s.refresh_token }),
  })
  if (!res.ok) {
    writeSession(null)
    throw new Error('Session expirée, reconnectez-vous')
  }
  const d = await res.json()
  const claims = decodeJwt(d.access_token)
  const next = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: claims.exp * 1000, email: claims.email, user_id: claims.sub }
  writeSession(next)
  return next
}

export function signOut() {
  writeSession(null)
}

/** Envoie l'état local (sans secrets) vers la table `vaults`. */
export async function pushVault() {
  const s = await validSession()
  const res = await fetch(`${URL_}/rest/v1/vaults?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      apikey: ANON!,
      Authorization: `Bearer ${s.access_token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ user_id: s.user_id, data: exportData(), updated_at: new Date().toISOString() }),
  })
  if (!res.ok) throw new Error('Envoi impossible')
}

/** Récupère l'état distant et remplace l'état local. */
export async function pullVault(): Promise<boolean> {
  const s = await validSession()
  const res = await fetch(`${URL_}/rest/v1/vaults?select=data,updated_at&user_id=eq.${s.user_id}`, {
    headers: { apikey: ANON!, Authorization: `Bearer ${s.access_token}` },
  })
  if (!res.ok) throw new Error('Récupération impossible')
  const rows = (await res.json()) as { data: PersistedState }[]
  if (!rows.length) return false
  useApp.getState().importData(rows[0].data)
  return true
}

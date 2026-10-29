// Persistance locale : IndexedDB via idb-keyval.
// L'état applicatif (JSON) et les photos (Blob) sont stockés séparément.
import { createStore, get, set, del, keys } from 'idb-keyval'
import type { PersistedState } from './types'

const store = createStore('vinyl-vault', 'kv')
const STATE_KEY = 'state:v1'

export async function loadState(): Promise<PersistedState | undefined> {
  try {
    return await get<PersistedState>(STATE_KEY, store)
  } catch (e) {
    console.error('Lecture IndexedDB impossible', e)
    return undefined
  }
}

let pending: PersistedState | null = null
let timer: ReturnType<typeof setTimeout> | null = null

/** Sauvegarde différée (regroupe les écritures rapprochées). */
export function saveState(state: PersistedState) {
  pending = state
  if (timer) return
  timer = setTimeout(flush, 250)
}

export async function flush() {
  if (timer) clearTimeout(timer)
  timer = null
  if (!pending) return
  const s = pending
  pending = null
  try {
    await set(STATE_KEY, s, store)
  } catch (e) {
    console.error('Écriture IndexedDB impossible', e)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => void flush())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush()
  })
}

export async function putPhoto(key: string, blob: Blob) {
  await set(`photo:${key}`, blob, store)
}
export async function getPhoto(key: string) {
  return get<Blob>(`photo:${key}`, store)
}
export async function deletePhoto(key: string) {
  await del(`photo:${key}`, store)
}

/** Cache réseau simple avec expiration. */
export async function cacheGet<T>(key: string): Promise<T | undefined> {
  try {
    const v = await get<{ at: number; ttl: number; data: T }>(`cache:${key}`, store)
    if (!v) return undefined
    if (Date.now() - v.at > v.ttl) return undefined
    return v.data
  } catch {
    return undefined
  }
}
export async function cacheSet<T>(key: string, data: T, ttlMs: number) {
  try {
    await set(`cache:${key}`, { at: Date.now(), ttl: ttlMs, data }, store)
  } catch {
    /* quota : on ignore, le cache est optionnel */
  }
}
export async function clearCache() {
  const all = await keys(store)
  await Promise.all(all.filter((k) => String(k).startsWith('cache:')).map((k) => del(k, store)))
}

/** Demande au navigateur de ne pas purger les données (Safari ≥ 15.2). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

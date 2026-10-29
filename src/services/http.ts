// Couche réseau commune : délais, file d'attente par service (respect des quotas), erreurs typées.
import { sleep } from '../lib/util'

export class NetError extends Error {
  constructor(
    message: string,
    public kind: 'offline' | 'timeout' | 'rate' | 'auth' | 'notfound' | 'server' | 'cors',
    public status?: number,
  ) {
    super(message)
  }
}

export function describeError(e: unknown): string {
  if (e instanceof NetError) {
    switch (e.kind) {
      case 'offline':
        return 'Hors connexion. Réessayez une fois en ligne.'
      case 'timeout':
        return 'Le service met trop de temps à répondre.'
      case 'rate':
        return 'Trop de requêtes : le service limite les appels. Patientez une minute.'
      case 'auth':
        return 'Accès refusé : vérifiez la clé ou le jeton dans Profil › Connecteurs.'
      case 'notfound':
        return 'Aucune donnée trouvée.'
      default:
        return 'Le service est momentanément indisponible.'
    }
  }
  return e instanceof Error ? e.message : 'Erreur inattendue.'
}

interface Lane {
  minInterval: number
  last: number
  chain: Promise<unknown>
}
const lanes = new Map<string, Lane>()

function lane(name: string, minInterval: number): Lane {
  let l = lanes.get(name)
  if (!l) {
    l = { minInterval, last: 0, chain: Promise.resolve() }
    lanes.set(name, l)
  }
  l.minInterval = minInterval
  return l
}

/**
 * File à fenêtre glissante : au plus `max` appels par `windowMs`, sans espacement forcé.
 * Permet de charger rapidement une rafale (ex. pochettes) tout en respectant le quota.
 */
const windows = new Map<string, { stamps: number[]; chain: Promise<unknown> }>()
export function windowed<T>(name: string, max: number, windowMs: number, fn: () => Promise<T>): Promise<T> {
  let w = windows.get(name)
  if (!w) windows.set(name, (w = { stamps: [], chain: Promise.resolve() }))
  const lane = w
  const run = lane.chain.then(async () => {
    for (;;) {
      const now = Date.now()
      lane.stamps = lane.stamps.filter((t) => now - t < windowMs)
      if (lane.stamps.length < max) break
      await sleep(lane.stamps[0] + windowMs - now + 50)
    }
    lane.stamps.push(Date.now())
    await sleep(120)
  })
  lane.chain = run.catch(() => undefined)
  return run.then(fn)
}

/** Exécute `fn` dans la file `name`, en espaçant les appels d'au moins `minInterval` ms. */
export function queued<T>(name: string, minInterval: number, fn: () => Promise<T>): Promise<T> {
  const l = lane(name, minInterval)
  const run = l.chain.then(async () => {
    const wait = l.last + l.minInterval - Date.now()
    if (wait > 0) await sleep(wait)
    l.last = Date.now()
    return fn()
  })
  l.chain = run.catch(() => undefined)
  return run
}

export async function getJSON<T>(url: string, init: RequestInit & { timeout?: number } = {}): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new NetError('offline', 'offline')
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), init.timeout ?? 15000)
  let res: Response
  try {
    res = await fetch(url, { ...init, signal: ctrl.signal })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new NetError('timeout', 'timeout')
    throw new NetError('Réseau indisponible', navigator.onLine === false ? 'offline' : 'cors')
  } finally {
    clearTimeout(t)
  }
  if (res.status === 429) throw new NetError('rate', 'rate', 429)
  if (res.status === 401 || res.status === 403) throw new NetError('auth', 'auth', res.status)
  if (res.status === 404) throw new NetError('notfound', 'notfound', 404)
  if (!res.ok) throw new NetError(`HTTP ${res.status}`, 'server', res.status)
  return res.json() as Promise<T>
}

/** Réessaie une fois après une limitation de débit ou une erreur serveur passagère. */
export async function withRetry<T>(fn: () => Promise<T>, delay = 4000): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof NetError && (e.kind === 'rate' || (e.kind === 'server' && (e.status ?? 0) >= 500))) {
      await sleep(delay)
      return fn()
    }
    throw e
  }
}

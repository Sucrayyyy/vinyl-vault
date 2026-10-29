// Identification sans clé : le texte lu sur la pochette génère des recherches d'albums
// (Apple Music, tolérant aux fautes), puis chaque candidat est classé en combinant
// la correspondance du texte et la ressemblance visuelle avec la photo.
import { normalize } from '../../lib/util'
import { hiRes, searchAlbums } from '../itunes'
import type { OcrResult } from './ocr'

export interface AlbumCandidate {
  key: string
  artist: string
  title: string
  year?: number
  artwork?: string
  score: number
}

interface Signature {
  rgb: Float32Array
  hash: Uint8Array
}

const N = 12

function signatureOf(src: CanvasImageSource, w: number, h: number, crop: number): Signature {
  const side = Math.min(w, h) * crop
  const sx = (w - side) / 2
  const sy = (h - side) / 2
  const c = document.createElement('canvas')
  c.width = N
  c.height = N
  const x = c.getContext('2d', { willReadFrequently: true })!
  x.drawImage(src, sx, sy, side, side, 0, 0, N, N)
  const d = x.getImageData(0, 0, N, N).data
  // Couleurs centrées-réduites par canal : insensible à l'exposition de la photo.
  const rgb = new Float32Array(N * N * 3)
  for (let ch = 0; ch < 3; ch++) {
    let m = 0
    for (let i = 0; i < N * N; i++) m += d[i * 4 + ch]
    m /= N * N
    let v = 0
    for (let i = 0; i < N * N; i++) v += (d[i * 4 + ch] - m) ** 2
    const sd = Math.sqrt(v / (N * N)) || 1
    for (let i = 0; i < N * N; i++) rgb[ch * N * N + i] = (d[i * 4 + ch] - m) / sd
  }
  // dHash 8×8 sur une version 9×8 en niveaux de gris.
  const g = document.createElement('canvas')
  g.width = 9
  g.height = 8
  const gx = g.getContext('2d', { willReadFrequently: true })!
  gx.drawImage(src, sx, sy, side, side, 0, 0, 9, 8)
  const gd = gx.getImageData(0, 0, 9, 8).data
  const lum = (i: number) => gd[i * 4] * 0.299 + gd[i * 4 + 1] * 0.587 + gd[i * 4 + 2] * 0.114
  const hash = new Uint8Array(64)
  for (let r = 0; r < 8; r++) for (let col = 0; col < 8; col++) hash[r * 8 + col] = lum(r * 9 + col) > lum(r * 9 + col + 1) ? 1 : 0
  return { rgb, hash }
}

function similarity(a: Signature, b: Signature): number {
  let corr = 0
  for (let i = 0; i < a.rgb.length; i++) corr += a.rgb[i] * b.rgb[i]
  corr /= a.rgb.length // corrélation moyenne ∈ [-1, 1]
  let same = 0
  for (let i = 0; i < 64; i++) if (a.hash[i] === b.hash[i]) same++
  return 0.65 * ((corr + 1) / 2) + 0.35 * (same / 64)
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = () => rej(new Error('image'))
    img.src = url
  })
}

/** Requêtes à essayer, des plus probables aux plus larges. */
export function queriesFrom(ocr: OcrResult, hint?: string): string[] {
  const q: string[] = []
  if (hint) q.push(hint)
  const top = ocr.words.slice(0, 4).map((w) => w.text)
  if (top.length) q.push(top.join(' '))
  if (ocr.lines.length >= 2) q.push(`${ocr.lines[0]} ${ocr.lines[1]}`)
  const longest = [...ocr.lines].sort((a, b) => b.length - a.length)[0]
  if (longest) q.push(longest)
  if (top.length > 2) q.push(top.slice(0, 2).join(' '))
  return [...new Set(q.map((s) => s.trim()).filter((s) => s.length >= 3))].slice(0, 4)
}

/** Albums candidats classés : texte lu + ressemblance visuelle avec la photo. */
export async function rankAlbums(photo: Blob, ocr: OcrResult, queries: string[]): Promise<AlbumCandidate[]> {
  const found = new Map<number, { artist: string; title: string; year?: number; art?: string }>()
  for (const q of queries) {
    try {
      const res = await searchAlbums(q, 12)
      for (const a of res) found.set(a.collectionId, { artist: a.artistName, title: a.collectionName, year: a.releaseDate ? Number(a.releaseDate.slice(0, 4)) : undefined, art: a.artworkUrl100 })
    } catch {
      /* requête suivante */
    }
    if (found.size >= 30) break
  }
  if (!found.size) return []

  const bmp = await createImageBitmap(photo)
  const photoSig = signatureOf(bmp, bmp.width, bmp.height, 0.9)
  bmp.close()
  const ocrText = normalize([...ocr.words.map((w) => w.text), ...ocr.lines].join(' '))
  const ocrTokens = ocr.words.slice(0, 6).map((w) => normalize(w.text)).filter((t) => t.length >= 2)

  const out = await Promise.all(
    [...found.entries()].map(async ([id, a]) => {
      const tokens = normalize(`${a.artist} ${a.title}`).split(' ').filter((t) => t.length >= 2)
      const hit = tokens.filter((t) => ocrText.includes(t)).length / Math.max(1, tokens.length)
      const cover = ocrTokens.filter((t) => normalize(`${a.artist} ${a.title}`).includes(t)).length / Math.max(1, ocrTokens.length)
      const text = 0.6 * hit + 0.4 * cover
      let visual = 0.5
      if (a.art) {
        try {
          const img = await loadImage(hiRes(a.art, 200))
          visual = similarity(photoSig, signatureOf(img, img.naturalWidth, img.naturalHeight, 1))
        } catch {
          /* pas de comparaison visuelle possible */
        }
      }
      return {
        text,
        key: `it${id}`,
        artist: a.artist,
        title: a.title,
        year: a.year,
        artwork: a.art ? hiRes(a.art, 600) : undefined,
        score: 0.5 * text + 0.5 * visual,
      }
    }),
  )
  // Sans aucun mot en commun, la ressemblance visuelle seule n'est pas fiable : on écarte.
  return out
    .filter((c) => c.text >= 0.25)
    .sort((x, y) => y.score - x.score)
    .slice(0, 8)
    .map(({ text: _t, ...c }) => c)
}

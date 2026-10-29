// OCR embarqué (Tesseract.js, WebAssembly) — sans clé ni serveur.
// Trois passes sur une image renforcée (contraste) : mise en page automatique, texte épars,
// et texte épars inversé pour lire le texte clair sur fond sombre. Le bruit est filtré.
import type { Worker } from 'tesseract.js'

let workerP: Promise<Worker> | null = null

async function worker() {
  if (!workerP) {
    workerP = import('tesseract.js').then(({ createWorker }) => createWorker('eng+fra', 1))
    workerP.catch(() => (workerP = null))
  }
  return workerP
}

/** Précharge le moteur (appelé à l'ouverture du scan pour gagner du temps). */
export function warmUpOcr() {
  void worker().catch(() => undefined)
}

function enhanced(bmp: ImageBitmap, invert: boolean): HTMLCanvasElement {
  const max = 1200
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  const x = c.getContext('2d', { willReadFrequently: true })!
  x.drawImage(bmp, 0, 0, c.width, c.height)
  const img = x.getImageData(0, 0, c.width, c.height)
  const d = img.data
  // Niveaux de gris + étirement de contraste (percentiles 2 % / 98 %).
  const hist = new Uint32Array(256)
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0
    d[i] = g
    hist[g]++
  }
  const total = d.length / 4
  let lo = 0
  let hi = 255
  for (let a = 0, s = 0; a < 256; a++) if ((s += hist[a]) > total * 0.02) { lo = a; break }
  for (let a = 255, s = 0; a >= 0; a--) if ((s += hist[a]) > total * 0.02) { hi = a; break }
  const span = Math.max(1, hi - lo)
  for (let i = 0; i < d.length; i += 4) {
    let v = ((d[i] - lo) * 255) / span
    v = v < 0 ? 0 : v > 255 ? 255 : v
    if (invert) v = 255 - v
    d[i] = d[i + 1] = d[i + 2] = v
  }
  x.putImageData(img, 0, 0)
  return c
}

export interface OcrWord {
  text: string
  confidence: number
  /** Hauteur relative du mot (les gros titres comptent davantage). */
  size: number
}

export interface OcrResult {
  words: OcrWord[]
  lines: string[]
}

/** Mot plausible (élimine le bruit typique de l'OCR sur des images). */
function plausible(t: string, conf: number): boolean {
  if (conf < 62) return false
  const letters = (t.match(/\p{L}/gu) ?? []).length
  if (letters / t.length < 0.8) return false
  if (t.length < 3 && !(t.length === 2 && t === t.toUpperCase())) return false
  if (!/[aeiouyàâéèêëîïôöûüAEIOUYÉÈ]/.test(t) && t.length > 3) return false
  return !/[bcdfghjklmnpqrstvwxz]{5,}/i.test(t)
}

const clean = (t: string) => t.replace(/[^\p{L}\p{N}&'’.-]/gu, '').replace(/^[.'’-]+|[.'’-]+$/g, '')

/** Lit le texte d'une pochette : mots fiables (avec leur taille) et lignes. */
export async function readCover(image: Blob, onProgress?: (p: number) => void): Promise<OcrResult> {
  const w = await worker()
  const bmp = await createImageBitmap(image)
  const words = new Map<string, OcrWord>()
  const lines: string[] = []
  // Mise en page automatique, puis texte épars, puis texte épars inversé (clair sur sombre).
  const passes: { invert: boolean; psm: string }[] = [
    { invert: false, psm: '3' },
    { invert: false, psm: '11' },
    { invert: true, psm: '11' },
  ]
  for (let p = 0; p < passes.length; p++) {
    onProgress?.(p / passes.length)
    await w.setParameters({ tessedit_pageseg_mode: passes[p].psm as never })
    const canvas = enhanced(bmp, passes[p].invert)
    const { data } = await w.recognize(canvas, {}, { blocks: true })
    const h = canvas.height
    for (const block of data.blocks ?? []) {
      for (const para of block.paragraphs) {
        for (const line of para.lines) {
          const good = line.words.filter((wd) => plausible(clean(wd.text), wd.confidence))
          if (good.length) lines.push(good.map((wd) => clean(wd.text)).join(' '))
          for (const wd of good) {
            const t = clean(wd.text)
            const key = t.toLowerCase()
            const size = (wd.bbox.y1 - wd.bbox.y0) / h
            const prev = words.get(key)
            if (!prev || prev.confidence < wd.confidence) words.set(key, { text: t, confidence: wd.confidence, size })
          }
        }
      }
    }
  }
  bmp.close()
  onProgress?.(1)
  const sorted = [...words.values()].sort((a, b) => b.size * b.confidence - a.size * a.confidence)
  return { words: sorted.slice(0, 12), lines: [...new Set(lines)].slice(0, 8) }
}

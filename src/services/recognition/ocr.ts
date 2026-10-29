// OCR embarqué (Tesseract.js, WebAssembly) — sans clé ni serveur.
// Le moteur et les données de langue sont téléchargés au premier usage puis mis en cache.
import type { Worker } from 'tesseract.js'

let workerP: Promise<Worker> | null = null

async function worker(onProgress?: (p: number) => void) {
  if (!workerP) {
    workerP = import('tesseract.js').then(({ createWorker }) =>
      createWorker('eng+fra', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') onProgress?.(m.progress)
        },
      }),
    )
    workerP.catch(() => (workerP = null))
  }
  return workerP
}

/** Extrait les lignes de texte plausibles d'une pochette. */
export async function readCoverText(image: Blob, onProgress?: (p: number) => void): Promise<string[]> {
  const w = await worker(onProgress)
  const { data } = await w.recognize(image)
  return data.text
    .split('\n')
    .map((l) => l.replace(/[^\p{L}\p{N}&'’.\-\s]/gu, ' ').replace(/\s+/g, ' ').trim())
    .filter((l) => l.length >= 3 && /\p{L}{2,}/u.test(l))
    .slice(0, 6)
}

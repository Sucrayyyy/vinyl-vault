// Lecture de codes-barres EAN/UPC : API native si disponible, sinon polyfill WebAssembly (ZXing).
type Detector = { detect: (src: ImageBitmapSource) => Promise<{ rawValue: string; format: string }[]> }

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']
let detectorP: Promise<Detector> | null = null

export function getDetector(): Promise<Detector> {
  if (!detectorP) {
    detectorP = (async () => {
      const Native = (globalThis as unknown as { BarcodeDetector?: new (o: object) => Detector & { constructor: { getSupportedFormats?: () => Promise<string[]> } } }).BarcodeDetector
      if (Native) {
        try {
          const supported = await (Native as unknown as { getSupportedFormats: () => Promise<string[]> }).getSupportedFormats()
          if (FORMATS.some((f) => supported.includes(f))) return new Native({ formats: FORMATS })
        } catch {
          /* on bascule sur le polyfill */
        }
      }
      const { BarcodeDetector } = await import('barcode-detector/ponyfill')
      return new BarcodeDetector({ formats: FORMATS as never }) as unknown as Detector
    })()
    detectorP.catch(() => (detectorP = null))
  }
  return detectorP
}

export async function detectBarcode(src: ImageBitmapSource): Promise<string | null> {
  const d = await getDetector()
  const res = await d.detect(src)
  const code = res.find((r) => /^\d{8,14}$/.test(r.rawValue))
  return code?.rawValue ?? null
}

export function isValidEan(code: string): boolean {
  if (!/^\d{8}$|^\d{12,13}$/.test(code)) return false
  const digits = code.split('').map(Number)
  const check = digits.pop()!
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

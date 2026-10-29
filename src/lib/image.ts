// Redimensionnement et compression des photos avant stockage ou analyse.
export async function compressImage(file: Blob, max = 1024, quality = 0.82): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null)
  let w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
  if (bmp) {
    w = bmp.width
    h = bmp.height
    draw = (ctx, W, H) => ctx.drawImage(bmp, 0, 0, W, H)
  } else {
    const img = await loadImg(URL.createObjectURL(file))
    w = img.naturalWidth
    h = img.naturalHeight
    draw = (ctx, W, H) => ctx.drawImage(img, 0, 0, W, H)
  }
  const scale = Math.min(1, max / Math.max(w, h))
  const W = Math.round(w * scale)
  const H = Math.round(h * scale)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  draw(ctx, W, H)
  bmp?.close()
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Compression impossible'))), 'image/jpeg', quality))
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = () => rej(new Error('Image illisible'))
    img.src = src
  })
}

export function blobToBase64(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1] ?? '')
    r.onerror = () => rej(r.error)
    r.readAsDataURL(b)
  })
}

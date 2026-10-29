// Génère les icônes PNG de la PWA à partir de public/favicon.svg (via sharp).
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url))
const out = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url))

await sharp(svg, { density: 384 }).resize(180, 180).png().toFile(out('apple-touch-icon.png'))
await sharp(svg, { density: 384 }).resize(192, 192).png().toFile(out('icon-192.png'))
await sharp(svg, { density: 384 }).resize(512, 512).png().toFile(out('icon-512.png'))

// Maskable : le disque est réduit pour rester dans la zone sûre (80 %).
const inner = await sharp(svg, { density: 384 }).resize(400, 400).png().toBuffer()
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#09090A' } })
  .composite([{ input: inner, gravity: 'center' }])
  .png()
  .toFile(out('icon-maskable-512.png'))
console.log('Icônes générées.')

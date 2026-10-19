// Gera os PNGs do PWA a partir dos SVGs desta pasta usando o Edge/Chromium do sistema.
// Uso: node scripts/icons/render.mjs   (precisa de playwright-core acessível; não é dependência do app)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const here = new URL('./', import.meta.url)
const out = new URL('../../public/', import.meta.url)
const jobs = [
  ['icon.svg', 'pwa-192.png', 192],
  ['icon.svg', 'pwa-512.png', 512],
  ['maskable.svg', 'pwa-maskable-512.png', 512],
  ['maskable.svg', 'apple-touch-icon.png', 180],
]
// os ícones têm texto ("LPO") na Archivo do app: a fonte vai embutida na página de renderização
const archivo = readFileSync(new URL('../../src/assets/fonts/archivo-latin-wdth-wght.woff2', import.meta.url)).toString('base64')
const fontFace = `@font-face{font-family:'Archivo';font-weight:100 900;font-stretch:62% 125%;src:url(data:font/woff2;base64,${archivo}) format('woff2-variations')}`
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge' })
const page = await browser.newPage()
for (const [svg, png, size] of jobs) {
  const markup = readFileSync(new URL(svg, here), 'utf8')
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<html><head><style>${fontFace}</style></head><body style="margin:0;background:transparent">${markup.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  )
  await page.evaluate(() => document.fonts.ready)
  // fileURLToPath: o caminho pode ter acento ("Área de Trabalho"), que a URL guarda percent-encoded
  await page.screenshot({ path: fileURLToPath(new URL(png, out)), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })
  console.log(png, size)
}
await browser.close()

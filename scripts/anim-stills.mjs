// Imagens paradas das animações próprias para o app (uma por fase), renderizadas no corpo 3D (tools/render3d).
// Uso: npm run anim:stills [-- <id> ...]   (sem ids = todos)
// 1) empacota o motor (src/anim) em tools/render3d/anim-engine.js;
// 2) abre tools/render3d/index.html no Edge/Chrome do sistema (playwright-core; PW_CHANNEL=chrome para o Chrome),
//    um quadro parado por pose (?bare), e exporta o palco em WebP;
// 3) grava public/anim/<id>/<n>.webp e src/anim/stills.json (manifesto: status de revisão, miniatura e, por imagem,
//    arquivo e rótulo). O app lê só o manifesto (não carrega o motor); stills.test.ts confere que ele está em dia.
// A página carrega three.js da CDN (jsdelivr): precisa de internet.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import vm from 'node:vm'
import { chromium } from 'playwright-core'
import { build } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const tool = join(root, 'tools', 'render3d')
const SIZE = 480
const QUALITY = 0.86

// 1) motor
await build({
  root,
  configFile: false,
  publicDir: false, // sem isto o vite copiava public/ (imagens, ícones) para tools/render3d
  logLevel: 'warn',
  build: {
    outDir: tool,
    emptyOutDir: false,
    minify: true,
    lib: { entry: join(tool, 'engine-entry.ts'), formats: ['iife'], name: 'AnimBundle', fileName: () => 'anim-engine.js' },
  },
})
const ctx = { globalThis: {} }
ctx.globalThis = ctx
vm.createContext(ctx)
vm.runInContext(readFileSync(join(tool, 'anim-engine.js'), 'utf8'), ctx)
const Anim = ctx.Anim
const only = process.argv.slice(2)
const specs = Anim.EXERCISES.filter((e) => !only.length || only.includes(e.id))

// 2) render
const manifestPath = join(root, 'src', 'anim', 'stills.json')
let manifest = {}
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
} catch {}
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: SIZE + 40, height: SIZE + 40 }, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.error('página:', String(e)))
for (const spec of specs) {
  const stills = Anim.stillFrames(spec)
  const dir = join(root, 'public', 'anim', spec.id)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const entries = []
  for (const [i, s] of stills.entries()) {
    const url = pathToFileURL(join(tool, 'index.html')).href + `?bare&size=${SIZE}&theme=light&cards=${encodeURIComponent(spec.id)}:neutro@${s.ms}`
    await page.goto(url)
    await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 120000 })
    await page.waitForTimeout(250)
    const b64 = await page.evaluate((q) => {
      const src = document.querySelector('.stage canvas')
      const c = document.createElement('canvas')
      c.width = src.width
      c.height = src.height
      const g = c.getContext('2d')
      // fundo do palco (gradiente claro) + o quadro 3D
      const css = getComputedStyle(document.documentElement)
      const gr = g.createLinearGradient(0, 0, 0, c.height)
      gr.addColorStop(0, css.getPropertyValue('--stage-a').trim() || '#faf9f7')
      gr.addColorStop(1, css.getPropertyValue('--stage-b').trim() || '#e9e6e1')
      g.fillStyle = gr
      g.fillRect(0, 0, c.width, c.height)
      g.drawImage(src, 0, 0)
      return c.toDataURL('image/webp', q).split(',')[1]
    }, QUALITY)
    const file = `${i + 1}.webp`
    writeFileSync(join(dir, file), Buffer.from(b64, 'base64'))
    entries.push({ src: `anim/${spec.id}/${file}`, label: s.name })
    console.log(`${spec.id} ${i + 1}/${stills.length} ${s.name}`)
  }
  // miniatura = a pose do meio (frames[floor(n/2)], regra do PROCESSO.md) se ela for uma das imagens
  const mid = spec.frames[Math.floor(spec.frames.length / 2)].name
  const thumb = Math.max(0, stills.findIndex((x) => x.name === mid))
  manifest[spec.id] = { status: spec.review.status, thumb, stills: entries }
}
await browser.close()

// 3) manifesto (ordenado por id, para diffs estáveis)
const sorted = Object.fromEntries(Object.keys(manifest).sort().map((k) => [k, manifest[k]]))
writeFileSync(manifestPath, JSON.stringify(sorted, null, 2) + '\n')
console.log('manifesto:', manifestPath)

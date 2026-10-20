// Folha de contato de uma animação (portão 2 do docs/animacoes/PROCESSO.md).
// Uso: npm run anim:sheet -- <id>      (ex.: 0032)   ou   npm run anim:sheet -- all   [--zoom 2]
// Gera docs/animacoes/folhas/<id>.html e .png. O PNG usa o Edge/Chrome do sistema (playwright-core,
// sem baixar navegador): PW_CHANNEL=chrome para usar o Chrome.
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const zi = args.indexOf('--zoom')
// --zoom 2: PNG em 2x (detalhes de mão, pé e contato com o aparelho)
const zoom = zi >= 0 ? Number(args.splice(zi, 2)[1]) || 2 : 1
const which = args[0]
if (!which) {
  console.error('Uso: npm run anim:sheet -- <id do exercício | all> [--zoom 2]')
  process.exit(1)
}
const outDir = join(root, 'docs', 'animacoes', 'folhas')

// 1) HTML (renderização pelo próprio motor, via vitest, que entende TS/TSX)
execFileSync(process.execPath, [join(root, 'node_modules', 'vitest', 'vitest.mjs'), 'run', 'tests/anim-sheet.gen.test.ts', '--fsModuleCache=false'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ANIM_SHEET: which, ANIM_SHEET_DIR: outDir },
})

// 2) PNG
const files = readdirSync(outDir).filter((f) => f.endsWith('.html') && (which === 'all' || f === `${which}.html`))
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge' })
const page = await browser.newPage({ viewport: { width: 1330, height: 900 }, deviceScaleFactor: zoom })
for (const f of files) {
  await page.goto(pathToFileURL(join(outDir, f)).href)
  await page.waitForTimeout(800) // GIF do dataset
  const png = join(outDir, f.replace(/\.html$/, '.png'))
  await page.screenshot({ path: png, fullPage: true })
  console.log('folha:', png)
}
await browser.close()

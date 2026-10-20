import { mkdirSync, writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { EXERCISES } from '../src/anim/exercises'
import { sheetHtml } from '../src/anim/render/sheet'

/**
 * Gerador das folhas de contato (não é um teste de verdade: só age com ANIM_SHEET definido).
 * Uso: `npm run anim:sheet -- <id>` (ou `-- all`). Ver scripts/anim-sheet.mjs.
 */
it.runIf(!!process.env.ANIM_SHEET)('gera folha de contato', async () => {
  const which = process.env.ANIM_SHEET!
  const out = process.env.ANIM_SHEET_DIR!
  mkdirSync(out, { recursive: true })
  const list = which === 'all' ? EXERCISES : EXERCISES.filter((e) => e.id === which)
  if (!list.length) throw new Error(`exercício "${which}" não está em src/anim/exercises/index.ts`)
  const cdn = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main'
  const all = (await (await fetch(`${cdn}/data/exercises.json`)).json()) as { id: string; gif_url: string }[]
  for (const spec of list) {
    const gif = all.find((e) => e.id === spec.datasetId)?.gif_url
    writeFileSync(`${out}/${spec.id}.html`, sheetHtml(spec, gif ? `${cdn}/${gif}` : undefined))
  }
})

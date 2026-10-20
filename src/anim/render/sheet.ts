import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BodyMap } from '../BodyMap'
import { keyframeTime, runChecks } from '../checks'
import { cycleMs, musclesOf, sampleAt, type ExerciseSpec } from '../spec'
import { DEFAULT_CAMERA, viewBoxFor } from './camera'
import { Figure } from './Figure'

/**
 * Folha de contato de um exercício (portão 2 do docs/animacoes/PROCESSO.md): GIF do dataset, poses-chave,
 * tira do movimento, vista de costas, músculos por fase e o resultado das verificações. Gera HTML puro
 * (sem React no navegador); scripts/anim-sheet.mjs transforma em PNG.
 */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

function frameSvg(spec: ExerciseSpec, ms: number, size: number, camera = spec.camera ?? DEFAULT_CAMERA) {
  const s = sampleAt(spec, ms)
  const vb = viewBoxFor(spec, camera).join(' ')
  const body = renderToStaticMarkup(createElement(Figure, { skeleton: s.skeleton, props: spec.props, muscles: musclesOf(spec, s.phase), camera }))
  return { svg: `<svg viewBox="${vb}" width="${size}" height="${size}" style="background:#fff;border-radius:10px">${body}</svg>`, phase: s.phase }
}

const cell = (inner: string, caption: string) => `<figure style="margin:0;display:inline-block;vertical-align:top;margin:3px">${inner}<figcaption style="font-size:11px;color:#555;max-width:200px">${esc(caption)}</figcaption></figure>`

export function sheetHtml(spec: ExerciseSpec, datasetGifUrl?: string): string {
  const failures = runChecks(spec)
  const keys = spec.frames
    .map((f, i) => cell(frameSvg(spec, keyframeTime(spec, i), 200).svg, `${i + 1}. ${f.name ?? '—'} · ${f.phase}`))
    .join('')
  const T = cycleMs(spec)
  const strip = Array.from({ length: 10 }, (_, i) => {
    const ms = Math.round((i * T) / 10)
    const f = frameSvg(spec, ms, 120)
    return cell(f.svg, `${ms} ms · ${f.phase}`)
  }).join('')
  const cam = spec.camera ?? DEFAULT_CAMERA
  const back = cell(frameSvg(spec, keyframeTime(spec, Math.floor(spec.frames.length / 2)), 200, { yaw: cam.yaw + 180, pitch: cam.pitch }).svg, 'vista oposta (costas)')
  const ref = datasetGifUrl ? cell(`<img src="${datasetGifUrl}" width="200" height="200" style="background:#fff;border-radius:10px">`, `dataset ${spec.datasetId}`) : ''
  const maps = spec.phases
    .map((p) => {
      const m = musclesOf(spec, p.name)
      return `<div style="display:inline-block;width:260px;vertical-align:top;margin:3px"><b style="font-size:12px">${esc(p.name)}</b>${renderToStaticMarkup(createElement(BodyMap, { primary: m.primary, secondary: m.secondary }))}</div>`
    })
    .join('')
  const checks = failures.length
    ? `<ul style="color:#b3261e">${failures.map((f) => `<li><b>${esc(f.check)}</b> · ${esc(f.where)}: ${esc(f.message)}</li>`).join('')}</ul>`
    : `<p style="color:#1b7f3b">✓ Todas as verificações passaram (ficha, gerais e ${spec.checks.length} específicas).</p>`
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(spec.name)}</title></head>
<body style="font-family:system-ui,sans-serif;background:#f3f4f5;margin:12px;width:1300px">
<h2 style="margin:0 0 4px">${esc(spec.name)} <small style="color:#777">(${esc(spec.id)} · ${esc(spec.review.status)})</small></h2>
<div>${ref}${keys}${back}</div>
<h3 style="margin:10px 0 2px;font-size:14px">Movimento (ciclo de ${T} ms)</h3><div>${strip}</div>
<h3 style="margin:10px 0 2px;font-size:14px">Músculos por fase</h3><div>${maps}</div>
<p style="font-size:11px;color:#666">Fonte: ${esc(spec.muscleSource)}</p>
<h3 style="margin:10px 0 2px;font-size:14px">Verificações</h3>${checks}
</body></html>`
}

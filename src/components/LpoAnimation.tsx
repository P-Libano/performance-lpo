import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { LPO_DEFS, type LpoAnimation as LpoId } from '../data/lpo'
import { BAR, CAM, LEN, SEQUENCES, TO_CAM, VIEWBOX, cycleMs, frameAt, gripFor, project, rig, type P3, type Pose, type Pt, type Side3 } from './lpoPoses'

/*
 * Desenho no padrão dos GIFs do dataset (Gym Visual): fundo branco, câmera 3/4, figura anatômica clara
 * (pele quase branca, contorno cinza fino, sombreado do lado oposto à luz), short cinza-escuro, pés descalços,
 * músculo-alvo em vermelho e secundários em rosa, barra cinza com anilhas pretas e miolo metálico.
 * É um desenho próprio, gerado por geometria; não reproduz a mídia licenciada.
 *
 * Cada parte do corpo é um sólido simples (cilindros afunilados, esferas, um tronco feito de elipses
 * empilhadas), projetado em 3/4. Músculos e sombras são recortes da superfície desses sólidos, só na parte
 * voltada para a câmera.
 */

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

// ───────── cores (fixas: o quadro é branco nos dois temas, como o .gif-frame dos GIFs) ─────────
const C = {
  skin: '#f4f2f0',
  skinFar: '#e4e1de',
  shade: '#d9d5d1',
  shadeFar: '#cbc7c3',
  line: '#8a8580',
  detail: '#c9c4bf',
  hair: '#3a3532',
  shorts: '#50555d',
  shortsFar: '#40444b',
  target: '#c8453b',
  targetLine: '#962c24',
  second: '#eaa093',
  secondLine: '#c97a6e',
  plate: '#2b2c2f',
  plateRim: '#161719',
  plateRing: '#424349',
  hub: '#a9afb6',
  bar: '#80868d',
  sleeve: '#abb1b8',
}
const STROKE = 0.5

// ───────── vetores ─────────
const add = (a: P3, b: P3): P3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: P3, k: number): P3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: P3, b: P3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: P3, b: P3): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (a: P3): P3 => mul(a, 1 / (Math.hypot(...a) || 1))
const DEG = Math.PI / 180

/** Luz de cima, da frente e da esquerda da tela: a sombra cai atrás e do lado de lá, como nos GIFs. */
const SCREEN_RIGHT: P3 = [Math.cos(CAM.yaw * DEG), 0, -Math.sin(CAM.yaw * DEG)]
const LIGHT = unit(add(add(TO_CAM, [0, -0.9, 0]), mul(SCREEN_RIGHT, -0.5)))

// ───────── 2D ─────────
function hull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (p.length < 3) return p
  const turn = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const half = (list: Pt[]) => {
    const out: Pt[] = []
    for (const q of list) {
      while (out.length >= 2 && turn(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop()
      out.push(q)
    }
    return out.slice(0, -1)
  }
  return [...half(p), ...half([...p].reverse())]
}

const d = (pts: Pt[]) => (pts.length > 2 ? `M${pts.map((q) => `${q[0].toFixed(2)} ${q[1].toFixed(2)}`).join('L')}Z` : '')
const poly = (pts: Pt[]) => pts.map((q) => `${q[0].toFixed(2)},${q[1].toFixed(2)}`).join(' ')

/** Esferas projetadas (círculos) → contorno convexo: membros com juntas arredondadas. */
function blob(spheres: [P3, number][]): Pt[] {
  const pts: Pt[] = []
  for (const [c, r] of spheres) {
    const [x, y] = project(c)
    for (let i = 0; i < 24; i++) pts.push([x + r * Math.cos((i * Math.PI) / 12), y + r * Math.sin((i * Math.PI) / 12)])
  }
  return hull(pts)
}

// ───────── superfícies ─────────

/** Referencial de um sólido: origem, eixo (comprimento len), anterior (N) e lateral (L). */
interface Frame3 {
  o: P3
  A: P3
  N: P3
  L: P3
  len: number
}
function frameOf(a: P3, b: P3, front: P3): Frame3 {
  const dd = sub(b, a)
  const len = Math.hypot(...dd) || 1
  const A = mul(dd, 1 / len)
  const N = unit(sub(front, mul(A, dot(front, A))))
  return { o: a, A, N, L: cross(A, N), len }
}

/** Seção transversal em u (0 = origem, 1 = ponta): meia-profundidade (N), meia-largura (L), deslocamento em N. */
type Section = { u: number; rN: number; rL: number; c: number }
type Prof = (u: number) => Section
const cone =
  (ra: number, rb: number): Prof =>
  (u) => {
    const r = ra + (rb - ra) * Math.min(1, Math.max(0, u))
    return { u, rN: r, rL: r, c: 0 }
  }
const lofted =
  (secs: Section[]): Prof =>
  (u) => {
    if (u <= secs[0].u) return { ...secs[0], u }
    for (let i = 1; i < secs.length; i++) {
      const [a, b] = [secs[i - 1], secs[i]]
      if (u <= b.u) {
        const t = (u - a.u) / (b.u - a.u)
        return { u, rN: a.rN + (b.rN - a.rN) * t, rL: a.rL + (b.rL - a.rL) * t, c: a.c + (b.c - a.c) * t }
      }
    }
    return { ...secs[secs.length - 1], u }
  }

const surf = (f: Frame3, s: Section, ang: number): P3 =>
  add(add(add(f.o, mul(f.A, s.u * f.len)), mul(f.N, s.c + s.rN * Math.cos(ang * DEG))), mul(f.L, s.rL * Math.sin(ang * DEG)))

/** Ângulo (graus, 0 = anterior) para onde aponta um vetor, no plano da seção. */
const angleOf = (f: Frame3, s: Section, dir: P3) => Math.atan2(dot(f.L, dir) / s.rL, dot(f.N, dir) / s.rN) / DEG

/** Traz o ângulo `a` para perto de `ref` (diferença em −180..180). */
const near = (a: number, ref: number) => a - 360 * Math.round((a - ref) / 360)

/**
 * Recorte da superfície entre u0..u1 e ângulos centro ± meia-abertura, só a parte visível.
 * `spindle` afina as pontas (forma de músculo).
 */
function patch(f: Frame3, prof: Prof, u0: number, u1: number, center: number, half: number, spindle = true): Pt[] {
  const left: Pt[] = []
  const right: Pt[] = []
  const rows = 8
  for (let i = 0; i <= rows; i++) {
    const u = u0 + ((u1 - u0) * i) / rows
    const s = prof(u)
    const h = spindle ? half * Math.pow(Math.sin((Math.PI * (i + 0.35)) / (rows + 0.7)), 0.7) : half
    const vis = angleOf(f, s, TO_CAM)
    const c = near(center, vis)
    const lo = Math.max(c - h, vis - 89)
    const hi = Math.min(c + h, vis + 89)
    if (hi - lo < 2) continue
    const row: Pt[] = []
    for (let k = 0; k <= 6; k++) row.push(project(surf(f, s, lo + ((hi - lo) * k) / 6)))
    if (!left.length) left.push(...row.slice(0, -1).reverse()) // borda de baixo acompanha a curvatura
    left.push(row[0])
    right.unshift(row[6])
    if (i === rows) right.unshift(...row.slice(1, -1))
  }
  return left.length + right.length >= 3 ? [...left, ...right] : []
}

/** Linha sobre a superfície num ângulo fixo (separação entre músculos), só onde está visível. */
function seam(f: Frame3, prof: Prof, ang: number, u0: number, u1: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= 6; i++) {
    const s = prof(u0 + ((u1 - u0) * i) / 6)
    const vis = angleOf(f, s, TO_CAM)
    const a = near(ang, vis)
    if (Math.abs(a - vis) < 72) out.push(project(surf(f, s, a)))
  }
  return out
}

// ───────── músculos ─────────

type Muscle = 'glutes' | 'hamstrings' | 'quadriceps' | 'calves' | 'traps' | 'delts' | 'triceps' | 'core'
type Level = 0 | 1 | 2 // 0 = nada, 1 = secundário (rosa), 2 = alvo (vermelho)
type Muscles = Partial<Record<Muscle, Level>>

/** Músculos destacados de cada animação, tirados das próprias fichas (LPO_DEFS: target e secondary). */
const MUSCLES = Object.fromEntries(
  (Object.keys(SEQUENCES) as LpoId[]).map((id) => {
    const def = LPO_DEFS.find((x) => x.animation === id)
    const m: Muscles = {}
    if (def) {
      for (const s of def.secondary) m[s as Muscle] = 1
      m[def.target as Muscle] = 2
    }
    return [id, m]
  }),
) as Record<LpoId, Muscles>

function MusclePatch({ pts, level }: { pts: Pt[]; level?: Level }) {
  if (!level || pts.length < 3) return null
  const hot = level === 2
  return <path d={d(pts)} fill={hot ? C.target : C.second} stroke={hot ? C.targetLine : C.secondLine} strokeWidth={0.35} strokeLinejoin="round" opacity={0.93} />
}

const Detail = ({ pts }: { pts: Pt[] }) => (pts.length > 1 ? <polyline points={poly(pts)} fill="none" stroke={C.detail} strokeWidth={0.4} strokeLinecap="round" strokeLinejoin="round" /> : null)

// ───────── partes do corpo ─────────

interface Look {
  near: boolean
  m: Muscles
}
const skinOf = (k: Look) => (k.near ? C.skin : C.skinFar)
const shadeOf = (k: Look) => (k.near ? C.shade : C.shadeFar)

function Solid({ outline, fill, children }: { outline: Pt[]; fill: string; children?: ReactNode }) {
  return (
    <g>
      <path d={d(outline)} fill={fill} stroke={C.line} strokeWidth={STROKE} strokeLinejoin="round" />
      {children}
    </g>
  )
}

/** Sombra em dois tons (meia-sombra larga e núcleo estreito) no lado oposto à luz: dá volume. */
function Shading({ f, prof, k, u0 = 0, u1 = 1 }: { f: Frame3; prof: Prof; k: Look; u0?: number; u1?: number }) {
  const away = angleOf(f, prof((u0 + u1) / 2), LIGHT) + 180
  return (
    <>
      <path d={d(patch(f, prof, u0, u1, away, 85, false))} fill={shadeOf(k)} opacity={0.55} />
      <path d={d(patch(f, prof, u0, u1, away, 40, false))} fill={shadeOf(k)} />
    </>
  )
}

/** Sentido "da frente" de um segmento de perna/braço no plano de perfil (onde ficam quadríceps e bíceps). */
const limbFront = (a: P3, b: P3): P3 => {
  const t = unit(sub(b, a))
  return [t[1], -t[0], 0]
}

const R = { hip: 6.6, thighMid: 6.2, knee: 4.4, calf: 4.1, ankle: 2.5, shoulder: 4.9, arm: 3.7, elbow: 2.9, fore: 3.1, wrist: 2.1, hand: 2.6 }

function Foot({ sd, k }: { sd: Side3; k: Look }) {
  // pé descalço: perfil calcanhar → dedos extrudado na largura do pé
  const fw = unit(sub(sd.toe, sd.heel))
  const up: P3 = [fw[1], -fw[0], 0]
  const L = Math.hypot(...sub(sd.toe, sd.heel))
  const at = (along: number, h: number) => add(sd.heel, add(mul(fw, along), mul(up, h)))
  const profile: P3[] = [at(0.4, 0), at(-0.6, 1.4), at(0.2, 3.2), at(L * 0.4, 3.6), at(L * 0.75, 1.9), at(L + 0.6, 0.9), at(L, 0)]
  const w = 2.6
  const outline = hull(profile.flatMap((q) => [project(add(q, [0, 0, -w])), project(add(q, [0, 0, w]))]))
  const z = k.near ? w : -w
  const toes = [project(add(at(L * 0.78, 2.1), [0, 0, z * 0.2])), project(add(at(L * 0.82, 0.2), [0, 0, z * 0.2]))]
  return (
    <Solid outline={outline} fill={skinOf(k)}>
      <polyline points={poly(toes)} stroke={C.detail} strokeWidth={0.4} />
    </Solid>
  )
}

function Leg({ sd, k }: { sd: Side3; k: Look }) {
  const thighF = frameOf(sd.hip, sd.knee, limbFront(sd.hip, sd.knee))
  const shinF = frameOf(sd.knee, sd.ankle, limbFront(sd.knee, sd.ankle))
  const thighP = cone(R.hip, R.knee)
  const shinP = cone(R.knee * 0.95, R.ankle)
  // volume do quadríceps e da panturrilha (esferas a mais no contorno)
  const quad = add(sd.hip, add(mul(thighF.A, thighF.len * 0.42), mul(thighF.N, 1.1)))
  const calf = add(sd.knee, add(mul(shinF.A, shinF.len * 0.3), mul(shinF.N, -1.4)))
  const shortsEnd = add(sd.hip, add(mul(thighF.A, thighF.len * 0.17), mul(thighF.N, 0.3)))
  return (
    <g>
      <Solid outline={blob([[sd.knee, R.knee * 0.95], [calf, R.calf], [sd.ankle, R.ankle]])} fill={skinOf(k)}>
        <Shading f={shinF} prof={shinP} k={k} />
        <Detail pts={seam(shinF, shinP, 30, 0.12, 0.8)} />
        <MusclePatch pts={patch(shinF, shinP, 0.08, 0.62, 180, 85)} level={k.m.calves} />
      </Solid>
      <Foot sd={sd} k={k} />
      <Solid outline={blob([[sd.hip, R.hip], [quad, R.thighMid], [sd.knee, R.knee]])} fill={skinOf(k)}>
        <Shading f={thighF} prof={thighP} k={k} />
        <Detail pts={seam(thighF, thighP, 100, 0.3, 0.92)} />
        <Detail pts={seam(thighF, thighP, -35, 0.45, 0.95)} />
        <MusclePatch pts={patch(thighF, thighP, 0.2, 0.92, 0, 80)} level={k.m.quadriceps} />
        <MusclePatch pts={patch(thighF, thighP, 0.18, 0.9, 180, 72)} level={k.m.hamstrings} />
        {/* perna do short */}
        <path d={d(blob([[sd.hip, R.hip - 0.2], [shortsEnd, R.thighMid]]))} fill={k.near ? C.shorts : C.shortsFar} stroke={C.line} strokeWidth={STROKE} strokeLinejoin="round" />
      </Solid>
    </g>
  )
}

function Arm({ sd, k }: { sd: Side3; k: Look }) {
  const upF = frameOf(sd.shoulder, sd.elbow, limbFront(sd.shoulder, sd.elbow))
  const foreF = frameOf(sd.elbow, sd.hand, limbFront(sd.elbow, sd.hand))
  const upP = cone(R.arm, R.elbow)
  const foreP = cone(R.fore, R.wrist)
  const fore = add(sd.elbow, add(mul(foreF.A, foreF.len * 0.28), mul(foreF.N, -0.6)))
  const delt = add(sd.shoulder, mul(upF.A, 2.5))
  return (
    <g>
      <Solid outline={blob([[delt, R.shoulder], [add(sd.shoulder, mul(upF.A, upF.len * 0.5)), R.arm], [sd.elbow, R.elbow]])} fill={skinOf(k)}>
        <Shading f={upF} prof={upP} k={k} />
        <MusclePatch pts={patch(upF, upP, 0.3, 0.9, 180, 70)} level={k.m.triceps} />
        <Detail pts={seam(upF, upP, 70, 0.3, 0.85)} />
      </Solid>
      {/* deltoide: a "tampa" do ombro */}
      <Solid outline={blob([[delt, R.shoulder], [add(sd.shoulder, mul(upF.A, 6.5)), R.arm * 0.9]])} fill={k.m.delts ? (k.m.delts === 2 ? C.target : C.second) : skinOf(k)} />
      <Solid outline={blob([[sd.elbow, R.elbow], [fore, R.fore], [sd.hand, R.wrist]])} fill={skinOf(k)}>
        <Shading f={foreF} prof={foreP} k={k} />
      </Solid>
      {/* mão fechada na barra */}
      <Solid outline={blob([[sd.hand, R.hand]])} fill={skinOf(k)} />
    </g>
  )
}

/** Tronco: elipses empilhadas do quadril ao ombro (glúteo atrás, peito à frente, ombros largos). */
const TORSO: Section[] = [
  { u: -0.12, rN: 5.6, rL: 8.2, c: -0.6 },
  { u: 0.05, rN: 7, rL: 9.8, c: -1.2 },
  { u: 0.42, rN: 5.6, rL: 8.6, c: 0.2 },
  { u: 0.72, rN: 7.4, rL: 11, c: 1.3 },
  { u: 0.93, rN: 6, rL: 12.6, c: 0.2 },
  { u: 1.06, rN: 4.4, rL: 7.4, c: -0.6 },
]

function Torso({ hip, shoulder, k }: { hip: P3; shoulder: P3; k: Look }) {
  const t = unit(sub(shoulder, hip))
  const f = frameOf(hip, shoulder, [-t[1], t[0], 0])
  const prof = lofted(TORSO)
  const ring = (s: Section) => Array.from({ length: 24 }, (_, i) => project(surf(f, s, i * 15)))
  const outline = hull(TORSO.flatMap(ring))
  const shorts = hull([TORSO[0], TORSO[1], prof(0.22)].flatMap(ring))
  // glúteo do lado de cá: volume atrás do quadril
  const glute = (u: number) => add(hip, add(add(mul(f.N, -3.6), mul(f.A, u)), [0, 0, 4.4]))
  const gluteFill = k.m.glutes === 2 ? C.target : k.m.glutes === 1 ? C.second : C.shorts
  return (
    <Solid outline={outline} fill={C.skin}>
      <Shading f={f} prof={prof} k={k} u0={0} u1={1.06} />
      {/* peitoral, linha alba, abdômen e oblíquos: o "desenho anatômico" de base */}
      <Detail pts={seam(f, prof, 0, 0.3, 0.7)} />
      <Detail pts={[-40, -15, 10, 35, 60].map((a) => project(surf(f, prof(0.7), a)))} />
      <Detail pts={[-20, 0, 20].map((a) => project(surf(f, prof(0.55), a)))} />
      <Detail pts={[-20, 0, 20].map((a) => project(surf(f, prof(0.44), a)))} />
      <Detail pts={seam(f, prof, 58, 0.28, 0.62)} />
      <MusclePatch pts={patch(f, prof, 0.24, 0.68, 0, 50)} level={k.m.core} />
      <MusclePatch pts={patch(f, prof, 0.26, 0.66, 72, 20)} level={k.m.core} />
      <path d={d(shorts)} fill={C.shorts} stroke={C.line} strokeWidth={STROKE} strokeLinejoin="round" />
      <path d={d(blob([[glute(-1), 4.6], [glute(4), 4.6]]))} fill={gluteFill} stroke={k.m.glutes === 2 ? C.targetLine : C.line} strokeWidth={STROKE} opacity={k.m.glutes ? 0.95 : 1} />
      <MusclePatch pts={patch(f, prof, 0.78, 1.06, 160, 80)} level={k.m.traps} />
      <MusclePatch pts={patch(f, prof, 0.78, 1.06, -160, 80)} level={k.m.traps} />
    </Solid>
  )
}

function Head({ neck, head, torsoUp, front }: { neck: P3; head: P3; torsoUp: P3; front: P3 }) {
  const up = unit(torsoUp)
  const fw = unit(sub(front, mul(up, dot(front, up))))
  const lat: P3 = [0, 0, 1] // perfil no plano xy: o lado de cá é z+
  const r = 6
  const at = (p: P3) => project(p)
  const off = (a: number, b: number, c: number) => add(head, add(add(mul(fw, a), mul(up, b)), mul(lat, c)))
  const jaw = off(2.2, -3.6, 0)
  // cabelo curto: calota de cima e de trás, só a parte voltada para a câmera
  const hairPts: Pt[] = []
  for (let i = 0; i <= 12; i++)
    for (let j = 0; j < 24; j++) {
      const th = (i / 12) * Math.PI
      const ph = (j / 24) * 2 * Math.PI
      const dir = add(add(mul(up, Math.cos(th)), mul(fw, Math.sin(th) * Math.cos(ph))), mul(lat, Math.sin(th) * Math.sin(ph)))
      const inHair = dot(dir, up) + 0.75 * Math.max(0, -dot(dir, fw)) > 0.3
      if (inHair && dot(dir, TO_CAM) > -0.02) hairPts.push(at(add(head, mul(dir, r * 1.05))))
    }
  const eye = off(r * 0.8, 0.3, 2.4)
  const neckF = frameOf(neck, head, fw)
  const neckP = cone(4.2, 3.8)
  return (
    <g>
      <Solid outline={blob([[add(neck, mul(up, -1)), 4.4], [off(-0.5, -2.5, 0), 3.9]])} fill={C.skin}>
        <Shading f={neckF} prof={neckP} k={{ near: true, m: {} }} />
      </Solid>
      <Solid outline={blob([[head, r], [jaw, 3.9]])} fill={C.skin}>
        <path d={d(hull(hairPts))} fill={C.hair} />
        <Solid outline={blob([[off(-0.8, -0.6, r * 0.92), 1.5]])} fill={C.shade} />
        {dot(fw, TO_CAM) > 0 && (
          <>
            <polyline points={poly([at(off(r * 0.93, 0.8, 1.4)), at(off(r + 1.3, -1.4, 1.4)), at(off(r * 0.88, -2.1, 1.4))])} fill={C.skin} stroke={C.line} strokeWidth={0.4} strokeLinejoin="round" />
            <circle cx={at(eye)[0]} cy={at(eye)[1]} r={0.55} fill={C.hair} />
            <polyline points={poly([at(off(r * 0.82, 1.6, 1.2)), at(off(r * 0.74, 1.8, 3.3))])} fill="none" stroke={C.hair} strokeWidth={0.55} strokeLinecap="round" />
          </>
        )}
      </Solid>
    </g>
  )
}

// ───────── barra ─────────

/** Matriz que leva o disco unitário do plano xy (em z = c[2]) para a tela: a anilha vira elipse. */
function discMatrix(c: P3) {
  const o = project(c)
  const ex = project(add(c, [1, 0, 0]))
  const ey = project(add(c, [0, 1, 0]))
  const f = (n: number) => n.toFixed(4)
  return `matrix(${f(ex[0] - o[0])} ${f(ex[1] - o[1])} ${f(ey[0] - o[0])} ${f(ey[1] - o[1])} ${f(o[0])} ${f(o[1])})`
}

function Plate({ c, side }: { c: Pt; side: -1 | 1 }) {
  const zIn = side * BAR.plateIn
  const zOut = side * BAR.plateOut
  const P = LEN.plate
  // aro (espessura da anilha) = contorno das duas faces; face visível = a de z maior (voltada para a câmera)
  const ring = (z: number) => Array.from({ length: 36 }, (_, i) => project([c[0] + P * Math.cos(i * 10 * DEG), c[1] + P * Math.sin(i * 10 * DEG), z]))
  return (
    <g>
      <path d={d(hull([...ring(zIn), ...ring(zOut)]))} fill={C.plateRim} stroke={C.plateRim} strokeWidth={0.4} strokeLinejoin="round" />
      <g transform={discMatrix([c[0], c[1], Math.max(zIn, zOut)])}>
        <circle r={P} fill={C.plate} />
        <circle r={P * 0.92} fill="none" stroke={C.plateRing} strokeWidth={0.5} />
        <circle r={P * 0.4} fill="none" stroke={C.plateRing} strokeWidth={0.7} />
        <circle r={2.3} fill={C.hub} />
        <circle r={1} fill={C.bar} />
      </g>
    </g>
  )
}

function BarSeg({ c, z0, z1, w, color }: { c: Pt; z0: number; z1: number; w: number; color: string }) {
  const [a, b] = [project([c[0], c[1], z0]), project([c[0], c[1], z1])]
  return (
    <g strokeLinecap="round">
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={C.line} strokeWidth={w + 0.6} />
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={w} />
    </g>
  )
}

/** Ponta da barra de um lado: eixo até a mão, colar, manga e anilha, na ordem de pintura certa. */
function BarEnd({ c, side, grip }: { c: Pt; side: -1 | 1; grip: number }) {
  const s = side
  const plate = <Plate c={c} side={side} />
  const sleeveOut = <BarSeg c={c} z0={s * BAR.plateOut} z1={s * BAR.end} w={2.6} color={C.sleeve} />
  const sleeveIn = <BarSeg c={c} z0={s * BAR.collar} z1={s * BAR.plateIn} w={2.6} color={C.sleeve} />
  const collar = <BarSeg c={c} z0={s * (BAR.collar - 0.6)} z1={s * (BAR.collar + 0.6)} w={4} color={C.sleeve} />
  const shaft = <BarSeg c={c} z0={s * (grip + 2)} z1={s * BAR.collar} w={1.7} color={C.bar} />
  // lado de lá: a manga externa fica atrás da anilha; lado de cá: o eixo e o colar ficam atrás
  return side < 0 ? (
    <g>
      {sleeveOut}
      {plate}
      {sleeveIn}
      {shaft}
      {collar}
    </g>
  ) : (
    <g>
      {shaft}
      {collar}
      {sleeveIn}
      {plate}
      {sleeveOut}
    </g>
  )
}

// ───────── figura ─────────

/**
 * Um quadro da animação (vai dentro de um <svg viewBox={viewBoxAttr(id)}>). Ordem de pintura fixa, de trás
 * para a frente: ponta da barra do lado de lá, braço e perna de lá, tronco, cabeça, perna de cá, meio da barra,
 * braço de cá e ponta da barra de cá.
 */
export function Figure({ pose, id = 'snatch' }: { pose: Pose; id?: LpoId }) {
  const r = rig(pose, gripFor(id))
  const m = MUSCLES[id] ?? {}
  const far: Look = { near: false, m }
  const nearL: Look = { near: true, m }
  const s = r.s
  const at = (q: Pt): P3 => [q[0], q[1], 0]
  const up = sub(at(s.shoulder), at(s.hip))
  return (
    <>
      <BarEnd c={s.bar} side={-1} grip={r.grip} />
      <Arm sd={r.far} k={far} />
      <Leg sd={r.far} k={far} />
      <Torso hip={at(s.hip)} shoulder={at(s.shoulder)} k={nearL} />
      <Head neck={at(s.neck)} head={at(s.head)} torsoUp={up} front={[-up[1], up[0], 0]} />
      <Leg sd={r.near} k={nearL} />
      <BarSeg c={s.bar} z0={-r.grip + 1.5} z1={r.grip - 1.5} w={1.7} color={C.bar} />
      <Arm sd={r.near} k={nearL} />
      <BarEnd c={s.bar} side={1} grip={r.grip} />
    </>
  )
}

export const viewBoxAttr = (id: LpoId) => (VIEWBOX[id] ?? VIEWBOX.snatch).join(' ')

/**
 * Animação vetorial do app para os LPO (o dataset não tem esses movimentos), com o nome da fase.
 * `still` = quadro fixo, sem legenda (miniaturas). Com "reduzir movimento" do sistema, também fica parada.
 * Fundo branco nos dois temas, como os GIFs do dataset (.gif-frame).
 */
export function LpoAnimation({ id, still, className = '', style }: { id: LpoId; still?: boolean; className?: string; style?: CSSProperties }) {
  const seq = SEQUENCES[id] ?? SEQUENCES.snatch
  const animate = !still && !reducedMotion()
  // começa parado na posição inicial (o ciclo abre com a volta do fim ao começo)
  const startAt = seq.frames[0][1]
  const [ms, setMs] = useState(startAt)

  useEffect(() => {
    if (!animate) return
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      setMs(startAt + now - t0)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animate, id, startAt])

  // parado: a 2ª puxada (ou o 4º quadro) resume melhor o movimento que a pose inicial
  const fixed = seq.frames[Math.min(3, seq.frames.length - 1)]
  const { pose, label } = animate ? frameAt(seq.frames, ms) : { pose: fixed[0], label: fixed[3] }
  return (
    <span className={`gif-frame relative block overflow-hidden ${className}`} style={{ background: '#fff', ...style }}>
      <svg viewBox={viewBoxAttr(id)} role="img" aria-label={seq.caption} className="block size-full" data-cycle-ms={cycleMs(seq.frames)}>
        <Figure pose={pose} id={id} />
      </svg>
      {!still && (
        <span
          className="absolute bottom-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
          style={{ background: 'rgba(255,255,255,.88)', color: '#4a5058', boxShadow: '0 0 0 1px #e4e7eb' }}
          aria-hidden
        >
          {label}
        </span>
      )}
    </span>
  )
}

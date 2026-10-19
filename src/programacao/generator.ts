import { CURATED, type MuscleGroup } from '../data/curated'
import { hasPullupBar, isAvailable } from '../domain/profile'
import { explain } from './explain'
import { GOALS } from './goals'
import { MASS, META, fitsRole } from './meta'
import { SPLIT_TEMPLATES, type DayTemplate, type Focus } from './templates'
import type {
  Day,
  ExerciseGroup,
  ExerciseMeta,
  ExercisePrescription,
  ExerciseRole,
  GoalProfile,
  Intensity,
  Level,
  Program,
  Range,
  RolePrescription,
  SlotSpec,
  Split,
  UserProfile,
  Week,
} from './types'

export type EquipmentLookup = (id: string) => string | undefined

const MIN_STRENGTH_PER_DAY = 4
const MAX_STRENGTH_PER_DAY = 6
const LOW_REP_LIMIT = 6 // faixas com mínimo abaixo disto exigem adequadoBaixasReps
const CURATED_ORDER = new Map(CURATED.map((c, i) => [c.id, i]))

// ───────────────────────── resolução de faixas ─────────────────────────

export interface ResolvedRole {
  sets: number
  reps: Range
  restSec: number
  setsRange: Range
  intensity: Intensity
}

/** Descanso "redondo": múltiplos de 15 s a partir de 1 min, de 5 s abaixo disso. */
const round5 = (n: number) => (n >= 60 ? Math.round(n / 15) * 15 : Math.round(n / 5) * 5)
const mid = (r: Range) => (r.min + r.max) / 2

/** Prescrição do papel para o nível (overrides do objetivo aplicados). */
export function resolveRole(goal: GoalProfile, role: Exclude<ExerciseRole, 'condicionamento'>, level: Level): ResolvedRole | undefined {
  const base = goal.roles[role]
  if (!base) return undefined
  const o = goal.levelOverrides?.[level]?.[role] ?? {}
  const p: RolePrescription = {
    sets: o.sets ?? base.sets,
    reps: o.reps ?? base.reps,
    restSec: o.restSec ?? base.restSec,
    intensity: { ...base.intensity, ...o.intensity },
  }
  const sets = level === 'iniciante' ? p.sets.min : level === 'avancado' ? p.sets.max : Math.round(mid(p.sets))
  const restSec = level === 'iniciante' ? p.restSec.max : round5(mid(p.restSec))
  return { sets, reps: p.reps, restSec, setsRange: p.sets, intensity: p.intensity }
}

// ───────────────────────── seleção de exercícios ─────────────────────────

interface Picker {
  /** `fresh`: ignora o histórico da semana (usado para escolher os principais). */
  pick(focus: Focus, role: ExerciseRole, needLowReps: boolean, used: Set<string>, fresh?: boolean): ExerciseMeta | undefined
  conditioning(used: Set<string>): ExerciseMeta | undefined
  weekUsed: Set<string>
  /** Principais já escolhidos para algum dia: os outros slots evitam repetir. */
  reserved: Set<string>
}

function makePicker(profile: UserProfile, equipmentOf: EquipmentLookup): Picker {
  // LPO só entra por template (exige técnica e acompanhamento); o gerador por objetivo não escolhe
  const pool = META.filter((m) => m.pattern !== 'olimpico' && isAvailable(profile, m.id, equipmentOf(m.id)))
  const beginner = profile.level === 'iniciante'
  const preferLoaded = profile.equipment !== 'peso_corporal'
  const weekUsed = new Set<string>()
  const reserved = new Set<string>()
  const isLooseBodyweight = (m: ExerciseMeta) => equipmentOf(m.id) === 'body weight' && !m.precisaBarra

  const rank = (m: ExerciseMeta, fresh: boolean) => [
    preferLoaded && isLooseBodyweight(m) ? 1 : 0,
    fresh ? 0 : reserved.has(m.id) ? 2 : weekUsed.has(m.id) ? 1 : 0,
    CURATED_ORDER.get(m.id) ?? 999,
  ]
  const best = (list: ExerciseMeta[], fresh = false) =>
    [...list].sort((a, b) => {
      const ra = rank(a, fresh)
      const rb = rank(b, fresh)
      for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i]
      return 0
    })[0]

  return {
    weekUsed,
    reserved,
    pick(focus, role, needLowReps, used, fresh = false) {
      for (const demand of focus.demands) {
        let c = pool.filter(
          (m) => demand.groups.includes(m.group) && demand.patterns.includes(m.pattern as never) && fitsRole(m, role) && !used.has(m.id),
        )
        if (!c.length) continue
        if (beginner) {
          const basic = c.filter((m) => !m.avancado)
          if (basic.length) c = basic
        }
        if (needLowReps) {
          const ok = c.filter((m) => m.adequadoBaixasReps)
          if (ok.length) c = ok
        }
        if (role === 'principal') {
          // o básico com barra de verdade antes de variações (ex.: terra antes do romeno)
          const strict = c.filter((m) => m.role === 'principal')
          if (strict.length) c = strict
        }
        return best(c, fresh)
      }
      return undefined
    },
    conditioning(used) {
      const c = pool.filter((m) => m.role === 'condicionamento' && !used.has(m.id))
      return best(c)
    },
  }
}

// ───────────────────────── montagem de um dia ─────────────────────────

function intensityFor(r: ResolvedRole, bodyweight: boolean): Pick<ExercisePrescription, 'pct1rm' | 'rpe'> {
  return {
    ...(r.intensity.pct1rm && !bodyweight ? { pct1rm: { ...r.intensity.pct1rm } } : {}),
    ...(r.intensity.rpe ? { rpe: { ...r.intensity.rpe } } : {}),
  }
}

/** Prescrição concreta; nunca dá menos de 6 reps a exercício que não aguenta. */
function prescribe(m: ExerciseMeta, role: ExerciseRole, r: ResolvedRole, bodyweight: boolean, setsOverride?: number): ExercisePrescription {
  const reps = r.reps.min < LOW_REP_LIMIT && !m.adequadoBaixasReps ? { min: LOW_REP_LIMIT, max: Math.max(8, r.reps.max) } : { ...r.reps }
  return {
    exerciseId: m.id,
    role,
    group: m.group,
    sets: setsOverride ?? r.sets,
    reps,
    restSec: r.restSec,
    ...intensityFor(r, bodyweight),
  }
}

interface DayBuild {
  key: string
  name: string
  tpl: DayTemplate
  variant: number
  groups: ExerciseGroup[]
  withFinisher: boolean
}

interface Ctx {
  profile: UserProfile
  goal: GoalProfile
  roles: Partial<Record<ExerciseRole, ResolvedRole>>
  picker: Picker
  equipmentOf: EquipmentLookup
  warnings: string[]
}

const isBodyweight = (ctx: Ctx, id: string) => ctx.equipmentOf(id) === 'body weight'
const roleFor = (ctx: Ctx, role: ExerciseRole) =>
  ctx.roles[role] ?? ctx.roles.composto ?? ctx.roles.principal ?? (ctx.roles.isolador as ResolvedRole)

/** Escolhe o principal de cada dia antes de montar os dias (evita que vire composto em outro dia). */
function choosePrincipal(ctx: Ctx, tpl: DayTemplate, variant: number, taken: Set<string>, massa?: SlotSpec['massa']): ExerciseMeta | undefined {
  let pf = tpl.principalFocus[variant % tpl.principalFocus.length]
  if (massa === 'grande') {
    // slot pede massa grande (ex.: gasto energético): pernas/costas primeiro, em rodízio entre variantes
    const big = tpl.principalFocus.filter((i) => MASS[tpl.focus[i].group] === 'grande')
    if (big.length) pf = big[variant % big.length]
  }
  for (const fi of [pf, ...tpl.principalFocus.filter((i) => i !== pf)]) {
    const m = ctx.picker.pick(tpl.focus[fi], 'principal', true, taken, true)
    if (m) return m
  }
  // sem básico com barra (halteres/peso corporal): composto estável no foco principal
  return ctx.picker.pick(tpl.focus[pf], 'composto', true, taken, true)
}

function buildDay(
  ctx: Ctx,
  tpl: DayTemplate,
  variant: number,
  slots: SlotSpec[],
  withFinisher: boolean,
  principal: ExerciseMeta | undefined,
): DayBuild {
  const used = new Set<string>()
  const groups: ExerciseGroup[] = []
  const pf = tpl.principalFocus[variant % tpl.principalFocus.length]
  const order = [pf, ...tpl.focus.map((_, i) => i).filter((i) => i !== pf)]
  let rr = 1 // rodízio começa depois do foco principal
  const strengthCount = () => groups.flatMap((g) => g.items).filter((i) => i.role !== 'condicionamento').length

  const pickRole = (role: ExerciseRole, massa: SlotSpec['massa'], avoidGroup?: MuscleGroup) => {
    const r = roleFor(ctx, role)
    const needLow = r.reps.min < LOW_REP_LIMIT
    if (role === 'principal') {
      return principal && !used.has(principal.id) ? { m: principal, role: 'principal' as const } : undefined
    }
    // rodízio pelos focos; massa grande primeiro quando pedido; evita repetir o grupo no mesmo superset;
    // em slot de composto, grupos pequenos (braços, panturrilha, abdômen) só se nada mais servir
    const seq = order.map((_, k) => order[(rr + k) % order.length])
    const prefer = (fi: number) =>
      (massa === 'grande' && MASS[tpl.focus[fi].group] !== 'grande' ? 1 : 0) +
      (avoidGroup && tpl.focus[fi].group === avoidGroup ? 2 : 0) +
      (role !== 'isolador' && MASS[tpl.focus[fi].group] === 'pequena' ? 4 : 0) +
      // composto vai primeiro para grupos com meta de volume no objetivo
      (role !== 'isolador' && !(tpl.focus[fi].group in ctx.goal.weeklySets) ? 1 : 0)
    const ranked = [...seq].sort((a, b) => prefer(a) - prefer(b) || seq.indexOf(a) - seq.indexOf(b))
    for (const fi of ranked) {
      const m = ctx.picker.pick(tpl.focus[fi], role, needLow, used)
      if (m) {
        rr = (order.indexOf(fi) + 1) % order.length
        return { m, role }
      }
    }
    return undefined
  }

  for (const slot of slots) {
    if (slot.kind === 'finisher') {
      if (!withFinisher || !ctx.goal.condicionamento) continue
      const cond = ctx.goal.condicionamento
      const items: ExercisePrescription[] = []
      const durationMin = Math.round(mid(cond.durationMin))
      const rounds = Math.max(2, Math.floor((durationMin * 60) / (slot.roles.length * (cond.workSec + cond.restSec))))
      for (let i = 0; i < slot.roles.length; i++) {
        const m = ctx.picker.conditioning(used)
        if (!m) break
        used.add(m.id)
        items.push({
          exerciseId: m.id,
          role: 'condicionamento',
          group: 'condicionamento',
          sets: rounds,
          restSec: cond.restSec,
          workSec: cond.workSec,
          ...(cond.intensity.rpe ? { rpe: { ...cond.intensity.rpe } } : {}),
        })
      }
      if (items.length) groups.push({ kind: 'finisher', items, rounds, restBetweenSec: cond.restSec, restAfterSec: 60, durationMin })
      continue
    }
    if (strengthCount() + slot.roles.length > MAX_STRENGTH_PER_DAY) continue
    const items: ExercisePrescription[] = []
    const rounds = slot.rounds ? Math.round(mid(slot.rounds)) : undefined
    const between = slot.restBetweenSec ? round5(mid(slot.restBetweenSec)) : undefined
    for (const role of slot.roles) {
      const got = pickRole(role, slot.massa, items[items.length - 1]?.group)
      if (!got) continue
      used.add(got.m.id)
      items.push(prescribe(got.m, got.role, roleFor(ctx, got.role), isBodyweight(ctx, got.m.id), rounds))
    }
    if (!items.length) continue
    if (items.length > 1 && between !== undefined) {
      // dentro do superset/circuito: descanso curto entre exercícios; o do último vale para a volta
      items.forEach((it, i) => {
        if (i < items.length - 1) it.restSec = between
      })
    }
    const kind = items.length > 1 ? slot.kind : 'simples'
    groups.push({
      kind,
      items,
      ...(kind !== 'simples' ? { rounds, restBetweenSec: between, restAfterSec: items[items.length - 1].restSec } : {}),
    })
  }

  // complemento quando o equipamento não rende 4 exercícios de força
  if (strengthCount() < MIN_STRENGTH_PER_DAY) {
    const before = strengthCount()
    const extra: Focus[] = [...tpl.focus, { group: 'abdomen', demands: [{ groups: ['abdomen'], patterns: ['abdominal'] }] }, { group: 'gluteos', demands: [{ groups: ['gluteos'], patterns: ['gluteo'] }] }]
    for (const role of ['isolador', 'composto'] as const) {
      for (const f of extra) {
        if (strengthCount() >= MIN_STRENGTH_PER_DAY) break
        const r = roleFor(ctx, role)
        const m = ctx.picker.pick(f, role, r.reps.min < LOW_REP_LIMIT, used)
        if (!m) continue
        used.add(m.id)
        insertBeforeFinisher(groups, { kind: 'simples', items: [prescribe(m, role, r, isBodyweight(ctx, m.id))] })
      }
    }
    ctx.warnings.push(
      `${tpl.name}: com esse equipamento só há ${before} exercício(s) para os grupos do dia; completei com core/pernas.` +
        (hasPullupBar(ctx.profile) ? '' : ' Uma barra fixa de porta amplia muito as opções de costas.'),
    )
  }

  used.forEach((id) => ctx.picker.weekUsed.add(id))
  return { key: `${tpl.letter}${variant + 1}`, name: `${tpl.name}${variant > 0 || tpl.letter === 'F' ? ` ${variant + 1}` : ''}`, tpl, variant, groups, withFinisher }
}

function insertBeforeFinisher(groups: ExerciseGroup[], g: ExerciseGroup) {
  const f = groups.findIndex((x) => x.kind === 'finisher')
  if (f === -1) groups.push(g)
  else groups.splice(f, 0, g)
}

/** Composto novo entra antes do primeiro grupo com isolador; isolador, antes do finisher. */
function insertInOrder(groups: ExerciseGroup[], g: ExerciseGroup) {
  if (g.items[0].role === 'isolador') return insertBeforeFinisher(groups, g)
  const i = groups.findIndex((x) => x.kind === 'finisher' || x.items.some((it) => it.role === 'isolador'))
  if (i === -1) groups.push(g)
  else groups.splice(i, 0, g)
}

// ───────────────────────── volume semanal ─────────────────────────

/** Séries/semana por grupo. `weight` = quantas vezes o dia aparece por semana. */
export function volumeOf(days: { groups: ExerciseGroup[]; weight: number }[]): Partial<Record<MuscleGroup, number>> {
  const v: Partial<Record<MuscleGroup, number>> = {}
  for (const d of days)
    for (const g of d.groups)
      for (const it of g.items) {
        if (it.role === 'condicionamento') continue
        v[it.group] = (v[it.group] ?? 0) + it.sets * d.weight
      }
  for (const k of Object.keys(v) as MuscleGroup[]) v[k] = Math.round(v[k]! * 10) / 10
  return v
}

export function compoundShareOf(days: { groups: ExerciseGroup[]; weight: number }[], base: GoalProfile['compoundShare']['base']) {
  let total = 0
  let comp = 0
  const big = new Set<MuscleGroup>(['quadriceps', 'posteriores', 'gluteos', 'costas'])
  for (const d of days)
    for (const g of d.groups)
      for (const it of g.items) {
        if (it.role === 'condicionamento') continue
        total += it.sets * d.weight
        const isComp = it.role === 'principal' || it.role === 'composto'
        if (isComp && (base === 'compostos' || big.has(it.group))) comp += it.sets * d.weight
      }
  return total ? Math.round((comp / total) * 100) : 0
}

function adjustVolume(ctx: Ctx, days: DayBuild[], weightOf: (d: DayBuild) => number) {
  const targets = ctx.goal.weeklySets
  const view = () => days.map((d) => ({ groups: d.groups, weight: weightOf(d) }))
  const roleMax = (role: ExerciseRole) => (role === 'condicionamento' ? 0 : (ctx.roles[role]?.setsRange.max ?? roleFor(ctx, role).setsRange.max))
  const roleMin = (role: ExerciseRole) => (role === 'condicionamento' ? 0 : (ctx.roles[role]?.setsRange.min ?? roleFor(ctx, role).setsRange.min))
  const strength = (d: DayBuild) => d.groups.flatMap((g) => g.items).filter((i) => i.role !== 'condicionamento')

  for (let iter = 0; iter < 60; iter++) {
    const vol = volumeOf(view())
    const share = compoundShareOf(view(), ctx.goal.compoundShare.base)
    let changed = false
    const under = (Object.keys(targets) as MuscleGroup[])
      .filter((g) => (vol[g] ?? 0) < targets[g]!.min)
      .sort((a, b) => (vol[a] ?? 0) - targets[a]!.min - ((vol[b] ?? 0) - targets[b]!.min))
    for (const g of under) {
      // 1) +1 série num item simples do grupo (prefere composto)
      const items = days
        .flatMap((d) => d.groups.filter((x) => x.kind === 'simples').flatMap((x) => x.items))
        .filter((i) => i.group === g && i.sets < roleMax(i.role))
        .sort((a, b) => Number(b.role !== 'isolador') - Number(a.role !== 'isolador') || a.sets - b.sets)
      if (items[0]) {
        items[0].sets++
        changed = true
        break
      }
      // 2) novo exercício do grupo no dia com menos exercícios que treina esse grupo
      const role: ExerciseRole = share < ctx.goal.compoundShare.range.max && ctx.roles.composto ? 'composto' : 'isolador'
      const cands = days
        .filter((d) => d.tpl.focus.some((f) => f.group === g) && strength(d).length < MAX_STRENGTH_PER_DAY)
        .sort((a, b) => strength(a).length - strength(b).length)
      for (const d of cands) {
        const used = new Set(strength(d).map((i) => i.exerciseId))
        const focus = d.tpl.focus.find((f) => f.group === g)!
        const r = roleFor(ctx, role)
        const m = ctx.picker.pick(focus, role, r.reps.min < LOW_REP_LIMIT, used) ?? ctx.picker.pick(focus, role === 'composto' ? 'isolador' : 'composto', false, used)
        if (!m) continue
        const finalRole = fitsRole(m, role) ? role : m.role === 'isolador' ? 'isolador' : 'composto'
        insertInOrder(d.groups, { kind: 'simples', items: [prescribe(m, finalRole, roleFor(ctx, finalRole), isBodyweight(ctx, m.id))] })
        ctx.picker.weekUsed.add(m.id)
        changed = true
        break
      }
      if (changed) break
      // 3) dia cheio: troca um isolador de grupo sem meta (braços, panturrilha, abdômen) por um exercício do grupo em falta
      for (const d of days.filter((x) => x.tpl.focus.some((f) => f.group === g))) {
        const gi = d.groups.findIndex(
          (x) => x.kind === 'simples' && x.items[0].role === 'isolador' && !(x.items[0].group in targets),
        )
        if (gi < 0) continue
        const used = new Set(strength(d).map((i) => i.exerciseId))
        const focus = d.tpl.focus.find((f) => f.group === g)!
        const m = ctx.picker.pick(focus, role, roleFor(ctx, role).reps.min < LOW_REP_LIMIT, used) ?? ctx.picker.pick(focus, 'isolador', false, used)
        if (!m) continue
        const finalRole = fitsRole(m, role) ? role : m.role === 'isolador' ? 'isolador' : 'composto'
        d.groups.splice(gi, 1)
        insertInOrder(d.groups, { kind: 'simples', items: [prescribe(m, finalRole, roleFor(ctx, finalRole), isBodyweight(ctx, m.id))] })
        ctx.picker.weekUsed.add(m.id)
        changed = true
        break
      }
      if (changed) break
    }
    if (changed) continue

    const over = (Object.keys(targets) as MuscleGroup[]).filter((g) => (vol[g] ?? 0) > targets[g]!.max)
    for (const g of over) {
      const items = days
        .flatMap((d) => d.groups.filter((x) => x.kind === 'simples').flatMap((x) => x.items))
        .filter((i) => i.group === g && i.sets > roleMin(i.role))
        .sort((a, b) => Number(a.role !== 'isolador') - Number(b.role !== 'isolador') || b.sets - a.sets)
      if (items[0]) {
        items[0].sets--
        changed = true
        break
      }
      // remove um isolador simples do grupo, se o dia continuar com o mínimo
      for (const d of days) {
        const gi = d.groups.findIndex((x) => x.kind === 'simples' && x.items[0].group === g && x.items[0].role === 'isolador')
        if (gi >= 0 && strength(d).length > MIN_STRENGTH_PER_DAY) {
          d.groups.splice(gi, 1)
          changed = true
          break
        }
      }
      if (changed) break
    }
    if (!changed) break
  }
}

// ───────────────────────── semanas e periodização ─────────────────────────

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x))

function deloadDay(day: Day, goal: GoalProfile): Day {
  const dl = goal.periodization.deload
  return {
    ...day,
    groups: day.groups
      .filter((g) => g.kind !== 'finisher')
      .map((g) => ({
        ...g,
        rounds: g.rounds ? Math.max(1, Math.round(g.rounds * dl.fatorSeries)) : undefined,
        items: g.items.map((it) => ({
          ...it,
          sets: Math.max(1, Math.round(it.sets * dl.fatorSeries)),
          ...(it.pct1rm ? { pct1rm: { min: Math.round(it.pct1rm.min * dl.fatorCarga), max: Math.round(it.pct1rm.max * dl.fatorCarga) } } : {}),
          ...(it.rpe ? { rpe: { min: Math.min(it.rpe.min, dl.rpeMax - 1), max: dl.rpeMax } } : {}),
        })),
      })),
  }
}

/** Rampa do bloco: posição relativa na faixa-base do principal aplicada à faixa do nível. */
function rampDay(day: Day, goal: GoalProfile, level: Level, weekIdx: number): Day {
  if (goal.periodization.kind !== 'bloco') return day
  const base = goal.roles.principal?.intensity.pct1rm
  const eff = resolveRole(goal, 'principal', level)?.intensity.pct1rm
  const ramp = goal.periodization.rampaPct1rm
  if (!base || !eff || !ramp.length) return day
  const pos = (ramp[Math.min(weekIdx, ramp.length - 1)] - base.min) / Math.max(1, base.max - base.min)
  const target = Math.round((eff.min + pos * (eff.max - eff.min)) * 2) / 2
  return {
    ...day,
    groups: day.groups.map((g) => ({
      ...g,
      items: g.items.map((it) => (it.role === 'principal' && it.pct1rm ? { ...it, pct1rm: { min: target, max: target } } : it)),
    })),
  }
}

// ───────────────────────── ponto de entrada ─────────────────────────

function matchesWhen(p: UserProfile, w: { daysPerWeek?: Range; level?: Level[]; equipment?: UserProfile['equipment'][]; split?: Split[] }) {
  return (
    (!w.daysPerWeek || (p.daysPerWeek >= w.daysPerWeek.min && p.daysPerWeek <= w.daysPerWeek.max)) &&
    (!w.level || w.level.includes(p.level)) &&
    (!w.equipment || w.equipment.includes(p.equipment)) &&
    (!w.split || w.split.includes(p.split))
  )
}

/** Perfil com a divisão que o objetivo impõe (ex.: gasto energético 2–3x → full body). */
export function effectiveProfile(input: UserProfile): UserProfile {
  const rule = GOALS[input.goal]?.dayStructureRules?.find((r) => matchesWhen(input, r.when))
  return { ...input, split: rule?.split ?? input.split }
}

/** Gera o programa: determinístico para o mesmo perfil e catálogo. */
export function generateProgram(input: UserProfile, equipmentOf: EquipmentLookup, now = Date.now()): Program {
  const goal = GOALS[input.goal]
  if (!goal) throw new Error(`Objetivo desconhecido: ${String(input.goal)}`)
  const warnings: string[] = []
  const rule = goal.dayStructureRules?.find((r) => matchesWhen(input, r.when))
  const split = rule?.split ?? input.split
  if (split !== input.split) {
    warnings.push(`Para ${goal.nome.toLowerCase()} com ${input.daysPerWeek} dias por semana, o app usa full body em circuito em vez da divisão escolhida.`)
  }
  const profile: UserProfile = { ...input, split }
  const slots = rule?.slots ?? goal.dayStructure
  const roles: Ctx['roles'] = {}
  for (const r of ['principal', 'composto', 'isolador'] as const) {
    const res = resolveRole(goal, r, profile.level)
    if (res) roles[r] = res
  }
  const ctx: Ctx = { profile, goal, roles, picker: makePicker(profile, equipmentOf), equipmentOf, warnings }
  for (const w of goal.warnings) if (matchesWhen(profile, w.when)) warnings.push(w.text)

  // sequência de dias: letras em ordem; variantes quando a letra repete na semana
  const tpls = SPLIT_TEMPLATES[split]
  const L = tpls.length
  const days = profile.daysPerWeek
  const rotation = days < L // ex.: ABCD 2x → a semana anda pela sequência
  const seq = rotation
    ? tpls.map((t) => ({ tpl: t, variant: 0 }))
    : Array.from({ length: days }, (_, j) => ({ tpl: tpls[j % L], variant: Math.floor(j / L) }))

  const finisherSlot = slots.find((s) => s.kind === 'finisher')
  const finisherCount = finisherSlot ? (days >= 4 ? (finisherSlot.perWeek?.max ?? 1) : (finisherSlot.perWeek?.min ?? 1)) : 0
  const step = finisherCount ? Math.max(1, Math.floor(seq.length / finisherCount)) : 0
  const principalSlot = slots.find((s) => s.roles.includes('principal'))
  const principals = seq.map((s) => {
    if (!principalSlot) return undefined
    const m = choosePrincipal(ctx, s.tpl, s.variant, ctx.picker.reserved, principalSlot.massa)
    if (m) ctx.picker.reserved.add(m.id)
    return m
  })
  const built = seq.map((s, j) =>
    buildDay(
      ctx,
      s.tpl,
      s.variant,
      slots,
      finisherCount > 0 && (j + 1) % step === 0 && Math.floor((j + 1) / step) <= finisherCount,
      principals[j],
    ),
  )

  const weightOf = () => (rotation ? days / L : 1)
  adjustVolume(ctx, built, weightOf)

  const view = built.map((d) => ({ groups: d.groups, weight: weightOf() }))
  const weeklyVolume = volumeOf(view)
  for (const [g, r] of Object.entries(goal.weeklySets) as [MuscleGroup, Range][]) {
    const v = weeklyVolume[g] ?? 0
    if (v < r.min || v > r.max) warnings.push(`Volume de ${g}: ${v} séries/semana, fora da faixa do objetivo (${r.min}–${r.max}) com esta divisão e frequência.`)
  }

  const baseDays: Day[] = built.map((d) => ({ key: d.key, name: d.name, groups: d.groups }))
  const per = goal.periodization
  const nWeeks = per.kind === 'bloco' ? per.semanasCarga + per.semanasDeload : per.deloadPlanejadoACadaSemanas
  const loadWeeks = per.kind === 'bloco' ? per.semanasCarga : per.deloadPlanejadoACadaSemanas - 1
  const weeks: Week[] = Array.from({ length: nWeeks }, (_, w) => {
    const kind = w < loadWeeks ? ('carga' as const) : ('deload' as const)
    const dayList = rotation
      ? Array.from({ length: days }, (_, j) => baseDays[(w * days + j) % L])
      : baseDays
    return {
      index: w + 1,
      kind,
      days: dayList.map((dd) => (kind === 'deload' ? deloadDay(clone(dd), goal) : rampDay(clone(dd), goal, profile.level, w))),
      ...(per.kind === 'bloco' && kind === 'carga' ? { intensityTarget: per.rampaPct1rm[Math.min(w, per.rampaPct1rm.length - 1)] / 100 } : {}),
    }
  })

  const program: Program = {
    createdAt: now,
    source: 'local',
    profile,
    goal: clone(goal),
    blocks: [{ index: 1, weeks }],
    repeat: true,
    weeklyVolume,
    explanation: '',
    warnings,
  }
  program.explanation = explain(program, (id) => META.find((m) => m.id === id)?.pt ?? id)
  return program
}

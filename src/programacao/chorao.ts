import { type MuscleGroup } from '../data/curated'
import { LPO_BY_ID } from '../data/lpo'
import { guessGroup, matchExercise } from '../data/match'
import { volumeOf } from './generator'
import { GOALS } from './goals'
import { META_BY_ID } from './meta'
import type { Day, ExercisePrescription, ExerciseRole, GoalProfile, Program, Range, Week } from './types'

/**
 * Plano do CHORÃO PERFORMANCE V9.7 (INITIAL_WORKOUTS) como template de programa "LPO + Musculação"
 * e a conversão de dias no formato do Chorão (usada também na importação de backups dele).
 */

export const CHORAO_DAY_KEYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX'] as const
export type ChoraoDayKey = (typeof CHORAO_DAY_KEYS)[number]

export const TEMPLATE_NAME = 'LPO + Musculação'

/** Um exercício do Chorão no essencial: nome-base, principal?, séries/reps/kg da S1. */
export interface ChoraoPlanExercise {
  baseName: string
  isMain: boolean
  set: number | null
  rep: number | null
  kg: number | null
}

export interface ChoraoPlanDay {
  key: ChoraoDayKey
  name: string
  notes: string
  exercises: ChoraoPlanExercise[]
}

const ex = (baseName: string, isMain: boolean, set: number | null, rep: number | null, kg: number | null): ChoraoPlanExercise => ({
  baseName,
  isMain,
  set,
  rep,
  kg,
})

/** INITIAL_WORKOUTS do Chorão V9.7 (só a S1 vinha preenchida). */
export const CHORAO_PLAN: ChoraoPlanDay[] = [
  {
    key: 'SEG',
    name: 'Segunda-feira — Snatch Suspenso & Inferiores',
    notes: 'LPO + perna. Séries de LPO: 5 a 7 (4–5 quando a carga está alta). Acessórios 3x8.',
    exercises: [
      ex('Snatch Suspenso', true, 5, null, 40),
      ex('Tripla Extensão', false, 5, null, 100),
      ex('Stiff', false, 3, 8, 80),
      ex('Agachamento Frontal', true, 3, 8, 80),
      ex('Búlgaro', false, 3, 8, 12),
      ex('Gêmeos na Máquina', false, 3, 8, 50),
    ],
  },
  {
    key: 'TER',
    name: 'Terça-feira — Clean & Superior Completo',
    notes: 'Clean do chão, auxiliar do snatch e superior completo.',
    exercises: [
      ex('Clean do Chão', true, 5, null, 72.5),
      ex('Auxiliar do Snatch', false, 5, null, null),
      ex('Barra Fixa Supinada', false, 3, 8, 90),
      ex('Supino Reto', true, 3, 8, 80),
      ex('Remada Curvada', false, 3, 8, 82.5),
      ex('Supino Inclinado com Halteres', false, 3, 8, 30),
      ex('Desenvolvimento com Barra', false, 3, 8, 60),
    ],
  },
  {
    key: 'QUA',
    name: 'Quarta-feira — Livre',
    notes: 'Dia sem treino próprio (descanso).',
    exercises: [],
  },
  {
    key: 'QUI',
    name: 'Quinta-feira — Snatch do Chão, Jerk & Perna',
    notes: 'Snatch do chão, jerk e perna completa.',
    exercises: [
      ex('Snatch do Chão', true, 5, null, 60),
      ex('Jerk', true, 5, null, 85),
      ex('Levantamento Terra', true, 3, 8, 140),
      ex('Agachamento Costas', true, 3, 8, 100),
      ex('Mesa Flexora', false, 3, 8, 70),
      ex('Gêmeos', false, 3, 8, null),
    ],
  },
  {
    key: 'SEX',
    name: 'Sexta-feira — Clean & Superior Completo',
    notes: 'Mesmo superior de terça, mais bíceps e tríceps.',
    exercises: [
      ex('Clean do Chão', true, 5, null, null),
      ex('Auxiliar do Snatch', false, 5, null, null),
      ex('Barra Fixa Supinada', false, 3, 8, 90),
      ex('Supino Reto', true, 3, 8, null),
      ex('Remada Curvada', false, 3, 8, null),
      ex('Supino Inclinado com Halteres', false, 3, 8, null),
      ex('Desenvolvimento com Barra', false, 3, 8, null),
      ex('Rosca Direta', false, 3, 8, 15),
      ex('Tríceps na Corda', false, 3, 8, 55),
    ],
  },
]

/** Exercício resolvido no catálogo (ou criado no app quando o nome não casa). */
export interface Resolved {
  id: string
  group: MuscleGroup
  /** Papel do catálogo quando o exercício não é marcado como principal. */
  role: Exclude<ExerciseRole, 'principal' | 'condicionamento'>
  olimpico: boolean
  /** true = não existe no catálogo; quem chama cria a entrada própria. */
  created: boolean
}

/** Casa o nome do Chorão com o catálogo; sem casamento, devolve um exercício próprio a criar. */
export function resolveChoraoName(name: string, createdId: (name: string) => string): Resolved {
  const m = matchExercise(name)
  if (m) {
    const meta = META_BY_ID.get(m.id)
    return {
      id: m.id,
      group: meta?.group ?? guessGroup(name),
      role: meta?.role === 'isolador' ? 'isolador' : 'composto',
      olimpico: LPO_BY_ID.has(m.id),
      created: false,
    }
  }
  return { id: createdId(name), group: guessGroup(name), role: 'composto', olimpico: false, created: true }
}

const R = (min: number, max = min): Range => ({ min, max })

/** LPO sem reps no Chorão → 1–3 (faixa usual dos olímpicos); musculação sem reps → 6–10. */
function prescription(e: ChoraoPlanExercise, r: Resolved): ExercisePrescription {
  const role: ExerciseRole = e.isMain ? 'principal' : r.role
  const reps = e.rep ? R(e.rep) : r.olimpico ? R(1, 3) : R(6, 10)
  return {
    exerciseId: r.id,
    role,
    group: r.group,
    sets: e.set ?? 3,
    reps,
    restSec: r.olimpico ? 120 : role === 'isolador' ? 60 : 90,
    rpe: role === 'isolador' ? R(8, 9) : R(7, 9),
    ...(e.kg ? { startKg: e.kg } : {}),
  }
}

/**
 * Objetivo do template: força + hipertrofia, sem deload (4 semanas de carga, como o Chorão) e
 * passo de carga de 2,5 kg no principal (os olímpicos não sobem de 5 em 5).
 */
export function templateGoal(): GoalProfile {
  const base: GoalProfile = JSON.parse(JSON.stringify(GOALS.powerbuilding))
  return {
    ...base,
    progression: {
      ...base.progression,
      principal: { rule: 'carga_por_rpe', increment: { superiorKg: 2.5, inferiorKg: 2.5 }, subirSeRpeAte: 7, manterSeRpeAte: 9, reducaoPct: 5 },
    },
    periodization: { kind: 'bloco', semanasCarga: 4, semanasDeload: 0, rampaPct1rm: [], deload: base.periodization.deload },
  }
}

export const shortDayName = (name: string) => name.split('—').map((s) => s.trim())

/**
 * Programa a partir dos dias do Chorão. Dias sem exercício (a quarta livre) ficam fora da rotação.
 * `resolve` decide o id de cada nome (com cache, para o mesmo nome virar o mesmo exercício).
 */
export function programFromChoraoDays(
  days: ChoraoPlanDay[],
  resolve: (name: string) => Resolved,
  opts: { weeks?: number; now?: number } = {},
): Program {
  const baseDays: Day[] = days
    .filter((d) => d.exercises.length > 0)
    .map((d) => {
      const [weekday, title] = shortDayName(d.name)
      return {
        key: d.key,
        name: title ? `${weekday.replace('-feira', '')} — ${title}` : weekday,
        ...(d.notes ? { notes: d.notes } : {}),
        groups: d.exercises.map((e) => ({ kind: 'simples' as const, items: [prescription(e, resolve(e.baseName))] })),
      }
    })
  const n = opts.weeks ?? 4
  const weeks: Week[] = Array.from({ length: n }, (_, i) => ({ index: i + 1, kind: 'carga', days: JSON.parse(JSON.stringify(baseDays)) }))
  const goal = templateGoal()
  return {
    createdAt: opts.now ?? Date.now(),
    source: 'template',
    templateName: TEMPLATE_NAME,
    currentCycle: 1,
    profile: { goal: 'powerbuilding', daysPerWeek: baseDays.length, split: 'ABCD', equipment: 'academia', level: 'avancado' },
    goal,
    blocks: [{ index: 1, weeks }],
    repeat: true,
    weeklyVolume: volumeOf(baseDays.map((d) => ({ groups: d.groups, weight: 1 }))),
    explanation:
      'Plano do Chorão: levantamentos olímpicos (snatch, clean e jerk) no início de cada treino, seguidos de musculação. ' +
      'Ciclos de 4 semanas sem deload; registre carga e RPE na grade do ciclo ou no treino. ' +
      'Nos principais, a carga sobe 2,5 kg quando todas as repetições saem com RPE até 7, mantém entre 8 e 9 e cai 5% acima disso; ' +
      'nos acessórios, progressão dupla (topo da faixa de reps, depois mais carga). ' +
      'As cargas iniciais vêm do plano original; ajuste na primeira semana.',
    warnings: ['Os levantamentos olímpicos exigem técnica: com dor ou execução ruim, reduza a carga antes de seguir a progressão.'],
  }
}

/** Template pronto: o plano inicial do Chorão casado com o catálogo. */
export function choraoTemplate(now = Date.now()): { program: Program; unmatched: string[] } {
  const unmatched: string[] = []
  const program = programFromChoraoDays(
    CHORAO_PLAN,
    (name) => {
      const r = resolveChoraoName(name, (n) => n)
      if (r.created) unmatched.push(name)
      return r
    },
    { now },
  )
  return { program, unmatched }
}

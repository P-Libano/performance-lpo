/**
 * Modelo de programação de treino v2 (etapa A: só tipos, sem lógica).
 * Visão geral e decisões em docs/programacao.md.
 *
 *   GoalProfile (configuração por objetivo)  ──┐
 *   Catálogo com metadados (ExerciseMeta)    ──┼─► gerador ─► Program → Block → Week → Day → ExerciseGroup → ExercisePrescription
 *   Perfil do usuário (UserProfile)          ──┘
 *   Sessão (com RPE por série e tempo) + GoalProfile ─► estratégia de progressão ─► próxima prescrição
 */
import type { MovementPattern, MuscleGroup } from '../data/curated'

// ───────────────────────── básicos ─────────────────────────

export interface Range {
  min: number
  max: number
}

export const GOAL_IDS = ['forca', 'hipertrofia', 'gasto_energetico', 'resistencia', 'powerbuilding'] as const
export type GoalId = (typeof GOAL_IDS)[number]

export type Level = 'iniciante' | 'intermediario' | 'avancado'
export type EquipmentAccess = 'academia' | 'halteres' | 'peso_corporal'
export type Split = 'AB' | 'ABC' | 'ABCD' | 'upper_lower' | 'full_body'

/** Perfil do usuário (substitui o Profile atual; `goal` passa a aceitar os 5 objetivos). */
export interface UserProfile {
  goal: GoalId
  daysPerWeek: number // 2–6
  split: Split
  equipment: EquipmentAccess
  level: Level
  pullupBar?: boolean
}

// ───────────────────────── catálogo ─────────────────────────

/**
 * Papel que o exercício PODE ocupar. Um `principal` também pode ocupar slot de
 * `composto`; o contrário não. `condicionamento` só ocupa slots de condicionamento.
 */
export type ExerciseRole = 'principal' | 'composto' | 'isolador' | 'condicionamento'

export type MuscleMass = 'grande' | 'media' | 'pequena'

/** Metadados do catálogo curado que o gerador precisa (estende o CuratedExercise atual). */
export interface ExerciseMeta {
  id: string
  pt: string
  group: MuscleGroup
  pattern: MovementPattern | 'condicionamento'
  role: ExerciseRole
  unilateral: boolean
  massaMuscular: MuscleMass
  /** false para unilaterais, a maioria dos isoladores e exercícios instáveis: nunca recebem faixa < 6 reps. */
  adequadoBaixasReps: boolean
  /** Exige técnica: só para intermediário+ quando houver alternativa (substitui ADVANCED_IDS). */
  avancado?: boolean
  /** Peso corporal que precisa de barra fixa/paralelas (substitui NEEDS_BAR_IDS). */
  precisaBarra?: boolean
}

// ───────────────────────── GoalProfile ─────────────────────────

/** Intensidade alvo; pelo menos um dos dois deve existir para papéis com carga. */
export interface Intensity {
  /** % de 1RM (0–100). Omitido em peso corporal e condicionamento. */
  pct1rm?: Range
  /** RPE 1–10 (10 = falha). */
  rpe?: Range
}

/** Prescrição-base de um papel dentro do objetivo. */
export interface RolePrescription {
  sets: Range
  reps: Range
  restSec: Range
  intensity: Intensity
}

/** Para `condicionamento`: trabalho por tempo em vez de reps. */
export interface ConditioningPrescription {
  durationMin: Range // duração total do bloco
  workSec: number // ex.: 40
  restSec: number // ex.: 20 (dentro do bloco)
  intensity: Intensity // normalmente só RPE
}

export type SlotKind = 'simples' | 'superset' | 'circuito' | 'finisher'

/** Um slot da estrutura do dia. O gerador preenche cada `roles[i]` com um exercício. */
export interface SlotSpec {
  kind: SlotKind
  /** simples: 1 papel; superset: 2; circuito: 3–5; finisher: 2–4 (todos `condicionamento` ou mistos). */
  roles: ExerciseRole[]
  /** Preferência de massa muscular ao escolher o exercício. */
  massa?: MuscleMass | 'qualquer'
  /** Voltas (superset/circuito). */
  rounds?: Range
  /** Descanso entre exercícios dentro do grupo (superset/circuito). */
  restBetweenSec?: Range
  /** Quantas vezes por semana este slot aparece (ex.: finisher 1–2x). Omitido = todo dia. */
  perWeek?: Range
  /** Primeiro a sair quando o volume semanal passa do teto. */
  optional?: boolean
}

/** Estrutura do dia; pode variar por nº de dias (ex.: gasto 2x → full body em circuito). */
export interface DayStructureRule {
  when: { daysPerWeek?: Range; level?: Level[]; equipment?: EquipmentAccess[] }
  /** Força a divisão (o onboarding mostra como recomendada). */
  split?: Split
  slots: SlotSpec[]
}

export type ProgressionRule = 'carga_por_rpe' | 'dupla_progressao' | 'densidade' | 'reps_depois_carga'

export interface LoadIncrement {
  /** kg por passo em exercícios de membros superiores / inferiores. */
  superiorKg: number
  inferiorKg: number
}

export type ProgressionSpec =
  | {
      rule: 'carga_por_rpe'
      increment: LoadIncrement
      /** Sobe a carga se o RPE da última série ≤ este valor e todas as reps foram feitas. */
      subirSeRpeAte: number
      /** Mantém entre subirSeRpeAte e este valor. Acima: reduz `reducaoPct`. */
      manterSeRpeAte: number
      reducaoPct: number
    }
  | {
      rule: 'dupla_progressao'
      increment: LoadIncrement
      /** Sessões seguidas sem progresso até o deload reativo. */
      falhasParaDeload: number
      deloadPct: number
    }
  | {
      rule: 'densidade'
      /** 1º: reduz o descanso nesse passo até o piso; 2º: +1 série até o teto; 3º: sobe carga e volta o descanso. */
      reduzirDescansoSec: number
      descansoPisoSec: number
      seriesExtrasMax: number
      increment: LoadIncrement
    }
  | {
      rule: 'reps_depois_carga'
      /** Sobe reps até o topo da faixa; aí sobe carga e volta ao piso. */
      repsPorPasso: number
      increment: LoadIncrement
    }

/** Periodização planejada. */
export type Periodization =
  | {
      kind: 'bloco'
      semanasCarga: number // ex.: 3
      semanasDeload: number // ex.: 1
      /** Intensidade (%1RM) alvo do principal em cada semana de carga, em ordem. */
      rampaPct1rm: number[]
      deload: DeloadSpec
    }
  | {
      kind: 'reativo'
      /** Deload planejado mesmo sem estagnação. */
      deloadPlanejadoACadaSemanas: number
      deload: DeloadSpec
    }

export interface DeloadSpec {
  /** Multiplica o nº de séries (ex.: 0,6). */
  fatorSeries: number
  /** Multiplica a carga/%1RM (ex.: 0,9). */
  fatorCarga: number
  /** RPE máximo na semana de deload. */
  rpeMax: number
}

export interface ConditionalWarning {
  id: string
  when: { equipment?: EquipmentAccess[]; level?: Level[]; daysPerWeek?: Range; split?: Split[] }
  severity: 'info' | 'aviso'
  text: string
}

/** Ajustes por nível sobre a prescrição-base (ex.: iniciante + força → 5x5 ~75%). */
export type LevelOverrides = Partial<Record<Level, Partial<Record<ExerciseRole, Partial<RolePrescription>>>>>

/**
 * Configuração completa de um objetivo. O gerador é o mesmo para todos;
 * o que muda é este objeto.
 */
export interface GoalProfile {
  id: GoalId
  nome: string
  /** Uma frase sobre o que o objetivo realmente é (aparece no onboarding). */
  resumo: string

  /** Prescrição por papel. Papéis ausentes não são usados por este objetivo. */
  roles: Partial<Record<Exclude<ExerciseRole, 'condicionamento'>, RolePrescription>>
  condicionamento?: ConditioningPrescription
  levelOverrides?: LevelOverrides

  /** % do volume semanal (séries) em compostos. */
  compoundShare: { range: Range; base: 'compostos' | 'compostos_grande_massa' }
  /** Séries semanais alvo por grupo muscular grande. */
  weeklySets: Partial<Record<MuscleGroup, Range>>

  /** Estrutura padrão do dia + regras que a substituem em certos perfis. */
  dayStructure: SlotSpec[]
  dayStructureRules?: DayStructureRule[]

  /** Progressão por papel (powerbuilding: principal por RPE, resto por dupla progressão). */
  progression: Partial<Record<ExerciseRole, ProgressionSpec>>
  periodization: Periodization

  warnings: ConditionalWarning[]

  /**
   * Texto "por que este treino". Placeholders preenchidos pelo gerador:
   * {principais} {repsPrincipal} {seriesPrincipal} {descansoPrincipal} {intensidadePrincipal}
   * {repsAcessorio} {descansoAcessorio} {progressao} {periodizacao} {finisherPorSemana} {dias} {split}
   * O gerador anexa `expectativa4a8Semanas` ao final.
   * Precisa citar: faixa de reps, descanso, progressão e o que esperar em 4–8 semanas.
   * Passa pela mesma varredura de promessas sem base do app.
   */
  explanation: { template: string; expectativa4a8Semanas: string }
}

// ───────────────────────── Programa (rotina com tempo) ─────────────────────────

export interface ExercisePrescription {
  exerciseId: string
  role: ExerciseRole
  group: MuscleGroup
  sets: number
  /** Ausente em condicionamento (trabalho por tempo: `workSec`). */
  reps?: Range
  restSec: number
  pct1rm?: Range
  rpe?: Range
  /** Condicionamento: tempo de trabalho/descanso por estação. */
  workSec?: number
  /** Carga inicial do plano (templates): vale enquanto não houver histórico do exercício. */
  startKg?: number
}

export interface ExerciseGroup {
  kind: SlotKind
  items: ExercisePrescription[]
  /** superset/circuito: voltas; finisher: calculado de durationMin. */
  rounds?: number
  restBetweenSec?: number
  /** Descanso depois de completar a volta/grupo. */
  restAfterSec?: number
  durationMin?: number
}

export interface Day {
  /** Chave única no programa, ex.: "S1", "I1", "S2", "I2" (dias de mesma letra podem variar). */
  key: string
  name: string
  groups: ExerciseGroup[]
  /** Orientação fixa do dia (ex.: "Séries de LPO: 5 a 7"); templates. */
  notes?: string
}

export interface Week {
  /** 1-based dentro do programa. */
  index: number
  kind: 'carga' | 'deload'
  days: Day[]
  /** Fator de intensidade da semana (rampa do bloco), ex.: 0,80 / 0,825 / 0,85. */
  intensityTarget?: number
}

export interface Block {
  index: number
  weeks: Week[]
}

export interface Program {
  id?: number
  createdAt: number
  source: 'local' | 'ia' | 'template'
  /** Nome do template (ex.: "LPO + Musculação"), quando `source` = template. */
  templateName?: string
  /** Ciclo em andamento (1-based). "Novo ciclo" incrementa; as semanas voltam à 1. Ausente = 1. */
  currentCycle?: number
  profile: UserProfile
  /** Snapshot do GoalProfile usado (programas antigos continuam coerentes se a config mudar). */
  goal: GoalProfile
  blocks: Block[]
  /** Ao chegar ao fim do último bloco, gera o próximo a partir do histórico. */
  repeat: boolean
  /** Séries/semana por grupo na semana de carga típica (calculado pelo gerador). */
  weeklyVolume: Partial<Record<MuscleGroup, number>>
  explanation: string
  warnings: string[]
  notes?: string // IA
}

// ───────────────────────── Sessão e progressão ─────────────────────────

export interface SetLog {
  weight: number | null
  reps: number | null
  /** RPE informado pelo usuário (opcional; 6–10 em passos de 0,5). */
  rpe: number | null
  done: boolean
  /** Momento em que a série foi marcada (permite medir descanso real e densidade). */
  completedAt?: number
}

export interface SessionExerciseV2 {
  exerciseId: string
  role: ExerciseRole
  group: MuscleGroup
  /** Índice do ExerciseGroup no dia e tipo dele (superset etc.). */
  groupIndex: number
  groupKind: SlotKind
  prescription: ExercisePrescription
  suggestion: SuggestionV2
  previous?: ExerciseResultV2
  recent?: ExerciseResultV2[]
  log: SetLog[]
  /** Variação executada nesta sessão (ex.: "Snatch bloco", "Búlgaro com halteres"). */
  variant?: string
}

/** Check-in de prontidão (1–5). Sono e energia: 5 = melhor; fadiga: 5 = pior. */
export interface Readiness {
  sleep: number
  energy: number
  soreness: number
}

export interface SessionV2 {
  id?: number
  programId: number
  weekIndex: number
  weekKind: 'carga' | 'deload'
  dayKey: string
  dayName: string
  startedAt: number
  finishedAt?: number
  /** Tempo total (finishedAt − startedAt, descontando pausas longas > 15 min). */
  durationSec?: number
  status: 'active' | 'done'
  exerciseIds: string[]
  exercises: SessionExerciseV2[]
  restUntil?: number
  restTotal?: number
  /** Descanso pausado: segundos que faltavam ao pausar (com `restUntil` ausente). */
  restPausedLeft?: number
  /** Ciclo do programa em que a sessão foi feita (ausente = 1). */
  cycle?: number
  /** De onde veio o registro: treino ao vivo, grade do ciclo ou importação do Chorão. Ausente = sessão. */
  origin?: 'sessao' | 'grade' | 'chorao'
  readiness?: Readiness
  /** Observações da sessão. */
  notes?: string
}

/** Uma sessão passada do exercício, no formato que as estratégias recebem. */
export interface ExerciseResultV2 {
  date: number
  weekKind: 'carga' | 'deload'
  prescription: ExercisePrescription
  sets: { weight: number; reps: number; rpe: number | null; restBeforeSec: number | null }[]
}

export type SuggestionKind = 'start' | 'increase' | 'keep' | 'decrease' | 'deload' | 'less_rest' | 'add_set' | 'more_reps'

export interface SuggestionV2 {
  kind: SuggestionKind
  weight: number | null
  /** A prescrição pode mudar (densidade reduz descanso / adiciona série). */
  restSec?: number
  sets?: number
  reps?: Range
  failStreak: number
  reason: string
}

/** Contrato de cada estratégia de progressão (uma implementação por ProgressionRule). */
export interface ProgressionContext {
  goal: GoalProfile
  role: ExerciseRole
  group: MuscleGroup
  prescription: ExercisePrescription
  history: ExerciseResultV2[] // cronológico, só sessões concluídas
  weekKind: 'carga' | 'deload'
  bodyweight: boolean
}
export type ProgressionStrategy = (ctx: ProgressionContext) => SuggestionV2

// ───────────────────────── Ciclos ─────────────────────────

/** Resumo de um ciclo fechado ("Novo ciclo"): referência "Ant." e comparação entre ciclos. */
export interface CycleSnapshot {
  id?: number
  programId: number
  cycle: number
  closedAt: number
  /** Tonelagem (séries × reps × kg) de cada semana, somando todos os dias. */
  weeks: number[]
  total: number
  /** Carga de trabalho de cada exercício por semana. */
  exercises: { dayKey: string; exerciseId: string; kg: (number | null)[] }[]
}

// ───────────────────────── Backup ─────────────────────────

/** Formato 2 do backup. O import aceita o formato 1 e migra (ver docs/programacao.md). */
export interface BackupV2 {
  app: 'progressa'
  format: 2
  exportedAt: string
  profile: UserProfile | null
  activeProgramId: number | null
  programs: Program[]
  sessions: SessionV2[]
}

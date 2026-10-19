import { CURATED, MUSCLE_GROUP_PT, type CuratedExercise } from '../data/curated'
import { EQUIPMENT_PT } from '../data/i18n'
import { EQUIPMENT_ACCESS_PT, GOAL_PT, LEVEL_PT, SPLIT_PT, hasPullupBar, isAvailable, type Profile } from '../domain/profile'
import { isLow, readinessText } from '../domain/readiness'
import type { Session } from '../domain/session'
import { progressionText } from '../programacao/explain'
import { effectiveProfile, resolveRole } from '../programacao/generator'
import { GOALS } from '../programacao/goals'
import { META_BY_ID } from '../programacao/meta'
import { allWeeks, weekDayKeys } from '../programacao/program'
import type { Program } from '../programacao/types'

/** Exercícios que a IA pode usar: curados, de força (sem condicionamento) e viáveis para o perfil. */
export function availableExercises(profile: Profile, equipmentOf: (id: string) => string | undefined): CuratedExercise[] {
  return CURATED.filter((c) => c.group !== 'condicionamento' && isAvailable(profile, c.id, equipmentOf(c.id)))
}

/** Chaves dos dias que a IA deve devolver (mesma regra do gerador, incluindo divisão forçada pelo objetivo). */
export function dayKeysFor(profile: Profile): string[] {
  return weekDayKeys(effectiveProfile(profile))
}

const fmtR = (r?: { min: number; max: number }, unit = '') => (!r ? '' : r.min === r.max ? `${r.min}${unit}` : `${r.min}–${r.max}${unit}`)

const PATTERN_PT: Record<string, string> = {
  empurrar_horizontal: 'empurrar horizontal',
  empurrar_inclinado: 'empurrar inclinado',
  empurrar_vertical: 'empurrar vertical',
  crucifixo: 'crucifixo',
  puxar_horizontal: 'remada',
  puxar_vertical: 'puxada vertical',
  pulldown_isolado: 'pulldown isolado',
  elevacao_lateral: 'elevação lateral',
  elevacao_frontal: 'elevação frontal',
  deltoide_posterior: 'deltoide posterior',
  rosca: 'rosca',
  triceps_isolado: 'tríceps isolado',
  triceps_composto: 'tríceps composto',
  agachamento: 'agachamento',
  avanco: 'avanço/afundo',
  extensora: 'extensão de joelho',
  terra: 'levantamento terra/stiff',
  flexora: 'flexão de joelho',
  gluteo: 'glúteo',
  panturrilha: 'panturrilha',
  abdominal: 'abdominal',
  encolhimento: 'encolhimento',
  punho: 'punho',
}

export const ROUTINE_SYSTEM = `Você é um treinador de musculação experiente que monta rotinas para um app brasileiro.
Monte a rotina usando SOMENTE os exercícios da lista fornecida, referenciados pelo id exato.
Regras obrigatórias:
- Exatamente os dias pedidos, nas chaves pedidas, cada um com 4 a 6 exercícios distintos.
- Em cada dia, exercícios compostos antes dos isoladores.
- Distribua os grupos musculares de forma equilibrada na semana; peito, costas, pernas e ombros aparecem pelo menos uma vez.
- Séries, repetições e descanso dentro das faixas do objetivo e do nível (use a referência por papel).
- Exercícios marcados "não serve para < 6 reps" nunca recebem faixa abaixo de 6.
- Nomes dos dias em português, curtos (ex.: "Peito, ombros e tríceps").
- Em "notes", 2 a 4 frases em português explicando a lógica, sem promessas sem base (nada de "acelerar o metabolismo" ou "queimar gordura localizada").`

export function routinePrompt(input: Profile, list: CuratedExercise[], equipmentOf: (id: string) => string | undefined) {
  const profile = effectiveProfile(input)
  const goal = GOALS[profile.goal]
  const keys = dayKeysFor(profile)
  const roleLine = (role: 'principal' | 'composto' | 'isolador', label: string) => {
    const r = resolveRole(goal, role, profile.level)
    if (!r) return null
    const intensity = [r.intensity.pct1rm && `${fmtR(r.intensity.pct1rm, '%')} 1RM`, r.intensity.rpe && `RPE ${fmtR(r.intensity.rpe)}`].filter(Boolean).join(', ')
    return `- ${label}: ${r.sets} séries de ${fmtR(r.reps)} reps, descanso ${r.restSec}s${intensity ? ` (${intensity})` : ''}`
  }
  const lines = list.map((c) => {
    const m = META_BY_ID.get(c.id)
    const papel = m?.role === 'principal' ? 'principal' : c.compound ? 'composto' : 'isolador'
    const low = m && !m.adequadoBaixasReps ? ' | não serve para < 6 reps' : ''
    return `${c.id} | ${c.pt} | ${MUSCLE_GROUP_PT[c.group]} | ${PATTERN_PT[c.pattern]} | ${papel} | ${EQUIPMENT_PT[equipmentOf(c.id) ?? ''] ?? equipmentOf(c.id)}${low}`
  })
  const volume = Object.entries(goal.weeklySets)
    .map(([g, r]) => `${MUSCLE_GROUP_PT[g as keyof typeof MUSCLE_GROUP_PT]} ${fmtR(r)}`)
    .join(', ')
  return `Perfil:
- Objetivo: ${GOAL_PT[profile.goal]} — ${goal.resumo}
- Dias por semana: ${profile.daysPerWeek}
- Divisão: ${SPLIT_PT[profile.split]} → dias com as chaves ${keys.join(', ')} (nesta ordem; dias com a mesma letra podem variar os exercícios)
- Equipamento: ${EQUIPMENT_ACCESS_PT[profile.equipment]}${hasPullupBar(profile) ? ' (tem barra fixa/paralelas)' : ' (sem barra fixa)'}
- Nível: ${LEVEL_PT[profile.level]}

Referência de prescrição por papel:
${[roleLine('principal', 'Principal (1º exercício do dia)'), roleLine('composto', 'Compostos'), roleLine('isolador', 'Isoladores')].filter(Boolean).join('\n')}
- Volume semanal alvo (séries por grupo): ${volume}
- Compostos devem somar ${fmtR(goal.compoundShare.range, '%')} das séries da semana.

Exercícios disponíveis (id | nome | grupo | padrão | papel | equipamento):
${lines.join('\n')}`
}

export const REVIEW_SYSTEM = `Você é um treinador de musculação revisando as duas últimas semanas de treino de um aluno de um app brasileiro.
O app já aplica a progressão automática do objetivo (descrita no pedido) e semanas de deload planejadas.
Seu papel é olhar o conjunto: estagnação, regressão, RPE alto demais, volume desequilibrado, exercícios pulados, carga alta ou baixa demais para a faixa.
Quando houver check-in de prontidão (sono, energia, fadiga de 1 a 5), considere-o: queda de desempenho em dias de prontidão baixa não é estagnação; prontidão baixa repetida pede menos volume ou um deload, não carga maior.
Responda em português do Brasil.
- "summary": no máximo 3 frases, direto ao ponto.
- "adjustments": de 0 a 8 itens, só onde há algo a mudar ou destacar; use os ids exatos da rotina.
- Para "trocar_exercicio", "replacementId" deve ser um id da lista de alternativas; senão null.
- "suggestedWeightKg" só quando fizer sentido sugerir uma carga; senão null.
- "detail": uma frase curta e concreta.`

/** Ids de exercícios de força na semana de carga do programa. */
export const programExerciseIds = (p: Program) =>
  new Set(
    (allWeeks(p).find((w) => w.kind === 'carga') ?? allWeeks(p)[0]).days.flatMap((d) =>
      d.groups.flatMap((g) => g.items.filter((i) => i.role !== 'condicionamento').map((i) => i.exerciseId)),
    ),
  )

export function reviewPrompt(
  program: Program,
  sessions: Session[],
  nameOf: (id: string) => string,
  alternatives: CuratedExercise[],
  now = Date.now(),
) {
  const since = now - 14 * 24 * 60 * 60 * 1000
  const recent = sessions.filter((s) => s.status === 'done' && s.startedAt >= since).sort((a, b) => a.startedAt - b.startedAt)
  const week = allWeeks(program).find((w) => w.kind === 'carga') ?? allWeeks(program)[0]
  const programLines = week.days.flatMap((d) =>
    d.groups.flatMap((g) =>
      g.items
        .filter((i) => i.role !== 'condicionamento')
        .map((i) => `${d.key} | ${i.exerciseId} | ${nameOf(i.exerciseId)} | ${i.role} | ${i.sets}x${fmtR(i.reps)}${i.rpe ? ` RPE ${fmtR(i.rpe)}` : ''}`),
    ),
  )
  const sessionLines = recent.flatMap((s) => {
    const date = new Date(s.startedAt).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
    return [
      `${date} — ${s.dayName} (semana ${s.weekIndex}, ${s.weekKind})`,
      ...(s.readiness ? [`  Prontidão: ${readinessText(s.readiness)}${isLow(s.readiness) ? ' — baixa, o app reduziu a carga sugerida em 5%' : ''}`] : []),
      ...(s.notes?.trim() ? [`  Observações do aluno: ${s.notes.trim().slice(0, 300)}`] : []),
      ...s.exercises
        .filter((e) => e.role !== 'condicionamento')
        .map((e) => {
          const sets = e.log
            .filter((l) => l.done && l.reps !== null)
            .map((l) => `${l.weight ?? 0}kg×${l.reps}${l.rpe !== null ? `@${l.rpe}` : ''}`)
          return `  ${e.exerciseId} ${nameOf(e.exerciseId)} (alvo ${e.prescription.sets}x${fmtR(e.prescription.reps)}): ${sets.length ? sets.join(', ') : 'não feito'}`
        }),
    ]
  })
  const p = program.profile
  const prog = progressionText(program.goal.progression.principal ?? program.goal.progression.composto)
  return `Perfil: ${GOAL_PT[p.goal]}, ${LEVEL_PT[p.level]}, ${p.daysPerWeek}x/semana, ${SPLIT_PT[p.split]}, ${EQUIPMENT_ACCESS_PT[p.equipment]}.
Progressão automática do app: ${prog}

Programa atual (dia | id | exercício | papel | prescrição):
${programLines.join('\n')}

Sessões dos últimos 14 dias (${recent.length}):
${sessionLines.length ? sessionLines.join('\n') : '(nenhuma sessão concluída)'}

Alternativas disponíveis para troca (id | nome | grupo):
${alternatives.map((c) => `${c.id} | ${c.pt} | ${MUSCLE_GROUP_PT[c.group]}`).join('\n')}`
}

export const recentSessionCount = (sessions: Session[], now = Date.now()) =>
  sessions.filter((s) => s.status === 'done' && s.startedAt >= now - 14 * 24 * 60 * 60 * 1000).length

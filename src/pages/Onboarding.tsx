import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { APP_NAME, APP_TAGLINE } from '../brand'
import { BrandLockup } from '../components/Brand'
import { ExerciseGif } from '../components/ExerciseMedia'
import { LpoAnimation } from '../components/LpoAnimation'
import { useExercise } from '../lib/useCatalog'
import { Button, Screen } from '../components/ui'
import {
  DEFAULT_PULLUP_BAR,
  EQUIPMENT_ACCESS_PT,
  GOAL_PT,
  LEVEL_PT,
  SPLIT_HINT,
  SPLIT_PT,
  recommendedSplit,
  type EquipmentAccess,
  type Goal,
  type Level,
  type Profile,
  type Split,
} from '../domain/profile'
import { activateChoraoTemplate, saveProfileAndGenerate, useProfile } from '../lib/programStore'
import { TEMPLATE_NAME } from '../programacao/chorao'
import { GOALS, recommendedSplitFor } from '../programacao/goals'
import { GOAL_IDS } from '../programacao/types'

const DEFAULT: Profile = { goal: 'hipertrofia', daysPerWeek: 3, split: 'ABC', equipment: 'academia', level: 'iniciante' }

const LEVEL_HINT: Record<Level, string> = {
  iniciante: 'Menos de 6 meses de treino consistente',
  intermediario: '6 meses a 2 anos',
  avancado: 'Mais de 2 anos, técnica sólida',
}
const GOAL_HINT = Object.fromEntries(GOAL_IDS.map((g) => [g, GOALS[g].resumo])) as Record<Goal, string>

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <span className="grid size-6 place-items-center rounded-full bg-accent text-xs text-accent-ink">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Option({
  selected,
  onClick,
  title,
  hint,
  badge,
}: {
  selected: boolean
  onClick: () => void
  title: string
  hint?: string
  badge?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
        selected ? 'border-accent bg-accent/10' : 'border-line bg-surface hover:border-muted'
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-medium">{title}</span>
        {badge && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[11px] text-accent">{badge}</span>}
      </span>
      {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
    </button>
  )
}

const FEATURES = [
  'Grade do ciclo S1–S4 com tonelagem, 1RM e comparação com o ciclo anterior',
  'Progressão automática da carga, ajustada pelo check-in de prontidão',
  'Cronômetro, anilhas por lado, rampa de aquecimento e % do 1RM',
]

/** Primeira tela: o que o app faz e três caminhos (plano LPO, montar pelo objetivo, trazer dados). Sem conta: tudo fica no aparelho. */
function Welcome({ onCustom }: { onCustom: () => void }) {
  const navigate = useNavigate()
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const snatch = useExercise('lpo-snatch-chao')

  const go = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
      navigate('/treino', { replace: true })
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Não foi possível abrir o arquivo.')
    } finally {
      setBusy(false)
    }
  }

  /** Backup do Chorão (vira programa novo) ou deste app/Progressa (restaura tudo). Validação carregada só aqui. */
  const restore = (f: File) =>
    go(async () => {
      const text = await f.text()
      let raw: unknown = null
      try {
        raw = JSON.parse(text)
      } catch {
        throw new Error('O arquivo não é um JSON válido.')
      }
      const { isChoraoBackup } = await import('../programacao/choraoImport')
      if (isChoraoBackup(raw)) return (await import('../lib/choraoStore')).importChorao(raw)
      const { parseBackup, importData } = await import('../lib/backup')
      return importData(parseBackup(text))
    })

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-[calc(env(safe-area-inset-top)+20px)] pb-28">
      <BrandLockup className="h-9" />
      <h1 className="display mt-5 text-2xl leading-tight font-bold">{APP_TAGLINE}</h1>

      <div className="mt-4 flex justify-center">
        {snatch ? (
          <ExerciseGif exercise={snatch} className="w-full max-w-[300px]" />
        ) : (
          <LpoAnimation id="snatch" className="aspect-square w-full max-w-[300px] rounded-xl" />
        )}
      </div>

      <ul className="mt-4 space-y-1.5 text-sm text-ink/85">
        {FEATURES.map((f) => (
          <li key={f} className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-6 space-y-2">
        <Button className="w-full" disabled={busy} onClick={() => go(activateChoraoTemplate)}>
          Começar com o plano {TEMPLATE_NAME}
        </Button>
        <p className="px-1 text-xs text-muted">
          Snatch, clean e jerk no início do treino e musculação depois, 4 dias por semana, ciclos de 4 semanas. Cargas iniciais ajustáveis.
        </p>
        <Button variant="ghost" className="w-full" disabled={busy} onClick={onCustom}>
          Montar pelo meu objetivo
        </Button>
        <button disabled={busy} onClick={() => file.current?.click()} className="w-full py-2 text-sm text-accent disabled:opacity-40">
          Já tenho dados: importar backup (Chorão ou {APP_NAME})
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Arquivo de backup"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) restore(f)
          }}
        />
        {msg && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {msg}
          </p>
        )}
      </div>

      <p className="mt-auto pt-6 text-center text-xs text-muted">Sem conta e sem login: seus dados ficam só neste aparelho. Faça backup em Ajustes.</p>
    </div>
  )
}

export default function Onboarding() {
  const saved = useProfile()
  const navigate = useNavigate()
  const [p, setP] = useState<Profile>(DEFAULT)
  const [splitTouched, setSplitTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'inicio' | 'objetivo'>('inicio')

  useEffect(() => {
    if (saved) {
      setP(saved)
      setSplitTouched(true)
    }
  }, [saved])

  const set = (patch: Partial<Profile>) => setP((prev) => ({ ...prev, ...patch }))
  const setDays = (daysPerWeek: number) =>
    set(splitTouched ? { daysPerWeek } : { daysPerWeek, split: recommendedSplitFor(p.goal, daysPerWeek, recommendedSplit) })
  const bar = p.pullupBar ?? DEFAULT_PULLUP_BAR[p.equipment]
  const recommended = recommendedSplitFor(p.goal, p.daysPerWeek, recommendedSplit)
  // objetivo que impõe a divisão nesta frequência (ex.: gasto energético 2–3x → full body em circuito)
  const forced = GOALS[p.goal].dayStructureRules?.find(
    (r) => r.split && r.when.daysPerWeek && p.daysPerWeek >= r.when.daysPerWeek.min && p.daysPerWeek <= r.when.daysPerWeek.max,
  )?.split

  const submit = async () => {
    setBusy(true)
    try {
      await saveProfileAndGenerate(p)
      navigate('/treino', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  if (!saved && mode === 'inicio') return <Welcome onCustom={() => setMode('objetivo')} />

  return (
    <Screen title={saved ? 'Refazer rotina' : 'Vamos montar seu treino'} back={!!saved}>
      {!saved && (
        <button onClick={() => setMode('inicio')} className="-mt-1 mb-3 text-sm text-muted">
          ← Voltar ao início
        </button>
      )}
      {!saved && (
        <p className="mb-6 text-sm text-muted">
          Cinco perguntas e o {APP_NAME} monta sua rotina. Dá para ajustar tudo depois.
        </p>
      )}

      {/* na primeira vez o plano pronto já está na tela de abertura; aqui só para quem refaz */}
      {saved && (
      <section className="mb-7 rounded-2xl border border-accent/30 bg-accent/5 p-4">
        <p className="eyebrow text-accent">Plano pronto</p>
        <h2 className="display mt-1 font-semibold">{TEMPLATE_NAME}</h2>
        <p className="mt-1 text-sm text-muted">
          O plano do Chorão: snatch, clean e jerk no início do treino e musculação depois, 4 dias por semana, ciclos de 4 semanas
          registrados na grade S1–S4. Para quem já tem técnica de LPO.
        </p>
        <Button
          variant="ghost"
          className="mt-3 w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await activateChoraoTemplate()
              navigate('/treino', { replace: true })
            } finally {
              setBusy(false)
            }
          }}
        >
          Usar o plano {TEMPLATE_NAME}
        </Button>
      </section>
      )}
      {saved && <p className="mb-4 text-sm font-medium text-muted">Ou monte pelo seu objetivo (AB, ABC e outras divisões):</p>}

      <Section n={1} title="Objetivo">
        <div className="grid gap-2">
          {(Object.keys(GOAL_PT) as Goal[]).map((g) => (
            <Option
              key={g}
              selected={p.goal === g}
              onClick={() => set(splitTouched ? { goal: g } : { goal: g, split: recommendedSplitFor(g, p.daysPerWeek, recommendedSplit) })}
              title={GOAL_PT[g]}
              hint={GOAL_HINT[g]}
            />
          ))}
        </div>
      </Section>

      <Section n={2} title="Dias por semana">
        <div className="grid grid-cols-5 gap-2">
          {[2, 3, 4, 5, 6].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              aria-pressed={p.daysPerWeek === d}
              className={`display h-12 rounded-xl border text-lg font-semibold ${
                p.daysPerWeek === d ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-surface'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </Section>

      <Section n={3} title="Divisão">
        <div className="grid gap-2">
          {(Object.keys(SPLIT_PT) as Split[]).map((s) => (
            <Option
              key={s}
              selected={p.split === s}
              onClick={() => {
                setSplitTouched(true)
                set({ split: s })
              }}
              title={SPLIT_PT[s]}
              hint={SPLIT_HINT[s]}
              badge={s === recommended ? `indicado p/ ${p.daysPerWeek}x` : undefined}
            />
          ))}
        </div>
        {forced && forced !== p.split && (
          <p className="mt-2 rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">
            Com {p.daysPerWeek} dias, {GOALS[p.goal].nome.toLowerCase()} usa {SPLIT_PT[forced].toLowerCase()} em circuito, independentemente da
            divisão escolhida.
          </p>
        )}
      </Section>

      <Section n={4} title="Equipamento disponível">
        <div className="grid gap-2">
          {(Object.keys(EQUIPMENT_ACCESS_PT) as EquipmentAccess[]).map((e) => (
            <Option
              key={e}
              selected={p.equipment === e}
              onClick={() => set({ equipment: e, pullupBar: undefined })}
              title={EQUIPMENT_ACCESS_PT[e]}
            />
          ))}
        </div>
        {p.equipment !== 'academia' && (
          <label className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
            <span>
              <span className="block font-medium">Tenho barra fixa / paralelas</span>
              <span className="text-xs text-muted">Libera barra fixa, mergulho e remada invertida</span>
            </span>
            <input
              type="checkbox"
              checked={bar}
              onChange={(ev) => set({ pullupBar: ev.target.checked })}
              className="size-5 accent-[var(--color-accent)]"
            />
          </label>
        )}
      </Section>

      <Section n={5} title="Nível">
        <div className="grid gap-2">
          {(Object.keys(LEVEL_PT) as Level[]).map((l) => (
            <Option key={l} selected={p.level === l} onClick={() => set({ level: l })} title={LEVEL_PT[l]} hint={LEVEL_HINT[l]} />
          ))}
        </div>
      </Section>

      <div className="sticky bottom-20 pt-2">
        <Button onClick={submit} disabled={busy} className="w-full shadow-lg shadow-black/40">
          {busy ? 'Gerando…' : saved ? 'Gerar nova rotina' : 'Gerar minha rotina'}
        </Button>
      </div>
    </Screen>
  )
}

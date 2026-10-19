import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ApiKeyCard } from '../components/ApiKeyCard'
import { Button, Screen } from '../components/ui'
import { MEDIA_ATTRIBUTION } from '../data/catalog'
import { db } from '../db'
import { BackupError, exportBackupFile, importData, parseBackup, wipeUserData } from '../lib/backup'
import { ChoraoImportError, choraoInThisBrowser, importChorao } from '../lib/choraoStore'
import { getFocusMode, getTheme, setFocusMode, setTheme, type ThemeChoice } from '../lib/theme'
import { TEMPLATE_NAME } from '../programacao/chorao'
import { isChoraoBackup } from '../programacao/choraoImport'

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5 rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-2 font-semibold">{title}</h2>
      {children}
    </section>
  )
}

type Msg = { tone: 'ok' | 'error'; text: string } | null

export default function SettingsPage() {
  const counts = useLiveQuery(async () => ({
    sessions: await db.sessions.where('status').equals('done').count(),
    routines: await db.programs.count(),
  }))
  const file = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<Msg>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [theme, setThemeState] = useState<ThemeChoice>(getTheme)
  const [choraoLocal] = useState(choraoInThisBrowser)
  const [focus, setFocus] = useState(getFocusMode)

  const onExport = async () => {
    const data = await exportBackupFile()
    setMsg({ tone: 'ok', text: `Backup gerado: ${data.sessions.length} sessões, ${data.programs.length} programas.` })
  }

  const fromChorao = async (raw: unknown) => {
    const r = await importChorao(raw)
    setMsg({
      tone: 'ok',
      text:
        `Chorão importado como novo programa “${TEMPLATE_NAME}” (ativo): ${r.exercises} exercícios, ${r.sessions} treinos na grade` +
        (r.hasPrevious ? ', cargas do ciclo anterior como “Ant.”' : '') +
        (r.created.length ? `. Criados sem par no catálogo: ${r.created.join(', ')}.` : '. Todos os exercícios casaram com o catálogo.') +
        ' Seus dados anteriores continuam aqui.',
    })
  }

  const onImport = async (f: File) => {
    try {
      const text = await f.text()
      let raw: unknown = null
      try {
        raw = JSON.parse(text)
      } catch {
        // parseBackup dá a mensagem de JSON inválido
      }
      if (isChoraoBackup(raw)) {
        await fromChorao(raw)
        return
      }
      const equipment = new Map<string, string>()
      await db.exercises.each((e) => equipment.set(e.id, e.equipment))
      const b = parseBackup(text, (id) => equipment.get(id))
      const r = await importData(b)
      setMsg({
        tone: 'ok',
        text:
          `Importado: ${r.sessions} sessões e ${r.programs} programas (de ${new Date(b.exportedAt).toLocaleString('pt-BR')}).` +
          (b.migratedFrom ? ' Backup antigo convertido para o formato atual.' : ''),
      })
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof BackupError || e instanceof ChoraoImportError ? e.message : 'Não foi possível importar o arquivo.' })
    } finally {
      if (file.current) file.current.value = ''
    }
  }

  return (
    <Screen title="Ajustes">
      <Card title="Seus dados">
        <p className="text-sm text-muted">
          Tudo fica só neste aparelho (IndexedDB). Faça backup para trocar de celular ou não perder o histórico.
        </p>
        {counts && (
          <p className="mt-2 text-sm">
            {counts.sessions} {counts.sessions === 1 ? 'treino concluído' : 'treinos concluídos'} · {counts.routines} {counts.routines === 1 ? 'rotina' : 'rotinas'}
          </p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button onClick={onExport}>Exportar JSON</Button>
          <Button variant="ghost" onClick={() => file.current?.click()}>
            Importar JSON
          </Button>
        </div>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Arquivo de backup"
          onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
        />
        <p className="mt-2 text-xs text-muted">
          Importar um backup deste app (ou do Progressa, que usa o mesmo formato) substitui o perfil, as rotinas e o histórico atuais. Um backup do CHORÃO PERFORMANCE (JSON exportado
          por ele) entra como programa novo, sem apagar nada.
        </p>
        {choraoLocal !== null && (
          <Button
            variant="ghost"
            className="mt-2 w-full"
            onClick={() => fromChorao(choraoLocal).catch((e) => setMsg({ tone: 'error', text: e instanceof Error ? e.message : String(e) }))}
          >
            Importar o Chorão deste navegador
          </Button>
        )}
        {msg && (
          <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.tone === 'ok' ? 'bg-accent/10 text-accent' : 'bg-danger/10 text-danger'}`}>
            {msg.text}
          </p>
        )}
        <div className="mt-4 border-t border-line pt-3">
          {confirmWipe ? (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm text-danger">Apagar perfil, rotinas e histórico?</span>
              <Button variant="ghost" onClick={() => setConfirmWipe(false)}>
                Não
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await wipeUserData()
                  setConfirmWipe(false)
                  setMsg({ tone: 'ok', text: 'Dados apagados.' })
                }}
              >
                Apagar
              </Button>
            </div>
          ) : (
            <button onClick={() => setConfirmWipe(true)} className="text-sm text-danger/80 hover:text-danger">
              Apagar todos os dados…
            </button>
          )}
        </div>
      </Card>

      <Card title="Aparência">
        <div className="flex rounded-xl border border-line bg-bg p-0.5 text-sm" role="radiogroup" aria-label="Tema">
          {(
            [
              ['sistema', 'Do sistema'],
              ['escuro', 'Ferro (escuro)'],
              ['claro', 'Giz (claro)'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="radio"
              aria-checked={theme === k}
              onClick={() => {
                setTheme(k)
                setThemeState(k)
              }}
              className={`flex-1 rounded-lg py-2 ${theme === k ? 'bg-surface-2 font-semibold text-ink' : 'text-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="mt-3 flex items-center justify-between gap-3">
          <span>
            <span className="block font-medium">Modo Foco</span>
            <span className="text-xs text-muted">Letras e botões 15% maiores, para ler de longe na academia</span>
          </span>
          <input
            type="checkbox"
            checked={focus}
            onChange={(e) => {
              setFocusMode(e.target.checked)
              setFocus(e.target.checked)
            }}
            className="size-5 accent-[var(--color-accent)]"
          />
        </label>
      </Card>

      <Card title="Guia">
        <Link to="/guia" className="flex items-center justify-between text-sm">
          <span>Entenda 1RM, RPE, as contas de carga e o volume</span>
          <span className="text-muted">→</span>
        </Link>
      </Card>

      <ApiKeyCard />

      <Card title="Sobre">
        <p className="text-sm text-muted">
          Exercícios do dataset aberto{' '}
          <a className="text-ink underline" href="https://github.com/hasaneyldrm/exercises-dataset" target="_blank" rel="noreferrer">
            hasaneyldrm/exercises-dataset
          </a>{' '}
          (dados sob licença MIT). Imagens e GIFs: {MEDIA_ATTRIBUTION}
        </p>
      </Card>
    </Screen>
  )
}

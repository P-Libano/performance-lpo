import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { META, db } from '../db'

const DAY = 864e5
export const BACKUP_WARN_DAYS = 7

/** Aviso do Chorão: sem backup há 7+ dias (só para quem já tem treino registrado). */
export function BackupReminder() {
  const info = useLiveQuery(async () => {
    const [last, done] = await Promise.all([db.meta.get(META.lastBackupAt), db.sessions.where('status').equals('done').count()])
    return { last: last?.value as number | undefined, done }
  }, [])
  const [busy, setBusy] = useState(false)
  if (!info || info.done === 0) return null
  const days = info.last ? Math.floor((Date.now() - info.last) / DAY) : null
  if (days !== null && days < BACKUP_WARN_DAYS) return null
  return (
    <div role="status" className="mb-3 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2.5 text-sm text-warn print:hidden">
      {days === null ? 'Nenhum backup feito ainda.' : `Último backup há ${days} dias.`} Seus dados ficam só neste aparelho.
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            // zod só carrega aqui (o backup valida com ele)
            await (await import('../lib/backup')).exportBackupFile()
          } finally {
            setBusy(false)
          }
        }}
        className="mt-2 block h-9 rounded-lg bg-warn/15 px-3 font-semibold"
      >
        Fazer backup agora
      </button>
    </div>
  )
}

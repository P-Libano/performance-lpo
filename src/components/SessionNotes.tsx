import { useEffect, useState } from 'react'

/** Observações da sessão (ex.: "sapatilha de LPO, pegada falhou no stiff"). Grava ao sair do campo. */
export function SessionNotes({ value, onSave }: { value: string | undefined; onSave: (v: string) => void }) {
  const [text, setText] = useState(value ?? '')
  useEffect(() => setText(value ?? ''), [value])
  return (
    <label className="mt-4 block">
      <span className="text-sm font-medium text-muted">Observações da sessão</span>
      <textarea
        value={text}
        rows={3}
        maxLength={2000}
        placeholder="Ex.: sapatilha de LPO, pegada falhou no stiff, dor leve no ombro…"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== (value ?? '') && onSave(text)}
        className="mt-1 w-full resize-y rounded-xl border border-line bg-surface p-3 text-sm outline-none focus:border-accent"
      />
    </label>
  )
}

import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router'

export function Screen({
  title,
  back,
  action,
  children,
}: {
  title: string
  back?: boolean
  action?: ReactNode
  children: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className="mx-auto w-full max-w-xl pb-24">
      {/* No app instalado (iOS, barra translúcida) a página começa sob a barra de status: o cabeçalho desce junto. */}
      <header className="sticky top-0 z-10 border-b border-line bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-4">
          {back && (
            <button
              onClick={() => navigate(-1)}
              aria-label="Voltar"
              className="-ml-2 grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2"
            >
              <Icon name="back" />
            </button>
          )}
          <h1 className="display min-w-0 flex-1 truncate text-lg font-bold">{title}</h1>
          {action}
        </div>
      </header>
      <div className="px-4 pt-4">{children}</div>
    </div>
  )
}

/** Painel que sobe da base da tela (fecha no fundo escuro ou com Esc). */
export function Sheet({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: ReactNode
  eyebrow?: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/60 print:hidden" onClick={onClose} role="dialog" aria-modal>
      <div
        className="mx-auto max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl border-t border-line bg-surface pb-[calc(1rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start gap-2 border-b border-line bg-surface px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line" />
            {eyebrow && <p className="text-xs text-muted">{eyebrow}</p>}
            <div className="font-semibold">{title}</div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="-mr-2 grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2">
            ✕
          </button>
        </div>
        <div className="px-4 pt-3">{children}</div>
      </div>
    </div>
  )
}

export function Chip({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'accent' }) {
  const cls =
    tone === 'accent' ? 'bg-accent/15 text-accent border-accent/30' : 'bg-surface-2 text-ink/80 border-line'
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs ${cls}`}>{children}</span>
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger'
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
}) {
  const v = {
    primary: 'bg-accent text-accent-ink hover:brightness-110',
    ghost: 'bg-surface-2 text-ink hover:bg-line',
    danger: 'bg-danger/15 text-danger hover:bg-danger/25',
  }[variant]
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 font-semibold transition disabled:opacity-40 ${v} ${className}`}
    >
      {children}
    </button>
  )
}

const PATHS: Record<string, string> = {
  back: 'M15 18l-6-6 6-6',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.35-4.35',
  dumbbell: 'M6 6v12M18 6v12M3 9v6M21 9v6M6 12h12',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  chart: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 2h-4l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  check: 'M20 6 9 17l-5-5',
  swap: 'M7 16V4M7 4 3 8M7 4l4 4M17 8v12M17 20l4-4M17 20l-4-4',
  timer: 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 10v4l2 2M9 2h6',
  plus: 'M12 5v14M5 12h14',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z',
}

export function Icon({ name, className = 'size-5' }: { name: keyof typeof PATHS | string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

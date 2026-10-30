import { APP_NAME, APP_NAME_PARTS, APP_STAGE } from '../brand'

/** Selo do estágio da versão ("beta"), ao lado da assinatura; some quando `APP_STAGE` for null. */
export function StageBadge() {
  if (!APP_STAGE) return null
  return (
    <span className="rounded-full border border-accent/50 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-accent uppercase">{APP_STAGE}</span>
  )
}

/** Marca "Carga": barra, três anilhas crescendo e a trava. Cor = `currentColor` (use `text-accent`). */
export function BrandMark({ className = 'size-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" className={className} aria-hidden>
      <rect x="6" y="46.5" width="88" height="7" rx="3.5" />
      <rect x="20" y="30" width="13" height="40" rx="4" />
      <rect x="37" y="22" width="13" height="56" rx="4" />
      <rect x="54" y="14" width="13" height="72" rx="4" />
      <rect x="71" y="41" width="6" height="18" rx="2" />
    </svg>
  )
}

/**
 * Assinatura horizontal: marca em latão + "Performance" na cor do texto + "LPO" em latão.
 * Altura pelo `className` (ex.: h-7). O nome é texto num SVG (Archivo, a fonte de títulos do app),
 * então escala junto com a marca; `textLength` fixa a largura mesmo antes de a fonte carregar.
 */
export function BrandLockup({ className = 'h-7' }: { className?: string }) {
  const [name, tag] = APP_NAME_PARTS
  return (
    <span className={`inline-flex items-center gap-[0.3em] ${className}`} role="img" aria-label={APP_NAME}>
      <BrandMark className="h-full w-auto shrink-0 text-accent" />
      <svg viewBox="0 0 212 30" className="h-[62%] w-auto overflow-visible" aria-hidden>
        <text
          x="0"
          y="24"
          fontFamily="var(--font-display)"
          fontSize="29"
          fontWeight="700"
          letterSpacing="-0.4"
          fill="var(--color-ink)"
          style={{ fontStretch: '112.5%' }}
          textLength="160"
          lengthAdjust="spacingAndGlyphs"
        >
          {name}
        </text>
        <text
          x="168"
          y="24"
          fontFamily="var(--font-display)"
          fontSize="29"
          fontWeight="900"
          fill="var(--color-accent)"
          style={{ fontStretch: '112.5%' }}
          textLength="44"
          lengthAdjust="spacingAndGlyphs"
        >
          {tag}
        </text>
      </svg>
    </span>
  )
}

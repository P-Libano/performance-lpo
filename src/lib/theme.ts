/** Tema: segue o sistema por padrão; a escolha em Ajustes fica neste aparelho (localStorage). */
export type ThemeChoice = 'sistema' | 'escuro' | 'claro'

const KEY = 'progressa-tema'
const BAR = { escuro: '#0d0f12', claro: '#f3f4f5' } as const

export function getTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'escuro' || v === 'claro' ? v : 'sistema'
  } catch {
    return 'sistema'
  }
}

export function applyTheme(choice = getTheme()) {
  const root = document.documentElement
  if (choice === 'sistema') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', choice === 'escuro' ? 'dark' : 'light')
  // barra do sistema: as duas metas (uma por esquema) passam a ter a cor escolhida
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const scheme = m.media.includes('light') ? 'claro' : 'escuro'
    m.content = BAR[choice === 'sistema' ? scheme : choice]
  })
}

/** Modo Foco (Chorão): fonte 15% maior para ler de longe na academia. Fica neste aparelho. */
const FOCUS_KEY = 'progressa-modo-foco'

export function getFocusMode(): boolean {
  try {
    return localStorage.getItem(FOCUS_KEY) === '1'
  } catch {
    return false
  }
}

export function applyFocusMode(on = getFocusMode()) {
  document.documentElement.classList.toggle('modo-foco', on)
}

export function setFocusMode(on: boolean) {
  try {
    if (on) localStorage.setItem(FOCUS_KEY, '1')
    else localStorage.removeItem(FOCUS_KEY)
  } catch {
    // sem armazenamento: vale só nesta visita
  }
  applyFocusMode(on)
}

export function setTheme(choice: ThemeChoice) {
  try {
    if (choice === 'sistema') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    // sem armazenamento: vale só nesta visita
  }
  applyTheme(choice)
}

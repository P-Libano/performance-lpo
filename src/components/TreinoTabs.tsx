import { NavLink } from 'react-router'

/** Alterna as duas vistas do treino: lista do programa e grade do ciclo (S1–S4). */
export function TreinoTabs() {
  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex-1 rounded-lg py-2 text-center ${isActive ? 'bg-surface-2 font-semibold text-ink' : 'text-muted'}`
  return (
    <nav className="mb-3 flex rounded-xl border border-line bg-surface p-0.5 text-sm print:hidden" aria-label="Vista do treino">
      <NavLink to="/treino" end className={cls}>
        Programa
      </NavLink>
      <NavLink to="/ciclo" className={cls}>
        Grade do ciclo
      </NavLink>
      <NavLink to="/ferramentas" className={cls}>
        Ferramentas
      </NavLink>
    </nav>
  )
}

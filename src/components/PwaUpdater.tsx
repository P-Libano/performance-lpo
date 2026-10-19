import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { APP_NAME } from '../brand'

/** Avisa quando há versão nova (o usuário escolhe a hora, para não interromper um treino) e quando já funciona offline. */
export function PwaUpdater() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // confere atualização a cada hora enquanto o app fica aberto
      if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
    },
  })

  useEffect(() => {
    if (!offlineReady) return
    const t = setTimeout(() => setOfflineReady(false), 5000)
    return () => clearTimeout(t)
  }, [offlineReady, setOfflineReady])

  if (!needRefresh && !offlineReady) return null
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 px-3 pt-[calc(env(safe-area-inset-top)+8px)]">
      <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3 shadow-xl shadow-black/50">
        <p className="flex-1 text-sm">{needRefresh ? `Nova versão do ${APP_NAME} disponível.` : 'Pronto para usar offline.'}</p>
        {needRefresh ? (
          <>
            <button onClick={() => setNeedRefresh(false)} className="text-sm text-muted">
              Depois
            </button>
            <button onClick={() => updateServiceWorker(true)} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink">
              Atualizar
            </button>
          </>
        ) : (
          <button onClick={() => setOfflineReady(false)} className="text-sm text-muted">
            OK
          </button>
        )}
      </div>
    </div>
  )
}

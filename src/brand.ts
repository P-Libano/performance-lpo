/**
 * Nome e frases da marca deste fork (Performance LPO = Progressa + CHORÃO PERFORMANCE).
 * O formato do backup continua "progressa" (`app` do backup) para que os backups sirvam nos dois apps; o banco
 * local tem nome próprio (db.ts: os dois apps ficam no mesmo domínio). Manifesto do PWA e <title> ficam em
 * vite.config.ts e index.html.
 */
export const APP_NAME = 'Performance LPO'
export const APP_NAME_PARTS = ['Performance', 'LPO'] as const
/** Estágio da versão publicada (selo ao lado da marca); null quando sair do beta. */
export const APP_STAGE: string | null = 'beta'
export const APP_TAGLINE = 'Levantamento olímpico e musculação, ciclo a ciclo.'

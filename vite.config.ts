import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// Regex (não funções): o workbox copia o padrão para dentro do sw.js, onde constantes deste arquivo não existem.
const DATASET_JSON = /^https:\/\/cdn\.jsdelivr\.net\/gh\/hasaneyldrm\/exercises-dataset@[^/]+\/data\/exercises\.json$/
const DATASET_MEDIA = /^https:\/\/cdn\.jsdelivr\.net\/gh\/hasaneyldrm\/exercises-dataset@[^/]+\/(images|videos)\//

export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages publica em https://<usuário>.github.io/progressa/; em dev fica na raiz (preview usa a do build)
  base: command === 'build' || isPreview ? (process.env.BASE_PATH ?? '/progressa/') : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt', // o app pergunta antes de trocar de versão (não interrompe um treino)
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        // fork do Progressa: id próprio para não ser tratado como o mesmo app instalado
        id: 'performance-lpo',
        name: 'Performance LPO — levantamento olímpico e musculação',
        // o launcher do Android corta nomes longos (~12 caracteres)
        short_name: 'Perf. LPO',
        description: 'Levantamento olímpico e musculação, ciclo a ciclo: grade S1–S4, progressão automática, ferramentas de barra e histórico.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0d0f12',
        background_color: '#0d0f12',
        categories: ['health', 'fitness', 'sports'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // base de exercícios (~1,5 MB comprimido); o app também guarda a versão enxuta no IndexedDB
            urlPattern: DATASET_JSON,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'progressa-dataset', expiration: { maxEntries: 2 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            // GIFs e miniaturas: guardados conforme o usuário vê cada exercício (nunca em lote: o CDN limita taxa)
            urlPattern: DATASET_MEDIA,
            handler: 'CacheFirst',
            options: {
              cacheName: 'progressa-midia',
              expiration: { maxEntries: 800, maxAgeSeconds: 90 * 24 * 60 * 60, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    // sem cache de módulos em disco: com ele, o import.meta.glob de src/anim/exercises fica congelado e um
    // exercício novo não é testado — "verde" sem testar (achado no piloto das animações)
    fsModuleCache: false,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
}))

/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from "path"

// Identidade deste build. Vai compilada dentro do bundle (__BUILD_ID__) e também
// publicada em /version.json, para o app conseguir comparar "a versão que estou
// rodando" com "a versão que está no ar" e se atualizar sozinho.
// Ver src/hooks/useVersionGuard.ts e apps/interno/public/sw.js.
const buildId = Date.now().toString(36)

export default defineConfig(({ mode }) => {
  // Integração roda contra a PRODUÇÃO — só com flag explícita:
  // `pnpm --filter interno test:integration` (= --mode integration) ou RUN_INTEGRATION=1.
  const RUN_INTEGRATION = mode === 'integration' || process.env.RUN_INTEGRATION === '1'

  return {
    define: {
      __BUILD_ID__: JSON.stringify(buildId),
    },
    plugins: [
      tailwindcss(),
      react(),
      {
        name: 'mont-emit-version-json',
        apply: 'build',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'version.json',
            source: JSON.stringify({ buildId }),
          })
        },
      },
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    base: '/',
    server: {
      watch: {
        usePolling: true, // Força verificação cíclica de mudanças (resolve problema WSL)
      },
      host: true, // Expõe servidor na rede local (WSL → Windows)
      strictPort: true,
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.ts',
      fileParallelism: false,
      // Integração roda contra a PRODUÇÃO (conta-teste). Nunca por acidente: só com
      // RUN_INTEGRATION=1 (`pnpm --filter interno test:integration`). O harness
      // (createTestClient) também recusa sem a flag — cobre arquivo sem o sufixo.
      exclude: [
        '.aios-core/**',
        'node_modules/**',
        ...(RUN_INTEGRATION ? [] : ['**/*.integration.test.ts']),
      ],
      env: { RUN_INTEGRATION: RUN_INTEGRATION ? '1' : '' },
    },
  }
})

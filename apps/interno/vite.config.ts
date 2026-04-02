/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from "path"
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // Prompt user for update
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Gilmar Distribuidor Massas',
        short_name: 'Gilmar Massas',
        description: 'Sistema de gestão comercial para distribuidora de alimentos',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3000000
      }
    })
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
    exclude: [
      '.aios-core/**',
      'node_modules/**'
    ]
  },
})

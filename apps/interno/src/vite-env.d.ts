/// <reference types="vite/client" />

import { ThreeElements } from '@react-three/fiber'

declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

declare module 'react/jsx-dev-runtime' {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

declare global {
  // Injetado pelo Vite (define) no build. Identifica a versão do bundle em
  // execução — comparada com /version.json em src/hooks/useVersionGuard.ts.
  const __BUILD_ID__: string

  namespace React {
    namespace JSX {
      interface IntrinsicElements extends ThreeElements {}
    }
  }
}
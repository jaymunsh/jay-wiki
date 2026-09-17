import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.{js,ts,tsx}'],
    // Playwright owns browser/*.spec.ts; keep Vitest focused on unit/component tests.
    exclude: ['tests/browser/**'],
  },
  resolve: {
    alias: {
      'server-only': fileURLToPath(new URL('./test/server-only.ts', import.meta.url)),
      // tsconfig 의 paths 와 같은 것. 없으면 app/ 안의 모듈을 테스트에서 못 불러온다.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});

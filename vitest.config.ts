import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitestReporter } from 'tdd-guard-vitest'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
    reporters: ['default', new VitestReporter('/home/sallvain/dev/work/ClassPoints')],
  },
})

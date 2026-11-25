import { defineConfig, devices } from '@playwright/test';
import { E2E } from './e2e/e2e-env';

/**
 * Pruebas E2E (B-06): levantan la API y la web reales contra una base propia
 * (`sistema_dental_e2e`) y recorren la aplicación en Chromium, en escritorio y en
 * un celular de 360 px (RNF-09). Antes: `pnpm db:up` y `pnpm build`.
 * La base la prepara `e2e/prepare-db.mts` (lo ejecuta el script `test:e2e`).
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: E2E.webUrl,
    locale: 'es-BO',
    timezoneId: 'America/La_Paz',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'celular-360',
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 }, isMobile: true },
    },
  ],
  webServer: [
    {
      command: 'node ../api/dist/main.js',
      url: `${E2E.apiUrl}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(E2E.apiPort),
        DATABASE_URL: E2E.databaseUrl,
        WEB_ORIGINS: E2E.webUrl,
        COOKIE_SECURE: 'false',
      },
    },
    {
      command: `pnpm exec next dev --port ${E2E.webPort}`,
      url: E2E.webUrl,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { API_URL: E2E.apiUrl, NEXT_TELEMETRY_DISABLED: '1' },
    },
  ],
});

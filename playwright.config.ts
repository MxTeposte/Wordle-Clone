import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

/** Valores fijos para que las pruebas puedan calcular las soluciones del día. */
export const E2E_ENV = {
  WORD_SEED: 'e2e-seed',
  GAME_SECRET: 'e2e-secret',
  START_DATE: '2026-01-01',
};

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}/es`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: E2E_ENV,
  },
});

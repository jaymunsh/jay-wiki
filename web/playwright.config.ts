import { defineConfig, devices } from '@playwright/test';

const localPort = Number(process.env.BROWSER_NEXT_PORT ?? 3100);
const baseURL = process.env.BASE_URL ?? `http://127.0.0.1:${localPort}`;
const usesExternalServer = Boolean(process.env.BASE_URL);

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // Chromium mobile emulation keeps CI to one browser download; a real iOS/WebKit
    // pass can be added separately when the deployment runner provides WebKit.
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: usesExternalServer
    ? undefined
    : {
        command: `BROWSER_NEXT_PORT=${localPort} node ../scripts/browser-smoke-server.mjs`,
        url: `${baseURL}/wiki/${encodeURIComponent(process.env.WIKI_SMOKE_SLUG ?? 'browser-smoke-article')}`,
        timeout: 120_000,
        reuseExistingServer: false,
      },
});

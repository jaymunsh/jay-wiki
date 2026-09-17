import { defineConfig, devices } from '@playwright/test';

// Intentionally fixed loopback endpoints. These tests write data and never target production.
export default defineConfig({
  testDir: './tests/editorial',
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  timeout: 60_000,
  use: { baseURL: 'http://admin.localhost:3101', trace: 'retain-on-failure', video: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: [
    {
      command: './gradlew bootTestRun --args="--server.address=127.0.0.1 --server.port=3181 --app.opensearch.enabled=false --app.kafka-demo.enabled=false"',
      cwd: '../spring',
      env: { SPRING_PROFILES_ACTIVE: 'local' },
      url: 'http://127.0.0.1:3181/actuator/health',
      timeout: 180_000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 15_000 },
    },
    {
      command: 'npm run start -- --hostname 127.0.0.1 --port 3101',
      env: { API_INTERNAL_BASE: 'http://127.0.0.1:3181' },
      url: 'http://admin.localhost:3101/login',
      timeout: 120_000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    },
  ],
});

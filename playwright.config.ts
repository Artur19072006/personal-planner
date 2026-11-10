import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const remoteBaseURL = process.env.PLANNER_BASE_URL;

export default defineConfig({
  testDir: './e2e', fullyParallel: true, workers: 2, timeout: 45000,
  expect: { timeout: 8000 }, reporter: 'list',
  outputDir: join(tmpdir(), 'personal-planner-e2e'),
  use: { baseURL: remoteBaseURL ?? 'http://localhost:4173', timezoneId: 'Europe/Kiev', locale: 'ru-RU', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium-mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', deviceScaleFactor: 1 } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 13'], deviceScaleFactor: 1 } },
  ],
  webServer: remoteBaseURL ? undefined : { command: 'npm run build && npm run preview', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI, timeout: 120000 },
});

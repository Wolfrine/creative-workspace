import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 60000, workers: 1, outputDir: '.local/browser-test-results',
  reporter: [['list'], ['json', { outputFile: process.env.NOVELIAA_EVIDENCE_DIR ? process.env.NOVELIAA_EVIDENCE_DIR + '/browser-results.json' : '.local/browser-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:5817', viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'npm run dev', url: 'http://127.0.0.1:5817', reuseExistingServer: !process.env.CI },
    { command: 'npm run preview -- --port 5818 --strictPort', url: 'http://127.0.0.1:5818', reuseExistingServer: !process.env.CI },
  ],
});

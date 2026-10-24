import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/spark-browser', timeout: 90000, workers: 1, outputDir: '.local/spark-test-results',
  reporter: [['list'], ['json', { outputFile: '.local/spark-browser-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:5820', viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: 'npm run dev -- --port 5820 --strictPort', url: 'http://127.0.0.1:5820', reuseExistingServer: false,
    env: { VITE_FIREBASE_EMULATORS: 'true', VITE_FIREBASE_CONFIG: JSON.stringify({ apiKey: 'emulator-public-key', projectId: 'demo-noveliaa', authDomain: 'demo-noveliaa.firebaseapp.com', appId: 'synthetic-spark-app' }) },
  },
});

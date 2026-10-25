import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export default defineConfig({ plugins: [react(), {
  name: 'complete-offline-shell', apply: 'build',
  async closeBundle() {
    const files = (await readdir('dist/assets')).sort().map(name => '/assets/' + name);
    const shell = await readFile('dist/index.html', 'utf8');
    const version = createHash('sha256').update(shell + files.join('\n')).digest('hex').slice(0, 20);
    const worker = (await readFile('public/sw.js', 'utf8')).replace('__BUILD_ID__', version).replace('/*__PRECACHE__*/', files.map(name => JSON.stringify(name)).join(','));
    await writeFile('dist/sw.js', worker);
  },
}], server: { port: 5817, strictPort: true, watch: { ignored: ['**/.local/**', '**/docs/evidence/**'] } }, build: { sourcemap: false } });

// Reproducible local build of MIT-licensed StPageFlip 2.0.7. Never edits node_modules.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, version as esbuildVersion } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(root, 'node_modules/page-flip');
const destination = 'src/vendor/pageflip';
const check = process.argv.includes('--check');
const hash = value => createHash('sha256').update(value).digest('hex');
async function files(directory) { return (await Promise.all((await readdir(directory, { withFileTypes: true })).map(item => item.isDirectory() ? files(`${directory}/${item.name}`) : `${directory}/${item.name}`))).flat(); }
assert.equal(JSON.parse(await readFile(`${sourceRoot}/package.json`, 'utf8')).version, '2.0.7');
assert.equal(esbuildVersion, '0.28.2');
const upstreamFiles = await Promise.all((await files(`${sourceRoot}/src`)).sort().map(async path => [path.slice(sourceRoot.length + 1).replaceAll('\\', '/'), hash(await readFile(path))]));
const upstreamHash = hash(JSON.stringify(upstreamFiles));
assert.equal(upstreamHash, 'efa92671bde717e11a03820d29794dbb82a604bf106f41290814621ae9cc408a', 'Pinned upstream source changed; review patches before rebuilding.');
function replace(source, before, after, count = 1) { assert.equal(source.split(before).length - 1, count, 'Patch anchor changed.'); return source.replaceAll(before, after); }
const patches = {
  'src/Render/Render.ts': source => {
    source = replace(source, '    private safari = false;', '    private safari = false;\n    private frameId: number | null = null;\n    private running = false;');
    return replace(source, `    public start(): void {
        this.update();

        const loop = (timer: number): void => {
            this.render(timer);
            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    }`, `    public start(): void {
        this.stop();
        this.running = true;
        this.update();
        const loop = (timer: number): void => {
            if (!this.running) return;
            this.render(timer);
            if (this.running) this.frameId = requestAnimationFrame(loop);
        };
        this.frameId = requestAnimationFrame(loop);
    }

    public stop(): void {
        this.running = false;
        if (this.frameId !== null) cancelAnimationFrame(this.frameId);
        this.frameId = null;
        this.animation = null;
    }`);
  },
  'src/PageFlip.ts': source => {
    source = replace(source, '    private ui: UI;', '    private ui: UI;\n    private destroyed = false;\n    private initTimers = new Set<ReturnType<typeof setTimeout>>();');
    source = replace(source, `    public destroy(): void {
        this.ui.destroy();
        this.block.remove();
    }`, `    public destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        for (const timer of this.initTimers) clearTimeout(timer);
        this.initTimers.clear();
        this.render?.stop();
        this.ui?.destroy();
        this.pages?.destroy();
        this.block.remove();
    }`);
    return replace(source, `        setTimeout(() => {
            this.ui.update();
            this.trigger('init', this, {
                page: this.setting.startPage,
                mode: this.render.getOrientation(),
            });
        }, 1);`, `        const timer = setTimeout(() => {
            this.initTimers.delete(timer);
            if (this.destroyed) return;
            this.ui.update();
            this.trigger('init', this, {
                page: this.setting.startPage,
                mode: this.render.getOrientation(),
            });
        }, 1);
        this.initTimers.add(timer);`, 2);
  },
  'src/UI/UI.ts': source => replace(source, '    public destroy(): void {\n        if (this.app.getSettings().useMouseEvents) this.removeHandlers();', "    public destroy(): void {\n        window.removeEventListener('resize', this.onResize, false);\n        if (this.app.getSettings().useMouseEvents) this.removeHandlers();"),
};
const result = await build({
  absWorkingDir: root, entryPoints: ['node_modules/page-flip/src/PageFlip.ts'], outfile: `${destination}/page-flip.js`,
  bundle: true, format: 'esm', platform: 'browser', target: 'es2020', minify: false, write: false, charset: 'utf8',
  banner: { js: '/*! StPageFlip 2.0.7, MIT. Lifecycle-only patch; see provenance.json and LICENSE. */' },
  plugins: [{ name: 'noveliaa-explicit-lifecycle', setup(builder) { builder.onLoad({ filter: /node_modules[\\/]page-flip[\\/]src[\\/].*\.ts$/ }, async args => { const name = args.path.slice(sourceRoot.length + 1).replaceAll('\\', '/'); if (!patches[name]) return; return { contents: patches[name](await readFile(args.path, 'utf8')), loader: 'ts' }; }); } }],
});
const generated = new Map(result.outputFiles.map(file => [file.path.slice(root.length + 1).replaceAll('\\', '/'), Buffer.from(file.contents)]));
generated.set(`${destination}/LICENSE`, await readFile(`${sourceRoot}/LICENSE`));
generated.set(`${destination}/provenance.json`, Buffer.from(JSON.stringify({
  package: 'page-flip', version: '2.0.7', license: 'MIT', source: 'https://github.com/Nodlik/StPageFlip',
  upstreamSourceSha256: upstreamHash, upstreamFiles, generator: 'scripts/build-pageflip.mjs', esbuild: esbuildVersion,
  patches: [
    'Render.start owns one cancellable animation frame; Render.stop cancels it and drops active animation.',
    'PageFlip.destroy is idempotent, cancels both init timers, stops render and releases page references.',
    'UI.destroy removes its resize listener even when mouse/touch handling is disabled.',
  ],
  outputs: [...generated].map(([path, bytes]) => ({ path, sha256: hash(bytes) })),
}, null, 2) + '\n'));
for (const [path, bytes] of generated) {
  if (check) assert.deepEqual(await readFile(resolve(root, path)), bytes, `Generated vendor file drifted: ${path}`);
  else { await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), bytes); }
}
console.log(`${check ? 'Verified' : 'Generated'} ${generated.size} pinned page-flip files; lifecycle patches only.`);

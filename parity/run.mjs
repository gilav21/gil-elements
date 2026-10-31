// Visual parity: shadcn-angular's real Tailwind output vs the elements, per case item, in light and
// dark, compared pixel by pixel. Usage: node parity/run.mjs [caseName ...]
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = `${here}out`;
mkdirSync(out, { recursive: true });

const wanted = process.argv.slice(2);
const cases = [];
for (const file of readdirSync(`${here}cases`).sort()) {
    const mod = (await import(pathToFileURL(`${here}cases/${file}`).href)).default;
    if (wanted.length === 0 || wanted.includes(mod.name)) cases.push(mod);
}

// Tailwind only emits classes it finds in source, so write every reference snippet to one file first.
writeFileSync(`${out}/reference-source.html`, cases.flatMap((c) => c.items.map((i) => i.ref)).join('\n'));
execFileSync('npx', ['tailwindcss', '-i', `${here}reference.css`, '-o', `${out}/reference.out.css`], { stdio: 'ignore' });
await build({
    configFile: false,
    root: here,
    logLevel: 'warn',
    resolve: { conditions: ['development'] },
    build: { outDir: `${out}/bundle`, emptyOutDir: true, lib: { entry: `${here}entry.ts`, name: 'GeParity', formats: ['iife'], fileName: () => 'elements.js' }, minify: false },
});

const tokens = readFileSync(`${here}../packages/base/src/tokens.css`, 'utf8');
const referenceCss = readFileSync(`${out}/reference.out.css`, 'utf8');
const bundle = readFileSync(`${out}/bundle/elements.js`, 'utf8');

const rows = (cases_, side) =>
    cases_
        .flatMap((c) => c.items.map((i) => ({ key: `${c.name}/${i.id}`, html: i[side], wrap: i.wrap ?? '', at: i.at })))
        .map((i) => `<div data-case="${i.key}" ${i.at ? `data-at="${i.at}"` : ''} style="padding:12px;${i.wrap}">${i.html}</div>`)
        .join('\n');
const shell = (theme, body, extraCss) =>
    `<!doctype html><html class="${theme}"><head><style>${tokens}${extraCss}
     /* The two parts of Tailwind's preflight that change layout; applied to both pages so only the components differ. */
     *,*::before,*::after{box-sizing:border-box} html{line-height:1.5}
     body{margin:0;padding:16px;background:var(--background);color:var(--foreground);font-family:system-ui,sans-serif}
     [data-case]{display:block;width:max-content;max-width:100%}
     </style></head><body>${body}</body></html>`;

const browser = await chromium.launch();
let failures = 0;
let compared = 0;
const report = [];
for (const theme of ['light', 'dark']) {
    const shots = {};
    for (const side of ['ref', 'el']) {
        const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 700, height: 900 } });
        const body = rows(cases, side) + (side === 'el' ? `<script>${bundle}</script>` : '');
        await page.setContent(shell(theme, body, side === 'ref' ? referenceCss : ''));
        if (side === 'el') {
            await page.evaluate(async () => {
                const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('elements never defined')), 5000));
                const tags = [...new Set([...document.querySelectorAll('*')].map((e) => e.localName).filter((n) => n.startsWith('ge-')))];
                await Promise.race([Promise.all(tags.map((t) => customElements.whenDefined(t))), timeout]);
                await Promise.all([...document.querySelectorAll('*')].filter((e) => e.updateComplete).map((e) => e.updateComplete));
            });
        }
        await page.evaluate(() => document.fonts.ready);
        // Freeze every animation (shadow trees included) at the same instant, so keyframes, delays and
        // durations are compared instead of being cancelled away.
        await page.evaluate(() => {
            // document.getAnimations() does not see into shadow roots, so walk them explicitly.
            const freeze = (root, at) => {
                for (const el of root.querySelectorAll('*')) {
                    const time = Number(el.closest('[data-case]')?.dataset.at ?? at);
                    for (const animation of el.getAnimations()) {
                        animation.pause();
                        animation.currentTime = time;
                    }
                    if (el.shadowRoot) freeze(el.shadowRoot, time);
                }
            };
            freeze(document, 700);
        });
        shots[side] = new Map();
        for (const handle of await page.locator('[data-case]').all()) {
            const key = await handle.getAttribute('data-case');
            shots[side].set(key, await handle.screenshot({ animations: 'allow' }));
        }
        await page.close();
    }
    for (const [key, refShot] of shots.ref) {
        const a = PNG.sync.read(refShot);
        const b = PNG.sync.read(shots.el.get(key));
        const same = a.width === b.width && a.height === b.height;
        let diff = -1;
        const safe = key.replace('/', '-');
        if (same) {
            const d = new PNG({ width: a.width, height: a.height });
            diff = pixelmatch(a.data, b.data, d.data, a.width, a.height, { threshold: 0.02 });
            if (diff > 0) writeFileSync(`${out}/diff-${theme}-${safe}.png`, PNG.sync.write(d));
        }
        writeFileSync(`${out}/${theme}-${safe}-ref.png`, refShot);
        writeFileSync(`${out}/${theme}-${safe}-el.png`, shots.el.get(key));
        compared++;
        if (diff !== 0) {
            failures++;
            report.push(`${theme.padEnd(5)} ${key.padEnd(24)} ${same ? `${diff} px differ` : `SIZE ${a.width / 2}x${a.height / 2} vs ${b.width / 2}x${b.height / 2}`}`);
        }
    }
}
await browser.close();
console.log(`${compared} comparisons, ${failures} differing`);
if (report.length) console.log(report.join('\n'));
process.exit(failures === 0 ? 0 : 1);

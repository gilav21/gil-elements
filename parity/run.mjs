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
        .flatMap((c) => c.items.map((i) => ({ key: `${c.name}/${i.id}`, html: i[side], wrap: i.wrap ?? '', at: i.at, focus: i.focus?.[side] })))
        .map((i) => `<div data-case="${i.key}" ${i.at ? `data-at="${i.at}"` : ''} ${i.focus ? `data-focus="${i.focus}"` : ''} style="padding:12px;${i.wrap}">${i.html}</div>`)
        .join('\n');
const shell = (theme, body, extraCss) =>
    `<!doctype html><html class="${theme}"><head><style>${tokens}${extraCss}
     /* The two parts of Tailwind's preflight that change layout; applied to both pages so only the components differ. */
     *,*::before,*::after{box-sizing:border-box} html{line-height:1.5}
     @layer base{h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit} h1,h2,h3,h4,h5,h6,p{margin:0}}
     body{margin:0;padding:16px;background:var(--background);color:var(--foreground);font-family:system-ui,sans-serif}
     [data-case]{display:block;width:max-content;max-width:100%;isolation:isolate;will-change:transform}
     /* ^ each case gets its own compositing layer, so antialiasing does not depend on what is stacked above it */
     </style></head><body>${body}</body></html>`;

// Where the differing pixels sit (CSS px), so a failure from a machine you cannot screenshot is still locatable.
const boundsOfDiff = (d) => {
    let [x0, y0, x1, y1] = [d.width, d.height, -1, -1];
    for (let y = 0; y < d.height; y++) {
        for (let x = 0; x < d.width; x++) {
            const i = (y * d.width + x) * 4;
            const marked = d.data[i] === 255 && d.data[i + 1] === 0 && d.data[i + 2] === 0;
            if (!marked) continue;
            [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
        }
    }
    return `at x ${x0 / 2}-${x1 / 2}, y ${y0 / 2}-${y1 / 2}`;
};

// How far apart the differing pixels are: tiny deltas mean antialiasing, large ones mean different glyphs or colours.
const deltaStats = (a, b) => {
    let max = 0;
    let count = 0;
    let sum = 0;
    for (let i = 0; i < a.data.length; i += 4) {
        const delta = Math.max(...[0, 1, 2].map((c) => Math.abs(a.data[i + c] - b.data[i + c])));
        if (delta === 0) continue;
        count++;
        sum += delta;
        max = Math.max(max, delta);
    }
    return `pixels ${count}, max channel delta ${max}, mean ${(sum / Math.max(count, 1)).toFixed(1)}`;
};

const browser = await chromium.launch();
let failures = 0;
let compared = 0;
const report = [];
for (const theme of ['light', 'dark']) {
    const shots = {};
    const rects = {};
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
        // Images (shadow trees included) must be decoded, and the elements that react to them settled, before the shot.
        await page.evaluate(async () => {
            const images = [];
            const walk = (root) => {
                for (const el of root.querySelectorAll('*')) {
                    if (el instanceof HTMLImageElement) images.push(el);
                    if (el.shadowRoot) walk(el.shadowRoot);
                }
            };
            walk(document);
            await Promise.all(images.map((img) => img.decode().catch(() => undefined)));
            await new Promise((resolve) => setTimeout(resolve, 50));
            await Promise.all([...document.querySelectorAll('*')].filter((e) => e.updateComplete).map((e) => e.updateComplete));
        });
        await page.evaluate(() => document.fonts.ready);
        // `transition: all` runs whenever a style settles after first paint (Lit renders asynchronously, so the
        // shadow button is restyled after the host is). A slow machine can still be mid-fade at screenshot time,
        // which paints the label in an in-between colour; let every transition run out before freezing.
        await page.evaluate(
            () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 400)))),
        );
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
        rects[side] = await page.evaluate(() => {
            // The flat-tree parent of each case's first label text: its whole computed style, so a failure on a machine
            // we cannot screenshot can be explained by which property differs between the two sides.
            const found = {};
            const firstText = (root) => {
                for (const el of root.querySelectorAll('*')) {
                    for (const node of el.childNodes) {
                        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() && /button/i.test((node.assignedSlot?.parentElement ?? node.parentElement).localName)) return node;
                    }
                    const inner = el.shadowRoot && firstText(el.shadowRoot);
                    if (inner) return inner;
                }
                return undefined;
            };
            for (const c of document.querySelectorAll('[data-case]')) {
                const node = firstText(c);
                if (!node) continue;
                const cs = getComputedStyle(node.assignedSlot?.parentElement ?? node.parentElement);
                found[c.dataset.case] = Object.fromEntries([...cs].map((name) => [name, cs.getPropertyValue(name)]));
            }
            return found;
        });
        shots[side] = new Map();
        for (const handle of await page.locator('[data-case]').all()) {
            const key = await handle.getAttribute('data-case');
            // A focused control paints its focus ring; focus it just before the shot, one case at a time.
            const focus = await handle.getAttribute('data-focus');
            if (focus) {
                await handle.locator(focus).first().focus();
                // Focus starts the ring and floating-label transitions; the reference page has nothing left to animate.
                await page.waitForTimeout(400);
            }
            shots[side].set(key, await handle.screenshot({ animations: 'allow' }));
        }
        await page.close();
    }
    for (const [key, refShot] of shots.ref) {
        const a = PNG.sync.read(refShot);
        const b = PNG.sync.read(shots.el.get(key));
        const same = a.width === b.width && a.height === b.height;
        let diff = -1;
        let where = '';
        const safe = key.replace('/', '-');
        if (same) {
            const d = new PNG({ width: a.width, height: a.height });
            diff = pixelmatch(a.data, b.data, d.data, a.width, a.height, { threshold: 0.02 });
            if (diff > 0) writeFileSync(`${out}/diff-${theme}-${safe}.png`, PNG.sync.write(d));
            if (diff > 0) where = boundsOfDiff(d);
            if (diff > 0 && process.env.PARITY_DEBUG) console.log(`${theme} ${key} ${deltaStats(a, b)}`);
        }
        writeFileSync(`${out}/${theme}-${safe}-ref.png`, refShot);
        writeFileSync(`${out}/${theme}-${safe}-el.png`, shots.el.get(key));
        compared++;
        if (diff !== 0) {
            failures++;
            if (process.env.PARITY_DEBUG && rects.ref[key] && rects.el[key]) {
                const names = Object.keys(rects.ref[key]).filter((n) => rects.ref[key][n] !== rects.el[key][n]);
                console.log(`${theme} ${key} style differences: ${names.map((n) => `${n}: ${rects.ref[key][n]} | ${rects.el[key][n]}`).join('; ') || 'none'}`);
            }
            report.push(`${theme.padEnd(5)} ${key.padEnd(24)} ${same ? `${diff} px differ ${where}` : `SIZE ${a.width / 2}x${a.height / 2} vs ${b.width / 2}x${b.height / 2}`}`);
        }
    }
}
await browser.close();
console.log(`${compared} comparisons, ${failures} differing`);
if (report.length) console.log(report.join('\n'));
process.exit(failures === 0 ? 0 : 1);

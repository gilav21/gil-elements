// Visual parity for the badge: shadcn-angular's real Tailwind output vs <ge-badge>, per variant,
// in light and dark, compared pixel by pixel. Run: node parity/badge.mjs
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = `${here}out`;
mkdirSync(out, { recursive: true });

execFileSync('npx', ['tailwindcss', '-i', `${here}reference.css`, '-o', `${out}/reference.out.css`], { stdio: 'inherit' });
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
const variants = ['default', 'secondary', 'destructive', 'outline'];
const shell = (theme, body, extra) =>
    `<!doctype html><html class="${theme}"><head><style>${tokens}${extra}
     body{margin:0;padding:24px;background:var(--background);font-family:system-ui,sans-serif}
     </style></head><body>${body}</body></html>`;

const referenceBody = variants
    .map((v) => `<div style="margin-bottom:16px"><ui-badge data-slot="badge" class="${classFor(v)}">Status</ui-badge></div>`)
    .join('');
function classFor(variant) {
    const html = readFileSync(`${here}badge-reference.html`, 'utf8');
    return new RegExp(`data-variant="${variant}"\\s+class="([^"]+)"`).exec(html)[1];
}
const elementsBody = variants
    .map((v) => `<div style="margin-bottom:16px"><ge-badge variant="${v}" label="Status"></ge-badge></div>`)
    .join('');

const browser = await chromium.launch();
let worst = 0;
const rows = [];
for (const theme of ['light', 'dark']) {
    const shots = {};
    for (const [name, html] of [
        ['reference', shell(theme, referenceBody, referenceCss)],
        ['elements', shell(theme, `${elementsBody}<script>${bundle}</script>`, '')],
    ]) {
        const page = await browser.newPage({ deviceScaleFactor: 2 });
        await page.setContent(html);
        if (name === 'elements') await page.evaluate(async () => { await Promise.race([customElements.whenDefined('ge-badge'), new Promise((_, r) => setTimeout(() => r(new Error('ge-badge never defined')), 5000))]); await Promise.all([...document.querySelectorAll('ge-badge')].map((e) => e.updateComplete)); });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(200);
        const selector = name === 'reference' ? 'ui-badge' : 'ge-badge';
        shots[name] = [];
        for (const handle of await page.locator(selector).all()) shots[name].push(await handle.screenshot());
        await page.close();
    }
    variants.forEach((variant, i) => {
        const a = PNG.sync.read(shots.reference[i]);
        const b = PNG.sync.read(shots.elements[i]);
        const sameSize = a.width === b.width && a.height === b.height;
        let diff = -1;
        if (sameSize) {
            const d = new PNG({ width: a.width, height: a.height });
            diff = pixelmatch(a.data, b.data, d.data, a.width, a.height, { threshold: 0.1 });
            if (diff > 0) writeFileSync(`${out}/diff-${theme}-${variant}.png`, PNG.sync.write(d));
        }
        writeFileSync(`${out}/${theme}-${variant}-reference.png`, shots.reference[i]);
        writeFileSync(`${out}/${theme}-${variant}-elements.png`, shots.elements[i]);
        worst = Math.max(worst, diff < 0 ? Infinity : diff);
        rows.push(`${theme.padEnd(5)} ${variant.padEnd(12)} ${sameSize ? `${a.width}x${a.height}px` : `SIZE ${a.width}x${a.height} vs ${b.width}x${b.height}`}  differing pixels: ${diff}`);
    });
}
await browser.close();
console.log(rows.join('\n'));
process.exit(worst === 0 ? 0 : 1);

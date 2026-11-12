// Visual parity: shadcn-angular's real Tailwind output vs the elements, per case item, in light and
// dark, compared pixel by pixel. Usage: node parity/run.mjs [caseName ...]
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = `${here}out`;
// Only failing cases write images, so anything left from an earlier run would read as a failure that still stands.
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const wanted = process.argv.slice(2);
const cases = [];
for (const file of readdirSync(`${here}cases`).sort()) {
    const mod = (await import(pathToFileURL(`${here}cases/${file}`).href)).default;
    if (wanted.length === 0 || wanted.includes(mod.name)) cases.push(mod);
}
// An item may loosen the per-pixel colour threshold (default 0.02) with a reason, for antialiasing a different engine rounds differently.
// It may also allow a few differing pixels (`maxDiffPx`, with a reason), for one glyph a different engine places at another sub-pixel offset.
const maxDiffPxOf = new Map(cases.flatMap((c) => c.items.filter((i) => i.maxDiffPx !== undefined).map((i) => [`${c.name}/${i.id}`, i.maxDiffPx])));
const thresholdOf = new Map(cases.flatMap((c) => c.items.filter((i) => i.threshold !== undefined).map((i) => [`${c.name}/${i.id}`, i.threshold])));

// Tailwind only emits classes it finds in source, so write every reference snippet to one file first.
// PARITY_TW_ALL / PARITY_TW_SKIP: build the reference CSS from every case (minus the named ones) while comparing only the wanted cases,
// to tell a component that differs on its own from a reference stylesheet that depends on which other cases exist.
let sourceCases = cases;
if (process.env.PARITY_TW_ALL) {
    const skip = (process.env.PARITY_TW_SKIP ?? '').split(',');
    sourceCases = [];
    for (const file of readdirSync(`${here}cases`).sort()) {
        const mod = (await import(pathToFileURL(`${here}cases/${file}`).href)).default;
        if (!skip.includes(mod.name)) sourceCases.push(mod);
    }
}
writeFileSync(`${out}/reference-source.html`, sourceCases.flatMap((c) => c.items.map((i) => i.ref)).join('\n'));
execFileSync(process.execPath, [fileURLToPath(new URL('../node_modules/@tailwindcss/cli/dist/index.mjs', import.meta.url)), '-i', `${here}reference.css`, '-o', `${out}/reference.out.css`], { stdio: 'ignore' });
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
        .flatMap((c) => c.items.map((i) => ({ key: `${c.name}/${i.id}`, html: i[side], wrap: i.wrap ?? '', at: i.at, focus: i.focus?.[side], show: side === 'el' ? i.show : undefined, scroll: i.scroll })))
        .map((i) => `<div data-case="${i.key}" ${i.at ? `data-at="${i.at}"` : ''} ${i.focus ? `data-focus="${i.focus}"` : ''} ${i.show ? `data-show="${i.show}"` : ''} ${i.scroll ? 'data-scroll' : ''} style="padding:12px;${i.wrap}">${i.html}</div>`)
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

// What the fixed sleeps stood in for: the frame after an action (a scroll event, a focus), then every running finite
// animation or transition in the document and in every shadow root, until none is left. Frozen (paused) animations are
// not waited on, they never finish. Capped, so a page that never settles still gets its screenshot and a warning.
const SETTLE_CAP_MS = 3000;
const settle = async (page, why) => {
    const settled = await page.evaluate(async (cap) => {
        const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
        const roots = (root) => [root, ...[...root.querySelectorAll('*')].flatMap((el) => (el.shadowRoot ? roots(el.shadowRoot) : []))];
        const running = () =>
            roots(document)
                .flatMap((root) => root.getAnimations())
                .filter((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity);
        const until = performance.now() + cap;
        for (;;) {
            await frame();
            await frame();
            const pending = running();
            if (pending.length === 0) return true;
            if (performance.now() > until) return false;
            await Promise.race([Promise.all(pending.map((a) => a.finished.catch(() => {}))), new Promise((resolve) => setTimeout(resolve, cap))]);
        }
    }, SETTLE_CAP_MS);
    if (!settled) console.warn(`parity: still animating ${SETTLE_CAP_MS} ms after ${why}`);
};

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

// Jobs (one page of one theme and side) are independent, so they run on a pool of Chromium processes: separate processes, not
// contexts, so one worker's rasterisation cannot touch another's. PARITY_WORKERS=1 gives the old serial run.
const WORKERS = Math.max(1, Number(process.env.PARITY_WORKERS) || Math.min(12, availableParallelism() - 2));
const browsers = await Promise.all(Array.from({ length: WORKERS }, () => chromium.launch()));
let failures = 0;
let compared = 0;
const report = [];
// A case file marked `isolated` gets a page of its own: opening a menu moves focus into it, which scrolls the shared
// page, and every other case that measures itself on open would then measure at the wrong scroll position.
// The shared pages are also capped in size: past a few thousand pixels of height the same markup rasterises differently
// (a full run differed in text on whole components that pass alone, and a half run in the one that sits deepest), so
// cases are packed into pages of at most `PAGE_ITEMS` items.
const PAGE_ITEMS = 80;
const shared = [];
for (const c of cases.filter((c) => !c.isolated)) {
    const last = shared.at(-1);
    if (last && last.items + c.items.length <= PAGE_ITEMS) {
        last.cases.push(c);
        last.items += c.items.length;
    } else shared.push({ cases: [c], items: c.items.length });
}
const groups = [...shared.map((g) => g.cases), ...cases.filter((c) => c.isolated).map((c) => [c])].filter((g) => g.length > 0);

const THEMES = ['light', 'dark'];
const state = Object.fromEntries(THEMES.map((theme) => [theme, { shots: { ref: new Map(), el: new Map() }, rects: { ref: {}, el: {} } }]));

// The reference side only changes when the Angular class strings, the reference CSS or this runner do, and it is half of
// all the screenshots, so a page of it is kept on disk under a hash of everything it is rendered from.
// PARITY_NO_CACHE=1 skips it (PARITY_DEBUG too, which needs the live style dumps).
const runnerSource = readFileSync(fileURLToPath(import.meta.url));
const cacheRoot = `${here}.cache/ref`;
const useCache = !process.env.PARITY_NO_CACHE && !process.env.PARITY_DEBUG;
const usedCache = new Set();
const refCacheDir = (browser, theme, group) =>
    `${cacheRoot}/${createHash('sha256').update(JSON.stringify([browser.version(), process.platform, runnerSource.toString(), theme, group[0].width ?? 700, rows(group, 'ref'), referenceCss, tokens])).digest('hex').slice(0, 24)}`;

function readCachedRefs(dir, shots) {
    if (!existsSync(`${dir}/index.json`)) return null;
    const keys = JSON.parse(readFileSync(`${dir}/index.json`, 'utf8'));
    for (const key of keys) shots.set(key, readFileSync(`${dir}/${encodeURIComponent(key)}.png`));
    return keys;
}

function writeCachedRefs(dir, shots, keys) {
    mkdirSync(dir, { recursive: true });
    for (const key of keys) writeFileSync(`${dir}/${encodeURIComponent(key)}.png`, shots.get(key));
    // The index goes last: a run killed half way leaves a directory that reads as a miss.
    writeFileSync(`${dir}/index.json`, JSON.stringify(keys));
}

async function renderJob(browser, theme, group, side) {
    const { shots, rects } = state[theme];
    const cacheDir = side === 'ref' && useCache ? refCacheDir(browser, theme, group) : null;
    if (cacheDir) usedCache.add(cacheDir);
    const cached = cacheDir && readCachedRefs(cacheDir, shots.ref);
    if (cached) return cached;
    const mine = [];
    const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: group[0].width ?? 700, height: 900 } });
    try {
        // Every case sits on one tall page, below the 900px viewport, where collision handling would flip the panels. The
        // viewport height the elements read is raised so the case's own `overflow: hidden` wrapper is the box they stay in.
        const unbounded = `<script>Object.defineProperty(window, 'innerHeight', { get: () => 100000 });</script>`;
        const body = rows(group, side) + (side === 'el' ? `${unbounded}<script>${bundle}</script>` : '');
        await page.setContent(shell(theme, body, side === 'ref' ? referenceCss : ''));
        if (side === 'el') {
            await page.evaluate(async () => {
                const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('elements never defined')), 5000));
                const tags = [...new Set([...document.querySelectorAll('*')].map((e) => e.localName).filter((n) => n.startsWith('ge-')))];
                await Promise.race([Promise.all(tags.map((t) => customElements.whenDefined(t))), timeout]);
                await Promise.all([...document.querySelectorAll('*')].filter((e) => e.updateComplete).map((e) => e.updateComplete));
                // `data-click` marks a menubar trigger the reference shows opened; opened through the menu, since a click would close the bars of the other cases as an outside click.
                for (const target of document.querySelectorAll('[data-click]')) target.closest('ge-menubar-menu').show();
                await Promise.all([...document.querySelectorAll('*')].filter((e) => e.updateComplete).map((e) => e.updateComplete));
                // `data-date` and `data-range` set the value of a date picker and a range picker the way a script would.
                for (const picker of document.querySelectorAll('ge-date-picker[data-date]')) {
                    picker.date = new Date(picker.dataset.date);
                    await picker.updateComplete;
                }
                for (const picker of document.querySelectorAll('ge-date-range-picker[data-range]')) {
                    const raw = JSON.parse(picker.dataset.range);
                    picker.range = { start: raw.start ? new Date(raw.start + 'T00:00') : null, end: raw.end ? new Date(raw.end + 'T00:00') : null };
                    await picker.updateComplete;
                }
                // `data-selected` is the JSON `selected` of a calendar; ISO strings become local dates, the way the markup attribute would.
                for (const cal of document.querySelectorAll('ge-calendar[data-selected]')) {
                    const local = (v) => (typeof v === 'string' ? (v.length === 10 ? new Date(v + 'T00:00') : new Date(v)) : v);
                    const raw = JSON.parse(cal.dataset.selected);
                    cal.selected = Array.isArray(raw) ? raw.map(local) : { start: local(raw.start), end: local(raw.end) };
                    await cal.updateComplete;
                }
                // `data-items` is the JSON `items` of a data-driven data list.
                for (const list of document.querySelectorAll('ge-data-list[data-items]')) {
                    list.items = JSON.parse(list.dataset.items);
                    await list.updateComplete;
                }
                // `data-items` is the JSON `items` of a data-driven split button.
                for (const split of document.querySelectorAll('ge-split-button[data-items]')) {
                    split.items = JSON.parse(split.dataset.items);
                    await split.updateComplete;
                }
                // `data-items` is the JSON `items` of a data-driven navigation menu; `data-open-index` opens that entry's trigger.
                for (const menu of document.querySelectorAll('ge-navigation-menu[data-items]')) {
                    menu.items = JSON.parse(menu.dataset.items);
                    await menu.updateComplete;
                    if (menu.dataset.openIndex) menu.shadowRoot.querySelectorAll('ge-navigation-menu-trigger')[Number(menu.dataset.openIndex)].shadowRoot.querySelector('button').click();
                }
                // `data-value` is the JSON selection of an autocomplete (an option, or an array with `multiple`).
                for (const target of document.querySelectorAll('ge-autocomplete[data-value]')) target.value = JSON.parse(target.dataset.value);
                // `data-chips` and `data-colors` are the JSON chips and per-chip colours of a chip list.
                for (const target of document.querySelectorAll('ge-chip-list[data-chips]')) {
                    target.value = JSON.parse(target.dataset.chips);
                    if (target.dataset.colors) target.chipColors = JSON.parse(target.dataset.colors);
                }
                // `data-highlight` marks the command row the reference shows highlighted; `data-search` is the query the field holds.
                for (const row of document.querySelectorAll('[data-highlight]')) row.closest('ge-command').setActive(row);
                // `data-options` is the JSON list of a select built from `options`; `data-disabled-options` lists the entries that are disabled.
                for (const target of document.querySelectorAll('[data-options]')) {
                    target.options = JSON.parse(target.dataset.options);
                    const off = JSON.parse(target.dataset.disabledOptions ?? '[]');
                    target.disabledWith = (option) => off.includes(option);
                }
                await Promise.all([...document.querySelectorAll('*')].filter((e) => e.updateComplete).map((e) => e.updateComplete));
                for (const target of document.querySelectorAll('ge-select[data-options][data-open]')) target.show();
                // `data-open` marks a select the reference shows open.
                for (const target of document.querySelectorAll('[data-open]:not([data-options])')) target.closest('ge-select').show();
                await Promise.all([...document.querySelectorAll('*')].filter((e) => e.updateComplete).map((e) => e.updateComplete));
                // `data-fallback` gives an eyedropper something to sample, since the headless browser has no native picker.
                for (const target of document.querySelectorAll('ge-eyedropper[data-fallback]')) target.fallbackTarget = document.createElement('canvas');
                // `data-fallback` on a colour picker gives its eyedropper something to sample; `data-recents` and `data-extracted` are the JSON recents and image palette it shows.
                for (const target of document.querySelectorAll('ge-color-picker[data-fallback]')) target.fallbackTarget = document.createElement('canvas');
                for (const target of document.querySelectorAll('ge-color-picker[data-recents]')) target.recentColors = JSON.parse(target.dataset.recents);
                for (const target of document.querySelectorAll('ge-color-picker[data-extracted]')) target.extractedPalette = JSON.parse(target.dataset.extracted);
                // `data-copied` shows a code block just after a copy; `data-theme-json` is its `theme`.
                for (const target of document.querySelectorAll('ge-code-block[data-copied]')) target.copied = true;
                for (const target of document.querySelectorAll('ge-code-block[data-theme-json]')) target.theme = JSON.parse(target.dataset.themeJson);
                // `data-opened` shows a speed dial open; its items animate out, so wait for them to land.
                for (const target of document.querySelectorAll('ge-speed-dial[data-opened]')) target.show();
                await Promise.all([...document.querySelectorAll('ge-speed-dial[data-opened]')].map((t) => t.updateComplete));
                // `data-edit` is `rowIndex,columnKey` of a ge-data-table: that cell's editor is opened, as a double click would. The hook THROWS (with the case id) when the editor does not open: at joint step 0 `startEditing` is inert and always answers false, so NO parity case may use `data-edit` before wave 5 B makes editing real.
                // `data-edit-error` is a message: the column then refuses every value with it and the edited draft is committed, so the editor shows its error state.
                // It runs BEFORE the animation wait below, so a transition the open editor starts is awaited too; the table gets its `data-props` first, there, and the generic `data-props` loop skips it.
                // An open editor takes DOM focus after its render, and an editor that loses it to the NEXT case's editor commits and closes: while the
                // editors open, `focus()` does nothing, so every editor of the page stays open and none is focused (as Angular's static render shows them).
                const editing = document.querySelectorAll('ge-data-table[data-edit]');
                const realFocus = HTMLElement.prototype.focus;
                // The tables whose editor has made its own focus attempt (the stub records it, from inside a shadow root too), so the real `focus()`
                // is put back only once every editor has tried: no late focus can land after it and commit an editor.
                const tried = new Set();
                const tableOf = (node) => {
                    for (let at = node; at; at = at.parentNode ?? at.host ?? null) if (at.matches?.('ge-data-table[data-edit]')) return at;
                    return null;
                };
                if (editing.length > 0)
                    HTMLElement.prototype.focus = function () {
                        const table = tableOf(this);
                        if (table) tried.add(table);
                    };
                try {
                for (const target of editing) {
                    if (target.dataset.props) Object.assign(target, JSON.parse(target.dataset.props));
                    await target.updateComplete;
                    const comma = target.dataset.edit.indexOf(','); // the row index has no comma, a column key may
                    if (comma === -1) throw new Error(`data-edit="${target.dataset.edit}" needs "rowIndex,columnKey" (case ${target.closest('[data-case]')?.dataset.case ?? 'unknown'})`);
                    const rowIndex = target.dataset.edit.slice(0, comma);
                    const columnKey = target.dataset.edit.slice(comma + 1);
                    const message = target.dataset.editError;
                    if (message !== undefined) {
                        target.columns = target.columns.map((c) => (String(c.accessorKey) === columnKey ? { ...c, editValidator: () => message } : c));
                        await target.updateComplete;
                    }
                    const row = target.provider('query').renderedRowAt(Number(rowIndex));
                    const where = `data-edit="${target.dataset.edit}" (case ${target.closest('[data-case]')?.dataset.case ?? 'unknown'})`;
                    if (row === undefined) throw new Error(`${where}: there is no row ${rowIndex}`);
                    if (!target.startEditing(row, columnKey)) throw new Error(`${where}: the editor did not open (is the column editable?)`);
                    await target.updateComplete;
                    if (message !== undefined) {
                        target.provider('interaction').setEditValue(String.fromCharCode(0x200b)); // a zero-width space: a value no validator of the case accepts, invisible if it were ever drawn
                        target.commitEdit();
                        await target.updateComplete;
                    }
                }
                // The editors focus after their render (a date editor once its lazy picker is defined): wait until each has tried, capped at 120 frames
                // (deterministic: the cap is only reached when an editor never focuses, and the frames are counted, not timed).
                for (let frame = 0; editing.length > 0 && tried.size < editing.length && frame < 120; frame++) await new Promise((resolve) => requestAnimationFrame(resolve));
                } finally {
                    HTMLElement.prototype.focus = realFocus;
                }
                // An infinite animation (a spinner, a marquee) never finishes, so waiting on it would hang the run.
                await Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished));
                // `data-items` is the JSON `items` of a simple-mode dock; an entry with `button` gets a click handler, which makes it a button.
                for (const target of document.querySelectorAll('ge-dock[data-items]')) target.items = JSON.parse(target.dataset.items).map((item) => (item.button ? { ...item, onClick: () => {} } : item));
                // `data-shortcuts` is the JSON list `[{ component, actions: [{ actionId, description, defaultShortcut, category }] }]` a
                // shortcut-bindings dialog finds registered; an entry with `definition` only declares it, with no live instance.
                for (const target of document.querySelectorAll('[data-shortcuts]')) {
                    for (const { component, definition, actions } of JSON.parse(target.dataset.shortcuts)) {
                        if (definition) globalThis.geShortcutBindings.defineShortcuts(component, actions);
                        else globalThis.geShortcutBindings.registerComponent(component, actions.map((action) => ({ ...action, handler: () => {} })));
                    }
                }
                // `data-props` is a JSON object assigned to the element's properties, for the ones an attribute cannot carry.
                // A ge-data-table with `data-edit` got its props in the data-edit block above (its columns carry the validator that block added): not again here.
                for (const target of document.querySelectorAll('[data-props]:not(ge-data-table[data-edit])')) Object.assign(target, JSON.parse(target.dataset.props));
                // `data-file` is JSON `{name, base64}`: a file-viewer is given that file and the run waits for it to load or fail.
                for (const target of document.querySelectorAll('ge-file-viewer[data-file]')) {
                    const { name, base64 } = JSON.parse(target.dataset.file);
                    const done = new Promise((resolve) => {
                        target.addEventListener('loaded', resolve, { once: true });
                        target.addEventListener('load-error', resolve, { once: true });
                    });
                    target.file = new File([Uint8Array.from(atob(base64), (c) => c.codePointAt(0))], name);
                    await done;
                    await target.updateComplete;
                }
                // `data-link-tones` maps `startId>endId` to a tone for a field-mapper's `linkTone`, a function `data-props` cannot carry.
                for (const target of document.querySelectorAll('[data-link-tones]')) {
                    const tones = JSON.parse(target.dataset.linkTones);
                    target.linkTone = (link) => tones[`${link.startId}>${link.endId}`] ?? 'default';
                }
                // `data-render` names a row renderer for a virtual-scroll: functions cannot travel in `data-props`.
                const cell = (style, text) => Object.assign(document.createElement('div'), { textContent: text, style });
                const renderers = {
                    rows: (item) => cell('height:50px;box-sizing:border-box;display:flex;align-items:center;padding-inline:.75rem;border-bottom:1px solid var(--border)', `Row ${item.id}`),
                    cells: (item) => cell('height:100%;width:100px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;border-right:1px solid var(--border)', item.id),
                    grid: (item) => cell('height:40px;width:80px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;border:1px solid var(--border)', item.id),
                };
                for (const target of document.querySelectorAll('[data-render]')) target.renderItem = renderers[target.dataset.render];
                // `data-goto` is a step index: the tour, already running, jumps there.
                for (const target of document.querySelectorAll('[data-goto]')) {
                    await target.updateComplete;
                    target.goTo(Number(target.dataset.goto));
                }
                // `data-click-at` is `x,y;x,y` from an element's top-left: a pointer click lands at each, which is how a ripple starts.
                // `data-move-at` is `x,y` the same way: a mousemove, which is how a magnetic element is pulled.
                for (const target of document.querySelectorAll('[data-click-at], [data-move-at]')) {
                    await target.updateComplete;
                    const rect = target.getBoundingClientRect();
                    for (const point of (target.dataset.clickAt ?? '').split(';').filter(Boolean)) {
                        const [x, y] = point.split(',').map(Number);
                        target.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 1, clientX: rect.left + x, clientY: rect.top + y }));
                    }
                    if (target.dataset.moveAt) {
                        const [x, y] = target.dataset.moveAt.split(',').map(Number);
                        target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: rect.left + x, clientY: rect.top + y }));
                    }
                }
                // `data-hover-at` is `x,y` in a chart's user space: the pointer moves there, so the crosshair and tooltip show as a hover would.
                for (const target of document.querySelectorAll('[data-hover-at]')) {
                    await target.updateComplete;
                    const el = target.shadowRoot.querySelector('svg');
                    // A synthetic event's clientX/clientY are whole numbers, while the chart reads the pointer against its own
                    // (fractional) rect. Where a case lands on the page depends on every case above it, so the chart is nudged onto
                    // whole pixels while the pointer lands, then put back: the chart keeps the position it read, in its own units.
                    const before = el.getBoundingClientRect();
                    const box = target.closest('[data-case]');
                    box.style.marginLeft = `${Math.ceil(before.left) - before.left}px`;
                    box.style.marginTop = `${Math.ceil(before.top) - before.top}px`;
                    const rect = el.getBoundingClientRect();
                    const [x, y] = target.dataset.hoverAt.split(',').map(Number);
                    const scale = rect.width / el.viewBox.baseVal.width;
                    el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: rect.left + x * scale, clientY: rect.top + y * scale }));
                    await target.updateComplete;
                    for (const part of target.shadowRoot.querySelectorAll('ge-chart-tooltip')) await part.updateComplete;
                    box.style.marginLeft = '';
                    box.style.marginTop = '';
                }
                // `data-hover-bar` is the index of the bar of a bar chart the reference shows hovered.
                for (const target of document.querySelectorAll('ge-bar-chart[data-hover-bar]')) {
                    await target.updateComplete;
                    target.shadowRoot.querySelectorAll('.bar')[Number(target.dataset.hoverBar)].dispatchEvent(new MouseEvent('mouseenter'));
                    await target.updateComplete;
                }
                // `data-hover-segment` is "category,series" of the stacked-bar segment the reference shows hovered.
                for (const target of document.querySelectorAll('ge-stacked-bar-chart[data-hover-segment]')) {
                    await target.updateComplete;
                    const [category, series] = target.dataset.hoverSegment.split(',').map(Number);
                    const index = category * target.series.length + series;
                    target.shadowRoot.querySelectorAll('.segment')[index].dispatchEvent(new MouseEvent('mouseenter'));
                    await target.updateComplete;
                }
                // `data-enter` is "selector,index": mouseenter fires on that part of the shadow tree, as a pointer arriving would.
                for (const target of document.querySelectorAll('[data-enter]')) {
                    await target.updateComplete;
                    const [selector, index] = target.dataset.enter.split(',');
                    const still = new CSSStyleSheet();
                    still.replaceSync('*{transition:none !important}');
                    target.shadowRoot.adoptedStyleSheets = [...target.shadowRoot.adoptedStyleSheets, still];
                    target.shadowRoot.querySelectorAll(selector)[Number(index)].dispatchEvent(new MouseEvent('mouseenter'));
                    await target.updateComplete;
                    for (const part of target.shadowRoot.querySelectorAll('ge-chart-tooltip')) await part.updateComplete;
                }
                // `data-hover-slice` is the index of the slice of a pie chart the reference shows hovered.
                for (const target of document.querySelectorAll('ge-pie-chart[data-hover-slice], ge-pie-chart-drilldown[data-hover-slice]')) {
                    await target.updateComplete;
                    // The reference is static, so the hover is applied without the transitions a real one would run.
                    const still = new CSSStyleSheet();
                    still.replaceSync('*{transition:none !important}');
                    target.shadowRoot.adoptedStyleSheets = [...target.shadowRoot.adoptedStyleSheets, still];
                    target.shadowRoot.querySelectorAll('.slice')[Number(target.dataset.hoverSlice)].dispatchEvent(new MouseEvent('mouseenter'));
                    await target.updateComplete;
                    await Promise.all(target.shadowRoot.getAnimations({ subtree: true }).filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished));
                }
                // A kanban board takes its `columns` and `cards` as JSON; `data-dragged` is the id of the card shown mid-drag, `data-swimlane-by` the lane property.
                for (const target of document.querySelectorAll('ge-kanban[data-columns]')) {
                    target.columns = JSON.parse(target.dataset.columns);
                    target.cards = JSON.parse(target.dataset.cards ?? '[]');
                    if (target.dataset.dragged) target.draggedCardId = target.dataset.dragged;
                    if (target.dataset.collapsedLanes) target.initiallyCollapsedSwimlanes = JSON.parse(target.dataset.collapsedLanes);
                }
                // `data-column-states` is JSON `{columnId: {collapsed, collapsible, dragOver}}`, applied to the board's own columns once they have rendered.
                for (const target of document.querySelectorAll('ge-kanban[data-column-states]')) {
                    await target.updateComplete;
                    for (const [id, state] of Object.entries(JSON.parse(target.dataset.columnStates))) {
                        const column = target.shadowRoot.querySelector(`ge-kanban-column[column-id="${id}"]`);
                        if (state.collapsed) column.collapsed = true;
                        if (state.collapsible === false) column.collapsible = false;
                        if (state.dragOver) {
                            column.isDragOver = true;
                            column.dropIndicatorIndex = 0;
                            column.dropIndicatorTop = 6;
                        }
                    }
                }
                // On a kanban column, `data-collapsed` collapses it and `data-drag-over` shows it as a drop target with the line at the first gap.
                for (const target of document.querySelectorAll('ge-kanban-column')) {
                    if (target.hasAttribute('data-collapsed')) target.collapsed = true;
                    if (target.hasAttribute('data-drag-over-hook')) {
                        target.isDragOver = true;
                        target.dropIndicatorIndex = 0;
                        target.dropIndicatorTop = 6;
                    }
                }
                // `data-lift` on a sortable item lifts it with the keyboard, the way Space does.
                for (const target of document.querySelectorAll('ge-sortable-item[data-lift]')) target.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
                // `data-picking` on an eyedropper shows it mid-pick, the way a pick in progress would.
                for (const target of document.querySelectorAll('ge-eyedropper[data-picking]')) target.picking = true;
                // `data-collapsed` on a sidebar provider shows the desktop rail collapsed, the way a remembered flag would.
                for (const target of document.querySelectorAll('ge-sidebar-provider[data-collapsed]')) target.isCollapsed = true;
                // `data-nodes` is also the JSON `nodes` of a tree select.
                for (const target of document.querySelectorAll('ge-tree-select[data-nodes]')) target.nodes = JSON.parse(target.dataset.nodes);
                // `data-state` is the JSON `{expand, select, focus}` a tree shows, and `data-nodes` the JSON `data` of a data-driven tree (with `data-depth` as its initial-expand-depth).
                for (const target of document.querySelectorAll('ge-tree[data-nodes]')) {
                    target.data = JSON.parse(target.dataset.nodes);
                    if (target.dataset.depth) target.initialExpandDepth = Number(target.dataset.depth);
                }
                await Promise.all([...document.querySelectorAll('ge-tree')].map((t) => t.updateComplete));
                for (const target of document.querySelectorAll('ge-tree[data-state]')) {
                    const { expand = [], select = [], focus = null } = JSON.parse(target.dataset.state);
                    target.expandedKeys = new Set(expand);
                    target.selectedKeys = new Set(select);
                    target.focusedKey = focus;
                }
                // `data-files` is the JSON list a file upload holds: {name, size, type, status, progress, error, image}; `image` gives the file the picture in `data-image`.
                // `data-dragging` shows the dropzone as a drop target.
                for (const target of document.querySelectorAll('ge-file-upload[data-files]')) {
                    const bytes = Uint8Array.from(atob(target.dataset.image.split(',')[1]), (c) => c.charCodeAt(0));
                    const specs = JSON.parse(target.dataset.files);
                    const made = specs.map((s) => (s.image ? new File([bytes], s.name, { type: 'image/png' }) : new File([new Uint8Array(s.size)], s.name, { type: s.type ?? '' })));
                    target.addFiles(made);
                    target.files.forEach((item, i) => {
                        const s = specs[i];
                        if (s?.progress !== undefined) target.updateFileProgress(item.id, s.progress);
                        if (s?.error) target.setFileError(item.id, s.error);
                    });
                    await target.updateComplete;
                }
                for (const target of document.querySelectorAll('ge-file-upload[data-dragging]')) target.isDragging = true;
                // `data-hover` marks an element the reference shows hovered (a submenu that hover opened).
                for (const target of document.querySelectorAll('[data-hover]')) target.dispatchEvent(new MouseEvent('mouseenter'));
                // Panels measure themselves in the first animation frame after they open, so the page must be at the top by then.
                // A menu that opens moves focus into itself, which scrolls the page to the last one.
                window.scrollTo(0, 0);
                await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            });
        }
        // Images (shadow trees included) must be decoded, and the elements that react to them settled, before the shot.
        await page.evaluate(async () => {
            // `data-scroll-end` marks a scroller the reference shows scrolled to its end (a carousel on its last slide).
            for (const target of document.querySelectorAll('[data-scroll-end]')) {
                target.style.scrollBehavior = 'auto';
                target.scrollLeft = getComputedStyle(target).direction === 'rtl' ? -target.scrollWidth : target.scrollWidth;
                target.scrollTop = target.scrollHeight;
            }
            // `data-scroll-left` is a distance in pixels along the inline axis: the scroller itself, or for a `ge-data-table` the viewport it renders.
            for (const target of document.querySelectorAll('[data-scroll-left]')) {
                const scroller = target.localName === 'ge-data-table' ? target.querySelector('[data-slot="data-table-viewport"]') : target;
                scroller.style.scrollBehavior = 'auto';
                scroller.scrollLeft = Number(target.dataset.scrollLeft) * (getComputedStyle(scroller).direction === 'rtl' ? -1 : 1);
            }
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
            // Opening a menu moves focus into it, and with every case on one page the last one would keep a focus ring.
            // Only menus: a hover card closes when its trigger loses focus.
            const top = document.activeElement;
            let active = document.activeElement;
            while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
            if (active?.closest('ge-dropdown-menu') || top?.closest('ge-command-dialog')) active.blur();
        });
        await page.evaluate(() => document.fonts.ready);
        // `transition: all` runs whenever a style settles after first paint (Lit renders asynchronously, so the
        // shadow button is restyled after the host is). A slow machine can still be mid-fade at screenshot time,
        // which paints the label in an in-between colour; let every transition run out before freezing.
        await page.evaluate(
            () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 400)))),
        );
        // A loaded CI runner can still have an element mid-render or mid-measure (a hover tooltip positions itself a frame
        // after it opens). Wait for every Lit element to finish its update, then give the frames that follow a second settle.
        await page.evaluate(async () => {
            const pending = [];
            const walk = (root) => {
                for (const el of root.querySelectorAll('*')) {
                    if (el.updateComplete) pending.push(el.updateComplete);
                    if (el.shadowRoot) walk(el.shadowRoot);
                }
            };
            walk(document);
            await Promise.all(pending);
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 200))));
        });
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
        // Cases stack on one tall page, so each one's top sits at the sum of the heights above it, usually fractional. Text on a
        // layer at a fractional offset is rasterised on a different subpixel grid, and which cases land on a whole pixel shifts
        // whenever any case above them changes height. Nudge every case onto a whole pixel, the same way on both sides.
        await page.evaluate(() => {
            for (const c of document.querySelectorAll('[data-case]')) {
                const top = c.getBoundingClientRect().top + scrollY;
                const fraction = top - Math.floor(top);
                if (fraction > 0.001) c.style.marginTop = `${1 - fraction}px`;
            }
        });
        Object.assign(rects[side], await page.evaluate(() => {
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
        }));
        for (const handle of await page.locator('[data-case]').all()) {
            const key = await handle.getAttribute('data-case');
            // A focused control paints its focus ring; focus it just before the shot, one case at a time.
            const focus = await handle.getAttribute('data-focus');
            if (process.env.PARITY_RECTS && key.includes(process.env.PARITY_RECTS_CASE ?? '')) console.log(side, key, await handle.locator(process.env.PARITY_RECTS).evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return `${e.localName}[${[b.left, b.top, b.width, b.height].map((n) => n.toFixed(1)).join(',')}]`; })));
            if (focus) {
                // :focus-visible depends on the page's last input modality, so cases that ran before would decide whether a
                // script focus paints a ring. A keypress and a fresh focus make the ring the same whatever ran earlier.
                await page.keyboard.press('Shift');
                await handle.locator(focus).first().evaluate((target) => target.blur());
                await handle.locator(focus).first().focus();
                // Focus starts the ring and floating-label transitions; the reference page has nothing left to animate.
                await settle(page, 'focus');
            }
            // A context menu opens at the pointer, in the top layer at viewport coordinates, so it is opened at an offset
            // inside the case once the case has been scrolled to the top of the viewport.
            // `scroll` brings the case to the top first and lets whatever follows the scroll (a tour's spotlight) settle.
            if ((await handle.getAttribute('data-scroll')) !== null) {
                await handle.evaluate((c) => c.scrollIntoView({ block: 'start', behavior: 'instant' }));
                await settle(page, 'scroll');
            }
            const show = await handle.getAttribute('data-show');
            if (show) {
                await handle.evaluate((c) => c.scrollIntoView({ block: 'start', behavior: 'instant' }));
                // The scroll event arrives a frame later, and a context menu closes on scroll.
                await settle(page, 'scroll before the menu');
                await handle.evaluate((c, at) => {
                    const rect = c.firstElementChild.getBoundingClientRect();
                    const [dx, dy] = at.split(',').map(Number);
                    // Offsets are from the padding edge, where an absolutely placed reference box measures them.
                    c.querySelector('ge-context-menu').show(rect.left + c.firstElementChild.clientLeft + dx, rect.top + c.firstElementChild.clientTop + dy);
                }, show);
                await settle(page, 'menu open');
                await handle.evaluate((c) => {
                    for (const target of c.querySelectorAll('[data-hover-on-show]')) target.dispatchEvent(new MouseEvent('mouseenter'));
                });
                await settle(page, 'menu hover');
            }
            shots[side].set(key, await handle.screenshot({ animations: 'allow' }));
            mine.push(key);
            if (show) await handle.evaluate((c) => c.querySelector('ge-context-menu').close());
        }
        if (cacheDir) writeCachedRefs(cacheDir, shots.ref, mine);
        return mine;
    } finally {
        await page.close();
    }
}

// Both sides of a page are compared as soon as the second is done, while the other workers keep rendering; the shots are
// dropped after, since a full run holds thousands of 2x PNGs.
function compareKeys(theme, keys) {
    const { shots, rects } = state[theme];
    for (const key of keys) {
        const refShot = shots.ref.get(key);
        if (!shots.el.has(key)) throw new Error(`no element screenshot for ${theme} ${key}`);
        const a = PNG.sync.read(refShot);
        const b = PNG.sync.read(shots.el.get(key));
        const same = a.width === b.width && a.height === b.height;
        let diff = -1;
        let where = '';
        const safe = key.replace('/', '-');
        if (same) {
            const d = new PNG({ width: a.width, height: a.height });
            diff = pixelmatch(a.data, b.data, d.data, a.width, a.height, { threshold: thresholdOf.get(key) ?? 0.02 });
            if (diff > 0 && diff <= (maxDiffPxOf.get(key) ?? 0)) diff = 0;
            if (diff > 0) writeFileSync(`${out}/diff-${theme}-${safe}.png`, PNG.sync.write(d));
            if (diff > 0) where = boundsOfDiff(d);
            if (diff > 0 && process.env.PARITY_DEBUG) console.log(`${theme} ${key} ${deltaStats(a, b)}`);
        }
        compared++;
        if (diff !== 0 || process.env.PARITY_KEEP) {
            writeFileSync(`${out}/${theme}-${safe}-ref.png`, refShot);
            writeFileSync(`${out}/${theme}-${safe}-el.png`, shots.el.get(key));
        }
        shots.ref.delete(key);
        shots.el.delete(key);
        delete rects.ref[key];
        delete rects.el[key];
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

const queue = THEMES.flatMap((theme) => groups.map((group) => ({ theme, group, left: 2, keys: [] })));
const work = queue.flatMap((page) => ['ref', 'el'].map((side) => ({ page, side })));
let next = 0;
let failed = false;
try {
    await Promise.all(browsers.map(async (browser) => {
        for (let job = work[next++]; job && !failed; job = work[next++]) {
            const { page, side } = job;
            try {
                const keys = await renderJob(browser, page.theme, page.group, side);
                if (side === 'ref') page.keys = keys;
                if (--page.left === 0) compareKeys(page.theme, page.keys);
            } catch (error) {
                failed = true;
                throw new Error(`${page.theme} ${side} page [${page.group.map((c) => c.name).join(', ')}]: ${error.message}`, { cause: error });
            }
        }
    }));
} finally {
    await Promise.all(browsers.map((browser) => browser.close()));
}
// A full run knows every page it needs; what else is cached belongs to an older runner or reference, and is dropped.
if (useCache && wanted.length === 0 && existsSync(cacheRoot)) {
    for (const name of readdirSync(cacheRoot)) if (!usedCache.has(`${cacheRoot}/${name}`)) rmSync(`${cacheRoot}/${name}`, { recursive: true, force: true });
}
console.log(`${compared} comparisons, ${failures} differing`);
if (report.length) console.log(report.sort((a, b) => THEMES.findIndex((t) => a.startsWith(t)) - THEMES.findIndex((t) => b.startsWith(t)) || a.localeCompare(b)).join('\n'));
process.exit(failures === 0 ? 0 : 1);

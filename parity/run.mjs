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
    const shots = { ref: new Map(), el: new Map() };
    const rects = { ref: {}, el: {} };
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
    for (const group of groups) for (const side of ['ref', 'el']) {
        const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: group[0].width ?? 700, height: 900 } });
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
                // An infinite animation (a spinner, a marquee) never finishes, so waiting on it would hang the run.
                await Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished));
                // `data-items` is the JSON `items` of a simple-mode dock; an entry with `button` gets a click handler, which makes it a button.
                for (const target of document.querySelectorAll('ge-dock[data-items]')) target.items = JSON.parse(target.dataset.items).map((item) => (item.button ? { ...item, onClick: () => {} } : item));
                // `data-props` is a JSON object assigned to the element's properties, for the ones an attribute cannot carry.
                for (const target of document.querySelectorAll('[data-props]')) Object.assign(target, JSON.parse(target.dataset.props));
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
            if (focus) {
                await handle.locator(focus).first().focus();
                // Focus starts the ring and floating-label transitions; the reference page has nothing left to animate.
                await page.waitForTimeout(400);
            }
            // A context menu opens at the pointer, in the top layer at viewport coordinates, so it is opened at an offset
            // inside the case once the case has been scrolled to the top of the viewport.
            // `scroll` brings the case to the top first and lets whatever follows the scroll (a tour's spotlight) settle.
            if ((await handle.getAttribute('data-scroll')) !== null) {
                await handle.evaluate((c) => c.scrollIntoView({ block: 'start', behavior: 'instant' }));
                await page.waitForTimeout(500);
            }
            const show = await handle.getAttribute('data-show');
            if (show) {
                await handle.evaluate((c) => c.scrollIntoView({ block: 'start', behavior: 'instant' }));
                // The scroll event arrives a frame later, and a context menu closes on scroll.
                await page.waitForTimeout(200);
                await handle.evaluate((c, at) => {
                    const rect = c.firstElementChild.getBoundingClientRect();
                    const [dx, dy] = at.split(',').map(Number);
                    // Offsets are from the padding edge, where an absolutely placed reference box measures them.
                    c.querySelector('ge-context-menu').show(rect.left + c.firstElementChild.clientLeft + dx, rect.top + c.firstElementChild.clientTop + dy);
                }, show);
                await page.waitForTimeout(300);
                await handle.evaluate((c) => {
                    for (const target of c.querySelectorAll('[data-hover-on-show]')) target.dispatchEvent(new MouseEvent('mouseenter'));
                });
                await page.waitForTimeout(400);
            }
            shots[side].set(key, await handle.screenshot({ animations: 'allow' }));
            if (show) await handle.evaluate((c) => c.querySelector('ge-context-menu').close());
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

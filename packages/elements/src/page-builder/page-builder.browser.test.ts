import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import '../page-renderer/define.js';
import '../badge/define.js';
import '../progress/define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GePageBuilder } from './index.js';
import type { GePageRenderer } from '../page-renderer/index.js';
import type { ComponentMeta, PageData } from './page-builder.types.js';

const PALETTE: ComponentMeta[] = [
    { id: 'badge', name: 'Badge', category: 'Display', tag: 'ge-badge', icon: 'tag', defaultInputs: { label: 'New' }, defaultCols: 3, defaultRows: 2, inputs: [{ name: 'variant', type: 'select', options: ['default', 'secondary', 'destructive'] }] },
    { id: 'progress', name: 'Progress', category: 'Feedback', tag: 'ge-progress', defaultInputs: { value: 30 } },
];

const PAGE: PageData = {
    grid: { cols: 12, rowHeight: '40px', columnWidth: '1fr', gap: '1rem', showBorders: true, borderRadius: '0.5rem', itemPadding: '0.5rem', squareCells: false },
    items: [
        { id: 'a', x: 1, y: 1, cols: 4, rows: 2, componentId: 'badge', inputs: { label: 'Alpha' } },
        { id: 'b', x: 5, y: 1, cols: 4, rows: 2, componentId: 'progress', inputs: { value: 40 } },
        { id: 'gone', x: 9, y: 1, cols: 2, rows: 2, componentId: 'removed-widget', inputs: {} },
    ],
};

const BOUND: PageData = { ...PAGE, items: PAGE.items.map((item) => (item.id === 'a' ? { ...item, bindings: { label: 'user.name' } } : item)) };

async function setup(attrs = '', data: PageData | null = null) {
    const page = await mount(`<div style="width:1280px;height:640px"><ge-page-builder ${attrs}></ge-page-builder></div>`);
    const builder = page.querySelector('ge-page-builder') as GePageBuilder;
    builder.components = PALETTE;
    if (data) builder.data = data;
    await settled(builder);
    return builder;
}

const root = (builder: GePageBuilder) => builder.shadowRoot as ShadowRoot;
const q = <T extends Element = HTMLElement>(builder: GePageBuilder, selector: string) => root(builder).querySelector<T>(selector);
const qa = <T extends Element = HTMLElement>(builder: GePageBuilder, selector: string) => [...root(builder).querySelectorAll<T>(selector)];
const grid = (builder: GePageBuilder) => q(builder, 'ge-bento-grid') as HTMLElement;
const editor = (builder: GePageBuilder) => q(builder, 'ge-property-editor') as HTMLElement;
const inEditor = <T extends Element = HTMLElement>(builder: GePageBuilder, selector: string) => (editor(builder).shadowRoot as ShadowRoot).querySelector<T>(selector);

async function settled(builder: GePageBuilder) {
    for (let round = 0; round < 4; round++) {
        await builder.updateComplete;
        await (grid(builder) as unknown as { updateComplete: Promise<boolean> }).updateComplete;
        await (editor(builder) as unknown as { updateComplete?: Promise<boolean> } | null)?.updateComplete;
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
}

function lastSave(builder: GePageBuilder): PageData {
    let saved: PageData | null = null;
    builder.addEventListener('save', (e) => (saved = (e as CustomEvent<PageData>).detail), { once: true });
    builder.saveJson();
    if (!saved) throw new Error('save did not fire');
    return saved;
}

async function select(builder: GePageBuilder, id: string) {
    grid(builder).dispatchEvent(new CustomEvent('selection-change', { detail: [id] }));
    await settled(builder);
}

afterEach(() => vi.useRealTimers());

describe('ge-page-builder', () => {
    it('lists palette entries under their categories in alphabetical order and shows the empty hint', async () => {
        const builder = await setup();
        expect(qa(builder, '.category').map((h) => h.textContent)).toEqual(['Display', 'Feedback']);
        expect(qa(builder, '.tile-name').map((n) => n.textContent)).toEqual(['Badge', 'Progress']);
        expect(q(builder, '.canvas-empty')?.textContent).toContain('Drag components here');
        expect(q(builder, '.count')?.textContent?.trim()).toBe('0 Items');
        expect(q(builder, '.panel-title:last-child, .inspector .panel-title')?.textContent?.trim()).toBe('Grid Settings');
    });

    it('puts a dragged palette entry on the drag payload the grid expects', async () => {
        const builder = await setup();
        const data = new DataTransfer();
        q(builder, '.tile')?.dispatchEvent(new DragEvent('dragstart', { dataTransfer: data, bubbles: true }));
        expect(JSON.parse(data.getData('application/json'))).toEqual({ type: 'widget', id: 'badge' });
    });

    it('adds a dropped widget at the drop cell, sized and seeded from its palette entry, and selects it', async () => {
        const builder = await setup();
        grid(builder).dispatchEvent(new CustomEvent('external-drop', { detail: { widgetId: 'badge', targetId: null, x: 4, y: 3 } }));
        await settled(builder);
        const [item] = lastSave(builder).items;
        expect(item).toMatchObject({ x: 4, y: 3, cols: 3, rows: 2, componentId: 'badge', inputs: { label: 'New' } });
        expect(q(builder, '.count')?.textContent?.trim()).toBe('1 Items');
        expect(q(builder, '.canvas-empty')).toBeNull();
        const badge = grid(builder).querySelector('ge-badge') as HTMLElement & { label: string };
        expect(badge.label).toBe('New');
        expect(q(builder, '.inspector .panel-title')?.textContent?.trim()).toBe('Properties');
        expect(inEditor(builder, '.head-text h3')?.textContent).toBe('Badge');
    });

    it('appends a widget added without a cell below everything placed and ignores an unknown drop', async () => {
        const builder = await setup('', PAGE);
        builder.addItem(PALETTE[1] as ComponentMeta);
        grid(builder).dispatchEvent(new CustomEvent('external-drop', { detail: { widgetId: 'nope', targetId: null } }));
        await settled(builder);
        const items = lastSave(builder).items;
        expect(items).toHaveLength(3);
        expect(items[2]).toMatchObject({ x: 0, y: 3, cols: 2, rows: 2, componentId: 'progress', inputs: { value: 30 } });
    });

    it('edits size and inputs from the inspector and shows the change in the widget', async () => {
        const builder = await setup('', PAGE);
        await select(builder, 'a');
        expect([...editor(builder).shadowRoot!.querySelectorAll('.setting-label')].map((l) => l.textContent?.trim())).toContain('label');
        const cols = inEditor<HTMLInputElement>(builder, '#pe-cols') as HTMLInputElement;
        cols.value = '6';
        cols.dispatchEvent(new Event('input', { bubbles: true }));
        const label = inEditor<HTMLInputElement>(builder, '#pe-prop-label') as HTMLInputElement;
        label.value = 'Renamed';
        label.dispatchEvent(new Event('input', { bubbles: true }));
        await settled(builder);
        const a = lastSave(builder).items.find((i) => i.id === 'a');
        expect(a).toMatchObject({ cols: 6, inputs: { label: 'Renamed' } });
        expect((grid(builder).querySelector('ge-badge') as HTMLElement & { label: string }).label).toBe('Renamed');
    });

    it('gives a boolean property a switch, a declared select its choices and a number a number field', async () => {
        const builder = await setup('', PAGE);
        await select(builder, 'a');
        const labels = [...editor(builder).shadowRoot!.querySelectorAll('.setting')].map((s) => ({ name: s.querySelector('.setting-label')?.textContent?.trim(), kind: s.querySelector('ge-switch') ? 'switch' : s.querySelector('ge-select') ? 'select' : 'input' }));
        expect(labels.find((l) => l.name === 'skeleton')?.kind).toBe('switch');
        expect(labels.find((l) => l.name === 'variant')?.kind).toBe('select');
        await select(builder, 'b');
        const value = inEditor<HTMLInputElement>(builder, '#pe-prop-value') as HTMLInputElement;
        expect(value.type).toBe('number');
        expect(value.value).toBe('40');
    });

    it('switches an input to a binding without losing its literal value and back', async () => {
        const builder = await setup('', PAGE);
        await select(builder, 'b');
        const toggle = () => [...editor(builder).shadowRoot!.querySelectorAll<HTMLButtonElement>('.bind-toggle')].find((b) => b.closest('.setting')?.querySelector('.setting-label')?.textContent?.trim() === 'value') as HTMLButtonElement;
        expect(toggle().textContent?.trim()).toBe('Static');
        toggle().click();
        await settled(builder);
        const bound = inEditor<HTMLInputElement>(builder, '#pe-prop-value') as HTMLInputElement;
        expect(bound.placeholder).toBe('e.g. user.name');
        bound.value = 'stats.done';
        bound.dispatchEvent(new Event('input', { bubbles: true }));
        await settled(builder);
        expect(lastSave(builder).items.find((i) => i.id === 'b')).toMatchObject({ bindings: { value: 'stats.done' }, inputs: { value: 40 } });
        toggle().click();
        await settled(builder);
        expect(lastSave(builder).items.find((i) => i.id === 'b')?.bindings).toEqual({});
        expect((inEditor<HTMLInputElement>(builder, '#pe-prop-value') as HTMLInputElement).value).toBe('40');
    });

    it('deletes the selected widget from the inspector and returns to the grid settings', async () => {
        const builder = await setup('', PAGE);
        await select(builder, 'a');
        inEditor<HTMLButtonElement>(builder, '.delete')?.click();
        await settled(builder);
        expect(lastSave(builder).items.map((i) => i.id)).toEqual(['b']);
        expect(q(builder, '.inspector .panel-title')?.textContent?.trim()).toBe('Grid Settings');
    });

    it('loads data, dropping items the palette lacks, and waits for a palette when it arrives first', async () => {
        const page = await mount('<div style="width:1280px;height:640px"><ge-page-builder></ge-page-builder></div>');
        const builder = page.querySelector('ge-page-builder') as GePageBuilder;
        builder.data = PAGE;
        await builder.updateComplete;
        expect(q(builder, '.count')?.textContent?.trim()).toBe('0 Items');
        builder.components = PALETTE;
        await settled(builder);
        const saved = lastSave(builder);
        expect(saved.items.map((i) => i.id)).toEqual(['a', 'b']);
        expect(saved.grid).toMatchObject({ rowHeight: '40px', gap: '1rem', borderRadius: '0.5rem', itemPadding: '0.5rem', squareCells: false });
    });

    it('saves the whole layout with a timestamp, and hides Save when enable-save is false', async () => {
        const builder = await setup('', PAGE);
        const saved = lastSave(builder);
        expect(lastSave(await setup('', BOUND)).items[0]).toEqual({ id: 'a', x: 1, y: 1, cols: 4, rows: 2, componentId: 'badge', inputs: { label: 'Alpha' }, bindings: { label: 'user.name' } });
        expect(saved.items[0]).toEqual({ id: 'a', x: 1, y: 1, cols: 4, rows: 2, componentId: 'badge', inputs: { label: 'Alpha' }, bindings: {} });
        expect(Number.isNaN(Date.parse(saved.timestamp ?? ''))).toBe(false);
        expect(q(builder, '.primary')).not.toBeNull();
        builder.setAttribute('enable-save', 'false');
        await builder.updateComplete;
        expect(q(builder, '.primary')).toBeNull();
    });

    it('swaps edit and preview, hiding the inspector and freezing the grid, and announces it', async () => {
        const builder = await setup('', PAGE);
        const modes: string[] = [];
        builder.addEventListener('view-mode-change', (e) => modes.push((e as CustomEvent<string>).detail));
        qa(builder, '.tool').find((b) => b.textContent?.includes('Preview'))?.click();
        await settled(builder);
        expect(modes).toEqual(['preview']);
        expect(q(builder, '.inspector')).toBeNull();
        expect(grid(builder).getAttribute('editable')).toBe('false');
        expect(q(builder, '.tile')).not.toBeNull();
        builder.toggleViewMode();
        await settled(builder);
        expect(modes).toEqual(['preview', 'edit']);
        expect(q(builder, '.inspector')).not.toBeNull();
    });

    it('keeps the grid settings when the board is cleared', async () => {
        const builder = await setup('', PAGE);
        builder.clearBoard();
        await settled(builder);
        const saved = lastSave(builder);
        expect(saved.items).toEqual([]);
        expect(saved.grid.rowHeight).toBe('40px');
    });

    it('locks the column width to the row height while cells are square, and restores 1fr when they are not', async () => {
        const builder = await setup();
        const rowHeight = q<HTMLInputElement>(builder, '#pb-row-height') as HTMLInputElement;
        rowHeight.value = '30';
        rowHeight.dispatchEvent(new Event('input', { bubbles: true }));
        rowHeight.dispatchEvent(new Event('blur'));
        await settled(builder);
        expect(lastSave(builder).grid).toMatchObject({ rowHeight: '30px', columnWidth: '30px', squareCells: true });
        q<HTMLButtonElement>(builder, '[role="switch"]')?.click();
        await settled(builder);
        expect(lastSave(builder).grid).toMatchObject({ columnWidth: '1fr', squareCells: false });
        expect(q(builder, '.sub-title')?.textContent).toBe('Column Configuration');
    });

    it('turns a bare number into pixels on blur and keeps other units as typed', async () => {
        const builder = await setup();
        const gap = q<HTMLInputElement>(builder, '#pb-gap-size') as HTMLInputElement;
        gap.value = '12';
        gap.dispatchEvent(new Event('input', { bubbles: true }));
        gap.dispatchEvent(new Event('blur'));
        await settled(builder);
        expect(gap.value).toBe('12px');
        gap.value = '2rem';
        gap.dispatchEvent(new Event('input', { bubbles: true }));
        gap.dispatchEvent(new Event('blur'));
        await settled(builder);
        expect(lastSave(builder).grid.gap).toBe('2rem');
        qa(builder, '.chip').find((b) => b.textContent === 'L')?.click();
        await settled(builder);
        expect(lastSave(builder).grid.borderRadius).toBe('1.5rem');
    });

    it('steps the value of every progress widget every second while the live feed runs, and stops when told to', async () => {
        const builder = await setup('', PAGE);
        vi.useFakeTimers();
        builder.toggleSimulatedData();
        vi.advanceTimersByTime(3000);
        expect(lastSave(builder).items.find((i) => i.id === 'b')?.inputs?.['value']).toBe(55);
        expect(lastSave(builder).items.find((i) => i.id === 'a')?.inputs).toEqual({ label: 'Alpha' });
        builder.toggleSimulatedData();
        vi.advanceTimersByTime(3000);
        expect(lastSave(builder).items.find((i) => i.id === 'b')?.inputs?.['value']).toBe(55);
    });

    it('wraps the live value around after 100', async () => {
        const builder = await setup('', { ...PAGE, items: [{ id: 'b', x: 1, y: 1, cols: 4, rows: 2, componentId: 'progress', inputs: { value: 100 } }] });
        vi.useFakeTimers();
        builder.toggleSimulatedData();
        vi.advanceTimersByTime(1000);
        expect(lastSave(builder).items[0]?.inputs?.['value']).toBe(0);
        builder.toggleSimulatedData();
    });

    it('replaces the board from an imported file and refuses a malformed one without touching it', async () => {
        const builder = await setup('', PAGE);
        Object.defineProperty(globalThis, 'showOpenFilePicker', { value: undefined, configurable: true });
        const alerts: string[] = [];
        const original = globalThis.alert;
        globalThis.alert = (message?: string) => void alerts.push(String(message));
        const choose = async (text: string) => {
            const input = q<HTMLInputElement>(builder, 'input[type="file"]') as HTMLInputElement;
            const files = new DataTransfer();
            files.items.add(new File([text], 'layout.json'));
            input.files = files.files;
            input.dispatchEvent(new Event('change'));
            await vi.waitFor(() => expect(input.files?.length).toBe(1));
            await new Promise((resolve) => setTimeout(resolve, 50));
            await settled(builder);
        };
        try {
            await choose('{"items": []}');
            expect(alerts).toEqual(['Invalid layout file format']);
            await choose('not json');
            expect(alerts).toEqual(['Invalid layout file format', 'Failed to parse layout file']);
            expect(lastSave(builder).items).toHaveLength(2);
            await choose(JSON.stringify({ grid: PAGE.grid, items: [PAGE.items[1]] }));
            expect(lastSave(builder).items.map((i) => i.id)).toEqual(['b']);
        } finally {
            globalThis.alert = original;
            Reflect.deleteProperty(globalThis, 'showOpenFilePicker');
        }
    });

    it('exports the layout as a JSON download where there is no save dialog', async () => {
        const builder = await setup('enable-export', PAGE);
        Object.defineProperty(globalThis, 'showSaveFilePicker', { value: undefined, configurable: true });
        const blobs: Blob[] = [];
        const create = URL.createObjectURL.bind(URL);
        URL.createObjectURL = (blob: Blob | MediaSource) => (blobs.push(blob as Blob), create(blob));
        const clicked: string[] = [];
        const click = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () {
            clicked.push(this.download);
        };
        try {
            await builder.exportJson();
            expect(clicked).toEqual(['page-builder-export.json']);
            const exported = JSON.parse(await (blobs[0] as Blob).text()) as PageData;
            expect(exported.items.map((i) => i.id)).toEqual(['a', 'b']);
        } finally {
            URL.createObjectURL = create;
            HTMLAnchorElement.prototype.click = click;
            Reflect.deleteProperty(globalThis, 'showSaveFilePicker');
        }
    });

    it('does not download when the save dialog is cancelled', async () => {
        const builder = await setup('enable-export', PAGE);
        Object.defineProperty(globalThis, 'showSaveFilePicker', { value: () => Promise.reject(new DOMException('cancelled', 'AbortError')), configurable: true });
        const clicked: string[] = [];
        const click = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () {
            clicked.push(this.download);
        };
        try {
            await builder.exportJson();
            expect(clicked).toEqual([]);
        } finally {
            HTMLAnchorElement.prototype.click = click;
            Reflect.deleteProperty(globalThis, 'showSaveFilePicker');
        }
    });

    it('clears the selection when a new layout replaces the board', async () => {
        const builder = await setup('', PAGE);
        await select(builder, 'a');
        builder.data = { ...PAGE, items: [PAGE.items[1] as PageData['items'][number]] };
        await settled(builder);
        expect(q(builder, '.inspector .panel-title')?.textContent?.trim()).toBe('Grid Settings');
        expect(lastSave(builder).items.map((i) => i.id)).toEqual(['b']);
    });

    it('has no axe violations with a widget selected, in light and dark', async () => {
        const builder = await setup('enable-export', PAGE);
        await select(builder, 'a');
        for (const mode of ['light', 'dark']) {
            useTheme(mode);
            await new Promise((resolve) => setTimeout(resolve, 400));
            const results = await axe.run(builder, { rules: { region: { enabled: false } } });
            if (results.violations.length) expect(mode + JSON.stringify(results.violations.map((v) => v.nodes.map((n) => n.any[0]?.message)))).toBe('x');
        }
    });
});

describe('ge-page-renderer', () => {
    async function render(context: Record<string, unknown> = {}, data: PageData | null = BOUND) {
        const page = await mount('<div style="width:900px"><ge-page-renderer></ge-page-renderer></div>');
        const renderer = page.querySelector('ge-page-renderer') as GePageRenderer;
        renderer.components = PALETTE;
        renderer.context = context;
        renderer.data = data;
        await renderer.updateComplete;
        const bento = renderer.shadowRoot?.querySelector('ge-bento-grid') as (HTMLElement & { updateComplete: Promise<boolean> }) | null;
        await bento?.updateComplete;
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
        return { renderer, bento: bento as HTMLElement & { updateComplete: Promise<boolean> } };
    }

    it('draws each item as its palette entry and drops an unknown one', async () => {
        const { bento } = await render();
        expect([...bento.children].filter((c) => c.getAttribute('slot')?.startsWith('item-')).map((c) => c.firstElementChild?.localName)).toEqual(['ge-badge', 'ge-progress']);
        expect((bento.querySelector('ge-badge') as HTMLElement & { label: string }).label).toBe('Alpha');
        expect((bento.querySelector('ge-progress') as HTMLElement & { value: number }).value).toBe(40);
    });

    it('lets a binding that resolves override the saved input and leaves it alone when it does not', async () => {
        const resolved = await render({ user: { name: 'Dana' } });
        expect((resolved.bento.querySelector('ge-badge') as HTMLElement & { label: string }).label).toBe('Dana');
        const missing = await render({ user: {} });
        expect((missing.bento.querySelector('ge-badge') as HTMLElement & { label: string }).label).toBe('Alpha');
    });

    it('renders the saved grid settings and offers no editing', async () => {
        const { bento } = await render();
        expect(bento.getAttribute('editable')).toBe('false');
        expect(bento.getAttribute('row-height')).toBe('40px');
        expect(bento.getAttribute('gap')).toBe('1rem');
        expect(bento.getAttribute('border-radius')).toBe('0.5rem');
    });

    it('keeps a widget element between updates and applies new context to it', async () => {
        const { renderer, bento } = await render({ user: { name: 'Dana' } });
        const before = bento.querySelector('ge-badge');
        renderer.context = { user: { name: 'Noa' } };
        await renderer.updateComplete;
        await bento.updateComplete;
        expect(bento.querySelector('ge-badge')).toBe(before);
        expect((before as HTMLElement & { label: string }).label).toBe('Noa');
    });

    it('hides the widget borders when the saved grid says so', async () => {
        const { bento } = await render({}, { ...PAGE, grid: { ...PAGE.grid, showBorders: false } });
        expect(bento.getAttribute('show-borders')).toBe('false');
    });

    it('renders nothing without data', async () => {
        const { renderer } = await render({}, null);
        expect(renderer.shadowRoot?.querySelector('ge-bento-grid')).toBeNull();
    });
});

describe('ge-property-editor', () => {
    async function editorFor(item: Parameters<typeof asItem>[0] | null, meta: ComponentMeta | null, attrs = '') {
        const page = await mount(`<div style="width:320px;height:600px"><ge-property-editor ${attrs}></ge-property-editor></div>`);
        const element = page.querySelector('ge-property-editor') as HTMLElement & { item: unknown; componentMeta: unknown; updateComplete: Promise<boolean> };
        element.item = item ? asItem(item) : null;
        element.componentMeta = meta;
        await element.updateComplete;
        return element;
    }
    const asItem = (item: { id: string; cols?: number; inputs?: Record<string, unknown>; bindings?: Record<string, string> }) => ({ id: item.id, x: 1, y: 1, cols: item.cols ?? 2, rows: 2, content: '', componentId: 'badge', inputs: item.inputs ?? {}, bindings: item.bindings ?? {} });

    it('shows the empty state without an item', async () => {
        const element = await editorFor(null, null);
        expect(element.shadowRoot?.querySelector('.empty h3')?.textContent).toBe('No Selection');
    });

    it('shows a placeholder while loading, and the fields once it is done', async () => {
        const element = await editorFor({ id: 'x' }, PALETTE[0] as ComponentMeta, 'loading');
        expect(element.shadowRoot?.querySelector('.skeleton')).not.toBeNull();
        expect(element.shadowRoot?.querySelector('#pe-cols')).toBeNull();
        element.toggleAttribute('loading', false);
        await element.updateComplete;
        expect(element.shadowRoot?.querySelector('.skeleton')).toBeNull();
        expect(element.shadowRoot?.querySelector('#pe-cols')).not.toBeNull();
    });

    it('offers only the size fields when it has no component details', async () => {
        const element = await editorFor({ id: 'x', cols: 5 }, null);
        expect((element.shadowRoot?.querySelector('#pe-cols') as HTMLInputElement).value).toBe('5');
        expect(element.shadowRoot?.querySelector('.setting')).toBeNull();
    });

    it('reports an emptied number field as null rather than NaN', async () => {
        const element = await editorFor({ id: 'x' }, PALETTE[1] as ComponentMeta);
        const changes: unknown[] = [];
        element.addEventListener('item-change', (e) => changes.push((e as CustomEvent).detail));
        const cols = element.shadowRoot?.querySelector('#pe-cols') as HTMLInputElement;
        cols.value = '';
        cols.dispatchEvent(new Event('input'));
        expect(changes).toEqual([{ id: 'x', prop: 'cols', value: null }]);
    });
});

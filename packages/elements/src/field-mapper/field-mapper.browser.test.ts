import axe from 'axe-core';
import { html, type TemplateResult } from 'lit';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeFieldMapper } from './index.js';
import type { FieldMapperItem, FieldMapperLink } from './field-mapper.types.js';

const ORDERS: FieldMapperItem[] = [
    { id: 'customer_id', label: 'customer_id' },
    { id: 'region', label: 'region' },
    { id: 'order_id', label: 'order_id' },
    { id: 'placed_at', label: 'placed_at' },
];
const CUSTOMERS: FieldMapperItem[] = [
    { id: 'segment', label: 'segment' },
    { id: 'id', label: 'id' },
    { id: 'name', label: 'name' },
    { id: 'area', label: 'area' },
];

type Side = 'start' | 'end';
interface Setup {
    width?: number;
    dir?: 'rtl' | 'ltr';
    attrs?: string;
    start?: FieldMapperItem[];
    end?: FieldMapperItem[];
    links?: FieldMapperLink[];
    maxLinks?: { start?: number; end?: number };
    labels?: boolean;
    style?: string;
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const e of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await e.updateComplete;
        await nextFrame();
    }
};

async function setup(options: Setup = {}) {
    const page = await mount(
        `<div style="width:${options.width ?? 640}px;${options.style ?? ''}" ${options.dir ? `dir="${options.dir}"` : ''}><ge-field-mapper start-heading="Column in orders" end-heading="Column in customers" ${options.attrs ?? ''}></ge-field-mapper></div>`,
    );
    const mapper = page.querySelector('ge-field-mapper') as GeFieldMapper;
    mapper.start = options.start ?? ORDERS;
    mapper.end = options.end ?? CUSTOMERS;
    if (options.links) mapper.links = options.links;
    if (options.maxLinks) mapper.maxLinks = options.maxLinks;
    if (options.labels) mapper.renderLinkLabel = (link) => `${link.startId}~${link.endId}`;
    const events = { links: [] as (readonly FieldMapperLink[])[], selected: [] as (FieldMapperLink | null)[] };
    mapper.addEventListener('links-change', (e) => events.links.push((e as CustomEvent<readonly FieldMapperLink[]>).detail));
    mapper.addEventListener('link-select', (e) => events.selected.push((e as CustomEvent<FieldMapperLink | null>).detail));
    await settle(page);
    return { page, mapper, events };
}

const root = (m: GeFieldMapper) => m.shadowRoot!;
const item = (m: GeFieldMapper, side: Side, id: string) => {
    const found = [...root(m).querySelectorAll<HTMLElement>(`[data-slot="field-mapper-item"][data-side="${side}"]`)].find((el) => el.dataset.id === id);
    if (!found) throw new Error(`no ${side} item ${id}`);
    return found;
};
const handle = (m: GeFieldMapper, side: Side, id: string) => item(m, side, id).querySelector<HTMLElement>('[data-slot="field-mapper-handle"]')!;
const center = (el: Element) => {
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};
const live = (m: GeFieldMapper) => root(m).querySelector('[data-slot="field-mapper-live"]')!.textContent!.replaceAll(' ', '');

/** Both ends of every drawn line, in viewport coordinates. */
function lineEnds(m: GeFieldMapper) {
    const svg = root(m).querySelector<SVGSVGElement>('[data-slot="field-mapper-lines"]')!;
    const origin = svg.getBoundingClientRect();
    return [...svg.querySelectorAll<SVGPathElement>('[data-slot="field-mapper-line"]')].map((path) => {
        const numbers = (path.getAttribute('d') ?? '').match(/-?\d+(\.\d+)?/g)!.map(Number);
        return { from: { x: origin.left + numbers[0]!, y: origin.top + numbers[1]! }, to: { x: origin.left + numbers.at(-2)!, y: origin.top + numbers.at(-1)! } };
    });
}

function expectLinesOnHandles(m: GeFieldMapper, links: readonly FieldMapperLink[]) {
    const ends = lineEnds(m);
    expect(ends).toHaveLength(links.length);
    links.forEach((link, index) => {
        const from = center(handle(m, 'start', link.startId));
        const to = center(handle(m, 'end', link.endId));
        expect(ends[index]!.from.x).toBeCloseTo(from.x, 0);
        expect(ends[index]!.from.y).toBeCloseTo(from.y, 0);
        expect(ends[index]!.to.x).toBeCloseTo(to.x, 0);
        expect(ends[index]!.to.y).toBeCloseTo(to.y, 0);
    });
}

const EXPECTED = [
    { startId: 'customer_id', endId: 'id' },
    { startId: 'region', endId: 'area' },
];

describe('ge-field-mapper (columns)', () => {
    it('anchors every absolutely positioned part, hidden helpers included, inside itself', async () => {
        // An sr-only helper anchored to the page stretched the whole document in the Angular demo.
        const { mapper } = await setup();
        const base = root(mapper).querySelector<HTMLElement>('.root')!;
        const escaped = [...base.querySelectorAll<HTMLElement>('*')]
            .filter((part) => part instanceof HTMLElement && getComputedStyle(part).position === 'absolute')
            .filter((part) => !base.contains(part.offsetParent))
            .map((part) => part.dataset.slot ?? part.className);
        expect(escaped).toEqual([]);
    });

    it('produces the same links by pointer drag, tap-tap and keyboard, from either list', async () => {
        const dragged = await setup();
        await userEvent.dragAndDrop(handle(dragged.mapper, 'start', 'customer_id'), item(dragged.mapper, 'end', 'id'));
        await settle(dragged.page);
        await userEvent.dragAndDrop(handle(dragged.mapper, 'end', 'area'), item(dragged.mapper, 'start', 'region'));
        await settle(dragged.page);
        expect(dragged.mapper.links).toEqual(EXPECTED);
        expect(dragged.events.links.at(-1)).toEqual(EXPECTED);

        const tapped = await setup();
        await userEvent.click(item(tapped.mapper, 'start', 'customer_id'));
        await userEvent.click(item(tapped.mapper, 'end', 'id'));
        await userEvent.click(item(tapped.mapper, 'end', 'area'));
        await userEvent.click(item(tapped.mapper, 'start', 'region'));
        await settle(tapped.page);
        expect(tapped.mapper.links).toEqual(EXPECTED);

        const typed = await setup();
        item(typed.mapper, 'start', 'customer_id').focus();
        await userEvent.keyboard('{Enter}{Tab}{ArrowDown}{Enter}');
        await settle(typed.page);
        // The end list is aligned now: id moved level with customer_id, so area is the last row.
        await userEvent.keyboard('{End}{Enter}{Shift>}{Tab}{/Shift}{ArrowDown}{Enter}');
        await settle(typed.page);
        expect(typed.mapper.links).toEqual(EXPECTED);
    });

    it('keeps every line on its two handles after the lists scroll, the container resizes, and an item grows', async () => {
        const many = Array.from({ length: 30 }, (...[, i]) => ({ id: `col_${i}`, label: `column_${i}` }));
        const links = [
            { startId: 'col_2', endId: 'col_20' },
            { startId: 'col_14', endId: 'col_3' },
            { startId: 'col_25', endId: 'col_9' },
        ];
        const { page, mapper } = await setup({ start: many, end: many, links, attrs: 'no-align', style: '--field-mapper-max-height: 260px' });
        expectLinesOnHandles(mapper, links);

        const scroller = root(mapper).querySelector<HTMLElement>('[data-slot="field-mapper-scroll"]')!;
        scroller.scrollTop = 400;
        await settle(page);
        expect(scroller.scrollTop).toBeGreaterThan(0);
        expectLinesOnHandles(mapper, links);
        // What scrolls under the sticky headings is hidden across the full width, gutter included.
        const [startHeading, endHeading] = [...root(mapper).querySelectorAll('[data-slot="field-mapper-heading"]')].map((heading) => heading.getBoundingClientRect());
        const gutterX = (startHeading!.right + endHeading!.left) / 2;
        const underHeader = root(mapper).elementFromPoint(gutterX, startHeading!.top + startHeading!.height / 2);
        expect(underHeader?.closest('[data-slot="field-mapper-header"]')).not.toBeNull();
        expect(getComputedStyle(underHeader!).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');

        (page.firstElementChild as HTMLElement).style.width = '1100px';
        await settle(page);
        expectLinesOnHandles(mapper, links);

        // Content that grows inside the fixed-height scroller changes nothing outside it; the lines must still follow.
        item(mapper, 'start', 'col_2').style.minHeight = '120px';
        await settle(page);
        expectLinesOnHandles(mapper, links);
    });

    it('cancels a drag dropped on its own list or on empty space, even when the lists share ids', async () => {
        const { page, mapper } = await setup({ start: [...ORDERS, { id: 'id', label: 'id' }] });
        await userEvent.dragAndDrop(handle(mapper, 'start', 'customer_id'), item(mapper, 'start', 'id'));
        await settle(page);
        // The click that ends a drag lands on the item under the pointer; it must not start a tap-to-link pick.
        expect(mapper.pending).toBeNull();
        await userEvent.dragAndDrop(handle(mapper, 'start', 'region'), root(mapper).querySelector('[data-slot="field-mapper-heading"]')!);
        await settle(page);
        expect(mapper.links).toEqual([]);
        expect(root(mapper).querySelector('[data-slot="field-mapper-rubber-band"]')).toBeNull();
    });

    it('aligns each linked end item level with its partner, keeps the unlinked in order, and labels the line at its midpoint', async () => {
        const links = [
            { startId: 'customer_id', endId: 'id' },
            { startId: 'order_id', endId: 'area' },
        ];
        const { mapper } = await setup({ links, labels: true });
        for (const link of links) {
            expect(item(mapper, 'end', link.endId).getBoundingClientRect().top).toBeCloseTo(item(mapper, 'start', link.startId).getBoundingClientRect().top, 0);
        }
        expect(item(mapper, 'end', 'segment').getBoundingClientRect().top).toBeLessThan(item(mapper, 'end', 'name').getBoundingClientRect().top);
        expectLinesOnHandles(mapper, links);

        const labels = [...root(mapper).querySelectorAll<HTMLElement>('[data-slot="field-mapper-link-label"]')];
        expect(labels.map((label) => label.textContent?.trim())).toEqual(['customer_id~id', 'order_id~area']);
        const ends = lineEnds(mapper)[0]!;
        const labelCenter = center(labels[0]!);
        expect(labelCenter.x).toBeCloseTo((ends.from.x + ends.to.x) / 2, 0);
        expect(labelCenter.y).toBeCloseTo((ends.from.y + ends.to.y) / 2, 0);
    });

    it('keeps the end list in its own order with no-align, and a custom item renderer fills the item', async () => {
        const { mapper } = await setup({ links: [{ startId: 'customer_id', endId: 'name' }], attrs: 'no-align' });
        const tops = CUSTOMERS.map((c) => item(mapper, 'end', c.id).getBoundingClientRect().top);
        expect([...tops].sort((a, b) => a - b)).toEqual(tops);
        mapper.renderItem = (it, ctx) => html`<b data-testid="custom">${it.label}:${ctx.side}:${String(ctx.linked)}</b>`;
        await mapper.updateComplete;
        expect(item(mapper, 'start', 'customer_id').textContent!.trim()).toBe('customer_id:start:true');
        expect(item(mapper, 'end', 'segment').textContent!.trim()).toBe('segment:end:false');
    });

    it('mirrors in RTL: the start list is on the right, lines join the inner edges, and each label keeps its own direction', async () => {
        const links = [{ startId: 'region', endId: 'name' }];
        const { mapper, events } = await setup({ dir: 'rtl', links, labels: true });
        const itemLabel = item(mapper, 'start', 'region').querySelector('[dir]')!;
        const linkLabel = root(mapper).querySelector('[data-slot="field-mapper-link-label"] [dir]')!;
        // English labels inside a right-to-left document still run left to right.
        expect(getComputedStyle(itemLabel).direction).toBe('ltr');
        expect(getComputedStyle(linkLabel).direction).toBe('ltr');

        const start = item(mapper, 'start', 'region').getBoundingClientRect();
        const end = item(mapper, 'end', 'name').getBoundingClientRect();
        expect(start.left).toBeGreaterThan(end.right);
        expect(Math.abs(center(handle(mapper, 'start', 'region')).x - start.left)).toBeLessThanOrEqual(1.5);
        expect(Math.abs(center(handle(mapper, 'end', 'name')).x - end.right)).toBeLessThanOrEqual(1.5);
        expectLinesOnHandles(mapper, links);

        // The key toward the other list mirrors too: from the start list it is ArrowLeft.
        item(mapper, 'start', 'region').focus();
        await userEvent.keyboard('{ArrowLeft}');
        expect(events.selected.at(-1)).toEqual({ startId: 'region', endId: 'name' });
    });

    it('selects a line by clicking its hit area, and removes it with the button beside it', async () => {
        const { page, mapper, events } = await setup({ links: EXPECTED.map((l) => ({ ...l })) });
        const hit = root(mapper).querySelectorAll<SVGPathElement>('[data-slot="field-mapper-line-hit"]')[1]!;
        const middle = hit.getPointAtLength(hit.getTotalLength() / 2);
        const svgBox = root(mapper).querySelector('svg')!.getBoundingClientRect();
        // Aim 20px off the line: inside the 44px hit stroke, outside the 2px visible one.
        await userEvent.click(page.firstElementChild!, { position: { x: svgBox.left + middle.x - page.firstElementChild!.getBoundingClientRect().left, y: svgBox.top + middle.y + 20 - page.firstElementChild!.getBoundingClientRect().top } });
        await settle(page);
        expect(events.selected.at(-1)).toEqual({ startId: 'region', endId: 'area' });
        expect(live(mapper)).toContain('Link from region to area selected');

        await userEvent.click(root(mapper).querySelector<HTMLElement>('[data-slot="field-mapper-link-label"] ge-button')!);
        await settle(page);
        expect(mapper.links).toEqual([{ startId: 'customer_id', endId: 'id' }]);
        expect(events.selected.at(-1)).toBeNull();
    });

    it('picks by tap or Enter, cancels on a second pick or Escape, and announces each step', async () => {
        const { page, mapper } = await setup();
        item(mapper, 'start', 'customer_id').focus();
        await userEvent.keyboard('{Enter}');
        await settle(page);
        expect(item(mapper, 'start', 'customer_id').dataset.state).toBe('choosing');
        expect(live(mapper)).toBe('customer_id picked. Choose an item in Column in customers to link it.');
        await userEvent.keyboard('{Enter}');
        await settle(page);
        expect(item(mapper, 'start', 'customer_id').dataset.state).toBeUndefined();
        expect(live(mapper)).toBe('Linking cancelled');
        await userEvent.keyboard('{Enter}{Escape}');
        await settle(page);
        expect(item(mapper, 'start', 'customer_id').dataset.state).toBeUndefined();
        await userEvent.click(item(mapper, 'start', 'region'));
        await userEvent.click(item(mapper, 'end', 'area'));
        await settle(page);
        expect(live(mapper)).toBe('region linked to area');
        // Nothing to cancel: Escape stays silent instead of announcing a cancellation.
        await userEvent.keyboard('{Escape}');
        expect(live(mapper)).toBe('region linked to area');
    });

    it('rewords a repeated announcement so a screen reader reads it again', async () => {
        const { mapper } = await setup({ links: [{ startId: 'region', endId: 'area' }] });
        const raw = () => root(mapper).querySelector('[data-slot="field-mapper-live"]')!.textContent;
        mapper.selectLink({ startId: 'region', endId: 'area' });
        await mapper.updateComplete;
        const first = raw();
        mapper.selectLink({ startId: 'region', endId: 'area' });
        await mapper.updateComplete;
        expect(raw()).not.toBe(first);
        expect(raw()!.replaceAll('\u00a0', '')).toBe(first!.replaceAll('\u00a0', ''));
    });

    it('starts a drag only from an enabled item once the pointer has travelled, and draws the line as links change', async () => {
        const { page, mapper } = await setup({ start: [{ id: 'customer_id', label: 'customer_id', disabled: true }, ...ORDERS.slice(1)] });
        const press = (side: Side, id: string, init: PointerEventInit = {}) => handle(mapper, side, id).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0, clientX: 100, clientY: 100, ...init }));
        const move = (dx: number) => document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 100 + dx, clientY: 100, cancelable: true }));
        const release = () => document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 100, clientY: 100 }));
        press('start', 'customer_id');
        move(40);
        expect(mapper.dragging).toBeNull();
        release();
        press('start', 'region', { button: 2 });
        move(40);
        expect(mapper.dragging).toBeNull();
        press('start', 'region');
        move(2);
        expect(mapper.dragging).toBeNull();
        move(40);
        expect(mapper.dragging).toEqual({ side: 'start', id: 'region' });
        release();
    });

    it('swallows the click that ends a drag', async () => {
        const { mapper } = await setup();
        const own = item(mapper, 'start', 'region');
        handle(mapper, 'start', 'region').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0, clientX: 100, clientY: 100 }));
        document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 160, clientY: 100, cancelable: true }));
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 160, clientY: 100 }));
        own.click();
        expect(mapper.pending).toBeNull();
        await new Promise((resolve) => setTimeout(resolve, 10));
        own.click();
        expect(mapper.pending).toEqual({ side: 'start', id: 'region' });
    });

    it('redraws the lines when the links are set from outside', async () => {
        const { page, mapper } = await setup();
        mapper.links = [{ startId: 'region', endId: 'name' }];
        await settle(page);
        expectLinesOnHandles(mapper, [{ startId: 'region', endId: 'name' }]);
        mapper.links = [];
        await settle(page);
        expect(lineEnds(mapper)).toEqual([]);
    });

    it('animates the end list into its new alignment after a link, and drops a pick when the layout changes', async () => {
        const { page, mapper } = await setup();
        mapper.link('region', 'area');
        await mapper.updateComplete;
        expect(item(mapper, 'end', 'area').getAnimations().some((animation) => !(animation instanceof CSSTransition))).toBe(true);
        await settle(page);
        mapper.pick('start', ORDERS[0]!);
        expect(mapper.pending).not.toBeNull();
        (page.firstElementChild as HTMLElement).style.width = '320px';
        await settle(page);
        expect(mapper.pending).toBeNull();
    });

    it('cycles an item’s lines with the key toward the other list; Delete removes the selected line, or all of the item’s links', async () => {
        const { page, mapper } = await setup({ links: [{ startId: 'region', endId: 'area' }, { startId: 'region', endId: 'id' }, { startId: 'order_id', endId: 'name' }], maxLinks: { start: Infinity, end: 1 } });
        item(mapper, 'start', 'region').focus();
        await userEvent.keyboard('{ArrowRight}');
        expect(mapper.selectedLink).toEqual({ startId: 'region', endId: 'area' });
        await userEvent.keyboard('{ArrowRight}');
        expect(mapper.selectedLink).toEqual({ startId: 'region', endId: 'id' });
        await userEvent.keyboard('{Delete}');
        await settle(page);
        expect(mapper.links).toEqual([{ startId: 'region', endId: 'area' }, { startId: 'order_id', endId: 'name' }]);
        await userEvent.keyboard('{Delete}');
        await settle(page);
        expect(mapper.links).toEqual([{ startId: 'order_id', endId: 'name' }]);
    });

    it('moves the oldest link out at maxLinks, never links a disabled item, and takes many links when the limit is Infinity', async () => {
        const { mapper } = await setup({ links: [{ startId: 'customer_id', endId: 'id' }], end: [...CUSTOMERS.slice(0, 3), { id: 'area', label: 'area', disabled: true }] });
        mapper.link('region', 'id');
        expect(mapper.links).toEqual([{ startId: 'region', endId: 'id' }]);
        mapper.link('region', 'area');
        expect(mapper.links).toEqual([{ startId: 'region', endId: 'id' }]);
        mapper.maxLinks = { start: Infinity, end: Infinity };
        mapper.link('region', 'name');
        mapper.link('order_id', 'name');
        expect(mapper.links).toEqual([{ startId: 'region', endId: 'id' }, { startId: 'region', endId: 'name' }, { startId: 'order_id', endId: 'name' }]);
    });

    it('runs a line to a filtered-out item to the edge of its list, beside a count', async () => {
        const { page, mapper } = await setup({ attrs: 'searchable', links: [{ startId: 'customer_id', endId: 'id' }] });
        const filter = root(mapper).querySelectorAll<HTMLElement>('ge-input')[1]!;
        (filter.shadowRoot!.querySelector('input') as HTMLInputElement).focus();
        await userEvent.keyboard('are');
        await settle(page);
        const note = root(mapper).querySelector<HTMLElement>('[data-slot="field-mapper-hidden-note"][data-side="end"]')!;
        expect(note.textContent?.trim()).toBe('1 more linked, hidden by the filter');
        const [line] = lineEnds(mapper);
        expect(line!.from.x).toBeCloseTo(center(handle(mapper, 'start', 'customer_id')).x, 0);
        expect(line!.to.x).toBeCloseTo(note.getBoundingClientRect().left, 0);
        expect(line!.to.y).toBeCloseTo(center(note).y, 0);
    });
});

describe('ge-field-mapper (rows)', () => {
    it('switches to rows at 320px with no horizontal overflow and every control at least 44px', async () => {
        const { mapper } = await setup({
            width: 320,
            attrs: 'searchable',
            maxLinks: { start: Infinity, end: 1 },
            end: [...CUSTOMERS, { id: 'ltv', label: 'customer_lifetime_value_in_original_currency_before_discounts' }],
            links: [
                { startId: 'customer_id', endId: 'ltv' },
                { startId: 'customer_id', endId: 'id' },
            ],
        });
        const base = root(mapper).querySelector<HTMLElement>('.root')!;
        expect(base.dataset.layout).toBe('rows');
        expect(base.scrollWidth).toBeLessThanOrEqual(base.clientWidth);
        const box = base.getBoundingClientRect();
        const inner = (el: HTMLElement) => el.shadowRoot!.querySelector<HTMLElement>('button, input, select')!;
        const controls = [...base.querySelectorAll<HTMLElement>('ge-button, ge-native-select, ge-input')].map(inner);
        expect(controls.length).toBeGreaterThan(5);
        for (const control of controls) {
            const rect = control.getBoundingClientRect();
            expect(rect.height).toBeGreaterThanOrEqual(44);
            expect(rect.width).toBeGreaterThanOrEqual(44);
            expect(rect.right).toBeLessThanOrEqual(box.right + 0.5);
        }
    });

    it('links through each row’s picker under the same limits, announces it, and removes one of several links from its chip', async () => {
        const { page, mapper } = await setup({ attrs: 'layout="rows"' });
        const picker = (id: string) => root(mapper).querySelector<HTMLElement>(`[data-slot="field-mapper-row"][data-id="${id}"] ge-native-select`)! as HTMLElement & { value: string };
        const choose = async (id: string, value: string) => {
            const select = picker(id).shadowRoot!.querySelector('select')!;
            select.value = value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            await settle(page);
        };
        await choose('customer_id', 'id');
        await choose('region', 'id');
        expect(mapper.links).toEqual([{ startId: 'region', endId: 'id' }]);
        expect(live(mapper)).toBe('region linked to id. customer_id no longer linked to id');
        await choose('region', '');
        expect(mapper.links).toEqual([]);

        mapper.maxLinks = { start: Infinity, end: 1 };
        mapper.links = [{ startId: 'region', endId: 'id' }, { startId: 'region', endId: 'area' }];
        await settle(page);
        const chips = root(mapper).querySelectorAll<HTMLElement>('[data-slot="field-mapper-row"][data-id="region"] .chip');
        expect([...chips].map((chip) => chip.textContent!.trim())).toEqual(['id', 'area']);
        await userEvent.click(chips[0]!.querySelector('ge-button')!);
        await settle(page);
        expect(mapper.links).toEqual([{ startId: 'region', endId: 'area' }]);
    });

    it('speaks Hebrew right to left', async () => {
        const { mapper } = await setup({ attrs: 'locale="he"' });
        expect(root(mapper).querySelector('.root')!.getAttribute('dir')).toBe('rtl');
        expect(root(mapper).querySelector('.sr-only')!.textContent).toContain('החצים מזיזים');
    });
});

describe('ge-field-mapper accessibility', () => {
    it.each(['light', 'dark'])('has no axe violations with links in %s', async (mode) => {
        useTheme(mode);
        const { page, mapper } = await setup({ links: EXPECTED.map((l) => ({ ...l })), attrs: 'searchable' });
        await settle(page);
        const results = await axe.run(mapper);
        expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`)).toEqual([]);
    });
});

export type { TemplateResult };

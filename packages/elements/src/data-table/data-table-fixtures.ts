/**
 * Test kit of the data table, for `*.browser.test.ts` files (excluded from coverage by the `*-fixtures.ts` rule):
 * data, columns, mounting, settling and reading the rendered grid. Real input lives in data-table-input-fixtures.ts.
 */
import { afterEach } from 'vitest';
import { cdp } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import type { GeDataTable } from './data-table.js';
import type { ColumnDef } from './data-table.types.js';

export interface SampleRow {
    id: string;
    name: string;
    age: number;
    [field: string]: unknown;
}

/** Four rows with known names and ages, and two columns, the defaults of `mountTable`. */
export const SAMPLE_ROWS: SampleRow[] = [
    { id: 'a', name: 'Carol', age: 41 },
    { id: 'b', name: 'Alice', age: 30 },
    { id: 'c', name: 'Bob', age: 25 },
    { id: 'd', name: 'Dave', age: 30 },
];
export const SAMPLE_COLUMNS: ColumnDef<SampleRow>[] = [
    { accessorKey: 'name', header: 'Name', width: '200px' },
    { accessorKey: 'age', header: 'Age', width: '120px' },
];

export interface RowShape {
    /** Extra fields `c0..c{n-1}`, for a wide grid (pair with `makeColumns(n)`). */
    columns?: number;
    /** Spread the rows over this many groups, in the `group` field (`g0`, `g1`, ...). */
    groups?: number;
    /** Give every row this many children (`children`, ids `<id>-c<j>`), for tree mode. */
    children?: number;
}

/** `n` rows `{ id: 'r<i>', name: 'n<i>', age: i % 50 }`, plus whatever `shape` asks for. */
export function makeRows(n: number, shape: RowShape = {}): SampleRow[] {
    const row = (id: string, i: number): SampleRow => ({
        id,
        name: `n${i}`,
        age: i % 50,
        ...(shape.groups ? { group: `g${i % shape.groups}` } : {}),
        ...Object.fromEntries(Array.from({ length: shape.columns ?? 0 }, (_, c) => [`c${c}`, `${i}.${c}`])),
    });
    return Array.from({ length: n }, (_, i) => {
        const id = `r${i}`;
        const children = Array.from({ length: shape.children ?? 0 }, (_, j) => row(`${id}-c${j}`, i * 100 + j));
        return shape.children ? { ...row(id, i), children } : row(id, i);
    });
}

export interface ColumnShape {
    width?: string;
    /** The first this many columns are pinned left, the last `pinRight` right. */
    pinLeft?: number;
    pinRight?: number;
}

/** `n` columns `c0..c{n-1}` with header `C0..`. */
export function makeColumns(n: number, { width = '150px', pinLeft = 0, pinRight = 0 }: ColumnShape = {}): ColumnDef<SampleRow>[] {
    return Array.from({ length: n }, (_, i) => ({
        accessorKey: `c${i}`,
        header: `C${i}`,
        width,
        ...(i < pinLeft ? { pin: 'left' as const } : i >= n - pinRight ? { pin: 'right' as const } : {}),
    }));
}

const mounted: HTMLElement[] = [];
afterEach(() => {
    for (const el of mounted.splice(0)) el.remove();
});

/** Removes `el` (a table, or a box that holds one) after the current test. */
export function trackTable<E extends HTMLElement>(el: E): E {
    mounted.push(el);
    return el;
}

export interface Box {
    width: number | string;
    height: number | string;
}

const px = (v: number | string): string => (typeof v === 'number' ? `${v}px` : v);

/**
 * Creates a table, assigns `props` as properties and `attrs` as attributes, appends it (inside a sized box when `box` is
 * given, which is what virtual scroll needs) and waits for it to settle. Removed after the test.
 */
export async function mountTable<T = SampleRow>(props: Partial<Record<keyof GeDataTable<T>, unknown>> = {}, attrs: Record<string, string> = {}, box?: Box): Promise<GeDataTable<T>> {
    const table = document.createElement('ge-data-table') as GeDataTable<T>;
    for (const [name, value] of Object.entries(attrs)) table.setAttribute(name, value);
    Object.assign(table, { columns: SAMPLE_COLUMNS, data: SAMPLE_ROWS, ...props });
    if (box) {
        const frame = trackTable(document.createElement('div'));
        frame.style.cssText = `width: ${px(box.width)}; height: ${px(box.height)};`;
        document.body.append(frame);
        frame.append(table);
    } else {
        document.body.append(table);
        trackTable(table);
    }
    await settle(table);
    return table;
}

/** The table and the sub-elements it rendered have finished rendering, and a frame has passed. */
export async function settle(table: HTMLElement & { updateComplete: Promise<boolean> }): Promise<void> {
    await table.updateComplete;
    const subs = [...table.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('ge-data-table-column-header, ge-data-table-pager, ge-checkbox, ge-input')];
    await Promise.all(subs.map((el) => el.updateComplete));
    await new Promise((resolve) => requestAnimationFrame(resolve));
}

const attr = (value: string): string => CSS.escape(value);

export const q = (root: Element, selector: string): HTMLElement => root.querySelector<HTMLElement>(selector)!;
export const qa = (root: Element, selector: string): HTMLElement[] => [...root.querySelectorAll<HTMLElement>(selector)];

/** The drawn data rows (not group, detail, empty or spacer rows), in DOM order. */
export const bodyRows = (table: Element): HTMLElement[] => qa(table, '[data-slot="table-body"] > [data-slot="table-row"][data-kind="data"]');
export const cellAt = (table: Element, row: number, key: string): HTMLElement | null => table.querySelector<HTMLElement>(`[data-slot="table-cell"][data-row-index="${row}"][data-column="${attr(key)}"]`);
export const headCell = (table: Element, key: string): HTMLElement => q(table, `[data-slot="table-head"][data-column-id="${attr(key)}"]`);

/** Every tab stop of the grid (the viewport and what is inside it): the roving model keeps this at one. */
export const roving = (table: Element): HTMLElement[] => {
    const viewport = q(table, '[data-slot="data-table-viewport"]');
    return [viewport, ...qa(viewport, '*')].filter((el) => el.getAttribute('tabindex') === '0');
};

/** `data-row-index` of every drawn data row. */
export const dataIndexes = (table: Element): number[] => bodyRows(table).map((r) => Number(r.dataset['rowIndex']));
/** `aria-rowindex` of every drawn data row. */
export const ariaIndexes = (table: Element): number[] => bodyRows(table).map((r) => Number(r.getAttribute('aria-rowindex')));

/**
 * One Chrome DevTools Protocol call on the page. The library's tsconfig does not see the browser provider's typing of
 * `cdp()`, so the call is typed here, loosely: callers say what they read.
 */
export const send = <R = void>(method: string, params?: Record<string, unknown>): Promise<R> =>
    (cdp() as unknown as { send(method: string, params?: Record<string, unknown>): Promise<R> }).send(method, params);

export interface AxNode {
    role?: { value?: string };
    name?: { value?: string };
    properties?: { name: string; value: { value?: unknown } }[];
}

/** The accessibility tree of the test page; the page runs in an iframe of the runner, so its frame is asked for. */
export async function axTree(): Promise<AxNode[]> {
    interface FrameTree {
        frame: { id: string; url: string };
        childFrames?: FrameTree[];
    }
    await send('Accessibility.enable');
    try {
        const { frameTree } = await send<{ frameTree: FrameTree }>('Page.getFrameTree');
        const find = (tree: FrameTree): string | undefined => (tree.frame.url === location.href ? tree.frame.id : tree.childFrames?.map(find).find(Boolean));
        const frameId = find(frameTree);
        if (!frameId) throw new Error('axTree: the test page is not in the frame tree (looked for ' + location.href + ')');
        return (await send<{ nodes: AxNode[] }>('Accessibility.getFullAXTree', { frameId })).nodes;
    } finally {
        await send('Accessibility.disable');
    }
}

/** A node's properties by name (`focused`, `expanded`, `selected`, `checked`, `level`, ...). */
export const axProps = (node: AxNode | undefined): Record<string, unknown> => Object.fromEntries((node?.properties ?? []).map((p) => [p.name, p.value.value]));

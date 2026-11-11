/**
 * Real input for the data table's browser tests, through CDP and `userEvent`: a wheel that scrolls, a drag with real
 * hit-testing and pointer capture, touch that flips `(pointer: coarse)`. Handlers driven with fake events cannot show
 * pointer capture, `touch-action`, sticky hit-testing, scroll anchoring or ResizeObserver feedback; these can.
 *
 * The test page runs in an iframe of the runner while CDP input goes to the top page, so coordinates are converted from
 * the page's own to the top page's (frame offset and scale).
 */
import { afterEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import { useTheme } from '../test-utils.js';
import { send, settle } from './data-table-fixtures.js';

export type Point = { x: number; y: number };
/** An element (its centre) or a point in the page's own coordinates. */
export type Target = Element | Point;
export type Offset = Point | { dx: number; dy: number };

export const frames = async (n = 1): Promise<void> => {
    for (let i = 0; i < n; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
};

/** A frame, then until `target` reports `scrollend` (or two more frames when it never will). */
export async function idle(target?: EventTarget): Promise<void> {
    await frames(1);
    if (!target) return;
    const stop = new AbortController();
    try {
        await Promise.race([new Promise((resolve) => target.addEventListener('scrollend', resolve, { once: true, signal: stop.signal })), frames(2)]);
    } finally {
        stop.abort();
    }
}

const scrollerOf = (el: Element): HTMLElement => (el.matches('ge-data-table') ? el.querySelector<HTMLElement>('[data-slot="data-table-viewport"]')! : (el as HTMLElement));

/**
 * Sets the scroll offset of a scroller (or of a table's viewport) and resolves once the scroll has landed: on `scrollend`
 * when the offset changed, after two frames when it did not.
 */
export async function scrollGrid(el: Element, { top, left }: { top?: number; left?: number }): Promise<void> {
    const scroller = scrollerOf(el);
    const before = [scroller.scrollTop, scroller.scrollLeft];
    // Instant, whatever the page asks for: a smooth scroll would leave the offset unchanged right after the assignment.
    const behavior = scroller.style.scrollBehavior;
    scroller.style.scrollBehavior = 'auto';
    if (top !== undefined) scroller.scrollTop = top;
    if (left !== undefined) scroller.scrollLeft = left;
    scroller.style.scrollBehavior = behavior;
    if (scroller.scrollTop === before[0] && scroller.scrollLeft === before[1]) return frames(2);
    const stop = new AbortController();
    try {
        await Promise.race([new Promise((resolve) => scroller.addEventListener('scrollend', resolve, { once: true, signal: stop.signal })), new Promise((resolve) => setTimeout(resolve, 500))]);
    } finally {
        stop.abort();
    }
    await frames(1);
}

/** Page coordinates of the test frame's point, as the top page's CDP input sees them. */
function toTop(point: Point): Point {
    const frame = window.frameElement;
    if (!frame) return point;
    const rect = frame.getBoundingClientRect();
    const scale = rect.width / (window.innerWidth || 1);
    return { x: rect.left + point.x * scale, y: rect.top + point.y * scale };
}

function pointOf(target: Target): Point {
    if (!(target instanceof Element)) return target;
    const rect = target.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

const destination = (from: Point, to: Target | Offset): Point => ('dx' in to ? { x: from.x + to.dx, y: from.y + to.dy } : pointOf(to));

const mouse = (type: 'mouseMoved' | 'mousePressed' | 'mouseReleased' | 'mouseWheel', at: Point, extra: Record<string, unknown> = {}) =>
    send('Input.dispatchMouseEvent', { type, ...toTop(at), ...extra });

/** A real wheel over the element's centre. */
export async function wheel(el: Element, dx: number, dy: number): Promise<void> {
    const at = pointOf(el);
    await mouse('mouseMoved', at);
    await mouse('mouseWheel', at, { deltaX: dx, deltaY: dy });
    await idle();
}

export interface DragOptions {
    /** Intermediate `mouseMoved` events between the press and the release. */
    steps?: number;
    /** Time to hold at the end before the release. */
    holdMs?: number;
}

/** Press on `from`, move to `to` (an element, a point or an offset) in `steps` moves, release. Real hit-testing and pointer capture. */
export async function mouseDrag(from: Target, to: Target | Offset, { steps = 8, holdMs = 0 }: DragOptions = {}): Promise<void> {
    const start = pointOf(from);
    const end = destination(start, to);
    await mouse('mouseMoved', start);
    await mouse('mousePressed', start, { button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= steps; i++) {
        await mouse('mouseMoved', { x: start.x + ((end.x - start.x) * i) / steps, y: start.y + ((end.y - start.y) * i) / steps }, { button: 'left', buttons: 1 });
    }
    if (holdMs > 0) await new Promise((resolve) => setTimeout(resolve, holdMs));
    await mouse('mouseReleased', end, { button: 'left', buttons: 0, clickCount: 1 });
    await idle();
}

/** Two presses and releases in a row: `click`, `click` and `dblclick` reach the element. */
export async function mouseDblClick(target: Target): Promise<void> {
    const at = pointOf(target);
    await mouse('mouseMoved', at);
    for (const clickCount of [1, 2]) {
        await mouse('mousePressed', at, { button: 'left', buttons: 1, clickCount });
        await mouse('mouseReleased', at, { button: 'left', buttons: 0, clickCount });
    }
    await idle();
}

/**
 * Moves the mouse to the bottom-right corner of the page, where no test puts a table, so a pointer left over from an
 * earlier file cannot hover a row mid-measure.
 */
export async function parkMouse(): Promise<void> {
    await mouse('mouseMoved', { x: window.innerWidth - 1, y: window.innerHeight - 1 });
    await frames(1);
}

// ---- touch -------------------------------------------------------------------------------------------------------

let touching = false;

/** Turns touch emulation on or off; on flips `(pointer: coarse)`. Off again after every test that used it. */
export async function emulateTouch(enabled: boolean): Promise<void> {
    touching = enabled;
    await send('Emulation.setTouchEmulationEnabled', { enabled, maxTouchPoints: 1 });
}

afterEach(async () => {
    if (touching) await emulateTouch(false);
});

const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', at?: Point) => {
    if (!touching) await emulateTouch(true);
    await send('Input.dispatchTouchEvent', { type, touchPoints: at ? [toTop(at)] : [] });
};

export async function touchTap(target: Target): Promise<void> {
    const at = pointOf(target);
    await touch('touchStart', at);
    await touch('touchEnd');
    await idle();
}

export async function touchDrag(from: Target, to: Target | Offset, { steps = 8, holdMs = 0 }: DragOptions = {}): Promise<void> {
    const start = pointOf(from);
    const end = destination(start, to);
    await touch('touchStart', start);
    for (let i = 1; i <= steps; i++) await touch('touchMove', { x: start.x + ((end.x - start.x) * i) / steps, y: start.y + ((end.y - start.y) * i) / steps });
    if (holdMs > 0) await new Promise((resolve) => setTimeout(resolve, holdMs));
    await touch('touchEnd');
    await idle();
}

/** Touch down, hold for `ms` without moving, lift. */
export async function touchLongPress(target: Target, ms = 600): Promise<void> {
    await touch('touchStart', pointOf(target));
    await new Promise((resolve) => setTimeout(resolve, ms));
    await touch('touchEnd');
    await idle();
}

// ---- keys, timing, environment -----------------------------------------------------------------------------------

/** `userEvent.keyboard`, then a frame, so the render a key caused has happened. */
export async function press(keys: string): Promise<void> {
    await userEvent.keyboard(keys);
    await frames(1);
}

export interface PerfResult {
    elapsedMs: number;
    scriptMs: number;
    layoutMs: number;
    styleMs: number;
    layoutCount: number;
    /** DOM nodes of the page after `fn`. */
    nodes: number;
    longTasks: number;
    maxLongTaskMs: number;
    frameDeltas: number[];
    p95FrameMs: number;
}

const metricsOf = async (): Promise<Record<string, number>> =>
    Object.fromEntries((await send<{ metrics: { name: string; value: number }[] }>('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));

/** Runs `fn` and reports CDP metric deltas, long tasks and frame deltas, as plain numbers for soft assertions. */
export async function perf(fn: () => Promise<void> | void): Promise<PerfResult> {
    await send('Performance.enable');
    const longTasks: number[] = [];
    const observer = new PerformanceObserver((list) => longTasks.push(...list.getEntries().map((e) => e.duration)));
    observer.observe({ type: 'longtask', buffered: false });
    const deltas: number[] = [];
    let running = true;
    let last = performance.now();
    const tick = (now: number) => {
        if (!running) return;
        deltas.push(now - last);
        last = now;
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const before = await metricsOf();
    const started = performance.now();
    await fn();
    const elapsedMs = performance.now() - started;
    const after = await metricsOf();
    running = false;
    observer.takeRecords().forEach((e) => longTasks.push(e.duration));
    observer.disconnect();
    const ms = (name: string) => (((after[name] ?? 0) - (before[name] ?? 0)) * 1000);
    const sorted = [...deltas].sort((a, b) => a - b);
    return {
        elapsedMs,
        scriptMs: ms('ScriptDuration'),
        layoutMs: ms('LayoutDuration'),
        styleMs: ms('RecalcStyleDuration'),
        layoutCount: (after['LayoutCount'] ?? 0) - (before['LayoutCount'] ?? 0),
        nodes: after['Nodes'] ?? 0,
        longTasks: longTasks.length,
        maxLongTaskMs: Math.max(0, ...longTasks),
        frameDeltas: deltas,
        p95FrameMs: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0,
    };
}

const constructed = new Map<string, { count: number }>();

/** Defines `tag` as a plain element that counts its constructions (once per tag per page); read or reset the count on the result. */
export function countConstructions(tag: string): { readonly count: number; reset(): void } {
    let entry = constructed.get(tag);
    if (!entry) {
        const own = { count: 0 };
        entry = own;
        constructed.set(tag, own);
        customElements.define(
            tag,
            class extends HTMLElement {
                constructor() {
                    super();
                    own.count++;
                }
            },
        );
    }
    const counter = entry;
    return {
        get count() {
            return counter.count;
        },
        reset() {
            counter.count = 0;
        },
    };
}

/** Switches the table to right-to-left the way a consumer does (`dir="rtl"`) and waits for it to settle. */
export async function withRtl(table: HTMLElement & { updateComplete: Promise<boolean> }): Promise<void> {
    table.setAttribute('dir', 'rtl');
    await settle(table);
}

export { useTheme as withTheme };

// ---- wave 5 (filters and editing) helpers: joint step 0; afterwards append-only, in `data-table-edit-fixtures.ts` for new ones ---------

/** Resolves once `tag` is defined: a lazily loaded element (filter panel, builder, date picker) is ready to be asserted on. */
export const whenDefined = (tag: string): Promise<CustomElementConstructor> => customElements.whenDefined(tag);

/** Focuses `el` and types `text` with real key events (a text input, an editor, a floating filter). */
export async function typeText(el: HTMLElement, text: string): Promise<void> {
    el.focus();
    await userEvent.type(el, text);
    await frames(1);
}

/** Two touch taps `gapMs` apart on the same target: a double tap when the gap is inside the table's window (300 ms). */
export async function touchDoubleTap(target: Target, gapMs = 120): Promise<void> {
    await touchTap(target);
    await new Promise((resolve) => setTimeout(resolve, gapMs));
    await touchTap(target);
}

/**
 * Clicks a popover trigger, waits for its content to be drawn and, with `lazyTag`, for that lazily loaded element to be defined.
 * Resolves with the popover content, or null when none opened.
 */
export async function openPopover(trigger: Element, lazyTag?: string): Promise<HTMLElement | null> {
    await userEvent.click(trigger);
    await frames(2);
    if (lazyTag) await whenDefined(lazyTag);
    await frames(1);
    return trigger.closest('ge-popover')?.querySelector<HTMLElement>('ge-popover-content') ?? null;
}

// ---- wave 6 (spreadsheet and drag) helpers --------------------------------------------------------------------------------------------

/** Touch down, hold `holdMs` (the long-press time), drag to `to` in `steps` moves, lift: the touch range gesture. */
export async function touchLongPressDrag(from: Target, to: Target | Offset, { holdMs = 600, steps = 8 }: DragOptions = {}): Promise<void> {
    const start = pointOf(from);
    const end = destination(start, to);
    await touch('touchStart', start);
    await new Promise((resolve) => setTimeout(resolve, holdMs));
    for (let i = 1; i <= steps; i++) await touch('touchMove', { x: start.x + ((end.x - start.x) * i) / steps, y: start.y + ((end.y - start.y) * i) / steps });
    await touch('touchEnd');
    await idle();
}

export interface FakeClipboard {
    /** What was last written, or '' . */
    readonly text: string;
    /** Every `writeText` call, in order. */
    readonly writes: string[];
    /** Every `readText` call count. */
    readonly reads: { count: number };
    /** Puts `navigator.clipboard` back; call in `afterEach`. */
    restore(): void;
}

/**
 * Installs a `navigator.clipboard` whose `writeText` and `readText` work on `text` and record their calls. `denyWrite` / `denyRead`
 * make that method reject like a refused permission; `missing` removes the API (an insecure context, an old browser).
 */
export function fakeClipboard({ denyWrite = false, denyRead = false, missing = false, text = '' }: { denyWrite?: boolean; denyRead?: boolean; missing?: boolean; text?: string } = {}): FakeClipboard {
    const original = Object.getOwnPropertyDescriptor(Navigator.prototype, 'clipboard');
    const state: { text: string; writes: string[]; reads: { count: number } } = { text, writes: [], reads: { count: 0 } };
    const denied = (): Promise<never> => Promise.reject(new DOMException('Clipboard permission denied', 'NotAllowedError'));
    const clipboard = missing
        ? undefined
        : {
              writeText: (value: string): Promise<void> => {
                  if (denyWrite) return denied();
                  state.writes.push(value);
                  state.text = value;
                  return Promise.resolve();
              },
              readText: (): Promise<string> => {
                  state.reads.count++;
                  return denyRead ? denied() : Promise.resolve(state.text);
              },
          };
    Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
    return {
        get text() {
            return state.text;
        },
        writes: state.writes,
        reads: state.reads,
        restore() {
            delete (navigator as { clipboard?: unknown }).clipboard;
            if (original) Object.defineProperty(Navigator.prototype, 'clipboard', original);
        },
    };
}

/** A native `paste` event carrying `text` as `text/plain`, dispatched on `el`; resolves with whether it was left alone (not default-prevented). */
export function dispatchPaste(el: Element, text: string): boolean {
    const data = new DataTransfer();
    data.setData('text/plain', text);
    return el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true, composed: true }));
}

/** A native `copy` event on `el`; the returned `data` holds what a handler set. */
export function dispatchCopy(el: Element): { data: DataTransfer; notPrevented: boolean } {
    const data = new DataTransfer();
    const notPrevented = el.dispatchEvent(new ClipboardEvent('copy', { clipboardData: data, bubbles: true, cancelable: true, composed: true }));
    return { data, notPrevented };
}

/**
 * A real HTML5 drag and drop from `from` to `to` through the browser (`userEvent.dragAndDrop`). A native drag cannot be paused
 * half way: for an indicator held at a position use `syntheticDrag`.
 */
export async function nativeDrag(from: Element, to: Element): Promise<void> {
    await userEvent.dragAndDrop(from, to);
    await frames(2);
}

/** A synthetic `DragEvent` (`dragstart`, `dragover`, `drop`, `dragend`...) with a real `DataTransfer`, at `x`, `y` of the page, optionally carrying `data` by mime type. */
export function syntheticDrag(el: Element, type: string, { x, y, data = {} }: { x?: number; y?: number; data?: Record<string, string> } = {}): { event: DragEvent; defaultPrevented: boolean } {
    const dataTransfer = new DataTransfer();
    for (const [mime, value] of Object.entries(data)) dataTransfer.setData(mime, value);
    const rect = el.getBoundingClientRect();
    const event = new DragEvent(type, {
        dataTransfer,
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: x ?? rect.left + rect.width / 2,
        clientY: y ?? rect.top + rect.height / 2,
    });
    el.dispatchEvent(event);
    return { event, defaultPrevented: event.defaultPrevented };
}

/** Collects `unhandledrejection` events until `stop()`: the denied-clipboard tests assert that none escaped. */
export function unhandledRejections(): { readonly reasons: unknown[]; stop(): void } {
    const reasons: unknown[] = [];
    const listener = (event: PromiseRejectionEvent): void => {
        reasons.push(event.reason);
        event.preventDefault();
    };
    window.addEventListener('unhandledrejection', listener);
    return { reasons, stop: () => window.removeEventListener('unhandledrejection', listener) };
}

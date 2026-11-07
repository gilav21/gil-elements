import { render } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RICH_TEXT_IMAGES_LOCALES } from './images-locale.js';
import { ImageResizer, type ResizeHandle } from './images-resizer.js';
import type { ImageAlignment } from './images-utils.js';

const EN = RICH_TEXT_IMAGES_LOCALES.en;
const LABELS = { inline: EN.inline, floatLeft: EN.floatLeft, center: EN.center, floatRight: EN.floatRight, deleteImage: EN.deleteImage };
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const rectOf = (width: number, height: number, top = 0, left = 0) => ({ width, height, top, left, right: left + width, bottom: top + height }) as DOMRect;

function buildImage(width: number, height: number): HTMLImageElement {
    const el = document.createElement('img');
    el.getBoundingClientRect = () => rectOf(width, height);
    return el;
}

const startEvent = (clientX = 0, clientY = 0) =>
    ({ clientX, clientY, preventDefault: vi.fn(), stopPropagation: vi.fn() }) as unknown as MouseEvent;

const touchStart = (clientX: number, clientY: number) =>
    ({ touches: [{ clientX, clientY }], changedTouches: [{ clientX, clientY }], preventDefault: vi.fn(), stopPropagation: vi.fn() }) as unknown as TouchEvent;

function dispatchTouch(type: string, clientX: number, clientY: number): void {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'touches', { value: [{ clientX, clientY }] });
    Object.defineProperty(event, 'changedTouches', { value: [{ clientX, clientY }] });
    document.dispatchEvent(event);
}

const mouseMove = (clientX: number, clientY = 0) => document.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY }));
const mouseUp = () => document.dispatchEvent(new MouseEvent('mouseup'));

interface Harness {
    readonly resizer: ImageResizer;
    readonly host: HTMLElement;
    readonly ended: number[];
    readonly aligned: ImageAlignment[];
    readonly removed: HTMLImageElement[];
    renders: number;
    container: HTMLElement | null;
    paint(): void;
}

const live: Harness[] = [];

function harness(configure?: (resizer: ImageResizer) => void): Harness {
    const container = document.createElement('div');
    container.getBoundingClientRect = () => rectOf(200, 200);
    document.body.append(container);
    const host = document.createElement('div');
    document.body.append(host);
    const state: Harness = {
        host,
        container,
        ended: [],
        aligned: [],
        removed: [],
        renders: 0,
        paint: () => render(resizer.render(), host),
        resizer: undefined as unknown as ImageResizer,
    };
    const resizer = new ImageResizer({
        doc: document,
        container: () => state.container,
        requestRender: () => {
            state.renders++;
        },
        onResizeEnd: () => state.ended.push(1),
        onAlign: (align) => state.aligned.push(align),
        onRemove: (image) => state.removed.push(image),
    });
    Object.assign(state, { resizer });
    resizer.labels = LABELS;
    configure?.(resizer);
    live.push(state);
    return state;
}

afterEach(() => {
    for (const { resizer, host, container } of live.splice(0)) {
        resizer.dispose();
        host.remove();
        container?.remove();
    }
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('delete and align', () => {
    it('does not report a removal when there is no target', () => {
        const { resizer, removed } = harness();
        resizer.onDeleteClick(startEvent());
        expect(removed).toEqual([]);
    });

    it('calls preventDefault and stopPropagation on the delete event', () => {
        const { resizer } = harness();
        resizer.setTarget(document.createElement('img'));
        const event = startEvent();
        resizer.onDeleteClick(event);
        expect(event.preventDefault).toHaveBeenCalled();
        expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('does not report an alignment when there is no target', () => {
        const { resizer, aligned } = harness();
        resizer.onAlignClick(startEvent(), 'center');
        expect(aligned).toEqual([]);
    });

    it('reads the alignment from the data-align attribute of the target', () => {
        const { resizer } = harness();
        const img = document.createElement('img');
        img.dataset['align'] = 'left';
        resizer.setTarget(img);
        expect(resizer.alignment).toBe('left');
    });

    it('reports inline when the target has no data-align attribute', () => {
        const { resizer } = harness();
        resizer.setTarget(document.createElement('img'));
        expect(resizer.alignment).toBe('inline');
    });

    it('maps alignments to the provided labels', () => {
        const { resizer } = harness();
        expect([resizer.alignmentLabel('inline'), resizer.alignmentLabel('left'), resizer.alignmentLabel('center'), resizer.alignmentLabel('right')])
            .toEqual([LABELS.inline, LABELS.floatLeft, LABELS.center, LABELS.floatRight]);
    });
});

describe('resize drag', () => {
    function dragged(width = 100, height = 50, configure?: (resizer: ImageResizer) => void) {
        const state = harness(configure);
        const img = buildImage(width, height);
        state.resizer.setTarget(img);
        const drag = (handle: ResizeHandle, deltaX: number, deltaY = 0): void => {
            state.resizer.startResize(startEvent(), handle);
            mouseMove(deltaX, deltaY);
        };
        return { ...state, img, drag };
    }

    it('grows width and height (keeping aspect) when dragging the SE handle right', () => {
        const { img, drag } = dragged();
        drag('se', 50);
        expect([img.style.width, img.style.height]).toEqual(['150px', '75px']);
    });

    it('grows when dragging the NE handle right', () => {
        const { img, drag } = dragged();
        drag('ne', 20);
        expect([img.style.width, img.style.height]).toEqual(['120px', '60px']);
    });

    it('shrinks width when dragging the SW handle right', () => {
        const { img, drag } = dragged();
        drag('sw', 40);
        expect([img.style.width, img.style.height]).toEqual(['60px', '30px']);
    });

    it('shrinks when dragging the NW handle right', () => {
        const { img, drag } = dragged();
        drag('nw', 30);
        expect([img.style.width, img.style.height]).toEqual(['70px', '35px']);
    });

    it('stops AT the 20px minimum rather than freezing', () => {
        const { img, drag } = dragged();
        drag('sw', 90);
        expect([img.style.width, img.style.height]).toEqual(['40px', '20px']);
    });

    it('respects a custom minWidth floor', () => {
        const { img, drag } = dragged(100, 50, (resizer) => {
            resizer.minWidth = 80;
        });
        drag('sw', 40);
        expect([img.style.width, img.style.height]).toEqual(['160px', '80px']);
    });

    it('bounds height on the LOCKED-aspect path, which is the default', () => {
        const { resizer, img, drag } = dragged();
        drag('se', 100000);
        expect([img.style.width, img.style.height]).toEqual(['10000px', '5000px']);
        mouseUp();

        const tall = buildImage(20, 5000);
        resizer.setTarget(tall);
        drag('e', 100000);
        expect([tall.style.width, tall.style.height]).toEqual(['40px', '10000px']);
    });

    it('honours the requested width while the ratio allows it', () => {
        const { resizer, drag } = dragged();
        const banner = buildImage(2000, 40);
        resizer.setTarget(banner);
        const dragTo = (deltaX: number): string[] => {
            banner.removeAttribute('style');
            drag('e', deltaX);
            mouseUp();
            return [banner.style.width, banner.style.height];
        };

        expect(dragTo(-500)).toEqual(['1500px', '30px']);
        expect(dragTo(-1000)).toEqual(['1000px', '20px']);
        expect(dragTo(-1900)).toEqual(['1000px', '20px']);
    });

    it('keeps the ceiling and the ratio when the floor cannot hold as well', () => {
        const { resizer, drag } = dragged();
        const sliver = buildImage(10, 10000);
        resizer.setTarget(sliver);
        drag('e', 8990);
        const width = Number.parseFloat(sliver.style.width);
        const height = Number.parseFloat(sliver.style.height);
        expect(width).toBeLessThanOrEqual(10000);
        expect(height).toBeLessThanOrEqual(10000);
        expect(width / height).toBeCloseTo(10 / 10000, 6);
        mouseUp();

        resizer.maxWidth = 500;
        const banner = buildImage(2000, 40);
        resizer.setTarget(banner);
        drag('e', -1500);
        expect([banner.style.width, banner.style.height]).toEqual(['500px', '10px']);
    });

    it('clamps width to maxWidth when growing past the ceiling', () => {
        const { img, drag } = dragged(100, 50, (resizer) => {
            resizer.maxWidth = 130;
        });
        drag('se', 200);
        expect([img.style.width, img.style.height]).toEqual(['130px', '65px']);
    });

    describe('free resize (lockAspectRatio = false)', () => {
        const free = () =>
            dragged(100, 50, (resizer) => {
                resizer.lockAspectRatio = false;
            });

        it('changes only width when dragging the E edge handle', () => {
            const { img, drag } = free();
            drag('e', 40, 30);
            expect([img.style.width, img.style.height]).toEqual(['140px', '50px']);
        });

        it('changes only height when dragging the S edge handle', () => {
            const { img, drag } = free();
            drag('s', 40, 30);
            expect([img.style.width, img.style.height]).toEqual(['100px', '80px']);
        });

        it('changes both axes non-uniformly when dragging a corner', () => {
            const { img, drag } = free();
            drag('se', 40, 10);
            expect([img.style.width, img.style.height]).toEqual(['140px', '60px']);
        });

        it('clamps height at the minimum instead of freezing the drag', () => {
            const { img, drag } = free();
            drag('n', 0, 400);
            expect([img.style.width, img.style.height]).toEqual(['100px', '20px']);
        });

        it('bounds height at an absolute maximum', () => {
            const { img, drag } = free();
            drag('se', 100, 100000);
            expect([img.style.width, img.style.height]).toEqual(['200px', '10000px']);
        });

        it('bounds WIDTH at both ends, like height', () => {
            const { img, drag } = free();
            drag('e', 100000);
            expect(img.style.width).toBe('10000px');
            mouseUp();

            drag('e', -5000);
            expect([img.style.width, img.style.height]).toEqual(['20px', '50px']);
        });
    });

    it('reports the end on mouseup and clears drag listeners', () => {
        const { img, drag, ended } = dragged();
        drag('se', 50);
        mouseUp();
        expect(ended).toHaveLength(1);

        mouseMove(200);
        expect(img.style.width).toBe('150px');
    });

    it('ignores pointer moves after the target is cleared mid-drag', () => {
        const { resizer, img } = dragged();
        const errors: unknown[] = [];
        const onError = (event: ErrorEvent): void => {
            errors.push(event.error);
            event.preventDefault();
        };
        globalThis.addEventListener('error', onError);
        try {
            resizer.startResize(startEvent(), 'se');
            resizer.setTarget(null);
            mouseMove(50);
            mouseUp();
        } finally {
            globalThis.removeEventListener('error', onError);
        }
        expect(errors).toEqual([]);
        expect(img.style.width).toBe('');
    });

    it('does nothing on startResize when there is no target', () => {
        const { resizer, img } = dragged();
        resizer.setTarget(null);
        expect(() => resizer.startResize(startEvent(), 'se')).not.toThrow();
        mouseMove(50);
        expect(img.style.width).toBe('');
    });

    it('calls preventDefault and stopPropagation on startResize', () => {
        const { resizer } = dragged();
        const event = startEvent();
        resizer.startResize(event, 'se');
        expect(event.preventDefault).toHaveBeenCalled();
        expect(event.stopPropagation).toHaveBeenCalled();
        mouseUp();
    });

    describe('touch input', () => {
        it('resizes via touchstart + touchmove just like the mouse', () => {
            const { resizer, img } = dragged();
            resizer.startResize(touchStart(0, 0), 'se');
            dispatchTouch('touchmove', 50, 0);
            expect([img.style.width, img.style.height]).toEqual(['150px', '75px']);
        });

        it('falls back to changedTouches when touches is empty', () => {
            const { resizer, img } = dragged();
            const event = { touches: [], changedTouches: [{ clientX: 5, clientY: 5 }], preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as TouchEvent;
            resizer.startResize(event, 'se');
            dispatchTouch('touchmove', 55, 5);
            expect([img.style.width, img.style.height]).toEqual(['150px', '75px']);
            dispatchTouch('touchend', 55, 5);
        });

        it('reports the end on touchend and clears touch listeners', () => {
            const { resizer, img, ended } = dragged();
            resizer.startResize(touchStart(0, 0), 'se');
            dispatchTouch('touchmove', 50, 0);
            dispatchTouch('touchend', 50, 0);
            expect(ended).toHaveLength(1);

            dispatchTouch('touchmove', 200, 0);
            expect(img.style.width).toBe('150px');
        });
    });
});

describe('handle and toolbar rendering', () => {
    const corners = '.image-handle[data-handle="nw"], .image-handle[data-handle="ne"], .image-handle[data-handle="sw"], .image-handle[data-handle="se"]';
    const edges = '.image-handle[data-handle="n"], .image-handle[data-handle="s"], .image-handle[data-handle="e"], .image-handle[data-handle="w"]';

    function painted(configure?: (resizer: ImageResizer) => void) {
        const state = harness(configure);
        state.resizer.setTarget(document.createElement('img'));
        state.paint();
        return state;
    }

    it('renders nothing without a target', () => {
        const { host, paint, resizer } = harness();
        paint();
        expect(host.querySelector('[data-slot="rte-image-resizer"]')).toBeNull();
        resizer.setTarget(document.createElement('img'));
        paint();
        expect(host.querySelector('[data-slot="rte-image-resizer"]')).not.toBeNull();
    });

    it('renders four corner handles by default', () => {
        expect(painted().host.querySelectorAll(corners)).toHaveLength(4);
    });

    it('hides corner handles when resizable is false', () => {
        expect(painted((resizer) => (resizer.resizable = false)).host.querySelectorAll(corners)).toHaveLength(0);
    });

    it('hides edge handles while aspect ratio is locked', () => {
        expect(painted().host.querySelectorAll(edges)).toHaveLength(0);
    });

    it('shows four edge handles when aspect ratio is unlocked', () => {
        expect(painted((resizer) => (resizer.lockAspectRatio = false)).host.querySelectorAll(edges)).toHaveLength(4);
    });

    it('renders alignment buttons plus delete by default', () => {
        expect(painted().host.querySelectorAll('button[title]')).toHaveLength(5);
    });

    it('keeps only the delete button when showAlignment is false', () => {
        const buttons = painted((resizer) => (resizer.showAlignment = false)).host.querySelectorAll('button[title]');
        expect(buttons).toHaveLength(1);
        expect(buttons[0]?.getAttribute('title')).toBe(LABELS.deleteImage);
    });

    it('marks the current alignment as pressed', () => {
        const { host, resizer, paint } = painted();
        resizer.target!.dataset['align'] = 'center';
        paint();
        const pressed = [...host.querySelectorAll('[data-align]')].filter((el) => el.getAttribute('aria-pressed') === 'true');
        expect(pressed.map((el) => el.getAttribute('data-align'))).toEqual(['center']);
    });
});

describe('tracking lifecycle', () => {
    function visible(configure?: (state: Harness) => void) {
        const state = harness();
        let top = 10;
        const img = document.createElement('img');
        img.getBoundingClientRect = () => rectOf(80, 40, top, 10);
        configure?.(state);
        state.resizer.setTarget(img);
        return { ...state, img, moveTo: (next: number) => (top = next) };
    }

    it('becomes visible and computes a rect when the target overlaps the container', async () => {
        const { resizer } = visible();
        await frame();
        expect(resizer.visible).toBe(true);
        expect(resizer.rect).toEqual({ top: 10, left: 10, width: 80, height: 40 });
    });

    it('asks for a render when the frame moves, and not when it stays', async () => {
        const { container } = visible();
        const state = live.at(-1)!;
        await frame();
        const after = state.renders;
        expect(after).toBeGreaterThan(0);
        container!.dispatchEvent(new Event('scroll'));
        await frame();
        expect(state.renders).toBe(after);
    });

    it('lays the frame out relative to the origin element when one is given', async () => {
        const state = harness();
        const origin = document.createElement('div');
        origin.getBoundingClientRect = () => rectOf(300, 300, 4, 6);
        const resizer = new ImageResizer({
            doc: document,
            container: () => state.container,
            origin: () => origin,
            requestRender: () => undefined,
            onResizeEnd: () => undefined,
            onAlign: () => undefined,
            onRemove: () => undefined,
        });
        const img = document.createElement('img');
        img.getBoundingClientRect = () => rectOf(80, 40, 10, 10);
        resizer.setTarget(img);
        await frame();
        expect(resizer.rect).toEqual({ top: 6, left: 4, width: 80, height: 40 });
        resizer.dispose();
    });

    it('hides when the target is scrolled out of the container', async () => {
        const { resizer, moveTo, container } = visible();
        moveTo(500);
        container!.dispatchEvent(new Event('scroll'));
        await frame();
        expect(resizer.visible).toBe(false);
    });

    it('hides when the container goes away while a target is tracked', async () => {
        const { resizer, img } = visible();
        await frame();
        const state = live.at(-1)!;
        state.container = null;
        resizer.setTarget(img);
        await frame();
        expect(resizer.visible).toBe(false);
    });

    it('stops listening to a container once it is replaced', async () => {
        const { resizer, img, container, moveTo } = visible();
        await frame();
        const next = document.createElement('div');
        next.getBoundingClientRect = container!.getBoundingClientRect;
        document.body.append(next);
        live.at(-1)!.container = next;
        resizer.setTarget(img);
        await frame();

        moveTo(70);
        container!.dispatchEvent(new Event('scroll'));
        await frame();

        expect(resizer.rect.top).toBe(10);
        next.remove();
    });

    it('stops tracking and hides when the target is cleared', async () => {
        const { resizer } = visible();
        await frame();
        resizer.setTarget(null);
        expect(resizer.visible).toBe(false);
        expect(resizer.target).toBeNull();
    });

    it('re-measures on container scroll and window resize', async () => {
        const { resizer, container, moveTo } = visible();
        await frame();

        moveTo(30);
        container!.dispatchEvent(new Event('scroll'));
        await frame();
        expect(resizer.rect.top).toBe(30);

        moveTo(50);
        globalThis.dispatchEvent(new Event('resize'));
        await frame();
        expect(resizer.rect.top).toBe(50);
    });

    it('re-measures when the ResizeObserver fires', async () => {
        let observed: (() => void) | undefined;
        vi.stubGlobal('ResizeObserver', class {
            constructor(callback: () => void) {
                observed = callback;
            }
            observe(): void { /* captured */ }
            unobserve(): void { /* captured */ }
            disconnect(): void { /* captured */ }
        });
        const { resizer, moveTo } = visible();
        await frame();
        moveTo(60);
        observed!();
        await frame();
        expect(resizer.rect.top).toBe(60);
    });

    it('stops a drag in progress when disposed', () => {
        const { resizer } = harness();
        const img = buildImage(100, 50);
        resizer.setTarget(img);
        resizer.startResize(startEvent(), 'se');

        resizer.dispose();
        mouseMove(50);

        expect(img.style.width).toBe('');
    });
});

describe('keyboard activation of the overlay buttons', () => {
    function mounted() {
        const state = harness();
        const img = document.createElement('img');
        state.resizer.setTarget(img);
        state.paint();
        const byLabel = (label: string) => [...state.host.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === label)!;
        return { ...state, img, byLabel };
    }

    it('applies an alignment on a keyboard-generated click', () => {
        const { img, byLabel, aligned } = mounted();
        // A keyboard click carries detail === 0.
        byLabel(LABELS.floatRight).dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));

        expect(aligned).toEqual(['right']);
        expect(img.dataset['align']).toBe('right');
        expect(img.style.float).toBe('right');
    });

    it('reports a removal once for a keyboard click', () => {
        const { img, byLabel, removed } = mounted();
        byLabel(LABELS.deleteImage).dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
        expect(removed).toEqual([img]);
    });

    it('does not act twice when a mouse press fires mousedown then click', () => {
        const { byLabel, removed } = mounted();
        const del = byLabel(LABELS.deleteImage);
        del.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, detail: 1 }));
        del.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
        expect(removed).toHaveLength(1);
    });

    it('names every overlay button for assistive tech', () => {
        const { host } = mounted();
        for (const button of host.querySelectorAll('button')) expect(button.getAttribute('aria-label')?.length).toBeGreaterThan(0);
    });
});

describe('keyboard resizing', () => {
    function keyboard(width = 200, height = 100, configure: (resizer: ImageResizer) => void = (resizer) => (resizer.lockAspectRatio = false)) {
        const state = harness(configure);
        const img = buildImage(width, height);
        state.resizer.setTarget(img);
        state.paint();
        const handle = (name: ResizeHandle) => state.host.querySelector<HTMLButtonElement>(`button[aria-label="${state.resizer.handleLabel(name)}"]`)!;
        const press = (el: HTMLElement, key: string, shiftKey = false) => el.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
        return { ...state, img, handle, press };
    }

    it('honours the handle: the east edge grows on ArrowRight', () => {
        const { img, handle, press } = keyboard();
        press(handle('e'), 'ArrowRight');
        expect(img.style.width).toBe('210px');
    });

    it('honours the handle: the west edge SHRINKS on ArrowRight', () => {
        const { img, handle, press } = keyboard();
        press(handle('w'), 'ArrowRight');
        expect(img.style.width).toBe('190px');
    });

    it('does not resize width from a handle that only moves vertically', () => {
        const { img, handle, press } = keyboard();
        press(handle('n'), 'ArrowRight');
        expect(img.style.width).toBe('');
    });

    it('resizes height from the south edge on ArrowDown', () => {
        const { img, handle, press } = keyboard();
        press(handle('s'), 'ArrowDown');
        expect(img.style.height).toBe('110px');
    });

    it('takes a larger step with Shift held', () => {
        const { img, handle, press } = keyboard();
        press(handle('e'), 'ArrowRight', true);
        expect(img.style.width).toBe('250px');
    });

    it('folds a run of keypresses into ONE history entry', () => {
        vi.useFakeTimers();
        const { handle, press, ended } = keyboard();
        const east = handle('e');
        for (let i = 0; i < 5; i++) press(east, 'ArrowRight');
        expect(ended).toHaveLength(0);

        vi.advanceTimersByTime(500);
        expect(ended).toHaveLength(1);
    });

    it('does not report an end after being disposed mid-run', () => {
        vi.useFakeTimers();
        const { resizer, handle, press, ended } = keyboard();
        press(handle('e'), 'ArrowRight');
        resizer.dispose();
        vi.advanceTimersByTime(500);
        expect(ended).toHaveLength(0);
    });

    it('leaves a vertical arrow on a corner to the page when aspect is locked', () => {
        const { img, handle } = keyboard(200, 100, () => undefined);
        const event = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
        handle('se').dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
        expect(img.style.width).toBe('');
    });

    it('does not apply the WIDTH ceiling to height', () => {
        const { img, handle, press } = keyboard(200, 100, (resizer) => {
            resizer.lockAspectRatio = false;
            resizer.maxWidth = 120;
        });
        press(handle('s'), 'ArrowDown', true);
        expect(Number.parseFloat(img.style.height)).toBeGreaterThan(120);
        press(handle('e'), 'ArrowRight', true);
        expect(Number.parseFloat(img.style.width)).toBeLessThanOrEqual(120);
    });

    it('bounds height on the KEYBOARD path with the ratio locked', () => {
        const { img, handle, press } = keyboard(20, 10000, () => undefined);
        press(handle('se'), 'ArrowRight');
        expect(Number.parseFloat(img.style.height)).toBeLessThanOrEqual(10000);
    });

    it('ignores keys that are not arrows', () => {
        const { img, handle, press } = keyboard();
        press(handle('e'), 'a');
        expect(img.style.width).toBe('');
    });
});

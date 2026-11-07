import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeResizableHandle, GeResizablePanel, GeResizablePanelGroup } from './index.js';

const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const e of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await e.updateComplete;
        await new Promise((r) => setTimeout(r, 0));
    }
    await new Promise((r) => setTimeout(r, 30));
};
const group = async (attrs = '', panels = ['default-size="30" min-size="20" max-size="60"', 'default-size="70" min-size="40" max-size="80"'], handle = '') => {
    const page = await mount(`<div style="width:400px;height:300px" id="box"><ge-resizable-panel-group ${attrs} style="width:400px;height:300px"><ge-resizable-panel ${panels[0]}>A</ge-resizable-panel><ge-resizable-handle ${handle} handle-size="10"></ge-resizable-handle><ge-resizable-panel ${panels[1]}>B</ge-resizable-panel></ge-resizable-panel-group></div>`);
    await settle(page);
    const [a, b] = [...page.querySelectorAll<GeResizablePanel>('ge-resizable-panel')] as [GeResizablePanel, GeResizablePanel];
    const handleEl = page.querySelector<GeResizableHandle>('ge-resizable-handle')!;
    return { page, g: page.querySelector<GeResizablePanelGroup>('ge-resizable-panel-group')!, a, b, handleEl };
};
const sep = (h: GeResizableHandle) => h.shadowRoot!.querySelector<HTMLElement>('[role=separator]')!;
const width = (p: GeResizablePanel) => p.getBoundingClientRect().width;
const mouse = (type: string, x: number, y: number) => document.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
const down = (h: GeResizableHandle, x: number, y: number) => sep(h).dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, bubbles: true, cancelable: true }));
const key = async (page: HTMLElement, text: string) => {
    await userEvent.keyboard(text);
    await settle(page);
};

describe('ge-resizable', () => {
    it('lays the panels out at their default sizes and describes the divider to assistive technology', async () => {
        const { a, b, handleEl } = await group();
        expect([a.size, b.size]).toEqual([30, 70]);
        expect(a.style.flexBasis).toBe('30%');
        const rect = sep(handleEl).getBoundingClientRect();
        expect(rect.width).toBe(10);
        expect(sep(handleEl).getAttribute('aria-orientation')).toBe('vertical');
        expect([sep(handleEl).getAttribute('aria-valuenow'), sep(handleEl).getAttribute('aria-valuemin'), sep(handleEl).getAttribute('aria-valuemax')]).toEqual(['30', '20', '60']);
    });

    it('arrow keys move the divider 5% a press, mirrored in RTL, and settle on the limit', async () => {
        const { page, a, b, handleEl } = await group();
        const log: unknown[] = [];
        handleEl.addEventListener('resized', (e) => log.push((e as CustomEvent).detail));
        sep(handleEl).focus();
        await key(page, '{ArrowRight}');
        expect([a.size, b.size]).toEqual([35, 65]);
        expect(log).toEqual([{ delta: 0, sizes: [35, 65] }]);
        expect(sep(handleEl).getAttribute('aria-valuenow')).toBe('35');
        await key(page, '{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}');
        expect([a.size, b.size]).toEqual([20, 80]);

        const rtl = await mount('<div dir="rtl"><ge-resizable-panel-group style="width:400px"><ge-resizable-panel default-size="30">A</ge-resizable-panel><ge-resizable-handle></ge-resizable-handle><ge-resizable-panel default-size="70">B</ge-resizable-panel></ge-resizable-panel-group></div>');
        await settle(rtl);
        const [first] = [...rtl.querySelectorAll<GeResizablePanel>('ge-resizable-panel')];
        sep(rtl.querySelector<GeResizableHandle>('ge-resizable-handle')!).focus();
        await key(rtl, '{ArrowRight}');
        expect(first!.size).toBe(25);
    });

    it('a vertical group is laid out in a column and answers the Up and Down arrows', async () => {
        const { page, a, handleEl } = await group('direction="vertical"');
        expect(a.getBoundingClientRect().top).toBeLessThan(handleEl.shadowRoot!.querySelector('[role=separator]')!.getBoundingClientRect().top);
        expect(sep(handleEl).getAttribute('aria-orientation')).toBe('horizontal');
        sep(handleEl).focus();
        await key(page, '{ArrowDown}');
        expect(a.size).toBe(35);
        await key(page, '{ArrowLeft}');
        expect(a.size).toBe(35);
    });

    it('a mouse drag moves the boundary by the pixels dragged and stops dead at a limit', async () => {
        const { a, b, handleEl } = await group();
        const start = sep(handleEl).getBoundingClientRect();
        const x = start.left + 5;
        const y = start.top + 5;
        down(handleEl, x, y);
        mouse('mousemove', x + 40, y);
        expect(a.size).toBeCloseTo(((120 + 40) / 400) * 100, 5);
        expect(a.size + b.size).toBeCloseTo(100, 5);
        const before = a.size;
        mouse('mousemove', x + 300, y);
        expect(a.size).toBe(before);
        mouse('mouseup', x + 300, y);
        mouse('mousemove', x + 20, y);
        expect(a.size).toBe(before);
    });

    it('a one-finger drag resizes and a second finger is ignored', async () => {
        const { a, handleEl } = await group();
        const start = sep(handleEl).getBoundingClientRect();
        const point = (dx: number) => new Touch({ identifier: dx, target: sep(handleEl), clientX: start.left + 5 + dx, clientY: start.top + 5 });
        const fire = (type: string, touches: Touch[]) => document.dispatchEvent(new TouchEvent(type, { touches, bubbles: true, cancelable: true }));
        sep(handleEl).dispatchEvent(new TouchEvent('touchstart', { touches: [point(0), point(1)], bubbles: true, cancelable: true }));
        fire('touchmove', [point(30)]);
        expect(a.size).toBe(30);
        sep(handleEl).dispatchEvent(new TouchEvent('touchstart', { touches: [point(0)], bubbles: true, cancelable: true }));
        fire('touchmove', [point(40)]);
        expect(a.size).toBeCloseTo(40, 5);
        fire('touchmove', [point(50), point(51)]);
        expect(a.size).toBeCloseTo(40, 5);
        fire('touchend', []);
        fire('touchmove', [point(60)]);
        expect(a.size).toBeCloseTo(40, 5);
    });

    it('each limit of each panel stops a drag on its own', async () => {
        const cases = [
            { panels: ['default-size="30" max-size="50"', 'default-size="70"'], dx: 100, expectA: 30 },
            { panels: ['default-size="30"', 'default-size="70" max-size="60"'], dx: -20, expectA: 30 },
            { panels: ['default-size="30" min-size="25"', 'default-size="70"'], dx: -40, expectA: 30 },
            { panels: ['default-size="30"', 'default-size="70" min-size="60"'], dx: 60, expectA: 30 },
        ];
        for (const { panels, dx, expectA } of cases) {
            const { a, handleEl } = await group('', panels);
            const start = sep(handleEl).getBoundingClientRect();
            down(handleEl, start.left + 5, start.top + 5);
            mouse('mousemove', start.left + 5 + dx, start.top + 5);
            mouse('mouseup', 0, 0);
            expect(a.size, JSON.stringify(panels)).toBe(expectA);
        }
    });

    it('a drag in an RTL page follows the pointer, and leaves the page cursor and selection as it found them', async () => {
        const page = await mount('<div dir="rtl"><ge-resizable-panel-group style="width:400px"><ge-resizable-panel default-size="50">A</ge-resizable-panel><ge-resizable-handle></ge-resizable-handle><ge-resizable-panel default-size="50">B</ge-resizable-panel></ge-resizable-panel-group></div>');
        await settle(page);
        const [first] = [...page.querySelectorAll<GeResizablePanel>('ge-resizable-panel')];
        const handleEl = page.querySelector<GeResizableHandle>('ge-resizable-handle')!;
        const start = sep(handleEl).getBoundingClientRect();
        down(handleEl, start.left + 2, start.top + 2);
        expect(document.body.style.cursor).toBe('col-resize');
        mouse('mousemove', start.left + 2 - 40, start.top + 2);
        expect(first!.size).toBeGreaterThan(50);
        mouse('mouseup', 0, 0);
        expect([document.body.style.cursor, document.body.style.userSelect]).toEqual(['', '']);
    });

    it('removing the handle mid-drag lets go of the document', async () => {
        const { a, handleEl } = await group();
        const start = sep(handleEl).getBoundingClientRect();
        down(handleEl, start.left + 5, start.top + 5);
        handleEl.remove();
        expect(document.body.style.cursor).toBe('');
        mouse('mousemove', start.left + 45, start.top + 5);
        expect(a.size).toBe(30);
    });

    it('arrow keys settle on a limit instead of overshooting, and work between the inner panels of a group of three', async () => {
        const { page, a, b, handleEl } = await group('', ['default-size="30"', 'default-size="70" max-size="70"']);
        sep(handleEl).focus();
        await key(page, '{ArrowLeft}');
        expect([a.size, b.size]).toEqual([30, 70]);

        const three = await mount('<ge-resizable-panel-group style="width:400px"><ge-resizable-panel default-size="20">A</ge-resizable-panel><ge-resizable-handle></ge-resizable-handle><ge-resizable-panel default-size="50">B</ge-resizable-panel><ge-resizable-handle></ge-resizable-handle><ge-resizable-panel default-size="30">C</ge-resizable-panel></ge-resizable-panel-group>');
        await settle(three);
        const [, mid, last] = [...three.querySelectorAll<GeResizablePanel>('ge-resizable-panel')];
        sep([...three.querySelectorAll<GeResizableHandle>('ge-resizable-handle')][1]!).focus();
        await key(three, '{ArrowRight}');
        expect([mid!.size, last!.size]).toEqual([55, 25]);
    });

    it('setSize clamps and announces only a real change', async () => {
        const { a } = await group();
        const log: number[] = [];
        a.addEventListener('size-change', (e) => log.push((e as CustomEvent<number>).detail));
        a.setSize(99);
        expect(a.size).toBe(60);
        a.setSize(60);
        expect(log).toEqual([60]);
        expect(a.style.flexBasis).toBe('60%');
    });

    it('updateSize takes the difference out of the neighbour, within both limits', async () => {
        const { a, b } = await group();
        a.updateSize(50);
        expect([a.size, b.size]).toEqual([50, 50]);
        a.updateSize(5);
        expect([a.size, b.size]).toEqual([20, 80]);
        a.updateSize(60);
        expect([a.size, b.size]).toEqual([60, 40]);

        const capped = await group('', ['default-size="30"', 'default-size="70" max-size="70"']);
        capped.a.updateSize(25);
        expect([capped.a.size, capped.b.size]).toEqual([30, 70]);
    });

    it('a disabled handle leaves no divider and the panels meet', async () => {
        const { handleEl, a, b } = await group('', undefined, 'disabled');
        expect(handleEl.shadowRoot!.querySelector('[role=separator]')).toBeNull();
        expect(b.getBoundingClientRect().left).toBeCloseTo(a.getBoundingClientRect().right, 1);
    });

    it('re-orients its handle when the direction changes', async () => {
        const { page, g, handleEl } = await group();
        g.direction = 'vertical';
        await settle(page);
        expect(sep(handleEl).getAttribute('aria-orientation')).toBe('horizontal');
        expect(sep(handleEl).getBoundingClientRect().height).toBe(10);
    });

    for (const theme of ['light', 'dark'] as const) {
        it(`has no axe violations in ${theme}`, async () => {
            useTheme(theme);
            const { g } = await group('', undefined, 'with-handle');
            const result = await axe.run(g, { rules: { region: { enabled: false } } });
            expect(result.violations.map((v) => v.id)).toEqual([]);
        });
    }
});

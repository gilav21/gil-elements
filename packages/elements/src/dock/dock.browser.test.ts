import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { DockItemData, GeDock, GeDockItem } from './index.js';

const NAMES = ['Home', 'Files', 'Search', 'Trash', 'Mail'];
const custom = (attrs = '') =>
    `<ge-dock ${attrs}>${NAMES.map((name) => `<ge-dock-item><ge-dock-label>${name}</ge-dock-label><ge-dock-icon>${name[0]}</ge-dock-icon></ge-dock-item>`).join('')}</ge-dock>`;
const first = (page: HTMLElement) => page.querySelector<GeDock>('ge-dock')!;
const dockItems = (el: Element) => [...el.querySelectorAll<GeDockItem>('ge-dock-item')];
const bar = (el: Element) => el.shadowRoot!.querySelector<HTMLElement>('.bar')!;
const widths = (el: Element) => dockItems(el).map((item) => item.getBoundingClientRect().width);
const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const settle = () => new Promise((resolve) => setTimeout(resolve, 200));

describe('ge-dock', () => {
    it('swells items on a cosine curve around the pointer, keeps the rest at 40px, and settles on leave', async () => {
        const page = await mount(custom('magnification="70" distance="80"'));
        const el = first(page);
        await frame();
        const rest = dockItems(el).map((item) => item.getCenter('x'));
        expect(widths(el)).toEqual([40, 40, 40, 40, 40]);

        const pointer = rest[2]! + 10;
        bar(el).dispatchEvent(new MouseEvent('mouseenter'));
        bar(el).dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: pointer, clientY: 0 }));
        await frame();
        await settle();
        const expected = rest.map((centre) => {
            const offset = Math.abs(pointer - centre);
            return offset < 80 ? 40 + (70 - 40) * Math.cos((offset / 80) * (Math.PI / 2)) : 40;
        });
        const got = widths(el);
        got.forEach((width, index) => expect(width).toBeCloseTo(expected[index]!, 0));
        expect(Math.max(...got)).toBe(got[2]);
        expect(got.some((width) => width === 40)).toBe(true);

        bar(el).dispatchEvent(new MouseEvent('mouseleave'));
        await settle();
        expect(widths(el)).toEqual([40, 40, 40, 40, 40]);
    });

    it('stays at rest for a tap, though the browser replays it as mouse events, and swells again for a real mouse afterwards', async () => {
        const page = await mount(custom('magnification="70" distance="80"'));
        const el = first(page);
        await frame();
        const x = dockItems(el)[2]!.getCenter('x');
        const move = () => {
            bar(el).dispatchEvent(new MouseEvent('mouseenter'));
            bar(el).dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: 0 }));
        };
        bar(el).dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }));
        move();
        await frame();
        await settle();
        expect(widths(el)).toEqual([40, 40, 40, 40, 40]);

        bar(el).dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', bubbles: true }));
        move();
        await frame();
        await settle();
        expect(Math.max(...widths(el))).toBeGreaterThan(60);

        bar(el).dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }));
        await settle();
        expect(widths(el)).toEqual([40, 40, 40, 40, 40]);
    });

    it('a vertical dock follows the pointer along Y and stacks the whole column', async () => {
        const page = await mount(`<div style="height:600px">${custom('position="left" magnification="60" distance="100"')}</div>`);
        const el = first(page);
        await frame();
        const rects = dockItems(el).map((item) => item.getBoundingClientRect());
        for (let i = 1; i < rects.length; i++) {
            expect(rects[i]!.top).toBeGreaterThanOrEqual(rects[i - 1]!.bottom);
            expect(rects[i]!.left).toBeCloseTo(rects[0]!.left, 0);
        }
        expect(rects.every((rect) => rect.bottom <= bar(el).getBoundingClientRect().bottom)).toBe(true);

        const y = dockItems(el)[1]!.getCenter('y');
        bar(el).dispatchEvent(new MouseEvent('mouseenter'));
        bar(el).dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 0, clientY: y }));
        await frame();
        await settle();
        const got = widths(el);
        expect(got[1]).toBeCloseTo(60, 0);
        expect(got[1]).toBeGreaterThan(got[0]!);
    });

    it('aligns a horizontal dock to its bottom or top edge', async () => {
        for (const [position, edge] of [['bottom', 'bottom'], ['top', 'top']] as const) {
            const page = await mount(`<style>.tall::part(base){height:6rem}</style>${custom(`position="${position}" class="tall"`)}`);
            const el = first(page);
            const box = bar(el).getBoundingClientRect();
            const style = getComputedStyle(bar(el));
            const inner = edge === 'bottom'
                ? box.bottom - Number.parseFloat(style.borderBottomWidth) - Number.parseFloat(style.paddingBottom)
                : box.top + Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.paddingTop);
            for (const item of dockItems(el)) expect(item.getBoundingClientRect()[edge]).toBeCloseTo(inner, 0);
        }
    });

    it('builds a labelled link or button per entry, runs onClick, and lets projected items win over `items`', async () => {
        const opened: string[] = [];
        const entries: DockItemData[] = [
            { label: 'Home', icon: '🏠', href: '#home', active: true, onClick: () => opened.push('home') },
            { label: 'Search', icon: '🔍', onClick: () => opened.push('search') },
            { icon: '⚙️' },
        ];
        const page = await mount('<ge-dock></ge-dock>');
        const el = first(page);
        el.items = entries;
        await el.updateComplete;
        const rendered = [...el.shadowRoot!.querySelectorAll('ge-dock-item')];
        expect(rendered).toHaveLength(3);
        const link = rendered[0]!.querySelector('a')!;
        expect([link.getAttribute('href'), link.getAttribute('aria-label')]).toEqual(['#home', 'Home']);
        link.addEventListener('click', (event) => event.preventDefault());
        link.click();
        rendered[1]!.querySelector('button')!.click();
        expect(opened).toEqual(['home', 'search']);
        expect(rendered[2]!.querySelector('a, button')).toBeNull();
        expect(rendered[0]!.shadowRoot!.querySelector('.dot')).not.toBeNull();
        expect(rendered[1]!.shadowRoot!.querySelector('.dot')).toBeNull();

        const mixed = await mount(`<ge-dock>${'<ge-dock-item><ge-dock-icon>X</ge-dock-icon></ge-dock-item>'}</ge-dock>`);
        const withItems = first(mixed);
        withItems.items = entries;
        await withItems.updateComplete;
        await frame();
        expect(withItems.shadowRoot!.querySelectorAll('ge-dock-item')).toHaveLength(0);
    });

    it('floats the label above the icon, centred on it, only while the item is hovered', async () => {
        const page = await mount(`<div style="padding:64px">${custom()}</div>`);
        const el = first(page);
        const item = dockItems(el)[0]!;
        const label = item.querySelector('ge-dock-label')!.shadowRoot!.querySelector<HTMLElement>('.label')!;
        const icon = item.querySelector('ge-dock-icon')!.shadowRoot!.querySelector<HTMLElement>('.icon')!;
        expect(getComputedStyle(label).display).toBe('none');

        await userEvent.hover(item);
        await expect.poll(() => getComputedStyle(label).display).toBe('block');
        const l = label.getBoundingClientRect();
        const i = icon.getBoundingClientRect();
        expect(l.bottom).toBeLessThanOrEqual(i.top);
        expect(l.left + l.width / 2).toBeCloseTo(i.left + i.width / 2, 0);
        await userEvent.unhover(item);
        await expect.poll(() => getComputedStyle(label).display).toBe('none');
    });

    it('bounces for 750ms, and a second call while it runs does not restart it', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        try {
            const page = await mount(custom());
            const item = dockItems(first(page))[0]!;
            item.startBounce();
            await item.updateComplete;
            expect(item.hasAttribute('bouncing')).toBe(true);
            await vi.advanceTimersByTimeAsync(500);
            item.startBounce();
            await vi.advanceTimersByTimeAsync(300);
            await item.updateComplete;
            expect(item.hasAttribute('bouncing')).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });

    for (const theme of ['light', 'dark']) {
        describe(theme, () => {
            useTheme(theme);
            it('has no accessibility violations', async () => {
                const page = await mount(custom());
                const simple = await mount('<ge-dock></ge-dock>');
                const el = first(simple);
                el.items = [{ label: 'Home', icon: 'H', href: '#home' }, { label: 'Search', icon: 'S', onClick: () => {} }];
                await el.updateComplete;
                expect((await axe.run([page, simple])).violations.map((v) => v.id)).toEqual([]);
            });
        });
    }
});

import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import '../button/define.js';
import { mount, useTheme } from '../test-utils.js';
import { arcPosition, type GeSpeedDial } from './index.js';

const ACTIONS = ['Edit', 'Copy', 'Delete'];
const actions = (names = ACTIONS) => names.map((name) => `<ge-speed-dial-item><ge-button size="icon" aria-label="${name}">${name[0]}</ge-button></ge-speed-dial-item>`).join('');
const dial = (attrs = '', { trigger = '<ge-speed-dial-trigger>+</ge-speed-dial-trigger>', extra = '', names = ACTIONS } = {}) =>
    `<div style="position:relative;width:400px;height:400px"><ge-speed-dial ${attrs} style="position:absolute;left:180px;top:180px">${extra}${trigger}<ge-speed-dial-menu label="Actions">${actions(names)}</ge-speed-dial-menu></ge-speed-dial></div>`;

const first = (page: HTMLElement) => page.querySelector<GeSpeedDial>('ge-speed-dial')!;
const wrapper = (el: Element) => el.querySelector('ge-speed-dial-trigger')!.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
const group = (el: Element) => el.querySelector('ge-speed-dial-menu')!.shadowRoot!.querySelector<HTMLElement>('[role="group"]')!;
const buttons = (el: Element) => [...el.querySelectorAll('ge-speed-dial-item')].map((item) => item.shadowRoot!.querySelector<HTMLElement>('.item')!);
const origin = (el: Element) => centre(wrapper(el));
const centre = (target: Element) => {
    const rect = target.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};
const settle = async () => {
    await Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
};
const log = (el: GeSpeedDial) => {
    const events: string[] = [];
    for (const name of ['visible-change', 'shown', 'hidden']) {
        el.addEventListener(name, (event) => events.push(`${name}${(event as CustomEvent<unknown>).detail == null ? '' : `:${(event as CustomEvent<boolean>).detail}`}`));
    }
    return events;
};

describe('ge-speed-dial', () => {
    it('opens and closes from the trigger by click, Enter and Space, and keeps the closed menu out of reach', async () => {
        const page = await mount(dial());
        const el = first(page);
        const events = log(el);
        expect(wrapper(el).getAttribute('role')).toBe('button');
        expect(wrapper(el).getAttribute('aria-label')).toBe('Toggle speed dial');
        expect(group(el).hasAttribute('inert')).toBe(true);
        expect(group(el).getAttribute('aria-hidden')).toBe('true');
        expect(group(el).getAttribute('aria-label')).toBe('Actions');

        wrapper(el).click();
        await el.updateComplete;
        expect(el.dataset.state).toBe('open');
        expect(wrapper(el).dataset.state).toBe('open');
        expect(getComputedStyle(wrapper(el)).transform).not.toBe('none');
        expect(group(el).hasAttribute('inert')).toBe(false);
        expect(group(el).getAttribute('aria-hidden')).toBe('false');

        wrapper(el).focus();
        await userEvent.keyboard('{Enter}');
        await el.updateComplete;
        expect(el.dataset.state).toBe('closed');
        await userEvent.keyboard(' ');
        await el.updateComplete;
        expect(el.dataset.state).toBe('open');
        expect(events).toEqual(['visible-change:true', 'shown', 'visible-change:false', 'hidden', 'visible-change:true', 'shown']);
    });

    it('closes on a click outside, not on a click inside, and leaves a trigger that wraps a control as the only tab stop', async () => {
        const page = await mount(dial('', { trigger: '<ge-speed-dial-trigger><ge-button size="icon" aria-label="Open actions">+</ge-button></ge-speed-dial-trigger>' }));
        const el = first(page);
        const trigger = el.querySelector('ge-speed-dial-trigger')!;
        expect(wrapper(el).hasAttribute('role')).toBe(false);
        expect(wrapper(el).hasAttribute('aria-label')).toBe(false);

        el.querySelector<HTMLElement>('ge-speed-dial-trigger ge-button')!.click();
        await el.updateComplete;
        expect(el.dataset.state).toBe('open');
        buttons(el)[1]!.click();
        await el.updateComplete;
        expect(el.dataset.state).toBe('open');
        document.body.click();
        await el.updateComplete;
        expect(el.dataset.state).toBe('closed');
        expect(trigger.isConnected).toBe(true);
    });

    it('staggers items by transition-delay in order on open and in reverse on close, and uses 30ms when opened at a point', async () => {
        const page = await mount(dial('transition-delay="50"'));
        const el = first(page);
        const delays = () => buttons(el).map((item) => item.style.transitionDelay);
        expect(delays()).toEqual(['100ms', '50ms', '0ms']);
        el.show();
        await el.updateComplete;
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(delays()).toEqual(['0ms', '50ms', '100ms']);
        el.showAt(200, 200);
        await expect.poll(() => el.dataset.state).toBe('open');
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(delays()).toEqual(['0ms', '30ms', '60ms']);
    });

    it('does nothing while disabled, except close', async () => {
        const page = await mount(dial('disabled'));
        const el = first(page);
        wrapper(el).click();
        el.show();
        el.showAt(100, 100);
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(el.dataset.state).toBe('closed');
        el.removeAttribute('disabled');
        el.show();
        el.setAttribute('disabled', '');
        el.hide();
        await el.updateComplete;
        expect(el.dataset.state).toBe('closed');
    });

    it('spreads items on an arc at the radius from the trigger centre, ends on the end angles, and re-spaces when one goes', async () => {
        const page = await mount(dial('type="semi-circle" direction="up" radius="100"', { names: ['A', 'B', 'C', 'D', 'E'] }));
        const el = first(page);
        el.show();
        await el.updateComplete;
        await settle();
        const from = origin(el);
        const spots = buttons(el).map((button) => {
            const at = centre(button);
            return { dx: Math.round(at.x - from.x), dy: Math.round(at.y - from.y) };
        });
        // 180 degrees over 4 steps, upward: left end, 45, top, 135, right end.
        expect(spots).toEqual([{ dx: -100, dy: 0 }, { dx: -71, dy: -71 }, { dx: 0, dy: -100 }, { dx: 71, dy: -71 }, { dx: 100, dy: 0 }]);

        el.querySelectorAll('ge-speed-dial-item')[1]!.remove();
        el.querySelectorAll('ge-speed-dial-item')[2]!.remove();
        await new Promise((resolve) => setTimeout(resolve, 50));
        await settle();
        const left = buttons(el).map((button) => Math.round(centre(button).x - from.x));
        expect(left).toEqual([-100, 0, 100]);
    });

    it('numbers items by where they sit in the document, not by when they connected', async () => {
        const page = await mount(dial('type="semi-circle" direction="up" radius="100"', { names: ['B', 'C'] }));
        const el = first(page);
        el.querySelector('ge-speed-dial-menu')!.insertAdjacentHTML('afterbegin', '<ge-speed-dial-item><ge-button size="icon" aria-label="A">A</ge-button></ge-speed-dial-item>');
        el.show();
        await el.updateComplete;
        await new Promise((resolve) => setTimeout(resolve, 50));
        await settle();
        const from = origin(el);
        const xs = buttons(el).map((item) => Math.round(centre(item).x - from.x));
        expect(xs).toEqual([-100, 0, 100]);
    });

    it('a full circle spaces items 360/n apart and ignores direction; a quarter arc falls back to up-right for a straight direction', async () => {
        const circle = await mount(dial('type="circle" direction="left" radius="80"', { names: ['A', 'B', 'C', 'D'] }));
        const dialEl = first(circle);
        dialEl.show();
        await dialEl.updateComplete;
        await settle();
        const from = origin(dialEl);
        expect(buttons(dialEl).map((b) => [Math.round(centre(b).x - from.x), Math.round(centre(b).y - from.y)])).toEqual([[80, 0], [0, 80], [-80, 0], [0, -80]]);

        const quarter = await mount(dial('type="quarter-circle" direction="up" radius="80"', { names: ['A', 'B', 'C'] }));
        const quarterEl = first(quarter);
        quarterEl.show();
        await quarterEl.updateComplete;
        await settle();
        const o = origin(quarterEl);
        const [a, , c] = buttons(quarterEl).map((b) => [Math.round(centre(b).x - o.x), Math.round(centre(b).y - o.y)]);
        expect([a, c]).toEqual([[0, -80], [80, 0]]);
    });

    it('stacks a linear menu away from the trigger in the given direction', async () => {
        // A diagonal is not a linear direction: the menu falls back to growing upward.
        for (const [direction, axis, sign] of [['up', 'y', -1], ['down', 'y', 1], ['left', 'x', -1], ['right', 'x', 1], ['down-left', 'y', -1]] as const) {
            const page = await mount(dial(`direction="${direction}"`));
            const el = first(page);
            el.show();
            await el.updateComplete;
            await settle();
            const from = origin(el);
            const offsets = buttons(el).map((button) => (centre(button)[axis] - from[axis]) * sign);
            expect(offsets.every((offset) => offset > 0)).toBe(true);
            expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
        }
    });

    it('opens at the right-click point, centred above it, and a plain click then dismisses it', async () => {
        const page = await mount(`<div id="area" style="position:fixed;left:0;top:0;width:100vw;height:100vh">${dial('direction="up"', { trigger: '', extra: '' })}</div>`);
        const el = first(page);
        const area = document.createElement('ge-speed-dial-context-trigger');
        area.setAttribute('for', '');
        el.append(area);
        el.id = 'ctx';
        area.setAttribute('for', 'ctx');
        area.innerHTML = '<div id="hit" style="position:fixed;left:0;top:0;width:100vw;height:100vh"></div>';
        await area.updateComplete;
        const events = log(el);
        const hit = area.querySelector<HTMLElement>('#hit')!;
        const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 300 });
        hit.dispatchEvent(menu);
        expect(menu.defaultPrevented).toBe(true);
        await expect.poll(() => el.dataset.state).toBe('open');
        await settle();
        const rect = group(el).getBoundingClientRect();
        expect(Math.round(rect.left + rect.width / 2)).toBe(300);
        expect(rect.bottom).toBeLessThanOrEqual(300 - 8 + 1);
        expect(events).toEqual(['visible-change:true', 'shown']);

        hit.click();
        await el.updateComplete;
        expect(el.dataset.state).toBe('closed');
    });

    it('keeps a menu opened near an edge on screen by clamping the point', async () => {
        const page = await mount(dial('type="circle" radius="60"'));
        const el = first(page);
        el.showAt(2, 2);
        await expect.poll(() => el.dataset.state).toBe('open');
        await settle();
        const box = group(el).getBoundingClientRect();
        const lefts = buttons(el).map((b) => b.getBoundingClientRect().left);
        expect(box.left).toBe(60 + 24 + 8);
        expect(Math.min(...lefts)).toBeGreaterThanOrEqual(0);
    });

    it('keeps a linear menu off the edge it grows towards, and a later show() returns it to the trigger', async () => {
        const page = await mount(dial('direction="left"'));
        const el = first(page);
        el.showAt(2, 200);
        await expect.poll(() => el.dataset.state).toBe('open');
        await settle();
        expect(group(el).getBoundingClientRect().right).toBeGreaterThanOrEqual(60 + 24 + 8);
        expect(group(el).hasAttribute('data-fixed')).toBe(true);

        el.hide();
        el.show();
        await el.updateComplete;
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(group(el).hasAttribute('data-fixed')).toBe(false);
    });

    it('places arc ends on the angles each type and direction names', () => {
        const spot = (type: Parameters<typeof arcPosition>[0], direction: Parameters<typeof arcPosition>[1], index: number, total: number) => {
            const { x, y } = arcPosition(type, direction, 100, index, total);
            return [Math.round(x) + 0, Math.round(y) + 0];
        };
        expect([spot('semi-circle', 'up', 0, 3), spot('semi-circle', 'up', 2, 3)]).toEqual([[-100, 0], [100, 0]]);
        expect([spot('semi-circle', 'down', 0, 3), spot('semi-circle', 'down', 2, 3)]).toEqual([[100, 0], [-100, 0]]);
        expect([spot('semi-circle', 'left', 0, 3), spot('semi-circle', 'left', 2, 3)]).toEqual([[0, 100], [0, -100]]);
        expect([spot('semi-circle', 'right', 0, 3), spot('semi-circle', 'right', 2, 3)]).toEqual([[0, -100], [0, 100]]);
        expect([spot('quarter-circle', 'up-right', 0, 3), spot('quarter-circle', 'up-right', 2, 3)]).toEqual([[0, -100], [100, 0]]);
        expect([spot('quarter-circle', 'up-left', 0, 3), spot('quarter-circle', 'up-left', 2, 3)]).toEqual([[-100, 0], [0, -100]]);
        expect([spot('quarter-circle', 'down-right', 0, 3), spot('quarter-circle', 'down-right', 2, 3)]).toEqual([[100, 0], [0, 100]]);
        expect([spot('quarter-circle', 'down-left', 0, 3), spot('quarter-circle', 'down-left', 2, 3)]).toEqual([[0, 100], [-100, 0]]);
        // One item has nowhere to spread: it sits on the first angle rather than dividing by zero.
        expect(spot('semi-circle', 'up', 0, 1)).toEqual([-100, 0]);
    });

    it('shows a mask only while open; clicking it or pressing Enter on it closes the dial', async () => {
        const page = await mount(dial('', { extra: '<ge-speed-dial-mask></ge-speed-dial-mask>' }));
        const el = first(page);
        const mask = el.querySelector('ge-speed-dial-mask')!;
        const scrim = () => mask.shadowRoot!.querySelector<HTMLElement>('[role="button"]');
        expect(scrim()).toBeNull();
        el.show();
        await el.updateComplete;
        await mask.updateComplete;
        expect(scrim()!.getAttribute('aria-label')).toBe('Close');
        scrim()!.click();
        await el.updateComplete;
        await mask.updateComplete;
        expect(scrim()).toBeNull();

        el.show();
        await el.updateComplete;
        await mask.updateComplete;
        scrim()!.focus();
        await userEvent.keyboard('{Enter}');
        await el.updateComplete;
        expect(el.dataset.state).toBe('closed');
    });

    for (const theme of ['light', 'dark']) {
        describe(theme, () => {
            useTheme(theme);
            it('has no accessibility violations, closed and open', async () => {
                const page = await mount(dial('', { extra: '<ge-speed-dial-mask></ge-speed-dial-mask>' }));
                const el = first(page);
                expect((await axe.run(page)).violations.map((v) => v.id)).toEqual([]);
                el.show();
                await el.updateComplete;
                await settle();
                expect((await axe.run(page)).violations.map((v) => v.id)).toEqual([]);
            });
        });
    }
});

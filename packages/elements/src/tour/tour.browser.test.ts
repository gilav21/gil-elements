import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeTour, TourStep } from './tour.js';

afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
});

const box = (id: string, style = 'top:20px;left:50px;width:100px;height:30px') => `<div id="${id}" style="position:fixed;${style}">${id}</div>`;
const TARGETS = box('a') + box('b', 'top:120px;left:60px;width:100px;height:30px') + box('c', 'top:220px;left:70px;width:100px;height:30px');
const STEPS: TourStep[] = [
    { target: '#a', title: 'First', description: 'About the first.' },
    { target: '#b', title: 'Second' },
    { target: '#c', title: 'Third', description: 'Last one.' },
];

interface Seen { done: string[]; steps: number[]; skipped: Array<{ index: number; reason: string }>; changes: boolean[] }

async function tour(opts: { targets?: string; steps?: TourStep[]; attrs?: string; start?: boolean } = {}): Promise<{ el: GeTour; seen: Seen }> {
    const page = await mount(`${opts.targets ?? TARGETS}<ge-tour ${opts.attrs ?? ''}></ge-tour>`);
    const el = page.querySelector<GeTour>('ge-tour')!;
    const seen: Seen = { done: [], steps: [], skipped: [], changes: [] };
    el.addEventListener('done', (e) => seen.done.push((e as CustomEvent<string>).detail));
    el.addEventListener('step-change', (e) => seen.steps.push((e as CustomEvent<number>).detail));
    el.addEventListener('step-skipped', (e) => seen.skipped.push((e as CustomEvent<{ index: number; reason: string }>).detail));
    el.addEventListener('active-change', (e) => seen.changes.push((e as CustomEvent<boolean>).detail));
    el.steps = opts.steps ?? STEPS;
    if (opts.start !== false) {
        el.active = true;
        await shown(el);
    }
    return { el, seen };
}
const q = <T extends Element = HTMLElement>(el: GeTour, sel: string) => el.shadowRoot!.querySelector<T>(sel);
const card = (el: GeTour) => q(el, '[data-slot="tour-card"]')!;
const shown = async (el: GeTour) => {
    await el.updateComplete;
    await vi.waitFor(() => expect(el.isPending).toBe(false));
    await vi.waitFor(() => expect(getComputedStyle(card(el)).visibility).toBe('visible'));
    await vi.waitFor(() => expect(el.shadowRoot!.activeElement).toBe(card(el)));
};
const labels = (el: GeTour) => [...card(el).querySelectorAll('ge-button')].map((b) => b.textContent!.trim());
const click = async (el: GeTour, label: string) => {
    [...card(el).querySelectorAll<HTMLElement>('ge-button')].find((b) => b.textContent!.trim() === label)!.click();
    await el.updateComplete;
};
const title = (el: GeTour) => q(el, '.title')!.textContent!.trim();

describe('ge-tour', () => {
    it('shows nothing until active, then a spotlight around the target and a card with title, description and counter', async () => {
        const { el, seen } = await tour({ start: false });
        expect(el.shadowRoot!.querySelector('[data-slot]')).toBeNull();

        el.active = true;
        await shown(el);
        const target = document.getElementById('a')!.getBoundingClientRect();
        const spot = q(el, '[data-slot="tour-spotlight"]')!.getBoundingClientRect();

        expect([spot.left, spot.top, spot.width, spot.height]).toEqual([target.left - 6, target.top - 6, target.width + 12, target.height + 12]);
        expect(title(el)).toBe('First');
        expect(q(el, '.description')!.textContent).toBe('About the first.');
        expect(q(el, '.counter')!.textContent).toBe('1 / 3');
        expect(labels(el)).toEqual(['Skip', 'Next']);
        expect(seen.steps).toEqual([0]);
        expect(document.getElementById('a')!.style.outline).toContain('2px solid');
        expect(document.getElementById('a')!.hasAttribute('data-ge-tour-highlight')).toBe(true);
        expect(el.shadowRoot!.activeElement).toBe(card(el));
    });

    it('moves the highlight with next() and previous(), never before step 0, and restores the target\'s own styles', async () => {
        const { el, seen } = await tour({ targets: TARGETS.replace('<div id="a" style="', '<div id="a" style="outline:1px dotted red;') });
        const a = document.getElementById('a')!;
        const b = document.getElementById('b')!;

        el.next();
        await shown(el);
        expect(title(el)).toBe('Second');
        expect(q(el, '.counter')!.textContent).toBe('2 / 3');
        expect(labels(el)).toEqual(['Skip', 'Previous', 'Next']);
        expect(b.hasAttribute('data-ge-tour-highlight')).toBe(true);
        expect(a.hasAttribute('data-ge-tour-highlight')).toBe(false);
        const own = document.createElement('div');
        own.style.outline = '1px dotted red';
        expect(a.style.outline).toBe(own.style.outline);
        expect(getComputedStyle(b).position).toBe('fixed');

        el.previous();
        await shown(el);
        el.previous();
        await shown(el);
        expect(title(el)).toBe('First');
        expect(seen.steps).toEqual([0, 1, 0]);
    });

    it('makes a static target relative while it is highlighted and puts it back afterwards', async () => {
        const { el } = await tour({ targets: '<div id="a" style="width:100px;height:30px">static</div>', steps: [{ target: '#a', title: 'Only' }] });
        const a = document.getElementById('a')!;
        expect(a.style.position).toBe('relative');
        expect(a.style.zIndex).toBe('10001');
        el.active = false;
        await el.updateComplete;
        expect(a.style.position).toBe('');
        expect(a.style.outline).toBe('');
        expect(a.style.zIndex).toBe('');
    });

    it('ends from the last step with Done and no Skip, firing done("finished") and active-change', async () => {
        const { el, seen } = await tour({ steps: [STEPS[2]!] });
        expect(labels(el)).toEqual(['Done']);
        await click(el, 'Done');
        expect(seen.done).toEqual(['finished']);
        expect(seen.changes).toEqual([false]);
        expect(el.active).toBe(false);
        expect(el.shadowRoot!.querySelector('[data-slot]')).toBeNull();
    });

    it('skips with done("skipped"), and closing it from outside fires no done, clears the highlight and restarts at step 0', async () => {
        const { el, seen } = await tour();
        await click(el, 'Skip');
        expect(seen.done).toEqual(['skipped']);
        expect(document.getElementById('a')!.hasAttribute('data-ge-tour-highlight')).toBe(false);

        el.active = true;
        await shown(el);
        el.next();
        await shown(el);
        el.active = false;
        await el.updateComplete;
        expect(seen.done).toEqual(['skipped']);
        expect(document.getElementById('b')!.hasAttribute('data-ge-tour-highlight')).toBe(false);

        el.active = true;
        await shown(el);
        expect(title(el)).toBe('First');
    });

    it('restart() goes back to the first step without closing, goTo() jumps and ignores a bad index', async () => {
        const { el } = await tour();
        el.goTo(2);
        await shown(el);
        expect(title(el)).toBe('Third');
        el.goTo(9);
        el.goTo(-1);
        expect(el.currentIndex).toBe(2);
        el.restart();
        await shown(el);
        expect(title(el)).toBe('First');
        expect(el.active).toBe(true);
    });

    it('answers ArrowRight and Enter by going on, ArrowLeft by going back, Escape by skipping, and ignores other keys', async () => {
        const { el, seen } = await tour();
        const press = async (key: string) => {
            card(el).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }));
            await el.updateComplete;
            await new Promise((r) => setTimeout(r, 30));
        };
        await press('ArrowRight');
        expect(title(el)).toBe('Second');
        await press('Enter');
        expect(title(el)).toBe('Third');
        await press('ArrowLeft');
        expect(title(el)).toBe('Second');
        await press('x');
        await press(' ');
        expect(title(el)).toBe('Second');
        await press('Escape');
        expect(seen.done).toEqual(['skipped']);
    });

    it('advances exactly one step when Enter is pressed on the focused Next button', async () => {
        const { el, seen } = await tour();
        await new Promise((r) => setTimeout(r, 60));
        const next = [...card(el).querySelectorAll<HTMLElement>('ge-button')].at(-1)!;
        next.shadowRoot!.querySelector('button')!.focus();
        await userEvent.keyboard('{Enter}');
        await vi.waitFor(() => expect(title(el)).toBe('Second'));
        await new Promise((r) => setTimeout(r, 100));
        expect(seen.steps).toEqual([0, 1]);
    });

    it('lets Enter and Space press the button that has focus instead of reading them as "next"', async () => {
        const { el, seen } = await tour();
        el.next();
        await shown(el);
        const button = (label: string) => [...card(el).querySelectorAll<HTMLElement>('ge-button')].find((b) => b.textContent!.trim() === label)!;
        // The card takes focus a frame after it shows; let that happen before moving focus onto a button.
        const settled = () => new Promise((r) => setTimeout(r, 60));
        await settled();
        button('Previous').shadowRoot!.querySelector('button')!.focus();
        await userEvent.keyboard('{Enter}');
        await vi.waitFor(() => expect(title(el)).toBe('First'));
        el.next();
        await shown(el);
        await settled();
        button('Skip').shadowRoot!.querySelector('button')!.focus();
        await userEvent.keyboard(' ');
        await vi.waitFor(() => expect(seen.done).toEqual(['skipped']));
        expect(seen.steps).toEqual([0, 1, 0, 1]);
    });

    it('follows the page when it scrolls', async () => {
        const { el } = await tour({ targets: '<div style="height:3000px"></div><div id="a" style="position:absolute;top:200px;left:50px;width:100px;height:30px">a</div>', steps: [{ target: '#a', title: 'Only' }] });
        const a = document.getElementById('a')!;
        scrollTo(0, 0);
        await new Promise((r) => setTimeout(r, 50));
        const spot = q(el, '[data-slot="tour-spotlight"]')!;
        await vi.waitFor(() => expect(spot.getBoundingClientRect().top).toBe(a.getBoundingClientRect().top - 6));
    });
});

describe('ge-tour card placement', () => {
    const place = async (targetStyle: string, side?: TourStep['side']) => {
        const { el } = await tour({ targets: box('a', targetStyle), steps: [{ target: '#a', title: 'T', description: 'd', side }] });
        return { el, card: card(el).getBoundingClientRect(), target: document.getElementById('a')!.getBoundingClientRect() };
    };

    it('goes below a target near the top, centred on it, 12px away', async () => {
        const { card: c, target } = await place('top:40px;left:500px;width:100px;height:30px');
        expect(c.top).toBe(target.bottom + 12);
        expect(c.left + c.width / 2).toBe(target.left + target.width / 2);
        expect(c.width).toBe(320 > innerWidth - 32 ? innerWidth - 32 : 320);
    });

    it('goes above a target at the bottom of the viewport', async () => {
        const { card: c, target } = await place(`top:${innerHeight - 60}px;left:500px;width:100px;height:30px`);
        expect(c.bottom).toBe(target.top - 12);
    });

    it('stays inside the viewport margin when the target fills the screen', async () => {
        const { card: c } = await place('top:0;left:0;width:100vw;height:100vh');
        expect(c.top).toBeGreaterThanOrEqual(8);
        expect(c.left).toBeGreaterThanOrEqual(8);
        expect(c.right).toBeLessThanOrEqual(innerWidth - 8);
        expect(c.bottom).toBeLessThanOrEqual(innerHeight - 8);
    });

    it('honours the side a step asks for', async () => {
        const left = await place('top:300px;left:600px;width:60px;height:30px', 'left');
        expect(left.card.right).toBe(left.target.left - 12);
    });

    it('clamps a side that does not fit to the viewport margin', async () => {
        const top = await place('top:20px;left:600px;width:60px;height:30px', 'top');
        expect(top.card.top).toBe(8);
    });
});

describe('ge-tour missing and unrendered targets', () => {
    it('warns, reports the step and carries on to the next one that resolves, counting only reachable steps', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { el, seen } = await tour({ steps: [STEPS[0]!, { target: '#nope', title: 'Gone' }, STEPS[2]!] });
        el.next();
        await shown(el);

        expect(title(el)).toBe('Third');
        expect(seen.skipped).toEqual([{ index: 1, reason: 'missing-target' }]);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('#nope'));
        expect(q(el, '.counter')!.textContent).toBe('2 / 2');
        el.previous();
        await shown(el);
        expect(title(el)).toBe('First');
    });

    it('skips a target that is display:none, and one that sits inside a hidden parent', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { el, seen } = await tour({
            targets: box('a') + '<div id="c" style="display:none"><span id="in">x</span></div>' + box('b', 'top:120px;left:60px;width:100px;height:30px'),
            steps: [{ target: '#a', title: 'A' }, { target: '#c', title: 'Hidden' }, { target: '#in', title: 'Inside' }, { target: '#b', title: 'B' }],
        });
        el.next();
        await shown(el);
        expect(title(el)).toBe('B');
        expect(seen.skipped.map((s) => s.index)).toEqual([1, 2]);
    });

    it('skips a target that is visibility:hidden', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { el, seen } = await tour({
            targets: box('a') + '<div id="c" style="position:fixed;top:90px;left:40px;width:50px;height:20px;visibility:hidden">h</div>' + box('b', 'top:120px;left:60px;width:100px;height:30px'),
            steps: [{ target: '#a', title: 'A' }, { target: '#c', title: 'Hidden' }, { target: '#b', title: 'B' }],
        });
        el.next();
        await shown(el);
        expect(title(el)).toBe('B');
        expect(seen.skipped).toEqual([{ index: 1, reason: 'missing-target' }]);
    });

    it('treats an invalid selector as a missing target', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { el, seen } = await tour({ steps: [STEPS[0]!, { target: '#[', title: 'Bad' }, STEPS[1]!] });
        el.next();
        await shown(el);
        expect(title(el)).toBe('Second');
        expect(seen.skipped).toEqual([{ index: 1, reason: 'missing-target' }]);
    });

    it('ends at once, as finished, when no step resolves, and keeps going back when nothing earlier exists', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const none = await tour({ start: false, steps: [{ target: '#x', title: 'X' }, { target: '#y', title: 'Y' }] });
        none.el.active = true;
        await none.el.updateComplete;
        expect(none.seen.done).toEqual(['finished']);
        expect(none.el.active).toBe(false);

        const { el, seen } = await tour({ steps: [{ target: '#x', title: 'X' }, STEPS[0]!, STEPS[1]!] });
        expect(title(el)).toBe('First');
        expect(labels(el)).not.toContain('Previous');
        el.next();
        await shown(el);
        el.previous();
        await shown(el);
        expect(title(el)).toBe('First');
        expect(seen.done).toEqual([]);
    });

    it('stays on the current step when a backwards move finds nothing earlier, and counts a skipped step again once it resolves', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { el, seen } = await tour({ steps: [STEPS[0]!, { target: '#late', title: 'Late' }, STEPS[1]!] });
        el.next();
        await shown(el);
        expect(q(el, '.counter')!.textContent).toBe('2 / 2');

        document.body.insertAdjacentHTML('beforeend', box('late', 'top:170px;left:60px;width:50px;height:20px'));
        el.goTo(1);
        await shown(el);
        expect(title(el)).toBe('Late');
        expect(q(el, '.counter')!.textContent).toBe('2 / 3');

        document.getElementById('late')!.remove();
        document.getElementById('a')!.remove();
        el.goTo(2);
        await shown(el);
        el.previous();
        await shown(el);
        expect(title(el)).toBe('Second');
        expect(seen.done).toEqual([]);
    });

    it('re-tests skipped steps on a fresh run', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { el } = await tour({ steps: [STEPS[0]!, { target: '#late', title: 'Late' }, STEPS[1]!] });
        expect(q(el, '.counter')!.textContent).toBe('1 / 3');
        el.next();
        await shown(el);
        expect(q(el, '.counter')!.textContent).toBe('2 / 2');

        document.body.insertAdjacentHTML('beforeend', box('late', 'top:170px;left:60px;width:50px;height:20px'));
        el.restart();
        await shown(el);
        expect(q(el, '.counter')!.textContent).toBe('1 / 3');
        el.next();
        await shown(el);
        expect(title(el)).toBe('Late');
        document.getElementById('late')!.remove();
    });
});

describe('ge-tour async hooks', () => {
    it('runs afterDeactivate with the travel direction, then beforeActivate, and waits for the element it renders', async () => {
        const log: string[] = [];
        const { el } = await tour({
            targets: box('a'),
            steps: [
                { target: '#a', title: 'A', afterDeactivate: ({ direction, index }) => { log.push(`after ${index} ${direction}`); } },
                { target: '#late', title: 'Late', targetTimeout: 2000, beforeActivate: ({ index, direction }) => { log.push(`before ${index} ${direction}`); setTimeout(() => document.body.insertAdjacentHTML('beforeend', box('late', 'top:90px;left:40px;width:60px;height:20px')), 60); } },
            ],
        });
        el.next();
        await vi.waitFor(() => expect(title(el)).toBe('Late'));
        await shown(el);
        expect(log).toEqual(['after 0 forward', 'before 1 forward']);
        document.getElementById('late')!.remove();
    });

    it('shows a scrim, a Loading note and disabled buttons while a hook runs, and ignores next() meanwhile', async () => {
        let release!: () => void;
        const { el, seen } = await tour({
            steps: [STEPS[0]!, { target: '#b', title: 'B', beforeActivate: () => new Promise<void>((r) => { release = r; }) }, STEPS[2]!],
        });
        el.next();
        await el.updateComplete;
        expect(el.isPending).toBe(true);
        expect(q(el, '[data-slot="tour-scrim"]')).not.toBeNull();
        expect(q(el, '[data-slot="tour-spotlight"]')).toBeNull();
        expect(q(el, '[data-slot="tour-pending"]')!.textContent).toBe('Loading...');
        expect(card(el).getAttribute('aria-busy')).toBe('true');
        expect([...card(el).querySelectorAll('ge-button')].find((b) => b.textContent!.trim() === 'Next')!.hasAttribute('disabled')).toBe(true);
        el.next();
        release();
        await vi.waitFor(() => expect(el.isPending).toBe(false));
        await shown(el);
        expect(seen.steps).toEqual([0, 1]);
        expect(q(el, '[data-slot="tour-pending"]')).toBeNull();
    });

    it('ignores previous() while a hook runs', async () => {
        let release!: () => void;
        const { el, seen } = await tour({
            steps: [STEPS[0]!, STEPS[1]!, { target: '#c', title: 'C', beforeActivate: () => new Promise<void>((r) => { release = r; }) }],
        });
        el.next();
        await vi.waitFor(() => expect(title(el)).toBe('Second'));
        el.next();
        await el.updateComplete;
        expect(el.isPending).toBe(true);
        el.previous();
        release();
        await vi.waitFor(() => expect(el.isPending).toBe(false));
        await shown(el);
        expect(title(el)).toBe('C');
        expect(seen.steps).toEqual([0, 1, 2]);
    });

    it('skips a step whose when() is falsy or whose hook throws, saying why, and still advances when afterDeactivate throws', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { el, seen } = await tour({
            steps: [
                { ...STEPS[0]!, afterDeactivate: () => { throw new Error('boom'); } },
                { ...STEPS[1]!, when: () => false },
                { target: '#b', title: 'Broken', beforeActivate: () => Promise.reject(new Error('nope')) },
                STEPS[2]!,
            ],
        });
        el.next();
        await vi.waitFor(() => expect(title(el)).toBe('Third'));
        expect(seen.skipped).toEqual([{ index: 1, reason: 'condition' }, { index: 2, reason: 'hook-error' }]);
        expect(warn).toHaveBeenCalled();
    });

    it('stays where it was when a backwards move finds the earlier target gone', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { el } = await tour({ steps: [{ ...STEPS[0]!, beforeActivate: () => undefined }, STEPS[1]!] });
        el.next();
        await shown(el);
        document.getElementById('a')!.remove();
        el.previous();
        await vi.waitFor(() => expect(el.isPending).toBe(false));
        await shown(el);
        expect(title(el)).toBe('Second');
        expect(el.active).toBe(true);
    });

    it('discards a hook that resolves after the tour was closed, and tells a running hook to stop through its signal', async () => {
        let release!: () => void;
        let signal!: AbortSignal;
        const { el, seen } = await tour({
            steps: [STEPS[0]!, { target: '#b', title: 'B', beforeActivate: (ctx) => { signal = ctx.signal; return new Promise<void>((r) => { release = r; }); } }],
        });
        el.next();
        await el.updateComplete;
        el.skip();
        expect(signal.aborted).toBe(true);
        release();
        await new Promise((r) => setTimeout(r, 50));
        expect(el.active).toBe(false);
        expect(seen.steps).toEqual([0]);
        expect(seen.done).toEqual(['skipped']);
    });
});

describe('ge-tour while it runs', () => {
    it('falls back to the last step when steps shrink under it, and ends when they empty out', async () => {
        const { el, seen } = await tour();
        el.goTo(2);
        await shown(el);
        el.steps = STEPS.slice(0, 2);
        await vi.waitFor(() => expect(title(el)).toBe('Second'));
        await shown(el);
        el.steps = [];
        await vi.waitFor(() => expect(seen.done).toEqual(['finished']));
        expect(el.active).toBe(false);
    });

    it('stays on its step when steps shrink but the current index still exists', async () => {
        const { el, seen } = await tour();
        el.steps = STEPS.slice(0, 2);
        await el.updateComplete;
        await new Promise((r) => setTimeout(r, 50));
        expect(title(el)).toBe('First');
        expect(q(el, '.counter')!.textContent).toBe('1 / 2');
        expect(seen.steps).toEqual([0]);
    });

    it('moves on when the highlighted element is removed, or follows the selector to a replacement', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { el, seen } = await tour();
        const swap = document.createElement('div');
        swap.id = 'a';
        swap.style.cssText = 'position:fixed;top:60px;left:30px;width:80px;height:20px';
        document.getElementById('a')!.replaceWith(swap);
        scrollTo(0, 1);
        window.dispatchEvent(new Event('resize'));
        await vi.waitFor(() => expect(swap.hasAttribute('data-ge-tour-highlight')).toBe(true));
        expect(title(el)).toBe('First');

        swap.remove();
        window.dispatchEvent(new Event('resize'));
        await vi.waitFor(() => expect(title(el)).toBe('Second'));
        expect(seen.skipped).toContainEqual({ index: 0, reason: 'missing-target' });
    });
});

describe('ge-tour wording', () => {
    it('speaks the locale, flips to rtl for Hebrew, and lets explicit labels win', async () => {
        const he = await tour({ attrs: 'locale="he"' });
        he.el.next();
        await shown(he.el);
        expect(labels(he.el)).toEqual(['דלג', 'הקודם', 'הבא']);
        expect(card(he.el).getAttribute('dir')).toBe('rtl');

        const custom = await tour({ attrs: 'next-label="Go on" prev-label="Back" skip-label="Leave" finish-label="Fin"' });
        custom.el.next();
        await shown(custom.el);
        expect(labels(custom.el)).toEqual(['Leave', 'Back', 'Go on']);
        custom.el.goTo(2);
        await shown(custom.el);
        expect(labels(custom.el)).toEqual(['Back', 'Fin']);
    });

    it('hides Skip with show-skip="false"', async () => {
        const { el } = await tour({ attrs: 'show-skip="false"' });
        expect(labels(el)).toEqual(['Next']);
    });
});

describe('ge-tour storage-key', () => {
    it('records an ending under its own prefix, finished or skipped, and refuses to start again', async () => {
        const first = await tour({ attrs: 'storage-key="intro"', steps: [STEPS[0]!] });
        await click(first.el, 'Done');
        expect(localStorage.getItem('ge-tour:intro')).toBe('done');
        expect(first.el.isCompleted()).toBe(true);

        const again = await tour({ attrs: 'storage-key="intro"', start: false });
        again.el.active = true;
        await again.el.updateComplete;
        await vi.waitFor(() => expect(again.el.active).toBe(false));
        expect(again.seen.steps).toEqual([]);
        expect(again.seen.done).toEqual([]);
        expect(again.seen.changes).toEqual([false]);

        localStorage.clear();
        const skipped = await tour({ attrs: 'storage-key="other"' });
        await click(skipped.el, 'Skip');
        expect(localStorage.getItem('ge-tour:other')).toBe('done');
    });

    it('is not burnt when no step ever resolved, runs a different key, and resetCompletion() lets it run again', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const late = await tour({ attrs: 'storage-key="late"', start: false, steps: [{ target: '#nope', title: 'X' }] });
        late.el.active = true;
        await late.el.updateComplete;
        expect(late.seen.done).toEqual(['finished']);
        expect(localStorage.getItem('ge-tour:late')).toBeNull();

        localStorage.setItem('ge-tour:done-one', 'done');
        const other = await tour({ attrs: 'storage-key="fresh"' });
        expect(other.el.active).toBe(true);

        const { el } = await tour({ attrs: 'storage-key="done-one"', start: false });
        el.resetCompletion();
        el.active = true;
        await shown(el);
        expect(localStorage.getItem('ge-tour:done-one')).toBeNull();
    });

    it('writes nothing without a key and survives storage that throws', async () => {
        const { el } = await tour({ steps: [STEPS[0]!] });
        await click(el, 'Done');
        expect(localStorage.length).toBe(0);

        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
        const keyed = await tour({ attrs: 'storage-key="k"', steps: [STEPS[0]!] });
        await click(keyed.el, 'Done');
        expect(keyed.seen.done).toEqual(['finished']);
    });
});

describe('ge-tour branching', () => {
    const branch = async (next: TourStep['next']) => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        return tour({ steps: [{ ...STEPS[0]!, next }, STEPS[1]!, STEPS[2]!] });
    };

    it('goes where the predicate says, ends on null, and may go backwards', async () => {
        const jump = await branch(() => 2);
        jump.el.next();
        await shown(jump.el);
        expect(title(jump.el)).toBe('Third');
        jump.el.previous();
        await shown(jump.el);
        expect(title(jump.el)).toBe('Second');

        const end = await branch(() => null);
        end.el.next();
        expect(end.seen.done).toEqual(['finished']);

        const log: string[] = [];
        const back = await tour({ steps: [{ ...STEPS[0]!, afterDeactivate: ({ direction }) => { log.push(`0 ${direction}`); } }, { ...STEPS[1]!, next: () => 0, afterDeactivate: ({ direction }) => { log.push(`1 ${direction}`); } }, STEPS[2]!] });
        back.el.next();
        await vi.waitFor(() => expect(title(back.el)).toBe('Second'));
        back.el.next();
        await vi.waitFor(() => expect(title(back.el)).toBe('First'));
        expect(log).toEqual(['0 forward', '1 backward']);
    });

    it('falls back to the next step when the predicate throws or answers out of range', async () => {
        for (const next of [() => { throw new Error('x'); }, () => 9, () => 3, () => -1, () => 1.5]) {
            const { el } = await branch(next);
            el.next();
            await shown(el);
            expect(title(el)).toBe('Second');
        }
    });
});

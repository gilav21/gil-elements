import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import { ToastService } from './toast-service.js';
import type { GeToast, GeToaster } from './index.js';

const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const e of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) {
            await e.updateComplete;
            const inner = e.shadowRoot?.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*') ?? [];
            for (const i of inner) await i.updateComplete;
        }
        await new Promise((r) => setTimeout(r, 0));
    }
};
const part = (el: HTMLElement, selector: string) => el.shadowRoot!.querySelector<HTMLElement>(selector);

describe('ge-toast', () => {
    it('shows a heading and description, and omits whichever it is not given', async () => {
        const page = await mount('<ge-toast heading="Saved" description="Your changes were saved."></ge-toast><ge-toast description="Only text"></ge-toast><ge-toast heading="Only a heading"></ge-toast>');
        const [both, descOnly, headOnly] = [...page.querySelectorAll<GeToast>('ge-toast')] as [GeToast, GeToast, GeToast];
        expect([part(both, '.heading')!.textContent, part(both, '.description')!.textContent]).toEqual(['Saved', 'Your changes were saved.']);
        expect([part(descOnly, '.heading'), part(headOnly, '.description')]).toEqual([null, null]);
    });

    it('announces a destructive toast assertively and every other variant politely', async () => {
        const page = await mount(['default', 'destructive', 'success', 'info', 'warning'].map((v) => `<ge-toast variant="${v}" heading="${v}"></ge-toast>`).join(''));
        await settle(page);
        expect([...page.querySelectorAll('ge-toast')].map((t) => [t.getAttribute('role'), t.getAttribute('aria-live')])).toEqual([
            ['status', 'polite'],
            ['alert', 'assertive'],
            ['status', 'polite'],
            ['status', 'polite'],
            ['status', 'polite'],
        ]);
    });

    it('paints each variant in its own colours', async () => {
        const page = await mount(['default', 'destructive', 'success', 'info', 'warning'].map((v) => `<ge-toast variant="${v}" heading="${v}"></ge-toast>`).join(''));
        const fills = [...page.querySelectorAll('ge-toast')].map((t) => getComputedStyle(t).backgroundColor);
        expect(new Set(fills).size).toBe(5);
        const warning = page.querySelectorAll('ge-toast')[4]!;
        expect(getComputedStyle(warning).color).not.toBe(getComputedStyle(page.querySelectorAll('ge-toast')[2]!).color);
    });

    it('emits closed from the close button and from Escape, and action from the action button, which does not close it', async () => {
        const page = await mount('<ge-toast heading="Deleted" action-label="Undo"></ge-toast>');
        const toast = page.querySelector<GeToast>('ge-toast')!;
        const log: string[] = [];
        toast.addEventListener('closed', () => log.push('closed'));
        toast.addEventListener('action', () => log.push('action'));
        part(toast, '.action')!.click();
        expect(log).toEqual(['action']);
        part(toast, '.close')!.click();
        toast.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        toast.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(log).toEqual(['action', 'closed', 'closed']);
        expect(toast.isConnected).toBe(true);
    });

    it('reveals the close button on hover and focus, and always on a touch screen', async () => {
        const page = await mount('<ge-toast heading="Hi"></ge-toast>');
        const toast = page.querySelector<GeToast>('ge-toast')!;
        const close = part(toast, '.close') as HTMLButtonElement;
        // An earlier test may have left the pointer over this spot, and unhover alone may park it there.
        const away = document.createElement('div');
        away.style.cssText = 'position:fixed;right:0;bottom:0;width:20px;height:20px';
        page.append(away);
        await userEvent.hover(away);
        // Files that emulate touch share the browser and can leave a touch-only pointer behind, which shows the button at all times.
        const touchOnly = matchMedia('(hover: none)').matches;
        await expect.poll(() => getComputedStyle(close).opacity).toBe(touchOnly ? '1' : '0');
        close.focus();
        await expect.poll(() => getComputedStyle(close).opacity).toBe('1');
        close.blur();
        await userEvent.hover(toast);
        await expect.poll(() => getComputedStyle(close).opacity).toBe('1');
        await userEvent.hover(away);
    });

    it('draws a spinner while loading, and a countdown on the action with a bar that drains to the seconds left', async () => {
        const page = await mount('<ge-toast heading="Saving" loading></ge-toast><ge-toast heading="Sent" action-label="Undo" show-countdown countdown-seconds="2" duration="5000"></ge-toast>');
        const [loading, counting] = [...page.querySelectorAll<GeToast>('ge-toast')] as [GeToast, GeToast];
        expect([part(loading, '.spinner') !== null, part(counting, '.spinner')]).toEqual([true, null]);
        expect(part(counting, '.action')!.textContent!.replaceAll(/\s+/g, '')).toBe('Undo(2s)');
        expect(part(counting, '.progress div')!.style.width).toBe('40%');
        counting.duration = 4500;
        counting.countdownSeconds = 5;
        await counting.updateComplete;
        expect(part(counting, '.progress div')!.style.width).toBe('100%');
        counting.countdownSeconds = -2;
        await counting.updateComplete;
        expect(part(counting, '.progress div')!.style.width).toBe('0%');
        counting.countdownSeconds = 0;
        counting.showCountdown = false;
        await counting.updateComplete;
        expect([part(counting, '.progress'), part(counting, '.action')!.textContent!.trim()]).toEqual([null, 'Undo']);
    });

    it('shows the countdown and its bar only when there are seconds and a duration to show', async () => {
        const page = await mount('<ge-toast heading="a" action-label="Undo" show-countdown duration="5000"></ge-toast><ge-toast heading="b" action-label="Undo" show-countdown countdown-seconds="3"></ge-toast>');
        const [noSeconds, noDuration] = [...page.querySelectorAll<GeToast>('ge-toast')] as [GeToast, GeToast];
        expect([part(noSeconds, '.action')!.textContent!.trim(), part(noDuration, '.progress')]).toEqual(['Undo', null]);
        expect(part(noDuration, '.action')!.textContent!.replaceAll(/\s+/g, '')).toBe('Undo(3s)');
    });

    it('names the close button and mirrors itself for a right-to-left locale', async () => {
        const page = await mount('<ge-toast heading="שלום" locale="he"></ge-toast><ge-toast heading="Hello"></ge-toast>');
        await settle(page);
        const [he, en] = [...page.querySelectorAll<GeToast>('ge-toast')] as [GeToast, GeToast];
        expect([part(he, '.close')!.getAttribute('aria-label'), he.dir, part(en, '.close')!.getAttribute('aria-label'), en.dir]).toEqual(['סגור', 'rtl', 'Close', '']);
        const close = part(he, '.close')!.getBoundingClientRect();
        expect(close.left - he.getBoundingClientRect().left).toBeLessThan(he.getBoundingClientRect().right - close.right);
    });

    it('has no axe violations in both themes', async () => {
        const page = await mount('<ge-toast heading="Saved" description="Your changes were saved." action-label="Undo"></ge-toast><ge-toast variant="destructive" heading="Failed" description="Try again."></ge-toast>');
        for (const mode of ['light', 'dark']) {
            useTheme(mode);
            await new Promise((r) => setTimeout(r, 250));
            const result = await axe.run(page);
            expect(result.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.html.slice(0, 60))}`)).toEqual([]);
        }
    });
});

describe('ge-toaster', () => {
    let service: ToastService;
    beforeEach(() => {
        service = new ToastService();
    });
    afterEach(() => {
        service.dismissAll();
        vi.useRealTimers();
    });
    const toaster = async (attrs = '') => {
        const page = await mount(`<ge-toaster ${attrs}></ge-toaster>`);
        const el = page.querySelector<GeToaster>('ge-toaster')!;
        // The service must be in place before the element connects, so swap it and reconnect.
        el.remove();
        el.service = service;
        page.append(el);
        await settle(page);
        return { page, el };
    };
    /** Timers are faked, so wait on promises only: the toaster's own update, then its stale-hold release. */
    const flush = async (el: GeToaster) => {
        await el.updateComplete;
        await Promise.resolve();
        await el.updateComplete;
    };
    const toastsOf = (el: GeToaster) => [...el.shadowRoot!.querySelectorAll<GeToast>('ge-toast')];

    it('shows the service queue as toasts, in arrival order, and drops a toast the moment it is dismissed', async () => {
        const { page, el } = await toaster();
        const a = service.toast({ heading: 'First', description: 'one', variant: 'success', loading: true, action: { label: 'Undo', onClick: () => undefined } });
        service.toast({ heading: 'Second', duration: 0 });
        await settle(page);
        expect(toastsOf(el).map((t) => [t.heading, t.description, t.variant, t.loading, t.actionLabel])).toEqual([
            ['First', 'one', 'success', true, 'Undo'],
            ['Second', '', 'default', false, ''],
        ]);
        service.dismiss(a);
        await settle(page);
        expect(toastsOf(el).map((t) => t.heading)).toEqual(['Second']);
    });

    it('closes a toast from its close button, and runs an action without closing it', async () => {
        const { page, el } = await toaster();
        const clicked = vi.fn();
        service.toast({ heading: 'Deleted', action: { label: 'Undo', onClick: clicked }, duration: 0 });
        await settle(page);
        const toast = toastsOf(el)[0]!;
        part(toast, '.action')!.click();
        expect(clicked).toHaveBeenCalledOnce();
        expect(service.toasts).toHaveLength(1);
        part(toast, '.close')!.click();
        await settle(page);
        expect([service.toasts, toastsOf(el)]).toEqual([[], []]);
    });

    it('freezes the clocks while the pointer is over the stack, and restarts them when it leaves', async () => {
        const { el } = await toaster();
        vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'] });
        service.toast({ heading: 'Hover me', duration: 5000 });
        await flush(el);
        el.dispatchEvent(new PointerEvent('pointerenter'));
        vi.advanceTimersByTime(60_000);
        expect(service.toasts).toHaveLength(1);
        el.dispatchEvent(new PointerEvent('pointerleave'));
        vi.advanceTimersByTime(5000);
        expect(service.toasts).toHaveLength(0);
    });

    it('keeps the clocks frozen for focus after the pointer has left, until focus leaves too', async () => {
        const { el } = await toaster();
        vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'] });
        service.toast({ heading: 'Tab to me', action: { label: 'Undo', onClick: () => undefined }, duration: 5000 });
        await flush(el);
        el.dispatchEvent(new PointerEvent('pointerenter'));
        el.dispatchEvent(new FocusEvent('focusin'));
        el.dispatchEvent(new PointerEvent('pointerleave'));
        vi.advanceTimersByTime(60_000);
        expect(service.toasts).toHaveLength(1);
        el.dispatchEvent(new FocusEvent('focusout', { relatedTarget: document.body }));
        vi.advanceTimersByTime(5000);
        expect(service.toasts).toHaveLength(0);
    });

    it('does not freeze the next toast when the one that held the pointer was removed under it', async () => {
        const { el } = await toaster();
        vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'] });
        const first = service.toast({ heading: 'one', duration: 0 });
        await flush(el);
        el.dispatchEvent(new PointerEvent('pointerenter'));
        service.dismiss(first);
        await flush(el);
        service.toast({ heading: 'two', duration: 3000 });
        await flush(el);
        vi.advanceTimersByTime(3000);
        expect(service.toasts).toHaveLength(0);
    });

    it('keeps the hold while focus moves between controls inside the stack, and releases it when the toast that held focus is gone', async () => {
        const { el } = await toaster();
        vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'] });
        const a = service.toast({ heading: 'a', duration: 0 });
        service.toast({ heading: 'b', duration: 3000 });
        await flush(el);
        el.dispatchEvent(new FocusEvent('focusin'));
        el.dispatchEvent(new FocusEvent('focusout', { relatedTarget: el }));
        vi.advanceTimersByTime(60_000);
        expect(service.toasts).toHaveLength(2);
        service.dismiss(a);
        await flush(el);
        vi.advanceTimersByTime(3000);
        expect(service.toasts).toHaveLength(0);
    });

    it('never resumes a pause it did not take, and gives its own back when it leaves the page', async () => {
        const { page, el } = await toaster();
        vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'] });
        service.toast({ heading: 'a', duration: 3000 });
        await flush(el);
        service.pause();
        el.dispatchEvent(new FocusEvent('focusout', { relatedTarget: document.body }));
        vi.advanceTimersByTime(60_000);
        expect(service.toasts).toHaveLength(1);
        service.resume();

        el.dispatchEvent(new PointerEvent('pointerenter'));
        el.remove();
        vi.advanceTimersByTime(3000);
        expect(service.toasts).toHaveLength(0);
        expect(page.querySelector('ge-toaster')).toBeNull();
    });

    it('keeps each toast element with its own toast when an earlier one with the same words goes', async () => {
        const { page, el } = await toaster();
        const first = service.toast({ heading: 'Saved', duration: 0 });
        service.toast({ heading: 'Saved', duration: 0 });
        await settle(page);
        const second = toastsOf(el)[1]!;
        service.dismiss(first);
        await settle(page);
        expect(toastsOf(el)).toEqual([second]);
    });

    it('anchors the stack to a corner of the viewport, mirroring start and end in RTL', async () => {
        const place = async (attrs: string, rtl = false) => {
            const { el } = await toaster(attrs);
            if (rtl) document.documentElement.dir = 'rtl';
            const box = el.getBoundingClientRect();
            document.documentElement.dir = '';
            return [Math.round(box.left), Math.round(box.top), Math.round(innerWidth - box.right), Math.round(innerHeight - box.bottom)];
        };
        service.toast({ heading: 'x', duration: 0 });
        expect(await place('')).toMatchObject({ 2: 0, 3: 0 });
        const top = await place('vertical="top" horizontal="start"');
        expect([top[0], top[1]]).toEqual([0, 0]);
        const center = await place('vertical="center" horizontal="center"');
        expect(Math.abs(center[0]! - center[2]!)).toBeLessThanOrEqual(1);
        expect(Math.abs(center[1]! - center[3]!)).toBeLessThanOrEqual(1);
        const rtlEnd = await place('', true);
        expect(rtlEnd[0]).toBe(0);
    });
});


import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService } from './toast-service.js';

let service: ToastService;
beforeEach(() => {
    vi.useFakeTimers();
    service = new ToastService();
});
afterEach(() => {
    service.dismissAll();
    vi.useRealTimers();
});
const heads = () => service.toasts.map((t) => t.heading);

describe('ToastService', () => {
    it('queues toasts in arrival order, each its own entry, and dismisses them after their duration', () => {
        const changes: number[] = [];
        service.addEventListener('change', () => changes.push(service.toasts.length));
        const first = service.toast({ heading: 'Saved' });
        service.toast({ heading: 'Saved' });
        service.toast({ heading: 'Sticky', duration: 0 });
        service.toast({ heading: 'Short', duration: 1000 });
        expect([heads(), service.toasts[0]!.id === first, changes]).toEqual([['Saved', 'Saved', 'Sticky', 'Short'], true, [1, 2, 3, 4]]);
        vi.advanceTimersByTime(1000);
        expect(heads()).toEqual(['Saved', 'Saved', 'Sticky']);
        vi.advanceTimersByTime(4000);
        expect(heads()).toEqual(['Sticky']);
        service.dismiss(service.toasts[0]!.id);
        service.dismiss('toast-unknown');
        expect(service.toasts).toEqual([]);
    });

    it('raises the shorthand variants, and a sticky spinner toast for loading', () => {
        service.success('a');
        service.error('b', 'why');
        service.info('c');
        service.warning('d', undefined, 0);
        service.loading('e', 'wait');
        expect(service.toasts.map((t) => [t.variant, t.duration, t.loading ?? false, t.description])).toEqual([
            ['success', 5000, false, undefined],
            ['destructive', 5000, false, 'why'],
            ['info', 5000, false, undefined],
            ['warning', 0, false, undefined],
            [undefined, 0, true, 'wait'],
        ]);
    });

    it('counts a countdown down once a second from the rounded-up duration', () => {
        service.toast({ heading: 'Undo?', duration: 4500, showCountdown: true });
        expect(service.toasts[0]!.countdownSeconds).toBe(5);
        vi.advanceTimersByTime(2000);
        expect(service.toasts[0]!.countdownSeconds).toBe(3);
        vi.advanceTimersByTime(2400);
        expect(service.toasts[0]!.countdownSeconds).toBe(1);
        vi.advanceTimersByTime(200);
        expect(service.toasts).toEqual([]);
    });

    it('freezes every clock while paused, keeping the time left, and starts toasts raised meanwhile frozen', () => {
        service.toast({ heading: 'old', duration: 5000, showCountdown: true });
        vi.advanceTimersByTime(3000);
        service.pause();
        service.pause();
        service.toast({ heading: 'new', duration: 3000 });
        vi.advanceTimersByTime(60_000);
        expect(heads()).toEqual(['old', 'new']);
        expect(service.toasts[0]!.countdownSeconds).toBe(2);
        service.resume();
        service.resume();
        vi.advanceTimersByTime(1999);
        expect(heads()).toEqual(['old', 'new']);
        vi.advanceTimersByTime(1);
        expect(heads()).toEqual(['new']);
        vi.advanceTimersByTime(1000);
        expect(heads()).toEqual([]);
    });

    it('keeps the time left across a repeated pause, and ignores a resume it did not follow a pause with', () => {
        service.toast({ heading: 'a', duration: 5000 });
        vi.advanceTimersByTime(3000);
        service.pause();
        vi.advanceTimersByTime(10_000);
        service.pause();
        service.resume();
        vi.advanceTimersByTime(1999);
        expect(heads()).toEqual(['a']);
        vi.advanceTimersByTime(1);
        expect(heads()).toEqual([]);

        service.toast({ heading: 'b', duration: 5000 });
        vi.advanceTimersByTime(3000);
        service.resume();
        vi.advanceTimersByTime(2000);
        expect(heads()).toEqual([]);
    });

    it('stops every clock of a dismissed or cleared toast, so nothing fires for it later', () => {
        const changes: number[] = [];
        const a = service.toast({ heading: 'a', showCountdown: true });
        service.addEventListener('change', () => changes.push(service.toasts.length));
        service.dismiss('toast-unknown');
        expect(changes).toEqual([]);
        service.dismiss(a);
        vi.advanceTimersByTime(10_000);
        expect(changes).toEqual([0]);

        service.toast({ heading: 'b', showCountdown: true });
        service.dismissAll();
        const settled = changes.length;
        vi.advanceTimersByTime(10_000);
        expect(changes.length).toBe(settled);
    });

    it('restarts the clock when only the countdown is switched on, and stamps the new start time', () => {
        const id = service.toast({ heading: 'a', duration: 5000 });
        vi.advanceTimersByTime(3000);
        const stamp = Date.now();
        service.update(id, { showCountdown: true });
        expect([service.toasts[0]!.countdownSeconds, service.toasts[0]!.createdAt]).toEqual([5, stamp]);
        vi.advanceTimersByTime(4999);
        expect(heads()).toEqual(['a']);
        vi.advanceTimersByTime(1);
        expect(heads()).toEqual([]);
    });

    it('patches a toast in place, restarting the clock only when the timing changes', () => {
        const a = service.toast({ heading: 'A', duration: 5000 });
        service.toast({ heading: 'B', duration: 0 });
        vi.advanceTimersByTime(4000);
        service.update(a, { heading: 'A2', variant: 'success' });
        expect(service.toasts.map((t) => [t.id === a, t.heading, t.variant])).toEqual([[true, 'A2', 'success'], [false, 'B', undefined]]);
        vi.advanceTimersByTime(1000);
        expect(heads()).toEqual(['B']);

        const c = service.toast({ heading: 'C', duration: 5000 });
        vi.advanceTimersByTime(4000);
        service.update(c, { duration: 3000 });
        vi.advanceTimersByTime(2999);
        expect(heads()).toEqual(['B', 'C']);
        vi.advanceTimersByTime(1);
        expect(heads()).toEqual(['B']);
        service.update('toast-unknown', { heading: 'x' });
        expect(heads()).toEqual(['B']);
    });

    it('turns a promise into a loading toast that becomes its result in the same slot', async () => {
        const options = { loading: 'Saving…', description: 'a moment', success: (n: number) => `Saved ${n}`, error: (e: unknown) => `Failed: ${(e as Error).message}`, duration: 2000 };
        service.toast({ heading: 'before' });
        const ok = service.promise(Promise.resolve(7), options);
        expect(service.toasts[1]).toMatchObject({ heading: 'Saving…', loading: true, duration: 0 });
        await expect(ok).resolves.toBe(7);
        expect(service.toasts[1]).toMatchObject({ heading: 'Saved 7', variant: 'success', loading: false, duration: 2000, description: 'a moment' });
        vi.advanceTimersByTime(2000);
        expect(heads()).toEqual(['before']);

        const failed = service.promise(Promise.reject(new Error('boom')), options);
        await expect(failed).rejects.toThrow('boom');
        expect(service.toasts[1]).toMatchObject({ heading: 'Failed: boom', variant: 'destructive', loading: false });
    });

    it('does not bring back a promise toast the user closed', async () => {
        let settle!: (value: string) => void;
        const pending = service.promise(new Promise<string>((resolve) => (settle = resolve)), { loading: 'Working', success: 'Done', error: 'Failed' });
        service.dismiss(service.toasts[0]!.id);
        settle('x');
        await pending;
        expect(service.toasts).toEqual([]);
    });

    it('clears the queue and every pending clock', () => {
        service.toast({ heading: 'a', showCountdown: true });
        service.toast({ heading: 'b' });
        service.dismissAll();
        expect(service.toasts).toEqual([]);
        const later = service.toast({ heading: 'c', duration: 0 });
        vi.advanceTimersByTime(60_000);
        expect(service.toasts.map((t) => t.id)).toEqual([later]);
    });
});

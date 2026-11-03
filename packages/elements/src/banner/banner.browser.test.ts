import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeBanner } from './banner.js';

const live = (banner: Element) => banner.shadowRoot!.querySelector('.row');
const close = (banner: Element) => banner.shadowRoot!.querySelector('ge-button')!.shadowRoot!.querySelector('button')!;

describe('ge-banner', () => {
    it('announces politely, except a destructive banner which interrupts', async () => {
        const page = await mount(`<ge-banner message="Maintenance tonight"></ge-banner><ge-banner variant="success" message="Saved"></ge-banner><ge-banner variant="destructive" message="Payment failed"></ge-banner>`);
        const [info, success, destructive] = [...page.querySelectorAll('ge-banner')].map(live);

        expect([info!.getAttribute('role'), info!.getAttribute('aria-live')]).toEqual(['status', 'polite']);
        expect([success!.getAttribute('role'), success!.getAttribute('aria-live')]).toEqual(['status', 'polite']);
        expect([destructive!.getAttribute('role'), destructive!.getAttribute('aria-live')]).toEqual(['alert', 'assertive']);
    });

    it('shows the message, and projected content replaces it entirely', async () => {
        const page = await mount(`<ge-banner message="Plain text"></ge-banner><ge-banner message="Plain text">Custom <a href="#">link</a></ge-banner>`);
        const [plain, custom] = [...page.querySelectorAll<GeBanner>('ge-banner')];
        const shown = (b: GeBanner) => b.shadowRoot!.querySelector('slot')!.assignedNodes({ flatten: true }).map((n) => n.textContent).join('');

        expect(shown(plain)).toBe('Plain text');
        expect(shown(custom)).toBe('Custom link');
    });

    it('dismisses once: hides the bar, stops being a live region, and fires one event', async () => {
        const page = await mount(`<ge-banner message="Maintenance tonight" dismissible close-label="Dismiss notice"></ge-banner>`);
        const banner = page.querySelector<GeBanner>('ge-banner')!;
        let fired = 0;
        banner.addEventListener('dismissed', () => fired++);

        expect(close(banner).getAttribute('aria-label')).toBe('Dismiss notice');
        await userEvent.click(close(banner));
        await banner.updateComplete;
        banner.dismiss();
        await banner.updateComplete;

        expect(fired).toBe(1);
        expect(banner.visible).toBe(false);
        expect(banner.hasAttribute('hidden')).toBe(true);
        expect(banner.getBoundingClientRect().height).toBe(0);
        expect(live(banner)).toBeNull();
    });

    it('has no close button unless dismissible', async () => {
        const page = await mount(`<ge-banner message="Maintenance tonight"></ge-banner>`);
        expect(page.querySelector('ge-banner')!.shadowRoot!.querySelector('ge-button')).toBeNull();
    });

    it('tints warning and success by theme, with the text colour lightening in dark mode', async () => {
        const page = await mount(`<ge-banner variant="warning" message="Heads up"></ge-banner>`);
        const banner = page.querySelector('ge-banner')!;
        const light = getComputedStyle(banner).color;
        await useTheme('dark');
        const dark = getComputedStyle(banner).color;

        expect(light).not.toBe(dark);
        expect(getComputedStyle(banner).backgroundColor).not.toBe(getComputedStyle(page.ownerDocument.body).backgroundColor);
    });
});

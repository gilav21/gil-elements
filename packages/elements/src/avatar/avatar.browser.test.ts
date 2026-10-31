import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import { GeAvatar } from './avatar.js';

const GOOD = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#6366f1"/></svg>');
const BAD = 'data:image/png;base64,AAAA';
const settle = async (avatar: GeAvatar) => {
    await vi.waitFor(() => expect(avatar.status).not.toBe('loading'));
    await avatar.updateComplete;
};
const visible = (el: Element | null) => !!el && getComputedStyle(el).display !== 'none';

describe('ge-avatar', () => {
    it('shows the image once it loads and the fallback while it has not, for its own image and a slotted one', async () => {
        const page = await mount(`
            <ge-avatar id="own" src="${GOOD}" alt="Jo" fallback="JD"></ge-avatar>
            <ge-avatar id="slotted"><img src="${GOOD}" alt="Jo"><span slot="fallback">JD</span></ge-avatar>`);
        const own = page.querySelector<GeAvatar>('#own')!;
        const slotted = page.querySelector<GeAvatar>('#slotted')!;

        expect(own.shadowRoot!.querySelector('.fallback')).not.toBeNull();
        await Promise.all([settle(own), settle(slotted)]);

        expect(own.status).toBe('loaded');
        expect(visible(own.shadowRoot!.querySelector('.image'))).toBe(true);
        expect(own.shadowRoot!.querySelector('.fallback')).toBeNull();
        expect(slotted.status).toBe('loaded');
        expect(visible(slotted.querySelector('img'))).toBe(true);
        expect(slotted.shadowRoot!.querySelector('.fallback')).toBeNull();
    });

    it('keeps the fallback and hides a broken image, and starts over when src changes', async () => {
        const page = await mount(`
            <ge-avatar id="own" src="${BAD}" alt="Jo" fallback="JD"></ge-avatar>
            <ge-avatar id="slotted"><img src="${BAD}" alt="Jo"><span slot="fallback">JD</span></ge-avatar>`);
        const own = page.querySelector<GeAvatar>('#own')!;
        const slotted = page.querySelector<GeAvatar>('#slotted')!;
        await Promise.all([settle(own), settle(slotted)]);

        expect([own.status, slotted.status]).toEqual(['error', 'error']);
        expect(visible(own.shadowRoot!.querySelector('.image'))).toBe(false);
        expect(visible(slotted.querySelector('img'))).toBe(false);
        expect(own.shadowRoot!.querySelector('.fallback')!.textContent).toContain('JD');

        own.src = GOOD;
        await own.updateComplete;
        expect(own.status).toBe('loading');
        await settle(own);
        expect(own.status).toBe('loaded');
    });

    it('picks up an image added after the avatar, and one that finished loading before the avatar upgraded', async () => {
        const page = await mount('<ge-avatar id="late" fallback="JD"></ge-avatar>');
        const late = page.querySelector<GeAvatar>('#late')!;
        // Blob URLs load asynchronously, unlike data URLs, which can already be complete when the
        // slot reports them; that is what makes this image genuinely "late".
        const blob = () => URL.createObjectURL(new Blob([decodeURIComponent(GOOD.split(',')[1])], { type: 'image/svg+xml' }));
        const slow = new Image();
        slow.src = blob();
        late.append(slow);

        // Server-rendered markup: the image is in the page, and loaded, before the tag is defined.
        const holder = document.createElement('div');
        holder.innerHTML = `<ge-avatar-upgraded fallback="JD"><img src="${blob()}" alt="Jo"></ge-avatar-upgraded>`;
        document.body.append(holder);
        await holder.querySelector('img')!.decode();
        await new Promise((resolve) => setTimeout(resolve, 50)); // let the image's own load event fire, unobserved
        customElements.define('ge-avatar-upgraded', class extends GeAvatar {});
        const upgraded = holder.querySelector<GeAvatar>('ge-avatar-upgraded')!;
        await Promise.all([settle(late), settle(upgraded)]);
        holder.remove();

        expect([late.status, upgraded.status]).toEqual(['loaded', 'loaded']);
    });

    it('scales its size with density', async () => {
        const page = await mount(`<ge-avatar fallback="JD"></ge-avatar><div style="--density: 1.25"><ge-avatar fallback="JD"></ge-avatar></div>`);
        const [base, big] = page.querySelectorAll('ge-avatar');

        expect(base.getBoundingClientRect().width).toBe(40);
        expect(big.getBoundingClientRect().width).toBe(50);
    });

    it.each(['light', 'dark'])('has no axe violations in %s mode', async (mode) => {
        useTheme(mode);
        const page = await mount(`<ge-avatar src="${GOOD}" alt="Jo Doe" fallback="JD"></ge-avatar>`);
        await settle(page.querySelector<GeAvatar>('ge-avatar')!);
        const result = await axe.run(page, { rules: { region: { enabled: false } } });

        expect(result.violations.map((v) => v.id)).toEqual([]);
    });
});

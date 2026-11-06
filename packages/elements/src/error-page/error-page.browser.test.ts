import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeErrorPage } from './error-page.js';

const pageOf = (root: HTMLElement) => root.querySelector<GeErrorPage>('ge-error-page')!;
const part = (el: GeErrorPage, selector: string) => el.shadowRoot!.querySelector<HTMLElement>(selector)!;
const copy = (el: GeErrorPage) => [part(el, 'h1').textContent, part(el, 'p').textContent];
async function error(attrs = '', inner = ''): Promise<GeErrorPage> {
    const root = await mount(`<ge-error-page ${attrs}>${inner}</ge-error-page>`);
    const el = pageOf(root);
    await el.updateComplete;
    return el;
}

describe('ge-error-page', () => {
    it('shows the code, its default copy and two buttons that report go-back and go-home', async () => {
        const el = await error();
        const seen: string[] = [];
        el.addEventListener('go-back', () => seen.push('back'));
        el.addEventListener('go-home', () => seen.push('home'));
        const above: string[] = [];
        for (const name of ['go-back', 'go-home']) el.parentElement!.addEventListener(name, () => above.push(name));

        expect(part(el, '.code').textContent).toBe('404');
        expect(copy(el)).toEqual(['Page not found', "The page you're looking for doesn't exist or has moved."]);
        const [back, home] = [...el.shadowRoot!.querySelectorAll<HTMLElement>('ge-button')];
        expect([back!.textContent, home!.textContent]).toEqual(['Go back', 'Go home']);
        back!.click();
        home!.click();
        expect([seen, above]).toEqual([['back', 'home'], ['go-back', 'go-home']]);
    });

    it('picks the copy by code, falls back for unknown codes (even inherited names) and lets heading and description override', async () => {
        const forbidden = await error('code="403"');
        expect(copy(forbidden)).toEqual(['Access denied', "You don't have permission to view this page."]);
        expect((await error('code="500"')).shadowRoot!.querySelector('h1')!.textContent).toBe('Server error');

        for (const code of ['418', 'toString']) {
            const unknown = await error(`code="${code}"`);
            expect([part(unknown, '.code').textContent, ...copy(unknown)]).toEqual([code, 'Something went wrong', 'An unexpected error occurred. Please try again.']);
        }

        const custom = await error('code="404" heading="Lost in space" description="Try the map."');
        expect(copy(custom)).toEqual(['Lost in space', 'Try the map.']);
    });

    it('speaks the locale: Hebrew copy and buttons in a right-to-left column, and an object locale as given', async () => {
        const he = await error('code="403" locale="he"');
        expect(copy(he)[0]).toBe('הגישה נחסמה');
        expect(part(he, '.page').getAttribute('dir')).toBe('rtl');
        expect(part(he, 'ge-button').textContent).toBe('חזרה');

        const custom = await error('code="404"');
        custom.locale = { code: 'xx', goBack: 'Retreat', goHome: 'Base', fallback: { title: 'f', description: 'f' }, codes: { '404': { title: 'Gone', description: 'Nothing here.' } } };
        await custom.updateComplete;
        expect([...copy(custom), part(custom, 'ge-button').textContent, part(custom, '.page').hasAttribute('dir')]).toEqual(['Gone', 'Nothing here.', 'Retreat', false]);
    });

    it('a projected illustration replaces the code, and a projected actions row replaces the buttons and the events', async () => {
        const root = await mount(`<ge-error-page code="500">
            <ge-error-page-illustration><img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="></ge-error-page-illustration>
            <ge-error-page-actions><button id="retry">Try again</button></ge-error-page-actions>
        </ge-error-page>`);
        const el = pageOf(root);
        await el.updateComplete;
        const slotted = (name: string) => part(el, `slot[name="${name}"]`) as HTMLSlotElement;

        expect(slotted('illustration').assignedElements().map((e) => e.localName)).toEqual(['ge-error-page-illustration']);
        expect(slotted('actions').assignedElements().map((e) => e.localName)).toEqual(['ge-error-page-actions']);
        let fired = 0;
        el.addEventListener('go-back', () => fired++);
        el.addEventListener('go-home', () => fired++);
        root.querySelector<HTMLButtonElement>('#retry')!.click();
        expect(fired).toBe(0);
        // Fallback content stays in the slot but is not rendered: only the assigned nodes lay out.
        expect(part(el, '.code').getClientRects().length).toBe(0);
        expect(part(el, '.actions').getClientRects().length).toBe(0);
    });

    it('an actions row nested in a wrapper is not projected, so the default buttons stay', async () => {
        const el = await error('', '<div><ge-error-page-actions><button>Nested</button></ge-error-page-actions></div>');
        expect(part(el, '.actions').getClientRects().length).toBeGreaterThan(0);
    });

    it('fills at least 60vh on phones and 70vh from 640px, centred', async () => {
        const el = await error();
        const box = part(el, '.page').getBoundingClientRect();
        const factor = window.innerWidth >= 640 ? 0.7 : 0.6;
        expect(box.height).toBeGreaterThanOrEqual(window.innerHeight * factor - 1);
        expect(getComputedStyle(part(el, '.page')).textAlign).toBe('center');
        expect(getComputedStyle(part(el, '.code')).fontSize).toBe(window.innerWidth >= 640 ? '96px' : '60px');
    });

    it('has no accessibility violations', async () => {
        const el = await error('code="500"');
        const result = await axe.run(el, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
        expect(result.violations.map((v) => v.id)).toEqual([]);
    });
});

import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import '../button/define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeResult } from './index.js';

const result = (page: HTMLElement) => page.querySelector<GeResult>('ge-result')!;
const inner = (page: HTMLElement, selector: string) => result(page).shadowRoot!.querySelector<HTMLElement>(selector);
const settle = async (page: HTMLElement) => {
    await result(page).updateComplete;
    await result(page).updateComplete;
};
const colour = (page: HTMLElement) => getComputedStyle(inner(page, '.icon')!).color;

describe('ge-result', () => {
    it('is a polite status panel for every status, and never takes focus', async () => {
        const page = await mount(`<input id="field"><ge-result status="error" heading="Upload failed" description="Try again."><ge-button>Retry</ge-button></ge-result>`);
        page.querySelector<HTMLInputElement>('#field')!.focus();
        await settle(page);
        const panel = inner(page, 'output')!;

        expect(panel.getAttribute('aria-live')).toBe('polite');
        expect(panel.getAttribute('role')).toBeNull();
        expect(document.activeElement).toBe(page.querySelector('#field'));
        for (const status of ['success', 'warning', 'info'] as const) {
            result(page).status = status;
            await settle(page);
            expect(inner(page, 'output')!.getAttribute('aria-live')).toBe('polite');
        }
    });

    it('gives each status its own glyph and colour, and falls back to info', async () => {
        const page = await mount(`<ge-result heading="Done"></ge-result>`);
        const seen = new Map<string, { glyph: string | null; colour: string }>();
        for (const status of ['success', 'error', 'warning', 'info'] as const) {
            result(page).status = status;
            await settle(page);
            seen.set(status, { glyph: inner(page, '.icon path')!.getAttribute('d'), colour: colour(page) });
        }

        expect(new Set([...seen.values()].map((s) => s.glyph)).size).toBe(4);
        expect(new Set([...seen.values()].map((s) => s.colour)).size).toBe(4);

        result(page).status = 'bogus' as never;
        await settle(page);
        expect(inner(page, '.icon path')!.getAttribute('d')).toBe(seen.get('info')!.glyph);
    });

    it('omits an empty heading and description, and an empty actions row', async () => {
        const page = await mount(`<ge-result status="success"></ge-result>`);
        await settle(page);

        expect(inner(page, '.title')).toBeNull();
        expect(inner(page, '.description')).toBeNull();
        expect(getComputedStyle(inner(page, '.actions')!).display).toBe('none');

        result(page).heading = 'Saved';
        result(page).description = 'All changes are stored.';
        result(page).insertAdjacentHTML('beforeend', '<ge-button>Continue</ge-button>');
        await new Promise((r) => setTimeout(r, 0));
        await settle(page);
        expect(inner(page, '.title')!.textContent!.trim()).toBe('Saved');
        expect(inner(page, '.description')!.textContent!.trim()).toBe('All changes are stored.');
        expect(getComputedStyle(inner(page, '.actions')!).display).toBe('flex');
    });

    it('draws a result-detail above the actions and keeps it out of the live announcement', async () => {
        const page = await mount(`<ge-result status="error" heading="Failed"><ge-result-detail id="d">Error 413</ge-result-detail><ge-button id="b">Retry</ge-button></ge-result>`);
        await settle(page);
        const detail = page.querySelector<HTMLElement>('#d')!;
        const actions = inner(page, '.actions')!.getBoundingClientRect();

        expect(detail.slot).toBe('detail');
        expect(detail.getAttribute('aria-live')).toBe('off');
        expect(detail.getBoundingClientRect().bottom).toBeLessThanOrEqual(actions.top);
        expect(page.querySelector('#b')!.shadowRoot!.querySelector('button')!.getBoundingClientRect().top).toBeGreaterThanOrEqual(actions.top);
    });

    describe.each(['light', 'dark'] as const)('%s theme', (theme) => {
        useTheme(theme);
        it('has no axe violations', async () => {
            const page = await mount(`<ge-result status="warning" heading="Check your details" description="Some fields need attention."><ge-result-detail>Postcode is missing.</ge-result-detail><ge-button>Fix</ge-button></ge-result>`);
            await settle(page);
            const out = await axe.run(page, { rules: { 'color-contrast': { enabled: false } } });
            expect(out.violations).toEqual([]);
        });
    });
});

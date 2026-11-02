import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import '../button/define.js';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import { deepActive } from '../shared/overlay.js';
import type { GeAlertDialog } from './index.js';

const SIMPLE = `<ge-alert-dialog>
  <ge-alert-dialog-trigger><ge-button id="open" variant="destructive">Delete account</ge-button></ge-alert-dialog-trigger>
  <ge-alert-dialog-content heading="Are you absolutely sure?" description="This action cannot be undone."></ge-alert-dialog-content>
</ge-alert-dialog>`;

const dialog = (page: HTMLElement) => page.querySelector<GeAlertDialog>('ge-alert-dialog')!;
const content = (page: HTMLElement) => page.querySelector('ge-alert-dialog-content')!;
const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const el of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await el.updateComplete;
        for (const el of content(page).shadowRoot?.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*') ?? []) await el.updateComplete;
    }
};
const inner = (page: HTMLElement, selector: string) => content(page).shadowRoot!.querySelector<HTMLElement>(selector);
const generated = (page: HTMLElement, tag: string) => content(page).shadowRoot!.querySelector(tag)!.shadowRoot!.querySelector('button')!;
const open = async (page: HTMLElement) => {
    page.querySelector<HTMLElement>('#open')!.click();
    await settle(page);
};

describe('ge-alert-dialog', () => {
    it('opens as an alertdialog with generated Cancel and Continue and no close button, and focuses the first choice', async () => {
        const page = await mount(SIMPLE);
        await settle(page);
        expect(inner(page, '.panel')).toBeNull();

        await open(page);

        const panel = inner(page, '.panel')!;
        expect(panel.getAttribute('role')).toBe('alertdialog');
        expect(panel.getAttribute('aria-label')).toBe('Are you absolutely sure?');
        const labels = [...content(page).shadowRoot!.querySelectorAll('ge-alert-dialog-cancel, ge-alert-dialog-action')].map((b) => b.textContent!.trim());
        expect(labels).toEqual(['Cancel', 'Continue']);
        expect(inner(page, '.close')).toBeNull();
        expect(deepActive()).toBe(generated(page, 'ge-alert-dialog-cancel'));
    });

    it('is not dismissed by clicking the overlay, but Escape and the choices close it', async () => {
        const page = await mount(SIMPLE);
        await open(page);

        inner(page, '.overlay')!.click();
        await settle(page);
        expect(dialog(page).open).toBe(true);

        await userEvent.keyboard('{Escape}');
        await settle(page);
        expect(dialog(page).open).toBe(false);

        await open(page);
        generated(page, 'ge-alert-dialog-cancel').click();
        await settle(page);
        expect(dialog(page).open).toBe(false);
        expect(document.body.style.overflow).toBe('');
    });

    it('announces which generated choice was made and closes, with custom labels', async () => {
        const page = await mount(SIMPLE.replace('<ge-alert-dialog-content ', '<ge-alert-dialog-content action-text="Delete" cancel-text="Keep it" '));
        const seen: string[] = [];
        content(page).addEventListener('action-click', () => seen.push('action'));
        content(page).addEventListener('cancel-click', () => seen.push('cancel'));
        await open(page);
        const labelOf = (tag: string) => content(page).shadowRoot!.querySelector(tag)!.textContent!.trim();
        expect([labelOf('ge-alert-dialog-cancel'), labelOf('ge-alert-dialog-action')]).toEqual(['Keep it', 'Delete']);

        generated(page, 'ge-alert-dialog-action').click();
        await settle(page);
        await open(page);
        generated(page, 'ge-alert-dialog-cancel').click();
        await settle(page);

        expect(seen).toEqual(['action', 'cancel']);
        expect(dialog(page).open).toBe(false);
    });

    it('closes from slotted cancel and action in custom mode, and takes its name from the slotted title', async () => {
        const page = await mount(`<ge-alert-dialog><ge-alert-dialog-trigger><ge-button id="open">Discard</ge-button></ge-alert-dialog-trigger>
          <ge-alert-dialog-content><ge-alert-dialog-header><ge-alert-dialog-title>Discard changes?</ge-alert-dialog-title></ge-alert-dialog-header>
          <ge-alert-dialog-footer><ge-alert-dialog-cancel id="stay">Stay</ge-alert-dialog-cancel><ge-alert-dialog-action id="go">Discard</ge-alert-dialog-action></ge-alert-dialog-footer></ge-alert-dialog-content></ge-alert-dialog>`);
        await open(page);
        expect(inner(page, '.panel')!.getAttribute('aria-label')).toBe('Discard changes?');

        page.querySelector('#go')!.shadowRoot!.querySelector('button')!.click();
        await settle(page);
        expect(dialog(page).open).toBe(false);
    });

    it('keeps Tab inside: from the last choice it wraps to the first', async () => {
        const page = await mount(SIMPLE);
        await open(page);
        await userEvent.tab();
        expect(deepActive()).toBe(generated(page, 'ge-alert-dialog-action'));
        await userEvent.tab();
        expect(deepActive()).toBe(generated(page, 'ge-alert-dialog-cancel'));
    });

    describe.each(['light', 'dark'] as const)('%s theme', (theme) => {
        useTheme(theme);
        it('has no accessibility violations while open', async () => {
            const page = await mount(SIMPLE.replace('<ge-alert-dialog>', '<ge-alert-dialog open>'));
            await settle(page);
            const { violations } = await axe.run(page);
            expect(violations.map((v) => v.id)).toEqual([]);
        });
    });
});

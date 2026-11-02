import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import '../button/define.js';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import { deepActive } from '../shared/overlay.js';
import type { GeDialog } from './index.js';

const MARKUP = `<ge-dialog>
  <ge-dialog-trigger><ge-button id="open">Edit profile</ge-button></ge-dialog-trigger>
  <ge-dialog-content heading="Edit profile" description="Make changes to your profile here.">
    <input id="name" aria-label="Name">
    <ge-dialog-footer><ge-button id="cancel" variant="outline">Cancel</ge-button><ge-button id="save">Save</ge-button></ge-dialog-footer>
  </ge-dialog-content>
</ge-dialog>`;

const dialog = (page: HTMLElement) => page.querySelector<GeDialog>('ge-dialog')!;
const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const el of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await el.updateComplete;
    }
};
const panel = (page: HTMLElement) => page.querySelector('ge-dialog-content')!.shadowRoot!.querySelector<HTMLElement>('.panel');
const part = (page: HTMLElement, selector: string) => page.querySelector('ge-dialog-content')!.shadowRoot!.querySelector<HTMLElement>(selector)!;
const open = async (page: HTMLElement) => {
    page.querySelector<HTMLElement>('#open')!.click();
    await settle(page);
};

describe('ge-dialog', () => {
    it('draws nothing while closed and opens from the trigger, with a name, modal semantics and scroll locked', async () => {
        const page = await mount(MARKUP);
        await settle(page);
        expect(panel(page)).toBeNull();

        await open(page);

        expect(dialog(page).open).toBe(true);
        expect(panel(page)!.getAttribute('role')).toBe('dialog');
        expect(panel(page)!.getAttribute('aria-modal')).toBe('true');
        expect(panel(page)!.getAttribute('aria-label')).toBe('Edit profile');
        expect(getComputedStyle(document.body).overflow).toBe('hidden');
    });

    it('closes from the close button, the overlay and Escape, announces each, and unlocks the page', async () => {
        const page = await mount(MARKUP);
        const events: boolean[] = [];
        dialog(page).addEventListener('open-change', (e) => events.push((e as CustomEvent<boolean>).detail));

        for (const how of ['close', 'overlay', 'escape'] as const) {
            await open(page);
            if (how === 'close') part(page, '.close').click();
            else if (how === 'overlay') part(page, '.overlay').click();
            else await userEvent.keyboard('{Escape}');
            await settle(page);
            expect(dialog(page).open).toBe(false);
            expect(panel(page)).toBeNull();
        }

        expect(events).toEqual([true, false, true, false, true, false]);
        expect(document.body.style.overflow).toBe('');
    });

    it('moves focus to the first control on open, keeps Tab inside, and returns focus to the trigger on close', async () => {
        const page = await mount(MARKUP);
        await settle(page);
        const trigger = page.querySelector<HTMLElement>('#open')!;
        trigger.focus();
        await open(page);
        const name = page.querySelector<HTMLElement>('#name')!;
        expect(deepActive()).toBe(name);

        // name -> cancel -> save -> close -> (wraps) name
        for (let i = 0; i < 4; i++) await userEvent.tab();
        expect(deepActive()).toBe(name);
        await userEvent.tab({ shift: true });
        expect(deepActive()).toBe(part(page, '.close'));

        await userEvent.keyboard('{Escape}');
        await settle(page);
        expect(deepActive()).toBe(trigger.shadowRoot!.querySelector('button'));
    });

    it('lets Escape close only the innermost of two open dialogs, and keeps the page locked until both are gone', async () => {
        const page = await mount(`<ge-dialog id="outer" open><ge-dialog-content heading="Outer"><ge-dialog id="inner" open><ge-dialog-content heading="Inner"><p>Sure?</p></ge-dialog-content></ge-dialog></ge-dialog-content></ge-dialog>`);
        await settle(page);
        const [outer, inner] = [page.querySelector<GeDialog>('#outer')!, page.querySelector<GeDialog>('#inner')!];

        await userEvent.keyboard('{Escape}');
        await settle(page);
        expect([outer.open, inner.open]).toEqual([true, false]);
        expect(getComputedStyle(document.body).overflow).toBe('hidden');

        await userEvent.keyboard('{Escape}');
        await settle(page);
        expect([outer.open, inner.open]).toEqual([false, false]);
        expect(document.body.style.overflow).toBe('');
    });

    it('announces only real changes: show twice or hide while closed says nothing more', async () => {
        const page = await mount(MARKUP);
        const events: boolean[] = [];
        dialog(page).addEventListener('open-change', (e) => events.push((e as CustomEvent<boolean>).detail));

        dialog(page).hide();
        dialog(page).show();
        dialog(page).show();
        dialog(page).toggle();

        expect(events).toEqual([true, false]);
    });

    it('does not announce a change made through the open attribute, and releases the lock when removed while open', async () => {
        const page = await mount(MARKUP);
        let announced = 0;
        dialog(page).addEventListener('open-change', () => announced++);

        dialog(page).open = true;
        await settle(page);
        expect(getComputedStyle(document.body).overflow).toBe('hidden');
        dialog(page).remove();

        expect(announced).toBe(0);
        expect(document.body.style.overflow).toBe('');
    });

    it('takes its name from a slotted title in custom mode and wraps plain trigger content as a button', async () => {
        const page = await mount(`<ge-dialog><ge-dialog-trigger id="t">Open it</ge-dialog-trigger><ge-dialog-content><ge-dialog-header><ge-dialog-title>Delete project</ge-dialog-title></ge-dialog-header></ge-dialog-content></ge-dialog>`);
        await settle(page);
        const wrapper = page.querySelector('#t')!.shadowRoot!.querySelector('[data-slot=dialog-trigger]')!;
        expect(wrapper.getAttribute('role')).toBe('button');

        wrapper.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        await settle(page);
        await settle(page);
        expect(dialog(page).open).toBe(true);
        expect(panel(page)!.getAttribute('aria-label')).toBe('Delete project');
    });

    it('leaves a ge-button trigger as the single tab stop', async () => {
        const page = await mount(MARKUP);
        await settle(page);
        const wrapper = page.querySelector('ge-dialog-trigger')!.shadowRoot!.querySelector('[data-slot=dialog-trigger]')!;
        expect(wrapper.hasAttribute('role')).toBe(false);
        expect(wrapper.hasAttribute('tabindex')).toBe(false);
    });

    describe.each(['light', 'dark'] as const)('%s theme', (theme) => {
        useTheme(theme);
        it('has no accessibility violations while open', async () => {
            const page = await mount(MARKUP.replace('<ge-dialog>', '<ge-dialog open>'));
            await settle(page);
            const { violations } = await axe.run(page);
            expect(violations.map((v) => v.id)).toEqual([]);
        });
    });
});

import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { shortcutBindings, type ShortcutRegistration } from '../shared/shortcut-bindings.js';
import { mount } from '../test-utils.js';
import type { GeShortcutBindingsDialog } from './shortcut-bindings-dialog.js';

const action = (actionId: string, description: string, defaultShortcut: string, category = ''): ShortcutRegistration => ({ actionId, description, defaultShortcut, category: category || undefined, handler: () => undefined });
const handles: { unregister: () => void }[] = [];
beforeEach(() => {
    localStorage.clear();
    shortcutBindings.clearAllShortcutOverrides();
    handles.push(
        shortcutBindings.registerComponent('editor', [action('editor.bold', 'Bold', 'Mod+B', 'Format'), action('editor.save', 'Save', 'Mod+S', 'File')]),
        shortcutBindings.registerComponent('editor', [action('editor.bold', 'Bold', 'Mod+B', 'Format'), action('editor.save', 'Save', 'Mod+S', 'File')]),
        shortcutBindings.registerComponent('data table', [action('table.sort', 'Sort column', 'Alt+S', 'Table')]),
    );
    shortcutBindings.defineShortcuts('kanban', [{ actionId: 'kanban.undo', description: 'Undo last action', defaultShortcut: 'Mod+Z', category: 'Kanban' }]);
});
afterEach(() => {
    for (const handle of handles.splice(0)) handle.unregister();
    shortcutBindings.clearAllShortcutOverrides();
    localStorage.clear();
});

async function dialog(attrs = 'open'): Promise<GeShortcutBindingsDialog> {
    const page = await mount(`<ge-shortcut-bindings-dialog ${attrs}></ge-shortcut-bindings-dialog>`);
    const el = page.firstElementChild as GeShortcutBindingsDialog;
    await settle(el);
    return el;
}
const settle = async (el: GeShortcutBindingsDialog) => {
    await el.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    await el.updateComplete;
};
const root = (el: GeShortcutBindingsDialog) => el.shadowRoot!;
const groupNames = (el: GeShortcutBindingsDialog) => [...root(el).querySelectorAll('.group h3')].map((h) => h.textContent);
const trigger = (item: Element) => item.querySelector(':scope > ge-accordion-trigger')!.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
const group = (el: GeShortcutBindingsDialog, name: string) => root(el).querySelector<HTMLElement>(`.group[data-group="${name}"]`)!;
const isOpen = (item: Element) => trigger(item).getAttribute('aria-expanded') === 'true';
const search = (el: GeShortcutBindingsDialog) => root(el).querySelector<HTMLInputElement>('.search')!;
const type = async (el: GeShortcutBindingsDialog, text: string) => {
    search(el).value = text;
    search(el).dispatchEvent(new Event('input', { bubbles: true }));
    await settle(el);
};
const actionRow = (el: GeShortcutBindingsDialog, name: string, actionId: string) => group(el, name).querySelector<HTMLElement>(`.action[value="action::${name}::${actionId}"]`)!;

describe('ge-shortcut-bindings-dialog', () => {
    it('groups the catalog by component, with counts, categories and live instances inside an opened action', async () => {
        const el = await dialog();

        expect(groupNames(el)).toEqual(['data-table', 'editor', 'kanban']);
        expect(group(el, 'editor').querySelector('p')!.textContent!.replaceAll(/\s+/g, ' ').trim()).toBe('2 active actions / 2 total');
        expect(group(el, 'kanban').querySelector('p')!.textContent!.replaceAll(/\s+/g, ' ').trim()).toBe('0 active actions / 1 total');
        expect(group(el, 'data-table').querySelector('p')!.textContent!.replaceAll(/\s+/g, ' ').trim()).toBe('1 active action / 1 total');

        trigger(group(el, 'editor')).click();
        await settle(el);
        const bold = actionRow(el, 'editor', 'editor.bold');
        trigger(bold).click();
        await settle(el);
        const text = bold.textContent!.replaceAll(/\s+/g, ' ');
        expect(text).toContain('Bold');
        expect(text).toContain('Format');
        expect(text).toContain('Action: editor.bold');
        expect(text).toContain('2 active instances');
        expect([...bold.querySelectorAll('.instance-name')].map((n) => n.textContent)).toEqual(['editor #1', 'editor #2']);
        expect([...bold.querySelectorAll('.instance-default')].map((n) => n.textContent)).toEqual(['Default: Ctrl+B', 'Default: Ctrl+B']);
        expect(bold.querySelector('.capture')!.textContent).toBe('All: Ctrl+B');
        expect([...group(el, 'editor').querySelectorAll('.description')].map((d) => d.textContent)).toEqual(['Save', 'Bold']);
    });

    it('says so for an action with no live instance', async () => {
        const el = await dialog();
        trigger(group(el, 'kanban')).click();
        await settle(el);
        const undo = actionRow(el, 'kanban', 'kanban.undo');
        trigger(undo).click();
        await settle(el);

        expect(undo.querySelector('.no-instances')!.textContent).toBe('No active instances. Use the "All" control to define the shared shortcut for future instances.');
    });

    it('search matches description, action id, category and either shortcut, forces every match open, and says when nothing matches', async () => {
        const el = await dialog();
        for (const [query, groups] of [['bold', ['editor']], ['TABLE.SORT', ['data-table']], ['kanban', ['kanban']], ['ctrl+z', ['kanban']], ['alt+s', ['data-table']], ['file', ['editor']], ['data-table', ['data-table']]] as const) {
            await type(el, query);
            expect([query, groupNames(el)]).toEqual([query, groups]);
        }

        await type(el, 'bold');
        expect(isOpen(group(el, 'editor'))).toBe(true);
        expect(isOpen(actionRow(el, 'editor', 'editor.bold'))).toBe(true);

        await type(el, 'zzz');
        expect(groupNames(el)).toEqual([]);
        expect(root(el).querySelector('.empty')!.textContent).toBe('No shortcuts matched your search.');
        await type(el, '');
        expect(groupNames(el)).toEqual(['data-table', 'editor', 'kanban']);
    });

    it('rebinds an action for every instance from the next key pressed, and Escape or a bare modifier does not', async () => {
        const el = await dialog();
        trigger(group(el, 'editor')).click();
        await settle(el);
        const bold = actionRow(el, 'editor', 'editor.bold');
        const capture = bold.querySelector<HTMLButtonElement>('.capture')!;
        let closed = 0;
        el.addEventListener('open-change', () => closed++);

        capture.click();
        await settle(el);
        expect(isOpen(bold)).toBe(false);
        expect(capture.textContent).toBe('Press keys...');
        expect(capture.hasAttribute('data-armed')).toBe(true);
        await userEvent.keyboard('{Shift}');
        expect(capture.textContent).toBe('Press keys...');
        await userEvent.keyboard('{Escape}');
        await settle(el);
        expect([capture.textContent, el.open, closed]).toEqual(['All: Ctrl+B', true, 0]);

        capture.click();
        await settle(el);
        await userEvent.keyboard('{Control>}{Shift>}u{/Shift}{/Control}');
        await settle(el);
        expect(capture.textContent).toBe('All: Ctrl+Shift+U');
        expect(shortcutBindings.getShortcutOverrideForInstance('editor.bold', 'editor-2')).toBe('ctrl+shift+u');
        expect(capture.hasAttribute('data-armed')).toBe(false);

        await type(el, 'shift+u');
        expect(groupNames(el)).toEqual(['editor']);
        await type(el, 'ctrl+b');
        expect(groupNames(el)).toEqual(['editor']);
    });

    it('a key pressed on a rebind button that was not armed rebinds nothing', async () => {
        const el = await dialog();
        trigger(group(el, 'editor')).click();
        await settle(el);
        const capture = actionRow(el, 'editor', 'editor.bold').querySelector<HTMLButtonElement>('.capture')!;
        capture.focus();
        await userEvent.keyboard('{Control>}u{/Control}');
        await settle(el);

        expect(shortcutBindings.exportOverrideSchema()).toEqual({});
        expect(capture.textContent).toBe('All: Ctrl+B');
    });

    it('cancels an armed capture when a reset is pressed, and lists instances in number order after a number is reused', async () => {
        handles[0]!.unregister();
        handles.push(shortcutBindings.registerComponent('editor', [action('editor.bold', 'Bold', 'Mod+B', 'Format'), action('editor.save', 'Save', 'Mod+S', 'File')]));
        const el = await dialog();
        trigger(group(el, 'editor')).click();
        await settle(el);
        const bold = actionRow(el, 'editor', 'editor.bold');
        trigger(bold).click();
        await settle(el);
        expect([...bold.querySelectorAll('.instance-name')].map((n) => n.textContent)).toEqual(['editor #1', 'editor #2']);

        shortcutBindings.setShortcutOverrideForAllInstances('editor.bold', 'Mod+J', 'editor');
        await settle(el);
        const all = bold.querySelector<HTMLButtonElement>('.capture')!;
        all.click();
        await settle(el);
        expect(all.hasAttribute('data-armed')).toBe(true);
        bold.querySelector<HTMLElement>('.controls ge-button')!.shadowRoot!.querySelector('button')!.click();
        await settle(el);
        expect(all.hasAttribute('data-armed')).toBe(false);

        shortcutBindings.setShortcutOverrideForInstance('editor.bold', 'Alt+J', 'editor-1');
        await settle(el);
        const one = bold.querySelector<HTMLButtonElement>('.instance .capture')!;
        one.click();
        await settle(el);
        expect(one.hasAttribute('data-armed')).toBe(true);
        bold.querySelector<HTMLElement>('.instance ge-button')!.shadowRoot!.querySelector('button')!.click();
        await settle(el);
        expect(one.hasAttribute('data-armed')).toBe(false);
    });

    it('lets the user close what search opened, and keeps it closed while only a capture is armed', async () => {
        const el = await dialog();
        await type(el, 'bold');
        const bold = actionRow(el, 'editor', 'editor.bold');
        expect(isOpen(bold)).toBe(true);

        trigger(bold).click();
        await settle(el);
        bold.querySelector<HTMLButtonElement>('.capture')!.click();
        await settle(el);
        expect([isOpen(bold), isOpen(group(el, 'editor'))]).toEqual([false, true]);

        await type(el, 'bol');
        expect(isOpen(actionRow(el, 'editor', 'editor.bold'))).toBe(true);
    });

    it('rebinds one instance, resets it, and keeps Reset disabled until there is something to reset', async () => {
        const el = await dialog();
        trigger(group(el, 'editor')).click();
        await settle(el);
        const bold = actionRow(el, 'editor', 'editor.bold');
        trigger(bold).click();
        await settle(el);
        const [first, second] = [...bold.querySelectorAll<HTMLElement>('.instance')];
        const reset = (row: HTMLElement) => row.querySelector('ge-button')!;
        expect([reset(first!).hasAttribute('disabled'), reset(bold.querySelector('.controls')!.parentElement!).hasAttribute('disabled')]).toEqual([true, true]);

        second!.querySelector<HTMLButtonElement>('.capture')!.click();
        await settle(el);
        await userEvent.keyboard('{Alt>}b{/Alt}');
        await settle(el);
        expect([...bold.querySelectorAll('.instance .capture')].map((b) => b.textContent)).toEqual(['Ctrl+B', 'Alt+B']);
        expect([reset(first!).hasAttribute('disabled'), reset(second!).hasAttribute('disabled')]).toEqual([true, false]);
        expect(second!.querySelector('.capture')!.getAttribute('aria-label')).toBe('Rebind instance editor #2 for Bold');

        reset(second!).shadowRoot!.querySelector('button')!.click();
        await settle(el);
        expect([...bold.querySelectorAll('.instance .capture')].map((b) => b.textContent)).toEqual(['Ctrl+B', 'Ctrl+B']);
    });

    it('flags two actions on one chord with a Conflict badge but lets the rebind through, and Reset all clears a component-wide override', async () => {
        const el = await dialog();
        trigger(group(el, 'editor')).click();
        trigger(group(el, 'data-table')).click();
        await settle(el);
        const save = actionRow(el, 'editor', 'editor.save');
        const sort = actionRow(el, 'data-table', 'table.sort');
        const badges = (row: HTMLElement) => [...row.querySelectorAll('ge-badge')].map((b) => b.textContent!.trim());
        expect([badges(save), badges(sort)]).toEqual([['File'], ['Table']]);

        save.querySelector<HTMLButtonElement>('.capture')!.click();
        await settle(el);
        await userEvent.keyboard('{Alt>}s{/Alt}');
        await settle(el);
        expect([badges(save), badges(sort)]).toEqual([['File', 'Conflict'], ['Table', 'Conflict']]);
        expect(save.querySelector('.capture')!.textContent).toBe('All: Alt+S');
        const resetAll = save.querySelector<HTMLElement>('.controls ge-button')!;
        expect(resetAll.hasAttribute('disabled')).toBe(false);

        resetAll.shadowRoot!.querySelector('button')!.click();
        await settle(el);
        expect([badges(save), save.querySelector('.capture')!.textContent]).toEqual([['File'], 'All: Ctrl+S']);
    });

    it('shows Save Changes only when allowed, and reports the exported overrides', async () => {
        const plain = await dialog();
        expect(root(plain).querySelector('.save-row')).toBeNull();

        const el = await dialog('open allow-save-mapping');
        shortcutBindings.setShortcutOverrideForAllInstances('editor.bold', 'Mod+Shift+B', 'editor');
        await settle(el);
        let saved: unknown;
        el.parentElement!.addEventListener('mapping-save', (event) => (saved = (event as CustomEvent).detail));
        root(el).querySelector<HTMLElement>('.save-row ge-button')!.shadowRoot!.querySelector('button')!.click();

        expect(saved).toEqual({ 'editor::editor.bold': 'mod+shift+b' });
    });

    it('imports a mapping schema once, replacing or merging, and leaves live rebinds alone when the same schema is set again', async () => {
        shortcutBindings.setShortcutOverride('legacy.action', 'Mod+L');
        const el = await dialog();
        el.mappingSchema = { 'editor::editor.save': 'Alt+W' };
        await settle(el);
        expect(shortcutBindings.exportOverrideSchema()).toEqual({ 'editor::editor.save': 'alt+w' });

        shortcutBindings.setShortcutOverrideForAllInstances('editor.bold', 'Mod+J', 'editor');
        el.mappingSchema = { 'editor::editor.save': 'Alt+W' };
        await settle(el);
        expect(shortcutBindings.exportOverrideSchema()).toEqual({ 'editor::editor.bold': 'mod+j', 'editor::editor.save': 'alt+w' });

        el.replaceOnSchemaLoad = false;
        el.mappingSchema = { 'data-table::table.sort': 'Alt+T' };
        await settle(el);
        expect(Object.keys(shortcutBindings.exportOverrideSchema())).toEqual(['data-table::table.sort', 'editor::editor.bold', 'editor::editor.save']);
    });

    it('closes from the overlay and announces it, and takes its wording and direction from the locale', async () => {
        const el = await dialog('open locale="he"');
        expect(search(el).placeholder).toBe('...חיפוש פעולות, קטגוריות, רכיבים או מקשים');
        expect(root(el).querySelector('ge-dialog-content')!.getAttribute('dir')).toBe('rtl');

        const seen: boolean[] = [];
        el.addEventListener('open-change', (event) => seen.push((event as CustomEvent<boolean>).detail));
        await userEvent.keyboard('{Escape}');
        await settle(el);
        expect([el.open, seen]).toEqual([false, [false]]);
    });

    // The two rules switched off are shadcn-angular's own shape: the rebind control sits inside the accordion trigger,
    // and its aria-label does not repeat the visible chord.
    it('has no other accessibility violations', async () => {
        const el = await dialog();
        trigger(group(el, 'editor')).click();
        await settle(el);
        const result = await axe.run(el, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false }, 'label-content-name-mismatch': { enabled: false }, 'nested-interactive': { enabled: false } } });
        expect(result.violations.map((v) => v.id)).toEqual([]);
    });
});

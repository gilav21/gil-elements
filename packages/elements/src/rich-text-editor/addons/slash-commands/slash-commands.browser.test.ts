import { afterEach, describe, expect, it, vi } from 'vitest';
import { globalRichTextCommands, type RichTextSlashCommand } from '../../rich-text-command-registry.js';
import { createEditor, editableOf, placeCaret } from '../../rich-text-editor.fixture.test.js';
import type { GeRichTextEditor } from '../../rich-text-editor.js';
import '../../locales/de.js';
import './define.js';
import type { SlashCommandsOptions } from './slash-commands.js';

const rect = (left: number, top: number, width: number, height: number) =>
    ({ x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({}) }) as DOMRect;
const ZERO = rect(0, 0, 0, 0);
const CARET = rect(120, 100, 10, 18);

const originalRangeRect = Range.prototype.getBoundingClientRect;
const stubCaret = (value: DOMRect) => {
    Range.prototype.getBoundingClientRect = () => value;
};
afterEach(() => {
    Range.prototype.getBoundingClientRect = originalRangeRect;
    document.getSelection()?.removeAllRanges();
    vi.restoreAllMocks();
});

async function slashEditor(options: SlashCommandsOptions = {}, setup?: (editor: GeRichTextEditor) => void) {
    stubCaret(CARET);
    const editor = await createEditor((el) => {
        el.mode = 'html';
        el.addons = 'slash-commands';
        el.addonOptions = { 'slash-commands': options };
        setup?.(el);
    });
    return { editor, editable: editableOf(editor) };
}

/** Writes one block, puts the caret at its end and raises the input event typing raises. */
function typeSlash(editable: HTMLElement, blockText: string): void {
    editable.innerHTML = `<p>${blockText}</p>`;
    const text = editable.querySelector('p')!.firstChild as Text;
    placeCaret(text, text.length);
    editable.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: '/' }));
}

const keydown = (target: HTMLElement, key: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
const settle = () => new Promise<void>((resolve) => setTimeout(resolve));
const menuOf = (editor: GeRichTextEditor) => editor.querySelector<HTMLElement>('[data-slot="suggestions"]');
const optionsOf = (editor: GeRichTextEditor) => [...editor.querySelectorAll<HTMLElement>('[role="option"]')];
const labelsOf = (editor: GeRichTextEditor) => optionsOf(editor).map((option) => option.textContent?.trim() ?? '');

describe('slash commands: opening and navigating', () => {
    it('opens a plain light-DOM listbox that the editable names with aria-controls and aria-activedescendant', async () => {
        const { editor, editable } = await slashEditor();
        typeSlash(editable, '/');
        await editor.updateComplete;

        const menu = menuOf(editor)!;
        expect(menu.getAttribute('role')).toBe('listbox');
        expect(menu.getAttribute('aria-label')).toBe('Slash command menu');
        expect(menu.slot).toBe('popup');
        expect(editable.getAttribute('aria-controls')).toBe(menu.id);
        expect(editable.getAttribute('aria-activedescendant')).toBe(optionsOf(editor)[0]!.id);
    });

    it('does not open when "/" follows a letter', async () => {
        const { editor, editable } = await slashEditor();
        typeSlash(editable, 'a/hea');
        expect(menuOf(editor)).toBeNull();
    });

    it('does not open while readonly or disabled', async () => {
        const { editor, editable } = await slashEditor();
        editor.readonly = true;
        await editor.updateComplete;
        typeSlash(editable, '/h');
        expect(menuOf(editor)).toBeNull();

        editor.readonly = false;
        editor.disabled = true;
        await editor.updateComplete;
        typeSlash(editable, '/h');
        expect(menuOf(editor)).toBeNull();
    });

    it('narrows the list as the query grows', async () => {
        const { editor, editable } = await slashEditor();
        typeSlash(editable, '/h1');
        const labels = labelsOf(editor);
        expect(labels).toHaveLength(1);
        expect(labels[0]).toContain('Heading 1');
    });

    it('moves the highlighted option with ArrowDown and ArrowUp and closes on Escape', async () => {
        const { editor, editable } = await slashEditor();
        typeSlash(editable, '/');
        expect(optionsOf(editor)[0]!.getAttribute('aria-selected')).toBe('true');

        keydown(editable, 'ArrowDown');
        await editor.updateComplete;
        expect(optionsOf(editor)[1]!.getAttribute('aria-selected')).toBe('true');
        expect(editable.getAttribute('aria-activedescendant')).toBe(optionsOf(editor)[1]!.id);

        keydown(editable, 'ArrowUp');
        expect(optionsOf(editor)[0]!.getAttribute('aria-selected')).toBe('true');

        keydown(editable, 'Escape');
        await editor.updateComplete;
        expect(menuOf(editor)).toBeNull();
        expect(editable.hasAttribute('aria-controls')).toBe(false);
    });

    it('ignores keys that are not menu keys while the menu is open', async () => {
        const { editor, editable } = await slashEditor();
        typeSlash(editable, '/');
        expect(keydown(editable, 'x')).toBe(true);
        expect(menuOf(editor)).not.toBeNull();
    });

    it('no-ops the other keys with no results, and closes on Escape', async () => {
        const { editor, editable } = await slashEditor();
        typeSlash(editable, '/zzzznope');
        expect(optionsOf(editor)).toHaveLength(0);
        expect(menuOf(editor)!.textContent).toContain('No commands found');

        keydown(editable, 'Enter');
        keydown(editable, 'ArrowDown');
        expect(menuOf(editor)).not.toBeNull();
        keydown(editable, 'Escape');
        expect(menuOf(editor)).toBeNull();
    });

    it('closes on an outside press but stays open for presses on the menu and the editor', async () => {
        const { editor, editable } = await slashEditor();
        typeSlash(editable, '/');
        const press = (target: EventTarget) => target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));

        press(optionsOf(editor)[0]!);
        press(editable);
        expect(menuOf(editor)).not.toBeNull();
        press(document.body);
        expect(menuOf(editor)).toBeNull();
    });

    it('stays open when the menu list scrolls and closes when the page scrolls', async () => {
        const { editor, editable } = await slashEditor();
        typeSlash(editable, '/');
        menuOf(editor)!.querySelector('.list')!.dispatchEvent(new Event('scroll', { bubbles: true }));
        expect(menuOf(editor)).not.toBeNull();

        window.dispatchEvent(new Event('scroll'));
        expect(menuOf(editor)).toBeNull();
    });

    it('does not throw when the input arrives with no selection', async () => {
        const { editor, editable } = await slashEditor();
        editable.innerHTML = '<p>/h</p>';
        document.getSelection()!.removeAllRanges();
        expect(() => editable.dispatchEvent(new InputEvent('input', { bubbles: true }))).not.toThrow();
        expect(menuOf(editor)).toBeNull();
    });
});

describe('slash commands: running', () => {
    it('Enter runs the highlighted command and removes the trigger text', async () => {
        const { editor, editable } = await slashEditor();
        typeSlash(editable, '/h1');
        keydown(editable, 'Enter');
        await settle();
        expect(editable.querySelector('h1')).not.toBeNull();
        expect(editable.textContent).not.toContain('/h1');
        expect(menuOf(editor)).toBeNull();
    });

    it('transforms a block into a bullet list, a quote and inline code through the host', async () => {
        const cases: Array<[string, string]> = [['/bullet', 'ul > li'], ['/quote', 'blockquote'], ['/code', 'code']];
        for (const [query, selector] of cases) {
            const { editable } = await slashEditor();
            typeSlash(editable, query);
            keydown(editable, 'Enter');
            await settle();
            expect(editable.querySelector(selector), query).not.toBeNull();
        }
    });

    it('runs the highlighted command on Tab, as Enter does', async () => {
        const { editor, editable } = await slashEditor();
        typeSlash(editable, '/');
        keydown(editable, 'Tab');
        await settle();
        expect(menuOf(editor)).toBeNull();
        expect(editable.textContent).not.toContain('/');
    });

    it('runs undo through the host history', async () => {
        const { editor, editable } = await slashEditor();
        const undo = vi.spyOn(editor, 'undo');
        typeSlash(editable, '/undo');
        keydown(editable, 'Enter');
        await settle();
        expect(undo).toHaveBeenCalledTimes(1);
    });

    it('includes custom commands from the options and runs them', async () => {
        const custom: RichTextSlashCommand = { id: 'custom.stamp', label: 'Stamp Text', keywords: ['stamp'], order: 200, run: (context) => context.insertText('STAMPED') };
        const { editor, editable } = await slashEditor({ commands: [custom] });
        typeSlash(editable, '/stamp');
        expect(labelsOf(editor).some((label) => label.includes('Stamp Text'))).toBe(true);
        keydown(editable, 'Enter');
        await settle();
        expect(editable.textContent).toContain('STAMPED');
    });

    it('localizes the menu strings for Hebrew', async () => {
        const { editor, editable } = await slashEditor({ locale: 'he' });
        typeSlash(editable, '/');
        expect(menuOf(editor)!.getAttribute('aria-label')).toBe('תפריט פקודות');
        expect(labelsOf(editor).some((label) => label.includes('פסקה'))).toBe(true);
    });

    it('follows the editor locale', async () => {
        const { editor, editable } = await slashEditor({}, (el) => {
            el.locale = 'de';
        });
        typeSlash(editable, '/');
        expect(menuOf(editor)!.getAttribute('aria-label')).toBe('Befehlsmenü');
    });

    it('scopes editor-registered commands to their editor, while global commands appear everywhere', async () => {
        const a = await slashEditor();
        const b = await slashEditor();
        const offInstance = a.editor.commands.registerCommand({ id: 'test.only-in-a', label: 'Only in A', keywords: ['test'], order: 1, run: () => undefined });
        const offGlobal = globalRichTextCommands.registerCommand({ id: 'test.everywhere', label: 'Everywhere', keywords: ['test'], order: 2, run: () => undefined });

        typeSlash(a.editable, '/test');
        expect(labelsOf(a.editor).join()).toContain('Only in A');
        expect(labelsOf(a.editor).join()).toContain('Everywhere');
        keydown(a.editable, 'Escape');
        document.getSelection()?.removeAllRanges();

        typeSlash(b.editable, '/test');
        expect(labelsOf(b.editor).join()).toContain('Everywhere');
        expect(labelsOf(b.editor).join()).not.toContain('Only in A');
        offInstance();
        offGlobal();
    });

    it('drops a command from the menu once its registration is torn down', async () => {
        const { editor, editable } = await slashEditor();
        const off = editor.commands.registerCommand({ id: 'test.transient', label: 'Transient Command', keywords: ['transient'], order: 1, run: () => undefined });
        typeSlash(editable, '/transient');
        expect(labelsOf(editor).join()).toContain('Transient Command');
        keydown(editable, 'Escape');

        off();
        typeSlash(editable, '/transient');
        expect(labelsOf(editor).join()).not.toContain('Transient Command');
    });

    it('lets an editor command win an id collision with a global one', async () => {
        const { editor, editable } = await slashEditor();
        const offGlobal = globalRichTextCommands.registerCommand({ id: 'test.collide', label: 'Global Loser', keywords: ['collide'], order: 1, run: () => undefined });
        const offInstance = editor.commands.registerCommand({ id: 'test.collide', label: 'Instance Winner', keywords: ['collide'], order: 1, run: () => undefined });
        typeSlash(editable, '/collide');
        expect(labelsOf(editor).join()).toContain('Instance Winner');
        expect(labelsOf(editor).join()).not.toContain('Global Loser');
        offInstance();
        offGlobal();
    });

    it('breaks command order ties by label', async () => {
        const { editor, editable } = await slashEditor({
            commands: [
                { id: 'c.z', label: 'Zebra Dup', keywords: ['dupkey'], order: 500, run: () => undefined },
                { id: 'c.a', label: 'Alpha Dup', keywords: ['dupkey'], order: 500, run: () => undefined },
            ],
        });
        typeSlash(editable, '/dupkey');
        const labels = labelsOf(editor);
        expect(labels.findIndex((label) => label.includes('Alpha Dup'))).toBeGreaterThanOrEqual(0);
        expect(labels.findIndex((label) => label.includes('Alpha Dup'))).toBeLessThan(labels.findIndex((label) => label.includes('Zebra Dup')));
    });

    it('hides a command whose guard says no', async () => {
        const { editor, editable } = await slashEditor({
            commands: [{ id: 'c.guarded', label: 'Guarded', keywords: ['guard'], when: (context) => context.hasSelection, run: () => undefined }],
        });
        typeSlash(editable, '/guard');
        expect(labelsOf(editor)).toEqual([]);
    });

    it('does not run a command chosen while the editor is disabled', async () => {
        const { editor, editable } = await slashEditor();
        typeSlash(editable, '/h1');
        editor.disabled = true;
        await editor.updateComplete;
        optionsOf(editor)[0]!.click();
        await settle();
        expect(editable.querySelector('h1')).toBeNull();
    });

    it('highlights an option on hover and runs it on click', async () => {
        const { editor, editable } = await slashEditor();
        typeSlash(editable, '/');
        optionsOf(editor)[1]!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        expect(optionsOf(editor)[1]!.getAttribute('aria-selected')).toBe('true');
        expect(optionsOf(editor)[0]!.getAttribute('aria-selected')).toBe('false');

        optionsOf(editor)[0]!.click();
        await settle();
        expect(menuOf(editor)).toBeNull();
    });

    it('keeps the editor focused when an option is pressed', async () => {
        const { editor, editable } = await slashEditor();
        typeSlash(editable, '/');
        const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        optionsOf(editor)[0]!.dispatchEvent(press);
        expect(press.defaultPrevented).toBe(true);
    });

    it('runs custom commands that use insertHtml, showLinkDialog and focusEditor', async () => {
        const { editor, editable } = await slashEditor({
            commands: [
                { id: 'c.html', label: 'Html Cmd', keywords: ['htmlcmd'], order: 300, run: (context) => context.insertHtml('<b>BOLD</b>') },
                { id: 'c.link', label: 'Link Cmd', keywords: ['linkcmd'], order: 301, run: (context) => context.showLinkDialog() },
                { id: 'c.focus', label: 'Focus Cmd', keywords: ['focuscmd'], order: 302, run: (context) => context.focusEditor() },
            ],
        });
        const openedAt: Array<{ x: number; y: number } | undefined> = [];
        editor.registerLinkEditor((hint) => openedAt.push(hint));

        typeSlash(editable, '/htmlcmd');
        keydown(editable, 'Enter');
        await settle();
        expect(editable.querySelector('b')?.textContent).toBe('BOLD');

        typeSlash(editable, '/linkcmd');
        keydown(editable, 'Enter');
        await settle();
        expect(openedAt).toEqual([{ x: 120, y: 118 }]);

        editable.blur();
        typeSlash(editable, '/focuscmd');
        keydown(editable, 'Enter');
        await settle();
        expect(document.activeElement).toBe(editable);
    });

    it('refocuses the editor when a command leaves the selection outside it', async () => {
        const { editable } = await slashEditor({
            commands: [{
                id: 'c.blur', label: 'Blur Cmd', keywords: ['blurcmd'], order: 300,
                run: () => {
                    editable.blur();
                    document.getSelection()?.removeAllRanges();
                },
            }],
        });
        typeSlash(editable, '/blurcmd');
        keydown(editable, 'Enter');
        await settle();
        expect(document.activeElement).toBe(editable);
    });

    it('runs a command even when the live selection was cleared first', async () => {
        const { editable } = await slashEditor();
        typeSlash(editable, 'Intro /h1');
        document.getSelection()?.removeAllRanges();
        keydown(editable, 'Enter');
        await settle();
        expect(editable.querySelector('h1')?.textContent?.trim()).toBe('Intro');
        expect(editable.textContent).not.toContain('/h1');
    });
});

describe('slash commands: switching off and placement', () => {
    it('closes and stops opening when switched off, and opens again when switched back on', async () => {
        const { editor, editable } = await slashEditor();
        typeSlash(editable, '/h');
        expect(menuOf(editor)).not.toBeNull();

        editor.addonOptions = { 'slash-commands': false };
        await editor.updateComplete;
        expect(menuOf(editor)).toBeNull();
        typeSlash(editable, '/h');
        expect(menuOf(editor)).toBeNull();

        editor.addonOptions = { 'slash-commands': {} };
        await editor.updateComplete;
        typeSlash(editable, '/h');
        expect(menuOf(editor)).not.toBeNull();
    });

    it('registers nothing when slashCommand is false', async () => {
        const { editor, editable } = await slashEditor({ slashCommand: false });
        typeSlash(editable, '/h');
        expect(menuOf(editor)).toBeNull();
    });

    it('places the menu just below the caret, aligned to its left edge', async () => {
        const { editor, editable } = await slashEditor();
        stubCaret(rect(40, 30, 1, 18));
        typeSlash(editable, '/');
        const box = menuOf(editor)!.getBoundingClientRect();
        expect(box.left).toBe(40);
        expect(box.top).toBe(52);
    });

    it('falls back to the line rect when the caret rect is degenerate', async () => {
        const { editor, editable } = await slashEditor();
        stubCaret(ZERO);
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(50, 80, 10, 16));
        typeSlash(editable, '/');
        expect(menuOf(editor)!.style.top).toBe('100px');
    });

    it('still opens and runs a command when neither the caret nor its line has a usable rect', async () => {
        const { editor, editable } = await slashEditor();
        stubCaret(ZERO);
        editable.innerHTML = '<p>Intro /h1</p>';
        const block = editable.querySelector('p')!;
        block.getBoundingClientRect = () => ZERO;
        const text = block.firstChild as Text;
        placeCaret(text, text.length);
        editable.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '1' }));
        expect(labelsOf(editor)).toEqual([expect.stringContaining('Heading 1')]);

        keydown(editable, 'Enter');
        await settle();
        expect(editable.querySelector('h1')?.textContent?.trim()).toBe('Intro');
    });

    it('renders in the native top layer when the popover API exists', async () => {
        const { editor, editable } = await slashEditor();
        typeSlash(editable, '/');
        const menu = menuOf(editor)!;
        expect(menu.getAttribute('popover')).toBe('manual');
        expect(menu.matches(':popover-open')).toBe(true);
        expect(menu.style.zIndex).toBe('');
    });
});

describe('slash commands: menu options', () => {
    const commands: RichTextSlashCommand[] = [
        { id: 'a', label: 'Alpha', description: 'first', keywords: ['mn'], order: 1, run: () => undefined },
        { id: 'b', label: 'Beta', keywords: ['mn'], order: 2, run: () => undefined },
        { id: 'c', label: 'Gamma', description: 'third', keywords: ['mn'], order: 3, run: () => undefined },
    ];

    it('renders one option per command, with descriptions where present', async () => {
        const { editor, editable } = await slashEditor({ commands });
        typeSlash(editable, '/mn');
        const options = optionsOf(editor);
        expect(options).toHaveLength(3);
        expect(options[0]!.textContent).toContain('Alpha');
        expect(options[0]!.textContent).toContain('first');
        expect(options[1]!.textContent).toContain('Beta');
        expect(options[1]!.textContent).not.toContain('first');
    });

    it('marks only the highlighted option as selected', async () => {
        const { editor, editable } = await slashEditor({ commands });
        typeSlash(editable, '/mn');
        keydown(editable, 'ArrowDown');
        expect(optionsOf(editor).map((option) => option.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    });

    /** Puts option `index` below a 40px-tall list viewport. */
    function placeBelowViewport(editor: GeRichTextEditor, index: number): HTMLElement {
        const list = menuOf(editor)!.querySelector<HTMLElement>('.list')!;
        const option = optionsOf(editor)[index]!;
        Object.defineProperty(list, 'clientHeight', { value: 40, configurable: true });
        Object.defineProperty(list, 'scrollTop', { value: 0, configurable: true });
        Object.defineProperty(option, 'offsetTop', { value: 200, configurable: true });
        Object.defineProperty(option, 'offsetHeight', { value: 30, configurable: true });
        return option;
    }

    it('scrolls the active option into view when it sits outside the list viewport', async () => {
        const { editor, editable } = await slashEditor({ commands });
        typeSlash(editable, '/mn');
        const option = placeBelowViewport(editor, 1);
        const scroll = vi.fn();
        option.scrollIntoView = scroll;

        keydown(editable, 'ArrowDown');
        expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
    });

    it('keeps navigating where the platform has no scrollIntoView', async () => {
        const { editor, editable } = await slashEditor({ commands });
        typeSlash(editable, '/mn');
        const option = placeBelowViewport(editor, 1);
        Object.defineProperty(option, 'scrollIntoView', { value: undefined, configurable: true });

        expect(() => keydown(editable, 'ArrowDown')).not.toThrow();
        expect(option.getAttribute('aria-selected')).toBe('true');
    });

    it('does not scroll when the active option is already visible', async () => {
        const { editor, editable } = await slashEditor({ commands });
        typeSlash(editable, '/mn');
        const scrolls = optionsOf(editor).map((option) => (option.scrollIntoView = vi.fn()));
        keydown(editable, 'ArrowDown');
        for (const scroll of scrolls) expect(scroll).not.toHaveBeenCalled();
    });
});

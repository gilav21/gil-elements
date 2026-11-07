import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiProvider } from '../../../shared/ai.js';
import { createEditor, editableOf, record, typeHtml } from '../../rich-text-editor.fixture.test.js';
import type { GeRichTextEditor } from '../../rich-text-editor.js';
import { Disposables } from '../../rich-text-registry.js';
import { AiController, type AiOptions } from './ai.js';
import { AI_LOCALES } from './ai-locale.js';
import './define.js';

const rect = (left: number, top: number, width: number, height: number): DOMRect =>
    ({ x: left, y: top, left, top, right: left + width, bottom: top + height, width, height, toJSON: () => ({}) });
const FIXED_RECT = rect(10, 20, 100, 40);

const slot = (editor: GeRichTextEditor, name: string) => editor.shadowRoot!.querySelector<HTMLElement>(`[data-slot="${name}"]`);
const menuButtons = (editor: GeRichTextEditor) => slot(editor, 'rich-text-ai-menu')!.querySelectorAll<HTMLButtonElement>('button');
const reviewButtons = (editor: GeRichTextEditor) => slot(editor, 'rich-text-ai-review')!.querySelectorAll<HTMLButtonElement>('button');
const draftOf = (editor: GeRichTextEditor) => editableOf(editor).querySelector('[data-ai-draft]');
const commandOf = (editor: GeRichTextEditor) => editor.commands.listCommands().find((command) => command.id === 'insert.ai');

/** An editor with the addon enabled through its attribute and options. */
const addonEditor = (options: AiOptions, setup?: (editor: GeRichTextEditor) => void): Promise<GeRichTextEditor> =>
    createEditor((editor) => {
        editor.mode = 'html';
        editor.addons = 'ai';
        editor.addonOptions = { ai: options };
        setup?.(editor);
    });

/** An editor without the addon plus a controller attached by hand, so tests can call it directly. */
async function driven(provider: AiProvider, setup?: (editor: GeRichTextEditor) => void): Promise<{ editor: GeRichTextEditor; ai: AiController }> {
    const editor = await createEditor((el) => {
        el.mode = 'html';
        setup?.(el);
    });
    const ai = new AiController(editor, provider, undefined, new Disposables());
    ai.attach(true, 5);
    return { editor, ai };
}

async function withContent(editor: GeRichTextEditor, html: string): Promise<HTMLDivElement> {
    await typeHtml(editor, html);
    return editableOf(editor);
}

function selectAll(editable: HTMLElement): void {
    const range = new Range();
    range.selectNodeContents(editable);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
}

function collapseCaret(editable: HTMLElement): void {
    const range = new Range();
    range.selectNodeContents(editable);
    range.collapse(false);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
}

/** A provider whose output the test pushes by hand. */
function pushable() {
    const items: Array<{ value?: string; error?: Error; done?: true }> = [];
    let wake = (): void => undefined;
    const send = (item: (typeof items)[number]): void => {
        items.push(item);
        wake();
    };
    async function* source(): AsyncGenerator<string> {
        for (;;) {
            while (items.length === 0) await new Promise<void>((resolve) => (wake = resolve));
            const item = items.shift()!;
            if (item.error) throw item.error;
            if (item.done) return;
            yield item.value!;
        }
    }
    return { source, next: (value: string) => send({ value }), complete: () => send({ done: true }), fail: (error: Error) => send({ error }) };
}

const reviewed = (ai: AiController) => vi.waitFor(() => expect(ai.phase).toBe('review'));

beforeEach(() => {
    vi.spyOn(Range.prototype, 'getBoundingClientRect').mockReturnValue(FIXED_RECT);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('ai addon', () => {
    it('shows the Ask-AI chip on a selection only when a provider is set', async () => {
        const without = await addonEditor({});
        selectAll(await withContent(without, '<p>hello world</p>'));
        await without.updateComplete;
        expect(slot(without, 'rich-text-ai-trigger')).toBeNull();

        const editor = await addonEditor({ provider: () => 'x' });
        selectAll(await withContent(editor, '<p>hello world</p>'));
        await editor.updateComplete;
        expect(slot(editor, 'rich-text-ai-trigger')).not.toBeNull();
    });

    it.each(['readonly', 'disabled'] as const)('does not show the chip when %s', async (state) => {
        const editor = await addonEditor({ provider: () => 'x' }, (el) => {
            el[state] = true;
        });
        selectAll(await withContent(editor, '<p>hello world</p>'));
        await editor.updateComplete;
        expect(slot(editor, 'rich-text-ai-trigger')).toBeNull();
    });

    it('opens the panel from the chip and lists the six built-in tasks', async () => {
        const editor = await addonEditor({ provider: () => 'x' });
        selectAll(await withContent(editor, '<p>hello world</p>'));
        await editor.updateComplete;

        slot(editor, 'rich-text-ai-trigger')!.click();
        await editor.updateComplete;
        expect(slot(editor, 'rich-text-ai-menu')!.querySelectorAll(':scope > button')).toHaveLength(6);
    });

    it('registers the /ai slash command only when a provider is set', async () => {
        expect(commandOf(await addonEditor({}))).toBeUndefined();
        expect(commandOf(await addonEditor({ provider: () => 'x' }))).toBeDefined();
    });

    it('leaves out the slash command when slashCommand is off', async () => {
        expect(commandOf(await addonEditor({ provider: () => 'x', slashCommand: false }))).toBeUndefined();
    });

    it('opens the panel via the /ai slash command run handler', async () => {
        const editor = await addonEditor({ provider: () => 'x' });
        selectAll(await withContent(editor, '<p>hi</p>'));
        void commandOf(editor)!.run({} as never);
        await editor.updateComplete;
        expect(slot(editor, 'rich-text-ai-panel')).not.toBeNull();
    });

    it('describes the slash command in the locale and gives it order 5', async () => {
        const command = commandOf(await addonEditor({ provider: () => 'x' }))!;
        expect([command.label, command.description, command.order]).toEqual([AI_LOCALES.en.slash, AI_LOCALES.en.slashDescription, 5]);
    });

    it('does nothing when no provider is set', async () => {
        const editor = await addonEditor({});
        selectAll(await withContent(editor, '<p>text</p>'));
        await editor.updateComplete;
        expect(slot(editor, 'rich-text-ai-trigger')).toBeNull();
        expect(slot(editor, 'rich-text-ai-panel')).toBeNull();
    });

    it('stops contributing once the options are replaced by ones without a provider', async () => {
        const editor = await addonEditor({ provider: () => 'x' });
        editor.addonOptions = { ai: {} };
        await editor.updateComplete;
        expect(commandOf(editor)).toBeUndefined();
    });

    it('resolves Hebrew strings for the chip and menu', async () => {
        const editor = await addonEditor({ provider: () => 'x', locale: 'he' });
        selectAll(await withContent(editor, '<p>שלום</p>'));
        await editor.updateComplete;

        expect(slot(editor, 'rich-text-ai-trigger')!.textContent).toContain('שאל AI');
        slot(editor, 'rich-text-ai-trigger')!.click();
        await editor.updateComplete;
        expect(slot(editor, 'rich-text-ai-menu')!.textContent).toContain('שפר ניסוח');
    });

    it('hides the chip on a collapsed caret and ignores selectionchange while the panel is open', async () => {
        const editor = await addonEditor({ provider: () => 'x' });
        const editable = await withContent(editor, '<p>hello</p>');
        collapseCaret(editable);
        document.dispatchEvent(new Event('selectionchange'));
        await editor.updateComplete;
        expect(slot(editor, 'rich-text-ai-trigger')).toBeNull();

        void commandOf(editor)!.run({} as never);
        await editor.updateComplete;
        selectAll(editable);
        await editor.updateComplete;
        expect(slot(editor, 'rich-text-ai-trigger')).toBeNull();
    });
});

describe('ai panel flow', () => {
    async function openMenu(): Promise<{ editor: GeRichTextEditor; ai: AiController; editable: HTMLElement }> {
        const { editor, ai } = await driven(() => 'x');
        const editable = await withContent(editor, '<p>hello world</p>');
        selectAll(editable);
        ai.openPanel();
        await editor.updateComplete;
        return { editor, ai, editable };
    }

    it('closes the task menu on Escape', async () => {
        const { editor } = await openMenu();
        expect(slot(editor, 'rich-text-ai-panel')).not.toBeNull();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await editor.updateComplete;
        expect(slot(editor, 'rich-text-ai-panel')).toBeNull();
    });

    it('closes the task menu on an outside pointer press', async () => {
        const { editor } = await openMenu();
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        await editor.updateComplete;
        expect(slot(editor, 'rich-text-ai-panel')).toBeNull();
    });

    it('keeps the task menu open when pressing inside the panel', async () => {
        const { editor } = await openMenu();
        slot(editor, 'rich-text-ai-panel')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
        await editor.updateComplete;
        expect(slot(editor, 'rich-text-ai-panel')).not.toBeNull();
    });

    it('closes the task menu on page scroll', async () => {
        const { editor } = await openMenu();
        window.dispatchEvent(new Event('scroll'));
        await editor.updateComplete;
        expect(slot(editor, 'rich-text-ai-panel')).toBeNull();
    });

    it('ignores non-Escape keys while the menu is open', async () => {
        const { editor } = await openMenu();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
        await editor.updateComplete;
        expect(slot(editor, 'rich-text-ai-panel')).not.toBeNull();
    });

    it('moves focus into the panel and hands it back when the panel closes', async () => {
        const { editor, editable } = await openMenu();
        editable.focus();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await editor.updateComplete;
        expect(document.activeElement).toBe(editable);
    });

    it('runs a built-in task when a menu button is clicked', async () => {
        const { editor, ai } = await driven((request) => `[${request.input}]`);
        selectAll(await withContent(editor, '<p>hello world</p>'));
        ai.openPanel();
        await editor.updateComplete;
        menuButtons(editor)[0]!.click();
        await reviewed(ai);
        await editor.updateComplete;
        expect(draftOf(editor)?.textContent).toBe('[hello world]');
        expect(slot(editor, 'rich-text-ai-review')).not.toBeNull();
    });

    it('runs a custom prompt typed into the panel input', async () => {
        const { editor, ai } = await driven((request) => `(${request.prompt}) ${request.input}`);
        const requests = record<{ task: string; prompt?: string }>(editor, 'ai-request');
        selectAll(await withContent(editor, '<p>base</p>'));
        ai.openPanel();
        await editor.updateComplete;

        const input = slot(editor, 'rich-text-ai-menu')!.querySelector('input')!;
        input.value = '  make it bold ';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await editor.updateComplete;
        const buttons = menuButtons(editor);
        buttons[buttons.length - 1]!.click();
        await reviewed(ai);

        expect(draftOf(editor)?.textContent).toBe('(make it bold) base');
        expect(requests.at(-1)).toEqual({ task: 'custom', prompt: 'make it bold' });
    });

    it('clears the custom prompt when the panel is opened again', async () => {
        const { editor, ai } = await driven(() => 'x');
        selectAll(await withContent(editor, '<p>text</p>'));
        ai.openPanel();
        ai.setPrompt('draft');
        await editor.updateComplete;
        expect(slot(editor, 'rich-text-ai-menu')!.querySelector('input')!.value).toBe('draft');

        ai.discard();
        selectAll(editableOf(editor));
        ai.openPanel();
        await editor.updateComplete;
        expect(slot(editor, 'rich-text-ai-menu')!.querySelector('input')!.value).toBe('');
    });

    it('replaces the selection with the result and keeps it on accept, adding a history entry', async () => {
        const { editor, ai } = await driven((request) => `[${request.input}]`);
        const results = record<string>(editor, 'ai-result');
        const editable = await withContent(editor, '<p>hello world</p>');
        const before = editor.historyEntries().length;
        selectAll(editable);

        ai.openPanel();
        ai.runTask('rewrite');
        await reviewed(ai);
        expect(draftOf(editor)?.textContent).toBe('[hello world]');

        ai.accept();
        await editor.updateComplete;
        expect(editable.textContent).toContain('[hello world]');
        expect(draftOf(editor)).toBeNull();
        expect(results).toContain('[hello world]');
        expect(editor.historyEntries().length).toBeGreaterThan(before);
    });

    it('streams progressive output from an async iterable provider', async () => {
        const stream = pushable();
        const { editor, ai } = await driven(stream.source);
        const editable = await withContent(editor, '<p>seed</p>');
        selectAll(editable);

        ai.openPanel();
        ai.runTask('rewrite');
        await editor.updateComplete;
        expect(slot(editor, 'rich-text-ai-loading')).not.toBeNull();

        stream.next('Hel');
        await vi.waitFor(() => expect(draftOf(editor)?.textContent).toBe('Hel'));
        stream.next('Hello');
        await vi.waitFor(() => expect(draftOf(editor)?.textContent).toBe('Hello'));

        stream.complete();
        await reviewed(ai);
        ai.accept();
        expect(editable.textContent).toContain('Hello');
    });

    it('surfaces provider errors and stays in review', async () => {
        const stream = pushable();
        const { editor, ai } = await driven(stream.source);
        const errors = record<string>(editor, 'ai-error');
        selectAll(await withContent(editor, '<p>x</p>'));

        ai.openPanel();
        ai.runTask('rewrite');
        stream.fail(new Error('boom'));
        await reviewed(ai);
        await editor.updateComplete;

        expect(slot(editor, 'rich-text-ai-error')?.textContent).toContain('boom');
        expect(errors).toContain('boom');
        expect(slot(editor, 'rich-text-ai-review')).not.toBeNull();
        ai.discard();
    });

    it('falls back to the localized failure message for a provider error with no message', async () => {
        const { editor, ai } = await driven(() => Promise.reject(new Error('')));
        const errors = record<string>(editor, 'ai-error');
        selectAll(await withContent(editor, '<p>x</p>'));
        ai.openPanel();
        ai.runTask('rewrite');
        await reviewed(ai);
        expect(errors).toEqual([AI_LOCALES.en.failed]);
        ai.discard();
    });

    it('accepts and retries via the review buttons', async () => {
        let calls = 0;
        const { editor, ai } = await driven(() => `draft-${++calls}`);
        const editable = await withContent(editor, '<p>seed</p>');
        selectAll(editable);
        ai.openPanel();
        ai.runTask('rewrite');
        await reviewed(ai);
        await editor.updateComplete;

        reviewButtons(editor)[2]!.click();
        await vi.waitFor(() => expect(draftOf(editor)?.textContent).toBe('draft-2'));
        await reviewed(ai);
        await editor.updateComplete;

        reviewButtons(editor)[0]!.click();
        await editor.updateComplete;
        expect(editable.textContent).toContain('draft-2');
        expect(slot(editor, 'rich-text-ai-panel')).toBeNull();
    });

    it('discards the draft via the review Discard button', async () => {
        const { editor, ai } = await driven(() => 'NEW');
        const editable = await withContent(editor, '<p>original</p>');
        selectAll(editable);
        ai.openPanel();
        ai.runTask('rewrite');
        await reviewed(ai);
        await editor.updateComplete;
        expect(editable.textContent).toBe('NEW');

        reviewButtons(editor)[1]!.click();
        await editor.updateComplete;
        expect(editable.textContent).toBe('original');
    });

    it('discards the draft on Escape while in review', async () => {
        const { editor, ai } = await driven(() => 'REPLACED');
        const editable = await withContent(editor, '<p>keep</p>');
        selectAll(editable);
        ai.openPanel();
        ai.runTask('rewrite');
        await reviewed(ai);

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await editor.updateComplete;
        expect(editable.textContent).toContain('keep');
        expect(slot(editor, 'rich-text-ai-panel')).toBeNull();
    });

    it('keeps the panel open on an outside pointer press once past the menu phase', async () => {
        const { editor, ai } = await driven(() => 'x');
        selectAll(await withContent(editor, '<p>hi</p>'));
        ai.openPanel();
        ai.runTask('rewrite');
        await reviewed(ai);

        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        await editor.updateComplete;
        expect(slot(editor, 'rich-text-ai-panel')).not.toBeNull();
        ai.discard();
    });

    it('captures a collapsed caret for a continue task and discards it', async () => {
        const { editor, ai } = await driven((request) => `${request.input}!`);
        const editable = await withContent(editor, '<p>story</p>');
        collapseCaret(editable);

        ai.openPanel();
        ai.runTask('continue');
        await reviewed(ai);
        expect(draftOf(editor)?.textContent).toBe('story!');

        ai.discard();
        expect(draftOf(editor)).toBeNull();
        expect(editable.textContent).toBe('story');
    });

    it('runs no task when the panel was opened with no selection range', async () => {
        const { editor, ai } = await driven(() => 'x');
        await withContent(editor, '<p>text</p>');
        document.getSelection()!.removeAllRanges();

        ai.openPanel();
        ai.runTask('rewrite');
        await editor.updateComplete;
        expect(slot(editor, 'rich-text-ai-menu')).not.toBeNull();
        expect(draftOf(editor)).toBeNull();
    });

    it('retries the last task from scratch when no draft exists yet', async () => {
        const { editor, ai } = await driven((request) => `redo:${request.input}`);
        selectAll(await withContent(editor, '<p>again</p>'));

        ai.openPanel();
        ai.retryLast();
        await reviewed(ai);
        expect(draftOf(editor)?.textContent).toBe('redo:again');
        ai.discard();
    });

    it('does not commit a draft the editor no longer contains', async () => {
        const { editor, ai } = await driven(() => 'generated');
        const errors = record<string>(editor, 'ai-error');
        const editable = await withContent(editor, '<p>src</p>');
        selectAll(editable);
        ai.openPanel();
        ai.runTask('rewrite');
        await reviewed(ai);
        expect(draftOf(editor)).not.toBeNull();

        editable.innerHTML = '<p>replaced while the panel was open</p>';
        ai.accept();
        await editor.updateComplete;

        expect(editable.textContent).toBe('replaced while the panel was open');
        expect(draftOf(editor)).toBeNull();
        expect(errors.at(-1)).toBeDefined();
    });

    it('refuses to commit a draft that would exceed maxLength', async () => {
        const { editor, ai } = await driven(() => 'a generated answer far longer than the limit', (el) => {
            el.maxLength = 12;
        });
        const errors = record<string>(editor, 'ai-error');
        const editable = await withContent(editor, '<p>src</p>');
        selectAll(editable);
        ai.openPanel();
        ai.runTask('rewrite');
        await reviewed(ai);
        ai.accept();
        await editor.updateComplete;

        expect(editable.textContent).not.toContain('far longer than the limit');
        expect(errors.at(-1)).toBe(AI_LOCALES.en.tooLong);
    });

    it('commits a draft that fits, even when it is longer than the room left after it', async () => {
        const { editor, ai } = await driven(() => 'twenty-six characters here', (el) => {
            el.maxLength = 40;
        });
        const errors = record<string>(editor, 'ai-error');
        const editable = await withContent(editor, '<p>src</p>');
        selectAll(editable);
        ai.openPanel();
        ai.runTask('rewrite');
        await reviewed(ai);
        ai.accept();
        await editor.updateComplete;

        expect(editable.textContent).toContain('twenty-six characters here');
        expect(errors).toHaveLength(0);
    });

    it('lets Tab reach the AI panel instead of typing a tab character', async () => {
        const { editor, ai } = await driven(() => 'x');
        const editable = await withContent(editor, '<p>Hello world</p>');
        selectAll(editable);
        ai.openPanel();
        await editor.updateComplete;

        const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        editable.dispatchEvent(tab);
        expect(editable.textContent).toBe('Hello world');
        expect(tab.defaultPrevented).toBe(false);
    });

    it('accepting with no active draft is a safe no-op', async () => {
        const { editor, ai } = await driven(() => 'x');
        const errors = record<string>(editor, 'ai-error');
        const editable = await withContent(editor, '<p>content</p>');
        ai.accept();
        await editor.updateComplete;
        expect(editable.textContent).toBe('content');
        expect(errors).toEqual([]);
    });

    it('falls back to the block element rect when the caret rect is degenerate', async () => {
        const { editor, ai } = await driven(() => 'x');
        const editable = await withContent(editor, '<p>positioned</p>');
        selectAll(editable);
        vi.spyOn(Range.prototype, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 0, 0));
        vi.spyOn(editable, 'getBoundingClientRect').mockReturnValue(FIXED_RECT);

        ai.openPanel();
        await editor.updateComplete;
        const panel = slot(editor, 'rich-text-ai-panel')!;
        expect([panel.style.left, panel.style.top]).toEqual(['10px', '68px']);
    });
});

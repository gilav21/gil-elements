import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, editableOf, placeCaret, record } from '../../rich-text-editor.fixture.test.js';
import type { GeRichTextEditor } from '../../rich-text-editor.js';
import './define.js';
import type { MentionsOptions } from './mentions.js';
import { mentionsLocales } from './mentions-locale.js';
import type { MentionItem, RichTextEntityInsertEvent, TagItem } from './mentions-types.js';

const USERS: MentionItem[] = [
    { id: 'u1', value: 'john-doe', label: 'John Doe', description: 'john.doe@example.com' },
    { id: 'u2', value: 'jane.smith', label: 'Jane Smith' },
];
const TAGS: TagItem[] = [
    { id: 't1', value: 'ux', label: 'UX', color: '#f00' },
    { id: 't2', value: 'angular.ui', label: 'Angular UI' },
];

const matching = <T extends { label: string }>(items: T[]) => (query: string) => items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
const rect = (left: number, top: number, width: number, height: number) =>
    ({ x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({}) }) as DOMRect;

const originalRangeRect = Range.prototype.getBoundingClientRect;
afterEach(() => {
    Range.prototype.getBoundingClientRect = originalRangeRect;
    document.getSelection()?.removeAllRanges();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

async function mentionsEditor(options: MentionsOptions = {}, setup?: (editor: GeRichTextEditor) => void) {
    Range.prototype.getBoundingClientRect = () => rect(10, 10, 100, 18);
    const editor = await createEditor((el) => {
        el.mode = 'html';
        el.addons = 'mentions';
        el.addonOptions = { mentions: { search: matching(USERS), tags: true, tagsSearch: matching(TAGS), debounceMs: 0, ...options } };
        setup?.(el);
    });
    return { editor, editable: editableOf(editor) };
}

function typeText(editable: HTMLElement, text: string): void {
    editable.textContent = text;
    placeCaret(editable.firstChild!, text.length);
    editable.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: text.slice(-1) }));
}

const keydown = (target: HTMLElement, key: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
const popupOf = (editor: GeRichTextEditor) => editor.querySelector<HTMLElement>('[data-slot="suggestions"]');
const optionsOf = (editor: GeRichTextEditor) => [...editor.querySelectorAll<HTMLElement>('[role="option"]')];
const labelsOf = (editor: GeRichTextEditor) => optionsOf(editor).map((option) => option.querySelector('.label')?.textContent);
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 5));

describe('mentions: triggers', () => {
    it('opens the mention popup for a handle with dots, underscores and hyphens, searching with the typed query', async () => {
        const search = vi.fn(matching(USERS));
        const { editor, editable } = await mentionsEditor({ search });
        typeText(editable, 'Assign to @john.doe_2-team');

        expect(popupOf(editor)!.getAttribute('aria-label')).toBe('Select a user');
        await vi.waitFor(() => expect(search).toHaveBeenCalledWith('john.doe_2-team'));
    });

    it('opens the tag popup for a unicode, symbol-friendly tag', async () => {
        const tagsSearch = vi.fn(matching(TAGS));
        const { editor, editable } = await mentionsEditor({ tagsSearch });
        typeText(editable, 'Discuss #привет.мир-2');

        expect(popupOf(editor)!.getAttribute('aria-label')).toBe('Select a tag');
        await vi.waitFor(() => expect(tagsSearch).toHaveBeenCalledWith('привет.мир-2'));
    });

    it('opens no tag popup unless tags are on, and no mention popup when mentions are off', async () => {
        const tagsOff = await mentionsEditor({ tags: false });
        typeText(tagsOff.editable, '#ux');
        expect(popupOf(tagsOff.editor)).toBeNull();

        const mentionsOff = await mentionsEditor({ mentions: false });
        typeText(mentionsOff.editable, '@jo');
        expect(popupOf(mentionsOff.editor)).toBeNull();
    });

    it('loads search results into the popup', async () => {
        const { editor, editable } = await mentionsEditor();
        typeText(editable, '@jane');
        await vi.waitFor(() => expect(labelsOf(editor)).toEqual(['Jane Smith']));

        typeText(editable, '#an');
        await vi.waitFor(() => expect(labelsOf(editor)).toEqual(['Angular UI']));
    });

    it('waits out the debounce before searching', async () => {
        vi.useFakeTimers();
        const search = vi.fn(matching(USERS));
        const { editable } = await mentionsEditor({ search, debounceMs: undefined });
        typeText(editable, '@j');
        await vi.advanceTimersByTimeAsync(199);
        expect(search).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(search).toHaveBeenCalledTimes(1);
    });

    it('ignores the result of a search a newer keystroke superseded', async () => {
        const pending: Array<(items: MentionItem[]) => void> = [];
        const search = () => new Promise<MentionItem[]>((resolve) => pending.push(resolve));
        const { editor, editable } = await mentionsEditor({ search });
        typeText(editable, '@j');
        await vi.waitFor(() => expect(pending).toHaveLength(1));
        typeText(editable, '@ja');
        await vi.waitFor(() => expect(pending).toHaveLength(2));

        pending[1]!([USERS[1]!]);
        await settle();
        pending[0]!(USERS);
        await settle();
        expect(labelsOf(editor)).toEqual(['Jane Smith']);
    });

    it('shows no candidates for a search that fails, then searches again on the next keystroke', async () => {
        const failures: Array<() => Promise<MentionItem[]>> = [
            () => Promise.reject(new Error('boom')),
            () => {
                throw new Error('boom');
            },
        ];
        for (const fail of failures) {
            let calls = 0;
            const { editor, editable } = await mentionsEditor({
                search: (query) => (++calls === 1 ? fail() : Promise.resolve(matching(USERS)(query))),
            });
            typeText(editable, '@j');
            await vi.waitFor(() => expect(calls).toBe(1));
            await settle();
            expect(optionsOf(editor)).toEqual([]);
            expect(popupOf(editor)!.textContent).toBe('No users found');

            typeText(editable, '@ja');
            await vi.waitFor(() => expect(labelsOf(editor)).toEqual(['Jane Smith']));
        }
    });

    it('does not open or search when the editor is readonly or disabled, and does when it is not', async () => {
        const search = vi.fn(matching(USERS));
        const { editor, editable } = await mentionsEditor({ search });
        for (const lock of ['readonly', 'disabled'] as const) {
            editor[lock] = true;
            await editor.updateComplete;
            typeText(editable, '@jo');
            await settle();
            expect(popupOf(editor)).toBeNull();
            expect(editable.hasAttribute('aria-controls')).toBe(false);
            expect(search).not.toHaveBeenCalled();
            editor[lock] = false;
            await editor.updateComplete;
        }

        typeText(editable, '@jo');
        await vi.waitFor(() => expect(search).toHaveBeenCalledExactlyOnceWith('jo'));
        expect(popupOf(editor)).not.toBeNull();
    });

    it('closes the popup when the trigger is no longer present', async () => {
        const { editor, editable } = await mentionsEditor();
        typeText(editable, '@jo');
        expect(popupOf(editor)).not.toBeNull();
        typeText(editable, 'plain text');
        expect(popupOf(editor)).toBeNull();
    });

    it('closes the popup live when the options turn both triggers off', async () => {
        const { editor, editable } = await mentionsEditor();
        typeText(editable, 'Hi @jo');
        expect(popupOf(editor)).not.toBeNull();

        editor.addonOptions = { mentions: { mentions: false, tags: false } };
        await editor.updateComplete;
        expect(popupOf(editor)).toBeNull();
    });

    it('resolves Hebrew popup strings and carries the RTL flag', async () => {
        const { editor, editable } = await mentionsEditor({ locale: 'he' });
        typeText(editable, '@zzz');
        expect(popupOf(editor)!.getAttribute('aria-label')).toBe('בחירת משתמש');
        expect(mentionsLocales['he']?.rtl).toBe(true);
    });

    it('announces the popup on the editable', async () => {
        const { editor, editable } = await mentionsEditor();
        typeText(editable, '@j');
        await vi.waitFor(() => expect(optionsOf(editor)).toHaveLength(2));
        await editor.updateComplete;
        expect(editable.getAttribute('aria-controls')).toBe(popupOf(editor)!.id);
        expect(editable.getAttribute('aria-activedescendant')).toBe(optionsOf(editor)[0]!.id);
    });
});

describe('mentions: inserting', () => {
    const pick = async (editor: GeRichTextEditor, index = 0) => {
        await vi.waitFor(() => expect(optionsOf(editor).length).toBeGreaterThan(index));
        optionsOf(editor)[index]!.click();
    };

    it('inserts a mention chip, puts the caret outside it and emits mention-insert', async () => {
        const { editor, editable } = await mentionsEditor();
        const inserted = record<RichTextEntityInsertEvent>(editor, 'mention-insert');
        typeText(editable, '@jo');
        await pick(editor);

        const chip = editable.querySelector<HTMLElement>('[data-mention="john-doe"]')!;
        expect(chip.getAttribute('contenteditable')).toBe('false');
        expect(chip.textContent).toBe('@John Doe');
        expect(document.getSelection()?.anchorNode?.parentElement?.hasAttribute('data-mention')).toBe(false);
        expect(inserted).toEqual([expect.objectContaining({
            type: 'mention', trigger: '@', id: 'u1', value: 'john-doe', label: 'John Doe', query: 'jo', html: chip.outerHTML,
        })]);
        expect(popupOf(editor)).toBeNull();
    });

    it('styles the chip through the adopted document sheet', async () => {
        const { editor, editable } = await mentionsEditor();
        typeText(editable, '@jo');
        await pick(editor);
        const chip = editable.querySelector('[data-mention]')!;
        expect(getComputedStyle(chip).paddingInlineStart).toBe('4px');
    });

    it('renders a mention as a link when the render mode is link', async () => {
        const { editor, editable } = await mentionsEditor({
            render: { mode: 'link', urlTemplate: 'https://users.example.com/:userId?label=@@label@@' },
        });
        typeText(editable, '@jo');
        await pick(editor);

        const link = editable.querySelector<HTMLAnchorElement>('a[data-mention="john-doe"]')!;
        expect(link.href).toContain('https://users.example.com/u1?label=');
        expect(link.textContent).toBe('@John Doe');
    });

    it('inserts a tag chip and emits tag-insert', async () => {
        const { editor, editable } = await mentionsEditor();
        const inserted = record<RichTextEntityInsertEvent>(editor, 'tag-insert');
        typeText(editable, '#ux');
        await pick(editor);

        expect(editable.querySelector('[data-tag="ux"]')).not.toBeNull();
        expect(inserted).toHaveLength(1);
        expect(inserted[0]).toMatchObject({ type: 'tag', trigger: '#', value: 'ux' });
    });

    it('navigates and selects with the keyboard through the interceptor', async () => {
        const { editor, editable } = await mentionsEditor();
        typeText(editable, '@j');
        await vi.waitFor(() => expect(optionsOf(editor)).toHaveLength(2));
        keydown(editable, 'ArrowDown');
        keydown(editable, 'Enter');
        expect(editable.querySelector('[data-mention]')?.getAttribute('data-mention')).toBe('jane.smith');
    });

    it('accepts on Enter and on Tab without throwing', async () => {
        for (const key of ['Enter', 'Tab']) {
            const { editor, editable } = await mentionsEditor();
            typeText(editable, '@j');
            await vi.waitFor(() => expect(optionsOf(editor)).toHaveLength(2));

            const errors: unknown[] = [];
            const onError = (event: ErrorEvent) => errors.push(event.error ?? event.message);
            globalThis.addEventListener('error', onError);
            keydown(editable, key);
            globalThis.removeEventListener('error', onError);

            expect(errors).toEqual([]);
            expect(editable.querySelector('[data-mention]'), key).not.toBeNull();
        }
    });

    it('dismisses on Escape and on Tab when there is nothing to accept', async () => {
        for (const key of ['Escape', 'Tab']) {
            const { editor, editable } = await mentionsEditor();
            typeText(editable, '@zzz');
            await settle();
            keydown(editable, key);
            expect(popupOf(editor), key).toBeNull();
        }
    });

    it('moves the highlight within the list and keeps it in range when the list shrinks', async () => {
        const { editor, editable } = await mentionsEditor();
        typeText(editable, '@j');
        await vi.waitFor(() => expect(optionsOf(editor)).toHaveLength(2));
        keydown(editable, 'ArrowDown');
        keydown(editable, 'ArrowDown');
        expect(optionsOf(editor).map((option) => option.getAttribute('aria-selected'))).toEqual(['false', 'true']);
        keydown(editable, 'ArrowUp');
        expect(optionsOf(editor).map((option) => option.getAttribute('aria-selected'))).toEqual(['true', 'false']);

        keydown(editable, 'ArrowDown');
        typeText(editable, '@jan');
        await vi.waitFor(() => expect(optionsOf(editor)).toHaveLength(1));
        expect(optionsOf(editor)[0]!.getAttribute('aria-selected')).toBe('true');
    });

    it('ignores non-navigation keys while the popup is open', async () => {
        const { editor, editable } = await mentionsEditor();
        typeText(editable, '@jo');
        expect(keydown(editable, 'a')).toBe(true);
        expect(popupOf(editor)).not.toBeNull();
    });

    it('closes on an outside press, and on a press in the editable too', async () => {
        const { editor, editable } = await mentionsEditor();
        typeText(editable, '@jo');
        const press = (target: EventTarget) => target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));

        press(popupOf(editor)!);
        expect(popupOf(editor)).not.toBeNull();
        press(editable);
        expect(popupOf(editor)).toBeNull();

        typeText(editable, '@jo');
        press(document.body);
        expect(popupOf(editor)).toBeNull();
    });

    it('restores the saved caret when the live selection was cleared before inserting', async () => {
        const { editor, editable } = await mentionsEditor();
        typeText(editable, '@jo');
        await vi.waitFor(() => expect(optionsOf(editor)).toHaveLength(1));
        document.getSelection()?.removeAllRanges();
        optionsOf(editor)[0]!.click();

        expect(editable.querySelector('[data-mention="john-doe"]')).not.toBeNull();
        expect(editable.textContent).toMatch(/^@John Doe\s$/);
    });

    it('appends the chip at the content root when no selection survives to insert time', async () => {
        const { editor, editable } = await mentionsEditor();
        typeText(editable, '@jo');
        await vi.waitFor(() => expect(optionsOf(editor)).toHaveLength(1));
        vi.spyOn(Document.prototype, 'getSelection').mockReturnValue(null);
        optionsOf(editor)[0]!.click();
        expect(editable.querySelector('[data-mention="john-doe"]')).not.toBeNull();
    });

    it('keeps the editor focused when an option is pressed', async () => {
        const { editor, editable } = await mentionsEditor();
        typeText(editable, '@jo');
        await vi.waitFor(() => expect(optionsOf(editor)).toHaveLength(1));
        const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        optionsOf(editor)[0]!.dispatchEvent(press);
        expect(press.defaultPrevented).toBe(true);
    });
});

describe('mentions: rows and placement', () => {
    it('renders a mention row as avatar, label and description', async () => {
        const { editor, editable } = await mentionsEditor({ search: () => USERS });
        typeText(editable, '@j');
        await vi.waitFor(() => expect(optionsOf(editor)).toHaveLength(2));

        const [john, jane] = optionsOf(editor);
        expect(john!.querySelector('.avatar')?.textContent).toBe('J');
        expect(john!.querySelector('.description')?.textContent).toBe('john.doe@example.com');
        expect(jane!.querySelector('.description')).toBeNull();
    });

    it('renders an avatar image when the item has one', async () => {
        const avatar = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
        const { editor, editable } = await mentionsEditor({ search: () => [{ value: 'a', label: 'Ann', avatar: 'https://example.com/a.png' }, { value: 'b', label: 'Bob', avatar }] });
        typeText(editable, '@a');
        await vi.waitFor(() => expect(optionsOf(editor)).toHaveLength(2));
        expect(optionsOf(editor)[0]!.querySelector<HTMLImageElement>('img.avatar')?.getAttribute('src')).toBe('https://example.com/a.png');
        expect(optionsOf(editor)[0]!.querySelector<HTMLImageElement>('img.avatar')?.alt).toBe('Ann');
    });

    it('renders a tag row as its colour dot and label', async () => {
        const { editor, editable } = await mentionsEditor();
        typeText(editable, '#ux');
        await vi.waitFor(() => expect(optionsOf(editor)).toHaveLength(1));
        const row = optionsOf(editor)[0]!;
        expect(getComputedStyle(row.querySelector('.dot')!).backgroundColor).toBe('rgb(255, 0, 0)');
        expect(row.textContent?.trim()).toBe('UX');
    });

    it('gives each popup its own counter-derived ids', async () => {
        const a = await mentionsEditor();
        const b = await mentionsEditor();
        typeText(a.editable, '@jo');
        typeText(b.editable, '@jo');
        const [first, second] = [popupOf(a.editor)!.id, popupOf(b.editor)!.id];
        expect(first).toMatch(/^rte-suggestions-\d+$/);
        expect(first).not.toBe(second);
        await vi.waitFor(() => expect(optionsOf(a.editor)).toHaveLength(1));
        expect(optionsOf(a.editor)[0]!.id).toBe(`${first}-option-0`);
    });

    it('keeps its own popup for a press inside the panel and dismisses the popup of another editor', async () => {
        const a = await mentionsEditor();
        const b = await mentionsEditor();
        typeText(a.editable, '@jo');
        typeText(b.editable, '@jo');
        await vi.waitFor(() => expect(optionsOf(a.editor)).toHaveLength(1));
        const press = (target: EventTarget) => target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));

        press(popupOf(a.editor)!.querySelector('.list')!);
        expect(popupOf(a.editor)).not.toBeNull();
        expect(popupOf(b.editor)).toBeNull();
    });

    it('positions the popup from the caret line when the range rect is degenerate', async () => {
        const { editor, editable } = await mentionsEditor();
        editable.innerHTML = '<p>@jo</p>';
        const block = editable.querySelector('p')!;
        block.getBoundingClientRect = () => rect(30, 20, 200, 20);
        Range.prototype.getBoundingClientRect = () => rect(0, 0, 0, 0);
        placeCaret(block.firstChild!, 3);
        editable.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'o' }));

        const popup = popupOf(editor)!;
        expect(popup.style.left).toBe('30px');
        expect(popup.style.top).toBe('44px');
    });
});

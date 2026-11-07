import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import { mount, paintedToken, useTheme } from '../test-utils.js';
import { createEditor, editableOf, editorIn, record, typeHtml } from './rich-text-editor.fixture.test.js';
import { EMPTINESS_FIXTURES } from './rich-text-fixtures.js';
import { RICH_TEXT_LOCALES, type RichTextLocale } from './rich-text-locales.js';
import { isRichTextEmpty } from './rich-text-validators.js';

const customLocale = (patch: Partial<RichTextLocale> = {}): RichTextLocale => ({
    ...RICH_TEXT_LOCALES.en,
    code: 'xx',
    rtl: true,
    editor: { ...RICH_TEXT_LOCALES.en.editor, placeholder: 'Custom hint', ariaLabel: 'Custom editor' },
    ...patch,
});

describe('ge-rich-text-editor structure', () => {
    it('slots a light-DOM textbox into its shadow root', async () => {
        const editor = await editorIn('<ge-rich-text-editor></ge-rich-text-editor>');
        const editable = editableOf(editor);

        expect(editable.getAttribute('role')).toBe('textbox');
        expect(editable.getAttribute('aria-multiline')).toBe('true');
        expect(editable.getAttribute('contenteditable')).toBe('true');
        expect(editable.tabIndex).toBe(0);
        expect(editable.assignedSlot?.name).toBe('editable');
        expect(editor.contentRoot).toBe(editable);
        expect(editor.overlayAnchor).toBe(editor.shadowRoot!.querySelector('.container'));
    });

    it('names the textbox from the locale, the aria-label attribute, or aria-labelledby', async () => {
        const plain = await editorIn('<ge-rich-text-editor></ge-rich-text-editor>');
        expect(editableOf(plain).getAttribute('aria-label')).toBe('Rich text editor');

        const named = await editorIn('<ge-rich-text-editor aria-label="Comment" aria-labelledby="heading"></ge-rich-text-editor>');
        expect(editableOf(named).getAttribute('aria-label')).toBe('Comment');
        expect(editableOf(named).getAttribute('aria-labelledby')).toBe('heading');
    });

    it('shows the placeholder from the attribute, else the locale, and announces it', async () => {
        const fallback = await editorIn('<ge-rich-text-editor></ge-rich-text-editor>');
        expect(editableOf(fallback).getAttribute('placeholder')).toBe('Write something...');
        expect(editableOf(fallback).getAttribute('aria-placeholder')).toBe('Write something...');

        const explicit = await editorIn('<ge-rich-text-editor placeholder="Say it"></ge-rich-text-editor>');
        expect(editableOf(explicit).getAttribute('placeholder')).toBe('Say it');
        expect(getComputedStyle(editableOf(explicit), '::before').content).toBe('"Say it"');
    });

    it('locks the textbox when disabled and keeps it selectable but not editable when readonly', async () => {
        const disabled = await editorIn('<ge-rich-text-editor disabled></ge-rich-text-editor>');
        const locked = editableOf(disabled);
        expect(locked.getAttribute('contenteditable')).toBe('false');
        expect(locked.getAttribute('aria-disabled')).toBe('true');
        expect(locked.tabIndex).toBe(-1);

        const readonly = await editorIn('<ge-rich-text-editor readonly></ge-rich-text-editor>');
        const frozen = editableOf(readonly);
        expect(frozen.getAttribute('contenteditable')).toBe('false');
        expect(frozen.getAttribute('aria-readonly')).toBe('true');
        expect(frozen.tabIndex).toBe(0);
        expect(readonly.shadowRoot!.querySelector('.container')!.hasAttribute('data-readonly')).toBe(true);
        expect(readonly.shadowRoot!.querySelector('.toolbar')!.hasAttribute('hidden')).toBe(true);
    });

    it('draws the toolbar region only for toolbar="top" and not while readonly', async () => {
        const top = await editorIn('<ge-rich-text-editor></ge-rich-text-editor>');
        const floating = await editorIn('<ge-rich-text-editor toolbar="floating"></ge-rich-text-editor>');

        expect(top.shadowRoot!.querySelector('.toolbar')!.hasAttribute('hidden')).toBe(false);
        expect(floating.shadowRoot!.querySelector('.toolbar')!.hasAttribute('hidden')).toBe(true);
    });

    it('sizes its text by the size attribute and quiets the border for the ghost variant', async () => {
        const page = await mount(`
            <ge-rich-text-editor size="sm"></ge-rich-text-editor>
            <ge-rich-text-editor size="lg"></ge-rich-text-editor>
            <ge-rich-text-editor variant="ghost"></ge-rich-text-editor>`);
        const [sm, lg, ghost] = [...page.querySelectorAll('ge-rich-text-editor')]
            .map((el) => getComputedStyle(el.shadowRoot!.querySelector('.container')!));

        expect(sm!.fontSize).toBe('14px');
        expect(lg!.fontSize).toBe('18px');
        expect(ghost!.borderTopColor).toBe('rgba(0, 0, 0, 0)');
    });

    it('applies a colour preset through data-ui-theme', async () => {
        const editor = await editorIn('<ge-rich-text-editor theme="blue"></ge-rich-text-editor>');
        expect(editor.dataset['uiTheme']).toBe('blue');

        editor.theme = undefined;
        await editor.updateComplete;
        expect(editor.hasAttribute('data-ui-theme')).toBe(false);
    });

    it('adopts the content stylesheet once for any number of editors and styles the prose in it', async () => {
        const page = await mount('<ge-rich-text-editor mode="html" value="<h1>Title</h1>"></ge-rich-text-editor><ge-rich-text-editor></ge-rich-text-editor>');
        const ours = [...document.adoptedStyleSheets].filter((sheet) => [...sheet.cssRules].some((rule) => rule.cssText.includes('data-slot="editor"')));

        expect(ours).toHaveLength(1);
        expect(getComputedStyle(page.querySelector('h1')!).fontSize).toBe('30px');
    });

    it('has no axe violations in light and dark', async () => {
        for (const mode of ['light', 'dark']) {
            useTheme(mode);
            const page = await mount(`
                <ge-rich-text-editor aria-label="Notes" mode="html" value="<p>Hello</p>" counter="both" max-length="100"></ge-rich-text-editor>
                <ge-rich-text-editor aria-label="Frozen" readonly></ge-rich-text-editor>
                <ge-rich-text-editor aria-label="Off" disabled></ge-rich-text-editor>`);
            const result = await axe.run(page, { rules: { region: { enabled: false } } });

            expect(result.violations.map((violation) => violation.id), mode).toEqual([]);
        }
    });
});

describe('ge-rich-text-editor locale and direction', () => {
    it('falls back to English for an unknown locale id', async () => {
        const editor = await editorIn('<ge-rich-text-editor locale="xx"></ge-rich-text-editor>');
        expect(editor.resolvedLocale).toBe(RICH_TEXT_LOCALES.en);
        expect(editor.isRtl).toBe(false);
    });

    it('takes a full locale object through the property and follows its direction', async () => {
        const editor = await createEditor((el) => {
            el.locale = customLocale();
        });

        expect(editor.isRtl).toBe(true);
        expect(editor.shadowRoot!.querySelector('.container')!.getAttribute('dir')).toBe('rtl');
        expect(editableOf(editor).getAttribute('placeholder')).toBe('Custom hint');
        expect(editableOf(editor).getAttribute('aria-label')).toBe('Custom editor');
    });

    it('re-localizes when the locale changes and lets an explicit placeholder win', async () => {
        const editor = await editorIn('<ge-rich-text-editor></ge-rich-text-editor>');
        expect(editor.isRtl).toBe(false);

        editor.locale = customLocale();
        await editor.updateComplete;
        expect(editor.isRtl).toBe(true);
        expect(editableOf(editor).getAttribute('placeholder')).toBe('Custom hint');

        editor.placeholder = 'Mine';
        await editor.updateComplete;
        expect(editableOf(editor).getAttribute('placeholder')).toBe('Mine');
    });

    it('lets the dir attribute override the locale', async () => {
        const editor = await editorIn('<ge-rich-text-editor dir="rtl"></ge-rich-text-editor>');
        expect(editor.isRtl).toBe(true);
        expect(editableOf(editor).getAttribute('dir')).toBe('rtl');

        editor.dir = 'ltr';
        await editor.updateComplete;
        expect(editor.isRtl).toBe(false);
    });
});

describe('ge-rich-text-editor value', () => {
    it('renders a markdown value as HTML and reports it back in both formats', async () => {
        const editor = await editorIn('<ge-rich-text-editor value="# Heading&#10;&#10;some **bold** text"></ge-rich-text-editor>');
        const editable = editableOf(editor);

        expect(editable.querySelector('h1')!.textContent).toContain('Heading');
        expect(editable.querySelector('strong,b')).toBeTruthy();
        expect(editor.htmlOutput).toContain('<h1>');
        expect(editor.markdownOutput).toContain('# Heading');
        expect(editor.isDirty).toBe(false);
    });

    it('sanitizes an HTML value, scripts included', async () => {
        const editor = await createEditor((el) => {
            el.mode = 'html';
            el.value = '<p>safe</p><script>alert(1)</script><img src="x" onerror="alert(1)">';
        });

        expect(editableOf(editor).querySelector('script')).toBeNull();
        expect(editableOf(editor).innerHTML).not.toContain('onerror');
        expect(editor.htmlOutput).toContain('safe');
    });

    it('rewrites the content when value is set later, without firing value-change or dirtying the editor', async () => {
        const editor = await editorIn('<ge-rich-text-editor mode="html"></ge-rich-text-editor>');
        const changes = record(editor, 'value-change');

        editor.value = '<p>from outside</p>';
        await editor.updateComplete;

        expect(editableOf(editor).textContent).toBe('from outside');
        expect(changes).toEqual([]);
        expect(editor.isDirty).toBe(false);
    });

    it('treats null as the empty string', async () => {
        const editor = await editorIn('<ge-rich-text-editor mode="html" value="<p>x</p>"></ge-rich-text-editor>');

        editor.value = null as unknown as string;
        await editor.updateComplete;

        expect(editor.isEmpty()).toBe(true);
        expect(editableOf(editor).textContent).toBe('');
    });

    it('publishes typing as value, value-change with all three formats, and one native input per edit', async () => {
        const editor = await editorIn('<ge-rich-text-editor></ge-rich-text-editor>');
        const changes = record<{ value: string; html: string; markdown: string }>(editor, 'value-change');
        const inputs: Event[] = [];
        editor.addEventListener('input', (event) => inputs.push(event));

        await typeHtml(editor, '<p>hello world</p>');

        expect(editor.value).toBe('hello world');
        expect(changes).toEqual([{ value: 'hello world', html: '<p>hello world</p>', markdown: 'hello world' }]);
        expect(inputs).toHaveLength(1);
        expect(editor.isDirty).toBe(true);
    });

    it('publishes HTML as the value in html mode', async () => {
        const editor = await editorIn('<ge-rich-text-editor mode="html"></ge-rich-text-editor>');
        await typeHtml(editor, '<p>hello <b>there</b></p>');

        expect(editor.value).toBe('<p>hello <b>there</b></p>');
        expect(editor.markdownOutput).toContain('**there**');
    });

    it('does not echo a value it just published back into the document', async () => {
        const editor = await editorIn('<ge-rich-text-editor></ge-rich-text-editor>');
        await typeHtml(editor, '<p>keep <b>this</b> caret</p>');
        const paragraph = editableOf(editor).querySelector('p');

        await editor.updateComplete;

        expect(editableOf(editor).querySelector('p')).toBe(paragraph);
    });

    it('reports whether the content changed since it was loaded or marked clean', async () => {
        const editor = await editorIn('<ge-rich-text-editor mode="html" value="<p>a</p>"></ge-rich-text-editor>');
        expect(editor.isDirty).toBe(false);

        await typeHtml(editor, '<p>ab</p>');
        expect(editor.isDirty).toBe(true);

        editor.markClean();
        expect(editor.isDirty).toBe(false);
    });

    it('setContent replaces the document as an edit: it publishes, fires input and leaves the baseline alone', async () => {
        const editor = await editorIn('<ge-rich-text-editor mode="html" value="<p>a</p>"></ge-rich-text-editor>');
        const changes = record<{ value: string }>(editor, 'value-change');
        const inputs: Event[] = [];
        editor.addEventListener('input', (event) => inputs.push(event));

        editor.setContent('<p>replaced</p>');
        await editor.updateComplete;

        expect(editableOf(editor).textContent).toBe('replaced');
        expect(editor.value).toBe('<p>replaced</p>');
        expect(changes.map((change) => change.value)).toEqual(['<p>replaced</p>']);
        expect(inputs).toHaveLength(1);
        expect(editor.isDirty).toBe(true);
    });

    it('setContent records history unless asked not to, and flushes a pending burst first', async () => {
        const editor = await editorIn('<ge-rich-text-editor mode="html"></ge-rich-text-editor>');
        const calls: string[] = [];
        editor.provide('history', {
            push: () => calls.push('push'), schedule: () => calls.push('schedule'), flush: () => calls.push('flush'),
            canUndo: () => false, canRedo: () => false, undo: () => undefined, redo: () => undefined,
            entries: () => [], index: () => -1, reconstruct: () => null, restore: () => undefined,
        });

        editor.setContent('<p>one</p>');
        editor.setContent('<p>two</p>', { recordHistory: false });

        expect(calls).toEqual(['flush', 'push', 'flush']);
    });

    it('setContent accepts null and leaves the caret at the end', async () => {
        const editor = await editorIn('<ge-rich-text-editor mode="html"></ge-rich-text-editor>');
        editor.setContent('<p>abc</p>');
        const range = editor.getSelection()!.getRangeAt(0);

        expect(editableOf(editor).contains(range.startContainer)).toBe(true);
        expect(range.collapsed).toBe(true);

        editor.setContent(null as unknown as string);
        expect(editor.isEmpty()).toBe(true);
    });

    it('restores the markup value on a form-less reset and on a restored state', async () => {
        const editor = await editorIn('<ge-rich-text-editor mode="html" value="<p>a</p>"></ge-rich-text-editor>');
        await typeHtml(editor, '<p>edited</p>');

        editor.formResetCallback();
        await editor.updateComplete;
        expect(editableOf(editor).textContent).toBe('a');
        expect(editor.isDirty).toBe(false);

        editor.formStateRestoreCallback('<p>restored</p>');
        await editor.updateComplete;
        expect(editableOf(editor).textContent).toBe('restored');
    });
});

describe('ge-rich-text-editor counts and counter', () => {
    it('counts characters and words once per content change and announces the word count', async () => {
        const editor = await createEditor();
        const words = record<number>(editor, 'word-count-change');

        await typeHtml(editor, '<p>one two three</p>');

        expect(editor.wordCount).toBe(3);
        expect(editor.characterCount).toBe('one two three'.length);
        expect(words.at(-1)).toBe(3);
    });

    it('reports zero words for empty content and counts emoji as single characters', async () => {
        const editor = await editorIn('<ge-rich-text-editor></ge-rich-text-editor>');
        await typeHtml(editor, '');
        expect(editor.wordCount).toBe(0);

        await typeHtml(editor, '<p>a👍🏽b</p>');
        expect(editor.characterCount).toBe(3);
    });

    it('emits the initial word count and then only changes', async () => {
        const seen: number[] = [];
        const editor = await createEditor((el) => {
            el.mode = 'html';
            el.value = '<p>a b</p>';
            el.addEventListener('word-count-change', (event) => seen.push((event as CustomEvent<number>).detail));
        });

        await typeHtml(editor, '<p>a b</p>');
        await typeHtml(editor, '<p>a b c</p>');

        expect(seen).toEqual([2, 3]);
    });

    it('shows no counter unless asked, and removes it again', async () => {
        const editor = await editorIn('<ge-rich-text-editor></ge-rich-text-editor>');
        expect(editor.querySelector('output')).toBeNull();

        editor.counter = 'words';
        await editor.updateComplete;
        expect(editor.querySelector('output')!.textContent).toBe('0 words');

        editor.counter = undefined;
        await editor.updateComplete;
        expect(editor.querySelector('output')).toBeNull();
        expect(editableOf(editor).hasAttribute('aria-describedby')).toBe(false);
    });

    it('announces the count through a live region and shows the limit beside it', async () => {
        const editor = await editorIn('<ge-rich-text-editor counter="characters" max-length="120"></ge-rich-text-editor>');
        const counter = editor.querySelector('output')!;

        expect(counter.getAttribute('aria-live')).toBe('polite');
        expect(counter.textContent).toContain('0 characters');
        expect(counter.textContent).toContain('120 max');

        editor.maxLength = undefined;
        await editor.updateComplete;
        expect(editor.querySelector('output')!.textContent).not.toContain('max');
    });

    it('shows characters and words together', async () => {
        const editor = await editorIn('<ge-rich-text-editor counter="both"></ge-rich-text-editor>');
        await typeHtml(editor, '<p>two words</p>');

        expect(editor.querySelector('output')!.textContent).toBe('9 characters' + '2 words');
    });

    it('marks the counter once the limit is reached', async () => {
        const editor = await editorIn('<ge-rich-text-editor counter="characters" max-length="3"></ge-rich-text-editor>');
        expect(editor.querySelector('[data-at-limit]')).toBeNull();

        await typeHtml(editor, '<p>abc</p>');

        const marked = editor.querySelector('output [data-at-limit]')!;
        expect(marked).toBeTruthy();
        expect(getComputedStyle(marked).color).toBe(paintedToken('--destructive', marked));
    });

    it('points the textbox at the counter and keeps a consumer aria-describedby beside it', async () => {
        const page = await mount('<p id="hint">Be brief</p><ge-rich-text-editor counter="characters" aria-describedby="hint"></ge-rich-text-editor>');
        const editor = page.querySelector('ge-rich-text-editor')!;
        const ids = editableOf(editor).getAttribute('aria-describedby')!.split(' ');

        expect(ids).toContain('hint');
        expect(ids).toContain(editor.querySelector('output')!.id);
        expect(ids).toHaveLength(2);
        expect(editableOf(editor).ariaDescribedByElements).toHaveLength(2);
    });

    it('counts maxLength on the same basis as the counter, ignoring caret anchors', async () => {
        const editor = await createEditor((el) => {
            el.maxLength = 5;
        });
        editableOf(editor).innerHTML = '<p>abcd</p><p>​</p>';

        expect(editor.remainingLength()).toBe(1);
    });

    it('reports an unbounded budget without maxLength and a negative one when over it', async () => {
        const editor = await editorIn('<ge-rich-text-editor mode="html"></ge-rich-text-editor>');
        expect(editor.remainingLength()).toBe(Number.POSITIVE_INFINITY);

        editor.maxLength = 2;
        editor.setContent('<p>abcd</p>');
        expect(editor.remainingLength()).toBe(-2);
    });
});

describe('ge-rich-text-editor emptiness', () => {
    it.each(EMPTINESS_FIXTURES)('isEmpty agrees with the validator on %j', async (value, expected) => {
        const editor = await editorIn('<ge-rich-text-editor mode="html"></ge-rich-text-editor>');
        editor.setContent(value);

        expect(editor.isEmpty()).toBe(isRichTextEmpty(value));
        expect(editor.isEmpty()).toBe(expected);
    });

    it('tracks typing', async () => {
        const editor = await editorIn('<ge-rich-text-editor mode="html"></ge-rich-text-editor>');
        expect(editor.isEmpty()).toBe(true);

        await typeHtml(editor, '<p>typed</p>');
        expect(editor.isEmpty()).toBe(false);
    });
});

describe('ge-rich-text-editor as a form control', () => {
    const formWith = async (fields: string) => {
        const page = await mount(`<form>${fields}</form>`);
        return { form: page.querySelector('form')!, editor: page.querySelector('ge-rich-text-editor')! };
    };
    const submitted = (form: HTMLFormElement) => Object.fromEntries(new FormData(form).entries());

    it('submits its value under its name, follows typing, and skips a disabled one', async () => {
        const { form, editor } = await formWith(`
            <ge-rich-text-editor name="body" mode="html" value="<p>Hi</p>"></ge-rich-text-editor>
            <ge-rich-text-editor name="off" mode="html" value="x" disabled></ge-rich-text-editor>
            <ge-rich-text-editor mode="html" value="nameless"></ge-rich-text-editor>`);
        expect(submitted(form)).toEqual({ body: '<p>Hi</p>' });

        await typeHtml(editor, '<p>Changed</p>');
        expect(submitted(form)).toEqual({ body: '<p>Changed</p>' });
    });

    it('is locked by a disabled fieldset', async () => {
        const page = await mount('<form><fieldset disabled><ge-rich-text-editor name="body"></ge-rich-text-editor></fieldset></form>');
        const editor = page.querySelector('ge-rich-text-editor')!;
        await editor.updateComplete;

        expect(editor.isDisabled).toBe(true);
        expect(editableOf(editor).getAttribute('contenteditable')).toBe('false');
        expect(editableOf(editor).getAttribute('aria-disabled')).toBe('true');
    });

    it('swallows input while disabled so the value cannot change', async () => {
        const editor = await editorIn('<ge-rich-text-editor mode="html" value="<p>form</p>" disabled></ge-rich-text-editor>');

        await typeHtml(editor, '<p>form typed</p>');

        expect(editor.value).toBe('<p>form</p>');
    });

    it('restores the markup value when the form resets', async () => {
        const { form, editor } = await formWith('<ge-rich-text-editor name="body" mode="html" value="<p>Gil</p>"></ge-rich-text-editor>');
        await typeHtml(editor, '<p>Other</p>');

        form.reset();
        await editor.updateComplete;

        expect(submitted(form)).toEqual({ body: '<p>Gil</p>' });
        expect(editableOf(editor).textContent).toBe('Gil');
    });

    it('is invalid while required and empty, and valid once it has content', async () => {
        const { form, editor } = await formWith('<ge-rich-text-editor name="body" mode="html" required></ge-rich-text-editor>');
        expect(editor.validity!.valueMissing).toBe(true);
        expect(form.checkValidity()).toBe(false);
        expect(editor.validationMessage).not.toBe('');

        await typeHtml(editor, '<p>text</p>');
        expect(editor.validity!.valid).toBe(true);
        expect(form.checkValidity()).toBe(true);
    });

    it('treats an emptied HTML document as missing but an image-only one as present', async () => {
        const { editor } = await formWith('<ge-rich-text-editor name="body" mode="html" required></ge-rich-text-editor>');

        await typeHtml(editor, '<p><br></p>');
        expect(editor.validity!.valueMissing).toBe(true);

        await typeHtml(editor, '<p><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt=""></p>');
        expect(editor.validity!.valueMissing).toBe(false);
    });

    it('enforces min-words and max-length through validity', async () => {
        const { editor } = await formWith('<ge-rich-text-editor name="body" mode="html" min-words="3" max-length="10"></ge-rich-text-editor>');

        await typeHtml(editor, '<p>two words</p>');
        expect(editor.validity!.tooShort).toBe(true);

        await typeHtml(editor, '<p>one two three four</p>');
        expect(editor.validity!.tooShort).toBe(false);
        expect(editor.validity!.tooLong).toBe(true);

        await typeHtml(editor, '<p>a b c</p>');
        expect(editor.checkValidity()).toBe(true);
    });

    it('fires focus and blur on the host, and change on blur only when the value changed', async () => {
        const editor = await editorIn('<ge-rich-text-editor mode="html"></ge-rich-text-editor>');
        const events: string[] = [];
        for (const type of ['focus', 'blur', 'change']) editor.addEventListener(type, () => events.push(type));
        const editable = editableOf(editor);

        editable.focus();
        editable.blur();
        expect(events).toEqual(['focus', 'blur']);

        editable.focus();
        await typeHtml(editor, '<p>x</p>');
        editable.blur();
        expect(events).toEqual(['focus', 'blur', 'focus', 'blur', 'change']);
    });
});

describe('ge-rich-text-editor custom toolbar items', () => {
    it('registers each item as a toolbar slot and reports clicks with a ref to the editor', async () => {
        const clicks: string[] = [];
        const editor = await createEditor((el) => {
            el.customToolbarItems = [
                { id: 'stamp', icon: 'S', tooltip: 'Stamp', onClick: (ref) => clicks.push(ref.getHtmlContent()) },
                { id: 'late', icon: 'L', tooltip: 'Late', order: 900 },
            ];
        });
        const actions = record<{ id: string }>(editor, 'custom-toolbar-action');
        const [stamp, late] = editor.toolbarSlots.slots;

        expect(stamp).toMatchObject({ id: 'stamp', tooltip: 'Stamp', order: 500 });
        expect(late!.order).toBe(900);
        stamp!.onClick!(new Event('click'));

        expect(clicks).toEqual(['']);
        expect(actions.map((action) => action.id)).toEqual(['stamp']);
    });

    it('replaces the slots when the items change', async () => {
        const editor = await editorIn('<ge-rich-text-editor></ge-rich-text-editor>');
        editor.customToolbarItems = [{ id: 'a', icon: 'A', tooltip: 'A' }];
        await editor.updateComplete;
        editor.customToolbarItems = [{ id: 'b', icon: 'B', tooltip: 'B' }];
        await editor.updateComplete;

        expect(editor.toolbarSlots.slots.map((slot) => slot.id)).toEqual(['b']);
    });
});

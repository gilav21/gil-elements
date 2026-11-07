import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, editableOf, load, placeCaret, selectBetween } from './rich-text-editor.fixture.test.js';
import type { GeRichTextEditor } from './rich-text-editor.js';
import { FIND_MAX_PAINTED_RECTS, FindController } from './rich-text-find.js';
import './locales/he.js';
import { RICH_TEXT_LOCALES } from './rich-text-locales.js';

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

const CATS = '<p>the cat sat on the cat mat</p>';

async function findIn(html = CATS, setup?: (editor: GeRichTextEditor) => void) {
    const editor = await createEditor((el) => {
        el.mode = 'html';
        el.value = html;
        el.findDebounceMs = 0;
        setup?.(el);
    });
    return { editor, find: editor.provider('find')!, editable: editableOf(editor) };
}

const q = <T extends Element = HTMLElement>(editor: GeRichTextEditor, slot: string) =>
    editor.shadowRoot!.querySelector<T>(`[data-slot="${slot}"]`);
const rects = (editor: GeRichTextEditor) => [...editor.shadowRoot!.querySelectorAll<HTMLElement>('[data-slot="rich-text-find-overlay"] [data-find-rect]')];
const counter = (editor: GeRichTextEditor) => q(editor, 'rich-text-find-counter')?.textContent?.trim() ?? '';
const key = (target: EventTarget, init: KeyboardEventInit) => target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;
const matched = (find: FindController) => find.matches.map((range) => range.toString());

describe('find: searching', () => {
    it('opens with the replace row hidden via open(false) and publishes the provider', async () => {
        const { editor, find } = await findIn();
        find.open(false);
        await editor.updateComplete;

        expect(find.isOpen()).toBe(true);
        expect(editor.provider('find')).toBe(find);
        expect(find.showsReplaceRow).toBe(false);
        expect(q(editor, 'rich-text-find-replace')).toBeNull();
    });

    it('clears matches when the query is emptied', async () => {
        const { find } = await findIn();
        find.setQuery('cat');
        find.setQuery('');

        expect(find.matches).toHaveLength(0);
        expect(find.currentIndex).toBe(-1);
    });

    it('respects case sensitivity when toggled', async () => {
        const { find } = await findIn('<p>Cat cat CAT</p>');
        find.setQuery('cat');
        expect(find.matches).toHaveLength(3);

        find.toggleCaseSensitive();
        expect(find.caseSensitive).toBe(true);
        expect(find.matches).toHaveLength(1);
    });

    it('findNext, findPrevious and replaceSingle are no-ops without matches', async () => {
        const { find } = await findIn();
        expect(() => {
            find.findNext();
            find.findPrevious();
            find.replaceSingle();
        }).not.toThrow();
        expect(find.currentIndex).toBe(-1);
    });

    it('T-1 matches a phrase split by inline markup', async () => {
        const { find } = await findIn('<p>the <b>cat</b> sat on the <i>c</i>at mat</p>');
        find.setQuery('cat');
        expect(matched(find)).toEqual(['cat', 'cat']);
    });

    it('T-2 does not match across block boundaries', async () => {
        const { find } = await findIn('<p>cat</p><p>alog</p>');
        find.setQuery('catalog');
        expect(find.matches).toHaveLength(0);
    });

    it('T-3 debounces the query and searches once after the last keystroke', async () => {
        const { find } = await findIn(CATS, (el) => {
            el.findDebounceMs = 100;
        });
        vi.useFakeTimers();
        find.setQuery('c');
        find.setQuery('ca');
        find.setQuery('cat');
        expect(find.matches).toHaveLength(0);

        vi.advanceTimersByTime(100);
        expect(find.matches).toHaveLength(2);
    });

    it('T-9 whole-word limits matches to whole words', async () => {
        const { find } = await findIn('<p>cat category concat</p>');
        find.setQuery('cat');
        expect(find.matches).toHaveLength(3);

        find.toggleWholeWord();
        expect(find.wholeWord).toBe(true);
        expect(find.matches).toHaveLength(1);
    });

    it('T-10 whole-word is Unicode-aware (Hebrew)', async () => {
        const { find } = await findIn('<p>שלום עולם</p>');
        find.toggleWholeWord();
        find.setQuery('שלום');
        expect(find.matches).toHaveLength(1);
    });

    it('T-11 regex mode matches patterns', async () => {
        const { find } = await findIn('<p>cat cot cart</p>');
        find.toggleRegex();
        find.setQuery('c.t');
        expect(matched(find)).toEqual(['cat', 'cot']);
    });

    it('T-12 an invalid regex flags the error, paints nothing and does not throw', async () => {
        const { editor, find } = await findIn();
        find.open(false);
        find.toggleRegex();

        expect(() => find.setQuery('(')).not.toThrow();
        await editor.updateComplete;

        expect(find.regexError).toBe(true);
        expect(find.matches).toHaveLength(0);
        expect(rects(editor)).toHaveLength(0);
        expect(q(editor, 'rich-text-find-query')?.getAttribute('aria-invalid')).toBe('true');
        expect(counter(editor)).toBe(editor.resolvedLocale.findReplace.invalidRegex);
    });

    it('T-13 zero-length regex matches are skipped and the search terminates', async () => {
        const { find } = await findIn('<p>aaa b</p>');
        find.toggleRegex();
        find.setQuery('a*');
        expect(matched(find)).toEqual(['aaa']);
    });

    it('T-13b zero-length matches advance by whole code points', { timeout: 5000 }, async () => {
        const { find } = await findIn('<p>😀😁 ok</p>');
        find.toggleRegex();
        expect(() => find.setQuery('x*')).not.toThrow();
        expect(find.matches).toHaveLength(0);
    });

    it('T-27 matches inside mention and tag chips are neither counted nor replaced', async () => {
        const { editable, find } = await findIn('<p>cat <span data-mention="1">cat</span> <span data-tag="x">cat</span></p>');
        find.setQuery('cat');
        expect(find.matches).toHaveLength(1);

        find.setReplacement('dog');
        find.replaceAll();

        expect(editable.querySelector('[data-mention]')?.textContent).toBe('cat');
        expect(editable.querySelector('[data-tag]')?.textContent).toBe('cat');
        expect(editable.textContent?.startsWith('dog')).toBe(true);
    });

    it('T-28 a 2,000-match document searches quickly and paints a capped number of rectangles', async () => {
        const { editor, find, editable } = await findIn(`<p>${'cat '.repeat(20)}${'x'.repeat(230)}</p>`.repeat(100));
        find.open(false);
        expect(editable.scrollHeight).toBeGreaterThan(0);

        let best = Number.POSITIVE_INFINITY;
        for (let run = 0; run < 3; run++) {
            const started = performance.now();
            find.setQuery(run % 2 === 0 ? 'cat' : 'cat ');
            best = Math.min(best, performance.now() - started);
        }
        find.setQuery('cat');
        await editor.updateComplete;

        expect(find.matches).toHaveLength(2000);
        expect(best).toBeLessThan(500);
        expect(rects(editor).length).toBeLessThanOrEqual(FIND_MAX_PAINTED_RECTS);
    });
});

describe('find: panel', () => {
    it('T-5 the counter reads "{current} of {total}", "No results" and empty', async () => {
        const { editor, find } = await findIn();
        find.open(false);
        await editor.updateComplete;
        expect(counter(editor)).toBe('');

        find.setQuery('cat');
        await editor.updateComplete;
        expect(counter(editor)).toBe('1 of 2');

        find.setQuery('zebra');
        await editor.updateComplete;
        expect(counter(editor)).toBe(editor.resolvedLocale.findReplace.noResults);
    });

    it('T-6 the counter is an aria-live polite region', async () => {
        const { editor, find } = await findIn();
        find.open(false);
        await editor.updateComplete;
        expect(q(editor, 'rich-text-find-counter')?.getAttribute('aria-live')).toBe('polite');
    });

    it('typing in the query field searches; Enter steps forward and Shift+Enter back', async () => {
        const { editor, find } = await findIn('<p>cat cat cat</p>');
        find.open(false);
        await editor.updateComplete;
        const input = q<HTMLInputElement>(editor, 'rich-text-find-query')!;
        input.value = 'cat';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        expect(find.matches).toHaveLength(3);

        key(input, { key: 'Enter' });
        expect(find.currentIndex).toBe(1);
        key(input, { key: 'Enter', shiftKey: true });
        expect(find.currentIndex).toBe(0);
    });

    it('closing resets the query, matches and highlights but keeps the toggles', async () => {
        const { editor, find } = await findIn();
        find.open(false);
        find.toggleCaseSensitive();
        find.setQuery('cat');
        find.close();
        await editor.updateComplete;

        expect(find.isOpen()).toBe(false);
        expect(find.query).toBe('');
        expect(find.matches).toHaveLength(0);
        expect(find.caseSensitive).toBe(true);
        expect(q(editor, 'rich-text-find-panel')).toBeNull();
        expect(rects(editor)).toHaveLength(0);
    });

    it('T-20 Enter in the replace field replaces, Mod+Alt+Enter replaces all, Escape closes', async () => {
        const { editor, editable, find } = await findIn('<p>cat cat</p>');
        find.open(true);
        await editor.updateComplete;
        find.setQuery('cat');
        find.setReplacement('dog');
        const replaceInput = q<HTMLInputElement>(editor, 'rich-text-find-replace')!;

        key(replaceInput, { key: 'Enter' });
        expect(editable.textContent).toBe('dog cat');

        key(replaceInput, { key: 'Enter', ctrlKey: true, altKey: true });
        expect(editable.textContent).toBe('dog dog');

        key(replaceInput, { key: 'Escape' });
        expect(find.isOpen()).toBe(false);
    });

    it('T-21 open seeds the query from a non-empty selection and leaves it alone when collapsed', async () => {
        const { editable, find } = await findIn('<p>the cat sat</p>');
        const text = editable.querySelector('p')!.firstChild!;
        selectBetween(text, 4, text, 7);

        find.open(false);
        expect(find.query).toBe('cat');
        expect(find.matches).toHaveLength(1);

        find.close();
        find.setQuery('sat');
        placeCaret(text, 2);
        find.open(false);
        expect(find.query).toBe('sat');
    });

    it('T-22 closing selects the current match and focuses the editor', async () => {
        const { editable, find } = await findIn();
        find.open(false);
        find.setQuery('cat');
        find.findNext();
        expect(find.currentIndex).toBe(1);

        find.close();

        const selection = document.getSelection()!;
        expect(selection.rangeCount).toBe(1);
        expect(selection.getRangeAt(0).cloneContents().textContent).toBe('cat');
        expect(selection.getRangeAt(0).collapsed).toBe(false);
        expect(document.activeElement).toBe(editable);
    });

    it('T-23 the toolbar find-toggle event opens, then closes, the panel with the replace row when editable', async () => {
        const { editor, find } = await findIn();
        editor.dispatchEvent(new CustomEvent('find-toggle', { bubbles: true, composed: true }));
        await editor.updateComplete;
        expect(find.isOpen()).toBe(true);
        expect(find.showsReplaceRow).toBe(true);

        editor.dispatchEvent(new CustomEvent('find-toggle', { bubbles: true, composed: true }));
        expect(find.isOpen()).toBe(false);
    });

    it('the Mod+F and Mod+H shortcut actions open find-only and find-and-replace', async () => {
        const { editor, find } = await findIn();
        editor.runShortcutAction('rich-text.find');
        await editor.updateComplete;
        expect(find.isOpen()).toBe(true);
        expect(find.showsReplaceRow).toBe(false);

        find.close();
        editor.runShortcutAction('rich-text.find-replace');
        await editor.updateComplete;
        expect(find.isOpen()).toBe(true);
        expect(find.showsReplaceRow).toBe(true);
    });

    it('Mod+F works in a readonly editor, which never offers replace', async () => {
        const { editor, find } = await findIn(CATS, (el) => {
            el.readonly = true;
        });
        expect(editor.canRunShortcutAction('rich-text.find')).toBe(true);
        expect(editor.canRunShortcutAction('rich-text.find-replace')).toBe(false);

        editor.runShortcutAction('rich-text.find');
        await editor.updateComplete;
        expect(find.isOpen()).toBe(true);
        expect(find.showsReplaceRow).toBe(false);
    });

    it('detaching releases the shortcut actions and the provider', async () => {
        const { editor, find } = await findIn();
        find.detach();
        expect(editor.canRunShortcutAction('rich-text.find')).toBe(false);
        expect(editor.provider('find')).toBeUndefined();
    });

    it('T-24 RTL: the panel anchors at the inline end and uses the Hebrew counter', async () => {
        const { editor, find } = await findIn(CATS, (el) => {
            el.locale = 'he';
        });
        find.open(false);
        find.setQuery('cat');
        await editor.updateComplete;

        const panel = q(editor, 'rich-text-find-panel')!;
        const style = getComputedStyle(panel);
        expect(style.direction).toBe('rtl');
        expect(style.insetInlineEnd).toBe(style.left);
        expect(Number.parseFloat(style.insetInlineEnd)).toBeGreaterThan(0);
        expect(counter(editor)).toBe(RICH_TEXT_LOCALES['he'].findReplace.matchCounter.replace('{current}', '1').replace('{total}', '2'));
    });

    it('T-25 readonly hides the replace row and ignores replace calls', async () => {
        const { editor, editable, find } = await findIn(CATS, (el) => {
            el.readonly = true;
        });
        find.open(true);
        await editor.updateComplete;
        expect(find.showsReplaceRow).toBe(false);
        expect(q(editor, 'rich-text-find-replace')).toBeNull();

        find.setQuery('cat');
        find.setReplacement('dog');
        find.replaceSingle();
        find.replaceAll();
        expect(editable.textContent).toBe('the cat sat on the cat mat');
    });

    it('T-26 toggle and navigation buttons carry locale labels and aria-pressed', async () => {
        const { editor, find } = await findIn();
        find.open(false);
        await editor.updateComplete;
        const loc = editor.resolvedLocale.findReplace;
        const byLabel = (label: string) => editor.shadowRoot!.querySelector<HTMLElement>(`[aria-label="${label}"]`);

        for (const label of [loc.previous, loc.next, loc.close]) expect(byLabel(label)).not.toBeNull();
        for (const [label, toggle] of [
            [loc.caseSensitive, () => find.toggleCaseSensitive()],
            [loc.wholeWord, () => find.toggleWholeWord()],
            [loc.useRegex, () => find.toggleRegex()],
        ] as const) {
            expect(byLabel(label)?.getAttribute('aria-pressed')).toBe('false');
            toggle();
            await editor.updateComplete;
            expect(byLabel(label)?.getAttribute('aria-pressed')).toBe('true');
        }
    });

    it('opening focuses the search input after the animation frame', async () => {
        const { editor, find } = await findIn();
        find.open(true);
        await editor.updateComplete;
        await frame();

        const input = q(editor, 'rich-text-find-query');
        expect(input).not.toBeNull();
        expect(editor.shadowRoot!.activeElement).toBe(input);
    });

    it('every find-panel icon button is a 28px target on a fine pointer', async () => {
        const { editor, find } = await findIn();
        find.open(false);
        await editor.updateComplete;
        const loc = editor.resolvedLocale.findReplace;
        const labels = [loc.caseSensitive, loc.wholeWord, loc.useRegex, loc.previous, loc.next, loc.close];
        const sizes = labels.map((label) => {
            const box = editor.shadowRoot!.querySelector(`button[aria-label="${label}"]`)!.getBoundingClientRect();
            return [box.width, box.height];
        });
        expect(sizes).toEqual(new Array(6).fill([28, 28]));
    });
});

describe('find: highlights and live refresh', () => {
    it('T-7 highlights never enter the editor DOM, the form value or history', async () => {
        const { editor, editable, find } = await findIn();
        const before = editor.historyEntries().length;
        find.open(false);
        find.setQuery('cat');
        await editor.updateComplete;

        expect(editable.querySelectorAll('mark')).toHaveLength(0);
        expect(editor.htmlOutput).not.toContain('<mark');
        expect(editor.historyEntries()).toHaveLength(before);
        expect(rects(editor).length).toBeGreaterThan(0);
    });

    it('T-8 typing with the panel open refreshes the matches', async () => {
        const { editor, editable, find } = await findIn();
        find.open(false);
        find.setQuery('cat');
        expect(find.matches).toHaveLength(2);

        editable.querySelector('p')!.textContent = 'the cat sat on the cat mat and the cat ran';
        editable.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: 'x' }));
        await editor.updateComplete;

        expect(editor.htmlOutput).not.toContain('<mark');
        expect(find.matches).toHaveLength(3);
    });

    it('external content writes re-run the open search', async () => {
        const { editor, find } = await findIn();
        find.open(false);
        find.setQuery('cat');
        await load(editor, '<p>cat</p>');
        expect(find.matches).toHaveLength(1);
    });

    it('keeps the highlights on the text as the editor scrolls or resizes, and drops them on close', async () => {
        let resized: (() => void) | undefined;
        vi.stubGlobal('ResizeObserver', class {
            constructor(callback: () => void) { resized = callback; }
            observe(): void { /* driven by hand */ }
            disconnect(): void { resized = undefined; }
        });
        const { editor, editable, find } = await findIn();
        const moveTextTo = (top: number) => {
            for (const match of find.matches) match.getClientRects = () => [rect(0, top, 10, 10)] as unknown as DOMRectList;
        };
        const paintedTop = async () => {
            await editor.updateComplete;
            return Number.parseFloat(rects(editor)[0]!.style.top);
        };
        find.open(false);
        find.setQuery('cat');

        moveTextTo(-40);
        editable.dispatchEvent(new Event('scroll'));
        await frame();
        const afterFirstScroll = await paintedTop();
        moveTextTo(-10);
        editable.dispatchEvent(new Event('scroll'));
        await frame();
        expect((await paintedTop()) - afterFirstScroll).toBe(30);

        moveTextTo(25);
        resized?.();
        await frame();
        expect((await paintedTop()) - afterFirstScroll).toBe(65);

        find.close();
        await frame();
        await editor.updateComplete;
        expect(rects(editor)).toHaveLength(0);
        expect(resized).toBeUndefined();
    });

    it('marks the current match with data-find-current', async () => {
        const { editor, find } = await findIn('<p>cat</p><p>cat</p>');
        find.open(false);
        find.setQuery('cat');
        find.findNext();
        await editor.updateComplete;

        const all = rects(editor);
        expect(all).toHaveLength(2);
        expect(all.map((el) => el.hasAttribute('data-find-current'))).toEqual([false, true]);
    });

    it('scrolls the editable up, not the page, to a current match above its view', async () => {
        const { editable, find } = await findIn('<p>cat</p><p>cat</p>');
        find.setQuery('cat');
        for (const match of find.matches) match.getBoundingClientRect = () => rect(0, 30, 20, 16);
        Object.defineProperty(editable, 'scrollTop', { value: 150, writable: true, configurable: true });
        editable.getBoundingClientRect = () => rect(0, 100, 200, 60);

        find.findNext();

        expect(editable.scrollTop).toBe(80);
    });

    it('T-19 findNext and findPrevious wrap and scroll the editor to the current match', async () => {
        const { editable, find } = await findIn(`<p>cat</p>${'<p>filler</p>'.repeat(40)}<p>cat</p>`);
        editable.style.maxHeight = '60px';
        editable.style.overflowY = 'auto';
        find.setQuery('cat');
        const before = editable.scrollTop;

        find.findNext();
        expect(find.currentIndex).toBe(1);
        expect(editable.scrollTop).not.toBe(before);

        find.findNext();
        expect(find.currentIndex).toBe(0);
        find.findPrevious();
        expect(find.currentIndex).toBe(1);
    });
});

describe('find: replacing', () => {
    const replaceAllWith = (find: FindController, query: string, replacement: string) => {
        find.open(true);
        find.setQuery(query);
        find.setReplacement(replacement);
        find.replaceAll();
    };

    it('T-14 regex replace expands capture groups', async () => {
        const { editable, find } = await findIn('<p>jane@acme</p>');
        find.toggleRegex();
        find.setQuery(String.raw`(\w+)@(\w+)`);
        find.setReplacement('$2 at $1');
        find.replaceSingle();
        expect(editable.textContent).toBe('acme at jane');
    });

    it('T-15 replace keeps surrounding inline formatting', async () => {
        const { editable, find } = await findIn('<p>the <b>cat</b> sat</p>');
        find.setQuery('cat');
        find.setReplacement('dog');
        find.replaceSingle();
        expect(editable.querySelector('b')?.textContent).toBe('dog');
        expect(editable.textContent).toBe('the dog sat');
    });

    it('T-16 replacing across a markup boundary lands at the match start and drops the emptied element', async () => {
        const { editable, find } = await findIn('<p>the <b>ca</b>t sat</p>');
        find.setQuery('cat');
        find.setReplacement('dog');
        find.replaceSingle();
        expect(editable.textContent).toBe('the dog sat');
        expect(editable.querySelectorAll('b')).toHaveLength(0);
    });

    it('T-17 replaceAll flushes pending typing then records exactly one entry; one undo restores all', async () => {
        const { editor, editable, find } = await findIn('<p>cat cat cat cat cat</p>');
        editable.querySelector('p')!.textContent = 'cat cat cat cat cat!';
        editable.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: '!' }));
        const typed = editable.textContent;
        const before = editor.historyEntries().length;

        find.setQuery('cat');
        find.setReplacement('dog');
        find.replaceAll();

        expect(editor.historyEntries().length - before).toBe(2);
        expect(editable.textContent).toBe('dog dog dog dog dog!');
        key(editable, { key: 'z', ctrlKey: true });
        expect(editable.textContent).toBe(typed);
    });

    it('T-18 replaceSingle records one entry and moves to the next remaining match', async () => {
        const { editor, editable, find } = await findIn('<p>cat cat cat</p>');
        find.setQuery('cat');
        find.setReplacement('dog');
        const before = editor.historyEntries().length;

        find.replaceSingle();

        expect(editor.historyEntries().length - before).toBe(1);
        expect(find.matches).toHaveLength(2);
        expect(find.currentIndex).toBe(0);
        expect(editable.textContent).toBe('dog cat cat');
    });

    it('keeps a table cell whose only text was the match, on an empty replacement', async () => {
        const { editable, find } = await findIn('<table><tbody><tr><td>TBD</td><td>keep</td></tr></tbody></table>');
        replaceAllWith(find, 'TBD', '');
        expect(editable.querySelectorAll('td')).toHaveLength(2);
        expect(editable.querySelector('table')).not.toBeNull();
        expect(editable.querySelectorAll('td')[0]!.textContent).toBe('');
    });

    it('keeps a task item and its checkbox when its text is replaced with nothing', async () => {
        const { editable, find } = await findIn('<ul data-task-list><li data-task data-checked="false"><input type="checkbox"><span>cat</span></li></ul>');
        replaceAllWith(find, 'cat', '');
        expect(editable.querySelector('li[data-task]')).not.toBeNull();
        expect(editable.querySelector('input[type="checkbox"]')).not.toBeNull();
        expect(editable.querySelector('li[data-task] > span')).not.toBeNull();
    });

    it('still drops an inline wrapper the deletion emptied', async () => {
        const { editable, find } = await findIn('<p>the <b>cat</b> sat</p>');
        replaceAllWith(find, 'cat', '');
        expect(editable.querySelector('b')).toBeNull();
        expect(editable.textContent).toBe('the  sat');
    });

    it('property: a same-length replacement changes text nodes only', async () => {
        const corpus = [
            '<p>cat <img src="/a.png" alt="a"> cat<br>cat</p>',
            '<ul><li>cat</li><li><b>cat</b> <i>cat</i></li></ul>',
            '<table><tbody><tr><td>cat</td><td><code>cat</code></td></tr></tbody></table>',
            '<blockquote><p>cat</p><hr><p>x cat y</p></blockquote>',
            '<h2>cat</h2><ul data-task-list><li data-task data-checked="true"><input type="checkbox"><span>cat</span></li></ul>',
            '<p><a href="https://example.com/">cat</a> <mark>cat</mark> <span style="color: red">cat</span></p>',
        ];
        const { editor, editable, find } = await findIn();
        const tags = () => [...editable.querySelectorAll('*')].map((el) => el.tagName);
        for (const html of corpus) {
            await load(editor, html);
            const before = tags();
            replaceAllWith(find, 'cat', 'dog');
            expect(tags(), html).toEqual(before);
            expect(editable.textContent, html).not.toContain('cat');
        }
    });
});

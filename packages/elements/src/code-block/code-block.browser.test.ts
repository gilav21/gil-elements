import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeCodeBlock } from './index.js';

const block = (page: HTMLElement) => page.querySelector<GeCodeBlock>('ge-code-block')!;
const root = (el: Element) => el.shadowRoot!;
const rows = (el: Element) => [...root(el).querySelectorAll('.line')];
const textOf = (row: Element) => row.querySelector('.text')!.textContent;
const chevrons = (el: Element) => [...root(el).querySelectorAll<HTMLElement>('.chevron.fold')];

const SAMPLE = `import { Component } from '@angular/core';

// A counter.
class Counter {
  count = 0;
  increment(by: number) {
    if (by > 0) {
      this.count += by;
    }
  }
}`;
const withCode = async (attrs: string, code = SAMPLE) => {
    const page = await mount(`<ge-code-block ${attrs}></ge-code-block>`);
    const el = block(page);
    el.code = code;
    await el.updateComplete;
    return el;
};

afterEach(() => vi.unstubAllGlobals());

describe('ge-code-block', () => {
    it('colours each token type of the language and shows the language name', async () => {
        const el = await withCode('language="typescript"');
        const first = rows(el)[0]!;
        const kinds = (row: Element) => [...row.querySelectorAll('.text span')].map((s) => `${s.className}:${s.textContent}`);
        expect(kinds(first)).toContain('tok-keyword:import');
        expect(kinds(first)).toContain("tok-string:'@angular/core'");
        expect(kinds(rows(el)[2]!).join()).toContain('tok-comment:// A counter.');
        expect(textOf(first)).toBe("import { Component } from '@angular/core';");
        expect(root(el).querySelector('.language')!.textContent).toBe('typescript');
    });

    it('numbers the lines in a gutter as wide as the last number, and hides it on request', async () => {
        const long = Array.from({ length: 12 }, (_, i) => `line ${i}`).join('\n');
        const el = await withCode('', long);
        const numbers = [...root(el).querySelectorAll<HTMLElement>('.number')];
        expect(numbers.map((n) => n.textContent)).toEqual(Array.from({ length: 12 }, (_, i) => String(i + 1)));
        expect(numbers[0]!.style.width).toBe('2ch');
        expect(numbers[0]!.getAttribute('aria-hidden')).toBe('true');

        el.setAttribute('line-numbers', 'false');
        await el.updateComplete;
        expect(root(el).querySelectorAll('.number')).toHaveLength(0);
    });

    it('folds brace scopes: starts expanded, folds on click and Enter, hides the inner lines and marks the header', async () => {
        const el = await withCode('collapse-scope');
        const before = rows(el).length;
        expect(chevrons(el)).toHaveLength(3);
        const classChevron = chevrons(el)[0]!;
        expect(classChevron.getAttribute('aria-expanded')).toBe('true');
        expect(classChevron.getAttribute('aria-label')).toBe('Collapse scope');

        classChevron.click();
        await el.updateComplete;
        expect(rows(el)).toHaveLength(4); // import, blank, comment and the class header; its body is hidden
        expect(root(el).querySelector('[data-slot="code-block-collapsed-marker"]')).not.toBeNull();
        const folded = chevrons(el)[0]!;
        expect(folded.getAttribute('aria-expanded')).toBe('false');
        expect(folded.textContent).toBe('▸');
        expect(folded.getAttribute('aria-label')).toBe('Expand scope');
        expect(el.isCollapsed(3)).toBe(true);

        folded.focus();
        await userEvent.keyboard('{Enter}');
        await el.updateComplete;
        expect(rows(el)).toHaveLength(before);
        expect(el.isCollapsed(3)).toBe(false);
        await userEvent.keyboard(' ');
        await el.updateComplete;
        expect(el.isCollapsed(3)).toBe(true);
    });

    it('default-collapsed folds every scope at that depth or deeper; 0 folds the outermost', async () => {
        const deep = await withCode('collapse-scope default-collapsed="1"');
        // The class scope (depth 0) stays open; the method and the if (depth 1, 2) fold.
        expect(chevrons(deep).map((c) => c.getAttribute('aria-expanded'))).toEqual(['true', 'false']);
        expect(rows(deep).map(textOf).join('\n')).toContain('increment(by: number) {');
        expect(rows(deep).map(textOf).join('\n')).not.toContain('this.count += by');

        const all = await withCode('collapse-scope default-collapsed="0"');
        expect(rows(all).map(textOf).join('\n')).not.toContain('increment');
    });

    it('copies the whole source, including folded lines, then shows the copied state for two seconds', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        try {
            const written: string[] = [];
            vi.stubGlobal('navigator', { clipboard: { writeText: (text: string) => { written.push(text); return Promise.resolve(); } } });
            const el = await withCode('collapse-scope default-collapsed="0"');
            const copy = root(el).querySelector('ge-button')!;
            copy.click();
            await vi.advanceTimersByTimeAsync(0);
            await el.updateComplete;
            expect(written).toEqual([SAMPLE]);
            expect(copy.getAttribute('aria-label')).toBe('Copied');
            await vi.advanceTimersByTimeAsync(2000);
            await el.updateComplete;
            expect(copy.getAttribute('aria-label')).toBe('Copy');
        } finally {
            vi.useRealTimers();
        }
    });

    it('a theme replaces the built-in look of the types it names and leaves the others alone', async () => {
        const el = await withCode('language="typescript"', "const a = 'x'; // note");
        el.theme = { keyword: 'color: rgb(255, 0, 0)' };
        await el.updateComplete;
        const keyword = root(el).querySelector<HTMLElement>('.text span')!;
        expect(keyword.textContent).toBe('const');
        expect(getComputedStyle(keyword).color).toBe('rgb(255, 0, 0)');
        expect(getComputedStyle(keyword).fontWeight).toBe('400');
        const comment = [...root(el).querySelectorAll<HTMLElement>('.text span')].find((s) => s.textContent?.startsWith('//'))!;
        expect(comment.className).toBe('tok-comment');
    });

    it('resolves a fence alias for folding as well as colour, and a custom language shadows a built-in', async () => {
        const yaml = 'root:\n  child:\n    leaf: 1\n  other: 2';
        const el = await withCode('language="yml" collapse-scope', yaml);
        expect(chevrons(el).length).toBeGreaterThan(0);

        el.language = 'shout';
        el.customLanguages = { shout: [{ type: 'keyword', regex: /\b[A-Z]+\b/ }] };
        el.code = 'HELLO world';
        await el.updateComplete;
        const spans = [...root(el).querySelectorAll('.text span')].map((s) => `${s.className}:${s.textContent}`);
        expect(spans[0]).toBe('tok-keyword:HELLO');

        // A custom entry that brings only patterns still folds with the built-in detector of the language it shadows.
        el.language = 'json';
        el.customLanguages = { json: [{ type: 'string', regex: /"[^"]*"/ }] };
        el.code = '{\n  "a": 1\n}';
        await el.updateComplete;
        expect(chevrons(el)).toHaveLength(1);
    });

    it('follows the locale: labels and direction for Hebrew, the code stays left to right', async () => {
        const el = await withCode('locale="he"');
        expect(root(el).querySelector('ge-button')!.getAttribute('aria-label')).toBe('העתק');
        expect(root(el).querySelector('.root')!.getAttribute('dir')).toBe('rtl');
        expect(root(el).querySelector('.body')!.getAttribute('dir')).toBe('ltr');
    });

    for (const theme of ['light', 'dark']) {
        describe(theme, () => {
            useTheme(theme);
            it('has no accessibility violations', async () => {
                const el = await withCode('collapse-scope');
                const { violations } = await axe.run(el);
                expect(violations.map((v) => v.id)).toEqual([]);
            });
        });
    }
});

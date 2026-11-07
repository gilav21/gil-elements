import { afterEach, describe, expect, it } from 'vitest';
import {
    codeTextOf,
    highlightCodeBlocks,
    highlightCodeElement,
    highlightCodeElementKeepingCaret,
    languageOfCodeElement,
    readCodeLines,
    stripCodeHighlighting,
} from './code-highlight.js';

const root = (html: string): HTMLElement => {
    const el = document.createElement('div');
    el.innerHTML = html;
    return el;
};

const codeIn = (host: ParentNode): HTMLElement => {
    const code = host.querySelector<HTMLElement>('code');
    if (!code) throw new Error('no <code> in the fixture');
    return code;
};

const types = (code: HTMLElement): string[] =>
    Array.from(code.querySelectorAll('span.token'), span => span.className.replace('token token-', ''));

describe('languageOfCodeElement', () => {
    it('prefers the data attribute', () => {
        expect(languageOfCodeElement(codeIn(root('<code data-language="ts" class="language-js">x</code>')))).toBe('ts');
    });

    it('falls back to the language-* class', () => {
        expect(languageOfCodeElement(codeIn(root('<code class="hljs language-python">x</code>')))).toBe('python');
    });

    it('reports none when the block names none', () => {
        expect(languageOfCodeElement(codeIn(root('<code>x</code>')))).toBeNull();
    });
});

describe('highlightCodeElement', () => {
    const code = (html: string, lang: string | null = 'typescript'): HTMLElement => {
        const el = codeIn(root(`<pre><code>${html}</code></pre>`));
        highlightCodeElement(el, lang);
        return el;
    };

    it('paints the tokens it found', () => {
        expect(types(code('const a = 1;'))).toEqual(['keyword', 'number']);
    });

    it("leaves the block's own text byte for byte", () => {
        const source = 'const a = 1;\n\n\nlet b = 2;\n';
        const el = codeIn(root('<pre><code></code></pre>'));
        el.textContent = source;
        highlightCodeElement(el, 'typescript');
        expect(el.textContent).toBe(source);
    });

    it('is idempotent', () => {
        const el = root('<pre><code data-language="ts">const a = 1;</code></pre>');
        highlightCodeBlocks(el);
        const once = el.innerHTML;
        highlightCodeBlocks(el);
        expect(el.innerHTML).toBe(once);
    });

    it('paints nothing for a language it does not know', () => {
        expect(code('const a = 1;', 'klingon').innerHTML).toBe('const a = 1;');
        expect(code('const a = 1;', null).innerHTML).toBe('const a = 1;');
    });

    it('paints nothing, and reports so, for an empty block', () => {
        expect(highlightCodeElement(codeIn(root('<pre><code></code></pre>')), 'ts')).toBe(false);
    });

    it('refuses a block holding anything but text, so it cannot delete it', () => {
        const el = root('<pre><code data-language="ts">a<img src="https://e.com/x.png" alt="q">b</code></pre>');
        expect(highlightCodeBlocks(el)).toBe(0);
        expect(el.querySelector('img')).not.toBeNull();
    });
});

describe('highlightCodeBlocks', () => {
    it('highlights every block under a root that names a language', () => {
        const el = root(
            '<pre><code data-language="ts">const a = 1;</code></pre>'
            + '<pre><code data-language="klingon">const a = 1;</code></pre>'
            + '<pre><code class="language-python">def f(): pass</code></pre>',
        );
        expect(highlightCodeBlocks(el)).toBe(2);
    });
});

describe('stripCodeHighlighting', () => {
    it('restores the markup the paint started from, exactly', () => {
        const el = root('<pre><code data-language="ts">const a = 1;\nlet b = 2;</code></pre>');
        const before = el.innerHTML;
        highlightCodeBlocks(el);
        expect(el.innerHTML).not.toBe(before);
        stripCodeHighlighting(el);
        expect(el.innerHTML).toBe(before);
    });

    it('leaves a pasted block in an unknown language alone', () => {
        const html = '<pre><code data-language="klingon"><span class="token token-keyword">qapla</span></code></pre>';
        const el = root(html);
        stripCodeHighlighting(el);
        expect(el.innerHTML).toBe(html);
    });

    it('keeps an image in a code block', () => {
        const el = root('<pre><code data-language="ts">a<img src="https://e.com/x.png" alt="q">b</code></pre>');
        stripCodeHighlighting(el);
        expect(el.querySelector('img')).not.toBeNull();
    });
});

describe('line breaks written as <br>', () => {
    const block = (inner: string): HTMLElement => codeIn(root(`<pre><code data-language="ts">${inner}</code></pre>`));

    it('reads a <br> as a line break', () => {
        expect(codeTextOf(block('a<br>b<br>c'))).toBe('a\nb\nc');
    });

    it('reads a mix of <br> and newline characters, in order', () => {
        const lines = readCodeLines(block('a\nb<br>c\nd'));
        expect(lines.text).toBe('a\nb\nc\nd');
        expect(lines.breaks).toEqual(['newline', 'br', 'newline']);
    });

    it('reads a <br> a browser typed inside a coloured word', () => {
        expect(codeTextOf(block('<span class="token token-keyword">con<br>st</span> x'))).toBe('con\nst x');
    });

    it('does not count the <br> that only holds an empty last line open', () => {
        const lines = readCodeLines(block('a<br><br>'));
        expect(lines.text).toBe('a\n');
        expect(lines.trailingBr).toBe(true);
    });

    it('colours a block whose lines are separated by <br>', () => {
        const code = block('const a = 1;<br>let b = 2;');
        expect(highlightCodeElement(code, 'ts')).toBe(true);
        expect(types(code)).toEqual(['keyword', 'number', 'keyword', 'number']);
    });

    it('keeps each break in the form it had, so no line collapses', () => {
        const code = block('const a = 1;<br>let b\n= 2;<br><br>');
        highlightCodeElement(code, 'ts');
        expect(code.querySelectorAll('br')).toHaveLength(3);
        expect(codeTextOf(code)).toBe('const a = 1;\nlet b\n= 2;\n');
    });

    it('is idempotent on a block with <br> breaks', () => {
        const code = block('const a = 1;<br>let b = 2;');
        highlightCodeElement(code, 'ts');
        const once = code.innerHTML;
        highlightCodeElement(code, 'ts');
        expect(code.innerHTML).toBe(once);
    });

    it('still refuses a block holding an image', () => {
        const code = block('a<br><img src="https://e.com/x.png" alt="q">');
        expect(highlightCodeElement(code, 'ts')).toBe(false);
        expect(code.querySelector('img')).not.toBeNull();
    });
});

describe('styling the browser wrote into the block', () => {
    const REPORTED = '<span class="token token-keyword">const</span> num = <span class="token token-number">3</span>;<br>const asd<br>'
        + '<span class="token token-keyword">public<font color="#0c1400"><span style="font-weight: 400;"> asd</span></font></span>'
        + '<font color="oklch(0.491 0.27 292.581)"><b>doMath (num1: number, num2: number): string {<br>} </b></font>';

    const reported = (): HTMLElement => codeIn(root(`<pre><code data-language="typescript">${REPORTED}</code></pre>`));

    it('recolours the reported block', () => {
        const code = reported();
        expect(highlightCodeElement(code, 'typescript')).toBe(true);
        expect(Array.from(code.querySelectorAll('.token-keyword'), el => el.textContent)).toEqual(['const', 'const', 'public']);
    });

    it('drops the styling and keeps every character and row', () => {
        const code = reported();
        const text = codeTextOf(code);
        highlightCodeElement(code, 'typescript');
        expect(code.querySelectorAll('font, b, span[style]')).toHaveLength(0);
        expect(codeTextOf(code)).toBe(text);
        expect(text.split('\n')).toEqual([
            'const num = 3;',
            'const asd',
            'public asddoMath (num1: number, num2: number): string {',
            '} ',
        ]);
    });

    it.each(['strong', 'em', 'i', 'u', 's', 'strike', 'del'])('reads through a <%s> the toolbar wrote', tag => {
        const code = codeIn(root(`<pre><code data-language="ts"><${tag}>const</${tag}> a = 1;</code></pre>`));
        expect(highlightCodeElement(code, 'ts')).toBe(true);
        expect(code.querySelector(tag)).toBeNull();
        expect(code.querySelector('.token-keyword')?.textContent).toBe('const');
    });

    it('still refuses a block holding a link, which is content', () => {
        const code = codeIn(root('<pre><code data-language="ts">const <a href="https://e.com">a</a> = 1;</code></pre>'));
        expect(highlightCodeElement(code, 'ts')).toBe(false);
        expect(code.querySelector('a')).not.toBeNull();
    });
});

describe('highlightCodeElementKeepingCaret', () => {
    let mounted: HTMLElement | null = null;
    afterEach(() => {
        mounted?.remove();
        mounted = null;
    });

    const attached = (html: string): HTMLElement => {
        mounted = root(html);
        document.body.append(mounted);
        return codeIn(mounted);
    };

    const select = (place: (range: Range) => void): Selection => {
        const selection = document.getSelection();
        if (!selection) throw new Error('no selection');
        const range = document.createRange();
        place(range);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return selection;
    };

    const caretAt = (code: HTMLElement, offset: number): Selection => {
        const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
        let seen = 0;
        for (let node = walker.nextNode(); node instanceof Text; node = walker.nextNode()) {
            if (seen + node.data.length >= offset) {
                const text = node;
                return select(range => range.setStart(text, offset - seen));
            }
            seen += node.data.length;
        }
        throw new Error('offset past the block');
    };

    const caretOffset = (code: HTMLElement, selection: Selection): number => {
        const range = selection.getRangeAt(0);
        const measure = document.createRange();
        measure.setStart(code, 0);
        measure.setEnd(range.startContainer, range.startOffset);
        return measure.toString().length;
    };

    const textBeforeCaret = (code: HTMLElement, selection: Selection): string => {
        const range = selection.getRangeAt(0);
        const measure = document.createRange();
        measure.setStart(code, 0);
        measure.setEnd(range.startContainer, range.startOffset);
        return codeTextOf(measure.cloneContents());
    };

    it('leaves the caret at the same character it was on', () => {
        const code = attached('<pre><code data-language="ts">const a = 1; let b = 2;</code></pre>');
        const selection = caretAt(code, 13);

        expect(highlightCodeElementKeepingCaret(code, 'ts', selection)).toBe(true);
        expect(caretOffset(code, selection)).toBe(13);
        expect(code.contains(selection.getRangeAt(0).startContainer)).toBe(true);
    });

    it('keeps the caret on a line below a <br>', () => {
        const code = attached('<pre><code data-language="ts">const a = 1;<br>let b = 2;</code></pre>');
        const secondLine = code.lastChild;
        if (!(secondLine instanceof Text)) throw new Error('expected a text node');
        const selection = select(range => range.setStart(secondLine, 3));

        expect(highlightCodeElementKeepingCaret(code, 'ts', selection)).toBe(true);
        expect(textBeforeCaret(code, selection)).toBe('const a = 1;\nlet');
    });

    it('keeps the caret on the empty line a Shift+Enter just opened', () => {
        const code = attached('<pre><code data-language="ts">const a = 1;<br><br></code></pre>');
        const firstBreak = code.querySelector('br');
        if (!firstBreak) throw new Error('expected a <br>');
        const selection = select(range => range.setStartAfter(firstBreak));

        expect(highlightCodeElementKeepingCaret(code, 'ts', selection)).toBe(true);
        const range = selection.getRangeAt(0);
        const before = document.createRange();
        before.setStart(code, 0);
        before.setEnd(range.startContainer, range.startOffset);
        expect(codeTextOf(before.cloneContents()).length + 1).toBe('const a = 1;\n'.length);
        expect(range.startContainer).toBe(code);
        expect(code.childNodes[range.startOffset]?.nodeName).toBe('BR');
    });

    it('keeps the caret at the very end of the block', () => {
        const code = attached('<pre><code data-language="ts">const a = 1;</code></pre>');
        const selection = caretAt(code, 12);

        highlightCodeElementKeepingCaret(code, 'ts', selection);
        expect(caretOffset(code, selection)).toBe(12);
    });

    it('leaves the caret and every node in place when the paint would change nothing', () => {
        const code = attached('<pre><code data-language="ts">xexport <span class="token token-keyword">function</span> f</code></pre>');
        const first = code.firstChild;
        if (!(first instanceof Text)) throw new Error('expected a text node');
        first.data = 'xyexport ';
        const selection = caretAt(code, 2);

        expect(highlightCodeElementKeepingCaret(code, 'ts', selection)).toBe(false);
        expect(caretOffset(code, selection)).toBe(2);
        expect(code.firstChild).toBe(first);
    });

    it('keeps the caret across a run of keystrokes at the start of a block', () => {
        const code = attached('<pre><code data-language="ts">export function f() {}</code></pre>');
        highlightCodeElement(code, 'ts');
        let selection = caretAt(code, 0);

        for (const [index, ch] of Array.from('const ').entries()) {
            const range = selection.getRangeAt(0);
            if (!(range.startContainer instanceof Text)) throw new Error('expected a text node');
            range.startContainer.insertData(range.startOffset, ch);
            selection = caretAt(code, index + 1);
            highlightCodeElementKeepingCaret(code, 'ts', selection);
            expect(caretOffset(code, selection)).toBe(index + 1);
        }
        expect(code.textContent).toBe('const export function f() {}');
    });

    it('repaints without a selection', () => {
        const code = attached('<pre><code data-language="ts">const a = 1;</code></pre>');
        expect(highlightCodeElementKeepingCaret(code, 'ts', null)).toBe(true);
        expect(types(code)).toEqual(['keyword', 'number']);
    });

    it('paints nothing, and reports so, for a language it does not know', () => {
        const code = attached('<pre><code data-language="klingon">const a = 1;</code></pre>');
        expect(highlightCodeElementKeepingCaret(code, 'klingon', document.getSelection())).toBe(false);
        expect(code.innerHTML).toBe('const a = 1;');
    });
});

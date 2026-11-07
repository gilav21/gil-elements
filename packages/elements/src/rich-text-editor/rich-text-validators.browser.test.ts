import { describe, expect, it } from 'vitest';
import { EMPTINESS_FIXTURES } from './rich-text-fixtures.js';
import {
    isRichTextEmpty,
    richTextHasMedia,
    richTextMaxLength,
    richTextMinWords,
    richTextRequired,
    richTextValidityFlag,
    richTextVisibleText,
    validateRichText,
} from './rich-text-validators.js';

describe('richTextVisibleText', () => {
    it('turns HTML into text with block separators, decoded entities and normalised spaces', () => {
        expect(richTextVisibleText('<p>a</p><p>b</p>')).toBe('a\nb');
        expect(richTextVisibleText('<p>one<br>two</p>')).toBe('one\ntwo');
        expect(richTextVisibleText('<p>&amp;</p>')).toBe('&');
        expect(richTextVisibleText('<p>&lt;b&gt;</p>')).toBe('<b>');
        expect(richTextVisibleText('<p>a b</p>')).toBe('a b');
        expect(richTextVisibleText('<p>a​b</p>')).toBe('ab');
        expect(richTextVisibleText('<p><b>hello</b> world</p>')).toBe('hello world');
        expect(richTextVisibleText('<ul><li>x</li><li>y</li></ul>')).toBe('x\ny');
        expect(richTextVisibleText('<table><tr><td>a</td><td>b</td></tr></table>')).toBe('a b');
        expect(richTextVisibleText('<blockquote>q</blockquote>')).toBe('q');
        expect(richTextVisibleText('<h1>H</h1><p>p</p>')).toBe('H\np');
        expect(richTextVisibleText('<details><summary>s</summary><p>d</p></details>')).toBe('s\nd');
    });

    it('collapses a run of spaces to one, matching what the browser renders', () => {
        expect(richTextVisibleText('<p>a  b</p>')).toBe('a b');
        expect(richTextVisibleText('<p>a\tb</p>')).toBe('a b');
    });

    it('collapses runs of block boundaries to a single newline and trims', () => {
        expect(richTextVisibleText('<p></p><p>a</p><p></p>')).toBe('a');
        expect(richTextVisibleText('<p><br></p>')).toBe('');
    });

    it('strips markdown syntax down to its rendered text', () => {
        expect(richTextVisibleText('# Title')).toBe('Title');
        expect(richTextVisibleText('###### deep')).toBe('deep');
        expect(richTextVisibleText('**hello** world')).toBe('hello world');
        expect(richTextVisibleText('__hello__')).toBe('hello');
        expect(richTextVisibleText('*em*')).toBe('em');
        expect(richTextVisibleText('_em_')).toBe('em');
        expect(richTextVisibleText('~~gone~~')).toBe('gone');
        expect(richTextVisibleText('`code`')).toBe('code');
        expect(richTextVisibleText('[label](https://x.test)')).toBe('label');
        expect(richTextVisibleText('![alt text](x.png)')).toBe('alt text');
        expect(richTextVisibleText('> quoted')).toBe('quoted');
        expect(richTextVisibleText('- one\n- two')).toBe('one\ntwo');
        expect(richTextVisibleText('1. one\n2. two')).toBe('one\ntwo');
        expect(richTextVisibleText('- [ ] task\n- [x] done')).toBe('task\ndone');
        expect(richTextVisibleText('---')).toBe('');
        expect(richTextVisibleText('***')).toBe('');
    });

    it('keeps fenced-code content as text and does not read its markers as syntax', () => {
        expect(richTextVisibleText('```ts\nconst a = 1;\n```')).toBe('const a = 1;');
        expect(richTextVisibleText('```\n# not a heading\n```')).toBe('# not a heading');
    });

    it('handles nested emphasis and code spans containing stars', () => {
        expect(richTextVisibleText('***x***')).toBe('x');
        expect(richTextVisibleText('`a * b`')).toBe('a * b');
    });

    it('leaves a nested-bracket link alone, exactly as the real parser does', () => {
        expect(richTextVisibleText('[a [b] c](u)')).toBe('[a [b] c](u)');
    });

    it('strips markdown tables to their cell text', () => {
        expect(richTextVisibleText('| a | b |\n| --- | --- |\n| 1 | 2 |')).toBe('a b\n1 2');
    });

    it('strips the raw span / action-image tags the editor emits in markdown', () => {
        expect(richTextVisibleText('a <span data-action-click="open">b</span> c')).toBe('a b c');
        expect(richTextVisibleText('x <img src="y.png" data-action-click="go"> z')).toBe('x z');
    });

    it('treats a value carrying a tag other than span/img as HTML', () => {
        expect(richTextVisibleText('<b>*x*</b>')).toBe('*x*');
        expect(richTextVisibleText('<p>**bold**</p>')).toBe('**bold**');
    });

    it('treats a value whose only tags are span/img as markdown', () => {
        expect(richTextVisibleText('<span data-action-click="o">**bold**</span>')).toBe('bold');
        expect(richTextVisibleText('**a** <img src="i.png">')).toBe('a');
    });

    it('coerces non-string values', () => {
        expect(richTextVisibleText(null)).toBe('');
        expect(richTextVisibleText(undefined)).toBe('');
        expect(richTextVisibleText(42)).toBe('42');
    });

    it('cannot be spoofed by placeholder characters in the input', () => {
        expect(richTextVisibleText('```\nx\n```\n0')).toBe('x\n0');
    });
});

describe('richTextHasMedia', () => {
    it('detects images, rules and tables in both syntaxes', () => {
        expect(richTextHasMedia('<p><img src="x.png"></p>')).toBe(true);
        expect(richTextHasMedia('<hr>')).toBe(true);
        expect(richTextHasMedia('<table><tr><td></td></tr></table>')).toBe(true);
        expect(richTextHasMedia('![a](x.png)')).toBe(true);
        expect(richTextHasMedia('---')).toBe(true);
        expect(richTextHasMedia('| a |\n| --- |\n| 1 |')).toBe(true);
        expect(richTextHasMedia('<img src="x.png">')).toBe(true);
    });

    it('is false for text-only values', () => {
        expect(richTextHasMedia('<p>a</p>')).toBe(false);
        expect(richTextHasMedia('**a**')).toBe(false);
        expect(richTextHasMedia('')).toBe(false);
    });
});

describe('isRichTextEmpty', () => {
    it.each(EMPTINESS_FIXTURES)('%j -> %s', (value, expected) => {
        expect(isRichTextEmpty(value)).toBe(expected);
    });
});

describe('richTextRequired', () => {
    it.each(['<p>a</p>', '<img src="x">', '<hr>', '![alt](x.png)', '---', '| a |\n| --- |\n| 1 |'])('passes %j', value => {
        expect(richTextRequired(value)).toBeNull();
    });

    it('treats undefined and non-string values sensibly', () => {
        expect(richTextRequired(undefined)).toEqual({ key: 'required' });
        expect(richTextRequired(0)).toBeNull();
    });
});

describe('richTextMaxLength', () => {
    it('counts visible characters in HTML', () => {
        expect(richTextMaxLength('<p><b>hello</b> world</p>', 10)).toEqual({ key: 'maxlength', requiredLength: 10, actualLength: 11 });
        expect(richTextMaxLength('<p>hello</p>', 10)).toBeNull();
    });

    it('counts visible characters in markdown', () => {
        expect(richTextMaxLength('**hello** world', 10)).toEqual({ key: 'maxlength', requiredLength: 10, actualLength: 11 });
    });

    it('counts an entity as one character', () => {
        expect(richTextMaxLength('<p>&amp;</p>', 1)).toBeNull();
        expect(richTextMaxLength('<p>&amp;</p>', 0)).toEqual({ key: 'maxlength', requiredLength: 0, actualLength: 1 });
    });

    it('does not count line breaks or block boundaries', () => {
        expect(richTextMaxLength('<p>a</p><p>b</p>', 2)).toBeNull();
        expect(richTextMaxLength('<p>a<br>b</p>', 2)).toBeNull();
    });

    it('counts each emoji as one character, like the editor counter', () => {
        const value = '<p>Hi 👋🏽 👨‍👩‍👧</p>';
        expect(richTextMaxLength(value, 6)).toBeNull();
        expect(richTextMaxLength(value, 5)).toEqual({ key: 'maxlength', requiredLength: 5, actualLength: 6 });
    });
});

describe('richTextMinWords', () => {
    it('reports the shortfall', () => {
        expect(richTextMinWords('<p>two words</p>', 3)).toEqual({ key: 'minWords', requiredWords: 3, actualWords: 2 });
    });

    it('separates words across block boundaries', () => {
        expect(richTextMinWords('<p>one</p><p>two</p><p>three</p>', 3)).toBeNull();
    });

    it('counts Hebrew words', () => {
        expect(richTextMinWords('שלום עולם שוב', 3)).toBeNull();
        expect(richTextMinWords('שלום עולם שוב', 4)).toEqual({ key: 'minWords', requiredWords: 4, actualWords: 3 });
    });

    it('passes empty values — only required reports emptiness', () => {
        expect(richTextMinWords('', 3)).toBeNull();
        expect(richTextMinWords(null, 3)).toBeNull();
        expect(richTextMinWords('<p><br></p>', 3)).toBeNull();
    });

    it('counts markdown words after stripping syntax', () => {
        expect(richTextMinWords('**one** _two_ `three`', 3)).toBeNull();
        expect(richTextMinWords('**one** _two_', 3)).toEqual({ key: 'minWords', requiredWords: 3, actualWords: 2 });
    });
});

describe('markdown carrying verbatim inline tags is still markdown', () => {
    it('strips markdown syntax around a <u> or <mark> the editor itself emitted', () => {
        expect(richTextVisibleText('**bold** <u>text</u>')).toBe('bold text');
        expect(richTextVisibleText('a <mark>m</mark> and <sub>s</sub> and <code>c</code>')).toBe('a m and s and c');
        expect(richTextMaxLength('**bold** <u>text</u>', 10)).toBeNull();
        expect(isRichTextEmpty('**** <u></u>')).toBe(true);
    });
});

describe('validateRichText', () => {
    it('reports nothing when no rule is enabled', () => {
        expect(validateRichText('', {})).toBeNull();
    });

    it('reports the first failing rule in order required, minWords, maxLength', () => {
        const options = { required: true, minWords: 3, maxLength: 5 };
        expect(validateRichText('<p><br></p>', options)).toEqual({ key: 'required' });
        expect(validateRichText('<p>two words</p>', options)).toEqual({ key: 'minWords', requiredWords: 3, actualWords: 2 });
        expect(validateRichText('<p>one two three</p>', options)).toMatchObject({ key: 'maxlength', actualLength: 13 });
        expect(validateRichText('<p>a b c</p>', options)).toBeNull();
    });

    it('treats a null limit as disabled', () => {
        expect(validateRichText('<p>a</p>', { minWords: null, maxLength: null })).toBeNull();
    });

    it('maps each error to its ElementInternals validity flag', () => {
        expect(richTextValidityFlag({ key: 'required' })).toEqual({ valueMissing: true });
        expect(richTextValidityFlag({ key: 'minWords', requiredWords: 2, actualWords: 1 })).toEqual({ tooShort: true });
        expect(richTextValidityFlag({ key: 'maxlength', requiredLength: 1, actualLength: 2 })).toEqual({ tooLong: true });
    });
});

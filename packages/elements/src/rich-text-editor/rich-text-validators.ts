import { graphemeLength } from '../shared/grapheme.js';

/**
 * A value is HTML when it carries a tag other than the ones the editor's markdown output can itself
 * contain: `<span>` and `<img>` from the actions addon, and the inline tags markdown has no syntax
 * for, which `toMarkdown` emits verbatim. Detecting the syntax keeps the validators and the
 * editor's counter in agreement about what is visible.
 */
const HTML_MARKER = /<\/?(?!span\b|img\b|u\b|mark\b|sub\b|sup\b|small\b|ins\b|code\b)[a-z][^>]*>/i;

const BLOCK_SELECTOR = 'p,div,h1,h2,h3,h4,h5,h6,li,blockquote,pre,tr,hr,br,details,summary,figcaption';
const CELL_SELECTOR = 'td,th';
const MEDIA_SELECTOR = 'img, hr, table';

/** Markdown syntax removed, in order. Every pattern is anchored or non-greedy over a bounded class, so none can backtrack catastrophically. */
const MARKDOWN_STRIP: ReadonlyArray<readonly [RegExp, string]> = [
    [/<span\b[^>]{0,4096}>|<\/span>/gi, ''],
    [/<img\b[^>]{0,4096}>/gi, ''],
    [/<\/?(?:u|mark|sub|sup|small|ins|code)\b[^>]{0,4096}>/gi, ''],
    [/!\[([^\]]{0,4096})\]\([^)]{0,4096}\)/g, '$1'],
    [/\[([^\]]{1,4096})\]\([^)]{0,4096}\)/g, '$1'],
    [/^#{1,6}[ \t]+/gm, ''],
    [/^>[ \t]?/gm, ''],
    [/^[ \t]*(?:[-*+]|\d{1,9}\.)[ \t]+(?:\[[ xX]\][ \t]+)?/gm, ''],
    [/^[ \t]{0,64}([-*_])(?:[ \t]{0,64}\1){2,}[ \t]{0,64}$/gm, ''],
    [/^(?=[^\n]{0,4096}-{3})[ \t|:-]+$/gm, ''],
    [/^\||\|$/gm, ''],
    [/\|/g, ' '],
    [/(\*\*|__)(.+?)\1/g, '$2'],
    [/~~(.+?)~~/g, '$1'],
    [/([*_])(?=\S)(.+?)(?<=\S)\1/g, '$2'],
    [/`([^`]+)`/g, '$1'],
];

/** The HTML entities the editor's own output can contain, decoded last. */
const ENTITIES: ReadonlyArray<readonly [RegExp, string]> = [
    [/&lt;/g, '<'],
    [/&gt;/g, '>'],
    [/&quot;/g, '"'],
    [/&#39;/g, "'"],
    [/&nbsp;/g, ' '],
    [/&amp;/g, '&'],
];

const FENCE = /^```[^\n]*\n([\s\S]{0,65536}?)\n```[ \t]*$/gm;
const FENCE_TOKEN = /(\d{1,9})/g;

/** A value bound to something other than a string is a consumer mistake, not a crash: `null` and objects read as no content. */
function toSource(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return value.toString();
    return '';
}

function parseBody(value: string): HTMLElement {
    return new DOMParser().parseFromString(value, 'text/html').body;
}

/** Text of a parsed body, with block boundaries as newlines and cell boundaries as spaces. Mutates `body`. */
function bodyToText(body: HTMLElement): string {
    for (const el of body.querySelectorAll(BLOCK_SELECTOR)) el.append('\n');
    for (const el of body.querySelectorAll(CELL_SELECTOR)) el.append(' ');
    return body.textContent ?? '';
}

/**
 * Fenced blocks are lifted out first and put back last, so a fence containing `# not a heading`
 * keeps its `# `. Placeholder characters already in the input are dropped so content cannot spoof a token.
 */
function markdownToText(value: string): string {
    const fences: string[] = [];
    let text = value.replaceAll(/[]/g, '').replace(FENCE, (...[, body]: [unknown, string]) => {
        fences.push(body);
        return `${fences.length - 1}`;
    });
    for (const [pattern, replacement] of MARKDOWN_STRIP) text = text.replace(pattern, replacement);
    for (const [pattern, replacement] of ENTITIES) text = text.replace(pattern, replacement);
    return text.replace(FENCE_TOKEN, (...[, index]: [unknown, string]) => fences[Number(index)] ?? '');
}

/** Any run of spaces and tabs becomes one space, which is what a browser renders and so what "visible characters" means. */
function normalise(text: string): string {
    return text
        .replaceAll(/[​﻿]/g, '')
        .replaceAll(' ', ' ')
        .replaceAll('\r\n', '\n')
        .split('\n')
        .map(line => line.replaceAll(/[ \t]+/g, ' ').trim())
        .filter(line => line !== '')
        .join('\n');
}

/**
 * The visible text of an editor value, whichever syntax it is written in: entities decoded, markup
 * removed, block boundaries turned into `'\n'`, NBSP normalised, zero-width characters dropped.
 */
export function richTextVisibleText(value: unknown): string {
    const source = toSource(value);
    if (source === '') return '';
    return normalise(HTML_MARKER.test(source) ? bodyToText(parseBody(source)) : markdownToText(source));
}

/** Whether the value holds an image, a horizontal rule or a table, in either syntax. */
export function richTextHasMedia(value: unknown): boolean {
    const source = toSource(value);
    if (source === '') return false;
    if (HTML_MARKER.test(source)) return parseBody(source).querySelector(MEDIA_SELECTOR) !== null;
    return /!\[[^\]]*\]\(/.test(source)
        || /<img\b/i.test(source)
        || /^[ \t]*([-*_])(?:[ \t]*\1){2,}[ \t]*$/m.test(source)
        || /^\|.*\|[ \t]*$/m.test(source);
}

/** The single emptiness rule: no visible text and no media. `<p><br></p>` is empty, an image-only document is not. */
export function isRichTextEmpty(value: unknown): boolean {
    const source = toSource(value);
    if (source === '') return true;
    if (!HTML_MARKER.test(source)) return normalise(markdownToText(source)) === '' && !richTextHasMedia(source);
    const body = parseBody(source);
    return body.querySelector(MEDIA_SELECTOR) === null && normalise(bodyToText(body)) === '';
}

export type RichTextValidationError =
    | { key: 'required' }
    | { key: 'maxlength'; requiredLength: number; actualLength: number }
    | { key: 'minWords'; requiredWords: number; actualWords: number };

export interface RichTextValidationOptions {
    required?: boolean;
    minWords?: number | null;
    maxLength?: number | null;
}

/** `required` fails on an emptied HTML-mode editor (`<p><br></p>`) and passes an image-only document. */
export function richTextRequired(value: unknown): RichTextValidationError | null {
    return isRichTextEmpty(value) ? { key: 'required' } : null;
}

/** Caps visible characters, counted as graphemes like the editor's own counter; line breaks are not characters. */
export function richTextMaxLength(value: unknown, max: number): RichTextValidationError | null {
    const actualLength = graphemeLength(richTextVisibleText(value).replaceAll('\n', ''));
    return actualLength > max ? { key: 'maxlength', requiredLength: max, actualLength } : null;
}

/** Words are separated by whitespace and block boundaries. An empty value passes: only `required` reports emptiness. */
export function richTextMinWords(value: unknown, min: number): RichTextValidationError | null {
    const text = richTextVisibleText(value);
    if (text === '') return null;
    const actualWords = text.split(/\s+/).length;
    return actualWords < min ? { key: 'minWords', requiredWords: min, actualWords } : null;
}

/** The first failing rule among those enabled in `options`, in the order required, minWords, maxLength. */
export function validateRichText(value: unknown, options: RichTextValidationOptions): RichTextValidationError | null {
    const { required, minWords, maxLength } = options;
    return (required ? richTextRequired(value) : null)
        ?? (minWords ? richTextMinWords(value, minWords) : null)
        ?? (typeof maxLength === 'number' ? richTextMaxLength(value, maxLength) : null);
}

/** The `ElementInternals.setValidity` flag for a validation error. */
export function richTextValidityFlag(error: RichTextValidationError): ValidityStateFlags {
    switch (error.key) {
        case 'required': return { valueMissing: true };
        case 'minWords': return { tooShort: true };
        case 'maxlength': return { tooLong: true };
    }
}

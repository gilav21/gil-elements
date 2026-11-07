import { RichTextMarkdown } from './rich-text-markdown.js';

export type PasteSource =
    | 'msword'
    | 'outlook'
    | 'google-docs'
    | 'apple-pages'
    | 'libreoffice'
    | 'excel'
    | 'markdown'
    | 'html'
    | 'plain-text';

export interface RichTextPasteNormalizerOptions {
    /** Defaults to the global `document`, read on first use. */
    document?: Document;
    /** Defaults to a new `RichTextMarkdown`. */
    markdown?: RichTextMarkdown;
}

interface WordListItem {
    el: Element;
    level: number;
    listId: string;
    isOrdered: boolean;
}

type StyleMap = Map<string, string>;
type CssRules = Map<string, StyleMap>;

/** Word's namespaced wrapper elements, unwrapped so the text they hold stays. */
const WORD_WRAPPER_TAGS = new Set(['o:p', 'w:sdtcontent', 'w:sdt', 'w:sdtpr', 'w:sdtendpr', 'o:oleobject']);

const BLOCK_TAGS = new Set([
    'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'TABLE',
    'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'HR',
]);

const SEMANTIC_TAGS = new Set(['STRONG', 'EM', 'U', 'DEL', 'S', 'B', 'I']);

const FONT_SIZES: Readonly<Record<string, string>> = {
    '1': '10px', '2': '13px', '3': '16px', '4': '18px', '5': '24px', '6': '32px', '7': '48px',
};

const RELEVANT_CSS_PROPERTIES = new Set([
    'color', 'background-color', 'background',
    'font-size', 'font-weight', 'font-style',
    'text-decoration', 'text-decoration-style', 'text-decoration-color',
    'text-align', 'text-transform', 'text-indent',
    'font-family', 'font-variant', 'line-height', 'letter-spacing', 'word-spacing',
    'vertical-align',
    'margin', 'margin-left', 'margin-right', 'margin-top', 'margin-bottom',
    'border', 'border-top', 'border-bottom', 'border-left', 'border-right',
    'border-width', 'border-style', 'border-color',
    'border-collapse', 'border-spacing',
    'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
    'list-style-type', 'table-layout',
    'width', 'height',
]);

const SYSTEM_COLORS = new Map<string, string>([
    ['windowtext', '#000000'], ['window', '#ffffff'],
    ['buttonface', '#f0f0f0'], ['buttontext', '#000000'],
    ['buttonhighlight', '#ffffff'], ['buttonshadow', '#808080'],
    ['graytext', '#808080'], ['highlight', '#0078d7'],
    ['highlighttext', '#ffffff'], ['captiontext', '#000000'],
    ['activecaption', '#99b4d1'], ['inactivecaption', '#bfcddb'],
    ['inactivecaptiontext', '#000000'], ['inactiveborder', '#f4f7fc'],
    ['infobackground', '#ffffe1'], ['infotext', '#000000'],
    ['menu', '#f0f0f0'], ['menutext', '#000000'],
    ['scrollbar', '#c8c8c8'], ['appworkspace', '#ababab'],
    ['background', '#000080'], ['windowframe', '#646464'],
    ['threeddarkshadow', '#696969'], ['threedface', '#f0f0f0'],
    ['threedhighlight', '#ffffff'], ['threedlightshadow', '#e3e3e3'],
    ['threedshadow', '#a0a0a0'],
]);

const GOOGLE_DEFAULT_STYLES: ReadonlyArray<readonly [string, RegExp]> = [
    ['color', /^(#000000|#000|rgb\(0,\s*0,\s*0\)|black)$/i],
    ['background-color', /^(transparent|rgba\(0,\s*0,\s*0,\s*0\)|initial)$/i],
    ['font-weight', /^(400|normal)$/i],
    ['font-style', /^normal$/i],
    ['font-variant', /^normal$/i],
    ['text-decoration', /^none$/i],
    ['vertical-align', /^baseline$/i],
    ['white-space', /^pre-?wrap$/i],
];

const GOOGLE_STRIPPED_STYLES = ['font-family', 'white-space', 'orphans', 'widows'];

const VENDOR_PREFIXES = ['-apple-', '-webkit-', '-moz-', '-ms-'];

function parseStyles(styleAttr: string): StyleMap {
    const styles: StyleMap = new Map();
    for (const part of styleAttr.split(';')) {
        const colon = part.indexOf(':');
        if (colon === -1) continue;
        const prop = part.slice(0, colon).trim().toLowerCase();
        const value = part.slice(colon + 1).trim();
        if (prop && value) styles.set(prop, value);
    }
    return styles;
}

function serializeStyles(styles: StyleMap): string {
    return Array.from(styles, ([prop, value]) => `${prop}: ${value}`).join('; ');
}

function writeStyles(el: Element, styles: StyleMap): void {
    const serialized = serializeStyles(styles);
    if (serialized) el.setAttribute('style', serialized);
    else el.removeAttribute('style');
}

function stripMsoProperties(style: string): string {
    const styles = parseStyles(style);
    for (const prop of Array.from(styles.keys())) {
        if (prop.startsWith('mso-') || prop.startsWith('-')) styles.delete(prop);
    }
    return serializeStyles(styles);
}

function walkElements(container: HTMLElement, fn: (el: HTMLElement) => void): void {
    for (const el of Array.from(container.querySelectorAll<HTMLElement>('*')).reverse()) fn(el);
}

function unwrapElement(el: Element): void {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    el.remove();
}

function parseToContainer(html: string): HTMLElement {
    return new DOMParser().parseFromString(html, 'text/html').body;
}

function stripClassAndIdAttributes(container: HTMLElement): void {
    walkElements(container, (el) => {
        el.removeAttribute('class');
        el.removeAttribute('id');
    });
}

function removeMetaTags(container: HTMLElement): void {
    container.querySelectorAll('meta, link, title, style, base').forEach((tag) => tag.remove());
}

function removeNamespacedTags(container: HTMLElement, prefixes: RegExp): void {
    walkElements(container, (el) => {
        if (prefixes.test(el.tagName)) el.remove();
    });
}

function isEffectivelyEmpty(el: HTMLElement): boolean {
    if (el.tagName === 'BR' || el.tagName === 'HR' || el.tagName === 'IMG') return false;
    if ((el.textContent ?? '').replaceAll(/[\s\u00A0]/g, '').length > 0) return false;
    return !el.querySelector('img, br, hr, table');
}

/**
 * Drop wrappers that carry nothing: an attribute-less span with no visible
 * content and a whitespace-only paragraph that has siblings.
 *
 * A span holding only whitespace is unwrapped, never deleted -- that
 * whitespace is often the only thing separating two words
 * (`<b>a</b><span> </span><i>b</i>`, or a Word spacerun), and deleting it
 * glued them together.
 */
function removeEmptyElements(container: HTMLElement): void {
    walkElements(container, (el) => {
        if (el.tagName !== 'SPAN' || el.hasAttributes() || !isEffectivelyEmpty(el)) return;
        if (el.textContent) unwrapElement(el);
        else el.remove();
    });

    walkElements(container, (el) => {
        if (el.tagName === 'P' && isEffectivelyEmpty(el) && el.parentNode?.childNodes.length !== 1) {
            el.remove();
        }
    });
}

function wrapChildrenIn(parent: HTMLElement, tag: string): HTMLElement {
    if (!parent.firstChild) return parent;
    const wrapper = parent.ownerDocument.createElement(tag);
    while (parent.firstChild) wrapper.appendChild(parent.firstChild);
    parent.appendChild(wrapper);
    return wrapper;
}

function wrapForFontWeight(el: HTMLElement, styles: StyleMap): HTMLElement {
    const fontWeight = styles.get('font-weight');
    if (fontWeight === 'bold' || (fontWeight && Number.parseInt(fontWeight, 10) >= 700)) {
        styles.delete('font-weight');
        return wrapChildrenIn(el, 'strong');
    }
    return el;
}

function wrapForFontStyle(el: HTMLElement, styles: StyleMap): HTMLElement {
    if (styles.get('font-style') !== 'italic') return el;
    styles.delete('font-style');
    return wrapChildrenIn(el, 'em');
}

function wrapForTextDecoration(el: HTMLElement, styles: StyleMap): void {
    const textDecoration = styles.get('text-decoration');
    if (!textDecoration) return;
    const hasUnderline = textDecoration.includes('underline');
    const hasLineThrough = textDecoration.includes('line-through');
    if (hasUnderline || hasLineThrough) styles.delete('text-decoration');
    const afterUnderline = hasUnderline ? wrapChildrenIn(el, 'u') : el;
    if (hasLineThrough) wrapChildrenIn(afterUnderline, 'del');
}

function convertStylesToSemanticElements(container: HTMLElement): void {
    walkElements(container, (el) => {
        if (SEMANTIC_TAGS.has(el.tagName)) return;
        const style = el.getAttribute('style');
        if (!style) return;

        const styles = parseStyles(style);
        wrapForTextDecoration(wrapForFontStyle(wrapForFontWeight(el, styles), styles), styles);
        writeStyles(el, styles);
    });
}

function isSimpleColorValue(value: string): boolean {
    const v = value.trim().toLowerCase();
    return v.startsWith('#') || v.startsWith('rgb')
        || (/^[a-z]+$/.test(v) && !['none', 'inherit', 'initial', 'unset'].includes(v));
}

function setWhen(mapped: StyleMap, applies: boolean, key: string, value: string): void {
    if (applies) mapped.set(key, value);
}

function setMissingWhen(mapped: StyleMap, applies: boolean, key: string, value: string): void {
    if (applies && !mapped.has(key)) mapped.set(key, value);
}

function mapMsoProperty(prop: string, value: string, mapped: StyleMap): void {
    if (!value) return;
    const setIfMissing = (key: string): void => setMissingWhen(mapped, true, key, value);
    switch (prop) {
        case 'mso-ansi-font-size':
        case 'mso-bidi-font-size':
            setIfMissing('font-size');
            break;
        case 'mso-ansi-font-weight':
            setIfMissing('font-weight');
            break;
        case 'mso-bidi-font-weight':
            setWhen(mapped, value === 'bold', 'font-weight', 'bold');
            break;
        case 'mso-bidi-font-style':
            setWhen(mapped, value === 'italic', 'font-style', 'italic');
            break;
        case 'mso-text-underline':
            setWhen(mapped, value !== 'none', 'text-decoration', 'underline');
            break;
        case 'mso-font-kerning':
            setMissingWhen(mapped, value !== '0pt', 'letter-spacing', value);
            break;
        case 'mso-highlight':
            setWhen(mapped, value !== 'auto', 'background-color', value);
            break;
        case 'mso-style-textfill-fill-color':
        case 'mso-color-alt':
            setIfMissing('color');
            break;
        case 'mso-line-height-alt':
            setIfMissing('line-height');
            break;
        case 'mso-text-raise':
            setMissingWhen(mapped, value !== '0', 'vertical-align', value);
            break;
        case 'mso-border-alt':
            setMissingWhen(mapped, true, 'border', value.replaceAll(/\s{0,4096}windowtext\s{0,4096}/gi, ' #000000 ').trim());
            break;
        case 'mso-padding-alt':
            setIfMissing('padding');
            break;
    }
}

function mapStandardProperty(prop: string, value: string, mapped: StyleMap): void {
    if (prop === 'font-family') return;
    if (prop === 'background' && isSimpleColorValue(value)) {
        if (!mapped.has('background-color')) mapped.set('background-color', value);
        return;
    }
    if (prop === 'color' || prop === 'background-color') {
        const lower = value.toLowerCase();
        if (lower === 'auto' || SYSTEM_COLORS.has(lower)) {
            const resolved = SYSTEM_COLORS.get(lower);
            if (resolved) mapped.set(prop, resolved);
            return;
        }
    }
    mapped.set(prop, value);
}

function mapOfficeStyles(container: HTMLElement): void {
    walkElements(container, (el) => {
        const style = el.getAttribute('style');
        if (!style) return;

        const mapped: StyleMap = new Map();
        for (const [prop, value] of parseStyles(style)) {
            if (prop.startsWith('mso-')) mapMsoProperty(prop, value, mapped);
            else if (!prop.startsWith('-')) mapStandardProperty(prop, value, mapped);
        }
        writeStyles(el, mapped);
    });
}

function applyMissingProps(props: StyleMap, target: HTMLElement): void {
    const styles = parseStyles(target.getAttribute('style') ?? '');
    for (const [prop, value] of props) {
        if (!styles.has(prop)) styles.set(prop, value);
    }
    const serialized = serializeStyles(styles);
    if (serialized) target.setAttribute('style', serialized);
}

function mergeSelectorsIntoRules(selectorGroup: string, props: StyleMap, rules: CssRules): void {
    for (const selector of selectorGroup.split(',').map((s) => s.trim())) {
        if (!selector) continue;
        const existing = rules.get(selector);
        if (existing) {
            for (const [prop, value] of props) existing.set(prop, value);
        } else {
            rules.set(selector, new Map(props));
        }
    }
}

function parseCssBlock(cssText: string, rules: CssRules): void {
    const ruleRegex = /([^{}]{1,100000})\{([^}]{1,100000})\}/g;
    for (let match = ruleRegex.exec(cssText); match; match = ruleRegex.exec(cssText)) {
        const selectorGroup = (match[1] ?? '').trim();
        if (selectorGroup.includes('@')) continue;

        const relevant: StyleMap = new Map();
        for (const [prop, value] of parseStyles((match[2] ?? '').trim())) {
            if (RELEVANT_CSS_PROPERTIES.has(prop) || prop.startsWith('mso-')) relevant.set(prop, value);
        }
        if (relevant.size > 0) mergeSelectorsIntoRules(selectorGroup, relevant, rules);
    }
}

function extractCssRules(html: string): CssRules {
    const rules: CssRules = new Map();
    const styleBlockRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    for (let block = styleBlockRegex.exec(html); block; block = styleBlockRegex.exec(html)) {
        const cssText = (block[1] ?? '')
            .replaceAll(/\/\*[\s\S]*?\*\//g, '')
            .replaceAll('<!--', '')
            .replaceAll('-->', '');
        parseCssBlock(cssText, rules);
    }
    return rules;
}

function inlineCssRules(rules: CssRules, container: HTMLElement): void {
    for (const [selector, props] of rules) {
        try {
            container.querySelectorAll<HTMLElement>(selector).forEach((el) => applyMissingProps(props, el));
        } catch {
            // Invalid CSS selector: skip.
        }
    }
}

function removeNamespacedElements(container: HTMLElement): void {
    // Matched by tag name, not by an escaped `o\:p` selector: jsdom's selector
    // engine does not match those, and the wrapper fell through to the drop of
    // namespaced tags below, taking its text along.
    Array.from(container.querySelectorAll('*'))
        .filter((el) => WORD_WRAPPER_TAGS.has(el.tagName.toLowerCase()))
        .forEach(unwrapElement);

    walkElements(container, (el) => {
        if (el.tagName?.includes(':')) el.remove();
    });
}

function detectWordHeadingLevel(el: Element): number {
    const style = el.getAttribute('style') ?? '';
    const match = /MsoHeading(\d)/i.exec(el.getAttribute('class') ?? '')
        ?? /mso-outline-level\s*:\s*(\d)/i.exec(style)
        ?? /mso-style-name\s*:\s*["']?Heading\s*(\d)["']?/i.exec(style);
    return Number.parseInt(match?.[1] ?? '0', 10);
}

function parseWordListItem(el: Element): WordListItem | null {
    if (el.tagName !== 'P') return null;

    const style = el.getAttribute('style') ?? '';
    if (!/MsoListParagraph/i.test(el.getAttribute('class') ?? '') && !/mso-list\s*:/i.test(style)) return null;

    const text = el.textContent ?? '';
    return {
        el,
        level: Number.parseInt(/mso-list\s*:[^;]*level(\d)/i.exec(style)?.[1] ?? '1', 10),
        listId: /mso-list\s*:\s*(\w+)/i.exec(style)?.[1] ?? 'default',
        isOrdered: /^\s*\d+[.)]\s/.test(text) || /^\s*[a-z][.)]\s/i.test(text) || /^\s*[ivxlcdm]+[.)]\s/i.test(text),
    };
}

function stripListBulletSpan(el: Element): void {
    el.querySelectorAll('span').forEach((span) => {
        if (/mso-list\s*:\s*Ignore/i.test(span.getAttribute('style') ?? '')) span.remove();
    });

    const first = el.firstChild;
    if (first?.nodeType === Node.TEXT_NODE) {
        first.textContent = (first.textContent ?? '')
            .replace(/^[\s\u00A0]*[·o§•‣◦⁃∙]\s*/, '')
            .replace(/^[\s\u00A0]*\d+[.)]\s*/, '')
            .replace(/^[\s\u00A0]*[a-z][.)]\s*/i, '')
            .replace(/^[\s\u00A0]*[ivxlcdm]+[.)]\s*/i, '');
    }
}

function escapeHtml(text: string): string {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#x27;');
}

/**
 * Wrap bare URLs in anchors.
 *
 * Runs on ALREADY-ESCAPED text, so the class must decide, per entity, whether
 * it CONTINUES a URL or ends one:
 *
 * - `&amp;` and `&#x27;` continue it: a query separator and an apostrophe in a
 *   slug are both legal and ordinary. Ending at an apostrophe would silently
 *   link to the WRONG page rather than a visibly broken one.
 * - `&lt;`, `&gt;` and `&quot;` end it. They are not legal unencoded in a URL
 *   and they delimit markup, so including them would let a URL swallow the
 *   escaped tags around it.
 */
function autoLinkUrls(escaped: string): string {
    return escaped.replaceAll(/(https?:\/\/(?:&(?:amp|#x27);|[^\s<>&"'])+)/g, '<a href="$1">$1</a>');
}

function looksLikeMarkdown(text: string): boolean {
    if (text.length < 3) return false;

    const weights: ReadonlyArray<readonly [RegExp, number]> = [
        [/^#{1,6}\s+\S/m, 2],
        [/```[\s\S]*?```/, 2],
        [/\[[^\]]{1,4096}\]\(https?:\/\/[^)]{1,4096}\)/, 2],
        [/\*\*[^*]+\*\*/, 1],
        [/^[-*+]\s+/m, 1],
        [/^\d+\.\s+/m, 1],
        [/^>\s/m, 1],
        [/`[^`]+`/, 1],
    ];
    const score = weights.reduce((sum, [pattern, weight]) => sum + (pattern.test(text) ? weight : 0), 0);
    return score >= 2;
}

/** Heuristic for wrapped PDF text; it only routes trivial HTML to the plain-text path. */
function looksLikePdfText(text: string): boolean {
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length < 3) return false;

    const lengths = lines.map((l) => l.trim().length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    if (avgLength < 10) return false;

    const consistent = lengths.filter((l) => Math.abs(l - avgLength) / avgLength < 0.4);
    if (consistent.length / lines.length > 0.3) return true;

    return !/\n\s*\n/.test(text) && lines.length >= 5;
}

const isMsWordHtml = (html: string): boolean =>
    /class="?Mso/i.test(html) ||
    /urn:schemas-microsoft-com:office/i.test(html) ||
    /<o:p[\s>]/i.test(html) ||
    /mso-/i.test(html) ||
    /<!--\[if\s+(?:gte\s+)?mso/i.test(html);

const isOutlookHtml = (html: string): boolean =>
    isMsWordHtml(html) && (
        /class="?WordSection1"?/i.test(html) ||
        /<v:shapetype/i.test(html) ||
        /<v:shape/i.test(html) ||
        /<o:OfficeDocumentSettings/i.test(html));

const isGoogleDocsHtml = (html: string): boolean =>
    /docs-internal-guid-/i.test(html) || /data-sheets-/i.test(html);

const isApplePagesHtml = (html: string): boolean =>
    /Cocoa HTML Writer/i.test(html) || /content="Apple"/i.test(html);

const isLibreOfficeHtml = (html: string): boolean =>
    /content="LibreOffice/i.test(html) || /content="OpenOffice/i.test(html);

const isMinimalHtml = (html: string): boolean =>
    !/<(?:h[1-6]|ul|ol|li|table|thead|tbody|tr|td|th|strong|em|blockquote|pre|code|a\s)[^>]*>/i.test(html);

const isExcelHtml = (html: string): boolean =>
    /xmlns:x\s*=\s*["']urn:schemas-microsoft-com:office:excel["']/i.test(html) ||
    /<meta\s[^>]*name\s*=\s*["']?Generator["']?\s[^>]*content\s*=\s*["']?Microsoft\s+Excel/i.test(html) ||
    /<meta\s[^>]*content\s*=\s*["']?Microsoft\s+Excel["']?\s[^>]*name\s*=\s*["']?Generator/i.test(html) ||
    (/<google-sheets-html-origin/i.test(html) && /<table/i.test(html));

function detectHtmlSource(html: string, text: string): PasteSource {
    if (isExcelHtml(html)) return 'excel';
    if (isOutlookHtml(html)) return 'outlook';
    if (isMsWordHtml(html)) return 'msword';
    if (isGoogleDocsHtml(html)) return 'google-docs';
    if (isApplePagesHtml(html)) return 'apple-pages';
    if (isLibreOfficeHtml(html)) return 'libreoffice';
    if (text && looksLikePdfText(text) && isMinimalHtml(html)) return 'plain-text';
    return 'html';
}

function removeSheetsAttributes(el: Element): void {
    for (const attr of Array.from(el.attributes)) {
        if (attr.name.startsWith('data-sheets-')) el.removeAttribute(attr.name);
    }
}

function applyExcelColumnWidths(table: HTMLTableElement): void {
    const colWidths = Array.from(table.querySelectorAll('col'), (col) => col.getAttribute('width') ?? col.style.width);
    table.querySelectorAll('colgroup').forEach((group) => group.remove());
    if (!colWidths.some(Boolean)) return;

    table.querySelectorAll('tr').forEach((row) => {
        row.querySelectorAll<HTMLElement>('td, th').forEach((cell, i) => {
            const width = colWidths[i];
            if (width && !cell.style.width) cell.style.width = width.includes('px') ? width : `${width}px`;
        });
    });
}

/**
 * Normalizes pasted content from various sources (Word, Outlook, Google Docs,
 * etc.) into clean, semantic HTML before it reaches the sanitizer.
 *
 * Pipeline: ClipboardEvent -> normalize() -> RichTextSanitizer.sanitize() -> insertHtml()
 *
 * This does structural and cosmetic cleanup only; the sanitizer remains the
 * security gate.
 */
export class RichTextPasteNormalizer {
    private readonly ownDocument: Document | undefined;
    private readonly markdown: RichTextMarkdown;

    constructor(options: RichTextPasteNormalizerOptions = {}) {
        this.ownDocument = options.document;
        this.markdown = options.markdown ?? new RichTextMarkdown();
    }

    private get document(): Document {
        return this.ownDocument ?? globalThis.document;
    }

    /** Returns cleaned HTML ready for the sanitizer. */
    normalize(html: string | null, text: string): string {
        const source = this.detectSource(html, text);
        const safeHtml = html ?? '';

        switch (source) {
            case 'excel':
                return this.normalizeExcel(safeHtml);
            case 'msword':
            case 'outlook':
                return this.normalizeOffice(safeHtml, source);
            case 'google-docs':
                return this.normalizeGoogleDocs(safeHtml);
            case 'apple-pages':
            case 'libreoffice':
                return this.normalizeGenericOffice(safeHtml);
            case 'markdown':
                return this.markdown.toHtml(text);
            case 'html':
                return this.normalizeGenericHtml(safeHtml);
            case 'plain-text':
                return this.normalizePlainText(text);
        }
    }

    detectSource(html: string | null, text: string): PasteSource {
        if (html && html.trim().length > 0) return detectHtmlSource(html, text);
        if (text && text.trim().length > 0 && looksLikeMarkdown(text)) return 'markdown';
        return 'plain-text';
    }

    private normalizeOffice(html: string, source: 'msword' | 'outlook'): string {
        const cleaned = html
            .replaceAll(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '')
            .replaceAll(/<xml[\s\S]*?<\/xml>/gi, '')
            .replaceAll(/<\?xml[\s\S]*?\?>/gi, '');

        const cssRules = extractCssRules(cleaned);
        const container = parseToContainer(cleaned);
        container.querySelectorAll('style').forEach((styleEl) => styleEl.remove());

        inlineCssRules(cssRules, container);
        removeNamespacedElements(container);
        this.convertFontElements(container);
        this.convertWordHeadings(container);
        this.convertWordLists(container);
        // Before mapOfficeStyles, which drops every unmapped mso-* property:
        // afterwards nothing marks a spacerun any more.
        const spaceruns = this.collectSpacerunText(container);
        mapOfficeStyles(container);
        convertStylesToSemanticElements(container);
        removeEmptyElements(container);
        this.normalizeWhitespace(container, spaceruns);

        if (source === 'outlook') this.normalizeOutlookSpecific(container);

        stripClassAndIdAttributes(container);
        return container.innerHTML;
    }

    private convertWordHeadings(container: HTMLElement): void {
        walkElements(container, (el) => {
            if (el.tagName !== 'P') return;

            const level = detectWordHeadingLevel(el);
            if (level < 1 || level > 6) return;

            const heading = this.document.createElement(`h${level}`);
            while (el.firstChild) heading.appendChild(el.firstChild);
            const cleaned = stripMsoProperties(el.getAttribute('style') ?? '');
            if (cleaned) heading.setAttribute('style', cleaned);
            el.parentNode?.replaceChild(heading, el);
        });
    }

    private convertWordLists(container: HTMLElement): void {
        const runs: WordListItem[][] = [];
        let currentRun: WordListItem[] = [];

        for (const el of Array.from(container.children)) {
            const parsed = parseWordListItem(el);
            if (!parsed) {
                if (currentRun.length > 0) runs.push(currentRun);
                currentRun = [];
                continue;
            }
            stripListBulletSpan(el);
            currentRun.push(parsed);
        }
        if (currentRun.length > 0) runs.push(currentRun);

        for (const items of runs) {
            const first = items[0];
            if (!first) continue;
            first.el.parentNode?.insertBefore(this.buildNestedList(items, first.isOrdered), first.el);
            items.forEach((item) => item.el.remove());
        }
    }

    /**
     * Nest a run of Word list paragraphs by their mso-list level: consecutive
     * items at one level share one list under the same parent item, and an item
     * at a shallower level closes every deeper list.
     */
    private buildNestedList(items: WordListItem[], isOrdered: boolean): HTMLElement {
        const root = this.document.createElement(isOrdered ? 'ol' : 'ul');
        const stack: { list: HTMLElement; level: number }[] = [{ list: root, level: 1 }];

        for (const item of items) {
            // Strictly deeper only: popping an equal level closed a sibling's
            // list and opened a one-item list for every entry.
            while (stack.length > 1 && (stack.at(-1)?.level ?? 0) > item.level) stack.pop();

            this.ensureNestedListParent(stack, item);

            const li = this.document.createElement('li');
            while (item.el.firstChild) li.appendChild(item.el.firstChild);
            stack.at(-1)?.list.appendChild(li);
        }

        return root;
    }

    private ensureNestedListParent(stack: { list: HTMLElement; level: number }[], item: WordListItem): void {
        const top = stack.at(-1);
        if (!top || item.level <= top.level) return;

        let lastLi = top.list.lastElementChild;
        if (lastLi?.tagName !== 'LI') {
            lastLi = this.document.createElement('li');
            top.list.appendChild(lastLi);
        }

        const nestedList = this.document.createElement(item.isOrdered ? 'ol' : 'ul');
        lastLi.appendChild(nestedList);
        stack.push({ list: nestedList, level: item.level });
    }

    private normalizeOutlookSpecific(container: HTMLElement): void {
        container.querySelectorAll('.WordSection1, [class*="WordSection"]').forEach(unwrapElement);
        removeNamespacedTags(container, /^v:/i);
    }

    private normalizeGoogleDocs(html: string): string {
        const container = parseToContainer(html);

        this.removeGoogleDocsWrapper(container);
        this.simplifyGoogleDocsSpans(container);
        this.cleanGoogleDocsLists(container);
        container.querySelectorAll('[data-sheets-value], [data-sheets-userformat]').forEach(removeSheetsAttributes);
        container.querySelectorAll('br[class]').forEach((br) => br.removeAttribute('class'));
        convertStylesToSemanticElements(container);
        removeEmptyElements(container);
        stripClassAndIdAttributes(container);

        return container.innerHTML;
    }

    private removeGoogleDocsWrapper(container: HTMLElement): void {
        container.querySelectorAll('[id^="docs-internal-guid-"]').forEach(unwrapElement);

        walkElements(container, (el) => {
            if (el.tagName !== 'B') return;
            if ((el.getAttribute('id') ?? '').startsWith('docs-internal-guid-') ||
                /font-weight\s*:\s*normal/i.test(el.getAttribute('style') ?? '')) {
                unwrapElement(el);
            }
        });
    }

    private simplifyGoogleDocsSpans(container: HTMLElement): void {
        walkElements(container, (el) => {
            const style = el.getAttribute('style');
            if (el.tagName !== 'SPAN' || !style) return;

            const styles = parseStyles(style);
            for (const [prop, pattern] of GOOGLE_DEFAULT_STYLES) {
                if (pattern.test(styles.get(prop)?.trim() ?? '')) styles.delete(prop);
            }
            GOOGLE_STRIPPED_STYLES.forEach((prop) => styles.delete(prop));

            writeStyles(el, styles);
            if (styles.size === 0 && !el.hasAttributes()) unwrapElement(el);
        });
    }

    private cleanGoogleDocsLists(container: HTMLElement): void {
        container.querySelectorAll('ul, ol').forEach((list) => {
            list.removeAttribute('style');
            list.querySelectorAll('li').forEach((item) => {
                const listStyleType = parseStyles(item.getAttribute('style') ?? '').get('list-style-type');
                if (listStyleType) item.setAttribute('style', `list-style-type: ${listStyleType}`);
                else item.removeAttribute('style');
            });
        });
    }

    private normalizeGenericOffice(html: string): string {
        const container = parseToContainer(html);

        removeMetaTags(container);
        this.stripVendorPrefixedStyles(container);
        this.convertFontElements(container);
        convertStylesToSemanticElements(container);
        removeEmptyElements(container);
        stripClassAndIdAttributes(container);

        return container.innerHTML;
    }

    private stripVendorPrefixedStyles(container: HTMLElement): void {
        walkElements(container, (el) => {
            const style = el.getAttribute('style');
            if (!style) return;

            const styles = parseStyles(style);
            for (const prop of Array.from(styles.keys())) {
                if (VENDOR_PREFIXES.some((prefix) => prop.startsWith(prefix))) styles.delete(prop);
            }
            writeStyles(el, styles);
        });
    }

    private convertFontElements(container: HTMLElement): void {
        for (const font of Array.from(container.querySelectorAll<HTMLElement>('font'))) {
            const span = this.document.createElement('span');
            const styles: string[] = [];

            const color = font.getAttribute('color');
            if (color) styles.push(`color: ${color}`);

            const face = font.getAttribute('face');
            if (face) styles.push(`font-family: ${face}`);

            const size = FONT_SIZES[font.getAttribute('size') ?? ''];
            if (size) styles.push(`font-size: ${size}`);

            if (styles.length > 0) span.setAttribute('style', styles.join('; '));

            while (font.firstChild) span.appendChild(font.firstChild);
            font.parentNode?.replaceChild(span, font);
        }
    }

    private normalizeExcel(html: string): string {
        const container = parseToContainer(html);

        container.querySelectorAll('google-sheets-html-origin').forEach(unwrapElement);
        removeNamespacedTags(container, /^[xvo]:/i);
        container.querySelectorAll('style').forEach((el) => el.remove());
        this.removeConditionalComments(container);
        container.querySelectorAll('table').forEach(applyExcelColumnWidths);
        walkElements(container, removeSheetsAttributes);

        mapOfficeStyles(container);
        convertStylesToSemanticElements(container);

        walkElements(container, (el) => {
            if ((el.tagName === 'TD' || el.tagName === 'TH') && !el.innerHTML.trim()) el.innerHTML = '<br>';
        });

        removeEmptyElements(container);
        stripClassAndIdAttributes(container);

        return container.innerHTML;
    }

    private removeConditionalComments(container: HTMLElement): void {
        const walker = this.document.createTreeWalker(container, NodeFilter.SHOW_COMMENT);
        const comments: Comment[] = [];
        for (let node = walker.nextNode() as Comment | null; node; node = walker.nextNode() as Comment | null) {
            if (/^\[(?:if\s|endif\])/i.test(node.data)) comments.push(node);
        }
        comments.forEach((node) => node.remove());
    }

    private normalizeGenericHtml(html: string): string {
        const container = parseToContainer(html);

        removeMetaTags(container);
        this.convertSemanticElements(container);
        this.normalizeDivsToP(container);
        convertStylesToSemanticElements(container);
        removeEmptyElements(container);
        stripClassAndIdAttributes(container);

        return container.innerHTML;
    }

    private convertSemanticElements(container: HTMLElement): void {
        walkElements(container, (el) => {
            if (el.tagName === 'B' && !el.getAttribute('id')?.startsWith('docs-internal-guid-')) {
                this.replaceTag(el, 'strong');
            } else if (el.tagName === 'I') {
                this.replaceTag(el, 'em');
            }
        });
    }

    private normalizeDivsToP(container: HTMLElement): void {
        walkElements(container, (el) => {
            if (el.tagName === 'DIV' && !Array.from(el.children).some((child) => BLOCK_TAGS.has(child.tagName))) {
                this.replaceTag(el, 'p');
            }
        });
    }

    private replaceTag(el: HTMLElement, newTag: string): void {
        const newEl = this.document.createElement(newTag);
        for (const attr of Array.from(el.attributes)) newEl.setAttribute(attr.name, attr.value);
        while (el.firstChild) newEl.appendChild(el.firstChild);
        el.parentNode?.replaceChild(newEl, el);
    }

    /**
     * A newline the user pasted is content, so it survives: no reflow. An earlier
     * version joined consecutive lines it guessed were PDF column wrapping, but
     * that shape matches most multi-line text, so a pasted CSV, address, SQL
     * query or log collapsed into one run-on line, content-dependently and
     * without undo. No signal separates wrapped prose from such text; a
     * collapsed spreadsheet is unrecoverable, preserved wrapping is not.
     */
    private normalizePlainText(text: string): string {
        if (!text) return '';

        const escaped = autoLinkUrls(escapeHtml(text));
        if (!text.includes('\n')) return escaped;

        return escaped
            .split(/\n{2,}/)
            .map((paragraph) => `<p>${paragraph.replaceAll('\n', '<br>')}</p>`)
            .join('');
    }

    /**
     * The text nodes inside Word's `mso-spacerun:yes` runs: spaces the author
     * typed, written as nbsp so they keep their width. Collected as nodes rather
     * than elements because removeEmptyElements unwraps the whitespace-only run
     * span, while the text node itself survives.
     */
    private collectSpacerunText(container: HTMLElement): ReadonlySet<Node> {
        const spacerunText = new Set<Node>();
        for (const el of Array.from(container.querySelectorAll('[style]'))) {
            if (!/mso-spacerun\s*:\s*yes/i.test(el.getAttribute('style') ?? '')) continue;
            const walker = this.document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) spacerunText.add(node);
        }
        return spacerunText;
    }

    /** Collapse each run of two or more nbsp into one space, leaving code and spacerun text as written. */
    private normalizeWhitespace(container: HTMLElement, spacerunText: ReadonlySet<Node>): void {
        const walker = this.document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const tag = node.parentElement?.tagName;
            if (tag === 'PRE' || tag === 'CODE' || spacerunText.has(node)) continue;

            const text = node.textContent ?? '';
            if (/\u00A0{2,}/.test(text)) node.textContent = text.replaceAll(/\u00A0{2,}/g, ' ');
        }
    }
}


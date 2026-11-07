/**
 * Pure helpers behind the rich text editor's find & replace: total functions over a DOM subtree, a
 * query string or a character offset, so the search can be tested without a live editor.
 */

/** One text node in the flattened document, and where its text starts. */
export interface FindSegment {
    readonly node: Text;
    /** Offset of `node.data[0]` within {@link FindIndex.text}. */
    readonly start: number;
    /** Length of `node.data` at index-build time. */
    readonly length: number;
}

/** The document flattened to one searchable string plus a map back to the DOM. */
export interface FindIndex {
    /** Every searchable text node concatenated, with `\n` at block boundaries. */
    readonly text: string;
    readonly segments: readonly FindSegment[];
}

/** A resolved character offset: which text node, and how far into it. */
export interface FindPosition {
    readonly node: Text;
    readonly offset: number;
}

/** The three user-facing search modifiers. */
export interface FindOptions {
    readonly caseSensitive: boolean;
    readonly wholeWord: boolean;
    readonly useRegex: boolean;
}

/** Longest query {@link compileFindRegex} accepts; it bounds the cost of a user-authored regex. */
export const FIND_MAX_QUERY_LENGTH = 256;

/** Elements whose boundaries break a match: `<p>cat</p><p>alog</p>` does not contain "catalog". */
const BLOCK_TAGS = new Set([
    'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE',
    'TD', 'TH', 'TR', 'SUMMARY', 'DETAILS', 'FIGCAPTION', 'HR', 'BR',
]);

/** Subtrees that are atomic chips, not prose: never searched, never replaced. */
const SKIPPED_SELECTOR = '[data-mention], [data-tag], [contenteditable="false"]';

/** Characters that are part of a word for the whole-word option. */
const WORD_CHAR = String.raw`\p{L}\p{N}_`;

/**
 * Flatten `root` into one searchable string and the segment map that turns an offset in it back
 * into a DOM position. Block elements contribute a `\n` on entry and exit; chip subtrees are skipped.
 */
export function buildFindIndex(root: Node): FindIndex {
    const segments: FindSegment[] = [];
    let text = '';

    const appendBreak = (): void => {
        if (text.length > 0 && !text.endsWith('\n')) text += '\n';
    };

    const visit = (node: Node): void => {
        if (node instanceof Text) {
            if (node.data.length === 0) return;
            segments.push({ node, start: text.length, length: node.data.length });
            text += node.data;
            return;
        }
        if (!(node instanceof Element) || node.matches(SKIPPED_SELECTOR)) return;

        const isBlock = BLOCK_TAGS.has(node.tagName);
        if (isBlock) appendBreak();
        for (let child = node.firstChild; child; child = child.nextSibling) visit(child);
        if (isBlock) appendBreak();
    };

    for (let child = root.firstChild; child; child = child.nextSibling) visit(child);
    return { text, segments };
}

/** Escape every regular-expression metacharacter in a literal query. */
function escapeLiteral(query: string): string {
    return query.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/**
 * Characters that make the token before them repeatable. `?` counts: without it `(aa?)+$` read as
 * unquantified and backtracked exponentially.
 */
const QUANTIFIERS = new Set(['+', '*', '}', '?']);

/**
 * Whether a user regex contains a quantified group that itself holds a quantifier (the classic
 * `(a+)+` shape), which backtracks exponentially and hangs the tab on a short line. Find runs on
 * every keystroke, so such a pattern is refused like an unparseable one.
 *
 * KNOWN LIMIT: only the nested-quantifier family is detected. Alternation overlap (`(a|a)+`) and
 * sequential quantifiers (`a+a+a+b`) are also exponential and NOT caught; catching them needs a
 * regex parser or a worker with an execution budget. {@link FIND_MAX_QUERY_LENGTH} bounds the damage.
 */
function hasNestedQuantifier(pattern: string): boolean {
    for (let i = 0; i < pattern.length; i++) {
        // Lookarounds cannot be quantified. "(?:" and "(?<name>" are plain groups and must be checked.
        if (pattern[i] !== '(' || isLookaround(pattern, i)) continue;
        const group = scanGroup(pattern, i);
        const after = pattern[group.end];
        if (group.quantifiedInside && (after === '+' || after === '*' || after === '{')) return true;
    }
    return false;
}

/** Whether the group opening at `open` is a lookahead or lookbehind. */
function isLookaround(pattern: string, open: number): boolean {
    if (pattern[open + 1] !== '?') return false;
    const kind = pattern[open + 2];
    if (kind === '=' || kind === '!') return true;
    return kind === '<' && (pattern[open + 3] === '=' || pattern[open + 3] === '!');
}

/**
 * Walk one parenthesised group, reporting where it ends and whether it holds a quantifier at ANY
 * depth (checking only the top level let `((a+))+$` through). Escapes are skipped.
 */
function scanGroup(pattern: string, open: number): { end: number; quantifiedInside: boolean } {
    let depth = 1;
    let quantifiedInside = false;
    let i = open + 1;

    while (i < pattern.length && depth > 0) {
        const ch = pattern[i] ?? '';
        if (ch === '\\') i++;
        else if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if (QUANTIFIERS.has(ch)) quantifiedInside = true;
        i++;
    }

    return { end: i, quantifiedInside };
}

/**
 * Compile the user's query into the search regex, or `null` for an empty query, one over
 * {@link FIND_MAX_QUERY_LENGTH}, an invalid pattern, or a nested-quantifier pattern in regex mode.
 * Literal queries are escaped; whole-word uses Unicode-aware look-arounds so it works for any script.
 */
export function compileFindRegex(query: string, options: FindOptions): RegExp | null {
    if (!query || query.length > FIND_MAX_QUERY_LENGTH) return null;
    if (options.useRegex && hasNestedQuantifier(query)) return null;

    const body = options.useRegex ? query : escapeLiteral(query);
    const source = options.wholeWord ? `(?<![${WORD_CHAR}])(?:${body})(?![${WORD_CHAR}])` : body;

    try {
        return new RegExp(source, options.caseSensitive ? 'gu' : 'gui');
    } catch {
        return null;
    }
}

/**
 * Resolve a character offset in {@link FindIndex.text} to a text node and in-node offset, by binary
 * search. `atEnd` resolves an exclusive end offset onto the segment holding the previous character,
 * so a match ending at a segment boundary closes inside the node it covered. Offsets in the `\n`
 * between blocks yield `null`.
 */
export function offsetToPosition(
    segments: readonly FindSegment[],
    offset: number,
    atEnd = false,
): FindPosition | null {
    const target = atEnd ? offset - 1 : offset;
    if (target < 0) return null;

    let low = 0;
    let high = segments.length - 1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        const segment = segments[mid]!;
        if (target < segment.start) high = mid - 1;
        else if (target >= segment.start + segment.length) low = mid + 1;
        else return { node: segment.node, offset: target - segment.start + (atEnd ? 1 : 0) };
    }
    return null;
}

/**
 * Pure Markdown input-rule matchers (no DOM, no editor state). The editor calls these from its
 * typing path to decide whether the characters just typed complete a Markdown marker; the syntax
 * mirrors the subset the editor's own Markdown parser understands.
 */

/** How far back from the caret an inline rule looks; bounds the per-keystroke cost on a long paragraph. */
export const INLINE_RULE_LOOKBEHIND = 200;

/** The block-level transform a completed marker asks for. */
export type BlockInputRuleKind =
    | 'heading1'
    | 'heading2'
    | 'heading3'
    | 'bulletList'
    | 'orderedList'
    | 'blockquote'
    | 'taskUnchecked'
    | 'taskChecked'
    | 'horizontalRule'
    | 'codeBlock';

/** A matched block rule: what to build, and how many characters to remove. */
export interface BlockInputRuleMatch {
    kind: BlockInputRuleKind;
    /** Marker characters including the terminator, counted from the block start. */
    markerLength: number;
    /** The code fence's language word, `''` when the fence carried none. */
    language?: string;
    /**
     * Quote levels typed (`>>` is two). Only `blockquote` carries it. It is what the author TYPED,
     * not clamped: the ceiling depends on quotes the caret already sits in, so the caller clamps.
     */
    depth?: number;
}

/** The inline element a completed wrapper asks for. */
export type InlineInputRuleKind = 'strong' | 'em' | 'code';

/** A matched inline rule, with offsets into the string that was searched. */
export interface InlineInputRuleMatch {
    kind: InlineInputRuleKind;
    /** Offset of the opening delimiter. */
    start: number;
    /** Offset just past the closing delimiter. */
    end: number;
    /** The body text, delimiters stripped. */
    text: string;
}

/** The character that completes a marker: a space, Enter, or nothing (only `---`). */
type BlockRuleTerminator = ' ' | '\n' | '';

interface BlockRuleDefinition {
    readonly kind: BlockInputRuleKind;
    readonly pattern: RegExp;
    readonly terminators: readonly BlockRuleTerminator[];
}

/** The block syntax table, in match order. */
const BLOCK_RULES: readonly BlockRuleDefinition[] = [
    { kind: 'heading1', pattern: /^#$/, terminators: [' '] },
    { kind: 'heading2', pattern: /^#{2}$/, terminators: [' '] },
    { kind: 'heading3', pattern: /^#{3}$/, terminators: [' '] },
    { kind: 'bulletList', pattern: /^[-*]$/, terminators: [' '] },
    { kind: 'orderedList', pattern: /^\d{1,3}\.$/, terminators: [' '] },
    // A run of markers, one quote each, so an author can type a nested quote.
    { kind: 'blockquote', pattern: /^(>+)$/, terminators: [' '] },
    { kind: 'taskUnchecked', pattern: /^\[]$/, terminators: [' '] },
    { kind: 'taskChecked', pattern: /^\[[xX]]$/, terminators: [' '] },
    { kind: 'horizontalRule', pattern: /^-{3}$/, terminators: [''] },
    { kind: 'codeBlock', pattern: /^`{3}(\w{0,16})$/, terminators: [' ', '\n'] },
];

/**
 * Matches the caret block's text (terminator already stripped) against the block syntax table.
 * `terminator` is reported by the caller alone: a trailing space in the text is never promoted to
 * one, so a drop or paste that merely ends in a space cannot complete a marker. Returns `null` when
 * nothing matches (the common case).
 */
export function matchBlockInputRule(
    textBeforeCaret: string,
    terminator: BlockRuleTerminator,
): BlockInputRuleMatch | null {
    for (const rule of BLOCK_RULES) {
        if (!rule.terminators.includes(terminator)) continue;
        const match = rule.pattern.exec(textBeforeCaret);
        if (!match) continue;
        const markerLength = textBeforeCaret.length + terminator.length;
        if (rule.kind === 'codeBlock') return { kind: rule.kind, markerLength, language: match[1] ?? '' };
        if (rule.kind === 'blockquote') return { kind: rule.kind, markerLength, depth: match[1]?.length };
        return { kind: rule.kind, markerLength };
    }
    return null;
}

interface InlineRuleDefinition {
    readonly kind: InlineInputRuleKind;
    readonly pattern: RegExp;
}

/**
 * The inline syntax table, in precedence order (`**` before `*`). Each pattern is anchored at the
 * end and needs a non-space, non-delimiter character on both inner edges. `em` also rejects an
 * opening `*` preceded by `*` or a word character (an in-progress `**bold` or `a*b*`).
 */
const INLINE_RULES: readonly InlineRuleDefinition[] = [
    { kind: 'strong', pattern: /(?<!\*)\*\*(?=[^\s*])([^*]*[^\s*])\*\*$/ },
    { kind: 'em', pattern: /(?<![*\w])\*(?=[^\s*])([^*]*[^\s*])\*$/ },
    { kind: 'code', pattern: /(?<!`)`([^`]+)`$/ },
];

/**
 * Matches the text before the caret against the inline syntax table, looking back at most
 * {@link INLINE_RULE_LOOKBEHIND} characters. Offsets are relative to the full string passed in.
 */
export function matchInlineInputRule(textBeforeCaret: string): InlineInputRuleMatch | null {
    const base = Math.max(0, textBeforeCaret.length - INLINE_RULE_LOOKBEHIND);
    const window = textBeforeCaret.slice(base);

    for (const rule of INLINE_RULES) {
        const match = rule.pattern.exec(window);
        if (!match) continue;
        const start = base + match.index;
        return { kind: rule.kind, start, end: start + match[0].length, text: match[1] ?? '' };
    }
    return null;
}

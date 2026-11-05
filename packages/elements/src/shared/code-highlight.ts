/**
 * The syntax tokenizer, shared by every surface that shows code.
 *
 * It began inside `ui-code-block` as private methods over a private pattern
 * table. The rich text editor and its read-only view need exactly the same
 * tokens — `rich-text-markdown.service.ts` has always stored and round-tripped
 * a code block's language, and the sanitizer has always allowed the
 * `language-*` and `token-*` classes — so the tokenizer moved here rather than
 * being written a second time. Rendering the whole `ui-code-block` COMPONENT
 * inside a document was the alternative and is wrong: it brings a copy button,
 * a line-number gutter, fold chevrons and a hard-coded dark surface into prose,
 * and none of that can live inside a contenteditable.
 *
 * Two rules the callers rely on:
 *
 * 1. **A line is tokenized on its own.** Highlighting never spans lines, so a
 *    multi-line string or block comment is coloured per line. That is what lets
 *    the editor re-highlight one line without re-reading the block.
 * 2. **An unknown language is not a guess.** {@link languagePatternsFor}
 *    returns `null` for a language it does not know, and for none at all.
 *    `ui-code-block` is a code viewer and keeps its documented TypeScript
 *    fallback, but a DOCUMENT is mostly prose: a fence with no language, or one
 *    tagged `text`, `log` or `diff`, would otherwise be coloured by TypeScript
 *    rules, inventing keywords in the reader's notes.
 */

/** One run of characters and what the tokenizer made of it. */
export interface CodeToken {
    type: string;
    text: string;
}

/** A language's rules: the first pattern to match at the lowest index wins. */
export type LanguagePattern = { type: string; regex: RegExp }[];

/**
 * Build a word-boundary keyword matcher from a list. Constructed at runtime so
 * the (legitimately long) per-language keyword set is a maintainable array
 * rather than one giant, hard-to-read regex literal.
 */
const keywordPattern = (words: readonly string[], flags = ''): RegExp =>
    new RegExp(String.raw`\b(${words.join('|')})\b`, flags);

const TS_KEYWORDS = ['const', 'let', 'var', 'function', 'class', 'import', 'from', 'return', 'if', 'else', 'for', 'while', 'export', 'interface', 'type', 'public', 'private', 'protected', 'implements', 'extends', 'new', 'this', 'true', 'false', 'null', 'undefined', 'void', 'async', 'await'];
const JS_KEYWORDS = ['const', 'let', 'var', 'function', 'class', 'import', 'from', 'return', 'if', 'else', 'for', 'while', 'export', 'new', 'this', 'true', 'false', 'null', 'undefined', 'void', 'async', 'await'];
const PYTHON_KEYWORDS = ['def', 'class', 'import', 'from', 'if', 'else', 'elif', 'for', 'while', 'return', 'try', 'except', 'finally', 'with', 'as', 'pass', 'break', 'continue', 'lambda', 'yield', 'async', 'await', 'True', 'False', 'None'];
const JAVA_KEYWORDS = ['public', 'private', 'protected', 'class', 'interface', 'enum', 'extends', 'implements', 'new', 'this', 'super', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'throws', 'import', 'package', 'void', 'int', 'boolean', 'char', 'byte', 'short', 'long', 'float', 'double', 'static', 'final', 'abstract', 'synchronized', 'volatile', 'transient', 'native', 'strictfp', 'instanceof', 'null', 'true', 'false'];
const CSHARP_KEYWORDS = ['public', 'private', 'protected', 'internal', 'class', 'struct', 'record', 'interface', 'enum', 'delegate', 'event', 'void', 'int', 'string', 'bool', 'var', 'async', 'await', 'Task', 'return', 'if', 'else', 'for', 'foreach', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'base', 'using', 'namespace', 'static', 'readonly', 'const', 'override', 'virtual', 'abstract', 'sealed', 'get', 'set', 'value'];
/**
 * The ANSI core plus the clauses and types PostgreSQL, MySQL and SQLite share.
 * Matched case-insensitively: `select` and `SELECT` are the same keyword.
 */
const SQL_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS', 'NATURAL', 'ON', 'USING',
    'GROUP', 'ORDER', 'BY', 'HAVING', 'LIMIT', 'OFFSET', 'FETCH', 'FIRST', 'NEXT', 'ROWS', 'ONLY',
    'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'MERGE', 'RETURNING', 'TRUNCATE',
    'CREATE', 'ALTER', 'DROP', 'TABLE', 'INDEX', 'VIEW', 'SCHEMA', 'DATABASE', 'COLUMN', 'ADD', 'RENAME', 'TO',
    'CONSTRAINT', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'CHECK', 'DEFAULT', 'CASCADE', 'IF',
    'AS', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'ILIKE', 'ANY', 'SOME',
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'DISTINCT', 'UNION', 'INTERSECT', 'EXCEPT', 'ALL', 'WITH', 'RECURSIVE',
    'OVER', 'PARTITION', 'WINDOW', 'ASC', 'DESC', 'NULLS', 'TRUE', 'FALSE',
    'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION', 'GRANT', 'REVOKE',
    'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'SERIAL', 'DECIMAL', 'NUMERIC', 'REAL', 'FLOAT', 'BOOLEAN',
    'CHAR', 'VARCHAR', 'TEXT', 'DATE', 'TIME', 'TIMESTAMP', 'INTERVAL', 'JSON', 'JSONB', 'UUID',
];

/** The built-in language rules, keyed by lowercase language name. */
export const LANGUAGE_PATTERNS: Readonly<Record<string, LanguagePattern>> = {
    typescript: [
        { type: 'comment', regex: /\/\/.*/ },
        { type: 'string', regex: /(["'])(?:(?=(\\?))\2.)*?\1/ },
        { type: 'keyword', regex: keywordPattern(TS_KEYWORDS) },
        { type: 'number', regex: /\b\d+\b/ },
        { type: 'function', regex: /\b[a-zA-Z_$]\w*(?=\()/ },
    ],
    javascript: [
        { type: 'comment', regex: /\/\/.*/ },
        { type: 'string', regex: /(["'])(?:(?=(\\?))\2.)*?\1/ },
        { type: 'keyword', regex: keywordPattern(JS_KEYWORDS) },
        { type: 'number', regex: /\b\d+\b/ },
        { type: 'function', regex: /\b[a-zA-Z_$]\w*(?=\()/ },
    ],
    python: [
        { type: 'comment', regex: /#.*/ },
        { type: 'string', regex: /(["'])(?:(?=(\\?))\2.)*?\1/ },
        { type: 'decorator', regex: /@[\w.]+/ },
        { type: 'keyword', regex: keywordPattern(PYTHON_KEYWORDS) },
        { type: 'number', regex: /\b\d+\b/ },
        { type: 'function', regex: /\b[a-zA-Z_]\w*(?=\()/ },
    ],
    java: [
        { type: 'comment', regex: /\/\/.*/ },
        { type: 'string', regex: /"(?:[^"\\]|\\.)*"/ },
        { type: 'keyword', regex: keywordPattern(JAVA_KEYWORDS) },
        { type: 'decorator', regex: /@\w+/ },
        { type: 'number', regex: /\b\d+\b/ },
        { type: 'function', regex: /\b[a-zA-Z_$]\w*(?=\()/ },
    ],
    html: [
        { type: 'comment', regex: /<!--[\s\S]*?-->/ },
        { type: 'tag', regex: /<\/?[a-z0-9-]+/i },
        { type: 'attr', regex: /[a-z0-9-]{1,256}(?==)/i },
        { type: 'string', regex: /"(?:[^"\\]|\\.)*"/ },
    ],
    xml: [
        { type: 'comment', regex: /<!--[\s\S]*?-->/ },
        { type: 'decorator', regex: /<\?xml[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<!DOCTYPE[^>]*>/i },
        { type: 'string', regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
        { type: 'tag', regex: /<\/?[a-zA-Z_][\w.\-:]{0,256}/ },
        { type: 'attr', regex: /[a-zA-Z_][\w.\-:]{0,256}(?==)/ },
        { type: 'keyword', regex: /&(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/ },
        { type: 'number', regex: /\b\d+\b/ },
    ],
    css: [
        { type: 'comment', regex: /\/\*[\s\S]*?\*\// },
        { type: 'selector', regex: /[.#]?[a-zA-Z0-9_-]{1,256}(?=\{)/ },
        { type: 'property', regex: /[a-z0-9-]{1,256}(?=:)/i },
        { type: 'string', regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
        { type: 'number', regex: /\b\d+(?:px|rem|em|%|vh|vw|s|ms|deg)?\b/ },
    ],
    json: [
        { type: 'function', regex: /"[^"]+":/ },
        { type: 'string', regex: /"(?:[^"\\]|\\.)*"/ },
        { type: 'keyword', regex: /\b(true|false|null)\b/ },
        { type: 'number', regex: /\b\d+\b/ },
    ],
    csharp: [
        { type: 'comment', regex: /\/\/.*/ },
        { type: 'string', regex: /"(?:[^"\\]|\\.)*"/ },
        { type: 'decorator', regex: /\[[a-zA-Z]\w*\]/ },
        { type: 'keyword', regex: keywordPattern(CSHARP_KEYWORDS) },
        { type: 'number', regex: /\b\d+\b/ },
        { type: 'function', regex: /\b[a-zA-Z_$]\w*(?=\()/ },
    ],
    yaml: [
        { type: 'comment', regex: /#.*/ },
        { type: 'string', regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
        { type: 'attr', regex: /[a-zA-Z0-9_-]{1,256}(?=:)/ },
        { type: 'keyword', regex: /\b(true|false|null|yes|no|on|off)\b/ },
        { type: 'number', regex: /\b\d+(\.\d+)?\b/ },
    ],
    sql: [
        // A block comment that closes on a later line is coloured to the end of
        // this one: lines are tokenized alone (rule 1).
        { type: 'comment', regex: /--.*|\/\*.*?(?:\*\/|$)/ },
        // A quote inside a string is written twice: 'It''s'.
        { type: 'string', regex: /'(?:[^']|'')*'/ },
        // Quoted identifiers: standard "double quotes" and MySQL `backticks`.
        { type: 'property', regex: /"(?:[^"]|"")*"|`[^`]*`/ },
        { type: 'keyword', regex: keywordPattern(SQL_KEYWORDS, 'i') },
        { type: 'number', regex: /\b\d+(?:\.\d+)?\b/ },
        { type: 'function', regex: /\b[a-zA-Z_]\w*(?=\()/ },
    ],
    bash: [
        { type: 'comment', regex: /#.*/ },
        { type: 'string', regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
        { type: 'keyword', regex: /\b(echo|ls|cd|pwd|mkdir|rm|cp|mv|touch|cat|grep|open|ssh|git|npm|node|ng|sudo|chmod|chown)\b/ },
        { type: 'decorator', regex: /\$\w+/ },
    ],
};

/**
 * Spellings an author writes in a fence that mean a language the table already
 * knows. A markdown fence carries whatever the author typed, and "ts" is far
 * more common than "typescript".
 */
const LANGUAGE_ALIASES: Readonly<Record<string, string>> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    py: 'python',
    'c#': 'csharp',
    cs: 'csharp',
    yml: 'yaml',
    sh: 'bash',
    shell: 'bash',
    zsh: 'bash',
    htm: 'html',
    svg: 'xml',
    scss: 'css',
    postgresql: 'sql',
    postgres: 'sql',
    pgsql: 'sql',
    mysql: 'sql',
    sqlite: 'sql',
};

/**
 * The key a language name is filed under in every per-language table: its
 * lowercase form, with a fence spelling (`ts`, `py`, `yml`…) mapped to the
 * language it means. Resolve it once and use it for every lookup, so an alias
 * gets its language's folding as well as its colours.
 */
export function canonicalLanguage(language: string): string {
    const key = language.toLowerCase();
    return LANGUAGE_ALIASES[key] ?? key;
}

/**
 * The rules for a language, or `null` when it is one this module does not know.
 *
 * `null` is a real answer, not a failure: see rule 2 in the module comment. The
 * caller decides what to do with it — `ui-code-block` substitutes TypeScript,
 * a document leaves the code alone.
 */
export function languagePatternsFor(language: string | null | undefined): LanguagePattern | null {
    if (!language) return null;
    return LANGUAGE_PATTERNS[canonicalLanguage(language)] ?? null;
}

/**
 * Tokenize ONE line. See rule 1 in the module comment: highlighting never spans
 * lines, so the caller splits and calls this per line.
 */
export function tokenizeLine(line: string, patterns: LanguagePattern): CodeToken[] {
    if (!line) return [];
    const tokens: CodeToken[] = [];
    const upcoming = new Array<PatternMatch | null | undefined>(patterns.length);
    let cursor = 0;

    while (cursor < line.length) {
        const best = earliestMatch(line, patterns, upcoming, cursor);
        if (!best) {
            tokens.push({ type: 'text', text: line.slice(cursor) });
            break;
        }
        if (best.index === cursor) {
            tokens.push({ type: best.type, text: best.text });
            cursor += best.text.length;
        } else {
            // Not straight on to the token: the match is decided again once the
            // cursor stands on it, because there it has no character before it
            // (see earliestMatch) and the answer can differ.
            tokens.push({ type: 'text', text: line.slice(cursor, best.index) });
            cursor = best.index;
        }
    }

    return tokens;
}

interface PatternMatch {
    readonly type: string;
    readonly text: string;
    readonly index: number;
}

/**
 * Two private clones of a caller's regex, so neither search mutates the caller's
 * own `lastIndex` and a caller regex that already carries `g` or `y` behaves
 * like any other: `forward` finds the next match anywhere after a position,
 * `atStart` tests for a match at the very start of a string.
 */
interface Searcher {
    readonly forward: RegExp;
    readonly atStart: RegExp;
}

const SEARCHERS = new WeakMap<RegExp, Searcher>();

function searcherOf(regex: RegExp): Searcher {
    let searcher = SEARCHERS.get(regex);
    if (!searcher) {
        const flags = regex.flags.replaceAll(/[gy]/g, '');
        searcher = { forward: new RegExp(regex.source, `${flags}g`), atStart: new RegExp(regex.source, `${flags}y`) };
        SEARCHERS.set(regex, searcher);
    }
    return searcher;
}

/**
 * The first non-empty match of `forward` at or after `from`, or `null`. An empty
 * match cannot advance the cursor, so it counts as "no match here" and the
 * search resumes one character on.
 */
function nextNonEmptyMatch(forward: RegExp, line: string, from: number): { text: string; index: number } | null {
    let start = from;
    while (start <= line.length) {
        forward.lastIndex = start;
        const match = forward.exec(line);
        if (!match) return null;
        if (match[0] !== '') return { text: match[0], index: match.index };
        start = match.index + 1;
    }
    return null;
}

/**
 * The match that starts first at or after `cursor`; the earlier pattern wins a
 * tie.
 *
 * Two searches per pattern give exactly the tokens of the quadratic tokenizer
 * this replaced, which matched against `line.slice(cursor)`:
 *
 * - AT the cursor the slice has no character before it, so `\b`, `^` and
 *   lookbehind read differently there than in the whole line (`5$foo(` has a
 *   boundary before the `$` in the line, none at the start of the slice). That
 *   spot is decided by testing the slice itself, for a match at its start.
 * - AFTER the cursor every position has the same characters before it either
 *   way (a lookbehind reaching back past the cursor into the slice's missing
 *   start is the one case that could differ, and no built-in pattern has one),
 *   so a forward search on the whole line is the same answer. It is made once
 *   and reused until the cursor reaches its start, which keeps the work for the
 *   built-in patterns linear in the line; a caller pattern whose attempts scan
 *   far and fail costs what it cost before.
 */
function earliestMatch(
    line: string,
    patterns: LanguagePattern,
    upcoming: (PatternMatch | null | undefined)[],
    cursor: number,
): PatternMatch | null {
    const rest = line.slice(cursor);
    let best: PatternMatch | null = null;
    for (const [i, pattern] of patterns.entries()) {
        const { forward, atStart } = searcherOf(pattern.regex);
        atStart.lastIndex = 0;
        const head = atStart.exec(rest);
        if (head && head[0] !== '') return { type: pattern.type, text: head[0], index: cursor };

        let match = upcoming[i];
        if (match === undefined || (match !== null && match.index <= cursor)) {
            const found = nextNonEmptyMatch(forward, line, cursor + 1);
            match = found && { type: pattern.type, ...found };
            upcoming[i] = match;
        }
        if (match && (best === null || match.index < best.index)) best = match;
    }
    return best;
}

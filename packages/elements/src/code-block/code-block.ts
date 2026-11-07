import { html, nothing, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { LANGUAGE_PATTERNS, canonicalLanguage, tokenizeLine, type CodeToken, type LanguagePattern } from '../shared/code-highlight.js';
import { BUILTIN_SCOPE_DETECTORS, type ScopeDetector, type ScopeRange } from '../shared/code-scopes.js';
import css from './code-block.css?inline';
import { resolveCodeBlockLocale, type CodeBlockLocale } from './code-block.locales.js';

/** Token type to CSS declarations (`color: red; font-weight: 700`). A type the theme leaves out keeps the built-in palette. */
export type CodeBlockTheme = Record<string, string>;
export interface LanguageConfig {
    patterns: LanguagePattern;
    scopes?: ScopeDetector;
}

interface RenderLine {
    index: number;
    tokens: CodeToken[];
    foldStart?: number;
    isOpen?: boolean;
}

const defaultTrue = { fromAttribute: (attribute: string | null): boolean => attribute !== 'false', toAttribute: (value: boolean) => (value ? null : 'false') };

const COPY_ICON = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>`;
const CHECK_ICON = html`<svg class="done" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>`;

export const CODE_BLOCK_THEMES: Record<string, CodeBlockTheme> = {
    vscode: {
        keyword: 'color: oklch(70.7% 0.165 254.624); font-weight: 700',
        string: 'color: oklch(83.7% 0.128 66.29)',
        comment: 'color: oklch(79.2% 0.209 151.711); font-style: italic',
        function: 'color: oklch(94.5% 0.129 101.54)',
        number: 'color: oklch(90.5% 0.093 164.15)',
        decorator: 'color: oklch(85.2% 0.199 91.936)',
        tag: 'color: oklch(70.7% 0.165 254.624)',
        attr: 'color: oklch(82.8% 0.111 230.318)',
        property: 'color: oklch(82.8% 0.111 230.318)',
    },
    dracula: {
        keyword: 'color: oklch(71.8% 0.202 349.761); font-weight: 700',
        string: 'color: oklch(94.5% 0.129 101.54)',
        comment: 'color: oklch(71.4% 0.203 305.504); font-style: italic',
        function: 'color: oklch(79.2% 0.209 151.711)',
        number: 'color: oklch(75% 0.183 55.934)',
        decorator: 'color: oklch(78.9% 0.154 211.53)',
        tag: 'color: oklch(71.8% 0.202 349.761)',
        attr: 'color: oklch(79.2% 0.209 151.711); font-style: italic',
        property: 'color: oklch(78.9% 0.154 211.53)',
    },
    github: {
        keyword: 'color: oklch(70.4% 0.191 22.216); font-weight: 700',
        string: 'color: oklch(88.2% 0.059 254.128)',
        comment: 'color: oklch(70.7% 0.022 261.325); font-style: italic',
        function: 'color: oklch(71.4% 0.203 305.504)',
        number: 'color: oklch(70.7% 0.165 254.624)',
        decorator: 'color: oklch(75% 0.183 55.934)',
        tag: 'color: oklch(79.2% 0.209 151.711)',
        attr: 'color: oklch(71.4% 0.203 305.504)',
        property: 'color: oklch(80.9% 0.105 251.813)',
    },
    monokai: {
        keyword: 'color: oklch(65.6% 0.241 354.308); font-weight: 700',
        string: 'color: oklch(90.5% 0.182 98.111)',
        comment: 'color: oklch(70.7% 0.022 261.325); font-style: italic',
        function: 'color: oklch(79.2% 0.209 151.711)',
        number: 'color: oklch(71.4% 0.203 305.504)',
        decorator: 'color: oklch(75% 0.183 55.934)',
        tag: 'color: oklch(65.6% 0.241 354.308)',
        attr: 'color: oklch(79.2% 0.209 151.711); font-style: italic',
        property: 'color: oklch(78.9% 0.154 211.53)',
    },
};

/**
 * A syntax-highlighted code viewer with a copy button, optional line numbers and optional folding.
 * The surface is dark in both themes. Highlighting is per line, so a multi-line string or block comment is coloured line by line.
 *
 * @attr {string} code - Source text.
 * @attr {string} language - Highlighter key (`typescript`, `javascript`, `python`, `java`, `csharp`, `html`, `xml`, `css`, `json`, `yaml`, `bash`, `sql` and their fence aliases). Unknown keys fall back to TypeScript.
 * @attr {boolean} line-numbers - Shows the gutter; `line-numbers="false"` hides it.
 * @attr {boolean} collapse-scope - Enables fold chevrons on brace, bracket, tag and indent scopes.
 * @attr {number} default-collapsed - Folds every scope at this depth or deeper on load (`0` folds all).
 * @attr {string} locale - Locale id or object; defaults to the page's `lang`, then `en`.
 * @prop {CodeBlockTheme | null} theme - Per-token-type CSS declarations; see CODE_BLOCK_THEMES.
 * @prop {Record<string, LanguagePattern | LanguageConfig> | null} customLanguages - Extra or replacement languages keyed by lowercase name.
 * @csspart base - The outer surface.
 */
export class GeCodeBlock extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        code: {},
        language: {},
        theme: { attribute: false },
        customLanguages: { attribute: false },
        collapseScope: { type: Boolean, attribute: 'collapse-scope', reflect: true },
        defaultCollapsed: { type: Number, attribute: 'default-collapsed' },
        lineNumbers: { attribute: 'line-numbers', converter: defaultTrue },
        locale: {},
        copied: { state: true },
        collapsed: { state: true },
    };

    declare code: string;
    declare language: string;
    declare theme: CodeBlockTheme | null;
    declare customLanguages: Record<string, LanguagePattern | LanguageConfig> | null;
    declare collapseScope: boolean;
    declare defaultCollapsed: number | undefined;
    declare lineNumbers: boolean;
    declare locale: string | CodeBlockLocale;
    declare copied: boolean;
    declare collapsed: ReadonlySet<number>;

    private copiedTimer: ReturnType<typeof setTimeout> | undefined;

    constructor() {
        super();
        this.code = '';
        this.language = 'typescript';
        this.theme = null;
        this.customLanguages = null;
        this.collapseScope = false;
        this.defaultCollapsed = undefined;
        this.lineNumbers = true;
        this.locale = '';
        this.copied = false;
        this.collapsed = new Set();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        clearTimeout(this.copiedTimer);
    }

    private get t(): CodeBlockLocale {
        return resolveCodeBlockLocale(this.locale);
    }

    private resolveLanguage(): { patterns: LanguagePattern; scopes?: ScopeDetector } {
        const requested = this.language.toLowerCase();
        const custom = this.customLanguages;
        // The alias is resolved once and used for every lookup, so `yml` folds as well as it colours.
        const key = custom?.[requested] ? requested : canonicalLanguage(requested);
        const entry = custom?.[key];
        if (entry) {
            const config = Array.isArray(entry) ? { patterns: entry } : entry;
            return { patterns: config.patterns, scopes: config.scopes ?? BUILTIN_SCOPE_DETECTORS[key] };
        }
        // A viewer's documented fallback: an unknown key still gets colour.
        return { patterns: LANGUAGE_PATTERNS[key] ?? LANGUAGE_PATTERNS['typescript'] ?? [], scopes: BUILTIN_SCOPE_DETECTORS[key] };
    }

    private scopes(): ScopeRange[] {
        if (!this.collapseScope) return [];
        const detector = this.resolveLanguage().scopes;
        return detector ? detector(this.code.split('\n')) : [];
    }

    protected override willUpdate(changed: PropertyValues<GeCodeBlock>): void {
        if (!(['defaultCollapsed', 'collapseScope', 'code', 'language', 'customLanguages'] as const).some((name) => changed.has(name))) return;
        const depth = this.defaultCollapsed;
        if (depth === undefined || Number.isNaN(depth) || !this.collapseScope) {
            this.collapsed = new Set();
            return;
        }
        this.collapsed = new Set(this.scopes().filter((scope) => scope.depth >= depth).map((scope) => scope.startLine));
    }

    private visibleLines(lines: CodeToken[][]): RenderLine[] {
        const scopesByStart = new Map<number, ScopeRange>();
        for (const scope of this.scopes()) scopesByStart.set(scope.startLine, scope);
        const result: RenderLine[] = [];
        let skipUntil = -1;
        lines.forEach((tokens, index) => {
            if (index <= skipUntil) return;
            const scope = scopesByStart.get(index);
            const isOpen = scope ? !this.collapsed.has(index) : undefined;
            result.push({ index, tokens, foldStart: scope ? index : undefined, isOpen });
            if (scope && !isOpen) skipUntil = scope.endLine;
        });
        return result;
    }

    /**
     * Copies the full `code`, folded lines included, and flips the button to its "copied" state for two seconds.
     * A no-op where the Clipboard API is unavailable (non-secure origins).
     */
    async copyToClipboard(): Promise<void> {
        if (!navigator.clipboard) return;
        await navigator.clipboard.writeText(this.code);
        this.copied = true;
        clearTimeout(this.copiedTimer);
        this.copiedTimer = setTimeout(() => {
            this.copied = false;
        }, 2000);
    }

    /** Folds or unfolds the scope beginning at the given line index. */
    toggleScope(startLine: number): void {
        const next = new Set(this.collapsed);
        if (!next.delete(startLine)) next.add(startLine);
        this.collapsed = next;
    }

    /** Whether the scope starting at this line is currently folded. */
    isCollapsed(startLine: number): boolean {
        return this.collapsed.has(startLine);
    }

    private token(token: CodeToken) {
        const themed = this.theme?.[token.type];
        if (themed) return html`<span style=${themed}>${token.text}</span>`;
        return html`<span class=${`tok-${token.type}`}>${token.text}</span>`;
    }

    private onChevronKey(event: KeyboardEvent, startLine: number): void {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this.toggleScope(startLine);
    }

    private chevron(line: RenderLine, t: CodeBlockLocale) {
        const start = line.foldStart;
        if (start === undefined) return html`<span class="chevron" data-slot="code-block-chevron"></span>`;
        return html`<span
            class="chevron fold"
            role="button"
            tabindex="0"
            aria-expanded=${String(line.isOpen)}
            aria-label=${line.isOpen ? t.collapseScope : t.expandScope}
            data-slot="code-block-chevron"
            @click=${() => this.toggleScope(start)}
            @keydown=${(event: KeyboardEvent) => this.onChevronKey(event, start)}
            >${line.isOpen ? '▾' : '▸'}</span
        >`;
    }

    private row(line: RenderLine, width: string, t: CodeBlockLocale) {
        return html`<div class="line">${this.lineNumbers
                ? html`<span class="number" style=${`width:${width}`} data-slot="code-block-line-number" aria-hidden="true">${line.index + 1}</span>`
                : nothing}${this.collapseScope ? this.chevron(line, t) : nothing}<span class="text">${line.tokens.map((token) => this.token(token))}${line.foldStart !== undefined && !line.isOpen
                ? html`<span class="marker" data-slot="code-block-collapsed-marker">…</span>`
                : nothing}</span></div>`;
    }

    protected override render() {
        const t = this.t;
        const patterns = this.resolveLanguage().patterns;
        const lines = this.code ? this.code.split('\n').map((text) => tokenizeLine(text, patterns)) : [];
        const digits = lines.length > 0 ? Math.floor(Math.log10(lines.length)) + 1 : 1;
        return html`<div class="root" part="base" data-slot="code-block" dir=${t.rtl ? 'rtl' : 'ltr'}>
            <div class="header">
                <span class="language">${this.language}</span>
                <ge-button variant="ghost" size="icon" aria-label=${this.copied ? t.copied : t.copy} @click=${this.copyToClipboard}>${this.copied ? CHECK_ICON : COPY_ICON}</ge-button>
            </div>
            <div dir="ltr" class="body"><pre><code class=${`language-${this.language}`}>${this.visibleLines(lines).map((line) => this.row(line, `${digits}ch`, t))}</code></pre></div>
        </div>`;
    }
}

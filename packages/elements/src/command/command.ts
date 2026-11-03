import { html, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren } from '../shared/compound.js';
import type { CommandPage, CommandResult, CommandSource } from './command.types.js';
import { readRecentValues, unshiftUniqueValue, writeRecentValues } from './command.utils.js';
import css from './command.css?inline';

export const COMMAND_REGISTER = 'ge-command-register';

/** A part that re-renders when the palette's state changes. */
export interface CommandPart extends HTMLElement {
    requestUpdate(): void;
}

/** A row, as the palette sees it. */
export interface CommandRow extends CommandPart {
    readonly value: string;
}

/** What the parts of a palette need from it. */
export interface CommandHost {
    readonly query: string;
    readonly currentPage: CommandPage | null;
    /** The rows that pass the filter, in registration order. */
    visibleRows(): CommandRow[];
    isVisible(row: CommandRow): boolean;
    isActive(row: CommandRow): boolean;
    setSearch(value: string): void;
    setActive(row: CommandRow | undefined): void;
    moveNext(): void;
    movePrev(): void;
    selectActive(): void;
    markRecent(value: string): void;
    popPage(): boolean;
    register(part: CommandPart): void;
    unregister(part: CommandPart): void;
    registerRow(row: CommandRow): void;
    unregisterRow(row: CommandRow): void;
}

/**
 * A command palette: a search field over a list of rows that filters as you type. The arrow keys move a highlight
 * that is independent of focus (focus stays in the field), Enter activates the highlighted row, and the filter
 * hides rows, and groups with no rows left, whose `value` does not contain the query.
 *
 * Beyond filtering what you project, it can fetch rows (`source`), remember what was picked (`recent-key`) and
 * drill into pages (`pushPage`). Because there are no signals to read, changes to the results, loading state,
 * error, recents and page are announced with `state-change`.
 *
 * @slot - `ge-command-input` and `ge-command-list`.
 * @fires state-change - When `results`, `loading`, `sourceError`, `recents` or `page` changed.
 * @attr {string} search - Controlled query. Any non-null value is pushed into the field every time it changes.
 * @attr {boolean} no-filter - Show every row whatever the query; use it when you filter yourself or `source` already does.
 * @attr {number} debounce - Milliseconds of quiet typing before `source` is called. `0` calls it on every keystroke. Defaults to 200.
 * @attr {string} recent-key - localStorage key for the recent list. Without one the list lives in memory.
 * @attr {number} recent-limit - How many recent values to keep. Defaults to 5.
 * @cssprop --density-menu - Size multiplier for rows; falls back to `--density`.
 */
export class GeCommand extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        search: {},
        noFilter: { type: Boolean, attribute: 'no-filter', reflect: true },
        source: { attribute: false },
        debounce: { type: Number },
        recentKey: { attribute: 'recent-key' },
        recentLimit: { type: Number, attribute: 'recent-limit' },
    };

    declare search: string | null;
    declare noFilter: boolean;
    /** Async row provider. Without one the palette only filters what you project. */
    declare source: CommandSource | null;
    declare debounce: number;
    declare recentKey: string | null;
    declare recentLimit: number;

    private text = '';
    private active?: CommandRow;
    private readonly rows = new Set<CommandRow>();
    private readonly parts = new Set<CommandPart>();
    private resultsNow: readonly CommandResult[] = [];
    private loadingNow = false;
    private errorNow: unknown = null;
    private recentNow: readonly string[] = [];
    private stack: readonly CommandPage[] = [];
    private token = 0;
    private timer?: ReturnType<typeof setTimeout>;
    private controller?: AbortController;

    constructor() {
        super();
        this.search = null;
        this.noFilter = false;
        this.source = null;
        this.debounce = 200;
        this.recentKey = null;
        this.recentLimit = 5;
        adoptChildren<CommandHost, CommandPart>(this, COMMAND_REGISTER, (part) => this.register(part));
    }

    /** The text in the search field. */
    get query(): string {
        return this.text;
    }

    /** Rows from the latest non-stale `source` call. `[]` when there is no source. */
    get results(): readonly CommandResult[] {
        return this.resultsNow;
    }

    /** True while a `source` query is scheduled or in flight. */
    get loading(): boolean {
        return this.loadingNow;
    }

    /** What the last `source` call threw, or `null`. */
    get sourceError(): unknown {
        return this.errorNow;
    }

    /** Recently selected values, newest first. */
    get recents(): readonly string[] {
        return this.recentNow;
    }

    /** True when the query is empty and there is at least one recent value: the cue to render a "Recent" group. */
    get showRecents(): boolean {
        return this.text.trim() === '' && this.recentNow.length > 0;
    }

    /** The drill-down page stack, root first. Empty at the top level. */
    get pages(): readonly CommandPage[] {
        return this.stack;
    }

    /** The page shown now, or `null` at the top level. */
    get currentPage(): CommandPage | null {
        return this.stack.at(-1) ?? null;
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.cancelQuery();
    }

    register(part: CommandPart): void {
        this.parts.add(part);
    }

    unregister(part: CommandPart): void {
        this.parts.delete(part);
        this.unregisterRow(part as CommandRow);
    }

    registerRow(row: CommandRow): void {
        this.rows.add(row);
        this.requestUpdate();
    }

    unregisterRow(row: CommandRow): void {
        if (this.rows.delete(row)) this.requestUpdate();
    }

    visibleRows(): CommandRow[] {
        const query = this.text.toLowerCase().trim();
        return [...this.rows].filter((row) => this.noFilter || !query || row.value.toLowerCase().includes(query));
    }

    isVisible(row: CommandRow): boolean {
        return this.visibleRows().includes(row);
    }

    isActive(row: CommandRow): boolean {
        return this.active === row;
    }

    setActive(row: CommandRow | undefined): void {
        this.active = row;
        this.requestUpdate();
    }

    /** Publishes `value` as the query. */
    setSearch(value: string): void {
        if (this.text === value) return;
        this.text = value;
        this.scheduleQuery();
        this.requestUpdate();
    }

    /** Moves the highlight to the next visible row, wrapping. A disabled row is not skipped; Enter on it does nothing. */
    moveNext(): void {
        const rows = this.visibleRows();
        if (rows.length === 0) return;
        this.setActive(rows[((this.active ? rows.indexOf(this.active) : -1) + 1) % rows.length]);
    }

    /** Moves the highlight to the previous visible row, wrapping. With nothing highlighted it starts at the last row. */
    movePrev(): void {
        const rows = this.visibleRows();
        if (rows.length === 0) return;
        const index = this.active ? rows.indexOf(this.active) : -1;
        this.setActive(rows[index <= 0 ? rows.length - 1 : index - 1]);
    }

    /** Activates the highlighted row, as Enter does. */
    selectActive(): void {
        if (this.active && this.isVisible(this.active)) (this.active as CommandRow & { activate?(): void }).activate?.();
    }

    /** Records `value` as recently used: newest first, without repeats, capped at `recent-limit`, saved when `recent-key` is set. */
    markRecent(value: string): void {
        if (!value) return;
        this.recentNow = unshiftUniqueValue(this.recentNow, value, this.recentLimit);
        writeRecentValues(this.recentKey, this.recentNow);
        this.announce();
    }

    /** Empties the recent list and its saved copy. */
    clearRecents(): void {
        this.recentNow = [];
        writeRecentValues(this.recentKey, []);
        this.announce();
    }

    /** Opens a nested page. The query is cleared so the new level starts unfiltered. */
    pushPage(page: CommandPage): void {
        this.stack = [...this.stack, page];
        this.leavePage();
    }

    /** Returns to the parent page; `false` when already at the top level. */
    popPage(): boolean {
        if (this.stack.length === 0) return false;
        this.stack = this.stack.slice(0, -1);
        this.leavePage();
        return true;
    }

    /** Returns to the top level from any depth. */
    resetPages(): void {
        if (this.stack.length === 0) return;
        this.stack = [];
        this.leavePage();
    }

    private leavePage(): void {
        this.setSearch('');
        this.active = undefined;
        this.announce();
        this.requestUpdate();
    }

    private announce(): void {
        this.dispatchEvent(new CustomEvent('state-change', { bubbles: true, composed: true }));
        this.requestUpdate();
    }

    private scheduleQuery(): void {
        this.cancelQuery();
        const token = ++this.token;
        const source = this.source;
        if (!source) {
            this.resultsNow = [];
            this.loadingNow = false;
            this.errorNow = null;
            return;
        }
        this.loadingNow = true;
        const query = this.text;
        if (this.debounce <= 0) {
            void this.runQuery(source, query, token);
            return;
        }
        this.timer = setTimeout(() => {
            this.timer = undefined;
            void this.runQuery(source, query, token);
        }, this.debounce);
        this.announce();
    }

    private async runQuery(source: CommandSource, query: string, token: number): Promise<void> {
        const controller = new AbortController();
        this.controller = controller;
        try {
            const rows = await source(query, controller.signal);
            if (token !== this.token) return;
            this.resultsNow = rows;
            this.errorNow = null;
        } catch (error) {
            if (token !== this.token) return;
            this.resultsNow = [];
            this.errorNow = error;
        } finally {
            if (token === this.token) {
                this.loadingNow = false;
                this.announce();
            }
        }
    }

    private cancelQuery(): void {
        clearTimeout(this.timer);
        this.timer = undefined;
        this.controller?.abort();
        this.controller = undefined;
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('search') && this.search !== null) this.setSearch(this.search);
        if (changed.has('recentKey') && this.recentKey !== null) {
            this.recentNow = readRecentValues(this.recentKey, this.recentLimit);
            this.dispatchEvent(new CustomEvent('state-change', { bubbles: true, composed: true }));
        }
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('source') || changed.has('debounce')) this.scheduleQuery();
        // A highlight on a row the filter just hid would otherwise point at nothing.
        const visible = this.visibleRows();
        if (this.active && !visible.includes(this.active)) this.active = visible[0];
        for (const part of this.parts) part.requestUpdate();
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}

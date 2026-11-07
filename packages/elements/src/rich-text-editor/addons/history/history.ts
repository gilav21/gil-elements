import { html, nothing, svg, type TemplateResult } from 'lit';
import { live } from 'lit/directives/live.js';
import { defineAddon, resolveAddonLocale } from '../../rich-text-addon-kit.js';
import type { RichTextAddonHost, RichTextAddonOptions, RichTextHistoryEntrySnapshot } from '../../rich-text-host.js';
import type { Disposables } from '../../rich-text-registry.js';
import { RICH_TEXT_HISTORY_LOCALES, type RichTextHistoryLocale } from './history-locale.js';
import css from './history.css?inline';

const SHORTCUT_ACTION = 'rich-text.history';
const ENTRY_ACTION = '[data-history-entry-action="true"]';
const CLOSE_ICON = svg`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>`;

type ListKind = 'popover' | 'dialog';

export interface RichTextHistoryOptions extends RichTextAddonOptions {
    /** A locale id (`'he'`) or a full dictionary; defaults to the editor's locale. */
    readonly locale?: string | RichTextHistoryLocale;
}

interface PreviewEntry {
    readonly index: number;
    readonly markdown: string;
    readonly timestamp: number;
    readonly content: DocumentFragment;
}

const interpolate = (template: string, values: Record<string, string | number>): string =>
    template.replaceAll(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));

/**
 * The revision-history UI over the editor's undo stack: the corner button with its revision list, a preview dialog
 * that restores after confirmation, and a browser dialog for when the button is hidden. It holds UI state only.
 */
export class HistoryPanel {
    panelOpen = false;
    previewOpen = false;
    browserOpen = false;
    lastApplied: number | null = null;
    selected: PreviewEntry | null = null;

    constructor(
        private readonly host: RichTextAddonHost,
        private readonly locale: RichTextHistoryLocale,
        private readonly showButton: boolean,
        private readonly life: Disposables,
    ) {}

    /** Newest first, with the entry the editor is at marked active. */
    timeline(): (RichTextHistoryEntrySnapshot & { active: boolean })[] {
        const current = this.host.currentHistoryIndex();
        return this.host.historyEntries().map((entry) => ({ ...entry, active: entry.index === current })).reverse();
    }

    private get inert(): boolean {
        return this.host.isDisabled || this.host.readonly;
    }

    onPanelOpenChange(next: boolean): void {
        if (!next && this.previewOpen) {
            this.set({ panelOpen: true });
            return;
        }
        if (next && this.inert) {
            this.set({ panelOpen: false });
            return;
        }
        if (next) {
            this.host.flushPendingHistoryPush();
            this.focusFirstActionSoon('popover');
        }
        this.set({ panelOpen: next });
    }

    /** Popover when the button is visible, browser dialog otherwise. */
    openFromShortcut(): void {
        if (this.inert) return;
        this.host.flushPendingHistoryPush();
        if (this.showButton) {
            this.onPanelOpenChange(true);
            return;
        }
        this.set({ browserOpen: true });
        this.focusFirstActionSoon('dialog');
    }

    openPreview(index: number, event?: Event): void {
        event?.stopPropagation();
        if (index < 0 || index >= this.host.historyEntries().length) return;
        this.selected = this.buildPreview(index);
        this.set({ browserOpen: false, previewOpen: true });
    }

    quickApply(index: number, target: HTMLElement | null): void {
        const list = target ? this.listKind(target) : null;
        this.apply(index);
        if (list) this.focusEntrySoon(list, index);
    }

    onEntryKeydown(event: KeyboardEvent, index: number): void {
        const current = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
        if (!current) return;
        const list = this.listKind(current);
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
            event.preventDefault();
            this.quickApply(index, current);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            if (list === 'popover') this.set({ panelOpen: false });
            else if (list === 'dialog') this.set({ browserOpen: false });
        } else {
            this.moveFocus(event, current);
        }
    }

    restoreFromPreview(): void {
        if (!this.selected) return;
        this.apply(this.selected.index);
        this.set({ previewOpen: false });
    }

    closePanel(): void {
        this.set({ panelOpen: false });
    }

    closePreview(): void {
        this.set({ previewOpen: false });
    }

    closeBrowser(): void {
        this.set({ browserOpen: false });
    }

    render(): TemplateResult {
        return html`${this.renderCorner()}${this.renderPreview()}${this.renderBrowser()}`;
    }

    private set(state: Partial<Pick<HistoryPanel, 'panelOpen' | 'previewOpen' | 'browserOpen'>>): void {
        Object.assign(this, state);
        this.host.invalidate();
    }

    private buildPreview(index: number): PreviewEntry | null {
        const rebuilt = this.host.reconstructHistoryEntry(index);
        const entry = this.host.historyEntries()[index];
        if (!rebuilt || !entry) return null;
        return { index, markdown: rebuilt.markdown, timestamp: entry.timestamp, content: this.host.sanitizer.sanitizeToFragment(rebuilt.html) };
    }

    private apply(index: number): void {
        if (index < 0 || index >= this.host.historyEntries().length) return;
        this.host.restoreHistoryEntry(index);
        this.lastApplied = index;
        this.host.emit('history-restore', index);
        this.host.invalidate();
    }

    private get root(): ParentNode {
        return this.host.element.shadowRoot ?? this.host.element;
    }

    private listKind(from: HTMLElement): ListKind | null {
        const kind = from.closest<HTMLElement>('[data-history-list]')?.dataset['historyList'];
        return kind === 'popover' || kind === 'dialog' ? kind : null;
    }

    private moveFocus(event: KeyboardEvent, current: HTMLElement): void {
        const entries = [...(current.closest('[data-history-list]')?.querySelectorAll<HTMLElement>(ENTRY_ACTION) ?? [])];
        const at = entries.indexOf(current);
        const targets: Record<string, HTMLElement | undefined> = {
            ArrowDown: entries[Math.min(entries.length - 1, at + 1)],
            ArrowUp: entries[Math.max(0, at - 1)],
            Home: entries[0],
            End: entries.at(-1),
        };
        if (at < 0 || !Object.hasOwn(targets, event.key)) return;
        event.preventDefault();
        targets[event.key]?.focus();
    }

    private focusFirstActionSoon(list: ListKind): void {
        const attempt = (count: number): void => {
            const first = this.root.querySelector<HTMLElement>(`[data-history-list="${list}"] ${ENTRY_ACTION}`);
            if (first) first.focus();
            else if (count < 4) this.life.timeout(() => attempt(count + 1), 16);
        };
        this.life.timeout(() => attempt(0), 24);
    }

    private focusEntrySoon(list: ListKind, index: number): void {
        this.life.timeout(() => this.root.querySelector<HTMLElement>(`[data-history-list="${list}"] [data-history-entry-index="${index}"]`)?.focus(), 0);
    }

    private time(timestamp: number): string {
        return new Date(timestamp).toLocaleTimeString(this.locale.code, { hour12: false });
    }

    private renderCorner(): TemplateResult | typeof nothing {
        const { locale } = this;
        if (this.host.readonly || !this.showButton) return nothing;
        return html`<div class="history-corner" data-slot="rte-history-panel">
            <ge-popover .open=${live(this.panelOpen)} @open-change=${(event: CustomEvent<boolean>) => this.onPanelOpenChange(event.detail)}>
                <ge-popover-trigger>
                    <ge-button
                        type="button"
                        variant="outline"
                        size="sm"
                        title="Ctrl/Cmd + Shift + H"
                        aria-label=${locale.ariaOpen}
                        ?disabled=${this.host.isDisabled}
                    >${interpolate(locale.button, { count: this.host.historyEntries().length })}</ge-button>
                </ge-popover-trigger>
                <ge-popover-content class="history-popover" align="end" side="bottom" no-restore-focus>
                    <div class="history-head">
                        <span>${locale.title}</span>
                        <button type="button" class="history-close" aria-label=${locale.ariaClose} @click=${() => this.closePanel()}>${CLOSE_ICON}</button>
                    </div>
                    ${this.renderList('popover')}
                </ge-popover-content>
            </ge-popover>
        </div>`;
    }

    private renderList(list: ListKind): TemplateResult {
        const { locale } = this;
        return html`<div class="history-list" data-history-list=${list}>
            ${this.timeline().map((entry) => html`<div
                role="button"
                tabindex="0"
                class="history-entry"
                ?data-active=${entry.active}
                data-history-entry-action="true"
                data-history-entry-index=${entry.index}
                aria-label=${interpolate(locale.ariaApply, { index: entry.index + 1 })}
                @click=${(event: Event) => this.quickApply(entry.index, event.currentTarget as HTMLElement)}
                @keydown=${(event: KeyboardEvent) => this.onEntryKeydown(event, entry.index)}
            >
                <div class="history-entry-head">
                    <span class="history-revision">${interpolate(locale.revision, { index: entry.index + 1 })}</span>
                    <div class="history-entry-meta">
                        ${this.lastApplied === entry.index ? html`<span class="history-applied">${locale.applied}</span>` : nothing}
                        <span class="history-time">${this.time(entry.timestamp)}</span>
                        <button
                            type="button"
                            class="history-preview-button"
                            @click=${(event: Event) => this.openPreview(entry.index, event)}
                            @keydown=${(event: KeyboardEvent) => this.previewKeydown(event, entry.index)}
                        >${locale.preview}</button>
                    </div>
                </div>
                <div class="history-lines">
                    ${entry.previewLines.map((line) => html`<p>${line}</p>`)}
                    ${entry.lineCount > entry.previewLines.length
                        ? html`<p class="history-more">${interpolate(locale.moreLines, { count: entry.lineCount - entry.previewLines.length })}</p>`
                        : nothing}
                </div>
            </div>`)}
        </div>`;
    }

    // Enter and Space on the preview button must not bubble into the row's own apply handler.
    private previewKeydown(event: KeyboardEvent, index: number): void {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this.openPreview(index, event);
    }

    private renderPreview(): TemplateResult {
        const { locale, selected } = this;
        return html`<ge-dialog .open=${live(this.previewOpen)} @open-change=${(event: CustomEvent<boolean>) => this.set({ previewOpen: event.detail })}>
            <ge-dialog-content class="history-preview" close-label=${locale.close}>
                ${selected
                    ? html`<ge-dialog-header class="history-header">
                            <ge-dialog-title>${interpolate(locale.revision, { index: selected.index + 1 })}</ge-dialog-title>
                            <ge-dialog-description>${interpolate(locale.capturedAt, { time: new Date(selected.timestamp).toLocaleString(locale.code, { dateStyle: 'medium', timeStyle: 'medium' }) })}</ge-dialog-description>
                        </ge-dialog-header>
                        <div class="history-body">
                            <section class="history-section">
                                <h3>${locale.renderedPreview}</h3>
                                <div class="history-rendered">${selected.content}</div>
                            </section>
                            <section class="history-section">
                                <h3>${locale.markdownSnapshot}</h3>
                                <pre class="history-markdown">${selected.markdown}</pre>
                            </section>
                        </div>
                        <div class="history-footer">
                            <ge-button variant="outline" @click=${() => this.closePreview()}>${locale.cancel}</ge-button>
                            <ge-button @click=${() => this.restoreFromPreview()}>${locale.restore}</ge-button>
                        </div>`
                    : nothing}
            </ge-dialog-content>
        </ge-dialog>`;
    }

    private renderBrowser(): TemplateResult {
        const { locale } = this;
        return html`<ge-dialog .open=${live(this.browserOpen)} @open-change=${(event: CustomEvent<boolean>) => this.set({ browserOpen: event.detail })}>
            <ge-dialog-content class="history-browser" close-label=${locale.close}>
                <ge-dialog-header class="history-header">
                    <ge-dialog-title>${locale.title}</ge-dialog-title>
                    <ge-dialog-description>${locale.browserDescription}</ge-dialog-description>
                </ge-dialog-header>
                ${this.renderList('dialog')}
                <div class="history-footer">
                    <ge-button variant="outline" @click=${() => this.closeBrowser()}>${locale.close}</ge-button>
                </div>
            </ge-dialog-content>
        </ge-dialog>`;
    }
}

export const historyAddon = defineAddon<RichTextHistoryOptions>('history', 0, ({ host, options, life }) => {
    const locale = resolveAddonLocale(RICH_TEXT_HISTORY_LOCALES, host, options.locale);
    const panel = new HistoryPanel(host, locale, options.toolbar, life);
    life.add(host.adoptStyles(css, 'shadow'));
    life.add(host.overlays.register({ id: 'history', render: () => panel.render() }));
    life.add(host.registerShortcutAction(SHORTCUT_ACTION, () => panel.openFromShortcut()));
    life.add(host.subscribe('history', () => host.invalidate()));
});

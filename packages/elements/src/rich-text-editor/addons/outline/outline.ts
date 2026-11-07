import { html, svg, type TemplateResult } from 'lit';
import { defineAddon, resolveAddonLocale } from '../../rich-text-addon-kit.js';
import type { RichTextAddonHost, RichTextAddonOptions } from '../../rich-text-host.js';
import { RICH_TEXT_OUTLINE_LOCALES, type RichTextOutlineLocale } from './outline-locale.js';
import css from './outline.css?inline';

const HEADING_SELECTOR = 'h1,h2,h3,h4,h5,h6';
/** Gap in pixels left above a heading when the outline scrolls it into view. */
const SCROLL_MARGIN = 12;
const INSET_ATTRIBUTE = 'data-outline-open';
const INSET_CSS = `
ge-rich-text-editor > [data-slot='editor'][${INSET_ATTRIBUTE}] { transition: padding 150ms; }
@media (min-width: 768px) { ge-rich-text-editor > [data-slot='editor'][${INSET_ATTRIBUTE}] { padding-inline-start: calc(16rem + 8px); } }
@media (min-width: 1024px) { ge-rich-text-editor > [data-slot='editor'][${INSET_ATTRIBUTE}] { padding-inline-start: calc(20rem + 8px); } }
`;
const OUTLINE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 6H3"/><path d="M15 12H3"/><path d="M17 18H3"/><path d="M21 12h.01"/><path d="M21 18h.01"/></svg>';
const CLOSE_ICON = svg`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>`;

export interface RichTextOutlineOptions extends RichTextAddonOptions {
    /** A locale id (`'he'`) or a full dictionary; defaults to the editor's locale. */
    readonly locale?: string | RichTextOutlineLocale;
}

export interface OutlineHeading {
    /** 1-6, from the tag name. */
    readonly level: number;
    readonly text: string;
    /** Position among the document's headings. */
    readonly index: number;
}

let instances = 0;

/** The docked table of contents: lists the headings, follows the content with a MutationObserver while open, and insets the editable beside it. */
export class OutlinePanel {
    headings: readonly OutlineHeading[] = [];
    private opened = false;
    private observer: MutationObserver | null = null;
    private readonly titleId = `rte-outline-title-${++instances}`;

    constructor(private readonly host: RichTextAddonHost, private readonly locale: RichTextOutlineLocale) {}

    get isOpen(): boolean {
        return this.opened;
    }

    toggle(): void {
        if (this.opened) this.close();
        else this.open();
    }

    open(): void {
        if (this.opened) return;
        this.opened = true;
        this.refresh();
        const root = this.host.contentRoot;
        root.setAttribute(INSET_ATTRIBUTE, '');
        this.observer = new MutationObserver(() => {
            this.refresh();
            this.host.invalidate();
        });
        this.observer.observe(root, { childList: true, subtree: true, characterData: true });
        this.host.invalidate();
    }

    close(): void {
        if (!this.opened) return;
        this.release();
        this.host.invalidate();
    }

    /** Stops observing and removes the inset without asking the editor to render. */
    release(): void {
        this.opened = false;
        this.observer?.disconnect();
        this.observer = null;
        this.host.contentRoot.removeAttribute(INSET_ATTRIBUTE);
    }

    /** Scrolls the editable itself, never the page or an ancestor. */
    scrollTo(index: number): void {
        const root = this.host.contentRoot;
        const target = root.querySelectorAll<HTMLElement>(HEADING_SELECTOR)[index];
        if (!target) return;
        const delta = target.getBoundingClientRect().top - root.getBoundingClientRect().top;
        root.scrollBy({ top: delta - SCROLL_MARGIN, behavior: 'smooth' });
    }

    render(): TemplateResult {
        if (!this.opened) return html``;
        const { locale } = this;
        return html`<nav class="outline-panel" data-slot="rich-text-outline-panel" aria-labelledby=${this.titleId}>
            <div class="outline-header">
                <h2 class="outline-title" id=${this.titleId}>${locale.title}</h2>
                <button type="button" class="outline-close" aria-label=${locale.ariaClose} @click=${() => this.close()}>${CLOSE_ICON}</button>
            </div>
            <div class="outline-body">${this.headings.length === 0 ? this.renderEmpty() : this.renderList()}</div>
        </nav>`;
    }

    private renderEmpty(): TemplateResult {
        return html`<p class="outline-empty" data-slot="rich-text-outline-empty">${this.locale.empty}</p>`;
    }

    private renderList(): TemplateResult {
        return html`<ol class="outline-list" data-slot="rich-text-outline-list">
            ${this.headings.map((heading) => html`<li>
                <button
                    type="button"
                    class="outline-entry"
                    data-outline-entry="true"
                    data-outline-level=${heading.level}
                    style=${`padding-inline-start: ${0.5 + (heading.level - 1) * 0.75}rem`}
                    @click=${() => this.scrollTo(heading.index)}
                    @keydown=${(event: KeyboardEvent) => this.onEntryKeydown(event, heading.index)}
                >${heading.text}</button>
            </li>`)}
        </ol>`;
    }

    private onEntryKeydown(event: KeyboardEvent, index: number): void {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this.scrollTo(index);
    }

    private refresh(): void {
        this.headings = Array.from(this.host.contentRoot.querySelectorAll(HEADING_SELECTOR), (element, index) => ({
            level: Number.parseInt(element.tagName.slice(1), 10),
            text: (element.textContent ?? '').trim(),
            index,
        }));
    }
}

export const outlineAddon = defineAddon<RichTextOutlineOptions>('outline', 900, ({ host, options, life }) => {
    const locale = resolveAddonLocale(RICH_TEXT_OUTLINE_LOCALES, host, options.locale);
    const panel = new OutlinePanel(host, locale);
    life.add(host.adoptStyles(css, 'shadow'));
    life.add(host.adoptStyles(INSET_CSS, 'document'));
    life.add(host.overlays.register({ id: 'outline', render: () => panel.render() }));
    life.add(() => panel.release());
    if (options.toolbar) {
        life.add(host.toolbarSlots.register({
            id: 'view.outline',
            order: options.order,
            icon: OUTLINE_ICON,
            tooltip: locale.toolbar,
            isActive: () => panel.isOpen,
            onClick: () => panel.toggle(),
        }));
    }
    if (options.slashCommand) {
        life.add(host.commands.registerCommand({
            id: 'view.outline',
            label: locale.slash,
            description: locale.slashDescription,
            keywords: ['outline', 'toc', 'headings', 'contents'],
            order: 125,
            run: () => panel.open(),
        }));
    }
});

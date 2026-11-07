import { html, nothing, type TemplateResult } from 'lit';
import { ref } from 'lit/directives/ref.js';
import type { GeInput } from '../../../input/input.js';
import { defineAddon, resolveAddonLocale } from '../../rich-text-addon-kit.js';
import type { RichTextAddonHost, RichTextAddonOptions, RichTextSelectionSnapshot } from '../../rich-text-host.js';
import type { Disposables } from '../../rich-text-registry.js';
import { RICH_TEXT_LINKS_LOCALES, type RichTextLinksLocale } from './links-locale.js';
import css from './links.css?inline';

const FORM_WIDTH = 320;
const FORM_HEIGHT = 220;
const VIEWPORT_MARGIN = 8;
/** How far outside a link's glyph boxes a click still counts as on the link. */
const HIT_SLACK_PX = 4;
const ERROR_ID = 'rte-link-url-error';
const LINK_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

export interface RichTextLinksOptions extends RichTextAddonOptions {
    /** A locale id (`'he'`) or a full dictionary; defaults to the editor's locale. */
    readonly locale?: string | RichTextLinksLocale;
}

/** The detail of `link-insert`. */
export interface RichTextLinkSubmit {
    readonly text: string;
    readonly url: string;
}

interface Placement {
    readonly left: number;
    readonly bottom: number;
}

interface LinkForm {
    text: string;
    url: string;
    /** The link being edited; null while inserting. */
    readonly anchor: HTMLAnchorElement | null;
    readonly left: number;
    readonly top: number;
    error: string;
}

const escapeHtml = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const anchorHtml = (href: string, text: string): string =>
    `<a href="${escapeHtml(href).replaceAll('"', '&quot;')}" rel="noopener noreferrer">${escapeHtml(text)}</a>`;

/**
 * The link editor: one form for the toolbar button, Ctrl+K and `/link` (inserting, or editing the link under the caret)
 * and for the link a click or the keyboard lands in. Drawn as an overlay inside the editor, so a floating toolbar
 * closing does not take it away.
 */
export class LinkEditor {
    form: LinkForm | null = null;

    constructor(private readonly host: RichTextAddonHost, private readonly locale: RichTextLinksLocale) {}

    /** Opens the form for the selection, or for the link the caret is in; `placement` defaults to the selection's box. */
    openFromSelection(placement?: Placement, hint?: { x: number; y: number }): void {
        const { host } = this;
        if (host.isDisabled || host.readonly) return;
        const chipAnchor = this.form?.anchor;
        this.close();
        host.restoreSelection();
        host.saveSelection();
        const selection = host.selection();
        const found = chipAnchor?.isConnected ? chipAnchor : this.anchorHoldingSelection(selection);
        const anchor = found instanceof HTMLAnchorElement ? found : null;
        this.show(
            { text: anchor ? (anchor.textContent ?? '') : selection.text, url: anchor?.getAttribute('href') ?? '', anchor },
            placement ?? this.selectionPlacement(selection.range, hint),
        );
    }

    close(): void {
        if (!this.form) return;
        this.form = null;
        this.host.invalidate();
    }

    submit(): void {
        const { form } = this;
        if (!form) return;
        const text = form.text.trim();
        const url = form.url.trim();
        if (!url) return;
        const safeUrl = this.host.sanitizer.sanitizeUrl(url);
        if (!safeUrl) {
            form.error = this.locale.invalidUrl;
            this.host.invalidate();
            return;
        }
        if (form.anchor?.isConnected) this.update(form.anchor, text || safeUrl, safeUrl);
        else this.insert(text || safeUrl, safeUrl);
        this.close();
    }

    remove(): void {
        const anchor = this.form?.anchor;
        if (anchor?.isConnected) {
            const url = anchor.getAttribute('href') ?? '';
            this.host.mutateContent(() => {
                anchor.replaceWith(...anchor.childNodes);
            });
            this.host.emit('link-remove', { url });
        }
        this.close();
    }

    /** Opens the form for the link under the caret, as a click or a key landing in a link does. */
    probe(event: Event): void {
        const { host } = this;
        if (host.isDisabled || host.readonly) return;
        const found = host.selection().closestWithAttrs(['href']);
        const anchor = found instanceof HTMLAnchorElement && found.isContentEditable ? found : null;
        // A click in the blank space beside a line parks the caret at the nearest text, which may be a link the
        // pointer never touched; only the link's own boxes count for a pointer.
        const onLink = anchor && (!(event instanceof MouseEvent) || this.pointerOnLink(event, anchor));
        if (!onLink) {
            if (this.form?.anchor) this.close();
        } else if (anchor !== this.form?.anchor) {
            this.close();
            this.show({ text: anchor.textContent ?? '', url: anchor.getAttribute('href') ?? '', anchor }, this.rectPlacement(anchor));
        }
    }

    /** Closes on a pointer press outside the form and the link being edited. */
    dismissOnPointer(event: Event): void {
        if (!this.form || this.insideForm(event) || (event.target instanceof Node && this.form.anchor?.contains(event.target))) return;
        this.close();
    }

    dismissOnEscape(event: KeyboardEvent): void {
        if (event.key !== 'Escape' || !this.form) return;
        event.preventDefault();
        this.close();
    }

    dismissOnScroll(event: Event): void {
        if (this.form && !this.insideForm(event)) this.close();
    }

    render(): TemplateResult {
        const { form, locale } = this;
        if (!form) return html``;
        const submitOnEnter = (event: KeyboardEvent): void => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            this.submit();
        };
        return html`<div
            class="links-form"
            popover="manual"
            data-slot="rich-text-links-form"
            dir=${locale.rtl ? 'rtl' : nothing}
            style=${`left: ${Math.round(form.left)}px; top: ${Math.round(form.top)}px`}
            ${ref(this.present)}
        >
            <p class="links-heading">${locale.tooltip}</p>
            <label class="links-field">
                <span>${locale.text}</span>
                <ge-input
                    type="text"
                    aria-label=${locale.text}
                    placeholder=${locale.textPlaceholder}
                    .value=${form.text}
                    @input=${(event: Event) => { form.text = (event.currentTarget as GeInput).value; }}
                    @keydown=${submitOnEnter}
                ></ge-input>
            </label>
            <label class="links-field">
                <span>${locale.url}</span>
                <ge-input
                    type="url"
                    aria-label=${locale.url}
                    aria-describedby=${form.error ? ERROR_ID : nothing}
                    placeholder=${locale.urlPlaceholder}
                    .value=${form.url}
                    ${ref(this.focusField)}
                    @input=${(event: Event) => { form.url = (event.currentTarget as GeInput).value; }}
                    @keydown=${submitOnEnter}
                ></ge-input>
            </label>
            ${form.error ? html`<p class="links-error" id=${ERROR_ID} role="alert">${form.error}</p>` : nothing}
            <div class="links-actions">
                ${form.anchor ? html`<ge-button variant="ghost" size="sm" @click=${() => this.remove()}>${locale.remove}</ge-button>` : nothing}
                <ge-button variant="outline" size="sm" @click=${() => this.close()}>${locale.cancel}</ge-button>
                <ge-button size="sm" @click=${() => this.submit()}>${form.anchor ? locale.update : locale.insert}</ge-button>
            </div>
        </div>`;
    }

    // Stable references, so Lit calls them once per element rather than on every render.
    private readonly present = (element?: Element): void => {
        if (!(element instanceof HTMLElement)) return;
        queueMicrotask(() => {
            if (element.isConnected && !element.matches(':popover-open')) element.showPopover();
        });
    };

    private readonly focusField = (element?: Element): void => {
        const field = element as GeInput | undefined;
        field?.updateComplete.then(() => field.focus()).catch(() => undefined);
    };

    private show(seed: Pick<LinkForm, 'text' | 'url' | 'anchor'>, placement: Placement): void {
        const view = this.host.doc.defaultView;
        const left = Math.max(VIEWPORT_MARGIN, Math.min(placement.left, (view?.innerWidth ?? 1024) - FORM_WIDTH - VIEWPORT_MARGIN));
        const top = Math.max(VIEWPORT_MARGIN, Math.min(placement.bottom + VIEWPORT_MARGIN, (view?.innerHeight ?? 768) - FORM_HEIGHT - VIEWPORT_MARGIN));
        this.form = { ...seed, left, top, error: '' };
        this.host.invalidate();
    }

    private insert(text: string, url: string): void {
        this.host.restoreSelection();
        this.stripLinksFromSelection();
        this.host.insertHtmlAtCaret(anchorHtml(url, text));
        this.host.emit<RichTextLinkSubmit>('link-insert', { text, url });
    }

    private update(anchor: HTMLAnchorElement, text: string, url: string): void {
        this.host.mutateContent(() => {
            anchor.setAttribute('href', url);
            anchor.setAttribute('rel', 'noopener noreferrer');
            anchor.textContent = text;
        });
        this.host.emit<RichTextLinkSubmit>('link-insert', { text, url });
    }

    /**
     * Clears the link markup a selection covers before it is re-linked: replacing the text would leave an emptied
     * `<a href></a>` behind and nest the new link in it. The browser's `unlink` splits a link the selection only
     * partly covers, where unwrapping would drop the author's link on the text they did not select.
     */
    private stripLinksFromSelection(): void {
        const { host } = this;
        const live = host.getSelection();
        if (!live || live.rangeCount === 0 || live.isCollapsed) return;
        const range = live.getRangeAt(0);
        if ([...host.contentRoot.querySelectorAll('a')].some((anchor) => range.intersectsNode(anchor))) host.doc.execCommand('unlink', false);
    }

    /**
     * The link the selection sits inside. A selection that starts in a link and runs past it is new link text
     * the author picked, not an edit of that link.
     */
    private anchorHoldingSelection(selection: RichTextSelectionSnapshot): HTMLElement | null {
        const anchor = selection.closestWithAttrs(['href']);
        const { range } = selection;
        if (!anchor || (range && !range.collapsed && !anchor.contains(range.endContainer))) return null;
        return anchor;
    }

    private pointerOnLink(event: MouseEvent, anchor: HTMLAnchorElement): boolean {
        return [...anchor.getClientRects()].some((rect) =>
            event.clientX >= rect.left - HIT_SLACK_PX && event.clientX <= rect.right + HIT_SLACK_PX
            && event.clientY >= rect.top - HIT_SLACK_PX && event.clientY <= rect.bottom + HIT_SLACK_PX);
    }

    private insideForm(event: Event): boolean {
        return event.composedPath().some((node) => node instanceof Element && node.matches('[data-slot="rich-text-links-form"]'));
    }

    private selectionPlacement(range: Range | null, hint?: { x: number; y: number }): Placement {
        const rect = range?.getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0)) {
            return { left: hint?.x ?? 20, bottom: hint?.y ?? 20 };
        }
        return { left: rect.left, bottom: rect.bottom };
    }

    private rectPlacement(element: Element): Placement {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, bottom: rect.bottom };
    }
}

function listen(host: RichTextAddonHost, life: Disposables, editor: LinkEditor): void {
    const { doc } = host;
    life.listen(host.contentRoot, 'mouseup', (event) => editor.probe(event));
    life.listen(host.contentRoot, 'keyup', (event) => editor.probe(event));
    life.listen(doc, 'mousedown', (event) => editor.dismissOnPointer(event));
    life.listen<KeyboardEvent>(doc, 'keydown', (event) => editor.dismissOnEscape(event), true);
    if (doc.defaultView) life.listen(doc.defaultView, 'scroll', (event) => editor.dismissOnScroll(event), { capture: true, passive: true });
}

export const linksAddon = defineAddon<RichTextLinksOptions>('links', 320, ({ host, options, life }) => {
    const locale = resolveAddonLocale(RICH_TEXT_LINKS_LOCALES, host, options.locale);
    const editor = new LinkEditor(host, locale);
    life.add(host.adoptStyles(css, 'shadow'));
    life.add(host.overlays.register({ id: 'links', render: () => editor.render() }));
    life.add(host.registerLinkEditor((hint) => editor.openFromSelection(undefined, hint)));
    listen(host, life, editor);
    life.add(() => {
        editor.form = null;
    });
    if (options.toolbar) {
        life.add(host.toolbarSlots.register({
            id: 'links.insert',
            order: options.order,
            icon: LINK_ICON,
            tooltip: locale.tooltip,
            onClick: (event) => {
                const target = event.currentTarget;
                editor.openFromSelection(target instanceof Element ? target.getBoundingClientRect() : undefined);
            },
        }));
    }
    if (options.slashCommand) {
        life.add(host.commands.registerCommand({
            id: 'insert.link',
            label: locale.commandLabel,
            description: locale.commandDescription,
            keywords: ['url', 'anchor', 'link'],
            order: 100,
            run: (context) => context.showLinkDialog(),
        }));
    }
});

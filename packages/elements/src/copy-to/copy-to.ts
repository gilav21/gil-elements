import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { resolveCommonLocale, type CommonLocale } from '../shared/common-locales.js';
import css from './copy-to.css?inline';

const SHOWN_MS = 1500;

/**
 * Copies a string to the clipboard when whatever it wraps is clicked or tapped, then floats a short "Copied!" label
 * above it for 1.5 seconds. The label is appended to `document.body` with inline styles, so no clipping ancestor can
 * cut it off. The element draws no box of its own (`display: contents`); the label sits above the box of what it wraps, or above the union of the boxes if it wraps several things.
 *
 * @fires copied - The clipboard write succeeded, just before the label appears. Never fires if the write is refused (no permission, or not a secure context), and then no label shows.
 * @attr {string} value - The text to copy; read at click time.
 * @attr {string} locale - Locale id or object for the label; defaults to the page's `lang`, then `en`.
 * @slot - The thing to click.
 */
export class GeCopyTo extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        value: { type: String, reflect: true },
        locale: {},
    };

    declare value: string;
    declare locale: string | CommonLocale;
    private badge: HTMLElement | null = null;
    private timer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        super();
        this.value = '';
        this.locale = '';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.addEventListener('click', this.copy);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener('click', this.copy);
        this.clearBadge();
    }

    protected override render() {
        return html`<slot></slot>`;
    }

    private readonly copy = (): void => {
        navigator.clipboard.writeText(this.value).then(
            () => {
                this.dispatchEvent(new CustomEvent('copied', { bubbles: true, composed: true }));
                this.showBadge();
            },
            () => undefined,
        );
    };

    private showBadge(): void {
        this.clearBadge();
        const rect = this.wrappedBox();
        const badge = document.createElement('span');
        badge.dataset.slot = 'copy-to-indicator';
        badge.textContent = resolveCommonLocale(this.locale).copied;
        badge.style.cssText = `position:fixed;top:${rect.top - 30}px;left:${rect.left + rect.width / 2}px;transform:translateX(-50%);background:var(--foreground);color:var(--background);padding:2px 8px;border-radius:4px;font-size:12px;pointer-events:none;z-index:9999;white-space:nowrap`;
        document.body.append(badge);
        badge.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease-in' });
        this.badge = badge;
        this.timer = setTimeout(() => this.clearBadge(), SHOWN_MS);
    }

    /** The box of what is wrapped: the element has none of its own. */
    private wrappedBox(): { top: number; left: number; width: number } {
        const boxes = [...this.children].map((child) => child.getBoundingClientRect());
        if (boxes.length === 0) return this.getBoundingClientRect();
        const left = Math.min(...boxes.map((b) => b.left));
        const right = Math.max(...boxes.map((b) => b.right));
        return { top: Math.min(...boxes.map((b) => b.top)), left, width: right - left };
    }

    private clearBadge(): void {
        this.badge?.remove();
        this.badge = null;
        if (this.timer !== null) clearTimeout(this.timer);
        this.timer = null;
    }
}

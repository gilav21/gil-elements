import { html, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { parentOf } from '../shared/compound.js';
import css from './scroll-progress.css?inline';

/** What the bar can follow: an element, or the page. */
type ScrollSource = HTMLElement | Window;

/**
 * A thin bar pinned to the top or bottom of the viewport that fills as a scroll area is scrolled. By default it follows
 * the nearest scrolling ancestor (one with `overflow-y: auto | scroll`), or the page when there is none.
 *
 * @attr {'top' | 'bottom'} position - Which viewport edge the bar sits on (default `top`). Purely visual.
 * @attr {string} color - Fill colour, any CSS colour including a theme token (default `var(--primary)`).
 * @attr {number} height - Bar thickness in pixels (default 3).
 * @attr {string} container - What to follow: a CSS selector for the scroller. As a property it also takes an element, or `null` to find it. A selector that matches nothing finds it the same way.
 * @csspart bar - The fill.
 */
export class GeScrollProgress extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        position: { reflect: true },
        color: {},
        height: { type: Number },
        container: {},
        progress: { state: true },
    };

    declare position: 'top' | 'bottom';
    declare color: string;
    declare height: number;
    declare container: string | HTMLElement | null;
    declare protected progress: number;
    private source: ScrollSource | null = null;

    constructor() {
        super();
        this.position = 'top';
        this.color = 'var(--primary)';
        this.height = 3;
        this.container = null;
        this.progress = 0;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'scroll-progress';
        if (this.hasUpdated) this.follow();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.unfollow();
    }

    protected override firstUpdated(): void {
        this.follow();
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('container') && this.hasUpdated && changed.get('container') !== undefined) this.follow();
    }

    private unfollow(): void {
        this.source?.removeEventListener('scroll', this.measure);
        this.source = null;
    }

    private follow(): void {
        this.unfollow();
        this.source = this.resolve();
        this.source.addEventListener('scroll', this.measure, { passive: true });
        this.measure();
    }

    private resolve(): ScrollSource {
        const wanted = this.container;
        if (wanted instanceof HTMLElement) return wanted;
        if (typeof wanted === 'string') {
            try {
                const found = document.querySelector<HTMLElement>(wanted);
                if (found) return found;
            } catch {
                // An invalid selector finds the scroller the same way as no selector.
            }
        }
        return this.scrollingAncestor() ?? globalThis.window;
    }

    private scrollingAncestor(): HTMLElement | null {
        let parent = parentOf(this);
        while (parent) {
            if (!(parent instanceof HTMLElement) || parent === document.body) return null;
            const { overflowY } = getComputedStyle(parent);
            if (overflowY === 'auto' || overflowY === 'scroll') return parent;
            parent = parentOf(parent);
        }
        return null;
    }

    private readonly measure = (): void => {
        const source = this.source;
        let top: number;
        let range: number;
        if (source instanceof HTMLElement) {
            top = source.scrollTop;
            range = source.scrollHeight - source.clientHeight;
        } else {
            const root = document.documentElement;
            top = root.scrollTop || document.body.scrollTop;
            range = root.scrollHeight - root.clientHeight;
        }
        this.progress = range > 0 ? Math.min(100, Math.max(0, (top / range) * 100)) : 0;
    };

    protected override render() {
        return html`<div class="track" part="track" data-position=${this.position}><div class="bar" part="bar" style="width:${this.progress}%;height:${this.height}px;background-color:${this.color}"></div></div>`;
    }
}

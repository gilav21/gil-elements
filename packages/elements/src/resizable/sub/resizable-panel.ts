import { html, css, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/**
 * A panel of a resizable group. Its size is a percentage of the group, kept in `flex-basis`.
 *
 * `min-size` and `max-size` are enforced everywhere a size is written (handle drags, arrow keys, `setSize` and
 * `updateSize`) but not on `default-size`.
 *
 * @fires size-change - After the size moves (a drag, a key, `setSize` or `updateSize`); `detail` is the new percentage. Not fired when it is unchanged.
 * @attr {number} default-size - Starting size in percent. Read once, when the panel connects. Defaults to `50`.
 * @attr {number} min-size - Lower bound in percent. Defaults to `10`.
 * @attr {number} max-size - Upper bound in percent. Defaults to `90`.
 */
export class GeResizablePanel extends UiElement {
    static override styles = [UiElement.styles, css`:host { display: block; flex: 0 0 auto; min-width: 0; min-height: 0; overflow: hidden; }`];
    static override properties = {
        defaultSize: { type: Number, attribute: 'default-size' },
        minSize: { type: Number, attribute: 'min-size' },
        maxSize: { type: Number, attribute: 'max-size' },
        size: { state: true },
    };
    declare defaultSize: number;
    declare minSize: number;
    declare maxSize: number;
    /** Current size in percent. Change it with `setSize` or `updateSize` so the limits apply. */
    declare size: number;

    constructor() {
        super();
        this.defaultSize = 50;
        this.minSize = 10;
        this.maxSize = 90;
        this.size = 50;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'resizable-panel';
        this.size = this.defaultSize;
        this.style.flexBasis = `${this.size}%`;
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('size')) this.style.flexBasis = `${this.size}%`;
    }

    /** `size` clamped into the `min-size` to `max-size` range. */
    clampSize(size: number): number {
        return Math.min(Math.max(size, this.minSize), this.maxSize);
    }

    /** Resizes this panel alone, clamped to its limits; the neighbour is left untouched. */
    setSize(next: number): void {
        const clamped = this.clampSize(next);
        if (clamped === this.size) return;
        this.size = clamped;
        this.style.flexBasis = `${clamped}%`;
        this.dispatchEvent(new CustomEvent('size-change', { detail: clamped, bubbles: true, composed: true }));
    }

    /** Resizes the panel and takes the difference out of its neighbour, so the pair keeps its total. */
    updateSize(next: number): void {
        const sibling = this.siblingPanel();
        if (!sibling) {
            this.setSize(next);
            return;
        }
        const total = this.size + sibling.size;
        const siblingSize = sibling.clampSize(total - this.clampSize(next));
        this.setSize(total - siblingSize);
        sibling.setSize(siblingSize);
    }

    private siblingPanel(): GeResizablePanel | undefined {
        for (const direction of ['nextElementSibling', 'previousElementSibling'] as const) {
            let node: Element | null = this[direction];
            while (node) {
                if (node instanceof GeResizablePanel) return node;
                node = node[direction];
            }
        }
        return undefined;
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}

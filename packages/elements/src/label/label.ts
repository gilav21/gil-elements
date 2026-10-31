import { html, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './label.css?inline';

let nextId = 0;

/**
 * A text label for a form control.
 *
 * A native `<label for>` inside a shadow root cannot see a control in the page's light DOM (ID
 * references stop at the shadow boundary). So this element does the two things a native label
 * does itself: it names the control (`aria-labelledby`, set on the control from this element's
 * `id`) and it forwards clicks to the control.
 *
 * @slot - The label text.
 * @attr {string} for - `id` of the control, looked up in the same tree as this element.
 */
export class GeLabel extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = { htmlFor: { attribute: 'for' } };

    declare htmlFor: string;

    private target: Element | null = null;

    constructor() {
        super();
        this.htmlFor = '';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.id ||= `ge-label-${++nextId}`;
        this.addEventListener('click', this.forwardClick);
        this.bind();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener('click', this.forwardClick);
        this.unbind();
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('htmlFor')) this.bind();
    }

    protected override render() {
        return html`<slot></slot>`;
    }

    private bind(): void {
        this.unbind();
        const root = this.getRootNode() as Document | ShadowRoot;
        this.target = this.htmlFor ? root.getElementById(this.htmlFor) : null;
        if (!this.target) return;
        const ids = new Set((this.target.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean));
        ids.add(this.id);
        this.target.setAttribute('aria-labelledby', [...ids].join(' '));
    }

    private unbind(): void {
        if (!this.target) return;
        const ids = (this.target.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter((id) => id && id !== this.id);
        if (ids.length > 0) this.target.setAttribute('aria-labelledby', ids.join(' '));
        else this.target.removeAttribute('aria-labelledby');
        this.target = null;
    }

    private readonly forwardClick = (event: MouseEvent): void => {
        const target = this.target as HTMLElement | null;
        if (!target || event.defaultPrevented) return;
        target.focus();
        target.click();
    };
}

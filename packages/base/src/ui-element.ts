import { LitElement, unsafeCSS, type CSSResultGroup } from 'lit';
import baseCss from './base.css?inline';

/**
 * Base class for every Gil Elements component. It adds the shared stylesheet and
 * nothing else: no behaviour lives here, so a component's source stays readable on its own.
 *
 * Subclasses extend `styles` rather than replace it:
 * `static styles = [UiElement.styles, unsafeCSS(css)]`.
 */
export class UiElement extends LitElement {
    static override styles: CSSResultGroup = unsafeCSS(baseCss);
}

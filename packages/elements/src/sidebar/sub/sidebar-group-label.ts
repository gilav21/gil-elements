import { html, unsafeCSS } from 'lit';
import { GeSidebarPart } from './sidebar-part.js';
import css from './sidebar-group-label.css?inline';

/**
 * A group's heading. On a collapsed rail it is visually hidden but still read aloud.
 *
 * @slot - The label text.
 */
export class GeSidebarGroupLabel extends GeSidebarPart {
    static override styles = [GeSidebarPart.styles, unsafeCSS(css)];

    protected override render() {
        return html`<div class="label" data-slot="sidebar-group-label" ?data-collapsed=${this.collapsedState}><slot></slot></div>`;
    }
}

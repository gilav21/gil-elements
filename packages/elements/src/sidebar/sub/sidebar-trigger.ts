import { html, unsafeCSS } from 'lit';
import { GeSidebarPart } from './sidebar-part.js';
import css from './sidebar-trigger.css?inline';

/**
 * The button that opens and closes the drawer on mobile and collapses or expands the rail on desktop.
 *
 * @csspart base - The `<button>`.
 */
export class GeSidebarTrigger extends GeSidebarPart {
    static override styles = [GeSidebarPart.styles, unsafeCSS(css)];

    protected override render() {
        return html`<button part="base" type="button" data-slot="sidebar-trigger" aria-expanded=${String(this.provider?.isOpen ?? true)} aria-label="Toggle sidebar" @click=${() => this.provider?.toggle()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><line x1="9" x2="9" y1="3" y2="21" /></svg>
            <span class="sr-only">Toggle Sidebar</span>
        </button>`;
    }
}

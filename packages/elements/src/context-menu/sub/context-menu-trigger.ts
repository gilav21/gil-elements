import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { onLongPress } from '../../shared/touch.js';
import { CONTEXT_MENU_REGISTER, type ContextMenuHost } from '../context-menu.js';

/**
 * The area that answers a right-click (or a long press on touch) by opening the menu at the pointer. It draws no box
 * of its own: size and style the content you put inside it.
 *
 * @slot - The area.
 */
export class GeContextMenuTrigger extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(':host{display:contents}')];

    private menu?: ContextMenuHost;
    private stopLongPress?: () => void;

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'context-menu-trigger';
        this.menu = findParent<ContextMenuHost, GeContextMenuTrigger>(this, CONTEXT_MENU_REGISTER);
        this.addEventListener('contextmenu', this.onContextMenu);
        this.stopLongPress = onLongPress(this, (event) => {
            event.preventDefault();
            const touch = event.touches[0] ?? event.changedTouches[0];
            if (touch) this.menu?.show(touch.clientX, touch.clientY);
        });
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener('contextmenu', this.onContextMenu);
        this.stopLongPress?.();
        this.menu = undefined;
    }

    private readonly onContextMenu = (event: MouseEvent) => {
        event.preventDefault();
        this.menu?.show(event.clientX, event.clientY);
    };

    protected override render() {
        return html`<slot></slot>`;
    }
}

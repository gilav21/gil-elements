import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { onLongPress } from '../../shared/touch.js';
import { CONTEXT_MENU_REGISTER, type ContextMenuHost } from '../context-menu.js';

/**
 * The area that answers a right-click (or a long press on touch) by opening the menu at the pointer. It draws no box
 * of its own: size and style the content you put inside it.
 *
 * By default it opens the `ge-context-menu` it sits in. Set `for` to the id of a `ge-context-menu` elsewhere on the
 * page to attach that menu to whatever you wrap, and several areas can share one menu.
 *
 * @slot - The area.
 * @attr {string} for - The id of the `ge-context-menu` to open, for a menu that is not around this element.
 */
export class GeContextMenuTrigger extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(':host{display:contents}')];

    static override readonly properties = {
        forMenu: { attribute: 'for' },
    };

    declare forMenu: string;
    private parent?: ContextMenuHost;
    private stopLongPress?: () => void;

    constructor() {
        super();
        this.forMenu = '';
    }

    /** The menu to open: the one named by `for`, else the one this element sits in. */
    private get menu(): ContextMenuHost | undefined {
        if (!this.forMenu) return this.parent;
        const target = (this.getRootNode() as Document | ShadowRoot).getElementById(this.forMenu);
        return target && 'show' in target ? (target as ContextMenuHost) : undefined;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'context-menu-trigger';
        this.parent = findParent<ContextMenuHost, GeContextMenuTrigger>(this, CONTEXT_MENU_REGISTER);
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
        this.parent = undefined;
    }

    private readonly onContextMenu = (event: MouseEvent) => {
        const menu = this.menu;
        if (!menu) return;
        event.preventDefault();
        menu.show(event.clientX, event.clientY);
    };

    protected override render() {
        return html`<slot></slot>`;
    }
}

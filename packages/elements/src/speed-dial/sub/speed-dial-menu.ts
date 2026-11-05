import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren, byDocumentOrder, findParent } from '../../shared/compound.js';
import { SPEED_DIAL_REGISTER, type SpeedDialHost, type SpeedDialPart } from '../speed-dial.js';
import css from './speed-dial-menu.css?inline';

export const SPEED_DIAL_MENU_REGISTER = 'ge-speed-dial-menu-register';

/** What an item needs from the menu it sits in. */
export interface SpeedDialMenuHost extends HTMLElement {
    register(item: SpeedDialItemPart): void;
    unregister(item: SpeedDialItemPart): void;
}

/** An item the menu numbers: its position in the menu drives its stagger and its angle on an arc. */
export interface SpeedDialItemPart extends HTMLElement {
    itemIndex: number;
    totalItems: number;
}

const STRAIGHT = new Set(['up', 'down', 'left', 'right']);

/**
 * The group of actions a speed dial opens. Closed, it is `aria-hidden` and `inert`, so its items are out of the tab
 * order. Items are numbered in document order; that numbering sets the stagger and, on an arc, each item's angle.
 *
 * @slot - `ge-speed-dial-item`s.
 * @attr {string} label - `aria-label` for the group; set it when several speed dials share a page.
 * @csspart base - The `role="group"` element.
 */
export class GeSpeedDialMenu extends UiElement implements SpeedDialPart, SpeedDialMenuHost {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        label: {},
    };

    declare label: string | undefined;
    private dial?: SpeedDialHost;
    private readonly items = new Set<SpeedDialItemPart>();

    constructor() {
        super();
        this.label = undefined;
        adoptChildren<SpeedDialMenuHost, SpeedDialItemPart>(this, SPEED_DIAL_MENU_REGISTER, (item) => this.register(item));
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'speed-dial-menu';
        this.dial = findParent<SpeedDialHost, GeSpeedDialMenu>(this, SPEED_DIAL_REGISTER);
        this.dial?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.dial?.unregister(this);
        this.dial = undefined;
    }

    register(item: SpeedDialItemPart): void {
        this.items.add(item);
        this.renumber();
    }

    unregister(item: SpeedDialItemPart): void {
        this.items.delete(item);
        this.renumber();
    }

    private renumber(): void {
        const ordered = [...this.items].sort(byDocumentOrder);
        ordered.forEach((item, index) => {
            item.itemIndex = index;
            item.totalItems = ordered.length;
        });
    }

    protected override render() {
        const dial = this.dial;
        const open = dial?.open ?? false;
        const type = dial?.type ?? 'linear';
        const direction = dial?.direction ?? 'up';
        const at = dial?.contextPosition ?? null;
        // Anchored to the trigger, a linear menu with a diagonal direction falls back to `up`; opened at a point it gets no layout.
        const dir = at ? direction : STRAIGHT.has(direction) ? direction : 'up';
        return html`<div
            part="base"
            class="menu"
            role="group"
            data-slot="speed-dial-menu"
            data-state=${open ? 'open' : 'closed'}
            data-type=${type}
            data-dir=${dir}
            ?data-closed=${!open}
            ?data-fixed=${at !== null}
            style=${at ? `left:${at.x}px;top:${at.y}px` : nothing}
            aria-label=${this.label ?? nothing}
            aria-hidden=${String(!open)}
            ?inert=${!open}
        >
            <slot></slot>
        </div>`;
    }
}

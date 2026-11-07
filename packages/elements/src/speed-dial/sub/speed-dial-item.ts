import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { SPEED_DIAL_REGISTER, type SpeedDialDirection, type SpeedDialHost, type SpeedDialPart, type SpeedDialType } from '../speed-dial.js';
import { SPEED_DIAL_MENU_REGISTER, type SpeedDialItemPart, type SpeedDialMenuHost } from './speed-dial-menu.js';
import css from './speed-dial-item.css?inline';

interface Angles {
    start: number;
    end: number;
}

function semiCircleAngles(direction: SpeedDialDirection): Angles {
    switch (direction) {
        case 'up': return { start: -180, end: 0 };
        case 'down': return { start: 0, end: 180 };
        case 'left': return { start: 90, end: 270 };
        case 'right': return { start: -90, end: 90 };
        default: return { start: 180, end: 360 };
    }
}

function quarterCircleAngles(direction: SpeedDialDirection): Angles {
    switch (direction) {
        case 'up-right': return { start: 270, end: 360 };
        case 'up-left': return { start: 180, end: 270 };
        case 'down-right': return { start: 0, end: 90 };
        case 'down-left': return { start: 90, end: 180 };
        default: return { start: 270, end: 360 };
    }
}

function anglesFor(type: SpeedDialType, direction: SpeedDialDirection): Angles {
    if (type === 'semi-circle') return semiCircleAngles(direction);
    if (type === 'quarter-circle') return quarterCircleAngles(direction);
    return { start: 0, end: 360 };
}

/** Where item `index` of `total` sits relative to the trigger centre; arcs space items over `total - 1` steps so the ends land on the end angles. */
export function arcPosition(type: SpeedDialType, direction: SpeedDialDirection, radius: number, index: number, total: number): { x: number; y: number } {
    const { start, end } = anglesFor(type, direction);
    const steps = type === 'circle' ? total : Math.max(total - 1, 1);
    const radians = ((start + index * ((end - start) / steps)) * Math.PI) / 180;
    return { x: Math.cos(radians) * radius, y: Math.sin(radians) * radius };
}

/**
 * One action of a speed dial. It wraps whatever you put inside (usually a round `ge-button`) and animates it out of
 * the trigger with a stagger. Which slot it takes is its order inside the menu.
 *
 * @slot - The action.
 * @csspart base - The animated wrapper.
 */
export class GeSpeedDialItem extends UiElement implements SpeedDialPart, SpeedDialItemPart {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        itemIndex: { state: true },
        totalItems: { state: true },
    };

    declare itemIndex: number;
    declare totalItems: number;
    private dial?: SpeedDialHost;
    private menu?: SpeedDialMenuHost;

    constructor() {
        super();
        this.itemIndex = 0;
        this.totalItems = 1;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dial = findParent<SpeedDialHost, GeSpeedDialItem>(this, SPEED_DIAL_REGISTER);
        this.dial?.register(this);
        this.menu = findParent<SpeedDialMenuHost, GeSpeedDialItem>(this, SPEED_DIAL_MENU_REGISTER);
        this.menu?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.dial?.unregister(this);
        this.menu?.unregister(this);
        this.dial = undefined;
        this.menu = undefined;
    }

    private motion(): string {
        const dial = this.dial;
        const open = dial?.open ?? false;
        const type = dial?.type ?? 'linear';
        const stagger = dial?.contextPosition ? 30 : (dial?.transitionDelay ?? 80);
        const delay = (open ? this.itemIndex : this.totalItems - 1 - this.itemIndex) * stagger;
        const easing = open ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' : 'cubic-bezier(0.4, 0, 0.2, 1)';
        const duration = open ? '300ms' : '200ms';
        const repositioning = dial?.isRepositioning ?? false;
        if (type === 'linear') {
            return repositioning ? 'transition:none;transition-delay:0ms' : `transition:all ${duration} ${easing};transition-delay:${delay}ms`;
        }
        const at = open ? arcPosition(type, dial?.direction ?? 'up', dial?.radius ?? 80, this.itemIndex, this.totalItems) : { x: 0, y: 0 };
        const place = `transform:translate(${at.x}px, ${at.y}px);left:50%;top:50%;margin-left:-1.125rem;margin-top:-1.125rem`;
        if (repositioning) return `${place};transition:none;transition-delay:0ms`;
        return `${place};transition:transform ${duration} ${easing}, opacity ${duration} ${easing}, scale ${duration} ${easing};transition-delay:${delay}ms`;
    }

    protected override render() {
        const open = this.dial?.open ?? false;
        const circular = (this.dial?.type ?? 'linear') !== 'linear';
        return html`<div
            part="base"
            class="item"
            data-slot="speed-dial-item"
            data-state=${open ? 'open' : 'closed'}
            ?data-circular=${circular}
            style=${this.motion()}
        >
            <slot></slot>
        </div>`;
    }
}

import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { onLongPress } from '../../shared/touch.js';
import { SPEED_DIAL_REGISTER, type SpeedDialHost } from '../speed-dial.js';

/**
 * An area that opens a speed dial at the pointer on right-click (or a long press on touch), and dismisses it on any
 * left click. It draws no box of its own: size and style the content you put inside it.
 *
 * By default it opens the `ge-speed-dial` it sits in. Set `for` to the id of a `ge-speed-dial` elsewhere on the page
 * to attach that dial to whatever you wrap.
 *
 * @slot - The area.
 * @attr {string} for - The id of the `ge-speed-dial` to open, for a dial that is not around this element.
 */
export class GeSpeedDialContextTrigger extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(':host{display:contents}')];
    static override properties = {
        forDial: { attribute: 'for' },
    };

    declare forDial: string;
    private parent?: SpeedDialHost;
    private stopLongPress?: () => void;

    constructor() {
        super();
        this.forDial = '';
    }

    /** The dial to open: the one named by `for`, else the one this element sits in. */
    private get dial(): SpeedDialHost | undefined {
        if (!this.forDial) return this.parent;
        const target = (this.getRootNode() as Document | ShadowRoot).getElementById(this.forDial);
        return target && 'showAt' in target ? (target as SpeedDialHost) : undefined;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'speed-dial-context-trigger';
        this.parent = findParent<SpeedDialHost, GeSpeedDialContextTrigger>(this, SPEED_DIAL_REGISTER);
        this.addEventListener('contextmenu', this.onContextMenu);
        this.addEventListener('click', this.onClick);
        this.stopLongPress = onLongPress(this, (event) => {
            event.preventDefault();
            const touch = event.touches[0] ?? event.changedTouches[0];
            if (touch) this.dial?.showAt(touch.clientX, touch.clientY);
        });
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener('contextmenu', this.onContextMenu);
        this.removeEventListener('click', this.onClick);
        this.stopLongPress?.();
        this.parent = undefined;
    }

    private readonly onContextMenu = (event: MouseEvent) => {
        const dial = this.dial;
        if (!dial) return;
        event.preventDefault();
        event.stopPropagation();
        dial.showAt(event.clientX, event.clientY);
    };

    private readonly onClick = () => {
        const dial = this.dial;
        if (dial?.open) dial.hide();
    };

    protected override render() {
        return html`<slot></slot>`;
    }
}

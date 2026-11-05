import { unsafeCSS } from 'lit';
import { GeActivator } from '../../shared/activator.js';
import { SPEED_DIAL_REGISTER, type SpeedDialHost } from '../speed-dial.js';
import css from './speed-dial-trigger.css?inline';

/**
 * Opens and closes the enclosing `ge-speed-dial` when clicked, and turns a quarter while it is open. Plain
 * content becomes a button named by `label`; a control of your own (a `ge-button`) is left as the one tab stop
 * and should carry its own `aria-label`.
 *
 * @slot - The content, or a control of your own.
 * @attr {string} label - Accessible name of the wrapper while it is the button.
 * @csspart base - The wrapper.
 */
export class GeSpeedDialTrigger extends GeActivator<SpeedDialHost> {
    static override styles = [...GeActivator.styles, unsafeCSS(css)];
    static override properties = {
        ...GeActivator.properties,
        label: {},
    };

    declare label: string;
    protected readonly registerEvent = SPEED_DIAL_REGISTER;
    protected readonly slotName = 'speed-dial-trigger';

    constructor() {
        super();
        this.label = 'Toggle speed dial';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.parent?.register(this);
    }

    override disconnectedCallback(): void {
        this.parent?.unregister(this);
        super.disconnectedCallback();
    }

    protected activate(): void {
        this.parent?.toggle();
    }

    protected override accessibleName(): string {
        return this.label;
    }

    protected override stateName(): string {
        return this.parent?.open ? 'open' : 'closed';
    }
}

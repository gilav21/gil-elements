import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren, findParent } from '../../shared/compound.js';
import { STEPPER_REGISTER, type StepperHost, type StepperPart, type StepStatus } from '../stepper.js';
import css from './stepper-item.css?inline';

export const STEPPER_ITEM_REGISTER = 'ge-stepper-item-register';

/** The part of an item its trigger, separator and content talk to. */
export interface StepperItemHost {
    stepper?: StepperHost | undefined;
    readonly index: number;
    readonly status: StepStatus;
    register(part: StepperPart): void;
    unregister(part: StepperPart): void;
}

/**
 * One step. Holds a `ge-stepper-trigger` and, optionally, a `ge-stepper-content` that shows while this step is
 * current. Between horizontal steps it draws the connecting line itself.
 *
 * @slot - A `ge-stepper-trigger`, a `ge-stepper-separator` and a `ge-stepper-content`.
 * @attr {string} value - Identifies the step. Required.
 */
export class GeStepperItem extends UiElement implements StepperItemHost {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        value: { reflect: true },
    };

    declare value: string;
    stepper?: StepperHost;
    private readonly parts = new Set<StepperPart>();

    constructor() {
        super();
        this.value = '';
        adoptChildren<StepperItemHost, StepperPart>(this, STEPPER_ITEM_REGISTER, (part) => this.register(part));
    }

    get index(): number {
        return this.stepper?.indexOf(this) ?? 0;
    }

    get status(): StepStatus {
        return this.stepper?.statusOf(this.index) ?? 'pending';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        // The parent <ol> may hold only list items, and this host is its direct child.
        this.setAttribute('role', 'listitem');
        this.stepper = findParent<StepperHost, GeStepperItem>(this, STEPPER_REGISTER);
        this.stepper?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.stepper?.unregister(this);
        this.stepper = undefined;
    }

    register(part: StepperPart): void {
        this.parts.add(part);
        part.requestUpdate();
    }

    unregister(part: StepperPart): void {
        this.parts.delete(part);
    }

    protected override updated(): void {
        for (const part of this.parts) part.requestUpdate();
    }

    protected override render() {
        const orientation = this.stepper?.orientation ?? 'horizontal';
        const last = this.index === (this.stepper?.count() ?? 1) - 1;
        return html`<div class="item" data-slot="stepper-item" data-status=${this.status} data-orientation=${orientation}><slot></slot></div>${!last && orientation === 'horizontal'
            ? html`<div class="connector" data-status=${this.status}></div>`
            : nothing}`;
    }
}

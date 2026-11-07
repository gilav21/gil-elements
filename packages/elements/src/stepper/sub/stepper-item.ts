import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren, findParent } from '../../shared/compound.js';
import { STEPPER_REGISTER, type StepperHost, type StepperPart, type StepStatus } from '../stepper.js';
import css from './stepper-item.css?inline';

export const STEPPER_ITEM_REGISTER = 'ge-stepper-item-register';

/** The part of an item its trigger, separator and content talk to. */
export interface StepperItemHost {
    stepper?: StepperHost;
    readonly index: number;
    readonly status: StepStatus;
    register(part: StepperPart): void;
    unregister(part: StepperPart): void;
}

/**
 * One step. Holds a `ge-stepper-trigger` and, optionally, a `ge-stepper-content` that shows while this step is
 * current. Between steps it draws the connecting line itself.
 *
 * @slot - A `ge-stepper-trigger`, a `ge-stepper-separator` and a `ge-stepper-content`.
 * @attr {string} value - Identifies the step. Required.
 */
export class GeStepperItem extends UiElement implements StepperItemHost {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
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
        // A separator among the parts changes whether the item draws its own connector.
        this.requestUpdate();
    }

    unregister(part: StepperPart): void {
        this.parts.delete(part);
        this.requestUpdate();
    }

    protected override updated(): void {
        for (const part of this.parts) part.requestUpdate();
    }

    protected override render() {
        const orientation = this.stepper?.orientation ?? 'horizontal';
        const last = this.index === (this.stepper?.count() ?? 1) - 1;
        // A projected separator is the consumer drawing the line, so the auto connector steps aside: one bar per gap.
        const noConnector = last || this.querySelector('ge-stepper-separator') !== null;
        return html`<div class="item" data-slot="stepper-item" data-status=${this.status} data-orientation=${orientation}><slot></slot></div>${noConnector ? nothing : html`<div class="connector" data-orientation=${orientation} data-status=${this.status}></div>`}`;
    }
}

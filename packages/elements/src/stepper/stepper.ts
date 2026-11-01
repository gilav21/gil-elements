import { html, nothing, unsafeCSS } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren, byDocumentOrder } from '../shared/compound.js';
import css from './stepper.css?inline';

export const STEPPER_REGISTER = 'ge-stepper-register';
export type StepStatus = 'pending' | 'current' | 'complete';
export type StepperOrientation = 'horizontal' | 'vertical';

/** One entry for data-driven mode. */
export interface StepConfig {
    value: string;
    title: string;
    description?: string;
}

/** Decides whether the stepper may leave step `from` for step `to`; may answer later. A throw or rejection means no. */
export type StepGuard = (from: number, to: number) => boolean | Promise<boolean>;

/** An item or one of its parts: re-rendered whenever the stepper's state changes. */
export type StepperPart = HTMLElement & { requestUpdate(): void; value?: string };

/** The part of the stepper its items talk to. */
export interface StepperHost {
    readonly orientation: StepperOrientation;
    readonly guardPending: boolean;
    indexOf(item: StepperPart): number;
    count(): number;
    statusOf(index: number): StepStatus;
    canNavigateTo(index: number): boolean;
    goToStep(index: number): void;
    register(item: StepperPart): void;
    unregister(item: StepperPart): void;
}

/**
 * A row (or column) of steps. Give it `steps` for the quick form, or project `ge-stepper-item`s, each with a
 * `ge-stepper-trigger` and optionally a `ge-stepper-content` shown while that step is current.
 *
 * @slot - `ge-stepper-item`s, used when `steps` is empty.
 * @fires step-change - After the step changes, by click, `nextStep()` or `prevStep()`; `detail` is the new index.
 * @fires step-blocked - When `can-leave` said no; `detail` is `{ from, to }`.
 * @attr {number} active-step - Index of the current step, from 0. Steps before it are complete.
 * @attr {'horizontal' | 'vertical'} orientation - Layout direction. Defaults to horizontal.
 * @attr {boolean} linear - Blocks jumping ahead of the current step.
 */
export class GeStepper extends UiElement implements StepperHost {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        activeStep: { type: Number, attribute: 'active-step', reflect: true },
        orientation: { reflect: true },
        linear: { type: Boolean, reflect: true },
        steps: { attribute: false },
        canLeave: { attribute: false },
        guardPending: { state: true },
    };

    declare activeStep: number;
    declare orientation: StepperOrientation;
    declare linear: boolean;
    /** Quick form: one item per entry. Children are ignored. */
    declare steps: readonly StepConfig[] | undefined;
    /** Asked before every move away from the current step; see {@link StepGuard}. */
    declare canLeave: StepGuard | null;
    declare guardPending: boolean;

    private readonly items = new Set<StepperPart>();
    private guardToken = 0;

    constructor() {
        super();
        this.activeStep = 0;
        this.orientation = 'horizontal';
        this.linear = false;
        this.steps = undefined;
        this.canLeave = null;
        this.guardPending = false;
        adoptChildren<StepperHost, StepperPart>(this, STEPPER_REGISTER, (item) => this.register(item));
    }

    register(item: StepperPart): void {
        this.items.add(item);
        item.requestUpdate();
    }

    unregister(item: StepperPart): void {
        this.items.delete(item);
        this.requestUpdate();
    }

    private ordered(): StepperPart[] {
        return [...this.items].sort(byDocumentOrder);
    }

    indexOf(item: StepperPart): number {
        return this.ordered().indexOf(item);
    }

    count(): number {
        return this.items.size;
    }

    statusOf(index: number): StepStatus {
        if (index < this.activeStep) return 'complete';
        return index === this.activeStep ? 'current' : 'pending';
    }

    /** Whether the user may go to `index`: always, unless `linear` and it is ahead of the current step. */
    canNavigateTo(index: number): boolean {
        return !this.linear || index <= this.activeStep;
    }

    /** Move to `index`, asking `can-leave` first. A newer move cancels one still waiting on an async guard. */
    goToStep(index: number): void {
        if (this.canNavigateTo(index)) this.move(index);
    }

    private move(index: number): void {
        const from = this.activeStep;
        const guard = this.canLeave;
        // Bumped for every decided move, not only the async ones: a synchronous move that lands while an async
        // guard is in flight must cancel it, or the stale answer would snap the stepper back later.
        const token = ++this.guardToken;
        if (!guard || index === from) {
            this.guardPending = false;
            this.commit(index);
            return;
        }
        let outcome: boolean | Promise<boolean>;
        try {
            outcome = guard(from, index);
        } catch {
            outcome = false;
        }
        if (typeof outcome === 'boolean') {
            this.guardPending = false;
            this.settle(outcome, from, index);
            return;
        }
        this.guardPending = true;
        outcome.then(
            (allowed) => this.settleAsync(token, allowed, from, index),
            () => this.settleAsync(token, false, from, index),
        );
    }

    nextStep(): void {
        const count = this.steps?.length ? this.steps.length : this.count();
        // Not goToStep: a linear stepper blocks jumping ahead, but advancing one step is the one way forward.
        this.move(Math.min(this.activeStep + 1, count - 1));
    }

    prevStep(): void {
        this.goToStep(Math.max(this.activeStep - 1, 0));
    }

    private settleAsync(token: number, allowed: boolean, from: number, to: number): void {
        if (token !== this.guardToken) return;
        this.guardPending = false;
        this.settle(allowed, from, to);
    }

    private settle(allowed: boolean, from: number, to: number): void {
        if (allowed) this.commit(to);
        else this.dispatchEvent(new CustomEvent('step-blocked', { detail: { from, to }, bubbles: true, composed: true }));
    }

    private commit(index: number): void {
        this.activeStep = index;
        this.dispatchEvent(new CustomEvent<number>('step-change', { detail: index, bubbles: true, composed: true }));
    }

    protected override updated(): void {
        for (const item of this.items) item.requestUpdate();
    }

    protected override render() {
        return html`<ol data-slot="stepper" data-orientation=${this.orientation}>${this.steps?.length ? this.renderSteps(this.steps) : html`<slot></slot>`}</ol>`;
    }

    private renderSteps(steps: readonly StepConfig[]) {
        return repeat(
            steps,
            (step) => step.value,
            (step) => html`<ge-stepper-item value=${step.value}>
                <ge-stepper-trigger>
                    <ge-stepper-title>${step.title}</ge-stepper-title>
                    ${step.description ? html`<ge-stepper-description>${step.description}</ge-stepper-description>` : nothing}
                </ge-stepper-trigger>
            </ge-stepper-item>`,
        );
    }
}

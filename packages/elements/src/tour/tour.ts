import { html, nothing, unsafeCSS, type PropertyValues } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import { UiElement } from '@gilav21/elements-base';
import '../button/define.js';
import { resolveCommonLocale, type CommonLocale } from '../shared/common-locales.js';
import css from './tour.css?inline';

type TourSide = 'top' | 'bottom' | 'left' | 'right';

/** Which way the tour is travelling when a step's hooks run. */
export type TourDirection = 'initial' | 'forward' | 'backward';
/** Why the tour ended: the `done` event's detail. */
export type TourEndReason = 'finished' | 'skipped';
/** Why a step was passed over: `reason` in the `step-skipped` event's detail. */
export type TourSkipReason = 'condition' | 'missing-target' | 'hook-error';
export interface TourSkippedEvent {
    readonly index: number;
    readonly reason: TourSkipReason;
}
/** Passed to every step hook. `signal` aborts when the user moves on or closes the tour while the hook is still running. */
export interface TourStepContext {
    readonly index: number;
    readonly direction: TourDirection;
    readonly signal: AbortSignal;
}
/** Where `next()` goes from a step: an index, or `null` to end the tour there. Runs synchronously; a throw or an out-of-range index falls back to "the next step". */
export type TourBranch = (ctx: TourStepContext) => number | null;

/**
 * One step of a guided tour. `target` is a CSS selector resolved against the document when the step activates; a missing
 * or unrendered target is skipped in the direction of travel.
 */
export interface TourStep {
    target: string;
    title: string;
    description?: string;
    side?: TourSide;
    /** Awaited before `target` is resolved. Open the panel or load the record the step describes. */
    beforeActivate?: (ctx: TourStepContext) => void | Promise<void>;
    /** Awaited when leaving the step, before the next step's `beforeActivate`: the undo of `beforeActivate`. */
    afterDeactivate?: (ctx: TourStepContext) => void | Promise<void>;
    /** Include the step only when this resolves truthy. */
    when?: (ctx: TourStepContext) => boolean | Promise<boolean>;
    /** Milliseconds to wait for `target` to appear; overrides the element's `target-timeout`. */
    targetTimeout?: number;
    /** Branch instead of falling through to the next step. Consulted by `next()` only. */
    next?: TourBranch;
}

interface Rect {
    readonly top: number;
    readonly left: number;
    readonly width: number;
    readonly height: number;
    readonly bottom: number;
    readonly right: number;
}
interface Size {
    readonly width: number;
    readonly height: number;
}
interface Position {
    readonly top: number;
    readonly left: number;
}
interface ResolvedStep {
    readonly el: HTMLElement;
    readonly index: number;
}
interface SavedStyles {
    readonly outline: string;
    readonly outlineOffset: string;
    readonly position: string;
    readonly zIndex: string;
    readonly borderRadius: string;
    readonly transition: string;
}

const CARD_GAP = 12;
const SPOTLIGHT_PAD = 6;
const VIEWPORT_MARGIN = 8;
const DEFAULT_CARD_WIDTH = 320;
const DEFAULT_CARD_HEIGHT = 160;
const HIGHLIGHT_ATTR = 'data-ge-tour-highlight';
const STORAGE_PREFIX = 'ge-tour:';
const EMPTY_RECT: Rect = { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 };

const defaultTrue = { fromAttribute: (value: string | null) => value !== 'false', toAttribute: (value: boolean) => (value ? null : 'false') };

function readCompleted(key: string | null): boolean {
    if (!key) return false;
    try {
        return globalThis.localStorage?.getItem(STORAGE_PREFIX + key) === 'done';
    } catch {
        return false;
    }
}

function writeCompleted(key: string | null, completed: boolean): void {
    if (!key) return;
    try {
        const storage = globalThis.localStorage;
        if (!storage) return;
        if (completed) storage.setItem(STORAGE_PREFIX + key, 'done');
        else storage.removeItem(STORAGE_PREFIX + key);
    } catch {
        // Persistence is best effort: private modes and sandboxed frames throw, and the tour then behaves as if it had no key.
    }
}

function branchContext(index: number): TourStepContext {
    return { index, direction: 'forward', signal: new AbortController().signal };
}

function hasHooks(step: TourStep): boolean {
    return !!step.when || !!step.beforeActivate || !!step.afterDeactivate || (step.targetTimeout ?? 0) > 0;
}

function isRendered(el: HTMLElement): boolean {
    let node: HTMLElement | null = el;
    while (node) {
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        node = node.parentElement;
    }
    return true;
}

function chooseSide(target: Rect, card: Size, preferred: TourSide | undefined): TourSide {
    if (preferred) return preferred;
    if (innerHeight - target.bottom >= card.height + CARD_GAP) return 'bottom';
    if (target.top >= card.height + CARD_GAP) return 'top';
    if (innerWidth - target.right >= card.width + CARD_GAP) return 'right';
    if (target.left >= card.width + CARD_GAP) return 'left';
    return 'bottom';
}

function placeCard(side: TourSide, target: Rect, card: Size): Position {
    const cx = target.left + target.width / 2;
    const cy = target.top + target.height / 2;
    switch (side) {
        case 'bottom':
            return { top: target.bottom + CARD_GAP, left: cx - card.width / 2 };
        case 'top':
            return { top: target.top - card.height - CARD_GAP, left: cx - card.width / 2 };
        case 'right':
            return { top: cy - card.height / 2, left: target.right + CARD_GAP };
        case 'left':
            return { top: cy - card.height / 2, left: target.left - card.width - CARD_GAP };
    }
}

function computeCardPosition(target: Rect, card: Size, preferred: TourSide | undefined): Position {
    const raw = placeCard(chooseSide(target, card, preferred), target, card);
    return {
        top: Math.max(VIEWPORT_MARGIN, Math.min(innerHeight - card.height - VIEWPORT_MARGIN, raw.top)),
        left: Math.max(VIEWPORT_MARGIN, Math.min(innerWidth - card.width - VIEWPORT_MARGIN, raw.left)),
    };
}

/**
 * A guided tour: a dimmed page with a spotlight on one element at a time and a card that explains it. Set `steps` (a
 * property) and turn `active` on. Each step's `target` is looked up with `document.querySelector`, scrolled into view and
 * outlined; the card goes on the side with the most room unless the step names one.
 *
 * Steps may carry async hooks (`beforeActivate`, `afterDeactivate`, `when`) that put the app into the state a step
 * describes; raise `target-timeout` so the tour waits for what they render. A target that is missing, unrendered or
 * behind a failing hook is skipped in the direction of travel.
 *
 * Keys while it is open: Enter or ArrowRight go on, ArrowLeft goes back, Escape skips.
 *
 * @fires done - The tour ended on its own or was skipped; `detail` is `'finished'` or `'skipped'`. Setting `active` to false yourself does not fire it.
 * @fires active-change - The tour turned itself off (it ended, or `storage-key` says it already ran); `detail` is `false`.
 * @fires step-change - A step was shown; `detail` is its index.
 * @fires step-skipped - A step was passed over; `detail` is `{ index, reason }`.
 * @attr {boolean} active - Whether the tour is running. Turning it on starts at the first step.
 * @attr {boolean} show-skip - Show the Skip button on every step but the last. On by default; `show-skip="false"` hides it.
 * @attr {number} target-timeout - Milliseconds to wait for a target to appear before skipping its step. 0 (default) looks once, synchronously.
 * @attr {string} next-label - Replaces the Next button's label.
 * @attr {string} prev-label - Replaces the Previous button's label.
 * @attr {string} finish-label - Replaces the last step's button label.
 * @attr {string} skip-label - Replaces the Skip button's label.
 * @attr {string} locale - Locale id or object for the labels and direction; defaults to the page's `lang`, then `en`.
 * @attr {string} storage-key - Remember that the tour ran (finished or skipped) under this key in localStorage, and refuse to start again.
 * @prop {TourStep[]} steps - The steps, in order.
 * @csspart card - The step card.
 */
export class GeTour extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        steps: { attribute: false },
        active: { type: Boolean, reflect: true },
        showSkip: { attribute: 'show-skip', converter: defaultTrue },
        targetTimeout: { type: Number, attribute: 'target-timeout' },
        nextLabel: { attribute: 'next-label' },
        prevLabel: { attribute: 'prev-label' },
        finishLabel: { attribute: 'finish-label' },
        skipLabel: { attribute: 'skip-label' },
        locale: {},
        storageKey: { attribute: 'storage-key' },
        index: { state: true },
        targetRect: { state: true },
        cardSize: { state: true },
        ready: { state: true },
        pending: { state: true },
        unreachable: { state: true },
    };

    declare steps: TourStep[];
    declare active: boolean;
    declare showSkip: boolean;
    declare targetTimeout: number;
    declare nextLabel: string | undefined;
    declare prevLabel: string | undefined;
    declare finishLabel: string | undefined;
    declare skipLabel: string | undefined;
    declare locale: string | CommonLocale;
    declare storageKey: string | null;
    declare index: number;
    declare targetRect: Rect;
    declare cardSize: Size;
    declare ready: boolean;
    declare pending: boolean;
    declare unreachable: ReadonlySet<number>;

    private readonly card = createRef<HTMLElement>();
    private resizeObserver: ResizeObserver | null = null;
    private removeReposition: (() => void) | null = null;
    private currentTarget: HTMLElement | null = null;
    private savedStyles: SavedStyles | null = null;
    private wasActive = false;
    private showedAStep = false;
    private lastStepsLength = -1;
    private runToken = 0;
    private abortController: AbortController | null = null;

    constructor() {
        super();
        this.steps = [];
        this.active = false;
        this.showSkip = true;
        this.targetTimeout = 0;
        this.locale = '';
        this.storageKey = null;
        this.index = 0;
        this.targetRect = EMPTY_RECT;
        this.cardSize = { width: DEFAULT_CARD_WIDTH, height: DEFAULT_CARD_HEIGHT };
        this.ready = false;
        this.pending = false;
        this.unreachable = new Set();
    }

    /** Index of the step on screen. */
    get currentIndex(): number {
        return this.index;
    }

    /** True while a step's async hooks run or its target is being waited for. */
    get isPending(): boolean {
        return this.pending;
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.wasActive = false;
        this.teardown();
    }

    override connectedCallback(): void {
        super.connectedCallback();
        if (this.hasUpdated && this.active) this.syncActive();
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('steps')) this.reconcileStepsLength(this.steps.length);
        if (changed.has('active')) this.syncActive();
    }

    // ---- Navigation -------------------------------------------------------------------------------------------------

    /** Goes to the next reachable step, or ends the tour with `done('finished')` from the last. Ignored while a step's hooks are still running, so a double click cannot skip a step. */
    next(): void {
        if (this.pending) return;
        const branched = this.resolveBranch();
        if (branched !== undefined) {
            if (branched === null) this.finish('finished');
            else this.transition(branched, branched < this.index ? 'backward' : 'forward');
            return;
        }
        if (this.isLastStep) this.finish('finished');
        else this.transition(this.index + 1, 'forward');
    }

    /** Steps backwards, running the target step's hooks. Nothing happens on the first step or while a transition is pending. */
    previous(): void {
        if (this.pending || !this.canGoBack) return;
        this.transition(this.index - 1, 'backward');
    }

    /** Ends the tour with `done('skipped')`, aborting any transition in flight. Not blocked while pending, so the reader can always get out. */
    skip(): void {
        this.finish('skipped');
    }

    /** Jumps to a step, running its hooks. An index outside the steps is ignored. */
    goTo(index: number): void {
        if (index < 0 || index >= this.steps.length) return;
        this.transition(index, index < this.index ? 'backward' : 'forward');
    }

    /** Back to the first resolvable step, without turning the tour off. */
    restart(): void {
        this.transition(0, 'initial');
    }

    /** Whether the tour under `storage-key` already ran to an end. Always false without a key. */
    isCompleted(): boolean {
        return readCompleted(this.storageKey);
    }

    /** Clears the `storage-key` flag so the tour may run again. */
    resetCompletion(): void {
        writeCompleted(this.storageKey, false);
    }

    private get canGoBack(): boolean {
        for (let i = this.index - 1; i >= 0; i--) if (!this.unreachable.has(i)) return true;
        return false;
    }

    private get isLastStep(): boolean {
        for (let i = this.index + 1; i < this.steps.length; i++) if (!this.unreachable.has(i)) return false;
        return true;
    }

    private get reachablePosition(): number {
        let position = 0;
        for (let i = 0; i <= this.index; i++) if (!this.unreachable.has(i)) position++;
        return position;
    }

    private resolveBranch(): number | null | undefined {
        const branch = this.steps[this.index]?.next;
        if (!branch) return undefined;
        let target: number | null;
        try {
            target = branch(branchContext(this.index));
        } catch (error) {
            this.reportHookError(this.index, error);
            return undefined;
        }
        if (target === null) return null;
        if (!Number.isInteger(target) || target < 0 || target >= this.steps.length) {
            this.reportHookError(this.index, new Error(`tour: step ${this.index} branched to out-of-range index ${target}`));
            return undefined;
        }
        return target;
    }

    // ---- Lifecycle --------------------------------------------------------------------------------------------------

    private syncActive(): void {
        if (this.active && !this.wasActive) {
            if (this.isCompleted()) {
                this.active = false;
                this.dispatchEvent(new CustomEvent<boolean>('active-change', { detail: false, bubbles: true, composed: true }));
                return;
            }
            this.wasActive = true;
            this.showedAStep = false;
            this.transition(0, 'initial');
        } else if (!this.active && this.wasActive) {
            this.wasActive = false;
            this.teardown();
        }
    }

    private finish(reason: TourEndReason): void {
        // A hook that resolves after this must not commit a step onto a closed tour, so invalidate before `active` flips.
        this.runToken++;
        this.abortInFlight();
        this.pending = false;
        this.active = false;
        if (this.showedAStep) writeCompleted(this.storageKey, true);
        this.dispatchEvent(new CustomEvent<boolean>('active-change', { detail: false, bubbles: true, composed: true }));
        this.dispatchEvent(new CustomEvent<TourEndReason>('done', { detail: reason, bubbles: true, composed: true }));
    }

    private reconcileStepsLength(length: number): void {
        if (length !== this.lastStepsLength) {
            // Indices shifted, so what was learned about them no longer applies.
            this.lastStepsLength = length;
            this.unreachable = new Set();
        }
        if (!this.wasActive || this.index < length) return;
        if (length === 0) this.finish('finished');
        else this.transition(length - 1, 'backward');
    }

    private abortInFlight(): void {
        this.abortController?.abort();
        this.abortController = null;
    }

    private teardown(): void {
        this.runToken++;
        this.abortInFlight();
        this.teardownObservers();
        this.clearHighlight();
        this.pending = false;
        this.ready = false;
    }

    // ---- Resolving steps --------------------------------------------------------------------------------------------

    private get hasAsyncSteps(): boolean {
        return this.targetTimeout > 0 || this.steps.some(hasHooks);
    }

    private transition(to: number, direction: TourDirection): void {
        if (this.steps.length === 0) return;
        // A fresh run re-tests every step: a list that was empty last time may have rows now.
        if (direction === 'initial') this.unreachable = new Set();
        this.abortInFlight();
        const token = ++this.runToken;
        if (!this.hasAsyncSteps) {
            this.commitOrFinish(this.scanSync(to, direction), this.index, direction);
            return;
        }
        const controller = new AbortController();
        this.abortController = controller;
        this.pending = true;
        void this.runAsyncTransition(to, direction, token, controller.signal);
    }

    private commitOrFinish(resolved: ResolvedStep | null, from: number, direction: TourDirection): void {
        if (resolved) {
            this.commitStep(resolved);
            return;
        }
        const fallback = direction === 'backward' ? this.scanSync(from, 'forward') : null;
        if (fallback) this.commitStep(fallback);
        else this.finish('finished');
    }

    private scanSync(start: number, direction: TourDirection): ResolvedStep | null {
        const delta = direction === 'backward' ? -1 : 1;
        for (let i = start; i >= 0 && i < this.steps.length; i += delta) {
            const step = this.steps[i];
            if (!step) continue;
            const el = this.queryRendered(step.target);
            if (el) return { el, index: i };
            this.reportMissingTarget(i, step.target);
        }
        return null;
    }

    private async runAsyncTransition(to: number, direction: TourDirection, token: number, signal: AbortSignal): Promise<void> {
        const from = this.index;
        if (direction !== 'initial') await this.runExitHook(from, direction, signal);
        if (token !== this.runToken) return;
        let resolved = await this.scanAsync(to, direction, token, signal);
        if (!resolved && direction === 'backward') resolved = await this.scanAsync(from, 'forward', token, signal);
        if (token !== this.runToken) return;
        if (resolved) this.commitStep(resolved);
        else this.finish('finished');
    }

    private async runExitHook(index: number, direction: TourDirection, signal: AbortSignal): Promise<void> {
        const hook = this.steps[index]?.afterDeactivate;
        if (!hook) return;
        try {
            await hook({ index, direction, signal });
        } catch (error) {
            this.reportHookError(index, error);
        }
    }

    private async scanAsync(start: number, direction: TourDirection, token: number, signal: AbortSignal): Promise<ResolvedStep | null> {
        const delta = direction === 'backward' ? -1 : 1;
        for (let i = start; i >= 0 && i < this.steps.length; i += delta) {
            const step = this.steps[i];
            if (!step) continue;
            if (!(await this.prepareStep(step, { index: i, direction, signal }))) continue;
            const el = await this.awaitTarget(step, signal);
            if (token !== this.runToken) return null;
            if (el) return { el, index: i };
            this.reportMissingTarget(i, step.target);
        }
        return null;
    }

    private async prepareStep(step: TourStep, ctx: TourStepContext): Promise<boolean> {
        try {
            if (step.when && !(await step.when(ctx))) {
                this.markUnreachable(ctx.index);
                this.emitSkipped(ctx.index, 'condition');
                return false;
            }
            await step.beforeActivate?.(ctx);
            return true;
        } catch (error) {
            this.reportHookError(ctx.index, error);
            this.markUnreachable(ctx.index);
            this.emitSkipped(ctx.index, 'hook-error');
            return false;
        }
    }

    private emitSkipped(index: number, reason: TourSkipReason): void {
        this.dispatchEvent(new CustomEvent<TourSkippedEvent>('step-skipped', { detail: { index, reason }, bubbles: true, composed: true }));
    }

    private reportMissingTarget(index: number, target: string): void {
        console.warn(`[ge-tour] target not found: "${target}", skipping step.`);
        this.markUnreachable(index);
        this.emitSkipped(index, 'missing-target');
    }

    private reportHookError(index: number, error: unknown): void {
        console.warn(`[ge-tour] step ${index} hook failed, falling back to the default path.`, error);
    }

    private markUnreachable(index: number): void {
        this.unreachable = new Set(this.unreachable).add(index);
    }

    private markReachable(index: number): void {
        if (!this.unreachable.has(index)) return;
        const next = new Set(this.unreachable);
        next.delete(index);
        this.unreachable = next;
    }

    private async awaitTarget(step: TourStep, signal: AbortSignal): Promise<HTMLElement | null> {
        const immediate = this.queryRendered(step.target);
        if (immediate) return immediate;
        const timeout = step.targetTimeout ?? this.targetTimeout;
        if (timeout <= 0 || signal.aborted) return null;
        return this.pollForTarget(step.target, timeout, signal);
    }

    private pollForTarget(selector: string, timeout: number, signal: AbortSignal): Promise<HTMLElement | null> {
        return new Promise<HTMLElement | null>((resolve) => {
            const cleanups: Array<() => void> = [];
            let settled = false;
            const settle = (el: HTMLElement | null): void => {
                if (settled) return;
                settled = true;
                for (const cleanup of cleanups) cleanup();
                resolve(el);
            };
            const check = (): void => {
                const el = this.queryRendered(selector);
                if (el) settle(el);
            };
            const observer = new MutationObserver(check);
            observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
            cleanups.push(() => observer.disconnect());
            const timer = setTimeout(() => settle(null), timeout);
            cleanups.push(() => clearTimeout(timer));
            const onAbort = (): void => settle(null);
            signal.addEventListener('abort', onAbort, { once: true });
            cleanups.push(() => signal.removeEventListener('abort', onAbort));
            check();
        });
    }

    private queryRendered(selector: string): HTMLElement | null {
        let el: HTMLElement | null;
        try {
            el = document.querySelector<HTMLElement>(selector);
        } catch {
            console.warn(`[ge-tour] invalid target selector: "${selector}", skipping step.`);
            return null;
        }
        if (!el?.isConnected) return null;
        return isRendered(el) ? el : null;
    }

    // ---- Showing a step ---------------------------------------------------------------------------------------------

    private commitStep({ el, index }: ResolvedStep): void {
        this.showedAStep = true;
        this.markReachable(index);
        this.teardownObservers();
        this.clearHighlight();
        this.pending = false;
        this.ready = false;
        this.index = index;
        this.dispatchEvent(new CustomEvent<number>('step-change', { detail: index, bubbles: true, composed: true }));

        this.applyHighlight(el);
        this.currentTarget = el;
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
        this.readRect(el);
        this.setupObservers(el);
        void this.settle(el);
    }

    /** The card is measured once it has rendered the new step's text, then shown and focused. */
    private async settle(el: HTMLElement): Promise<void> {
        await this.updateComplete;
        if (this.currentTarget !== el) return;
        this.readRect(el);
        this.measureCard();
        this.ready = true;
        await this.updateComplete;
        if (this.currentTarget === el) this.card.value?.focus({ preventScroll: true });
    }

    /** A target can vanish mid-step (a list reloads, a panel closes): follow the selector to its replacement, or move on. */
    private reposition(el: HTMLElement): void {
        if (el.isConnected) {
            this.readRect(el);
            return;
        }
        const step = this.steps[this.index];
        const replacement = step ? this.queryRendered(step.target) : null;
        if (replacement) {
            this.teardownObservers();
            this.clearHighlight();
            this.applyHighlight(replacement);
            this.currentTarget = replacement;
            this.readRect(replacement);
            this.setupObservers(replacement);
            return;
        }
        this.emitSkipped(this.index, 'missing-target');
        this.transition(this.index + 1, 'forward');
    }

    private readRect(el: HTMLElement): void {
        const r = el.getBoundingClientRect();
        this.targetRect = { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
    }

    private measureCard(): void {
        const card = this.card.value;
        if (!card) return;
        const width = card.offsetWidth || DEFAULT_CARD_WIDTH;
        const height = card.offsetHeight || DEFAULT_CARD_HEIGHT;
        if (width !== this.cardSize.width || height !== this.cardSize.height) this.cardSize = { width, height };
    }

    private setupObservers(el: HTMLElement): void {
        const onReposition = (): void => this.reposition(el);
        this.resizeObserver = new ResizeObserver(onReposition);
        this.resizeObserver.observe(el);
        addEventListener('scroll', onReposition, { passive: true, capture: true });
        addEventListener('resize', onReposition, { passive: true });
        this.removeReposition = () => {
            removeEventListener('scroll', onReposition, { capture: true });
            removeEventListener('resize', onReposition);
        };
    }

    private teardownObservers(): void {
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        this.removeReposition?.();
        this.removeReposition = null;
    }

    private applyHighlight(el: HTMLElement): void {
        this.savedStyles = { outline: el.style.outline, outlineOffset: el.style.outlineOffset, position: el.style.position, zIndex: el.style.zIndex, borderRadius: el.style.borderRadius, transition: el.style.transition };
        el.setAttribute(HIGHLIGHT_ATTR, '');
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
        el.style.zIndex = '10001';
        el.style.outline = '2px solid var(--ring, #0ea5e9)';
        el.style.outlineOffset = '4px';
        el.style.borderRadius = '6px';
        el.style.transition = 'outline 0.15s ease';
    }

    private clearHighlight(): void {
        const el = this.currentTarget;
        const saved = this.savedStyles;
        if (el && saved) {
            el.style.outline = saved.outline;
            el.style.outlineOffset = saved.outlineOffset;
            el.style.position = saved.position;
            el.style.zIndex = saved.zIndex;
            el.style.borderRadius = saved.borderRadius;
            el.style.transition = saved.transition;
            el.removeAttribute(HIGHLIGHT_ATTR);
        }
        this.currentTarget = null;
        this.savedStyles = null;
    }

    // ---- Rendering --------------------------------------------------------------------------------------------------

    private readonly onKeydown = (event: KeyboardEvent): void => {
        // On a button Enter already clicks it; advancing here as well would run both.
        const onButton = (event.target as Element).closest('ge-button') !== null;
        switch (event.key) {
            case 'Enter':
                if (onButton) return;
                event.preventDefault();
                this.next();
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.next();
                break;
            case 'ArrowLeft':
                event.preventDefault();
                this.previous();
                break;
            case 'Escape':
                event.preventDefault();
                this.skip();
                break;
        }
    };

    protected override render() {
        const step = this.active ? this.steps[this.index] : undefined;
        if (!step) return nothing;
        const t = resolveCommonLocale(this.locale);
        const position = computeCardPosition(this.targetRect, this.cardSize, step.side);
        const last = this.isLastStep;
        const spot = this.targetRect;
        return html`
            ${this.pending
                ? html`<div class="scrim" data-slot="tour-scrim"></div>`
                : this.ready
                  ? html`<div class="spotlight" data-slot="tour-spotlight" style=${`top:${spot.top - SPOTLIGHT_PAD}px;left:${spot.left - SPOTLIGHT_PAD}px;width:${spot.width + SPOTLIGHT_PAD * 2}px;height:${spot.height + SPOTLIGHT_PAD * 2}px`}></div>`
                  : nothing}
            <div
                ${ref(this.card)}
                class="card"
                part="card"
                data-slot="tour-card"
                tabindex="-1"
                style=${`top:${position.top}px;left:${position.left}px;visibility:${this.ready || this.pending ? 'visible' : 'hidden'}`}
                dir=${t.rtl ? 'rtl' : nothing}
                aria-busy=${this.pending ? 'true' : nothing}
                ?data-pending=${this.pending}
                @keydown=${this.onKeydown}
            >
                <div class="counter">${`${this.reachablePosition} / ${this.steps.length - this.unreachable.size}`}</div>
                <h3 class="title">${step.title}</h3>
                ${step.description ? html`<p class="description">${step.description}</p>` : nothing}
                <div class="actions">
                    ${this.pending ? html`<span class="pending" data-slot="tour-pending">${t.tourLoading}</span>` : nothing}
                    ${this.showSkip && !last ? html`<ge-button variant="ghost" size="sm" @click=${() => this.skip()}>${this.skipLabel ?? t.tourSkip}</ge-button>` : nothing}
                    ${this.canGoBack ? html`<ge-button variant="outline" size="sm" ?disabled=${this.pending} @click=${() => this.previous()}>${this.prevLabel ?? t.tourPrevious}</ge-button>` : nothing}
                    <ge-button size="sm" ?disabled=${this.pending} @click=${() => this.next()}>${last ? (this.finishLabel ?? t.tourFinish) : (this.nextLabel ?? t.tourNext)}</ge-button>
                </div>
            </div>
        `;
    }
}

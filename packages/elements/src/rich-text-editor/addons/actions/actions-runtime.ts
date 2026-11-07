import { ACTIONS_SANITIZER_RULES, readActions, type ActionAttributeRule } from './actions-serializer.js';
import type { ActionParams, RichTextActionTrigger } from './actions-types.js';

/** The event delivered to a handler when an action fires on rendered HTML. */
export interface RichTextActionEvent {
    actionId: string;
    trigger: RichTextActionTrigger;
    params: ActionParams;
    /** The actioned span/img the event resolved to. */
    element: HTMLElement;
    /** The originating DOM event. */
    domEvent: Event;
    /** Hover: `'start'` on enter, `'end'` on leave. Click: always `'start'`. */
    phase: 'start' | 'end';
}

export type RichTextActionHandler = (event: RichTextActionEvent) => void;

export interface BindRichTextActionsOptions {
    /** Handlers per action id, plus an optional `'*'` catch-all. */
    handlers: Record<string, RichTextActionHandler>;
    /** `'tap-to-hover'` (default) maps the first tap to hover start on touch; `'off'` delivers no hover on touch. */
    touchHoverBehavior?: 'tap-to-hover' | 'off';
    /** Adds tabindex and role to actioned elements. Default true. */
    a11yAffordances?: boolean;
    /** Class added to every actioned element (styling hook), or null for none. Default `'rte-action'`. */
    decorateClass?: string | null;
    /**
     * The sanitizer that cleans this container's HTML (an editor's `sanitizer`, for instance). Its
     * attribute rules are widened for `data-action-*` while the binding lives, which is what makes
     * actions survive on a page that has no editor. Register before the content is sanitized.
     */
    sanitizer?: { registerAttributeRules(rules: ActionAttributeRule[]): () => void };
}

const CLICK_ATTR = 'data-action-click';
const HOVER_ATTR = 'data-action-hover';
const ACTIONED = `[${CLICK_ATTR}],[${HOVER_ATTR}]`;

type Phase = 'start' | 'end';

/**
 * Binds delegated click, hover, focus and touch listeners for actions to a container and keeps new
 * actioned elements decorated when its content is swapped. Returns the function that unbinds it.
 */
export function bindRichTextActions(container: HTMLElement, options: BindRichTextActionsOptions): () => void {
    const a11y = options.a11yAffordances ?? true;
    const decorateClass = options.decorateClass === undefined ? 'rte-action' : options.decorateClass;
    const touchHover = options.touchHoverBehavior ?? 'tap-to-hover';
    const decorated = new Set<HTMLElement>();
    let tapHoverEl: HTMLElement | null = null;

    const decorate = (): void => {
        for (const el of container.querySelectorAll<HTMLElement>(ACTIONED)) {
            if (!decorated.has(el)) decorateElement(el, a11y, decorateClass);
            decorated.add(el);
        }
    };
    const releaseRules = options.sanitizer?.registerAttributeRules([...ACTIONS_SANITIZER_RULES]);
    decorate();
    const observer = new MutationObserver(decorate);
    observer.observe(container, { childList: true, subtree: true });

    const hover = (phase: Phase) => (e: Event) => dispatchHover(e, container, options, phase);
    const focus = (phase: Phase) => (e: Event) => {
        const el = actionedAncestor(e.target, container, HOVER_ATTR);
        if (el) emit(options, el, HOVER_ATTR, 'hover', e, phase);
    };
    const listeners: [string, (e: Event) => void][] = [
        ['click', (e) => dispatchClick(e, container, options)],
        ['keydown', (e) => dispatchKeydown(e as KeyboardEvent, container, options)],
        ['mouseover', hover('start')],
        ['mouseout', hover('end')],
        ['focusin', focus('start')],
        ['focusout', focus('end')],
        ['touchend', (e) => {
            tapHoverEl = touchHover === 'off' ? null : dispatchTouch(e, container, options, tapHoverEl);
        }],
    ];
    for (const [type, fn] of listeners) container.addEventListener(type, fn);

    return () => {
        for (const [type, fn] of listeners) container.removeEventListener(type, fn);
        observer.disconnect();
        releaseRules?.();
        for (const el of decorated) revertDecoration(el, decorateClass);
    };
}

function decorateElement(el: HTMLElement, a11y: boolean, decorateClass: string | null): void {
    const click = el.hasAttribute(CLICK_ATTR);
    if (decorateClass) {
        el.classList.add(decorateClass);
        if (click) el.classList.add(`${decorateClass}-click`);
        if (el.hasAttribute(HOVER_ATTR)) el.classList.add(`${decorateClass}-hover`);
    }
    if (!a11y) return;
    el.setAttribute('tabindex', '0');
    if (click) el.setAttribute('role', 'button');
}

function revertDecoration(el: HTMLElement, decorateClass: string | null): void {
    if (decorateClass) {
        el.classList.remove(decorateClass, `${decorateClass}-click`, `${decorateClass}-hover`);
        if (el.className === '') el.removeAttribute('class');
    }
    el.removeAttribute('tabindex');
    el.removeAttribute('role');
}

function actionedAncestor(target: EventTarget | null, container: HTMLElement, attr: string): HTMLElement | null {
    let el = target instanceof HTMLElement ? target : null;
    while (el && container.contains(el)) {
        if (el.hasAttribute(attr)) return el;
        el = el.parentElement;
    }
    return null;
}

function emit(
    options: BindRichTextActionsOptions, el: HTMLElement, attr: string,
    trigger: RichTextActionTrigger, domEvent: Event, phase: Phase,
): void {
    const actionId = el.getAttribute(attr);
    if (!actionId) return;
    const params = readActions(el).find((a) => a.trigger === trigger)?.params ?? {};
    const event: RichTextActionEvent = { actionId, trigger, params, element: el, domEvent, phase };
    options.handlers[actionId]?.(event);
    options.handlers['*']?.(event);
}

function dispatchClick(e: Event, container: HTMLElement, options: BindRichTextActionsOptions): void {
    const el = actionedAncestor(e.target, container, CLICK_ATTR);
    if (el) emit(options, el, CLICK_ATTR, 'click', e, 'start');
}

function dispatchKeydown(e: KeyboardEvent, container: HTMLElement, options: BindRichTextActionsOptions): void {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = actionedAncestor(e.target, container, CLICK_ATTR);
    if (!el) return;
    e.preventDefault();
    emit(options, el, CLICK_ATTR, 'click', e, 'start');
}

function dispatchHover(e: Event, container: HTMLElement, options: BindRichTextActionsOptions, phase: Phase): void {
    const el = actionedAncestor(e.target, container, HOVER_ATTR);
    if (!el) return;
    const related = e instanceof MouseEvent && e.relatedTarget instanceof Node ? e.relatedTarget : null;
    if (related && el.contains(related)) return;
    emit(options, el, HOVER_ATTR, 'hover', e, phase);
}

/**
 * Handles a touch tap and returns the element tap-to-hover currently holds open. The first tap on a
 * hover element shows it (and cancels the synthetic click); a tap elsewhere closes it; a second tap
 * on the held element, or a tap on a click-only element, fires the click.
 */
function dispatchTouch(
    e: Event, container: HTMLElement, options: BindRichTextActionsOptions, current: HTMLElement | null,
): HTMLElement | null {
    const hoverEl = actionedAncestor(e.target, container, HOVER_ATTR);
    let held = current;
    if (held && held !== hoverEl) {
        emit(options, held, HOVER_ATTR, 'hover', e, 'end');
        held = null;
    }
    if (hoverEl && held !== hoverEl) {
        e.preventDefault();
        emit(options, hoverEl, HOVER_ATTR, 'hover', e, 'start');
        return hoverEl;
    }
    const clickEl = actionedAncestor(e.target, container, CLICK_ATTR);
    if (clickEl) {
        e.preventDefault();
        emit(options, clickEl, CLICK_ATTR, 'click', e, 'start');
    }
    return held;
}

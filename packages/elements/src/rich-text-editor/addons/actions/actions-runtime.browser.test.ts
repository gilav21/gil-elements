import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindRichTextActions, type RichTextActionEvent } from './actions-runtime.js';

const cleanups: (() => void)[] = [];

afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
});

function container(html: string): HTMLElement {
    const el = document.createElement('div');
    el.innerHTML = html;
    document.body.append(el);
    cleanups.push(() => el.remove());
    return el;
}

/** Binds and registers the unbind for cleanup. */
function bind(el: HTMLElement, options: Parameters<typeof bindRichTextActions>[1]): () => void {
    const off = bindRichTextActions(el, options);
    cleanups.push(off);
    return off;
}

const first = (el: HTMLElement): HTMLElement => el.querySelector('span')!;

describe('bindRichTextActions', () => {
    it('fires the click handler with id, params, element', () => {
        const el = container('<span data-action-click="open-dialog" data-action-click-params=\'{"dialogId":"p"}\'>t</span>');
        const seen: RichTextActionEvent[] = [];
        bind(el, { handlers: { 'open-dialog': (e) => seen.push(e) } });
        first(el).click();
        expect(seen[0]?.actionId).toBe('open-dialog');
        expect(seen[0]?.params).toEqual({ dialogId: 'p' });
        expect(seen[0]?.trigger).toBe('click');
        expect(seen[0]?.phase).toBe('start');
    });

    it('fires innermost only for nested action spans', () => {
        const el = container('<span data-action-click="outer"><span data-action-click="inner">t</span></span>');
        const ids: string[] = [];
        bind(el, { handlers: { '*': (e) => ids.push(e.actionId) } });
        el.querySelector<HTMLElement>('span span')!.click();
        expect(ids).toEqual(['inner']);
    });

    it('delivers hover start/end pairs', () => {
        const el = container('<span data-action-hover="term">t</span>');
        const phases: string[] = [];
        bind(el, { handlers: { term: (e) => phases.push(e.phase) } });
        first(el).dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: el }));
        first(el).dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: el }));
        expect(phases).toEqual(['start', 'end']);
    });

    it('does not re-fire hover when moving between child nodes of the same span', () => {
        const el = container('<span data-action-hover="term"><b>a</b><i>b</i></span>');
        const phases: string[] = [];
        bind(el, { handlers: { term: (e) => phases.push(e.phase) } });
        const b = el.querySelector('b')!;
        const i = el.querySelector('i')!;
        b.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: el }));
        b.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: i }));
        expect(phases).toEqual(['start']);
    });

    it('fires specific handler before catch-all', () => {
        const el = container('<span data-action-click="a">t</span>');
        const order: string[] = [];
        bind(el, { handlers: { a: () => order.push('specific'), '*': () => order.push('catchall') } });
        first(el).click();
        expect(order).toEqual(['specific', 'catchall']);
    });

    it('applies a11y affordances and reverts them on unbind', () => {
        const el = container('<span data-action-click="a">t</span>');
        const off = bind(el, { handlers: { a: () => undefined } });
        const span = first(el);
        expect(span.getAttribute('tabindex')).toBe('0');
        expect(span.getAttribute('role')).toBe('button');
        expect(span.classList.contains('rte-action-click')).toBe(true);
        off();
        expect(span.hasAttribute('tabindex')).toBe(false);
        expect(span.hasAttribute('role')).toBe(false);
        expect(span.classList.contains('rte-action-click')).toBe(false);
    });

    it('stops delivering after unbind', () => {
        const el = container('<span data-action-click="a">t</span>');
        const fn = vi.fn();
        const off = bind(el, { handlers: { a: fn } });
        off();
        first(el).click();
        expect(fn).not.toHaveBeenCalled();
    });

    it('adds no classes when decorateClass is null', () => {
        const el = container('<span data-action-click="a">t</span>');
        bind(el, { handlers: { a: () => undefined }, decorateClass: null });
        expect(first(el).className).toBe('');
    });

    it('Enter activates a click action for keyboard users', () => {
        const el = container('<span data-action-click="a">t</span>');
        const fn = vi.fn();
        bind(el, { handlers: { a: fn } });
        first(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('focusin/focusout deliver hover start/end for keyboard', () => {
        const el = container('<span data-action-hover="term">t</span>');
        const phases: string[] = [];
        bind(el, { handlers: { term: (e) => phases.push(e.phase) } });
        first(el).dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        first(el).dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        expect(phases).toEqual(['start', 'end']);
    });

    it('tap-to-hover: first tap shows hover + suppresses click; second tap fires click', () => {
        const el = container('<span data-action-hover="h" data-action-click="c">t</span>');
        const events: string[] = [];
        bind(el, {
            handlers: { h: (e) => events.push(`hover:${e.phase}`), c: () => events.push('click') },
            touchHoverBehavior: 'tap-to-hover',
        });
        const firstTap = new Event('touchend', { bubbles: true, cancelable: true });
        first(el).dispatchEvent(firstTap);
        expect(events).toEqual(['hover:start']);
        expect(firstTap.defaultPrevented).toBe(true);
        first(el).dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
        expect(events).toContain('click');
    });

    it('tap-to-hover: tapping outside the held element delivers hover end', () => {
        const el = container('<span data-action-hover="h">t</span><em>outside</em>');
        const phases: string[] = [];
        bind(el, { handlers: { h: (e) => phases.push(e.phase) }, touchHoverBehavior: 'tap-to-hover' });
        first(el).dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
        el.querySelector('em')!.dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
        expect(phases).toEqual(['start', 'end']);
    });

    it('touchHoverBehavior off delivers nothing on touch', () => {
        const el = container('<span data-action-hover="h">t</span>');
        const events: string[] = [];
        bind(el, { handlers: { h: (e) => events.push(e.phase) }, touchHoverBehavior: 'off' });
        first(el).dispatchEvent(new Event('touchend', { bubbles: true }));
        expect(events).toEqual([]);
    });

    it('delivers nothing when the click attribute is present but empty', () => {
        const el = container('<span data-action-click="">t</span>');
        const fn = vi.fn();
        bind(el, { handlers: { '*': fn } });
        first(el).dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(fn).not.toHaveBeenCalled();
    });

    it('ignores keydown for keys other than Enter or Space', () => {
        const el = container('<span data-action-click="a">t</span>');
        const fn = vi.fn();
        bind(el, { handlers: { a: fn } });
        first(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
        expect(fn).not.toHaveBeenCalled();
    });

    it('ignores Enter keydown when the target is not an actioned element', () => {
        const el = container('<span data-action-click="a">t</span><em>plain</em>');
        const fn = vi.fn();
        bind(el, { handlers: { a: fn } });
        el.querySelector('em')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(fn).not.toHaveBeenCalled();
    });

    it('ignores hover over a non-actioned element', () => {
        const el = container('<span data-action-hover="h">t</span><em>plain</em>');
        const fn = vi.fn();
        bind(el, { handlers: { h: fn } });
        el.querySelector('em')!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        expect(fn).not.toHaveBeenCalled();
    });

    it('delivers hover when the mouseover carries no related target', () => {
        const el = container('<span data-action-hover="term">t</span>');
        const phases: string[] = [];
        bind(el, { handlers: { term: (e) => phases.push(e.phase) } });
        first(el).dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        expect(phases).toEqual(['start']);
    });
});

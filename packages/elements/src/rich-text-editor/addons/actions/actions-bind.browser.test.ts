import { afterEach, describe, expect, it, vi } from 'vitest';
import { RichTextSanitizer } from '../../rich-text-sanitizer.js';
import { bindRichTextActions, type RichTextActionEvent } from './actions-runtime.js';
import { ACTIONS_SANITIZER_RULES } from './actions-serializer.js';

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));
const cleanups: (() => void)[] = [];

afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
});

function article(): HTMLElement {
    const el = document.createElement('article');
    document.body.append(el);
    cleanups.push(() => el.remove());
    return el;
}

describe('bindRichTextActions on a rendered page', () => {
    it('delivers events for content and stops after unbind', () => {
        const el = article();
        const events: RichTextActionEvent[] = [];
        const off = bindRichTextActions(el, { handlers: { a: (e) => events.push(e) } });
        el.innerHTML = '<span data-action-click="a">t</span>';
        const span = el.querySelector('span')!;
        span.click();
        expect(events).toHaveLength(1);
        off();
        span.click();
        expect(events).toHaveLength(1);
    });

    it('re-decorates new elements after an innerHTML swap (MutationObserver)', async () => {
        const el = article();
        const events: RichTextActionEvent[] = [];
        cleanups.push(bindRichTextActions(el, { handlers: { a: (e) => events.push(e) } }));
        el.innerHTML = '<span data-action-click="a">new</span>';
        await tick();
        const span = el.querySelector('span')!;
        expect(span.getAttribute('tabindex')).toBe('0');
        expect(span.getAttribute('role')).toBe('button');
        span.click();
        expect(events).toHaveLength(1);
    });

    describe('sanitizer rules', () => {
        const ACTION_HTML = '<p><span data-action-click="a" data-action-click-params=\'{"id":1}\'>t</span></p>';

        it('registers the action attribute rules for the binding lifetime', () => {
            const sanitizer = new RichTextSanitizer();
            const off = bindRichTextActions(article(), { handlers: {}, sanitizer });
            expect(sanitizer.sanitize(ACTION_HTML)).toContain('data-action-click="a"');
            expect(sanitizer.sanitize(ACTION_HTML)).toContain('data-action-click-params');

            off();
            expect(sanitizer.sanitize(ACTION_HTML)).not.toContain('data-action-click');
        });

        it('keeps the rules while a second binding still holds them', () => {
            const sanitizer = new RichTextSanitizer();
            const first = bindRichTextActions(article(), { handlers: {}, sanitizer });
            const second = bindRichTextActions(article(), { handlers: {}, sanitizer });

            first();
            expect(sanitizer.sanitize(ACTION_HTML)).toContain('data-action-click="a"');
            second();
            expect(sanitizer.sanitize(ACTION_HTML)).not.toContain('data-action-click');
        });

        it('registers the shared rules constant', () => {
            const sanitizer = new RichTextSanitizer();
            const spy = vi.spyOn(sanitizer, 'registerAttributeRules');
            cleanups.push(bindRichTextActions(article(), { handlers: {}, sanitizer }));
            expect(spy).toHaveBeenCalledWith([...ACTIONS_SANITIZER_RULES]);
        });
    });
});

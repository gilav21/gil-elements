import { describe, expect, it } from 'vitest';
import { KEY_PRIORITY } from './rich-text-key-priority.js';

describe('KEY_PRIORITY', () => {
    it('is frozen and gives every handler its own slot', () => {
        const slots = Object.values(KEY_PRIORITY);

        expect(Object.isFrozen(KEY_PRIORITY)).toBe(true);
        expect(new Set(slots).size).toBe(slots.length);
    });

    it('keeps the original editor order, interceptors first and the code block rule last', () => {
        const inOrder = [
            'interceptor',
            'shortcuts',
            'undoRedo',
            'revertInputRule',
            'confineCaret',
            'joinTaskRows',
            'verticalArrow',
            'tableDelete',
            'tab',
            'enterCodeFence',
            'enterTaskList',
            'enterSummary',
            'enterDetailsEnd',
            'enterBlockquote',
            'enterLeavingList',
            'enterInlineCode',
            'enterCodeBlock',
        ] as const;

        const priorities = inOrder.map((slot) => KEY_PRIORITY[slot]);

        expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
    });
});

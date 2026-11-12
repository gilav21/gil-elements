import { describe, expect, it } from 'vitest';
import { TOUCH_SLOP_PX, withinTouchSlop } from './touch.js';

describe('withinTouchSlop', () => {
    it('is a drift of at most TOUCH_SLOP_PX in any direction (the straight-line distance)', () => {
        expect(TOUCH_SLOP_PX).toBe(10);
        expect(withinTouchSlop(0, 0)).toBe(true);
        expect(withinTouchSlop(10, 0)).toBe(true);
        expect(withinTouchSlop(6, 8)).toBe(true); // exactly 10
        expect(withinTouchSlop(8, 8)).toBe(false); // about 11.3
        expect(withinTouchSlop(-11, 0)).toBe(false);
        expect(withinTouchSlop(3, 0, 2)).toBe(false); // a custom slop
    });
});

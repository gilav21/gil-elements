import { html, nothing } from 'lit';
import { describe, expect, it } from 'vitest';
import { isEmptyContent } from './data-table-grid-head.js';

describe('isEmptyContent', () => {
    it('takes every renderer answer that draws nothing as empty: nothing, null, undefined and the empty string', () => {
        for (const empty of [nothing, null, undefined, '']) expect(isEmptyContent(empty)).toBe(true);
    });

    it('takes anything that draws something as content', () => {
        for (const content of [html`<b></b>`, 'x', 0, false]) expect(isEmptyContent(content)).toBe(false);
    });
});

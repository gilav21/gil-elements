import { describe, expect, it } from 'vitest';
import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';
import { html } from 'lit';
import './badge/define.js';
import './kbd/define.js';
import './label/define.js';
import './separator/define.js';
import './skeleton/define.js';
import './spinner/define.js';

// Server rendering: nothing in these elements may touch the DOM while rendering.
describe('elements on the server', () => {
    it.each([
        ['ge-kbd', html`<ge-kbd>Ctrl</ge-kbd>`, '<kbd'],
        ['ge-label', html`<ge-label for="x">Email</ge-label>`, '<slot'],
        ['ge-separator', html`<ge-separator .orientation=${'vertical'}></ge-separator>`, 'aria-orientation="vertical"'],
        ['ge-skeleton', html`<ge-skeleton .variant=${'shimmer'}></ge-skeleton>`, 'variant="shimmer"'],
        ['ge-spinner', html`<ge-spinner variant="dots" label="Saving"></ge-spinner>`, 'aria-label="Saving"'],
    ])('%s renders into a declarative shadow root', async (tag, template, expected) => {
        const out = await collectResult(render(template));

        expect(out).toContain(`<${tag}`);
        expect(out).toContain('shadowrootmode="open"');
        expect(out).toContain(expected);
    });
});

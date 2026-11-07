import { describe, expect, it } from 'vitest';
import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';
import { html } from 'lit';
import './define.js';

describe('ge-rich-text-editor on the server', () => {
    it('renders its chrome in a declarative shadow root without touching the DOM', async () => {
        const out = await collectResult(render(html`<ge-rich-text-editor .variant=${'ghost'} .value=${'# Title'} counter="words"></ge-rich-text-editor>`));

        expect(out).toContain('<template shadowroot="open" shadowrootmode="open"');
        expect(out).toContain('name="editable"');
        expect(out).toContain('part="container"');
        expect(out).toContain('variant="ghost"');
    });
});

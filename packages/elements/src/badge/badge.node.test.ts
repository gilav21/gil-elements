import { describe, expect, it } from 'vitest';
import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';
import { html } from 'lit';
import './define.js';

describe('ge-badge on the server', () => {
    it('renders its content in a declarative shadow root and reflects properties to attributes', async () => {
        const out = await collectResult(render(html`<ge-badge .variant=${'secondary'} label="New"></ge-badge>`));

        expect(out).toContain('<template shadowroot="open" shadowrootmode="open"');
        expect(out).toContain('New');
        expect(out).toContain('variant="secondary"');
    });
});

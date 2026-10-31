import { describe, expect, it } from 'vitest';
import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';
import { html } from 'lit';
import './alert/define.js';
import './avatar/define.js';
import './badge/define.js';
import './button/define.js';
import './button-group/define.js';
import './card/define.js';
import './empty/define.js';
import './kbd/define.js';
import './label/define.js';
import './page-header/define.js';
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
        ['ge-alert', html`<ge-alert variant="destructive" heading="Failed"></ge-alert>`, 'role="alert"'],
        ['ge-avatar', html`<ge-avatar fallback="JD"></ge-avatar>`, 'JD'],
        ['ge-button', html`<ge-button variant="outline" aria-label="Close">x</ge-button>`, 'aria-label="Close"'],
        ['ge-button-group', html`<ge-button-group orientation="vertical"></ge-button-group>`, 'role="group"'],
        ['ge-card', html`<ge-card heading="Plan" description="Monthly"></ge-card>`, 'Monthly'],
        ['ge-card-header', html`<ge-card-header bordered></ge-card-header>`, 'name="action"'],
        ['ge-empty', html`<ge-empty><ge-empty-title>None</ge-empty-title></ge-empty>`, '<slot'],
        ['ge-page-header', html`<ge-page-header heading="Invoices" .headingLevel=${2}></ge-page-header>`, '<h2'],
    ])('%s renders into a declarative shadow root', async (tag, template, expected) => {
        const out = await collectResult(render(template));

        expect(out).toContain(`<${tag}`);
        expect(out).toContain('shadowrootmode="open"');
        expect(out).toContain(expected);
    });
});

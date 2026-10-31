import { html, svg, type TemplateResult } from 'lit';

/**
 * The loading scrim used by card and avatar. It is plain markup plus a stylesheet
 * (`loading-overlay.css`) that the owning element adds to its own `styles`, because elements
 * never rely on each other's tags: a `<ge-spinner>` here would break under a custom prefix.
 */
export function loadingOverlay(size: 'small' | 'default'): TemplateResult {
    return html`<div class="overlay ${size === 'small' ? 'small' : ''}" part="overlay">
        <output aria-label="Loading">${svg`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>`}</output>
    </div>`;
}

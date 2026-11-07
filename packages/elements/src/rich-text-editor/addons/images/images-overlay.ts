import { html, nothing, type TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import type { RichTextImagesLocale } from './images-locale.js';
import type { ImageResizer } from './images-resizer.js';

/** A failed auto-upload: the image and the base64 source it started from. */
export interface ImageUploadFailure {
    readonly dataUrl: string;
    readonly image: HTMLImageElement;
}

export interface ImagesOverlayState {
    readonly locale: RichTextImagesLocale;
    readonly uploading: boolean;
    readonly failures: ReadonlyMap<string, ImageUploadFailure>;
    /** The positioned element the layer is drawn in; badges are measured against it. */
    readonly origin: HTMLElement;
    readonly resizer: ImageResizer;
    readonly onRetry: (id: string) => void;
    readonly onRemove: (id: string) => void;
}

const ERROR_ICON = '<svg class="image-error-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/></svg>';

function renderFailure(id: string, failure: ImageUploadFailure, state: ImagesOverlayState): TemplateResult | typeof nothing {
    if (!failure.image.isConnected) return nothing;
    const box = failure.image.getBoundingClientRect();
    const origin = state.origin.getBoundingClientRect();
    const { locale } = state;
    const style = styleMap({
        top: `${box.top - origin.top}px`,
        left: `${box.left - origin.left}px`,
        width: `${Math.max(box.width, 120)}px`,
        height: `${Math.max(box.height, 80)}px`,
    });
    return html`<div class="image-error" data-slot="rte-images-error" style=${style} contenteditable="false">
        ${unsafeHTML(ERROR_ICON)}
        <span class="image-error-text">${locale.uploadFailed}</span>
        <div class="image-error-actions">
            <button type="button" @click=${() => state.onRetry(id)}>${locale.uploadRetry}</button>
            <button type="button" @click=${() => state.onRemove(id)}>${locale.uploadRemove}</button>
        </div>
    </div>`;
}

/** The images layer: the uploading scrim, one badge per failed auto-upload and the resizer frame. */
export function renderImagesOverlay(state: ImagesOverlayState): TemplateResult {
    return html`${state.uploading ? html`<div class="image-uploading" data-slot="rte-images-uploading">${state.locale.uploading}</div>` : nothing}
        ${[...state.failures].map(([id, failure]) => renderFailure(id, failure, state))}
        ${state.resizer.render()}`;
}

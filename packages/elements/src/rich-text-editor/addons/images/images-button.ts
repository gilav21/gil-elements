import { html, nothing, type TemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { live } from 'lit/directives/live.js';
import { createRef, ref } from 'lit/directives/ref.js';
import '../../../button/define.js';
import '../../../input/define.js';
import '../../../popover/define.js';
import type { RichTextAddonHost, RichTextExclusivePopover } from '../../rich-text-host.js';
import type { RichTextImagesLocale } from './images-locale.js';
import type { ImageSources } from './images-utils.js';

export const IMAGE_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/>' +
    '<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';

export interface ImagesButtonOptions {
    readonly host: Pick<RichTextAddonHost, 'isDisabled' | 'readonly' | 'registerExclusivePopover' | 'invalidate'>;
    readonly locale: () => RichTextImagesLocale;
    readonly sources: () => ImageSources;
    readonly onOpen: () => void;
    readonly onInsertUrl: (url: string, alt: string) => void;
    readonly onUploadFile: (file: File) => void;
}

const FORM = 'display:grid;gap:0.75rem;width:18rem;max-width:calc(100vw - 4rem)';
const FIELD = 'display:grid;gap:0.25rem;font-size:0.875rem;font-weight:500';
const HIDDEN_INPUT = 'position:absolute;width:1px;height:1px;opacity:0;overflow:hidden';

/** The toolbar's image button: a popover with a URL and alt form and, where the sources allow it, a file picker. */
export class ImagesButton {
    private open = false;
    private url = '';
    private alt = '';
    private readonly fileInput = createRef<HTMLInputElement>();
    private readonly exclusive: RichTextExclusivePopover;

    constructor(private readonly options: ImagesButtonOptions) {
        this.exclusive = options.host.registerExclusivePopover(() => this.setOpen(false));
    }

    get isOpen(): boolean {
        return this.open;
    }

    get interactionDisabled(): boolean {
        return this.options.host.isDisabled || this.options.host.readonly;
    }

    dispose(): void {
        this.exclusive.release();
    }

    onOpenChange(next: boolean): void {
        if (next) {
            this.exclusive.notifyOpened();
            this.options.onOpen();
        }
        this.setOpen(next);
    }

    /** Inserts the typed URL, then empties the fields so a later open does not splice into stale text. */
    insertUrl(): void {
        if (this.interactionDisabled || !this.url) return;
        this.options.onInsertUrl(this.url, this.alt);
        this.url = '';
        this.alt = '';
        this.setOpen(false);
    }

    pickFile(input: HTMLInputElement): void {
        const file = input.files?.[0];
        input.value = '';
        if (this.interactionDisabled || !file) return;
        this.options.onUploadFile(file);
        this.setOpen(false);
    }

    render(): TemplateResult {
        const locale = this.options.locale();
        const sources = this.options.sources();
        const disabled = this.interactionDisabled;
        return html`<ge-popover .open=${this.open} close-on-scroll @open-change=${(event: CustomEvent<boolean>) => this.onOpenChange(event.detail)}>
            <ge-popover-trigger>
                <button
                    type="button"
                    data-slot="rte-images-button"
                    title=${locale.tooltip}
                    aria-label=${locale.tooltip}
                    ?disabled=${disabled}
                >${unsafeHTML(IMAGE_ICON)}</button>
            </ge-popover-trigger>
            <ge-popover-content align="start" strategy="fixed">
                <div style=${FORM}>
                    ${sources === 'upload' ? nothing : this.renderUrlForm(locale, disabled)}
                    ${sources === 'url' ? nothing : this.renderUpload(locale, disabled)}
                </div>
            </ge-popover-content>
        </ge-popover>`;
    }

    private renderUrlForm(locale: RichTextImagesLocale, disabled: boolean): TemplateResult {
        return html`<label style=${FIELD}>${locale.url}
                <ge-input
                    type="url"
                    data-slot="rte-images-url"
                    placeholder=${locale.urlPlaceholder}
                    .value=${live(this.url)}
                    @input=${(event: Event) => {
                        this.url = (event.target as HTMLInputElement).value;
                    }}
                ></ge-input>
            </label>
            <label style=${FIELD}>${locale.altText}
                <ge-input
                    data-slot="rte-images-alt"
                    placeholder=${locale.altTextPlaceholder}
                    .value=${live(this.alt)}
                    @input=${(event: Event) => {
                        this.alt = (event.target as HTMLInputElement).value;
                    }}
                ></ge-input>
            </label>
            <ge-button size="sm" data-slot="rte-images-insert" ?disabled=${disabled} @click=${() => this.insertUrl()}>${locale.insert}</ge-button>`;
    }

    private renderUpload(locale: RichTextImagesLocale, disabled: boolean): TemplateResult {
        return html`<ge-button variant="outline" size="sm" data-slot="rte-images-pick" ?disabled=${disabled} @click=${() => this.fileInput.value?.click()}>${locale.tooltip}</ge-button>
            <input
                ${ref(this.fileInput)}
                type="file"
                accept="image/*"
                tabindex="-1"
                aria-hidden="true"
                style=${HIDDEN_INPUT}
                data-slot="rte-images-file"
                ?disabled=${disabled}
                @change=${(event: Event) => this.pickFile(event.target as HTMLInputElement)}
            />`;
    }

    private setOpen(next: boolean): void {
        if (this.open === next) return;
        this.open = next;
        this.options.host.invalidate();
    }
}

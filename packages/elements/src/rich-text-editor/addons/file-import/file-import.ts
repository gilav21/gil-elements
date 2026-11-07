import { html, nothing, type TemplateResult } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import { loadingOverlay } from '../../../shared/loading-overlay.js';
import loadingCss from '../../../shared/loading-overlay.css?inline';
import { defineAddon, resolveAddonLocale } from '../../rich-text-addon-kit.js';
import type { RichTextAddonHost, RichTextAddonOptions } from '../../rich-text-host.js';
import type { Disposables } from '../../rich-text-registry.js';
import { FILE_IMPORT_LOCALES, type FileImportLocale } from './file-import-locale.js';
import {
    DOCUMENT_IMPORT_ACCEPT,
    HEADER_BYTES,
    IMAGE_IMPORT_ACCEPT,
    classifyImport,
    dragHasSupportedDocument,
    isSupportedDocumentFile,
    simpleHash,
    type DocumentImportKind,
} from './file-import-utils.js';
import css from './file-import.css?inline';

export interface FileImportOptions extends RichTextAddonOptions {
    /** Picker `accept`; by default the documents plus, while an image owner is registered, the image formats. */
    readonly accept?: string;
    /** A locale id or a full dictionary; by default the editor's. */
    readonly locale?: string | FileImportLocale;
}

const SLOT_ID = 'file-import.import';
const ERROR_DISMISS_MS = 4000;
/** Stops the pathological pick; real documents with embedded media run to tens of megabytes. */
const MAX_IMPORT_BYTES = 100 * 1024 * 1024;
const MAX_PDF_FONT_STYLES = 12;
const FONT_STYLE_SELECTOR = 'style[data-ge-rte-pdf-fonts]';

const ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 18v-6"/><path d="m9 15 3-3 3 3"/></svg>';

class ImportTooLargeError extends Error {}

/** Imports `.pdf` and `.docx` files from a picker or a drop; the parsers are loaded on the first import. */
export class FileImportController {
    private readonly input = createRef<HTMLInputElement>();
    private readonly locale: FileImportLocale;
    private importing = false;
    private errorMessage = '';
    private cancelDismiss = (): void => undefined;

    constructor(
        private readonly host: RichTextAddonHost,
        private readonly options: FileImportOptions & { readonly toolbar: boolean; readonly order: number },
        private readonly life: Disposables,
    ) {
        this.locale = resolveAddonLocale(FILE_IMPORT_LOCALES, host, options.locale);
    }

    attach(): void {
        const { host, options, life } = this;
        life.add(host.adoptStyles(css + loadingCss, 'shadow'));
        life.add(host.overlays.register({ id: SLOT_ID, render: () => this.render() }));
        life.add(host.registerDropInterceptor((event) => this.onDrop(event)));
        life.add(host.registerDropZonePredicate((event) => dragHasSupportedDocument(event.dataTransfer)));
        life.add(() => this.cancelDismiss());
        if (!options.toolbar) return;
        life.add(host.toolbarSlots.register({
            id: SLOT_ID,
            order: options.order,
            icon: ICON,
            tooltip: this.locale.tooltip,
            isEnabled: () => this.canImport,
            onClick: () => this.openPicker(),
        }));
    }

    private get canImport(): boolean {
        return !this.host.readonly && !this.host.isDisabled;
    }

    private get accept(): string {
        if (this.options.accept) return this.options.accept;
        return this.host.hasImageFileHandler ? `${DOCUMENT_IMPORT_ACCEPT},${IMAGE_IMPORT_ACCEPT}` : DOCUMENT_IMPORT_ACCEPT;
    }

    private openPicker(): void {
        const input = this.input.value;
        if (!input) return;
        input.accept = this.accept;
        input.click();
    }

    private onPicked(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (file && this.canImport) void this.importFile(file);
    }

    private onDrop(event: DragEvent): boolean {
        const file = Array.from(event.dataTransfer?.files ?? []).find(isSupportedDocumentFile);
        if (!file) return false;
        event.preventDefault();
        void this.importFile(file);
        return true;
    }

    async importFile(file: File): Promise<void> {
        if (!this.canImport) return;
        this.host.flushPendingHistoryPush();
        const kind = classifyImport(new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer()));
        if (!kind) {
            this.reportError(this.locale.importInvalidFile);
        } else if (kind.type === 'image') {
            if (!this.host.insertImageFile(file)) this.reportError(this.locale.importInvalidFile);
        } else {
            await this.runImport(file, kind);
        }
    }

    private async runImport(file: File, kind: DocumentImportKind): Promise<void> {
        this.setImporting(true);
        this.host.emit('file-import-start', file);
        try {
            const imported = kind.type === 'docx' ? await this.parseDocx(file) : await this.parsePdf(file);
            this.insertImported(imported);
        } catch (error: unknown) {
            if (error instanceof ImportTooLargeError) {
                this.reportError(error.message);
            } else {
                if (error instanceof Error) console.error('[ge-rich-text-editor] file import failed', error);
                this.reportError(this.locale.importFailed);
            }
        } finally {
            this.setImporting(false);
        }
    }

    private assertImportableSize(file: File): void {
        if (file.size > MAX_IMPORT_BYTES) throw new ImportTooLargeError(this.locale.importTooLarge);
    }

    private async parseDocx(file: File): Promise<string> {
        this.assertImportableSize(file);
        const bytes = new Uint8Array(await file.arrayBuffer());
        const [{ parseDocx }, { renderDocxForEditor }] = await Promise.all([
            import('../../../file-viewer/parsers/docx-parser.js'),
            import('../../../file-viewer/parsers/docx-to-editor-html.js'),
        ]);
        return renderDocxForEditor(parseDocx(bytes));
    }

    private async parsePdf(file: File): Promise<string> {
        this.assertImportableSize(file);
        const buffer = await file.arrayBuffer();
        const { parsePdfReadable } = await import('../../../file-viewer/parsers/pdf-readable/pdf-readable.js');
        const result = await parsePdfReadable(buffer);
        if (result.html.trim() && result.fontFaceCss) this.injectFontCss(result.fontFaceCss);
        return this.atDesignMeasure(result.html, result.pageWidthPt);
    }

    /** A PDF's layout geometry assumes its own page width; at that measure a narrow editor scrolls instead of squeezing the flow. */
    private atDesignMeasure(markup: string, pageWidthPt: number): string {
        return pageWidthPt > 0 ? `<div style="min-width:${Math.round(pageWidthPt)}pt">${markup}</div>` : markup;
    }

    /**
     * Embedded fonts arrive as `@font-face` CSS that cannot travel inside sanitized editor HTML, so
     * it goes to the document head, deduped by content and never removed (imported text outlives
     * this addon); only the oldest are dropped, beyond a cap.
     */
    private injectFontCss(fontCss: string): void {
        const hash = `${fontCss.length.toString(36)}-${simpleHash(fontCss)}`;
        const { doc } = this.host;
        if (doc.head.querySelector(`style[data-ge-rte-pdf-fonts="${hash}"]`)) return;
        const style = doc.createElement('style');
        style.dataset['geRtePdfFonts'] = hash;
        style.textContent = fontCss;
        doc.head.append(style);
        const injected = doc.head.querySelectorAll(FONT_STYLE_SELECTOR);
        for (let i = 0; i < injected.length - MAX_PDF_FONT_STYLES; i++) injected[i]?.remove();
    }

    private insertImported(markup: string): void {
        const safe = this.host.sanitizer.sanitize(markup);
        if (!safe.trim()) {
            this.reportError(this.locale.importFailed);
            return;
        }
        this.host.restoreSelection();
        this.host.insertHtmlAtCaret(safe);
        this.host.emit('file-import-complete', safe);
    }

    private setImporting(value: boolean): void {
        this.importing = value;
        this.host.invalidate();
    }

    private reportError(message: string): void {
        this.host.emit('file-import-error', message);
        this.errorMessage = message;
        this.cancelDismiss();
        this.cancelDismiss = this.life.timeout(() => {
            this.errorMessage = '';
            this.host.invalidate();
        }, ERROR_DISMISS_MS);
        this.host.invalidate();
    }

    private render(): TemplateResult {
        const { locale, importing, errorMessage } = this;
        return html`
            <input type="file" hidden data-slot="rte-file-import-input" ${ref(this.input)}
                accept=${this.accept} aria-label=${locale.tooltip} @change=${(event: Event) => this.onPicked(event)} />
            <output class="sr-only" aria-live="polite" data-slot="rte-file-import-busy-status">${importing ? locale.importing : nothing}</output>
            <div class="sr-only" role="alert" aria-live="assertive" data-slot="rte-file-import-error-alert">${errorMessage || nothing}</div>
            ${importing
                ? html`<div class="import-layer" data-slot="rte-file-import-busy" aria-hidden="true">${loadingOverlay('default')}<span>${locale.importing}</span></div>`
                : nothing}
            ${errorMessage
                ? html`<div class="import-layer" data-slot="rte-file-import-error" aria-hidden="true"><span data-error>${errorMessage}</span></div>`
                : nothing}
        `;
    }
}

export const fileImportAddon = defineAddon<FileImportOptions>('file-import', 340, ({ host, options, life }) => {
    new FileImportController(host, options, life).attach();
});

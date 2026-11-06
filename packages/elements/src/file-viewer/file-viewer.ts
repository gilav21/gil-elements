import { html, nothing, svg, unsafeCSS, type PropertyValues, type TemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { UiElement } from '@gilav21/elements-base';
import css from './file-viewer.css?inline';
import type { FileTypeResult, FileViewerType } from './parsers/file-type-detector.js';
import { detectDocumentRtl, renderDocxComments, renderDocxFootnotes, renderDocxHeadersFooters, renderDocxToHtml, renderSlideToHtml } from './file-viewer.render.js';
import type { PixelPerfectPage } from './parsers/pdf-pixel-perfect.js';

type ViewerState = 'idle' | 'loading' | 'loaded' | 'error';

/** `detail` of `loaded`. */
export interface FileViewerLoadedEvent {
    readonly type: FileViewerType;
    readonly filename: string;
}

/** `detail` of `load-error`. */
export interface FileViewerErrorEvent {
    readonly type: string;
    readonly message: string;
}

interface Slide {
    readonly html: string;
    readonly width: number;
    readonly height: number;
}

interface Workbook {
    readonly sheets: ReadonlyArray<{ name: string; data: string[][] }>;
    readonly truncated?: boolean;
}

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;
const PAGINATED = new Set(['pptx', 'ppt', 'pdf']);
const ZOOMABLE = new Set(['image', 'docx', 'doc', 'pptx', 'ppt', 'text', 'pdf']);

const icon = (body: TemplateResult, size = 16, stroke = 2) =>
    svg`<svg xmlns="http://www.w3.org/2000/svg" width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICON_PREV = icon(svg`<path d="m15 18-6-6 6-6" />`);
const ICON_NEXT = icon(svg`<path d="m9 18 6-6-6-6" />`);
const ICON_ZOOM_OUT = icon(svg`<circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" /><line x1="8" x2="14" y1="11" y2="11" />`);
const ICON_ZOOM_IN = icon(svg`<circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" /><line x1="11" x2="11" y1="8" y2="14" /><line x1="8" x2="14" y1="11" y2="11" />`);
const DOWNLOAD_PATHS = svg`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />`;
const ICON_DOWNLOAD = icon(DOWNLOAD_PATHS);
const ICON_DOWNLOAD_SMALL = icon(DOWNLOAD_PATHS, 14);
const ICON_ERROR = icon(svg`<circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />`, 40, 1.5);
const ICON_FILE = icon(svg`<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" />`, 40, 1.5);

/**
 * Previews a file in the page, parsing it in the browser: nothing is uploaded. PDF, DOCX, DOC, PPTX, PPT, XLSX, images
 * (SVG is sanitised first), text, video and audio are recognised by their bytes unless `type` forces one.
 *
 * Set `file` (a `File` or `Blob`) or `src` (a URL fetched with `fetch()`, so subject to CORS). The toolbar shows the name,
 * page controls for PDF and slides, zoom where it applies and a download link. Project a `ge-file-viewer-toolbar` or
 * `ge-file-viewer-content` to replace the built-in chrome entirely; then you drive the page and zoom yourself.
 *
 * @fires loaded - Parsed and rendered. `detail` is `{ type, filename }`, the type being the one the detector resolved.
 * @fires load-error - A failed fetch, a corrupt file or a media element that refuses the codec. `detail` is `{ type, message }`.
 * @fires page-change - After `prevPage()` or `nextPage()`. `detail` is the new 1-based page.
 * @fires zoom-change - After `zoomIn()` or `zoomOut()`. `detail` is the clamped zoom factor.
 * @slot - Direct `ge-file-viewer-toolbar` / `ge-file-viewer-content` children, replacing the built-in toolbar and content.
 * @prop {File | Blob | null} file - File to render; takes precedence over `src`. Setting it to `null` with no `src` returns to the placeholder.
 * @attr {string} src - URL fetched and then treated like `file`; the name comes from the URL path unless `filename` is set.
 * @attr {string} type - Forces a viewer kind instead of sniffing the bytes.
 * @attr {string} height - CSS height of the frame. Defaults to `600px`; the content scrolls inside it.
 * @attr {number} zoom - Initial zoom factor (1 = 100%). A seed: the toolbar clamps to 0.25-3 in 0.25 steps and reports through `zoom-change`.
 * @attr {number} page - Initial 1-based page or slide for PDF and PPT/PPTX. A seed, like `zoom`.
 * @attr {string} filename - Overrides the title-bar name. Falls back to `File.name`, the URL's last segment, or `File`.
 * @csspart frame - The bordered frame.
 */
export class GeFileViewer extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        file: { attribute: false },
        src: {},
        type: {},
        height: {},
        zoom: { type: Number },
        page: { type: Number },
        filename: {},
        state: { state: true },
        errorMessage: { state: true },
        detectedType: { state: true },
        currentPage: { state: true },
        totalPages: { state: true },
        currentZoom: { state: true },
        textContent: { state: true },
        imageSrc: { state: true },
        mediaSrc: { state: true },
        downloadUrl: { state: true },
        pdfPages: { state: true },
        pdfGlobalCss: { state: true },
        workbook: { state: true },
        activeSheetIndex: { state: true },
        docHtml: { state: true },
        docRtl: { state: true },
        slides: { state: true },
        custom: { state: true },
    };

    declare file: File | Blob | null;
    declare src: string;
    declare type: FileViewerType | '';
    declare height: string;
    declare zoom: number;
    declare page: number;
    declare filename: string;
    declare state: ViewerState;
    declare errorMessage: string;
    declare detectedType: FileViewerType;
    declare currentPage: number;
    declare totalPages: number;
    declare currentZoom: number;
    declare textContent: string;
    declare imageSrc: string;
    declare mediaSrc: string;
    declare downloadUrl: string;
    declare pdfPages: ReadonlyArray<PixelPerfectPage>;
    declare pdfGlobalCss: string;
    declare workbook: Workbook | null;
    declare activeSheetIndex: number;
    declare docHtml: string;
    declare docRtl: boolean;
    declare slides: ReadonlyArray<Slide>;
    declare custom: boolean;

    private readonly blobUrls: string[] = [];
    private readonly watcher = new MutationObserver(() => this.checkCustom());
    private loadToken = 0;

    constructor() {
        super();
        this.file = null;
        this.src = '';
        this.type = '';
        this.height = '600px';
        this.zoom = 1;
        this.page = 1;
        this.filename = '';
        this.state = 'idle';
        this.errorMessage = '';
        this.detectedType = 'unknown';
        this.currentPage = 1;
        this.totalPages = 1;
        this.currentZoom = 1;
        this.textContent = '';
        this.imageSrc = '';
        this.mediaSrc = '';
        this.downloadUrl = '';
        this.pdfPages = [];
        this.pdfGlobalCss = '';
        this.workbook = null;
        this.activeSheetIndex = 0;
        this.docHtml = '';
        this.docRtl = false;
        this.slides = [];
        this.custom = false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'file-viewer';
        this.watcher.observe(this, { childList: true });
        this.checkCustom();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.watcher.disconnect();
        this.loadToken++;
        this.revokeBlobUrls();
    }

    private checkCustom(): void {
        this.custom = this.querySelector(':scope > ge-file-viewer-toolbar, :scope > ge-file-viewer-content') !== null;
    }

    private revokeBlobUrls(): void {
        for (const url of this.blobUrls.splice(0)) URL.revokeObjectURL(url);
    }

    // ---- derived data -------------------------------------------------------------------------------------

    private get displayFilename(): string {
        if (this.filename) return this.filename;
        return this.file instanceof File ? this.file.name : 'File';
    }

    private get xlsxHeaderRow(): string[] | null {
        const sheet = this.workbook?.sheets[this.activeSheetIndex];
        return sheet && sheet.data.length > 0 ? (sheet.data[0] ?? null) : null;
    }

    private get xlsxDataRows(): string[][] {
        const sheet = this.workbook?.sheets[this.activeSheetIndex];
        return sheet && sheet.data.length > 1 ? sheet.data.slice(1) : [];
    }

    // ---- public API ---------------------------------------------------------------------------------------

    /** Steps back one page or slide (clamped at 1), fires `page-change` and scrolls the content back to the top. Fires even on page 1. */
    prevPage(): void {
        this.goToPage(Math.max(1, this.currentPage - 1));
    }

    /** Steps forward one page or slide (clamped at the parsed total), fires `page-change` and scrolls to the top. Only PDF and PPT/PPTX are paginated. */
    nextPage(): void {
        this.goToPage(Math.min(this.totalPages, this.currentPage + 1));
    }

    private goToPage(page: number): void {
        this.currentPage = page;
        this.dispatchEvent(new CustomEvent<number>('page-change', { detail: page, bubbles: true, composed: true }));
        this.scrollContentToTop();
    }

    private scrollContentToTop(): void {
        const content = this.shadowRoot?.querySelector('[data-slot="file-viewer-content"]');
        if (content) content.scrollTop = 0;
        const pdfScroll = content?.querySelector('.pdf');
        if (pdfScroll) pdfScroll.scrollTop = 0;
    }

    /** Zooms in one 0.25 step, capped at 3 (300%), and fires `zoom-change`. */
    zoomIn(): void {
        this.setZoom(Math.min(ZOOM_MAX, Math.round((this.currentZoom + ZOOM_STEP) * 100) / 100));
    }

    /** Zooms out one 0.25 step, floored at 0.25 (25%), and fires `zoom-change`. */
    zoomOut(): void {
        this.setZoom(Math.max(ZOOM_MIN, Math.round((this.currentZoom - ZOOM_STEP) * 100) / 100));
    }

    private setZoom(zoom: number): void {
        this.currentZoom = zoom;
        this.dispatchEvent(new CustomEvent<number>('zoom-change', { detail: zoom, bubbles: true, composed: true }));
    }

    /** Switches the visible spreadsheet tab by zero-based index (XLSX only). Does not fire `page-change`. */
    setActiveSheet(index: number): void {
        this.activeSheetIndex = index;
    }

    // ---- loading ------------------------------------------------------------------------------------------

    protected override willUpdate(changed: PropertyValues): void {
        if (changed.has('zoom')) this.currentZoom = this.zoom;
        if (changed.has('page')) this.currentPage = this.page;
    }

    protected override updated(changed: PropertyValues): void {
        if (changed.has('file') || changed.has('src') || (changed.has('type') && changed.get('type') !== undefined)) this.reload();
    }

    private reload(): void {
        const token = ++this.loadToken;
        if (this.file) void this.loadFile(this.file, token);
        else if (this.src) void this.loadFromUrl(this.src, token);
        else this.state = 'idle';
    }

    private async loadFromUrl(url: string, token: number): Promise<void> {
        this.state = 'loading';
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            const file = new File([blob], this.filenameFromUrl(url), { type: blob.type });
            await this.loadFile(file, token);
        } catch (error) {
            if (token === this.loadToken) this.fail(error instanceof Error ? error.message : 'Failed to load file');
        }
    }

    private filenameFromUrl(url: string): string {
        try {
            return new URL(url, globalThis.location?.href).pathname.split('/').pop() || 'file';
        } catch {
            return 'file';
        }
    }

    private async loadFile(file: File | Blob, token: number): Promise<void> {
        this.state = 'loading';
        this.errorMessage = '';
        try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            const found: FileTypeResult = this.type ? { type: this.type, mimeType: '', extension: '' } : await this.detect(bytes);
            if (token !== this.loadToken) return;
            this.revokeBlobUrls();
            this.detectedType = found.type;
            this.downloadUrl = this.blobUrl(file);
            await this.process(found.type, bytes, file, found.mimeType);
            if (token !== this.loadToken) return;
            this.state = 'loaded';
            this.dispatchEvent(new CustomEvent<FileViewerLoadedEvent>('loaded', { detail: { type: found.type, filename: this.displayFilename }, bubbles: true, composed: true }));
        } catch (error) {
            if (token === this.loadToken) this.fail(error instanceof Error ? error.message : 'Failed to process file');
        }
    }

    private blobUrl(data: Blob): string {
        const url = URL.createObjectURL(data);
        this.blobUrls.push(url);
        return url;
    }

    private async detect(bytes: Uint8Array): Promise<FileTypeResult> {
        const { detectFileType } = await import('./parsers/file-type-detector.js');
        return detectFileType(bytes);
    }

    private async process(type: FileViewerType, bytes: Uint8Array, file: File | Blob, mimeType: string): Promise<void> {
        switch (type) {
            case 'image':
                return this.processImage(bytes, file);
            case 'pdf':
                return this.processPdf(bytes);
            case 'xlsx':
                return this.processXlsx(bytes);
            case 'docx':
                return this.processDocx(bytes);
            case 'doc':
                return this.processDoc(bytes);
            case 'pptx':
                return this.processSlides(bytes, 'pptx');
            case 'ppt':
                return this.processSlides(bytes, 'ppt');
            case 'text':
                this.textContent = new TextDecoder().decode(bytes);
                return;
            case 'video':
            case 'audio':
                this.mediaSrc = this.blobUrl(new Blob([bytes as BlobPart], { type: mimeType || 'application/octet-stream' }));
                return;
            default:
        }
    }

    private async processImage(bytes: Uint8Array, file: File | Blob): Promise<void> {
        if (!isSvg(bytes)) {
            this.imageSrc = this.blobUrl(file);
            return;
        }
        const { sanitizeSvg } = await import('./parsers/svg-sanitizer.js');
        const sanitized = sanitizeSvg(new TextDecoder().decode(bytes));
        if (!sanitized) throw new Error('Invalid or unsafe SVG file');
        this.imageSrc = this.blobUrl(new Blob([sanitized], { type: 'image/svg+xml' }));
    }

    private async processPdf(bytes: Uint8Array): Promise<void> {
        const { renderPixelPerfectPaged } = await import('./parsers/pdf-pixel-perfect.js');
        const result = await renderPixelPerfectPaged(bytes.buffer as ArrayBuffer);
        this.pdfPages = result.pages;
        this.pdfGlobalCss = result.globalCss;
        this.totalPages = result.totalPages;
        this.currentPage = 1;
    }

    private async processXlsx(bytes: Uint8Array): Promise<void> {
        const { parseXlsx } = await import('./parsers/xlsx-reader.js');
        this.workbook = parseXlsx(bytes);
        this.activeSheetIndex = 0;
    }

    private async processDocx(bytes: Uint8Array): Promise<void> {
        const { parseDocx } = await import('./parsers/docx-parser.js');
        const result = parseDocx(bytes);
        this.docRtl = detectDocumentRtl(result.elements);
        this.docHtml =
            renderDocxHeadersFooters(result.headers, 'header') +
            renderDocxToHtml(result.elements) +
            renderDocxHeadersFooters(result.footers, 'footer') +
            renderDocxFootnotes(result.footnotes, result.endnotes) +
            renderDocxComments(result.comments);
    }

    private async processDoc(bytes: Uint8Array): Promise<void> {
        const { parseDocEnhanced } = await import('./parsers/doc-enhanced-parser.js');
        const result = parseDocEnhanced(bytes);
        this.docRtl = detectDocumentRtl(result.elements);
        this.docHtml = renderDocxToHtml(result.elements);
    }

    private async processSlides(bytes: Uint8Array, kind: 'pptx' | 'ppt'): Promise<void> {
        const result = kind === 'pptx' ? (await import('./parsers/pptx-parser.js')).parsePptx(bytes) : (await import('./parsers/ppt-parser.js')).parsePpt(bytes);
        this.slides = result.slides.map((slide) => ({ html: renderSlideToHtml(slide), width: result.slideWidth, height: result.slideHeight }));
        this.totalPages = result.slides.length;
        this.currentPage = Math.min(this.page, result.slides.length);
    }

    private fail(message: string): void {
        this.state = 'error';
        this.errorMessage = message;
        this.dispatchEvent(new CustomEvent<FileViewerErrorEvent>('load-error', { detail: { type: this.detectedType, message }, bubbles: true, composed: true }));
    }

    private readonly onMediaError = (message: string) => () => this.fail(message);

    // ---- rendering ----------------------------------------------------------------------------------------

    private button(label: string, body: TemplateResult, disabled: boolean, click: () => void) {
        return html`<button type="button" class="tool" aria-label=${label} ?disabled=${disabled} @click=${click}>${body}</button>`;
    }

    private renderToolbar() {
        const type = this.detectedType;
        const download = this.downloadUrl;
        return html`<div class="toolbar" data-slot="file-viewer-toolbar">
            <div class="title">
                <span class="name">${this.displayFilename}</span>
                ${type && type !== 'unknown' ? html`<span class="kind">${type}</span>` : nothing}
            </div>
            <div class="tools">
                ${PAGINATED.has(type)
                    ? html`${this.button('Previous page', ICON_PREV, this.currentPage <= 1, () => this.prevPage())}<span class="counter pages">${this.currentPage} / ${this.totalPages}</span>${this.button('Next page', ICON_NEXT, this.currentPage >= this.totalPages, () => this.nextPage())}`
                    : nothing}
                ${ZOOMABLE.has(type)
                    ? html`${this.button('Zoom out', ICON_ZOOM_OUT, this.currentZoom <= ZOOM_MIN, () => this.zoomOut())}<span class="counter zoom">${`${Math.round(this.currentZoom * 100)}%`}</span>${this.button('Zoom in', ICON_ZOOM_IN, this.currentZoom >= ZOOM_MAX, () => this.zoomIn())}`
                    : nothing}
                ${download ? html`<a class="tool" href=${download} download=${this.displayFilename} title="Download">${ICON_DOWNLOAD}</a>` : nothing}
            </div>
        </div>`;
    }

    private renderDownloadLink(label: string, body: TemplateResult | typeof nothing) {
        return this.downloadUrl ? html`<a class="link" href=${this.downloadUrl} download=${this.displayFilename}>${body}${label}</a>` : nothing;
    }

    private renderLoaded() {
        const zoom = this.currentZoom;
        switch (this.detectedType) {
            case 'image':
                return html`<div class="image-box"><img src=${this.imageSrc} alt=${this.displayFilename} style=${`transform:scale(${zoom});transform-origin:center center`} @error=${this.onMediaError('Failed to load image')} /></div>`;
            case 'pdf':
                return this.renderPdf(zoom);
            case 'xlsx':
                return this.renderSheet();
            case 'docx':
            case 'doc':
                return html`<div class="doc" style=${`zoom:${zoom}`} dir=${this.docRtl ? 'rtl' : nothing}>${unsafeHTML(this.docHtml)}</div>`;
            case 'pptx':
            case 'ppt':
                return this.renderSlide(zoom);
            case 'text':
                return html`<div class="text" style=${`zoom:${zoom}`}><pre>${this.textContent}</pre></div>`;
            case 'video':
                return html`<div class="media-box"><video controls src=${this.mediaSrc} @error=${this.onMediaError('Failed to load video. The format may not be supported by your browser.')}><track kind="captions" src="" default />Your browser does not support the video element.</video></div>`;
            case 'audio':
                return html`<div class="audio-box"><audio controls src=${this.mediaSrc} @error=${this.onMediaError('Failed to load audio. The format may not be supported by your browser.')}>Your browser does not support the audio element.</audio></div>`;
            default:
                return html`<div class="fill center notice">${ICON_FILE}<p>Preview not available for this file type.</p>${this.renderDownloadLink('Download file', nothing)}</div>`;
        }
    }

    private renderPdf(zoom: number) {
        const page = this.pdfPages[this.currentPage - 1];
        const body = page ? `<style>${this.pdfGlobalCss}</style>${page.html}` : '';
        return html`<div class="pdf" style=${`zoom:${zoom}`}><div class="pdf-page">${unsafeHTML(body)}</div></div>`;
    }

    private renderSlide(zoom: number) {
        const slide = this.slides[this.currentPage - 1];
        const first = this.slides[0];
        return html`<div class="slide-box"><div class="slide" style=${`width:${first?.width ?? 960}px;height:${first?.height ?? 540}px;transform:scale(${zoom});transform-origin:center center`}>${unsafeHTML(slide?.html ?? '')}</div></div>`;
    }

    private renderSheet() {
        const names = this.workbook?.sheets.map((sheet) => sheet.name) ?? [];
        const header = this.xlsxHeaderRow;
        return html`<div class="sheet">
            ${this.workbook?.truncated ? html`<div class="truncated">Showing first 10,000 rows. Download the file to see all data.</div>` : nothing}
            <div class="grid-scroll">
                <table class="cells">
                    <thead>${header ? html`<tr>${header.map((cell) => html`<th>${cell}</th>`)}</tr>` : nothing}</thead>
                    <tbody>${this.xlsxDataRows.map((row) => html`<tr>${row.map((cell) => html`<td>${cell}</td>`)}</tr>`)}</tbody>
                </table>
            </div>
            ${names.length > 1
                ? html`<div class="sheet-tabs" data-slot="file-viewer-sheet-tabs">${names.map((name, index) => html`<button type="button" class="sheet-tab" aria-selected=${index === this.activeSheetIndex ? 'true' : 'false'} @click=${() => this.setActiveSheet(index)}>${name}</button>`)}</div>`
                : nothing}
        </div>`;
    }

    private renderContent() {
        switch (this.state) {
            case 'loading':
                return html`<div class="fill center"><ge-spinner size="lg"></ge-spinner></div>`;
            case 'error':
                return html`<div class="fill center notice">${ICON_ERROR}<p class="message">${this.errorMessage}</p>${this.renderDownloadLink('Download file', ICON_DOWNLOAD_SMALL)}</div>`;
            case 'loaded':
                return this.renderLoaded();
            default:
                return nothing;
        }
    }

    protected override render() {
        return html`<div part="frame" class="frame" data-slot="file-viewer" style=${`height:${this.height}`}>
            ${this.custom
                ? html`<slot></slot>`
                : html`${this.renderToolbar()}<div class="content" tabindex="0" data-slot="file-viewer-content">${this.renderContent()}</div>`}
        </div>`;
    }
}

/** An SVG starts, after an optional byte-order mark and whitespace, with `<svg` or an XML declaration. */
function isSvg(bytes: Uint8Array): boolean {
    const offset = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
    let text = '';
    for (let i = offset; i < Math.min(bytes.length, 256); i++) text += String.fromCodePoint(bytes[i] ?? 0);
    const trimmed = text.trimStart().toLowerCase();
    return trimmed.startsWith('<svg') || trimmed.startsWith('<?xml');
}

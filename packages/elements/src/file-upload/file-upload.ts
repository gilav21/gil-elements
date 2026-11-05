import { html, nothing, unsafeCSS, type TemplateResult } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { onPointerDrag } from '../shared/touch.js';
import css from './file-upload.css?inline';
import { resolveFileUploadLocale, type FileUploadLocale } from './file-upload.locales.js';
import {
    clampCropRect,
    collectDroppedFiles,
    cropImageFile,
    cropKeyStep,
    initialCropRect,
    isImageFile,
    type CropRect,
} from './file-upload.utils.js';

export type FileUploadStatus = 'pending' | 'uploading' | 'complete' | 'error';

export interface FileUploadItem {
    file: File;
    id: string;
    progress: number;
    status: FileUploadStatus;
    error?: string;
    preview?: string;
}

/** Detail of `cropped`: what the crop step produced and what it started from. */
export interface CropResult {
    readonly original: File;
    readonly file: File;
    readonly rect: CropRect;
}

const defaultTrue = { fromAttribute: (value: string | null) => value !== 'false', toAttribute: (value: boolean) => (value ? null : 'false') };
const nullableNumber = { fromAttribute: (value: string | null) => (value === null || value === '' ? null : Number(value)) };

const interpolate = (template: string, values: Record<string, string | number>): string =>
    template.replaceAll(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));

let idCounter = 0;
/** `randomUUID` exists only in secure contexts, and a plain-http page must still be able to queue files. */
const newId = (): string => globalThis.crypto?.randomUUID?.() ?? `file-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

/** First pointer position of a mouse or touch event, or `null` for a touch that carries none. */
function pointerPosition(event: MouseEvent | TouchEvent): { x: number; y: number } | null {
    if ('touches' in event) {
        const touch = event.touches[0];
        return touch ? { x: touch.clientX, y: touch.clientY } : null;
    }
    return { x: event.clientX, y: event.clientY };
}

const UPLOAD_ICON = html`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="upload-icon" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" />
</svg>`;
const FILE_ICON = html`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="file-icon" aria-hidden="true">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" />
</svg>`;
const REMOVE_ICON = html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
</svg>`;

/**
 * A dropzone that validates, queues and (optionally) crops files. It is transport-agnostic: it never uploads
 * anything, so do the transfer yourself on `file-added` and report back with `updateFileProgress` / `setFileError`.
 *
 * @attr {string} accept - Comma-separated filter in native `accept` syntax (`.pdf`, `image/*`, `application/pdf`); re-checked in JS on drop. Empty accepts everything.
 * @attr {boolean} multiple - Whether one picker selection can hold several files. On by default; `multiple="false"` turns it off. Drops and repeated picks are not gated by it, so use `max-files` to cap the list.
 * @attr {number} max-files - Cap on queued files (images waiting to be cropped count too). The dropzone disables itself while the list is full.
 * @attr {number} max-size - Per-file ceiling in bytes; also shown in the dropzone caption.
 * @attr {boolean} disabled - Blocks picking and dropping. Queued files stay listed and removable.
 * @attr {boolean} allow-directories - Accepts dropped folders (walked recursively) and switches the picker to folder mode.
 * @attr {boolean} crop-images - Holds each image in an inline crop step before it enters the queue; other files bypass it.
 * @attr {number} crop-aspect - Locks the crop box to this width / height ratio (`1` for an avatar).
 * @attr {string} locale - Locale id or object; defaults to the page's `lang`, then `en`.
 * @prop {FileUploadItem[]} files - The queue, read only.
 * @fires files-change - After any add, remove or clear, once per batch; `detail` is the whole queue.
 * @fires file-added - For each accepted file; `detail` is the queue item whose `id` the progress methods take.
 * @fires file-removed - After a file is removed; `detail` is the removed item.
 * @fires file-error - A file was refused (type, size or cap); `detail` is `{ file, error }`.
 * @fires cropped - An image was cropped; `detail` is `{ original, file, rect }`.
 * @csspart dropzone - The dashed drop target.
 */
export class GeFileUpload extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        accept: {},
        multiple: { converter: defaultTrue },
        maxFiles: { attribute: 'max-files', converter: nullableNumber },
        maxSize: { attribute: 'max-size', converter: nullableNumber },
        disabled: { type: Boolean, reflect: true },
        allowDirectories: { type: Boolean, attribute: 'allow-directories' },
        cropImages: { type: Boolean, attribute: 'crop-images' },
        cropAspect: { attribute: 'crop-aspect', converter: nullableNumber },
        locale: { reflect: true },
        queue: { state: true },
        isDragging: { state: true },
        cropQueue: { state: true },
        cropFile: { state: true },
        cropPreview: { state: true },
        cropNatural: { state: true },
        cropRect: { state: true },
        isCropping: { state: true },
    };

    declare accept: string;
    declare multiple: boolean;
    declare maxFiles: number | null;
    declare maxSize: number | null;
    declare disabled: boolean;
    declare allowDirectories: boolean;
    declare cropImages: boolean;
    declare cropAspect: number | null;
    declare locale: string | FileUploadLocale;
    declare protected queue: FileUploadItem[];
    declare protected isDragging: boolean;
    /** Images accepted but held back for cropping, in arrival order. */
    declare protected cropQueue: File[];
    /** The image the crop panel shows, or `null` while it is closed. */
    declare protected cropFile: File | null;
    declare protected cropPreview: string | null;
    declare protected cropNatural: { width: number; height: number };
    declare protected cropRect: CropRect;
    declare protected isCropping: boolean;

    private cropDragCleanup: (() => void) | null = null;

    constructor() {
        super();
        this.accept = '';
        this.multiple = true;
        this.maxFiles = null;
        this.maxSize = null;
        this.disabled = false;
        this.allowDirectories = false;
        this.cropImages = false;
        this.cropAspect = null;
        this.locale = '';
        this.queue = [];
        this.isDragging = false;
        this.cropQueue = [];
        this.cropFile = null;
        this.cropPreview = null;
        this.cropNatural = { width: 0, height: 0 };
        this.cropRect = { x: 0, y: 0, width: 0, height: 0 };
        this.isCropping = false;
    }

    /** The queue. Progress and status changes made through `updateFileProgress` / `setFileError` show up here. */
    get files(): readonly FileUploadItem[] {
        return this.queue;
    }

    /** `true` while the inline crop panel is open. */
    get isCropOpen(): boolean {
        return this.cropFile !== null;
    }

    private get t(): FileUploadLocale {
        return resolveFileUploadLocale(this.locale);
    }

    /** Slots already spoken for against `max-files`: queued files plus every image still waiting to be cropped. */
    private get claimedSlots(): number {
        return this.queue.length + this.cropQueue.length + (this.cropFile === null ? 0 : 1);
    }

    private get isDisabled(): boolean {
        return this.disabled || (this.maxFiles !== null && this.claimedSlots >= this.maxFiles);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.cropDragCleanup?.();
        this.cropDragCleanup = null;
    }

    private emit<T>(name: string, detail: T): void {
        this.dispatchEvent(new CustomEvent<T>(name, { detail, bubbles: true, composed: true }));
    }

    // ---- picking and dropping ------------------------------------------------------------------------------

    private readonly onDragOver = (event: DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (!this.isDisabled) this.isDragging = true;
    };

    private readonly onDragLeave = (event: DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        this.isDragging = false;
    };

    private readonly onDrop = (event: DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        this.isDragging = false;
        if (this.isDisabled) return;
        if (!this.allowDirectories) {
            const files = event.dataTransfer?.files;
            if (files) this.addFiles(Array.from(files));
            return;
        }
        void collectDroppedFiles(event.dataTransfer, true).then((files) => {
            if (files.length > 0) this.addFiles(files);
        });
    };

    private readonly onFileSelected = (event: Event) => {
        const input = event.target as HTMLInputElement;
        if (!input.files) return;
        this.addFiles(Array.from(input.files));
        // Reset so picking the very same file again still fires a change.
        input.value = '';
    };

    /** Opens the OS file dialog. Browsers only honour it inside a user gesture. No-op while disabled or full. */
    openFilePicker(): void {
        if (!this.isDisabled) this.renderRoot.querySelector<HTMLInputElement>('input[type="file"]')?.click();
    }

    /**
     * Validates and queues files, also callable to seed files from script. Each file is checked against `accept`,
     * then `max-size` (the first failure wins and fires one `file-error`); survivors are queued as `pending` with a
     * fresh id and, for images, an object-URL preview that is revoked on remove/clear. Past `max-files` every
     * remaining file is refused with its own `file-error`. `files-change` fires once at the end.
     */
    addFiles(newFiles: File[]): void {
        const cap = this.maxFiles;
        let available = cap === null ? newFiles.length : cap - this.claimedSlots;
        for (const file of newFiles) {
            const refusal = available <= 0 ? this.tooManyFilesMessage(cap) : this.validate(file);
            if (refusal) {
                this.emit('file-error', { file, error: refusal });
                continue;
            }
            if (this.cropImages && isImageFile(file)) this.cropQueue = [...this.cropQueue, file];
            else this.enqueue(file);
            available--;
        }
        this.emit('files-change', this.queue);
        this.openNextCrop();
    }

    private validate(file: File): string | null {
        if (this.accept && !this.isAccepted(file, this.accept)) return this.t.fileTypeNotAccepted;
        if (this.maxSize !== null && file.size > this.maxSize) {
            return interpolate(this.t.fileTooLarge, { size: this.formatSize(this.maxSize) });
        }
        return null;
    }

    private tooManyFilesMessage(cap: number | null): string {
        return interpolate(this.t.tooManyFiles ?? 'Maximum of {count} files allowed', { count: cap ?? 0 });
    }

    private isAccepted(file: File, accept: string): boolean {
        return accept.split(',').some((raw) => {
            const type = raw.trim();
            if (type.startsWith('.')) return file.name.toLowerCase().endsWith(type.toLowerCase());
            if (type.endsWith('/*')) return file.type.startsWith(type.slice(0, -1));
            return file.type === type;
        });
    }

    /** The single place a queue item is minted. */
    private enqueue(file: File): FileUploadItem {
        const item: FileUploadItem = {
            file,
            id: newId(),
            progress: 0,
            status: 'pending',
            preview: isImageFile(file) ? URL.createObjectURL(file) : undefined,
        };
        this.queue = [...this.queue, item];
        this.emit('file-added', item);
        return item;
    }

    /** Drops one queued file by `id`, revoking its preview and firing `file-removed` then `files-change`. Unknown ids are ignored. */
    removeFile(id: string, event?: Event): void {
        event?.stopPropagation();
        const item = this.queue.find((entry) => entry.id === id);
        if (!item) return;
        if (item.preview) URL.revokeObjectURL(item.preview);
        this.queue = this.queue.filter((entry) => entry.id !== id);
        this.emit('file-removed', item);
        this.emit('files-change', this.queue);
    }

    /**
     * Reports upload progress for a queued file: `0` to `99` shows the bar and sets `uploading`, `100` and above
     * marks it `complete`. Does not fire `files-change`.
     */
    updateFileProgress(id: string, progress: number): void {
        const status: FileUploadStatus = progress >= 100 ? 'complete' : 'uploading';
        this.queue = this.queue.map((entry) => (entry.id === id ? { ...entry, progress, status } : entry));
    }

    /** Marks a queued file as failed and shows `error` under its name. It stays queued until removed. */
    setFileError(id: string, error: string): void {
        this.queue = this.queue.map((entry) => (entry.id === id ? { ...entry, status: 'error', error } : entry));
    }

    /** Empties the queue, revoking every preview and firing one `files-change` with `[]`. */
    clearFiles(): void {
        for (const entry of this.queue) if (entry.preview) URL.revokeObjectURL(entry.preview);
        this.queue = [];
        this.emit('files-change', this.queue);
    }

    /** Binary (1024) steps up to GB with one trimmed decimal: `1.5 MB`, `10 KB`. `null` is empty, `0` is `0 B`. */
    formatSize(bytes: number | null): string {
        if (bytes === null) return '';
        if (bytes === 0) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${Number.parseFloat((bytes / 1024 ** i).toFixed(1))} ${sizes[i]}`;
    }

    // ---- cropping ------------------------------------------------------------------------------------------

    /** Opens the panel on the next held image, if the panel is free. */
    private openNextCrop(): void {
        if (this.cropFile !== null) return;
        const [next, ...rest] = this.cropQueue;
        if (!next) return;
        this.cropQueue = rest;
        this.cropFile = next;
        this.cropPreview = URL.createObjectURL(next);
        this.cropNatural = { width: 0, height: 0 };
        this.cropRect = { x: 0, y: 0, width: 0, height: 0 };
    }

    private closeCropPanel(): void {
        this.cropDragCleanup?.();
        this.cropDragCleanup = null;
        if (this.cropPreview) URL.revokeObjectURL(this.cropPreview);
        this.cropPreview = null;
        this.cropFile = null;
    }

    private readonly onCropImageLoad = (event: Event) => {
        const img = event.target as HTMLImageElement;
        this.cropNatural = { width: img.naturalWidth, height: img.naturalHeight };
        this.cropRect = initialCropRect(this.cropNatural, this.cropAspect);
    };

    /** Replaces the selection, clamped inside the image. Use it to drive the crop from your own UI. */
    setCropRect(rect: CropRect): void {
        this.cropRect = clampCropRect(rect, this.cropNatural);
    }

    /**
     * Cuts the selection out of the held image, queues the result in place of the original, fires `cropped` and
     * moves to the next image. If re-encoding fails the original is queued untouched and reported on `file-error`.
     */
    async applyCrop(): Promise<void> {
        const original = this.cropFile;
        if (!original || this.isCropping) return;
        this.isCropping = true;
        const rect = clampCropRect(this.cropRect, this.cropNatural);
        try {
            const file = await cropImageFile(original, rect);
            this.closeCropPanel();
            this.enqueue(file);
            this.emit<CropResult>('cropped', { original, file, rect });
        } catch {
            this.closeCropPanel();
            this.enqueue(original);
            this.emit('file-error', { file: original, error: this.t.cropFailed ?? 'Could not crop this image' });
        } finally {
            this.isCropping = false;
            this.emit('files-change', this.queue);
            this.openNextCrop();
        }
    }

    /** Queues the held image uncropped and moves on. */
    skipCrop(): void {
        const original = this.cropFile;
        if (!original) return;
        this.closeCropPanel();
        this.enqueue(original);
        this.emit('files-change', this.queue);
        this.openNextCrop();
    }

    /** Discards the held image and every image still waiting behind it. */
    cancelCrop(): void {
        this.cropQueue = [];
        this.closeCropPanel();
    }

    private startCropMove(event: MouseEvent | TouchEvent, frame: HTMLElement): void {
        this.beginCropDrag(event, frame, (dx, dy, origin, scale) =>
            this.setCropRect({ ...origin, x: origin.x + dx * scale, y: origin.y + dy * scale }),
        );
    }

    private startCropResize(event: MouseEvent | TouchEvent, frame: HTMLElement): void {
        this.beginCropDrag(event, frame, (dx, dy, origin, scale) => {
            const aspect = this.cropAspect;
            const width = origin.width + dx * scale;
            const height = aspect === null || aspect <= 0 ? origin.height + dy * scale : width / aspect;
            this.setCropRect({ ...origin, width, height });
        });
    }

    /** `frame` is the displayed image's box, which converts pointer travel in CSS pixels into source pixels. */
    private beginCropDrag(
        event: MouseEvent | TouchEvent,
        frame: HTMLElement,
        update: (dx: number, dy: number, origin: CropRect, scale: number) => void,
    ): void {
        const start = pointerPosition(event);
        if (!start) return;
        event.preventDefault();
        event.stopPropagation();
        const origin = this.cropRect;
        const box = frame.getBoundingClientRect();
        const scale = box.width > 0 ? this.cropNatural.width / box.width : 1;
        this.cropDragCleanup?.();
        this.cropDragCleanup = onPointerDrag(
            (clientX, clientY) => update(clientX - start.x, clientY - start.y, origin, scale),
            () => {
                this.cropDragCleanup = null;
            },
        );
    }

    /** Arrows move the box, `+` / `-` resize it, Shift multiplies the step by ten. */
    private readonly onCropKeydown = (event: KeyboardEvent) => {
        const next = cropKeyStep(event.key, this.cropRect, event.shiftKey ? 10 : 1, this.cropAspect);
        if (!next) return;
        event.preventDefault();
        this.setCropRect(next);
    };

    // ---- rendering -----------------------------------------------------------------------------------------

    protected override render() {
        const t = this.t;
        const rtl = Boolean(t.rtl);
        return html`<div class="root" data-slot="file-upload" dir=${rtl ? 'rtl' : 'ltr'}>
            <!-- The real control is the focusable file input: this wrapper is chrome, so click and drag are only a pointer convenience. -->
            <div
                class="dropzone"
                part="dropzone"
                role="presentation"
                ?data-disabled=${this.isDisabled}
                ?data-dragging=${this.isDragging}
                aria-disabled=${this.isDisabled ? 'true' : nothing}
                @dragover=${this.onDragOver}
                @dragleave=${this.onDragLeave}
                @drop=${this.onDrop}
                @click=${() => this.openFilePicker()}
            >
                <input
                    type="file"
                    class="sr-only"
                    aria-label=${t.uploadFiles}
                    .accept=${this.accept}
                    .multiple=${this.multiple}
                    ?disabled=${this.isDisabled}
                    webkitdirectory=${this.allowDirectories ? '' : nothing}
                    @change=${this.onFileSelected}
                    @click=${(event: Event) => event.stopPropagation()}
                />
                ${this.queue.length === 0 ? this.renderEmpty(t) : this.renderList(t)}
            </div>
            ${this.cropFile ? this.renderCrop(t) : nothing}
        </div>`;
    }

    private renderEmpty(t: FileUploadLocale): TemplateResult {
        return html`<div class="empty">
            ${UPLOAD_ICON}
            <div>
                <p class="title">${t.dragDropHere}</p>
                <p class="hint">${t.orClickToBrowse}</p>
            </div>
            ${this.maxSize === null ? nothing : html`<p class="hint">${interpolate(t.maxSize, { size: this.formatSize(this.maxSize) })}</p>`}
        </div>`;
    }

    private renderList(t: FileUploadLocale): TemplateResult {
        return html`<div class="list">
            ${this.queue.map(
                (item) => html`<div class="row" data-status=${item.status}>
                    ${item.preview
                        ? html`<img class="thumb" src=${item.preview} alt="" />`
                        : html`<div class="thumb placeholder">${FILE_ICON}</div>`}
                    <div class="meta">
                        <p class="name">${item.file.name}</p>
                        <p class="size">${this.formatSize(item.file.size)}</p>
                        ${item.status === 'uploading' ? html`<ge-progress class="bar" .value=${item.progress}></ge-progress>` : nothing}
                        ${item.status === 'error' && item.error ? html`<p class="error">${item.error}</p>` : nothing}
                    </div>
                    <ge-button class="remove" type="button" variant="outline" aria-label=${t.removeFile} @click=${(event: Event) => this.removeFile(item.id, event)}>
                        ${REMOVE_ICON}
                    </ge-button>
                </div>`,
            )}
            <ge-button class="add-more" type="button" variant="outline" @click=${(event: Event) => {
                this.openFilePicker();
                event.stopPropagation();
            }}>${t.addMoreFiles}</ge-button>
        </div>`;
    }

    private renderCrop(t: FileUploadLocale): TemplateResult {
        const title = t.cropTitle ?? 'Crop image';
        const remaining = this.cropQueue.length;
        const { width, height } = this.cropNatural;
        const rect = this.cropRect;
        const box = width > 0 && height > 0
            ? `left:${(rect.x / width) * 100}%;top:${(rect.y / height) * 100}%;width:${(rect.width / width) * 100}%;height:${(rect.height / height) * 100}%`
            : null;
        return html`<section class="crop" data-slot="file-upload-crop" aria-label=${title}>
            <div class="crop-head">
                <p class="crop-title">${title}</p>
                ${remaining > 0 ? html`<span class="crop-remaining" data-slot="file-upload-crop-remaining">+${remaining}</span>` : nothing}
            </div>
            <div class="frame" data-slot="file-upload-crop-frame">
                ${this.cropPreview ? html`<img src=${this.cropPreview} alt="" draggable="false" @load=${this.onCropImageLoad} />` : nothing}
                ${box
                    ? html`<div
                          class="box"
                          data-slot="file-upload-crop-box"
                          style=${box}
                          @mousedown=${(event: MouseEvent) => this.startCropMove(event, this.frame())}
                          @touchstart=${(event: TouchEvent) => this.startCropMove(event, this.frame())}
                      >
                          <button
                              type="button"
                              class="move"
                              data-slot="file-upload-crop-move"
                              aria-label=${t.cropRegion ?? 'Crop region'}
                              @mousedown=${(event: MouseEvent) => this.startCropMove(event, this.frame())}
                              @touchstart=${(event: TouchEvent) => this.startCropMove(event, this.frame())}
                              @keydown=${this.onCropKeydown}
                          ></button>
                          <button
                              type="button"
                              class="handle"
                              data-slot="file-upload-crop-handle"
                              aria-label=${t.cropResizeHandle ?? 'Resize crop'}
                              @mousedown=${(event: MouseEvent) => this.startCropResize(event, this.frame())}
                              @touchstart=${(event: TouchEvent) => this.startCropResize(event, this.frame())}
                              @keydown=${this.onCropKeydown}
                          ></button>
                      </div>`
                    : nothing}
            </div>
            <div class="crop-actions">
                <ge-button type="button" variant="ghost" @click=${() => this.cancelCrop()}>${t.cropCancel ?? 'Cancel'}</ge-button>
                <ge-button type="button" variant="outline" @click=${() => this.skipCrop()}>${t.cropSkip ?? 'Skip'}</ge-button>
                <ge-button type="button" ?disabled=${this.isCropping} @click=${() => this.applyCrop()}>${t.cropApply ?? 'Apply'}</ge-button>
            </div>
        </section>`;
    }

    private frame(): HTMLElement {
        return this.renderRoot.querySelector<HTMLElement>('.frame') as HTMLElement;
    }
}

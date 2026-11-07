import { defineAddon, resolveAddonLocale } from '../../rich-text-addon-kit.js';
import type { RichTextAddonHost, RichTextAddonOptions } from '../../rich-text-host.js';
import { RichTextPasteNormalizer } from '../../rich-text-paste-normalizer.js';
import { Disposables } from '../../rich-text-registry.js';
import { ImagesAutoUpload, type ImagesUploader } from './images-auto-upload.js';
import { ImagesButton } from './images-button.js';
import { RICH_TEXT_IMAGES_LOCALES, type RichTextImagesLocale } from './images-locale.js';
import { renderImagesOverlay } from './images-overlay.js';
import { ImageResizer } from './images-resizer.js';
import {
    createImageElement,
    placeImageAtSelection,
    readFileAsDataUrl,
    type ImageAlignment,
    type ImageInsertDefaults,
    type ImageSources,
} from './images-utils.js';
import documentCss from './images-document.css?inline';
import shadowCss from './images.css?inline';

const SLOT_ID = 'images.insert';

/** How images reach their final URL. */
export interface RichTextImagesUploadOptions {
    /** Turns a picked, dropped or pasted file into the URL stored in the document; `signal` aborts when the editor goes away. Without it, files are inserted as data URLs (or refused when `sources` is `'upload'`). */
    readonly uploader?: ImagesUploader;
    /** Also send base64 images that were pasted or typed through `uploader`. Default `false`. */
    readonly auto?: boolean;
    /** Which sources the insert popover offers. Default `'all'`. */
    readonly sources?: ImageSources;
}

/** How inserted images are sized and placed. */
export interface RichTextImagesLayoutOptions {
    /** Drag handles on a selected image. Default `true`. */
    readonly resize?: boolean;
    /** Alignment buttons on a selected image. Default `true`. */
    readonly alignment?: boolean;
    /** Width applied to every inserted image (px or any CSS length). */
    readonly defaultWidth?: number | string;
    /** Height applied to every inserted image (px or any CSS length). */
    readonly defaultHeight?: number | string;
    /** Alignment applied to every inserted image. Default `'inline'`. */
    readonly defaultAlignment?: ImageAlignment;
    /** Lower clamp for drag-resizing, in px. Default `20`. */
    readonly minWidth?: number;
    /** Upper clamp for drag-resizing, in px. No ceiling when unset. */
    readonly maxWidth?: number;
    /** Keep the aspect ratio while resizing. Default `true`. */
    readonly lockAspectRatio?: boolean;
}

/**
 * Options of the images addon (`.addonOptions=${{ images: {...} }}`).
 * Events (bubbling, composed, on the editor): `image-upload-start` (File), `image-upload-complete` (final URL),
 * `image-upload-error` (message), `auto-image-upload-complete` (final URL), `auto-image-upload-error` (message).
 */
export interface RichTextImagesOptions extends RichTextAddonOptions {
    /** A locale id (`'he'`) or a full dictionary; the editor's locale when unset. */
    readonly locale?: string | RichTextImagesLocale;
    readonly upload?: RichTextImagesUploadOptions;
    readonly layout?: RichTextImagesLayoutOptions;
}

const DEFAULT_LAYOUT: Required<Pick<RichTextImagesLayoutOptions, 'resize' | 'alignment' | 'defaultAlignment' | 'minWidth' | 'lockAspectRatio'>> = {
    resize: true,
    alignment: true,
    defaultAlignment: 'inline',
    minWidth: 20,
    lockAspectRatio: true,
};

const isImage = (file: File): boolean => file.type.startsWith('image/');

class ImagesController {
    private readonly locale: RichTextImagesLocale;
    private readonly sources: ImageSources;
    private readonly layout: RichTextImagesLayoutOptions & typeof DEFAULT_LAYOUT;
    private readonly normalizer: RichTextPasteNormalizer;
    private readonly resizer: ImageResizer;
    private readonly button: ImagesButton;
    private readonly manual = new AbortController();
    private auto: ImagesAutoUpload | undefined;
    private uploads = 0;
    private destroyed = false;

    constructor(
        private readonly host: RichTextAddonHost,
        private readonly options: RichTextImagesOptions,
        private readonly life: Disposables,
    ) {
        this.locale = resolveAddonLocale(RICH_TEXT_IMAGES_LOCALES, host, options.locale);
        this.sources = options.upload?.sources ?? 'all';
        this.layout = { ...DEFAULT_LAYOUT, ...options.layout };
        this.normalizer = new RichTextPasteNormalizer({ document: host.doc, markdown: host.markdown });
        this.resizer = this.createResizer();
        this.button = new ImagesButton({
            host,
            locale: () => this.locale,
            sources: () => this.sources,
            onOpen: () => host.saveSelection(),
            onInsertUrl: (url, alt) => this.insertFromUrl(url, alt),
            onUploadFile: (file) => void this.insertImageFile(file),
        });
    }

    attach(): void {
        const { host, life } = this;
        life.add(() => this.destroy());
        life.add(host.adoptStyles(shadowCss, 'shadow'));
        if (this.options.toolbar) {
            life.add(host.toolbarSlots.register({ id: SLOT_ID, order: this.options.order, render: () => this.button.render() }));
        }
        life.add(host.registerPasteInterceptor((event) => this.onPaste(event)));
        life.add(host.registerDropInterceptor((event) => this.onDrop(event)));
        life.add(host.registerDropZonePredicate((event) => this.hasImageItem(event)));
        if (this.canUseUpload) life.add(host.registerImageFileHandler((file) => void this.insertImageFile(file)));
        life.add(host.subscribe('selection', () => this.syncSelection()));
        life.add(host.overlays.register({ id: SLOT_ID, render: () => this.renderOverlay() }));
        this.startAutoUpload();
        this.syncSelection();
    }

    private get canUseUpload(): boolean {
        return this.sources !== 'url';
    }

    private get canUseUrl(): boolean {
        return this.sources !== 'upload';
    }

    private get defaults(): ImageInsertDefaults {
        const { defaultWidth, defaultHeight, defaultAlignment } = this.layout;
        return { width: defaultWidth, height: defaultHeight, alignment: defaultAlignment };
    }

    private createResizer(): ImageResizer {
        const { host, layout, locale } = this;
        const resizer = new ImageResizer({
            doc: host.doc,
            container: () => host.contentRoot,
            origin: () => host.overlayAnchor,
            requestRender: () => host.invalidate(),
            onResizeEnd: () => host.mutateContent(() => undefined),
            onAlign: () => host.mutateContent(() => undefined),
            onRemove: (image) => {
                host.mutateContent(() => image.remove());
                host.setSelectedImage(null);
            },
        });
        resizer.labels = locale;
        resizer.resizable = layout.resize;
        resizer.showAlignment = layout.alignment;
        resizer.minWidth = layout.minWidth;
        resizer.maxWidth = layout.maxWidth;
        resizer.lockAspectRatio = layout.lockAspectRatio;
        return resizer;
    }

    private destroy(): void {
        this.destroyed = true;
        this.manual.abort();
        this.auto?.stop();
        this.resizer.dispose();
        this.button.dispose();
    }

    private syncSelection(): void {
        const { host } = this;
        const next = host.isDisabled || host.readonly ? null : host.selectedImage;
        if (next === this.resizer.target) return;
        this.resizer.setTarget(next);
        host.invalidate();
    }

    private renderOverlay() {
        return renderImagesOverlay({
            locale: this.locale,
            uploading: this.uploads > 0,
            failures: this.auto?.failures ?? new Map(),
            origin: this.host.overlayAnchor,
            resizer: this.resizer,
            onRetry: (id) => this.auto?.retry(id),
            onRemove: (id) => this.auto?.remove(id),
        });
    }

    private startAutoUpload(): void {
        const uploader = this.options.upload?.uploader;
        if (!this.options.upload?.auto || !uploader) return;
        const { host, life } = this;
        life.add(host.adoptStyles(documentCss, 'document'));
        this.auto = new ImagesAutoUpload({
            host,
            uploader,
            notImageMessage: () => this.locale.uploadNotImage,
            onComplete: (url) => host.emit('auto-image-upload-complete', url),
            onError: (message) => host.emit('auto-image-upload-error', message),
            onFailuresChange: () => host.invalidate(),
        });
        this.auto.start();
    }

    private hasImageItem(event: DragEvent): boolean {
        return Array.from(event.dataTransfer?.items ?? []).some((item) => item.type.startsWith('image/'));
    }

    private onPaste(event: ClipboardEvent): boolean {
        const data = event.clipboardData;
        const file = Array.from(data?.files ?? []).find(isImage);
        if (!file) return false;
        if (this.normalizer.detectSource(data?.getData('text/html') ?? null, data?.getData('text/plain') ?? '') === 'excel') return false;
        void this.insertImageFile(file);
        return true;
    }

    private onDrop(event: DragEvent): boolean {
        const file = Array.from(event.dataTransfer?.files ?? []).find(isImage);
        if (!file) return false;
        event.preventDefault();
        void this.insertImageFile(file);
        return true;
    }

    private fail(message: string): void {
        this.host.emit('image-upload-error', message);
    }

    private insertFromUrl(url: string, alt: string): void {
        const safe = this.host.sanitizer.sanitizeImageSrc(url);
        if (safe) this.insertImage(safe, alt);
        else this.fail('Invalid image URL.');
    }

    private insertImage(src: string, alt: string): void {
        const { host } = this;
        host.restoreSelection();
        host.mutateContent((root) => {
            const image = createImageElement(root.ownerDocument, src, alt, this.defaults);
            placeImageAtSelection(root.ownerDocument, root, image, host.getSelection());
        });
    }

    private async insertImageFile(file: File): Promise<void> {
        const uploader = this.options.upload?.uploader;
        if (this.canUseUpload && uploader) await this.uploadFile(file, uploader);
        else if (this.canUseUrl) await this.insertAsDataUrl(file);
        else this.fail('No imageUploader configured.');
    }

    private async insertAsDataUrl(file: File): Promise<void> {
        try {
            const dataUrl = await readFileAsDataUrl(file);
            if (this.destroyed) return;
            if (!dataUrl.toLowerCase().startsWith('data:image/')) {
                this.fail('Pasted image is not allowed by sanitizer policy.');
                return;
            }
            this.insertImage(dataUrl, file.name);
            this.host.emit('image-upload-complete', dataUrl);
        } catch {
            if (!this.destroyed) this.fail('Could not read image file.');
        }
    }

    private async uploadFile(file: File, uploader: ImagesUploader): Promise<void> {
        this.setUploading(1);
        this.host.emit('image-upload-start', file);
        try {
            const url = await uploader(file, this.manual.signal);
            if (this.destroyed) return;
            const safe = this.host.sanitizer.sanitizeImageSrc(url);
            if (!safe) {
                this.fail('Uploaded image URL is not allowed by sanitizer policy.');
                return;
            }
            this.insertImage(safe, file.name);
            this.host.emit('image-upload-complete', safe);
        } catch (error: unknown) {
            if (!this.destroyed) this.fail(error instanceof Error ? error.message : 'Image upload failed.');
        } finally {
            this.setUploading(-1);
        }
    }

    private setUploading(delta: number): void {
        this.uploads += delta;
        if (!this.destroyed) this.host.invalidate();
    }
}

/**
 * The images addon: a toolbar button with a URL and upload popover, image paste and drop, an optional
 * uploader (also for base64 images that appear in the content), and a resize and align overlay on the
 * selected image. It claims image files for the editor, so file import routes its images here.
 */
export const imagesAddon = defineAddon<RichTextImagesOptions>('images', 325, ({ host, options, life }) => {
    new ImagesController(host, options, life).attach();
});

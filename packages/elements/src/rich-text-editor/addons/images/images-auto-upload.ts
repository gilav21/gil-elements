import { isValidImageDataUrl } from '../../../file-viewer/parsers/image-validator.js';
import type { RichTextAddonHost } from '../../rich-text-host.js';
import type { ImageUploadFailure } from './images-overlay.js';
import { dataUrlToFile, TRANSPARENT_PIXEL } from './images-utils.js';

/** Turns a file into the URL stored in the document. `signal` aborts when the image leaves the editor or the addon stops. */
export type ImagesUploader = (file: File, signal: AbortSignal) => Promise<string>;

export interface ImagesAutoUploadOptions {
    readonly host: Pick<RichTextAddonHost, 'contentRoot' | 'isDisabled' | 'readonly' | 'commitContent' | 'mutateContent' | 'sanitizer'>;
    readonly uploader: ImagesUploader;
    /** Shown when the image's bytes are not a valid image. */
    readonly notImageMessage: () => string;
    readonly onComplete: (url: string) => void;
    readonly onError: (message: string) => void;
    /** The failure badges changed. */
    readonly onFailuresChange: () => void;
}

interface Pending {
    readonly controller: AbortController;
    readonly image: HTMLImageElement;
    readonly dataUrl: string;
}

const isAbort = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError';

/**
 * Sends base64 images that appear in the editable (paste, typing, undo) through the uploader and swaps in
 * the returned URL. The image shows a placeholder and `data-auto-upload-status` while it travels; a failure
 * leaves it marked `error` with a badge to retry or remove it.
 */
export class ImagesAutoUpload {
    private readonly pending = new Map<string, Pending>();
    private readonly failed = new Map<string, ImageUploadFailure>();
    /** The src this class last wrote to each image: such an image is never sent, whatever the observer sees. */
    private readonly written = new WeakMap<HTMLImageElement, string>();
    private observer: MutationObserver | null = null;
    private counter = 0;
    private stopped = false;

    constructor(private readonly options: ImagesAutoUploadOptions) {}

    get failures(): ReadonlyMap<string, ImageUploadFailure> {
        return this.failed;
    }

    start(): void {
        this.observer = new MutationObserver(() => {
            this.cancelDetached();
            this.scan();
        });
        this.observer.observe(this.options.host.contentRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
        this.scan();
    }

    /** Aborts every upload and puts the images back as they were, so a later run sends them again. */
    stop(): void {
        this.stopped = true;
        this.observer?.disconnect();
        this.observer = null;
        for (const { controller } of this.pending.values()) controller.abort();
        for (const { image, dataUrl } of [...this.pending.values(), ...this.failed.values()]) this.restore(image, dataUrl);
        this.pending.clear();
        this.failed.clear();
    }

    retry(id: string): void {
        const failure = this.failed.get(id);
        if (!failure) return;
        this.failed.delete(id);
        this.options.onFailuresChange();
        if (!failure.image.isConnected) return;
        this.restore(failure.image, failure.dataUrl);
        this.process(failure.image);
    }

    remove(id: string): void {
        const failure = this.failed.get(id);
        if (!failure) return;
        this.failed.delete(id);
        this.options.host.mutateContent(() => failure.image.remove());
        this.options.onFailuresChange();
    }

    private scan(): void {
        const { host } = this.options;
        if (this.stopped || host.isDisabled || host.readonly) return;
        for (const image of host.contentRoot.querySelectorAll('img')) {
            if (this.isCandidate(image)) this.process(image);
        }
    }

    /** A base64 image not already travelling and not written by this class; the placeholder is refused by value because undo restores it as a new element. */
    private isCandidate(image: HTMLImageElement): boolean {
        const src = image.getAttribute('src') ?? '';
        return src.startsWith('data:image/') && src !== TRANSPARENT_PIXEL && this.written.get(image) !== src && image.dataset['autoUploadId'] === undefined;
    }

    /** Cancels uploads whose image left the editor; one moved within it (removed and re-added in a batch) keeps its upload. */
    private cancelDetached(): void {
        for (const [id, pending] of this.pending) {
            if (this.options.host.contentRoot.contains(pending.image)) continue;
            pending.controller.abort();
            this.pending.delete(id);
        }
    }

    private writeSrc(image: HTMLImageElement, src: string): void {
        image.setAttribute('src', src);
        this.written.set(image, src);
    }

    private clearMarks(image: HTMLImageElement): void {
        delete image.dataset['autoUploadId'];
        delete image.dataset['autoUploadStatus'];
    }

    private restore(image: HTMLImageElement, dataUrl: string): void {
        this.clearMarks(image);
        image.setAttribute('src', dataUrl);
    }

    private process(image: HTMLImageElement): void {
        const id = `auto-upload-${++this.counter}`;
        const dataUrl = image.getAttribute('src') ?? '';
        this.markUploading(image, id);
        this.options.host.commitContent();
        if (!isValidImageDataUrl(dataUrl)) {
            this.clearMarks(image);
            this.writeSrc(image, TRANSPARENT_PIXEL);
            this.options.host.commitContent();
            this.options.onError(this.options.notImageMessage());
            return;
        }
        this.send(image, id, dataUrl);
    }

    private markUploading(image: HTMLImageElement, id: string): void {
        const size = (axis: 'width' | 'height', fallback: number): number =>
            (axis === 'width' ? image.naturalWidth : image.naturalHeight) || image[axis] || Number.parseInt(image.getAttribute(axis) ?? '0', 10) || fallback;
        const width = size('width', 200);
        const height = size('height', 150);
        image.dataset['autoUploadId'] = id;
        image.dataset['autoUploadStatus'] = 'uploading';
        if (!image.getAttribute('width')) image.setAttribute('width', String(width));
        if (!image.getAttribute('height')) image.setAttribute('height', String(height));
        this.writeSrc(image, TRANSPARENT_PIXEL);
    }

    private send(image: HTMLImageElement, id: string, dataUrl: string): void {
        const extension = (/data:image\/([\w+]+)/.exec(dataUrl)?.[1] ?? 'png').replace('+xml', '');
        const file = dataUrlToFile(dataUrl, `pasted-image-${id}.${extension}`);
        const controller = new AbortController();
        this.pending.set(id, { controller, image, dataUrl });
        this.options.uploader(file, controller.signal).then(
            (url) => this.succeed(image, id, dataUrl, url),
            (error: unknown) => this.fail(image, id, dataUrl, error),
        );
    }

    private succeed(image: HTMLImageElement, id: string, dataUrl: string, uploadedUrl: string): void {
        if (this.stopped) return;
        // Undo, redo and setContent replace the editable wholesale while a request is in flight; writing to the detached node would report a swap that never happened.
        if (!image.isConnected) {
            this.pending.delete(id);
            return;
        }
        const safe = this.options.host.sanitizer.sanitizeImageSrc(uploadedUrl);
        if (!safe) {
            this.fail(image, id, dataUrl, new Error('Uploaded image URL is not allowed by sanitizer policy.'));
            return;
        }
        this.writeSrc(image, safe);
        this.clearMarks(image);
        this.pending.delete(id);
        this.options.host.mutateContent(() => undefined);
        this.options.onComplete(safe);
    }

    private fail(image: HTMLImageElement, id: string, dataUrl: string, error: unknown): void {
        if (this.stopped) return;
        this.pending.delete(id);
        if (isAbort(error)) return;
        const message = error instanceof Error ? error.message : 'Auto image upload failed.';
        if (image.isConnected) {
            image.dataset['autoUploadStatus'] = 'error';
            this.failed.set(id, { dataUrl, image });
            this.options.host.commitContent();
            this.options.onFailuresChange();
        }
        this.options.onError(message);
    }
}

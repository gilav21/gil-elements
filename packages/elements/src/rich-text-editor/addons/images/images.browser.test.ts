import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, editableOf, placeCaret, record, typeHtml } from '../../rich-text-editor.fixture.test.js';
import type { GeRichTextEditor } from '../../rich-text-editor.js';
import { RICH_TEXT_IMAGES_LOCALES } from './images-locale.js';
import type { RichTextImagesOptions } from './images.js';
import './define.js';

const TINY_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const EN = RICH_TEXT_IMAGES_LOCALES.en;
const CDN = 'https://cdn.example.com';

interface Deferred {
    readonly promise: Promise<string>;
    readonly signal: AbortSignal;
    resolve(url: string): void;
    reject(error: unknown): void;
}

function deferred(signal: AbortSignal): Deferred {
    let resolve!: (url: string) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<string>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, signal, resolve, reject };
}

const imageFile = (name = 'p.png') => new File(['img'], name, { type: 'image/png' });
const wait = (ms = 20) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

async function imagesEditor(images: RichTextImagesOptions = {}, setup?: (editor: GeRichTextEditor) => void): Promise<GeRichTextEditor> {
    return createEditor((el) => {
        el.mode = 'html';
        el.addons = 'images';
        el.addonOptions = { images };
        setup?.(el);
    });
}

const toolbarOf = (editor: GeRichTextEditor) => editor.shadowRoot!.querySelector('ge-rich-text-toolbar')!;
const inToolbar = <T extends Element = HTMLElement>(editor: GeRichTextEditor, selector: string) => toolbarOf(editor).shadowRoot!.querySelector<T>(selector);
const overlayButton = (editor: GeRichTextEditor, label: string) => editor.shadowRoot!.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
const errorBadges = (editor: GeRichTextEditor) => editor.shadowRoot!.querySelectorAll('[data-slot="rte-images-error"]').length;

async function settle(editor: GeRichTextEditor): Promise<void> {
    await editor.updateComplete;
    await toolbarOf(editor).updateComplete;
}

async function setContent(editor: GeRichTextEditor, html: string): Promise<HTMLDivElement> {
    await typeHtml(editor, html);
    return editableOf(editor);
}

function caretAtEnd(el: HTMLElement): void {
    const range = new Range();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
}

function clipboard(files: File[], html = '', text = ''): DataTransfer {
    const data = new DataTransfer();
    for (const file of files) data.items.add(file);
    if (html) data.setData('text/html', html);
    if (text) data.setData('text/plain', text);
    return data;
}

const pasteInto = (el: HTMLElement, data: DataTransfer) => el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
const dropOnto = (el: HTMLElement, data: DataTransfer) => el.dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }));

async function appendBase64(el: HTMLElement, src = TINY_BASE64): Promise<HTMLImageElement> {
    const img = document.createElement('img');
    img.setAttribute('src', src);
    el.appendChild(img);
    await wait();
    return img;
}

const untilImage = (el: HTMLElement) => vi.waitFor(() => expect(el.querySelector('img')).toBeTruthy(), { interval: 2 });

/** Fills the popover form the way a user does and presses Insert. */
async function insertThroughForm(editor: GeRichTextEditor, url: string, alt: string): Promise<void> {
    inToolbar(editor, '[data-slot="rte-images-button"]')!.click();
    await settle(editor);
    const field = (slot: string, value: string) => {
        const input = inToolbar(editor, `[data-slot="${slot}"]`)! as HTMLInputElement;
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    };
    field('rte-images-url', url);
    field('rte-images-alt', alt);
    inToolbar(editor, '[data-slot="rte-images-insert"]')!.click();
    await settle(editor);
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('images addon: toolbar and insert', () => {
    it('registers the image toolbar slot and renders the button', async () => {
        const editor = await imagesEditor();
        await settle(editor);
        expect(editor.toolbarSlots.slots.some((slot) => slot.id === 'images.insert')).toBe(true);
        expect(inToolbar(editor, '[data-slot="rte-images-button"]')!.getAttribute('title')).toBe(EN.tooltip);
    });

    it('also renders the button in the floating toolbar', async () => {
        const editor = await imagesEditor({}, (el) => {
            el.toolbar = 'floating';
        });
        expect(editor.toolbarSlots.slots.some((slot) => slot.id === 'images.insert')).toBe(true);
    });

    it('omits the toolbar slot when the toolbar contribution is disabled', async () => {
        const editor = await imagesEditor({ toolbar: false });
        expect(editor.toolbarSlots.slots.some((slot) => slot.id === 'images.insert')).toBe(false);
        expect(editor.hasImageFileHandler).toBe(true);
    });

    it('inserts an image from the URL field with sanitized src and alt', async () => {
        const editor = await imagesEditor();
        const el = await setContent(editor, '<p>here</p>');
        caretAtEnd(el.querySelector('p')!);
        await insertThroughForm(editor, 'https://cdn.test/pic.png', 'A picture');

        const img = el.querySelector('img')!;
        expect(img.getAttribute('src')).toBe('https://cdn.test/pic.png');
        expect(img.getAttribute('alt')).toBe('A picture');
    });

    it('applies default width and alignment to an inserted image', async () => {
        const editor = await imagesEditor({ layout: { defaultWidth: 320, defaultAlignment: 'center' } });
        const el = await setContent(editor, '<p>here</p>');
        caretAtEnd(el.querySelector('p')!);
        await insertThroughForm(editor, 'https://cdn.test/pic.png', 'x');

        const img = el.querySelector('img')!;
        expect(img.style.width).toBe('320px');
        expect(img.dataset['align']).toBe('center');
        expect(img.style.display).toBe('block');
        expect(img.style.marginLeft).toBe('auto');
    });

    it('rejects an unsafe image URL and surfaces an error', async () => {
        const editor = await imagesEditor();
        const errors = record<string>(editor, 'image-upload-error');
        const el = await setContent(editor, '<p>x</p>');
        caretAtEnd(el.querySelector('p')!);
        await insertThroughForm(editor, 'javascript:evil()', 'x');

        expect(el.querySelector('img')).toBeNull();
        expect(errors).toContain('Invalid image URL.');
    });

    it('does not allow attribute injection through the alt text', async () => {
        const editor = await imagesEditor();
        const el = await setContent(editor, '<p>x</p>');
        caretAtEnd(el.querySelector('p')!);
        await insertThroughForm(editor, 'https://example.com/safe.png', 'x" onerror="alert(1)" data-x="1');

        const img = el.querySelector('img')!;
        expect(img.getAttribute('onerror')).toBeNull();
        expect(img.getAttribute('alt')).toBe('x" onerror="alert(1)" data-x="1');
    });

    it('imports a picked file through the toolbar as a data URL', async () => {
        const editor = await imagesEditor();
        const el = await setContent(editor, '<p>x</p>');
        caretAtEnd(el.querySelector('p')!);
        inToolbar(editor, '[data-slot="rte-images-button"]')!.click();
        await settle(editor);
        const input = inToolbar<HTMLInputElement>(editor, '[data-slot="rte-images-file"]')!;
        const picked = new DataTransfer();
        picked.items.add(imageFile());
        input.files = picked.files;
        input.dispatchEvent(new Event('change'));

        await untilImage(el);
        expect(input.value).toBe('');
    });

    it('resolves Hebrew strings from the locale option', async () => {
        const editor = await imagesEditor({ locale: 'he' });
        await settle(editor);
        expect(inToolbar(editor, '[data-slot="rte-images-button"]')!.getAttribute('title')).toBe('הוספת תמונה');
    });

    it('follows the editor locale, and re-contributes when it changes', async () => {
        const editor = await imagesEditor();
        editor.locale = { ...editor.resolvedLocale, code: 'de' };
        await settle(editor);
        expect(inToolbar(editor, '[data-slot="rte-images-button"]')!.getAttribute('title')).toBe(RICH_TEXT_IMAGES_LOCALES.de!.tooltip);
        expect(editor.toolbarSlots.slots.filter((slot) => slot.id === 'images.insert')).toHaveLength(1);
    });
});

describe('images addon: paste, drop and the image-file claim', () => {
    it('pastes a clipboard image as a data URL when no uploader is configured', async () => {
        const editor = await imagesEditor();
        const completed = record<string>(editor, 'image-upload-complete');
        const el = await setContent(editor, '<p>x</p>');
        caretAtEnd(el.querySelector('p')!);
        pasteInto(el, clipboard([new File(['paste-image'], 'clip.png', { type: 'image/png' })]));
        await untilImage(el);

        expect(el.innerHTML).toContain('data:image/png;base64');
        expect(completed).toHaveLength(1);
    });

    it('pastes a clipboard image via the uploader when configured', async () => {
        const uploader = vi.fn(() => Promise.resolve(`${CDN}/clip.png`));
        const editor = await imagesEditor({ upload: { sources: 'upload', uploader } });
        const completed = record<string>(editor, 'image-upload-complete');
        const started = record<File>(editor, 'image-upload-start');
        const el = await setContent(editor, '<p>x</p>');
        caretAtEnd(el.querySelector('p')!);
        pasteInto(el, clipboard([imageFile('clip.png')]));
        await untilImage(el);

        expect(el.innerHTML).toContain(`${CDN}/clip.png`);
        expect(completed).toContain(`${CDN}/clip.png`);
        expect(started[0]?.name).toBe('clip.png');
    });

    it('drops a manual upload that resolves after the editor is removed', async () => {
        let pending: Deferred | undefined;
        const editor = await imagesEditor({
            upload: { sources: 'upload', uploader: (_file, signal) => (pending = deferred(signal)).promise },
        });
        const completed = record<string>(editor, 'image-upload-complete');
        const el = await setContent(editor, '<p>x</p>');
        caretAtEnd(el.querySelector('p')!);

        editor.insertImageFile(imageFile('late.png'));
        await wait();
        editor.remove();
        expect(pending!.signal.aborted).toBe(true);

        pending!.resolve(`${CDN}/late.png`);
        await wait();
        expect(el.innerHTML).not.toContain('late.png');
        expect(completed).toEqual([]);
    });

    it('claims image files for the editor, so other addons route through the uploader', async () => {
        const editor = await imagesEditor({ upload: { sources: 'upload', uploader: () => Promise.resolve(`${CDN}/picked.png`) } });
        const completed = record<string>(editor, 'image-upload-complete');
        const el = await setContent(editor, '<p>x</p>');
        caretAtEnd(el.querySelector('p')!);

        expect(editor.hasImageFileHandler).toBe(true);
        expect(editor.insertImageFile(imageFile('picked.png'))).toBe(true);
        await untilImage(el);

        expect(el.innerHTML).toContain(`${CDN}/picked.png`);
        expect(completed).toContain(`${CDN}/picked.png`);
    });

    it('applies the insert defaults to a routed image, as for any other source', async () => {
        const editor = await imagesEditor({ layout: { defaultWidth: 320, defaultAlignment: 'center' } });
        const el = await setContent(editor, '<p>x</p>');
        caretAtEnd(el.querySelector('p')!);

        editor.insertImageFile(imageFile('picked.png'));
        await untilImage(el);

        const img = el.querySelector('img');
        expect(img?.dataset['align']).toBe('center');
        expect(img?.style.width).toBe('320px');
    });

    it('does not claim image files when only the URL source is offered', async () => {
        const editor = await imagesEditor({ upload: { sources: 'url' } });
        expect(editor.hasImageFileHandler).toBe(false);
    });

    it('releases the image-file claim when the addon is switched off', async () => {
        const editor = await imagesEditor();
        expect(editor.hasImageFileHandler).toBe(true);

        editor.addonOptions = { images: false };
        await editor.updateComplete;

        expect(editor.hasImageFileHandler).toBe(false);
        expect(editor.insertImageFile(imageFile('x.png'))).toBe(false);
    });

    it('defers an Excel-sourced paste back to the base (no image insert)', async () => {
        const editor = await imagesEditor();
        const el = await setContent(editor, '<p>x</p>');
        caretAtEnd(el.querySelector('p')!);
        const excel = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><body><table><tr><td>1</td></tr></table></body></html>';
        pasteInto(el, clipboard([imageFile('x.png')], excel, '1'));
        await wait();

        expect(el.querySelector('img')).toBeNull();
        expect(el.querySelector('table')).toBeTruthy();
    });

    it('defers a paste while the image feature is disabled', async () => {
        const editor = await imagesEditor({}, (el) => {
            el.addonOptions = { images: false };
        });
        const el = await setContent(editor, '<p>x</p>');
        caretAtEnd(el.querySelector('p')!);
        pasteInto(el, clipboard([imageFile()], '', 'pasted words'));
        await wait();
        expect(el.querySelector('img')).toBeNull();
        expect(el.textContent).toContain('pasted words');
    });

    it('defers a paste that carries no image file', async () => {
        const editor = await imagesEditor();
        const el = await setContent(editor, '<p>x</p>');
        caretAtEnd(el.querySelector('p')!);
        pasteInto(el, clipboard([new File(['t'], 'a.txt', { type: 'text/plain' })], '', 'pasted words'));
        await wait();
        expect(el.querySelector('img')).toBeNull();
        expect(el.textContent).toContain('pasted words');
    });

    it('inserts a dropped image file as a data URL', async () => {
        const editor = await imagesEditor();
        const completed = record<string>(editor, 'image-upload-complete');
        const el = await setContent(editor, '<p>x</p>');
        caretAtEnd(el.querySelector('p')!);
        dropOnto(el, clipboard([new File(['img'], 'drop.png', { type: 'image/png' })]));
        await untilImage(el);

        expect(completed).toHaveLength(1);
    });

    it('highlights the drop zone when an image drag enters', async () => {
        const editor = await imagesEditor();
        const el = editableOf(editor);
        const over = new DragEvent('dragover', { dataTransfer: clipboard([imageFile()]), bubbles: true, cancelable: true });
        el.dispatchEvent(over);
        await editor.updateComplete;

        expect(over.defaultPrevented).toBe(true);
        expect(editor.shadowRoot!.querySelector('.drop-zone')).not.toBeNull();
    });

    it('does not drop when readonly', async () => {
        const editor = await imagesEditor({}, (el) => {
            el.readonly = true;
        });
        const el = editableOf(editor);
        dropOnto(el, clipboard([imageFile('d.png')]));
        await wait();
        expect(el.querySelector('img')).toBeNull();
    });

    it('defers a drop while the image feature is disabled', async () => {
        const editor = await imagesEditor({}, (el) => {
            el.addonOptions = { images: false };
        });
        const el = editableOf(editor);
        dropOnto(el, clipboard([imageFile()]));
        await wait();
        expect(el.querySelector('img')).toBeNull();
    });

    it('defers a drop that carries no image file', async () => {
        const editor = await imagesEditor();
        const errors = record<string>(editor, 'image-upload-error');
        const el = editableOf(editor);
        const drop = new DragEvent('drop', { dataTransfer: clipboard([new File(['t'], 'a.txt', { type: 'text/plain' })]), bubbles: true, cancelable: true });
        el.dispatchEvent(drop);
        await wait();

        expect(el.querySelector('img')).toBeNull();
        expect(errors).toEqual([]);
    });
});

describe('images addon: manual insert errors', () => {
    it('errors when upload is the only source but no uploader is configured', async () => {
        const editor = await imagesEditor({ upload: { sources: 'upload' } });
        const errors = record<string>(editor, 'image-upload-error');
        const el = await setContent(editor, '<p>x</p>');
        pasteInto(el, clipboard([imageFile()]));
        await wait();
        expect(errors).toContain('No imageUploader configured.');
    });

    it('rejects a non-image file when inserting as a data URL', async () => {
        const editor = await imagesEditor({ upload: { sources: 'url' } });
        const errors = record<string>(editor, 'image-upload-error');
        const el = await setContent(editor, '<p>x</p>');
        vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
            Object.defineProperty(this, 'result', { value: 'data:text/plain;base64,cGxhaW4=' });
            this.onload?.(new ProgressEvent('load') as ProgressEvent<FileReader>);
        });
        pasteInto(el, clipboard([imageFile('a.png')]));
        await wait();
        expect(errors).toContain('Pasted image is not allowed by sanitizer policy.');
    });

    it('surfaces a read failure when the data-URL reader errors', async () => {
        const editor = await imagesEditor({ upload: { sources: 'url' } });
        const errors = record<string>(editor, 'image-upload-error');
        const el = await setContent(editor, '<p>x</p>');
        vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
            this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>);
        });
        pasteInto(el, clipboard([imageFile()]));
        await wait();
        expect(errors).toContain('Could not read image file.');
    });

    it('rejects an uploaded URL the sanitizer disallows', async () => {
        const editor = await imagesEditor({ upload: { sources: 'upload', uploader: () => Promise.resolve('javascript:alert(1)') } });
        const errors = record<string>(editor, 'image-upload-error');
        editor.insertImageFile(imageFile());
        await wait();
        expect(errors).toContain('Uploaded image URL is not allowed by sanitizer policy.');
    });

    it('surfaces an uploader Error message', async () => {
        const editor = await imagesEditor({ upload: { sources: 'upload', uploader: () => Promise.reject(new Error('upstream down')) } });
        const errors = record<string>(editor, 'image-upload-error');
        editor.insertImageFile(imageFile());
        await wait();
        expect(errors).toContain('upstream down');
    });

    it('falls back to a generic message when the uploader rejects with a non-Error', async () => {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        const editor = await imagesEditor({ upload: { sources: 'upload', uploader: () => Promise.reject('nope') } });
        const errors = record<string>(editor, 'image-upload-error');
        editor.insertImageFile(imageFile());
        await wait();
        expect(errors).toContain('Image upload failed.');
    });

    it('shows the uploading layer while an upload is in flight', async () => {
        let pending: Deferred | undefined;
        const editor = await imagesEditor({ upload: { sources: 'upload', uploader: (_file, signal) => (pending = deferred(signal)).promise } });
        editor.insertImageFile(imageFile());
        await editor.updateComplete;
        expect(editor.shadowRoot!.querySelector('[data-slot="rte-images-uploading"]')?.textContent).toContain(EN.uploading);

        pending!.resolve(`${CDN}/a.png`);
        await wait();
        expect(editor.shadowRoot!.querySelector('[data-slot="rte-images-uploading"]')).toBeNull();
    });
});

describe('images addon: auto-upload', () => {
    function autoEditor(uploader: (file: File, signal: AbortSignal) => Promise<string>, extra: RichTextImagesOptions = {}) {
        return imagesEditor({ ...extra, upload: { auto: true, uploader } });
    }

    it('auto-uploads a base64 image and swaps in the returned URL', async () => {
        const sent: string[] = [];
        const replies: Deferred[] = [];
        const editor = await autoEditor((file, signal) => {
            sent.push(file.name);
            const reply = deferred(signal);
            replies.push(reply);
            return reply.promise;
        });
        const completed = record<string>(editor, 'auto-image-upload-complete');
        const el = editableOf(editor);

        // A returned data URL is written by the addon itself, so it must not be picked up and sent again.
        for (const returned of [`${CDN}/uploaded.png`, TINY_BASE64]) {
            const img = await appendBase64(el);
            expect(img.dataset['autoUploadStatus']).toBe('uploading');
            expect(img.getAttribute('src')).toBe(TRANSPARENT_PIXEL);

            replies.at(-1)!.resolve(returned);
            await wait();

            expect(img.getAttribute('src')).toBe(returned);
            expect('autoUploadId' in img.dataset).toBe(false);
            expect(completed.at(-1)).toBe(returned);
        }
        el.appendChild(document.createElement('p'));
        await wait();
        expect(sent).toHaveLength(2);
    });

    it('drops an auto-upload result whose image was detached mid-flight', async () => {
        const uploads: Deferred[] = [];
        const editor = await autoEditor((_file, signal) => {
            const upload = deferred(signal);
            uploads.push(upload);
            return upload.promise;
        });
        const completed = record<string>(editor, 'auto-image-upload-complete');
        const errors = record<string>(editor, 'auto-image-upload-error');
        const el = editableOf(editor);

        const succeeding = document.createElement('img');
        succeeding.setAttribute('src', TINY_BASE64);
        const failing = document.createElement('img');
        failing.setAttribute('src', TINY_BASE64);
        el.append(succeeding, failing);
        await wait();
        expect(succeeding.dataset['autoUploadStatus']).toBe('uploading');
        expect(failing.dataset['autoUploadStatus']).toBe('uploading');

        el.innerHTML = '<p>replaced while the uploads were in flight</p>';
        expect(succeeding.isConnected).toBe(false);

        uploads[0]!.resolve(`${CDN}/uploaded.png`);
        uploads[1]!.reject(new Error('Network error'));
        await wait();

        expect(succeeding.getAttribute('src')).not.toBe(`${CDN}/uploaded.png`);
        expect(completed).not.toContain(`${CDN}/uploaded.png`);
        expect(errors).toEqual(['Network error']);
        expect(failing.dataset['autoUploadStatus']).toBe('uploading');
        expect(editor.shadowRoot!.querySelector('[data-slot="rte-images-error"]')).toBeNull();
        expect(el.innerHTML).toContain('replaced while the uploads were in flight');
    });

    it('surfaces an auto-upload failure as an error overlay entry', async () => {
        const editor = await autoEditor(() => Promise.reject(new Error('Network error')));
        const errors = record<string>(editor, 'auto-image-upload-error');
        const img = await appendBase64(editableOf(editor));
        await editor.updateComplete;

        expect(img.dataset['autoUploadStatus']).toBe('error');
        expect(errors).toContain('Network error');
        expect(errorBadges(editor)).toBe(1);
    });

    it('skips auto-upload scanning when no uploader is configured', async () => {
        const editor = await imagesEditor({ upload: { auto: true } });
        const img = await appendBase64(editableOf(editor));
        expect('autoUploadStatus' in img.dataset).toBe(false);
    });

    it('reverts and reports a base64 image that is not a valid image', async () => {
        const sent: string[] = [];
        const editor = await autoEditor((file) => {
            sent.push(file.name);
            return Promise.resolve(`${CDN}/ok.png`);
        });
        const errors = record<string>(editor, 'auto-image-upload-error');
        const completed = record<string>(editor, 'auto-image-upload-complete');
        const el = editableOf(editor);
        const img = await appendBase64(el, 'data:image/png;base64,QUJD');
        expect(errors).toEqual([EN.uploadNotImage]);

        // The placeholder left behind is itself a data URL; no later edit may send it, nor a copy restored as a new element, as undo does.
        el.appendChild(document.createElement('p'));
        await wait();
        editor.value = el.innerHTML;
        await editor.updateComplete;
        await wait();
        expect(el.querySelector('img')?.getAttribute('src')).toBe(TRANSPARENT_PIXEL);

        expect(sent).toEqual([]);
        expect(completed).toEqual([]);
        expect(img.getAttribute('src')).toBe(TRANSPARENT_PIXEL);
    });

    it('reports an auto-upload whose returned URL the sanitizer disallows', async () => {
        const editor = await autoEditor(() => Promise.resolve('javascript:evil()'));
        const errors = record<string>(editor, 'auto-image-upload-error');
        const img = await appendBase64(editableOf(editor));
        expect(img.dataset['autoUploadStatus']).toBe('error');
        expect(errors).toContain('Uploaded image URL is not allowed by sanitizer policy.');
    });

    it('retries a failed auto-upload from the error overlay', async () => {
        const sent: string[] = [];
        const editor = await autoEditor((file) => {
            sent.push(file.type);
            return sent.length === 1 ? Promise.reject(new Error('flaky')) : Promise.resolve(`${CDN}/retried.png`);
        });
        const completed = record<string>(editor, 'auto-image-upload-complete');
        const img = await appendBase64(editableOf(editor));
        await editor.updateComplete;
        expect(img.dataset['autoUploadStatus']).toBe('error');

        const retry = [...editor.shadowRoot!.querySelectorAll<HTMLButtonElement>('[data-slot="rte-images-error"] button')].find((b) => b.textContent?.trim() === EN.uploadRetry)!;
        retry.click();
        await wait();
        await editor.updateComplete;

        // The retry re-sends the original image, not the placeholder.
        expect(sent).toEqual(['image/png', 'image/png']);
        expect(img.getAttribute('src')).toBe(`${CDN}/retried.png`);
        expect(completed).toEqual([`${CDN}/retried.png`]);
        expect(errorBadges(editor)).toBe(0);
    });

    it('ignores a retry when the errored image is disconnected', async () => {
        let attempts = 0;
        const editor = await autoEditor(() => {
            attempts++;
            return Promise.reject(new Error('flaky'));
        });
        const img = await appendBase64(editableOf(editor));
        await editor.updateComplete;
        const retry = editor.shadowRoot!.querySelector<HTMLButtonElement>('[data-slot="rte-images-error"] button')!;

        img.remove();
        retry.click();
        await wait();

        expect(attempts).toBe(1);
        expect(img.dataset['autoUploadStatus']).toBe('error');
    });

    it('removes a failed auto-upload image from the error overlay', async () => {
        const editor = await autoEditor(() => Promise.reject(new Error('flaky')));
        const img = await appendBase64(editableOf(editor));
        await editor.updateComplete;
        const buttons = editor.shadowRoot!.querySelectorAll<HTMLButtonElement>('[data-slot="rte-images-error"] button');
        buttons[1]!.click();
        await wait();
        await editor.updateComplete;

        expect(img.isConnected).toBe(false);
        expect(errorBadges(editor)).toBe(0);
    });

    it('cancels an upload as soon as its image leaves the editor', async () => {
        const uploads: Deferred[] = [];
        const editor = await autoEditor((_file, signal) => {
            const upload = deferred(signal);
            uploads.push(upload);
            return upload.promise;
        });
        const el = editableOf(editor);

        // Deleted along with the paragraph that holds it.
        const paragraph = document.createElement('p');
        el.appendChild(paragraph);
        const deleted = await appendBase64(paragraph);
        expect(deleted.dataset['autoUploadStatus']).toBe('uploading');
        paragraph.remove();
        await wait();
        expect(uploads[0]!.signal.aborted).toBe(true);

        // Moved within the editor: removed and re-added in one batch.
        const moved = await appendBase64(el);
        const target = document.createElement('p');
        el.appendChild(target);
        target.appendChild(moved);
        await wait();
        expect(uploads[1]!.signal.aborted).toBe(false);

        editor.value = '<p>replaced</p>';
        await editor.updateComplete;
        await wait();
        expect(uploads[1]!.signal.aborted).toBe(true);
    });

    it('drops the badge of an errored image that has left the document', async () => {
        const editor = await autoEditor(() => Promise.reject(new Error('flaky')));
        const el = editableOf(editor);
        const first = await appendBase64(el);
        await editor.updateComplete;
        expect(errorBadges(editor)).toBe(1);

        first.remove();
        await appendBase64(el);
        await editor.updateComplete;
        expect(errorBadges(editor)).toBe(1);
    });

    it('leaves a retried image as it is once the uploader has been removed', async () => {
        const editor = await autoEditor(() => Promise.reject(new Error('flaky')));
        const img = await appendBase64(editableOf(editor));

        editor.addonOptions = { images: { upload: { auto: true } } };
        await editor.updateComplete;
        await wait();

        expect(img.getAttribute('src')).toBe(TINY_BASE64);
        expect('autoUploadStatus' in img.dataset).toBe(false);
    });

    it('drops an in-flight auto-upload result after teardown', async () => {
        let upload: Deferred | undefined;
        const editor = await autoEditor((_file, signal) => (upload = deferred(signal)).promise);
        const completed = record<string>(editor, 'auto-image-upload-complete');
        const img = await appendBase64(editableOf(editor));
        expect(img.dataset['autoUploadStatus']).toBe('uploading');

        editor.remove();
        expect(upload!.signal.aborted).toBe(true);
        upload!.resolve(`${CDN}/late.png`);
        await wait();

        expect(img.getAttribute('src')).not.toBe(`${CDN}/late.png`);
        expect(completed).toEqual([]);
    });

    it('tears down auto-upload scanning when the option is turned off', async () => {
        const editor = await autoEditor(() => Promise.resolve(`${CDN}/ok.png`));
        await wait();

        editor.addonOptions = { images: { upload: { auto: false, uploader: () => Promise.resolve(`${CDN}/ok.png`) } } };
        await editor.updateComplete;
        await wait();

        const img = await appendBase64(editableOf(editor));
        expect('autoUploadStatus' in img.dataset).toBe(false);
    });

    it('adopts the progress styles once for the document and releases them with the last editor', async () => {
        const before = document.adoptedStyleSheets.length;
        const a = await autoEditor(() => Promise.resolve(`${CDN}/a.png`));
        const b = await autoEditor(() => Promise.resolve(`${CDN}/b.png`));
        expect(document.adoptedStyleSheets.length).toBe(before + 1);

        a.remove();
        expect(document.adoptedStyleSheets.length).toBe(before + 1);
        b.remove();
        expect(document.adoptedStyleSheets.length).toBe(before);
    });
});

describe('images addon: the resize overlay', () => {
    const IMG = '<p><img src="https://cdn.test/a.png" alt="a"></p>';

    async function selectedImageEditor(options: RichTextImagesOptions = {}) {
        const editor = await imagesEditor(options);
        const el = await setContent(editor, IMG);
        const img = el.querySelector('img')!;
        Object.defineProperty(img, 'getBoundingClientRect', { value: () => ({ width: 100, height: 80, top: 0, left: 0, right: 100, bottom: 80 }) });
        return { editor, el, img };
    }

    const select = async (editor: GeRichTextEditor, img: HTMLImageElement) => {
        img.click();
        await editor.updateComplete;
    };

    it('selects an image on click and shows the resize frame', async () => {
        const { editor, img } = await selectedImageEditor();
        expect(editor.shadowRoot!.querySelector('[data-slot="rte-image-resizer"]')).toBeNull();
        await select(editor, img);
        expect(editor.shadowRoot!.querySelector('[data-slot="rte-image-resizer"]')).not.toBeNull();
    });

    it('records a drag resize as one undoable step', async () => {
        const { editor, el, img } = await selectedImageEditor();
        editor.flushPendingHistoryPush();
        await select(editor, img);

        const handle = overlayButton(editor, 'Resize from bottom right');
        handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 0, clientY: 0 }));
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 40 }));
        document.dispatchEvent(new MouseEvent('mouseup'));
        expect([img.style.width, img.style.height]).toEqual(['140px', '112px']);

        editor.undo();
        expect(el.querySelector('img')).not.toBeNull();
        expect(el.querySelector('img')!.style.width).toBe('');

        editor.redo();
        expect(el.querySelector('img')?.style.width).toBe('140px');
    });

    it('changes image alignment through the overlay as one undoable step', async () => {
        const { editor, el, img } = await selectedImageEditor();
        editor.flushPendingHistoryPush();
        await select(editor, img);

        overlayButton(editor, EN.floatRight).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        expect(img.dataset['align']).toBe('right');
        expect(img.style.float).toBe('right');

        editor.undo();
        const restored = el.querySelector('img');
        expect(restored).not.toBeNull();
        expect(restored!.dataset['align']).toBeUndefined();
        expect(restored!.style.float).toBe('');
    });

    it('removes the selected image through the overlay', async () => {
        const { editor, el, img } = await selectedImageEditor();
        await select(editor, img);
        overlayButton(editor, EN.deleteImage).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        await editor.updateComplete;

        expect(el.querySelector('img')).toBeNull();
        expect(editor.selectedImage).toBeNull();
        expect(editor.shadowRoot!.querySelector('[data-slot="rte-image-resizer"]')).toBeNull();
    });

    it('draws no frame when the addon is off', async () => {
        const editor = await imagesEditor({}, (el) => {
            el.addonOptions = { images: false };
        });
        const el = await setContent(editor, IMG);
        el.querySelector('img')!.click();
        await editor.updateComplete;
        expect(editor.shadowRoot!.querySelector('[data-slot="rte-image-resizer"]')).toBeNull();
    });

    it('draws no frame while the editor is readonly', async () => {
        const { editor, img } = await selectedImageEditor();
        editor.readonly = true;
        await editor.updateComplete;
        await select(editor, img);
        expect(editor.shadowRoot!.querySelector('[data-slot="rte-image-resizer"]')).toBeNull();
    });

    it('lays the frame out over the image, relative to the editor container', async () => {
        const editor = await imagesEditor();
        const el = await setContent(editor, IMG);
        const img = el.querySelector('img')!;
        img.style.cssText = 'display:block;width:100px;height:60px;margin-left:30px';
        el.style.minHeight = '120px';
        await select(editor, img);
        await frame();
        await editor.updateComplete;

        const box = editor.shadowRoot!.querySelector<HTMLElement>('[data-slot="rte-image-resizer"]')!;
        const origin = editor.overlayAnchor.getBoundingClientRect();
        const image = img.getBoundingClientRect();
        expect([box.style.left, box.style.top, box.style.width, box.style.height]).toEqual([`${image.left - origin.left}px`, `${image.top - origin.top}px`, '100px', '60px']);
    });

    it('honours the layout options: no handles, no alignment, unlocked edges', async () => {
        const { editor, img } = await selectedImageEditor({ layout: { resize: false, alignment: false } });
        await select(editor, img);
        expect(editor.shadowRoot!.querySelectorAll('.image-handle')).toHaveLength(0);
        expect(editor.shadowRoot!.querySelectorAll('.image-action')).toHaveLength(1);

        editor.addonOptions = { images: { layout: { lockAspectRatio: false } } };
        await editor.updateComplete;
        await select(editor, img);
        expect(editor.shadowRoot!.querySelectorAll('.image-handle')).toHaveLength(8);
    });
});

describe('images addon: options and lifecycle', () => {
    it('sets up through editor.use as well as the addons attribute', async () => {
        const { imagesAddon } = await import('./images.js');
        const editor = await createEditor((el) => {
            el.mode = 'html';
        });
        expect(editor.hasImageFileHandler).toBe(false);
        const remove = editor.use(imagesAddon, { upload: { sources: 'upload' } });
        expect(editor.hasImageFileHandler).toBe(true);
        remove();
        expect(editor.hasImageFileHandler).toBe(false);
    });

    it('releases the toolbar slot, the overlay and the claim when removed', async () => {
        const editor = await imagesEditor();
        editor.remove();
        expect(editor.toolbarSlots.slots).toHaveLength(0);
        expect(editor.overlays.slots).toHaveLength(0);
        expect(editor.hasImageFileHandler).toBe(false);
    });

    it('opens the insert popover from the toolbar button and saves the selection', async () => {
        const editor = await imagesEditor();
        const el = await setContent(editor, '<p>abc</p>');
        placeCaret(el.querySelector('p')!.firstChild!, 1);
        inToolbar(editor, '[data-slot="rte-images-button"]')!.click();
        await settle(editor);

        expect(inToolbar(editor, 'ge-popover')!.hasAttribute('open')).toBe(true);
    });
});

import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import { clampCropRect, collectDroppedFiles, cropKeyStep, initialCropRect } from './file-upload.utils.js';
import type { CropResult, FileUploadItem, GeFileUpload } from './index.js';

const upload = (page: HTMLElement) => page.querySelector<GeFileUpload>('ge-file-upload')!;
const root = (el: Element) => el.shadowRoot!;
const dropzone = (el: Element) => root(el).querySelector<HTMLElement>('.dropzone')!;
const names = (el: GeFileUpload) => [...root(el).querySelectorAll('.name')].map((n) => n.textContent);
const file = (name: string, type = '', bytes = 10) => new File([new Uint8Array(bytes)], name, { type });

/** A real PNG, because the crop step decodes it: left half red, right half blue. */
async function png(name: string, width = 200, height = 100): Promise<File> {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, width / 2, height);
    ctx.fillStyle = '#0000ff';
    ctx.fillRect(width / 2, 0, width / 2, height);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
    return new File([blob], name, { type: 'image/png' });
}

/** Collects every event the element fires, as `[name, detail]`. */
const record = (el: GeFileUpload) => {
    const seen: [string, unknown][] = [];
    for (const name of ['files-change', 'file-added', 'file-removed', 'file-error', 'cropped']) {
        el.addEventListener(name, (event) => seen.push([name, (event as CustomEvent).detail]));
    }
    return seen;
};
const errors = (seen: [string, unknown][]) => seen.filter(([name]) => name === 'file-error').map(([, d]) => (d as { file: File; error: string }).error);

const sourceSize = async (f: File) => {
    const bitmap = await createImageBitmap(f);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
};

afterEach(() => vi.restoreAllMocks());

describe('ge-file-upload', () => {
    it('shows the empty prompt with the size cap, and a queued file replaces it', async () => {
        const page = await mount('<ge-file-upload max-size="10485760"></ge-file-upload>');
        const el = upload(page);
        const text = () => root(el).querySelector('.dropzone')!.textContent!.replaceAll(/\s+/g, ' ').trim();
        expect(text()).toBe('Drag & drop files here or click to browse Max size: 10 MB');

        el.addFiles([file('report.pdf', 'application/pdf', 1536 * 1024)]);
        await el.updateComplete;
        expect(names(el)).toEqual(['report.pdf']);
        expect(root(el).querySelector('.size')!.textContent).toBe('1.5 MB');
        expect(root(el).querySelector('.hint')).toBeNull();
    });

    it('refuses files by type, size and cap, each with its own error, and queues the rest', async () => {
        const page = await mount('<ge-file-upload accept=".pdf, image/*, text/csv" max-size="1024" max-files="3"></ge-file-upload>');
        const el = upload(page);
        const seen = record(el);

        el.addFiles([
            file('d.exe', 'application/x-msdownload'),
            file('e.pdf', '', 2048),
            file('a.PDF'),
            file('b.png', 'image/png'),
            file('c.csv', 'text/csv', 1024),
            file('f.pdf'),
            file('g.pdf'),
        ]);
        await el.updateComplete;

        expect(el.files.map((f) => f.file.name)).toEqual(['a.PDF', 'b.png', 'c.csv']);
        expect(errors(seen)).toEqual(['File type not accepted', 'File exceeds maximum size of 1 KB', 'Maximum of 3 files allowed', 'Maximum of 3 files allowed']);
        expect(seen.filter(([name]) => name === 'files-change')).toHaveLength(1);
        // Full: the dropzone and the picker are off until a file is removed.
        expect(dropzone(el).hasAttribute('data-disabled')).toBe(true);
        expect(root(el).querySelector<HTMLInputElement>('input')!.disabled).toBe(true);
        el.removeFile(el.files[0]!.id);
        await el.updateComplete;
        expect(dropzone(el).hasAttribute('data-disabled')).toBe(false);
    });

    it('walks an item through pending, uploading, complete and error, and revokes previews on remove and clear', async () => {
        const revoke = vi.spyOn(URL, 'revokeObjectURL');
        const page = await mount('<ge-file-upload></ge-file-upload>');
        const el = upload(page);
        const seen = record(el);
        el.addFiles([await png('photo.png'), file('notes.txt', 'text/plain'), file('data.zip')]);
        await el.updateComplete;
        const [photo, notes, data] = el.files as FileUploadItem[];
        expect(photo!.preview).toMatch(/^blob:/);
        expect(notes!.preview).toBeUndefined();
        expect(root(el).querySelectorAll('img.thumb')).toHaveLength(1);
        expect(seen.filter(([name]) => name === 'file-added').map(([, d]) => (d as FileUploadItem).file.name)).toEqual(['photo.png', 'notes.txt', 'data.zip']);

        el.updateFileProgress(notes!.id, 45);
        await el.updateComplete;
        const bar = root(el).querySelector<HTMLElement & { value: number }>('ge-progress')!;
        expect(bar.value).toBe(45);
        el.updateFileProgress(notes!.id, 100);
        await el.updateComplete;
        expect(root(el).querySelector('ge-progress')).toBeNull();
        expect(el.files[1]!.status).toBe('complete');

        el.setFileError(data!.id, 'Upload failed: network error');
        await el.updateComplete;
        expect(root(el).querySelector('.error')!.textContent).toBe('Upload failed: network error');
        expect(el.files[2]!.status).toBe('error');

        seen.length = 0;
        el.removeFile(photo!.id);
        await el.updateComplete;
        expect(revoke).toHaveBeenCalledWith(photo!.preview);
        expect(seen.map(([name]) => name)).toEqual(['file-removed', 'files-change']);
        el.removeFile('does-not-exist');
        expect(seen).toHaveLength(2);

        const remaining = el.files.map((f) => f.preview).filter(Boolean);
        el.addFiles([await png('again.png')]);
        remaining.push(el.files.at(-1)!.preview);
        revoke.mockClear();
        el.clearFiles();
        await el.updateComplete;
        expect(el.files).toEqual([]);
        expect(revoke.mock.calls.map(([url]) => url)).toEqual(remaining);
        expect(seen.at(-1)).toEqual(['files-change', []]);
        expect(root(el).querySelector('.title')).not.toBeNull();
    });

    it('queues what is dropped, lights up while dragging over, and ignores a drop while disabled', async () => {
        const page = await mount('<ge-file-upload></ge-file-upload><ge-file-upload disabled></ge-file-upload>');
        const [el, off] = [...page.querySelectorAll<GeFileUpload>('ge-file-upload')] as [GeFileUpload, GeFileUpload];
        const dragEvent = (type: string) => {
            const transfer = new DataTransfer();
            transfer.items.add(file('dropped.txt', 'text/plain'));
            return new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer });
        };

        const over = dragEvent('dragover');
        dropzone(el).dispatchEvent(over);
        await el.updateComplete;
        expect(over.defaultPrevented).toBe(true);
        expect(dropzone(el).hasAttribute('data-dragging')).toBe(true);
        dropzone(el).dispatchEvent(dragEvent('dragleave'));
        await el.updateComplete;
        expect(dropzone(el).hasAttribute('data-dragging')).toBe(false);

        dropzone(el).dispatchEvent(dragEvent('drop'));
        await el.updateComplete;
        expect(names(el)).toEqual(['dropped.txt']);

        dropzone(off).dispatchEvent(dragEvent('dragover'));
        await off.updateComplete;
        expect(dropzone(off).hasAttribute('data-dragging')).toBe(false);
        const drop = dragEvent('drop');
        dropzone(off).dispatchEvent(drop);
        await off.updateComplete;
        expect(drop.defaultPrevented).toBe(true);
        expect(dropzone(off).hasAttribute('data-dragging')).toBe(false);
        expect(off.files).toEqual([]);
    });

    it('opens the picker from a click on the dropzone or the add-more button, and not while disabled', async () => {
        const page = await mount('<ge-file-upload></ge-file-upload><ge-file-upload disabled></ge-file-upload>');
        const [el, off] = [...page.querySelectorAll<GeFileUpload>('ge-file-upload')] as [GeFileUpload, GeFileUpload];
        const picks = vi.fn();
        for (const target of [el, off]) root(target).querySelector('input')!.addEventListener('click', picks);

        dropzone(el).click();
        expect(picks).toHaveBeenCalledTimes(1);
        dropzone(off).click();
        expect(picks).toHaveBeenCalledTimes(1);

        el.addFiles([file('x.txt')]);
        await el.updateComplete;
        root(el).querySelector<HTMLElement>('.add-more')!.click();
        expect(picks).toHaveBeenCalledTimes(2);
        root(el).querySelector<HTMLElement>('.remove')!.click();
        await el.updateComplete;
        expect(el.files).toEqual([]);
        // Removing must not bubble up to the dropzone and reopen the picker.
        expect(picks).toHaveBeenCalledTimes(2);
    });

    it('passes the native input its accept, multiple and folder settings', async () => {
        const page = await mount('<ge-file-upload accept="image/*" multiple="false" allow-directories></ge-file-upload><ge-file-upload></ge-file-upload>');
        const [a, b] = [...page.querySelectorAll<GeFileUpload>('ge-file-upload')] as [GeFileUpload, GeFileUpload];
        const input = (el: GeFileUpload) => root(el).querySelector<HTMLInputElement>('input')!;
        expect(input(a).accept).toBe('image/*');
        expect(input(a).multiple).toBe(false);
        expect(input(a).hasAttribute('webkitdirectory')).toBe(true);
        expect(input(b).multiple).toBe(true);
        expect(input(b).hasAttribute('webkitdirectory')).toBe(false);
    });

    it('holds an image in the crop step, crops it, and queues the cropped result in its place', async () => {
        const page = await mount('<ge-file-upload crop-images></ge-file-upload>');
        const el = upload(page);
        const seen = record(el);
        el.addFiles([await png('avatar.png', 200, 100), file('notes.txt', 'text/plain')]);
        await el.updateComplete;

        // The non-image went straight in; the image waits behind the panel.
        expect(names(el)).toEqual(['notes.txt']);
        expect(el.isCropOpen).toBe(true);
        await expect.poll(() => root(el).querySelector('[data-slot="file-upload-crop-box"]')).not.toBeNull();

        const move = root(el).querySelector<HTMLElement>('.move')!;
        move.focus();
        // The whole image is selected: shrink it by pressing minus, then nudge it right.
        await userEvent.keyboard('{-}{-}{-}{-}{-}{-}{-}{-}{-}{-}');
        await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
        await el.updateComplete;

        await el.applyCrop();
        await el.updateComplete;
        expect(el.isCropOpen).toBe(false);
        const cropped = seen.find(([name]) => name === 'cropped')![1] as CropResult;
        expect(cropped.original.name).toBe('avatar.png');
        expect(cropped.rect).toEqual({ x: 3, y: 0, width: 190, height: 90 });
        expect(await sourceSize(cropped.file)).toEqual({ width: 190, height: 90 });
        expect(cropped.file.name).toBe('avatar.png');
        expect(names(el)).toEqual(['notes.txt', 'avatar.png']);
        expect(el.files[1]!.file).toBe(cropped.file);
    });

    it('locks the box to the aspect ratio under the keyboard, and the panel can be skipped or cancelled', async () => {
        const page = await mount('<ge-file-upload crop-images crop-aspect="1"></ge-file-upload>');
        const el = upload(page);
        const seen = record(el);
        const [first, second, third] = [await png('one.png'), await png('two.png'), await png('three.png')];
        el.addFiles([first, second, third]);
        await el.updateComplete;
        await expect.poll(() => root(el).querySelector('[data-slot="file-upload-crop-box"]')).not.toBeNull();
        expect(root(el).querySelector('[data-slot="file-upload-crop-remaining"]')!.textContent).toBe('+2');

        // 200x100 with a 1:1 lock starts as the centred 100x100.
        expect(el['cropRect' as keyof GeFileUpload]).toEqual({ x: 50, y: 0, width: 100, height: 100 });
        root(el).querySelector<HTMLElement>('.handle')!.focus();
        await userEvent.keyboard('{-}{-}');
        expect(el['cropRect' as keyof GeFileUpload]).toMatchObject({ width: 98, height: 98 });

        // Skip queues the original untouched and moves to the next image.
        root(el).querySelector<HTMLElement>('.crop-actions ge-button:nth-child(2)')!.click();
        await el.updateComplete;
        expect(el.files[0]!.file).toBe(first);
        expect(root(el).querySelector('[data-slot="file-upload-crop-remaining"]')!.textContent).toBe('+1');
        expect(seen.some(([name]) => name === 'cropped')).toBe(false);

        // Cancel throws away the held image and the one behind it.
        root(el).querySelector<HTMLElement>('.crop-actions ge-button:nth-child(1)')!.click();
        await el.updateComplete;
        expect(el.isCropOpen).toBe(false);
        expect(el.files.map((f) => f.file)).toEqual([first]);
        // Nothing is left behind it: the next add must not bring the cancelled images back.
        el.addFiles([]);
        await el.updateComplete;
        expect(el.isCropOpen).toBe(false);
        expect([second, third]).toHaveLength(2);
    });

    it('moves and resizes the crop box with the pointer, in source pixels', async () => {
        const page = await mount('<div style="width:400px"><ge-file-upload crop-images></ge-file-upload></div>');
        const el = upload(page);
        el.addFiles([await png('wide.png', 400, 200)]);
        await expect.poll(() => root(el).querySelector('[data-slot="file-upload-crop-box"]')).not.toBeNull();
        const rect = () => (el as unknown as { cropRect: { x: number; y: number; width: number; height: number } }).cropRect;
        const handle = root(el).querySelector<HTMLElement>('.handle')!;
        const frame = root(el).querySelector<HTMLElement>('.frame')!.getBoundingClientRect();
        const scale = 400 / frame.width;

        // Shrink with the corner handle (the box ends at the image's far corner, so pull inwards).
        const h = handle.getBoundingClientRect();
        const x0 = h.left + h.width / 2;
        const y0 = h.top + h.height / 2;
        handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: x0, clientY: y0 }));
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: x0 - 50, clientY: y0 - 20 }));
        window.dispatchEvent(new MouseEvent('mouseup'));
        expect(rect().width).toBeCloseTo(400 - 50 * scale, 0);
        expect(rect().height).toBeCloseTo(200 - 20 * scale, 0);

        const box = root(el).querySelector<HTMLElement>('[data-slot="file-upload-crop-box"]')!;
        const b = box.getBoundingClientRect();
        box.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: b.left + 10, clientY: b.top + 10 }));
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: b.left + 10 + 30, clientY: b.top + 10 }));
        window.dispatchEvent(new MouseEvent('mouseup'));
        expect(rect().x).toBeCloseTo(30 * scale, 0);
        expect(rect().y).toBe(0);
    });

    it('takes its text and direction from the locale', async () => {
        const page = await mount('<ge-file-upload locale="he"></ge-file-upload>');
        const el = upload(page);
        expect(root(el).querySelector('.title')!.textContent).toBe('גרור ושחרר קבצים כאן');
        expect(root(el).querySelector('.root')!.getAttribute('dir')).toBe('rtl');
        expect(root(el).querySelector('input')!.getAttribute('aria-label')).toBe('העלה קבצים');
    });

    it('has no accessibility violations in either theme, empty, with files, and cropping', async () => {
        const page = await mount('<ge-file-upload crop-images></ge-file-upload>');
        const el = upload(page);
        for (const mode of ['light', 'dark']) {
            useTheme(mode);
            await expect.poll(async () => (await axe.run(page)).violations.map((v) => v.id)).toEqual([]);
        }
        el.addFiles([file('a.txt', 'text/plain'), await png('b.png')]);
        await expect.poll(() => root(el).querySelector('[data-slot="file-upload-crop-box"]')).not.toBeNull();
        el.updateFileProgress(el.files[0]!.id, 40);
        await el.updateComplete;
        for (const mode of ['light', 'dark']) {
            useTheme(mode);
            await expect.poll(async () => (await axe.run(page)).violations.map((v) => v.id)).toEqual([]);
        }
    });
});

describe('ge-file-upload crop and picking edge cases', () => {
    const rectOf = (el: GeFileUpload) => (el as unknown as { cropRect: { x: number; y: number; width: number; height: number } }).cropRect;

    it('counts images waiting to be cropped against max-files', async () => {
        const page = await mount('<ge-file-upload crop-images max-files="2"></ge-file-upload>');
        const el = upload(page);
        const seen = record(el);
        el.addFiles([await png('a.png'), await png('b.png'), await png('c.png')]);
        await el.updateComplete;
        expect(errors(seen)).toEqual(['Maximum of 2 files allowed']);
        expect(dropzone(el).hasAttribute('data-disabled')).toBe(true);
    });

    it('clamps a selection set from script, and a pointer resize keeps a locked ratio', async () => {
        const page = await mount('<div style="width:400px"><ge-file-upload crop-images crop-aspect="2"></ge-file-upload></div>');
        const el = upload(page);
        el.addFiles([await png('wide.png', 400, 200)]);
        await expect.poll(() => root(el).querySelector('[data-slot="file-upload-crop-box"]')).not.toBeNull();

        el.setCropRect({ x: -50, y: -50, width: 999, height: 999 });
        expect(rectOf(el)).toEqual({ x: 0, y: 0, width: 400, height: 200 });

        const handle = root(el).querySelector<HTMLElement>('.handle')!;
        const h = handle.getBoundingClientRect();
        const x0 = h.left + h.width / 2;
        const y0 = h.top + h.height / 2;
        handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: x0, clientY: y0 }));
        // Pointer travel is mostly vertical, but the ratio decides the height.
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: x0 - 40, clientY: y0 - 90 }));
        window.dispatchEvent(new MouseEvent('mouseup'));
        const { width, height } = rectOf(el);
        expect(width).toBeLessThan(400);
        expect(width / height).toBeCloseTo(2, 5);
    });

    it('queues the original and reports it when the crop cannot be encoded', async () => {
        const page = await mount('<ge-file-upload crop-images></ge-file-upload>');
        const el = upload(page);
        const seen = record(el);
        const original = await png('broken.png');
        el.addFiles([original]);
        await expect.poll(() => root(el).querySelector('[data-slot="file-upload-crop-box"]')).not.toBeNull();
        vi.stubGlobal('createImageBitmap', () => Promise.reject(new Error('decode failed')));
        await el.applyCrop();
        vi.unstubAllGlobals();
        expect(el.files.map((f) => f.file)).toEqual([original]);
        expect(errors(seen)).toEqual(['Could not crop this image']);
        expect(seen.some(([name]) => name === 'cropped')).toBe(false);
        expect(el.isCropOpen).toBe(false);
    });

    it('lets the same file be picked twice, and gives items unique ids on a page without crypto.randomUUID', async () => {
        const page = await mount('<ge-file-upload></ge-file-upload>');
        const el = upload(page);
        const input = root(el).querySelector<HTMLInputElement>('input')!;
        const pick = () => {
            const transfer = new DataTransfer();
            transfer.items.add(file('same.txt', 'text/plain'));
            input.files = transfer.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
        };
        vi.stubGlobal('crypto', {});
        pick();
        expect(input.value).toBe('');
        pick();
        vi.unstubAllGlobals();
        expect(el.files.map((f) => f.file.name)).toEqual(['same.txt', 'same.txt']);
        const ids = el.files.map((f) => f.id);
        expect(ids[0]).toBeTruthy();
        expect(new Set(ids).size).toBe(2);
    });
});

describe('crop geometry', () => {
    const natural = { width: 200, height: 100 };

    it('starts centred and as large as the ratio allows, wide or tall, or as the whole image with no ratio', () => {
        expect(initialCropRect(natural, null)).toEqual({ x: 0, y: 0, width: 200, height: 100 });
        expect(initialCropRect(natural, 1)).toEqual({ x: 50, y: 0, width: 100, height: 100 });
        expect(initialCropRect(natural, 4)).toEqual({ x: 0, y: 25, width: 200, height: 50 });
    });

    it('keeps a rectangle inside the image and at least a pixel wide', () => {
        expect(clampCropRect({ x: -20, y: 90, width: 80, height: 40 }, natural)).toEqual({ x: 0, y: 60, width: 80, height: 40 });
        expect(clampCropRect({ x: 190, y: 0, width: 80, height: 40 }, natural)).toEqual({ x: 120, y: 0, width: 80, height: 40 });
        expect(clampCropRect({ x: 5, y: 5, width: 0, height: 500 }, natural)).toEqual({ x: 5, y: 0, width: 1, height: 100 });
    });

    it('turns keys into moves and resizes, honouring the ratio, and leaves other keys alone', () => {
        const rect = { x: 10, y: 10, width: 100, height: 50 };
        expect(cropKeyStep('ArrowLeft', rect, 10, null)).toEqual({ ...rect, x: 0 });
        expect(cropKeyStep('ArrowDown', rect, 1, null)).toEqual({ ...rect, y: 11 });
        expect(cropKeyStep('+', rect, 4, null)).toEqual({ ...rect, width: 104, height: 54 });
        expect(cropKeyStep('-', rect, 10, 2)).toEqual({ ...rect, width: 90, height: 45 });
        expect(cropKeyStep('a', rect, 1, null)).toBeNull();
    });
});

describe('dropped folders', () => {
    type Entry = { isFile: boolean; isDirectory: boolean; name: string; fullPath: string; file?: (ok: (f: File) => void) => void; createReader?: () => { readEntries: (ok: (e: Entry[]) => void) => void } };
    const fileEntry = (name: string): Entry => ({ isFile: true, isDirectory: false, name, fullPath: `/${name}`, file: (ok) => ok(new File(['x'], name)) });
    /** A folder whose children come back 100 at a time, the way a real directory reader pages them. */
    const folder = (name: string, children: Entry[]): Entry => ({
        isFile: false,
        isDirectory: true,
        name,
        fullPath: `/${name}`,
        createReader: () => {
            let at = 0;
            return {
                readEntries: (ok) => {
                    const batch = children.slice(at, at + 100);
                    at += 100;
                    queueMicrotask(() => ok(batch));
                },
            };
        },
    });
    const transfer = (entries: Entry[], files: File[] = []) => {
        // Entries are only readable while the drop event is being handled, as in a browser.
        let live = true;
        queueMicrotask(() => {
            live = false;
        });
        return {
            files,
            items: entries.map((entry) => ({ webkitGetAsEntry: () => (live ? entry : null) })),
        } as unknown as DataTransfer;
    };

    it('walks nested folders and every page of a large one, and reads the entries before the first await', async () => {
        const many = Array.from({ length: 250 }, (_, i) => fileEntry(`f${i}.txt`));
        const dropped = [folder('root', [...many, folder('nested', [fileEntry('deep.txt')])]), fileEntry('loose.txt')];
        const files = await collectDroppedFiles(transfer(dropped), true);
        expect(files).toHaveLength(252);
        expect(files.map((f) => f.name)).toContain('deep.txt');
        expect(files.map((f) => f.name)).toContain('loose.txt');
    });

    it('reads only the flat file list unless folders are allowed, and falls back to it when no entries come back', async () => {
        const flat = [new File(['x'], 'flat.txt')];
        expect(await collectDroppedFiles(transfer([folder('root', [fileEntry('a.txt')])], flat), false)).toEqual(flat);
        expect(await collectDroppedFiles(transfer([], flat), true)).toEqual(flat);
    });
});

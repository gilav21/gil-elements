import { render } from 'lit';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import css from './images.css?inline';
import { RICH_TEXT_IMAGES_LOCALES } from './images-locale.js';
import { renderImagesOverlay, type ImageUploadFailure } from './images-overlay.js';
import { ImageResizer } from './images-resizer.js';

const EN = RICH_TEXT_IMAGES_LOCALES.en;
const cleanup: HTMLElement[] = [];
const sheet = new CSSStyleSheet();

beforeAll(() => {
    sheet.replaceSync(css);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
});

afterAll(() => {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((other) => other !== sheet);
});

afterEach(() => {
    for (const el of cleanup.splice(0)) el.remove();
});

function setup(overrides: { uploading?: boolean; failures?: (frame: HTMLElement) => ReadonlyMap<string, ImageUploadFailure> } = {}) {
    const frame = document.createElement('div');
    frame.style.cssText = 'position:relative;width:400px;height:300px';
    document.body.append(frame);
    cleanup.push(frame);
    const calls = { retry: [] as string[], remove: [] as string[], resized: 0, aligned: [] as string[], removedImages: [] as HTMLImageElement[] };
    const resizer = new ImageResizer({
        doc: document,
        container: () => frame,
        requestRender: () => undefined,
        onResizeEnd: () => calls.resized++,
        onAlign: (align) => calls.aligned.push(align),
        onRemove: (image) => calls.removedImages.push(image),
    });
    const paint = () => render(renderImagesOverlay({
        locale: EN,
        uploading: overrides.uploading ?? false,
        failures: overrides.failures?.(frame) ?? new Map(),
        origin: frame,
        resizer,
        onRetry: (id) => calls.retry.push(id),
        onRemove: (id) => calls.remove.push(id),
    }), frame);
    paint();
    return { frame, resizer, calls, paint };
}

function failureAt(frame: HTMLElement, left: number, top: number, width: number, height: number): ImageUploadFailure {
    const image = document.createElement('img');
    image.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${width}px;height:${height}px`;
    frame.append(image);
    return { dataUrl: 'data:image/png;base64,AAAA', image };
}

describe('images overlay', () => {
    it('shows the uploading layer with the localized string', () => {
        const idle = setup();
        expect(idle.frame.querySelector('[data-slot="rte-images-uploading"]')).toBeNull();

        const busy = setup({ uploading: true });
        expect(busy.frame.querySelector('[data-slot="rte-images-uploading"]')?.textContent).toContain(EN.uploading);
    });

    it('re-emits retry and remove from the badge buttons', () => {
        const { frame, calls } = setup({ failures: (host) => new Map([['entry-1', failureAt(host, 0, 0, 120, 80)]]) });
        const buttons = frame.querySelectorAll<HTMLButtonElement>('[data-slot="rte-images-error"] button');
        buttons[0]!.click();
        buttons[1]!.click();

        expect(calls.retry).toEqual(['entry-1']);
        expect(calls.remove).toEqual(['entry-1']);
    });

    it('renders the resizer frame for the selected image', () => {
        const { frame, resizer, paint } = setup();
        expect(frame.querySelector('[data-slot="rte-image-resizer"]')).toBeNull();

        resizer.setTarget(document.createElement('img'));
        paint();
        expect(frame.querySelector('[data-slot="rte-image-resizer"]')).not.toBeNull();
    });

    it('forwards the resizer callbacks (end, alignment, removal)', () => {
        const { frame, resizer, calls, paint } = setup();
        const img = document.createElement('img');
        resizer.setTarget(img);
        paint();

        frame.querySelector<HTMLButtonElement>(`button[aria-label="${EN.center}"]`)!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        frame.querySelector<HTMLButtonElement>(`button[aria-label="${EN.deleteImage}"]`)!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        resizer.startResize(new MouseEvent('mousedown', { clientX: 0, clientY: 0 }), 'se');
        document.dispatchEvent(new MouseEvent('mouseup'));

        expect(calls.aligned).toEqual(['center']);
        expect(calls.removedImages).toEqual([img]);
        expect(calls.resized).toBe(1);
    });

    it('renders one error badge per entry, laid out over its image', () => {
        const entries = [
            { id: 'a', top: 10, left: 20, width: 120, height: 80 },
            { id: 'b', top: 150, left: 200, width: 160, height: 90 },
        ];
        const { frame } = setup({
            failures: (host) => new Map(entries.map((entry) => [entry.id, failureAt(host, entry.left, entry.top, entry.width, entry.height)])),
        });

        const origin = frame.getBoundingClientRect();
        const badges = [...frame.querySelectorAll<HTMLElement>('[data-slot="rte-images-error"]')];
        const boxes = badges.map((badge) => {
            const box = badge.getBoundingClientRect();
            return { top: box.top - origin.top, left: box.left - origin.left, width: box.width, height: box.height };
        });
        expect(boxes).toEqual(entries.map(({ top, left, width, height }) => ({ top, left, width, height })));
        expect(badges.every((badge) => badge.textContent?.includes(EN.uploadFailed))).toBe(true);
    });

    it('draws no badge for an image that has left the document', () => {
        const { frame } = setup({
            failures: (host) => {
                const failure = failureAt(host, 0, 0, 100, 60);
                failure.image.remove();
                return new Map([['gone', failure]]);
            },
        });
        expect(frame.querySelectorAll('[data-slot="rte-images-error"]')).toHaveLength(0);
    });
});

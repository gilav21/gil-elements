import { render } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '../../../test-utils.js';
import '../../toolbar-define.js';
import { ImagesButton } from './images-button.js';
import { RICH_TEXT_IMAGES_LOCALES } from './images-locale.js';
import type { ImageSources } from './images-utils.js';
import type { GeRichTextToolbar } from '../../rich-text-toolbar.js';

const EN = RICH_TEXT_IMAGES_LOCALES.en;

interface Setup {
    readonly button: ImagesButton;
    readonly root: HTMLElement;
    readonly state: { disabled: boolean; readonly: boolean; sources: ImageSources };
    readonly onOpen: ReturnType<typeof vi.fn>;
    readonly onInsertUrl: ReturnType<typeof vi.fn>;
    readonly onUploadFile: ReturnType<typeof vi.fn>;
    readonly closeFromGroup: () => void;
    readonly exclusive: { notifyOpened: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };
    paint(): Promise<void>;
}

async function setup(sources: ImageSources = 'all'): Promise<Setup> {
    const page = await mount('<div></div>');
    const root = page.firstElementChild as HTMLElement;
    const state = { disabled: false, readonly: false, sources };
    const onOpen = vi.fn();
    const onInsertUrl = vi.fn();
    const onUploadFile = vi.fn();
    let closeFromGroup: () => void = () => undefined;
    const exclusive = { notifyOpened: vi.fn(), release: vi.fn() };
    const paint = async (): Promise<void> => {
        render(button.render(), root);
        await Promise.all([...root.querySelectorAll('ge-popover, ge-input, ge-button')].map((el) => (el as { updateComplete?: Promise<unknown> }).updateComplete));
    };
    const button = new ImagesButton({
        host: {
            get isDisabled() {
                return state.disabled;
            },
            get readonly() {
                return state.readonly;
            },
            registerExclusivePopover: (close: () => void) => {
                closeFromGroup = close;
                return exclusive;
            },
            invalidate: () => void paint(),
        },
        locale: () => EN,
        sources: () => state.sources,
        onOpen,
        onInsertUrl,
        onUploadFile,
    });
    await paint();
    return { button, root, state, onOpen, onInsertUrl, onUploadFile, exclusive, paint, closeFromGroup: () => closeFromGroup() };
}

const slot = (root: ParentNode, name: string) => root.querySelector<HTMLElement>(`[data-slot="${name}"]`);
const type = (field: HTMLElement | null, value: string) => {
    (field as HTMLInputElement).value = value;
    field!.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('images button', () => {
    it('renders the trigger button with the localized tooltip', async () => {
        const { root } = await setup();
        expect(slot(root, 'rte-images-button')?.getAttribute('title')).toBe(EN.tooltip);
    });

    it('exposes both URL and upload sources by default', async () => {
        const { root } = await setup();
        expect([slot(root, 'rte-images-url') !== null, slot(root, 'rte-images-file') !== null]).toEqual([true, true]);
    });

    it('hides the URL form when sources is upload-only', async () => {
        const { root } = await setup('upload');
        expect([slot(root, 'rte-images-url') !== null, slot(root, 'rte-images-file') !== null]).toEqual([false, true]);
    });

    it('hides the upload control when sources is url-only', async () => {
        const { root } = await setup('url');
        expect([slot(root, 'rte-images-url') !== null, slot(root, 'rte-images-file') !== null]).toEqual([true, false]);
    });

    it('saves the selection and opens on open change', async () => {
        const { button, onOpen, exclusive } = await setup();
        button.onOpenChange(true);
        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(exclusive.notifyOpened).toHaveBeenCalledTimes(1);
        expect(button.isOpen).toBe(true);
    });

    it('does not save the selection when closing', async () => {
        const { button, onOpen } = await setup();
        button.onOpenChange(false);
        expect(onOpen).not.toHaveBeenCalled();
        expect(button.isOpen).toBe(false);
    });

    it('opens and closes the popover from the trigger click', async () => {
        const { root, button, paint } = await setup();
        slot(root, 'rte-images-button')!.click();
        await paint();
        expect(button.isOpen).toBe(true);
        expect(root.querySelector('ge-popover')?.hasAttribute('open')).toBe(true);
    });

    it('closes when another toolbar panel opens', async () => {
        const { button, closeFromGroup } = await setup();
        button.onOpenChange(true);
        closeFromGroup();
        expect(button.isOpen).toBe(false);
    });

    it('releases its place in the exclusive group when disposed', async () => {
        const { button, exclusive } = await setup();
        button.dispose();
        expect(exclusive.release).toHaveBeenCalledTimes(1);
    });

    it('inserts the typed URL and alt through the form and closes the popover', async () => {
        const { root, button, onInsertUrl, paint } = await setup();
        button.onOpenChange(true);
        await paint();
        type(slot(root, 'rte-images-url'), 'https://x/y.png');
        type(slot(root, 'rte-images-alt'), 'alt');
        slot(root, 'rte-images-insert')!.click();

        expect(onInsertUrl).toHaveBeenCalledWith('https://x/y.png', 'alt');
        expect(button.isOpen).toBe(false);
    });

    it('clears the URL and alt fields after an insert', async () => {
        // The popover content stays in the DOM when it closes: whatever was typed would otherwise survive to the next open.
        const { root, button, paint } = await setup();
        button.onOpenChange(true);
        await paint();
        type(slot(root, 'rte-images-url'), 'https://example.test/a.png');
        type(slot(root, 'rte-images-alt'), 'first alt');

        button.insertUrl();
        await paint();

        expect((slot(root, 'rte-images-url') as HTMLInputElement).value).toBe('');
        expect((slot(root, 'rte-images-alt') as HTMLInputElement).value).toBe('');
    });

    it('ignores an empty URL', async () => {
        const { button, onInsertUrl } = await setup();
        button.insertUrl();
        expect(onInsertUrl).not.toHaveBeenCalled();
    });

    it('ignores URL insert while interaction is disabled', async () => {
        const { root, button, onInsertUrl, state, paint } = await setup();
        type(slot(root, 'rte-images-url'), 'https://x/y.png');
        state.disabled = true;
        await paint();
        button.insertUrl();
        expect(onInsertUrl).not.toHaveBeenCalled();
        expect(slot(root, 'rte-images-button')?.hasAttribute('disabled')).toBe(true);
    });

    it('uploads a picked file, clears the input so the same file can be picked again, and closes the popover', async () => {
        const { root, button, onUploadFile } = await setup();
        button.onOpenChange(true);
        const input = slot(root, 'rte-images-file') as HTMLInputElement;
        const file = new File(['x'], 'p.png', { type: 'image/png' });
        const picked = new DataTransfer();
        picked.items.add(file);
        input.files = picked.files;
        expect(input.value).not.toBe('');

        input.dispatchEvent(new Event('change'));

        expect(onUploadFile).toHaveBeenCalledWith(file);
        expect(input.value).toBe('');
        expect(button.isOpen).toBe(false);
    });

    it('forwards the pick button to the hidden file input', async () => {
        const { root } = await setup();
        const input = slot(root, 'rte-images-file') as HTMLInputElement;
        const click = vi.spyOn(input, 'click').mockImplementation(() => undefined);
        slot(root, 'rte-images-pick')!.click();
        expect(click).toHaveBeenCalledTimes(1);
    });

    it('ignores a file change with no file', async () => {
        const { root, button, onUploadFile } = await setup();
        button.pickFile(slot(root, 'rte-images-file') as HTMLInputElement);
        expect(onUploadFile).not.toHaveBeenCalled();
    });

    it('ignores a file change while interaction is disabled', async () => {
        const { root, button, onUploadFile, state } = await setup();
        state.readonly = true;
        const input = slot(root, 'rte-images-file') as HTMLInputElement;
        const picked = new DataTransfer();
        picked.items.add(new File(['x'], 'p.png', { type: 'image/png' }));
        input.files = picked.files;
        button.pickFile(input);
        expect(onUploadFile).not.toHaveBeenCalled();
    });

    it('uses compact padding inside a compact toolbar', async () => {
        const page = await mount('<ge-rich-text-toolbar compact></ge-rich-text-toolbar>');
        const toolbar = page.querySelector<GeRichTextToolbar>('ge-rich-text-toolbar')!;
        const button = new ImagesButton({
            host: { isDisabled: false, readonly: false, registerExclusivePopover: () => ({ notifyOpened: () => undefined, release: () => undefined }), invalidate: () => toolbar.requestUpdate() },
            locale: () => EN,
            sources: () => 'all',
            onOpen: () => undefined,
            onInsertUrl: () => undefined,
            onUploadFile: () => undefined,
        });
        toolbar.slots = [{ id: 'images.insert', render: () => button.render() }];
        await toolbar.updateComplete;

        const trigger = toolbar.shadowRoot!.querySelector<HTMLButtonElement>('[data-slot="rte-images-button"]')!;
        expect(getComputedStyle(trigger).paddingTop).toBe('4px');
        expect(getComputedStyle(trigger).paddingLeft).toBe('4px');
    });
});

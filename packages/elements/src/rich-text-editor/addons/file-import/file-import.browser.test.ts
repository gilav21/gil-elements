import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, editableOf, placeCaret, record } from '../../rich-text-editor.fixture.test.js';
import type { GeRichTextEditor } from '../../rich-text-editor.js';
import { resolveRichTextLocale } from '../../rich-text-locales.js';
import { Disposables } from '../../rich-text-registry.js';
import { FileImportController, type FileImportOptions } from './file-import.js';
import { FILE_IMPORT_LOCALES } from './file-import-locale.js';
import { DOCX_MIME, docxFile, emptyDocxFile, hostileDocxFile, makeZip, pdfBytesWithStream, pdfFile, pngFile } from './file-import.fixture.test.js';
import './define.js';

const SLOT = 'file-import.import';
const EN = FILE_IMPORT_LOCALES.en;
const TRUNCATED_PDF_ERROR = 'Failed to import file. The file may be unsupported or corrupted.';

const importEditor = (options?: FileImportOptions | false, setup?: (editor: GeRichTextEditor) => void): Promise<GeRichTextEditor> =>
    createEditor((editor) => {
        editor.mode = 'html';
        editor.value = '<p>x</p>';
        editor.addons = 'file-import';
        if (options !== undefined) editor.addonOptions = { 'file-import': options };
        setup?.(editor);
    });

const toolbarOf = (editor: GeRichTextEditor) => editor.shadowRoot!.querySelector('ge-rich-text-toolbar')!;
const buttonOf = async (editor: GeRichTextEditor) => {
    await editor.updateComplete;
    await toolbarOf(editor).updateComplete;
    return toolbarOf(editor).shadowRoot!.querySelector<HTMLButtonElement>(`[data-addon-slot="${SLOT}"]`);
};
const inSlot = <T extends Element = HTMLElement>(editor: GeRichTextEditor, slot: string) => editor.shadowRoot!.querySelector<T>(`[data-slot="${slot}"]`);
const inputOf = (editor: GeRichTextEditor) => inSlot<HTMLInputElement>(editor, 'rte-file-import-input')!;

function caretAtEnd(editor: GeRichTextEditor): void {
    const text = editableOf(editor).querySelector('p')!.firstChild!;
    placeCaret(text, text.textContent!.length);
}

/** Chooses `file` through the hidden input, the way the picker reports it. */
function pick(editor: GeRichTextEditor, files: File[]): HTMLInputElement {
    const input = inputOf(editor);
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return input;
}

function dropEvent(type: 'drop' | 'dragover', files: File[]): DragEvent {
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    return new DragEvent(type, { dataTransfer: transfer, bubbles: true, cancelable: true });
}

const importPrivate = (editor: GeRichTextEditor) =>
    new FileImportController(editor, { toolbar: false, order: 340 }, new Disposables()) as unknown as {
        insertImported(markup: string): void;
        injectFontCss(css: string): void;
    };

const removeFontStyles = (): void => document.head.querySelectorAll('style[data-ge-rte-pdf-fonts]').forEach((style) => style.remove());

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    removeFontStyles();
});

describe('file-import addon', () => {
    it('registers the import toolbar slot and renders the button', async () => {
        const editor = await importEditor();
        expect(editor.toolbarSlots.slots.some((slot) => slot.id === SLOT)).toBe(true);
        expect(await buttonOf(editor)).not.toBeNull();
    });

    it('omits the toolbar slot when the toolbar contribution is disabled', async () => {
        const editor = await importEditor({ toolbar: false });
        expect(editor.toolbarSlots.slots.some((slot) => slot.id === SLOT)).toBe(false);
    });

    it('imports a DOCX file and emits the sanitized markup it inserted', async () => {
        const editor = await importEditor();
        const starts = record<File>(editor, 'file-import-start');
        const completes = record<string>(editor, 'file-import-complete');
        caretAtEnd(editor);
        pick(editor, [docxFile('Imported DOCX text', '<w:rPr><w:color w:val="FF0000"/></w:rPr>')]);
        await vi.waitFor(() => expect(completes).toHaveLength(1));

        const [emitted] = completes;
        expect(editableOf(editor).textContent).toContain('Imported DOCX text');
        expect(starts).toHaveLength(1);
        expect(editor.sanitizer.sanitize(emitted!)).toBe(emitted);
        const run = Array.from(new DOMParser().parseFromString(emitted!, 'text/html').querySelectorAll<HTMLElement>('span'))
            .find((span) => span.textContent === 'Imported DOCX text');
        expect(run?.style.color).toBe('rgb(255, 0, 0)');
    });

    it('emits no handler attribute and no script URL for a hostile DOCX', async () => {
        const editor = await importEditor();
        const completes = record<string>(editor, 'file-import-complete');
        caretAtEnd(editor);
        pick(editor, [hostileDocxFile()]);
        await vi.waitFor(() => expect(completes).toHaveLength(1));

        const [emitted] = completes;
        const handlers = Array.from(new DOMParser().parseFromString(emitted!, 'text/html').body.querySelectorAll('*'))
            .flatMap((element) => Array.from(element.attributes).map((attribute) => attribute.name))
            .filter((name) => name.startsWith('on'));
        expect(handlers).toEqual([]);
        expect(emitted).not.toMatch(/javascript:/i);
        expect(emitted).toContain('hostile run');
        expect(editor.sanitizer.sanitize(emitted!)).toBe(emitted);
    });

    it('emits the sanitized wrapper for a PDF import', async () => {
        const editor = await importEditor();
        const completes = record<string>(editor, 'file-import-complete');
        caretAtEnd(editor);
        pick(editor, [pdfFile('Imported PDF text')]);
        await vi.waitFor(() => expect(completes).toHaveLength(1));

        expect(completes[0]).toContain('Imported PDF text');
        expect(editor.sanitizer.sanitize(completes[0]!)).toBe(completes[0]);
    });

    it('imports a valid PDF and inserts its parsed text', async () => {
        const editor = await importEditor();
        const completes = record<string>(editor, 'file-import-complete');
        caretAtEnd(editor);
        pick(editor, [pdfFile('PDF body copy')]);
        await vi.waitFor(() => expect(completes).toHaveLength(1));
        expect(editableOf(editor).textContent).toContain('PDF body copy');
    });

    it('emits what the editor holds for markup that needs sanitizing, not what was handed over', async () => {
        const editor = await importEditor();
        const completes = record<string>(editor, 'file-import-complete');
        caretAtEnd(editor);
        importPrivate(editor).insertImported('<p onclick="alert(1)">kept <script>alert(2)</script>text</p>');

        const [emitted] = completes;
        expect(emitted).toContain('kept');
        expect(emitted).not.toMatch(/onclick|<script|alert/);
        expect(editableOf(editor).innerHTML).toContain(emitted);
    });

    it('reports a failure, and emits nothing, when nothing survives sanitizing', async () => {
        const editor = await importEditor();
        const errors = record<string>(editor, 'file-import-error');
        const completes = record<string>(editor, 'file-import-complete');
        importPrivate(editor).insertImported('<script>alert(1)</script>');

        expect(errors).toEqual([TRUNCATED_PDF_ERROR]);
        expect(completes).toHaveLength(0);
    });

    it('reports a failure when a parsed document yields no content', async () => {
        const editor = await importEditor();
        const errors = record<string>(editor, 'file-import-error');
        const completes = record<string>(editor, 'file-import-complete');
        caretAtEnd(editor);
        pick(editor, [emptyDocxFile()]);
        await vi.waitFor(() => expect(errors).toHaveLength(1));

        expect(errors).toEqual([TRUNCATED_PDF_ERROR]);
        expect(completes).toHaveLength(0);
        expect(editableOf(editor).innerHTML).toBe('<p>x</p>');
    });

    it('starts a truncated PDF import, then reports the localized failure instead of the parser error', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const editor = await importEditor();
        const starts = record<File>(editor, 'file-import-start');
        const errors = record<string>(editor, 'file-import-error');
        const completes = record<string>(editor, 'file-import-complete');
        const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])], 'doc.pdf', { type: 'application/pdf' });
        pick(editor, [file]);
        await vi.waitFor(() => expect(errors).toHaveLength(1));

        expect(starts).toEqual([file]);
        expect(errors).toEqual([TRUNCATED_PDF_ERROR]);
        expect(completes).toHaveLength(0);
    });

    it('refuses a document over the import size ceiling with the localized message, for DOCX and PDF alike', async () => {
        const editor = await importEditor();
        const starts = record<File>(editor, 'file-import-start');
        const errors = record<string>(editor, 'file-import-error');
        const completes = record<string>(editor, 'file-import-complete');
        for (const file of [docxFile(), pdfFile()]) {
            Object.defineProperty(file, 'size', { value: 100 * 1024 * 1024 + 1 });
            const before = errors.length;
            pick(editor, [file]);
            await vi.waitFor(() => expect(errors.length).toBeGreaterThan(before));

            expect(starts.at(-1)).toBe(file);
            expect(errors.at(-1)).toBe('That file is too large to import.');
        }
        expect(completes).toHaveLength(0);
        expect(editableOf(editor).textContent).not.toContain('Imported');
    });

    it('emits the error and shows the overlay for an unrecognized file', async () => {
        const editor = await importEditor();
        const errors = record<string>(editor, 'file-import-error');
        pick(editor, [new File([new Uint8Array([1, 2, 3, 4, 5])], 'note.txt', { type: 'text/plain' })]);
        await vi.waitFor(() => expect(errors).toHaveLength(1));
        await editor.updateComplete;

        expect(errors).toContain('The selected file is not a supported document or image.');
        expect(inSlot(editor, 'rte-file-import-error')).not.toBeNull();
    });

    it('restarts the error dismissal on a second failure and clears the banner 4s after the last one', async () => {
        const editor = await importEditor();
        const errors = record<string>(editor, 'file-import-error');
        const banner = async () => {
            await editor.updateComplete;
            return inSlot(editor, 'rte-file-import-error');
        };
        const realFrame = globalThis.requestAnimationFrame.bind(globalThis);
        const failImport = async (count: number): Promise<void> => {
            pick(editor, [new File([new Uint8Array([1, 2, 3, 4, 5])], 'note.txt')]);
            for (let i = 0; i < 200 && errors.length < count; i++) await new Promise((resolve) => realFrame(resolve));
            expect(errors).toHaveLength(count);
        };
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        await failImport(1);
        vi.advanceTimersByTime(3000);
        await failImport(2);
        vi.advanceTimersByTime(1000);
        expect((await banner())?.textContent).toContain('The selected file is not a supported document or image.');
        vi.advanceTimersByTime(2999);
        expect(await banner()).not.toBeNull();
        vi.advanceTimersByTime(1);
        expect(await banner()).toBeNull();
    });

    describe('images', () => {
        it('routes a picked image to the image pipeline by its bytes, not its declared type', async () => {
            const editor = await importEditor();
            const routed: File[] = [];
            editor.registerImageFileHandler((file) => routed.push(file));
            const starts = record<File>(editor, 'file-import-start');
            const errors = record<string>(editor, 'file-import-error');
            const completes = record<string>(editor, 'file-import-complete');

            const lying = new File([await pngFile().arrayBuffer()], 'note.txt', { type: 'text/plain' });
            pick(editor, [lying]);
            await vi.waitFor(() => expect(routed).toEqual([lying]));

            expect([errors.length, starts.length, completes.length]).toEqual([0, 0, 0]);
            expect(editableOf(editor).querySelector('img')).toBeNull();
        });

        it('offers image types in the picker only while an image handler is registered', async () => {
            const editor = await importEditor();
            const click = vi.spyOn(inputOf(editor), 'click').mockImplementation(() => undefined);
            const button = (await buttonOf(editor))!;

            button.click();
            expect(inputOf(editor).accept).toBe('.pdf,.docx');
            const teardown = editor.registerImageFileHandler(() => undefined);
            button.click();
            expect(inputOf(editor).accept).toBe('.pdf,.docx,.png,.jpg,.jpeg,.gif,.webp');
            teardown();
            button.click();
            expect(inputOf(editor).accept).toBe('.pdf,.docx');
            expect(click).toHaveBeenCalledTimes(3);
        });

        it('an explicit accept option still wins over the dynamic list', async () => {
            const editor = await importEditor({ accept: '.pdf' });
            editor.registerImageFileHandler(() => undefined);
            vi.spyOn(inputOf(editor), 'click').mockImplementation(() => undefined);
            (await buttonOf(editor))!.click();
            expect(inputOf(editor).accept).toBe('.pdf');
        });

        it('reports an error when an image is picked with no image pipeline', async () => {
            const editor = await importEditor();
            const starts = record<File>(editor, 'file-import-start');
            const errors = record<string>(editor, 'file-import-error');
            pick(editor, [pngFile()]);
            await vi.waitFor(() => expect(errors).toHaveLength(1));
            expect(starts).toHaveLength(0);
        });

        it('leaves a dropped image to the images addon rather than claiming it', async () => {
            const editor = await importEditor();
            const starts = record<File>(editor, 'file-import-start');
            const errors = record<string>(editor, 'file-import-error');
            editableOf(editor).dispatchEvent(dropEvent('drop', [pngFile()]));
            await new Promise((resolve) => setTimeout(resolve, 20));

            expect(starts).toHaveLength(0);
            expect(errors).toHaveLength(0);
        });
    });

    describe('drop', () => {
        it('imports a DOCX dropped onto the editor', async () => {
            const editor = await importEditor();
            const completes = record<string>(editor, 'file-import-complete');
            caretAtEnd(editor);
            editableOf(editor).dispatchEvent(dropEvent('drop', [docxFile('Dropped DOCX')]));
            await vi.waitFor(() => expect(completes).toHaveLength(1));
            expect(editableOf(editor).textContent).toContain('Dropped DOCX');
        });

        it('highlights the drop zone when a document drag enters', async () => {
            const editor = await importEditor();
            editableOf(editor).dispatchEvent(dropEvent('dragover', [docxFile()]));
            await editor.updateComplete;
            expect(editor.shadowRoot!.querySelector('.drop-zone')).not.toBeNull();
        });

        it('ignores a drop while the addon is switched off', async () => {
            const editor = await importEditor(false);
            const starts = record<File>(editor, 'file-import-start');
            editableOf(editor).dispatchEvent(dropEvent('drop', [docxFile()]));
            await new Promise((resolve) => setTimeout(resolve, 20));
            expect(starts).toHaveLength(0);
        });
    });

    describe('picker button', () => {
        it('renders the toolbar button with the localized tooltip', async () => {
            const editor = await importEditor();
            const button = (await buttonOf(editor))!;
            expect(button.title).toBe(EN.tooltip);
            expect(button.disabled).toBe(false);
        });

        it('sets the accept attribute on the hidden file input', async () => {
            const editor = await importEditor();
            expect(inputOf(editor).getAttribute('accept')).toBe('.pdf,.docx');
            expect(inputOf(editor).getAttribute('aria-label')).toBe(EN.tooltip);
        });

        it('disables the button when the editor is disabled', async () => {
            const editor = await importEditor();
            editor.disabled = true;
            expect((await buttonOf(editor))!.disabled).toBe(true);
        });

        it('disables the button when the editor is readonly', async () => {
            const editor = await importEditor();
            const slot = editor.toolbarSlots.slots.find((s) => s.id === SLOT)!;
            expect(slot.isEnabled!()).toBe(true);
            editor.readonly = true;
            expect(slot.isEnabled!()).toBe(false);
        });

        it('imports the chosen file and clears the input value', async () => {
            const editor = await importEditor();
            const starts = record<File>(editor, 'file-import-start');
            const file = docxFile();
            const input = pick(editor, [file]);
            await vi.waitFor(() => expect(starts).toEqual([file]));
            expect(input.value).toBe('');
        });

        it('does not import when no file was chosen', async () => {
            const editor = await importEditor();
            const starts = record<File>(editor, 'file-import-start');
            const errors = record<string>(editor, 'file-import-error');
            pick(editor, []);
            await new Promise((resolve) => setTimeout(resolve, 20));
            expect([starts.length, errors.length]).toEqual([0, 0]);
        });

        it('does not import a picked document when readonly', async () => {
            const editor = await importEditor();
            const starts = record<File>(editor, 'file-import-start');
            editor.readonly = true;
            await editor.updateComplete;
            pick(editor, [docxFile()]);
            await new Promise((resolve) => setTimeout(resolve, 20));
            expect(starts).toHaveLength(0);
            expect(editableOf(editor).textContent).toBe('x');
        });

        it('does not import when disabled', async () => {
            const editor = await importEditor();
            const starts = record<File>(editor, 'file-import-start');
            editor.disabled = true;
            await editor.updateComplete;
            pick(editor, [docxFile()]);
            await new Promise((resolve) => setTimeout(resolve, 20));
            expect(starts).toHaveLength(0);
        });

        it('resolves Hebrew strings for the button', async () => {
            const editor = await importEditor(undefined, (el) => {
                el.locale = { ...resolveRichTextLocale('en'), code: 'he' };
            });
            expect((await buttonOf(editor))!.title).toBe(FILE_IMPORT_LOCALES.he!.tooltip);
        });

        it('lets the locale option override the editor locale', async () => {
            const editor = await importEditor({ locale: 'de' });
            expect((await buttonOf(editor))!.title).toBe(FILE_IMPORT_LOCALES.de!.tooltip);
        });

        // the compact padding is the toolbar's own button CSS, shared by every slot button
        it.skip('tightens the button padding while the toolbar view is compact', () => undefined);
    });

    describe('overlay', () => {
        it('keeps both live regions mounted while idle, so later text is announced', async () => {
            const editor = await importEditor();
            const busy = inSlot(editor, 'rte-file-import-busy-status')!;
            const error = inSlot(editor, 'rte-file-import-error-alert')!;
            expect(busy.getAttribute('aria-live')).toBe('polite');
            expect(error.getAttribute('aria-live')).toBe('assertive');
            expect(busy.textContent!.trim()).toBe('');
            expect(error.textContent!.trim()).toBe('');
            expect(inSlot(editor, 'rte-file-import-busy')).toBeNull();
            expect(inSlot(editor, 'rte-file-import-error')).toBeNull();
        });

        it('announces the busy state and hides the visual layer from assistive technology', async () => {
            const editor = await importEditor();
            let release = (): void => undefined;
            const blocked = new Promise<void>((resolve) => {
                release = resolve;
            });
            const file = docxFile();
            vi.spyOn(file, 'arrayBuffer').mockImplementation(async () => {
                await blocked;
                return new ArrayBuffer(0);
            });
            pick(editor, [file]);
            await vi.waitFor(() => expect(inSlot(editor, 'rte-file-import-busy')).not.toBeNull());

            expect(inSlot(editor, 'rte-file-import-busy-status')!.textContent!.trim()).toBe(EN.importing);
            expect(inSlot(editor, 'rte-file-import-busy')!.textContent!.trim()).toBe(EN.importing);
            expect(inSlot(editor, 'rte-file-import-busy')!.getAttribute('aria-hidden')).toBe('true');
            release();
        });

        it('announces the failure assertively and hides the visual layer from assistive technology', async () => {
            const editor = await importEditor();
            const errors = record<string>(editor, 'file-import-error');
            pick(editor, [new File([new Uint8Array([1, 2, 3, 4, 5])], 'note.txt')]);
            await vi.waitFor(() => expect(errors).toHaveLength(1));
            await editor.updateComplete;

            const alert = inSlot(editor, 'rte-file-import-error-alert')!;
            expect(alert.textContent!.trim()).toBe(errors[0]);
            expect(alert.getAttribute('role')).toBe('alert');
            expect(inSlot(editor, 'rte-file-import-error')!.getAttribute('aria-hidden')).toBe('true');
        });
    });

    describe('embedded PDF fonts', () => {
        it('injects embedded-font CSS into the document head exactly once per content', async () => {
            const editor = await importEditor();
            const css = "@font-face{font-family:'pdfX-f0';src:url('data:font/ttf;base64,AAAA') format('truetype');}";
            importPrivate(editor).injectFontCss(css);
            importPrivate(editor).injectFontCss(css);

            const styles = document.head.querySelectorAll('style[data-ge-rte-pdf-fonts]');
            expect(styles).toHaveLength(1);
            expect(styles[0]!.textContent).toContain('pdfX-f0');
        });

        it('caps how many imported-font stylesheets accumulate, dropping the oldest first', async () => {
            const editor = await importEditor();
            const controller = importPrivate(editor);
            for (let i = 0; i < 20; i++) controller.injectFontCss(`@font-face{font-family:'pdfX-f${i}';src:url('data:font/ttf;base64,AAAA');}`);

            const families = Array.from(document.head.querySelectorAll('style[data-ge-rte-pdf-fonts]')).map((style) => /pdfX-f\d+/.exec(style.textContent ?? '')?.[0]);
            expect(families).toEqual(Array.from({ length: 12 }, (_, i) => `pdfX-f${i + 8}`));
        });
    });

    it('preserves readable-pipeline styling through the editor sanitizer', async () => {
        const { parsePdfReadable } = await import('../../../file-viewer/parsers/pdf-readable/pdf-readable.js');
        const editor = await importEditor();
        const stream = 'BT /F1 24 Tf 100 720 Td (Styled Title) Tj ET '
            + 'BT /F1 12 Tf 1 0 0 rg 100 680 Td (Red body text follows the title) Tj '
            + '0 -14 Td (and continues on a second line.) Tj ET';
        const result = await parsePdfReadable(pdfBytesWithStream(stream).buffer);
        const sanitized = editor.sanitizer.sanitize(result.html);

        expect(sanitized).toContain('font-size');
        expect(sanitized).toContain('color');
        expect(sanitized).toContain('Styled Title');
        expect(sanitized).not.toContain('<style');
    });

    it('is picked by DOCX_MIME-typed files regardless of the file name', async () => {
        const editor = await importEditor();
        const completes = record<string>(editor, 'file-import-complete');
        const bytes = makeZip([{ name: 'word/document.xml', content: '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Named oddly</w:t></w:r></w:p></w:body></w:document>' }]);
        caretAtEnd(editor);
        pick(editor, [new File([bytes], 'report', { type: DOCX_MIME })]);
        await vi.waitFor(() => expect(completes).toHaveLength(1));
        expect(editableOf(editor).textContent).toContain('Named oddly');
    });
});

import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeFileViewer } from './index.js';
import { twoSheetXlsx, sampleDocx, samplePdf, sampleSvg, sampleText, sampleXlsx } from './file-viewer-fixtures.js';

async function viewerOf(attrs = '') {
    const page = await mount(`<div style="width:640px"><ge-file-viewer height="320px" ${attrs}></ge-file-viewer></div>`);
    return page.querySelector('ge-file-viewer') as GeFileViewer;
}

const root = (viewer: GeFileViewer) => viewer.shadowRoot as ShadowRoot;
const q = <T extends Element = HTMLElement>(viewer: GeFileViewer, selector: string) => root(viewer).querySelector<T>(selector);
const text = (viewer: GeFileViewer, selector: string) => q(viewer, selector)?.textContent?.trim() ?? '';

/** Sets `file` and waits for the `loaded` or `load-error` event, returning its detail. */
async function open(viewer: GeFileViewer, bytes: Uint8Array, name: string, type = '') {
    const result = new Promise<{ event: string; detail: unknown }>((resolve) => {
        viewer.addEventListener('loaded', (e) => resolve({ event: 'loaded', detail: (e as CustomEvent).detail }), { once: true });
        viewer.addEventListener('load-error', (e) => resolve({ event: 'load-error', detail: (e as CustomEvent).detail }), { once: true });
    });
    if (type) viewer.type = type as GeFileViewer['type'];
    viewer.file = new File([bytes as BlobPart], name);
    const outcome = await result;
    await viewer.updateComplete;
    return outcome;
}

describe('ge-file-viewer', () => {
    it('shows an empty frame with the toolbar and no content before any file is set', async () => {
        const viewer = await viewerOf();
        expect(q(viewer, '.toolbar')).not.toBeNull();
        expect(q(viewer, '.content')?.children.length).toBe(0);
        expect(q(viewer, '.frame')?.getBoundingClientRect().height).toBe(320);
    });

    it('renders text files in a preformatted block and reports the detected type and name', async () => {
        const viewer = await viewerOf();
        const outcome = await open(viewer, sampleText(), 'notes.txt');
        expect(outcome).toEqual({ event: 'loaded', detail: { type: 'text', filename: 'notes.txt' } });
        expect(text(viewer, '.name')).toBe('notes.txt');
        expect(text(viewer, '.kind')).toBe('text');
        expect(text(viewer, 'pre')).toBe('line one\nline two');
    });

    it('lets the filename attribute override the name from the File', async () => {
        const viewer = await viewerOf('filename="Q3 notes"');
        await open(viewer, sampleText(), 'notes.txt');
        expect(text(viewer, '.name')).toBe('Q3 notes');
    });

    it('zooms in steps of 25 percent within 25-300 and fires zoom-change with the clamped value', async () => {
        const viewer = await viewerOf();
        await open(viewer, sampleText(), 'notes.txt');
        const seen: number[] = [];
        viewer.addEventListener('zoom-change', (e) => seen.push((e as CustomEvent<number>).detail));
        await userEvent.click(q(viewer, 'button[aria-label="Zoom in"]') as HTMLElement);
        await viewer.updateComplete;
        expect(text(viewer, '.zoom')).toBe('125%');
        expect(getComputedStyle(q(viewer, '.text') as HTMLElement).zoom).toBe('1.25');
        for (let i = 0; i < 12; i++) viewer.zoomIn();
        await viewer.updateComplete;
        expect(text(viewer, '.zoom')).toBe('300%');
        expect(q<HTMLButtonElement>(viewer, 'button[aria-label="Zoom in"]')?.disabled).toBe(true);
        for (let i = 0; i < 12; i++) viewer.zoomOut();
        await viewer.updateComplete;
        expect(text(viewer, '.zoom')).toBe('25%');
        expect(q<HTMLButtonElement>(viewer, 'button[aria-label="Zoom out"]')?.disabled).toBe(true);
        expect(seen[0]).toBe(1.25);
        expect(seen.at(-1)).toBe(0.25);
    });

    it('starts at the zoom attribute', async () => {
        const viewer = await viewerOf('zoom="1.5"');
        await open(viewer, sampleText(), 'notes.txt');
        expect(text(viewer, '.zoom')).toBe('150%');
    });

    it('renders a spreadsheet as a table with the first row as header', async () => {
        const viewer = await viewerOf();
        const outcome = await open(viewer, sampleXlsx(), 'sales.xlsx');
        expect(outcome.event).toBe('loaded');
        expect([...(root(viewer).querySelectorAll('thead th'))].map((th) => th.textContent)).toEqual(['Region', 'Revenue']);
        expect([...(root(viewer).querySelectorAll('tbody tr'))].map((tr) => [...tr.children].map((c) => c.textContent).join(' '))).toEqual(['North 1200', 'South 950']);
        expect(q(viewer, '.zoom')).toBeNull();
        expect(q(viewer, '.pages')).toBeNull();
    });

    it('switches between spreadsheet tabs without firing page-change', async () => {
        const viewer = await viewerOf();
        await open(viewer, twoSheetXlsx(), 'books.xlsx');
        const tabs = [...root(viewer).querySelectorAll<HTMLButtonElement>('.sheet-tab')];
        expect(tabs.map((t) => t.textContent?.trim())).toEqual(['Sales', 'Costs']);
        expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
        let pageChanges = 0;
        viewer.addEventListener('page-change', () => pageChanges++);
        await userEvent.click(tabs[1] as HTMLElement);
        await viewer.updateComplete;
        expect([...root(viewer).querySelectorAll('th')].map((th) => th.textContent)).toEqual(['Vendor', 'Spend']);
        expect([...root(viewer).querySelectorAll('td')].map((td) => td.textContent)).toEqual(['Hosting', '90']);
        expect(pageChanges).toBe(0);
    });

    it('renders a DOCX with its heading, bold run and table', async () => {
        const viewer = await viewerOf();
        const outcome = await open(viewer, sampleDocx(), 'report.docx');
        expect(outcome).toEqual({ event: 'loaded', detail: { type: 'docx', filename: 'report.docx' } });
        const doc = q(viewer, '.doc') as HTMLElement;
        expect(doc.textContent).toContain('Quarterly report');
        expect(doc.querySelector('b, strong, [style*="bold"]')?.textContent).toBe('12 percent');
        expect([...doc.querySelectorAll('td')].map((td) => td.textContent?.trim())).toEqual(['Region', 'Revenue', 'North', '1,200']);
    });

    it('renders a PDF page with page controls that stop at the ends', async () => {
        const viewer = await viewerOf();
        const outcome = await open(viewer, samplePdf(), 'hello.pdf');
        expect(outcome.event).toBe('loaded');
        expect(text(viewer, '.pages')).toBe('1 / 1');
        expect(q<HTMLButtonElement>(viewer, 'button[aria-label="Previous page"]')?.disabled).toBe(true);
        expect(q<HTMLButtonElement>(viewer, 'button[aria-label="Next page"]')?.disabled).toBe(true);
        expect(q(viewer, '.pdf-page')?.textContent).toContain('Hello');
    });

    it('displays an SVG as an image after sanitising it', async () => {
        const viewer = await viewerOf();
        const outcome = await open(viewer, sampleSvg(), 'logo.svg');
        expect(outcome.event).toBe('loaded');
        const img = q<HTMLImageElement>(viewer, 'img') as HTMLImageElement;
        await img.decode();
        expect(img.naturalWidth).toBe(40);
    });

    it('strips scripts from an SVG before showing it', async () => {
        const viewer = await viewerOf();
        const outcome = await open(viewer, new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="1" height="1"/></svg>'), 'bad.svg');
        expect(outcome.event).toBe('loaded');
        const shown = await (await fetch(q<HTMLImageElement>(viewer, 'img')?.src ?? '')).text();
        expect(shown).toContain('<rect');
        expect(shown).not.toContain('script');
    });

    it('shows a notice with a download link for a type it cannot preview', async () => {
        const viewer = await viewerOf();
        const outcome = await open(viewer, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 1]), 'blob.bin');
        expect(outcome.event).toBe('loaded');
        expect(text(viewer, '.notice p')).toBe('Preview not available for this file type.');
        expect(q<HTMLAnchorElement>(viewer, '.notice a')?.download).toBe('blob.bin');
    });

    it('reports a corrupt file as load-error and shows the message', async () => {
        const viewer = await viewerOf();
        const outcome = await open(viewer, new TextEncoder().encode('not a zip'), 'broken.docx', 'docx');
        expect(outcome.event).toBe('load-error');
        expect((outcome.detail as { type: string }).type).toBe('docx');
        expect(text(viewer, '.notice .message')).toBe((outcome.detail as { message: string }).message);
        expect(text(viewer, '.notice .message').length).toBeGreaterThan(0);
    });

    it('fetches src and names the file after the URL path', async () => {
        const viewer = await viewerOf();
        const url = URL.createObjectURL(new Blob([sampleText() as BlobPart], { type: 'text/plain' }));
        const loaded = new Promise<CustomEvent>((resolve) => viewer.addEventListener('loaded', (e) => resolve(e as CustomEvent), { once: true }));
        viewer.src = url;
        const event = await loaded;
        expect(event.detail.type).toBe('text');
        await viewer.updateComplete;
        expect(text(viewer, 'pre')).toBe('line one\nline two');
        URL.revokeObjectURL(url);
    });

    it('reports a failing src as load-error', async () => {
        const viewer = await viewerOf();
        const failed = new Promise<CustomEvent>((resolve) => viewer.addEventListener('load-error', (e) => resolve(e as CustomEvent), { once: true }));
        viewer.src = '/definitely/missing/file.pdf';
        const event = await failed;
        expect(event.detail.message).toMatch(/HTTP 404|fetch|load/i);
    });

    it('lets a later file win over a slower earlier one', async () => {
        const viewer = await viewerOf();
        viewer.file = new File([samplePdf() as BlobPart], 'slow.pdf');
        const outcome = await open(viewer, sampleText(), 'fast.txt');
        expect((outcome.detail as { filename: string }).filename).toBe('fast.txt');
        await new Promise((resolve) => setTimeout(resolve, 300));
        await viewer.updateComplete;
        expect(text(viewer, '.name')).toBe('fast.txt');
        expect(q(viewer, '.pdf')).toBeNull();
        expect(await (await fetch(q<HTMLAnchorElement>(viewer, 'a.tool')?.href ?? '')).text()).toBe('line one\nline two\n');
    });

    it('switches to projected toolbar and content, drawing none of its own', async () => {
        const page = await mount(`<ge-file-viewer height="200px"><ge-file-viewer-toolbar><button id="mine">Mine</button></ge-file-viewer-toolbar><ge-file-viewer-content><span id="body">body</span></ge-file-viewer-content></ge-file-viewer>`);
        const viewer = page.querySelector('ge-file-viewer') as GeFileViewer;
        await viewer.updateComplete;
        expect(q(viewer, '.toolbar')).toBeNull();
        expect(q(viewer, 'slot')).not.toBeNull();
        expect(page.querySelector('#mine')?.getBoundingClientRect().height).toBeGreaterThan(0);
        expect(page.querySelector('#body')?.getBoundingClientRect().height).toBeGreaterThan(0);
    });

    it('has no axe violations when a spreadsheet is shown, in light and dark', async () => {
        const viewer = await viewerOf();
        await open(viewer, sampleXlsx(), 'sales.xlsx');
        for (const mode of ['light', 'dark']) {
            useTheme(mode);
            const results = await axe.run(viewer, { rules: { region: { enabled: false } } });
            expect(results.violations.map((v) => v.id)).toEqual([]);
        }
    });
});

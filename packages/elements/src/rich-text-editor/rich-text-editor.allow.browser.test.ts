import { describe, expect, it } from 'vitest';
import { mount } from '../test-utils.js';
import { editableOf } from './rich-text-editor.fixture.test.js';
import type { GeRichTextEditor } from './rich-text-editor.js';

const TRACKER = 'https://tracker.example/p.png';
const CDN = 'https://cdn.trusted.com/a.png';

class AllowStub extends HTMLElement {
    allow = { imageHosts: ['cdn.trusted.com'], linkSchemes: ['acme-crm'] };
}
if (!customElements.get('ge-rich-text-allow')) customElements.define('ge-rich-text-allow', AllowStub);

async function wrapped(own: readonly string[] = []) {
    const page = await mount('<ge-rich-text-allow><ge-rich-text-editor mode="html"></ge-rich-text-editor></ge-rich-text-allow>');
    const wrapper = page.querySelector<AllowStub>('ge-rich-text-allow')!;
    const editor = page.querySelector<GeRichTextEditor>('ge-rich-text-editor')!;
    editor.allowedImageHosts = own;
    editor.value = `<p><img src="${TRACKER}" alt="chart"> <img src="${CDN}" alt="logo"> <a href="acme-crm://contact/42">crm</a></p>`;
    await editor.updateComplete;
    return { wrapper, editor };
}

describe('ge-rich-text-editor under a ge-rich-text-allow wrapper', () => {
    it('takes the wrapper hosts and link schemes', async () => {
        const { editor } = await wrapped();
        const [tracker, logo] = [...editableOf(editor).querySelectorAll('img')];

        expect(tracker!.hasAttribute('src')).toBe(false);
        expect(tracker!.getAttribute('data-blocked-src')).toBe(TRACKER);
        expect(logo!.getAttribute('src')).toBe(CDN);
        expect(editableOf(editor).querySelector('a')!.getAttribute('href')).toBe('acme-crm://contact/42');
    });

    it('lets its own list win whole, never merged', async () => {
        const { editor } = await wrapped(['tracker.example']);
        const [tracker, logo] = [...editableOf(editor).querySelectorAll('img')];

        expect(tracker!.getAttribute('src')).toBe(TRACKER);
        expect(logo!.hasAttribute('src')).toBe(false);
        expect(logo!.getAttribute('data-blocked-src')).toBe(CDN);
    });

    it('re-judges the document when the wrapper announces a change, and ignores the editor own change events', async () => {
        const { editor, wrapper } = await wrapped();
        wrapper.allow = { imageHosts: ['tracker.example'], linkSchemes: [] };

        editor.dispatchEvent(new Event('change', { bubbles: true }));
        await editor.updateComplete;
        expect(editableOf(editor).querySelector('img')!.hasAttribute('src')).toBe(false);

        wrapper.dispatchEvent(new Event('change'));
        await editor.updateComplete;
        expect(editableOf(editor).querySelector('img')!.getAttribute('src')).toBe(TRACKER);
        expect(editableOf(editor).querySelector('a')!.hasAttribute('href')).toBe(false);
    });
});

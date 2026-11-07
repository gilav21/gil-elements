import { describe, expect, it } from 'vitest';
import { createEditor, editableOf, record } from './rich-text-editor.fixture.test.js';
import type { GeRichTextEditor } from './rich-text-editor.js';
import type { ResourcePolicyDecision } from './rich-text-resource-policy.js';

const TRACKER = 'https://tracker.example/p.png';
const TRUSTED = ['cdn.trusted.com'];
const trackerDoc = `<p><img src="${TRACKER}" alt="chart"></p>`;

const imageIn = (editor: GeRichTextEditor) => editableOf(editor).querySelector('img');

describe('ge-rich-text-editor remote resource policy', () => {
    it('reports nothing and keeps the source when no policy is set', async () => {
        const blocked: ResourcePolicyDecision[] = [];
        const editor = await createEditor((el) => {
            el.mode = 'html';
            el.value = trackerDoc;
            el.addEventListener('image-blocked', (event) => blocked.push((event as CustomEvent<ResourcePolicyDecision>).detail));
        });

        expect(blocked).toEqual([]);
        expect(imageIn(editor)!.getAttribute('src')).toBe(TRACKER);
    });

    it('judges a value set before the first render under the policy and reports the block', async () => {
        const blocked: ResourcePolicyDecision[] = [];
        const editor = await createEditor((el) => {
            el.mode = 'html';
            el.allowedImageHosts = TRUSTED;
            el.value = trackerDoc;
            el.addEventListener('image-blocked', (event) => blocked.push((event as CustomEvent<ResourcePolicyDecision>).detail));
        });
        const img = imageIn(editor)!;

        expect(img.hasAttribute('src')).toBe(false);
        expect(img.getAttribute('data-blocked-src')).toBe(TRACKER);
        expect(img.getAttribute('data-blocked-label')).toBe('Image blocked by security policy');
        expect(blocked.length).toBeGreaterThan(0);
        expect(blocked.every((decision) => !decision.allowed && decision.reason === 'blocked' && decision.host === 'tracker.example')).toBe(true);
    });

    it('reads the allowed hosts from the attribute', async () => {
        const editor = await createEditor((el) => {
            el.setAttribute('allowed-image-hosts', 'cdn.trusted.com, other.example');
            el.mode = 'html';
        });

        expect(editor.allowedImageHosts).toEqual(['cdn.trusted.com', 'other.example']);
    });

    it('blocks later writes too and reports the host and kind', async () => {
        const editor = await createEditor((el) => {
            el.allowedImageHosts = TRUSTED;
        });
        const blocked = record<ResourcePolicyDecision>(editor, 'image-blocked');

        editor.value = `![chart](${TRACKER})`;
        await editor.updateComplete;

        expect(blocked[0]).toMatchObject({ host: 'tracker.example', reason: 'blocked', kind: 'image' });
    });

    it('announces a blocked image to assistive tech, keeping its alt', async () => {
        const editor = await createEditor((el) => {
            el.mode = 'html';
            el.allowedImageHosts = TRUSTED;
            el.value = trackerDoc;
        });
        const img = imageIn(editor)!;

        expect(img.getAttribute('alt')).toBe('chart');
        expect(img.getAttribute('role')).toBe('img');
        expect(img.getAttribute('aria-label')).toContain('chart');
        expect(img.getAttribute('aria-label')).toContain('blocked');
    });

    it('still drops an unsafe source, with no placeholder', async () => {
        const editor = await createEditor((el) => {
            el.allowedImageHosts = TRUSTED;
            el.value = '![bad](javascript:alert(1))';
        });
        expect(imageIn(editor)).toBeNull();

        editor.mode = 'html';
        editor.value = '<p><img src="javascript:alert(1)" alt="bad"></p>';
        await editor.updateComplete;
        const img = imageIn(editor);
        expect(img?.hasAttribute('src')).toBeFalsy();
        expect(img?.hasAttribute('data-blocked-src')).toBeFalsy();
    });

    it('shows a developer message as text, never as markup', async () => {
        const editor = await createEditor((el) => {
            el.mode = 'html';
            el.allowedImageHosts = TRUSTED;
            el.blockedImageMessage = '<script>alert(1)</script>';
            el.value = trackerDoc;
        });

        expect(imageIn(editor)!.getAttribute('data-blocked-label')).toBe('<script>alert(1)</script>');
        expect(editableOf(editor).querySelectorAll('script')).toHaveLength(0);
    });

    it('keeps the markdown save of a blocked image reversible, cycle after cycle', async () => {
        const editor = await createEditor((el) => {
            el.allowedImageHosts = TRUSTED;
        });
        let doc = `![c](${TRACKER})`;

        for (let cycle = 0; cycle < 3; cycle++) {
            editor.setContent(doc);
            const img = imageIn(editor)!;
            expect(img.hasAttribute('src')).toBe(false);
            expect(img.getAttribute('data-blocked-src')).toBe(TRACKER);
            doc = editor.value;
            expect(doc).toContain(TRACKER);
        }

        editor.allowedImageHosts = [...TRUSTED, 'tracker.example'];
        await editor.updateComplete;
        editor.value = doc;
        await editor.updateComplete;
        expect(imageIn(editor)!.getAttribute('src')).toBe(TRACKER);
    });

    it('re-judges the rendered document in place when the list changes', async () => {
        const editor = await createEditor((el) => {
            el.mode = 'html';
            el.allowedImageHosts = TRUSTED;
            el.value = trackerDoc;
        });
        expect(imageIn(editor)!.hasAttribute('src')).toBe(false);

        editor.allowedImageHosts = [...TRUSTED, 'tracker.example'];
        await editor.updateComplete;
        expect(imageIn(editor)!.getAttribute('src')).toBe(TRACKER);
        expect(imageIn(editor)!.hasAttribute('data-blocked-src')).toBe(false);

        editor.allowedImageHosts = TRUSTED;
        await editor.updateComplete;
        expect(imageIn(editor)!.hasAttribute('src')).toBe(false);
        expect(imageIn(editor)!.getAttribute('data-blocked-label')).toBe('Image blocked by security policy');
    });

    it('keeps two editors on one page independent', async () => {
        const [strict, other] = [
            await createEditor((el) => {
                el.allowedImageHosts = ['cdn.trusted.com'];
            }),
            await createEditor((el) => {
                el.allowedImageHosts = ['other.example'];
            }),
        ];

        expect(strict.sanitizer).not.toBe(other.sanitizer);
        expect(strict.sanitizer.sanitizeImageSrc('https://cdn.trusted.com/a.png')).toBe('https://cdn.trusted.com/a.png');
        expect(other.sanitizer.sanitizeImageSrc('https://cdn.trusted.com/a.png')).toBeNull();
    });

    it('captions an image blocked by a sanitized insert once the seam labels it', async () => {
        const editor = await createEditor((el) => {
            el.mode = 'html';
            el.allowedImageHosts = TRUSTED;
            el.value = '<p>text</p>';
        });

        editableOf(editor).insertAdjacentHTML('beforeend', editor.sanitizer.sanitize(trackerDoc));
        editor.labelBlockedImages();

        expect(imageIn(editor)!.getAttribute('data-blocked-label')).toBe('Image blocked by security policy');
    });
});

describe('ge-rich-text-editor link schemes', () => {
    const doc = '<p><a href="acme-crm://contact/42">crm</a> <a href="slack://channel?id=1">slack</a></p>';
    const hrefs = (editor: GeRichTextEditor) => [...editableOf(editor).querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));

    it('keeps a custom scheme once listed and re-judges the document when the list changes', async () => {
        const editor = await createEditor((el) => {
            el.mode = 'html';
            el.value = doc;
        });
        expect(hrefs(editor)).toEqual(['slack://channel?id=1']);

        editor.allowedLinkSchemes = ['acme-crm'];
        await editor.updateComplete;
        editor.value = '';
        await editor.updateComplete;
        editor.value = doc;
        await editor.updateComplete;
        expect(hrefs(editor)).toEqual(['acme-crm://contact/42', 'slack://channel?id=1']);

        editor.allowedLinkSchemes = [];
        await editor.updateComplete;
        expect(hrefs(editor)).toEqual(['slack://channel?id=1']);
        expect(editor.htmlOutput).not.toContain('acme-crm');
        expect(editableOf(editor).textContent).toContain('crm');
    });
});

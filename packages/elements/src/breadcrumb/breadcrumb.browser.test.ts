import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { cdp } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeBreadcrumbList } from './sub/breadcrumb-list.js';

const TRAIL = (attrs = '') => `
    <ge-breadcrumb ${attrs}>
        <ge-breadcrumb-list>
            <ge-breadcrumb-item><ge-breadcrumb-link href="/home">Home</ge-breadcrumb-link></ge-breadcrumb-item>
            <ge-breadcrumb-separator></ge-breadcrumb-separator>
            <ge-breadcrumb-item><ge-breadcrumb-ellipsis label="Hidden pages"></ge-breadcrumb-ellipsis></ge-breadcrumb-item>
            <ge-breadcrumb-separator>/</ge-breadcrumb-separator>
            <ge-breadcrumb-item><ge-breadcrumb-page>Breadcrumb</ge-breadcrumb-page></ge-breadcrumb-item>
        </ge-breadcrumb-list>
    </ge-breadcrumb>`;
const settle = async (page: HTMLElement) => {
    await Promise.all([...page.querySelectorAll<HTMLElement & { updateComplete: Promise<boolean> }>('*')].filter((el) => el.localName.startsWith('ge-')).map((el) => el.updateComplete));
};
const tree = async () => {
    const session = cdp();
    await session.send('Accessibility.enable');
    // The test page runs in an iframe of the runner, so ask for that frame's tree.
    const { frameTree } = await session.send('Page.getFrameTree');
    const { nodes } = await session.send('Accessibility.getFullAXTree', { frameId: frameTree.childFrames?.[0]?.frame.id });
    return nodes;
};

describe('ge-breadcrumb', () => {
    it('exposes a named navigation landmark, a real link, the current page, and hides separators and the ellipsis glyph', async () => {
        const page = await mount(TRAIL());
        await settle(page);
        const nodes = await tree();
        const link = nodes.find((n) => n.role?.value === 'link' && n.name?.value === 'Home');
        const current = nodes.find((n) => n.name?.value === 'Breadcrumb' && n.role?.value === 'link');
        const props = Object.fromEntries((current?.properties ?? []).map((p) => [p.name, p.value.value]));

        expect(nodes.find((n) => n.role?.value === 'navigation' && n.name?.value === 'breadcrumb')).toBeDefined();
        expect(link).toBeDefined();
        expect([props.disabled, props.focusable]).toEqual([true, undefined]);
        expect(nodes.some((n) => n.name?.value === 'Hidden pages' && !n.ignored)).toBe(false);
        expect(page.querySelector('ge-breadcrumb-separator')!.getAttribute('aria-hidden')).toBe('true');
        expect(page.querySelector('ge-breadcrumb-page')!.getAttribute('aria-current')).toBe('page');
        const plain = await mount('<ge-breadcrumb-ellipsis></ge-breadcrumb-ellipsis>');
        await settle(plain);
        expect(plain.querySelector('ge-breadcrumb-ellipsis')!.shadowRoot!.querySelector('.sr-only')!.textContent).toBe('More');
    });

    it('names the landmark from aria-label, and the link goes where href says', async () => {
        const page = await mount(TRAIL('aria-label="Ruta de navegación"'));
        await settle(page);
        const anchor = page.querySelector('ge-breadcrumb-link')!.shadowRoot!.querySelector('a')!;

        expect(page.querySelector('ge-breadcrumb')!.shadowRoot!.querySelector('nav')!.getAttribute('aria-label')).toBe('Ruta de navegación');
        expect(anchor.getAttribute('href')).toBe('/home');
        const bare = await mount('<ge-breadcrumb-link>Plain</ge-breadcrumb-link>');
        await settle(bare);
        expect(bare.querySelector('ge-breadcrumb-link')!.shadowRoot!.querySelector('a')!.getAttribute('href')).toBe('#');
    });

    it('builds the trail from items with separators between crumbs only, a current page, and a default href of #', async () => {
        const page = await mount('<ge-breadcrumb><ge-breadcrumb-list></ge-breadcrumb-list></ge-breadcrumb>');
        const list = page.querySelector<GeBreadcrumbList>('ge-breadcrumb-list')!;
        list.items = [{ label: 'Home', href: '/' }, { label: 'Docs' }, { label: 'Page', isCurrentPage: true }];
        await list.updateComplete;
        const root = list.shadowRoot!;

        expect([...root.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')])).toEqual([['Home', '/'], ['Docs', '#']]);
        expect(root.querySelectorAll('[data-slot=breadcrumb-separator]')).toHaveLength(2);
        expect(root.querySelector('[aria-current=page]')!.textContent).toBe('Page');
    });

    it('shows as many placeholder crumbs as asked for, with a separator between each pair', async () => {
        const page = await mount('<ge-breadcrumb><ge-breadcrumb-list skeleton skeleton-count="4"></ge-breadcrumb-list></ge-breadcrumb>');
        const list = page.querySelector<GeBreadcrumbList>('ge-breadcrumb-list')!;
        await list.updateComplete;

        expect([list.shadowRoot!.querySelectorAll('ge-skeleton.label').length, list.shadowRoot!.querySelectorAll('ge-skeleton.dot').length]).toEqual([4, 3]);
    });

    it('wraps onto a new line when narrow, and mirrors the default chevron in right-to-left text', async () => {
        const page = await mount(`<div style="width:120px">${TRAIL()}</div><div dir="rtl">${TRAIL()}</div>`);
        await settle(page);
        const [narrow] = page.querySelectorAll('ge-breadcrumb-list');
        const [ltr, rtl] = [...page.querySelectorAll('ge-breadcrumb-separator')].filter((s) => !s.textContent);
        const turn = (el: Element) => getComputedStyle(el.shadowRoot!.querySelector('svg')!).transform;

        const crumbs = [...narrow.querySelectorAll('ge-breadcrumb-item')].map((item) => item.getBoundingClientRect());
        expect(crumbs.at(-1)!.top).toBeGreaterThanOrEqual(crumbs[0].bottom);
        expect([turn(ltr), turn(rtl)]).toEqual(['none', 'matrix(-1, 0, 0, -1, 0, 0)']);
    });

    it.each(['light', 'dark'])('passes axe in %s mode', async (mode) => {
        useTheme(mode);
        const page = await mount(TRAIL());
        await settle(page);

        expect((await axe.run(page)).violations).toEqual([]);
    });
});

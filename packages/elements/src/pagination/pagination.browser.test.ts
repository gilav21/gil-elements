import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import { pageNumbers, type GePagination } from './index.js';

const pagination = (page: HTMLElement) => page.querySelector<GePagination>('ge-pagination')!;
const shown = (page: HTMLElement) =>
    [...pagination(page).shadowRoot!.querySelectorAll('li > *')].map((el) => (el.localName === 'ge-pagination-ellipsis' ? '…' : el.localName === 'ge-pagination-link' ? el.textContent!.trim() : el.localName.replace('ge-pagination-', '')));
const settle = async (page: HTMLElement) => {
    await pagination(page).updateComplete;
    await Promise.all([...pagination(page).shadowRoot!.querySelectorAll<HTMLElement & { updateComplete: Promise<boolean> }>('*')].filter((el) => el.localName.startsWith('ge-')).map((el) => el.updateComplete));
};
const press = (el: Element) => el.shadowRoot!.querySelector<HTMLButtonElement>('button')!;

describe('pageNumbers', () => {
    // Representatives of the four shapes the algorithm distinguishes, with the default and a wider sibling count.
    it.each([
        [1, 5, 1, [1, 2, 3, 4, 5]],
        [1, 10, 1, [1, 2, 3, 4, 5, -1, 10]],
        [10, 20, 1, [1, -1, 9, 10, 11, -1, 20]],
        [10, 10, 1, [1, -1, 6, 7, 8, 9, 10]],
        [10, 20, 2, [1, -1, 8, 9, 10, 11, 12, -1, 20]],
        [4, 12, 1, [1, -1, 3, 4, 5, -1, 12]],
        [0, 0, 1, []],
    ])('page %i of %i with %i siblings', (current, total, siblings, expected) => {
        expect(pageNumbers(current, total, siblings)).toEqual(expected);
    });
});

describe('ge-pagination', () => {
    it('builds previous, the numbers with ellipses, and next from the page counts, and marks the current page', async () => {
        const page = await mount('<ge-pagination current-page="10" total-pages="20"></ge-pagination>');
        await settle(page);
        const current = [...pagination(page).shadowRoot!.querySelectorAll('ge-pagination-link')].find((l) => press(l).getAttribute('aria-current') === 'page');

        expect(shown(page)).toEqual(['previous', '1', '…', '9', '10', '11', '…', '20', 'next']);
        expect(current!.textContent!.trim()).toBe('10');
    });

    it('announces the page the user picks, but not the current page, and disables previous on the first and next on the last', async () => {
        const page = await mount('<ge-pagination current-page="1" total-pages="3"></ge-pagination>');
        await settle(page);
        const picks: number[] = [];
        pagination(page).addEventListener('page-change', (event) => picks.push((event as CustomEvent<number>).detail));
        const root = pagination(page).shadowRoot!;
        const [previous, one, two, three, next] = [...root.querySelectorAll('li > *')];

        expect([press(previous).disabled, press(next).disabled]).toEqual([true, false]);
        press(previous).click();
        press(one).click();
        press(three).click();
        press(next).click();
        press(two).click();
        pagination(page).goTo(0);
        pagination(page).goTo(4);
        pagination(page).currentPage = 3;
        await settle(page);
        expect([press(next).disabled, press(previous).disabled]).toEqual([true, false]);

        expect(picks).toEqual([3, 2, 2]);
    });

    it('does not move by itself: the page changes only when current-page is set', async () => {
        const page = await mount('<ge-pagination current-page="2" total-pages="5"></ge-pagination>');
        await settle(page);

        press(pagination(page).shadowRoot!.querySelectorAll('ge-pagination-link')[3]).click();
        await settle(page);

        expect(pagination(page).currentPage).toBe(2);
    });

    it('takes the labels from attributes, and names the navigation', async () => {
        const page = await mount('<ge-pagination current-page="5" total-pages="20" aria-label="Paginación" previous-label="Anterior" next-label="Siguiente" more-label="Más páginas"></ge-pagination>');
        await settle(page);
        const root = pagination(page).shadowRoot!;
        const text = (selector: string) => root.querySelector(selector)!.shadowRoot!.textContent!.replaceAll(/\s+/g, ' ').trim();

        expect(root.querySelector('nav')!.getAttribute('aria-label')).toBe('Paginación');
        expect([text('ge-pagination-previous'), text('ge-pagination-next'), text('ge-pagination-ellipsis')]).toEqual(['Anterior', 'Siguiente', 'Más páginas']);
    });

    it('composes from content, item, link, previous, next and ellipsis, and the active link says it is the current page', async () => {
        const page = await mount(`
            <ge-pagination>
                <ge-pagination-content>
                    <ge-pagination-item><ge-pagination-previous disabled></ge-pagination-previous></ge-pagination-item>
                    <ge-pagination-item><ge-pagination-link active>1</ge-pagination-link></ge-pagination-item>
                    <ge-pagination-item><ge-pagination-link>2</ge-pagination-link></ge-pagination-item>
                    <ge-pagination-item><ge-pagination-ellipsis></ge-pagination-ellipsis></ge-pagination-item>
                    <ge-pagination-item><ge-pagination-next></ge-pagination-next></ge-pagination-item>
                </ge-pagination-content>
            </ge-pagination>`);
        await settle(page);
        const [one, two] = page.querySelectorAll('ge-pagination-link');
        await Promise.all([one, two].map((l) => (l as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete));

        expect([press(one).getAttribute('aria-current'), press(two).getAttribute('aria-current')]).toEqual(['page', null]);
        expect(press(page.querySelector('ge-pagination-previous')!).disabled).toBe(true);
        expect(getComputedStyle(press(page.querySelector('ge-pagination-previous')!)).opacity).toBe('0.5');
    });

    it('exposes a named navigation with buttons, and hides the ellipsis glyph from assistive technology', async () => {
        const page = await mount('<ge-pagination current-page="10" total-pages="20"></ge-pagination>');
        await settle(page);
        const session = cdp();
        await session.send('Accessibility.enable');
        // The test page runs in an iframe of the runner, so ask for that frame's tree.
        const { frameTree } = await session.send('Page.getFrameTree');
        const { nodes } = await session.send('Accessibility.getFullAXTree', { frameId: frameTree.childFrames?.[0]?.frame.id });

        expect(nodes.find((n) => n.role?.value === 'navigation' && n.name?.value === 'pagination')).toBeDefined();
        expect(nodes.some((n) => n.name?.value === 'More pages' && !n.ignored)).toBe(false);
        expect(nodes.filter((n) => n.role?.value === 'button' && !n.ignored).map((n) => n.name?.value)).toEqual(['Previous', '1', '9', '10', '11', '20', 'Next']);
    });

    it('is reached key by key, and Enter picks a page', async () => {
        const page = await mount('<ge-pagination current-page="1" total-pages="3"></ge-pagination>');
        await settle(page);
        const picks: number[] = [];
        pagination(page).addEventListener('page-change', (event) => picks.push((event as CustomEvent<number>).detail));

        await userEvent.tab();
        await userEvent.tab();
        await userEvent.keyboard('{Enter}');

        expect(picks).toEqual([2]);
    });

    it.each(['light', 'dark'])('passes axe in %s mode', async (mode) => {
        useTheme(mode);
        const page = await mount('<ge-pagination current-page="10" total-pages="20"></ge-pagination>');
        await settle(page);

        expect((await axe.run(page)).violations).toEqual([]);
    });

    it('scales the link size with the button density token and mirrors the arrows in right-to-left text', async () => {
        const page = await mount(`<div style="--density-button: 1.5"><ge-pagination-link>1</ge-pagination-link></div><div dir="rtl"><ge-pagination-previous></ge-pagination-previous></div>`);
        const link = page.querySelector('ge-pagination-link')!;
        const previous = page.querySelector('ge-pagination-previous')!;
        await Promise.all([link, previous].map((el) => (el as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete));
        const box = press(link).getBoundingClientRect();

        expect([box.width, box.height]).toEqual([54, 54]);
        expect(getComputedStyle(previous.shadowRoot!.querySelector('svg')!).transform).toBe('matrix(-1, 0, 0, -1, 0, 0)');
    });
});

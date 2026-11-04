import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';

const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const e of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await e.updateComplete;
        await new Promise((r) => setTimeout(r, 0));
    }
};
const invoices = (attrs = '', body = '') => `<ge-table ${attrs} style="width:500px">
  <ge-table-caption>A list of invoices.</ge-table-caption>
  <ge-table-header><ge-table-row><ge-table-head style="flex:none;width:100px">Invoice</ge-table-head><ge-table-head>Status</ge-table-head><ge-table-head>Amount</ge-table-head></ge-table-row></ge-table-header>
  <ge-table-body ${body}>
    <ge-table-row><ge-table-cell style="flex:none;width:100px">INV001</ge-table-cell><ge-table-cell>Paid</ge-table-cell><ge-table-cell>$250.00</ge-table-cell></ge-table-row>
    <ge-table-row><ge-table-cell style="flex:none;width:100px">INV002</ge-table-cell><ge-table-cell>Pending</ge-table-cell><ge-table-cell>$150.00</ge-table-cell></ge-table-row>
  </ge-table-body>
  <ge-table-footer><ge-table-row><ge-table-cell style="flex:none;width:100px">Total</ge-table-cell><ge-table-cell></ge-table-cell><ge-table-cell>$400.00</ge-table-cell></ge-table-row></ge-table-footer>
</ge-table>`;
const table = async (attrs = '', body = '') => {
    const page = await mount(invoices(attrs, body));
    await settle(page);
    return page;
};
const roles = (page: HTMLElement, selector: string) => [...page.querySelectorAll(selector)].map((e) => e.getAttribute('role'));

describe('ge-table', () => {
    it('exposes a table of row groups, rows, column headers and cells', async () => {
        const page = await table();
        expect(page.querySelector('ge-table')!.getAttribute('role')).toBe('table');
        expect(roles(page, 'ge-table-header, ge-table-body, ge-table-footer')).toEqual(['rowgroup', 'rowgroup', 'rowgroup']);
        expect(new Set(roles(page, 'ge-table-row'))).toEqual(new Set(['row']));
        expect(roles(page, 'ge-table-head')).toEqual(['columnheader', 'columnheader', 'columnheader']);
        expect(new Set(roles(page, 'ge-table-cell'))).toEqual(new Set(['cell']));
    });

    it('turns its cells into gridcells in a grid or treegrid, and back, as the table role changes', async () => {
        const page = await table('role="grid"');
        const root = page.querySelector('ge-table')!;
        expect(new Set(roles(page, 'ge-table-cell'))).toEqual(new Set(['gridcell']));
        root.setAttribute('role', 'treegrid');
        await settle(page);
        expect(new Set(roles(page, 'ge-table-cell'))).toEqual(new Set(['gridcell']));
        root.setAttribute('role', 'table');
        await settle(page);
        expect(new Set(roles(page, 'ge-table-cell'))).toEqual(new Set(['cell']));
    });

    it('keeps an explicit role on a decorative head cell', async () => {
        const page = await mount('<ge-table><ge-table-header><ge-table-row><ge-table-head role="presentation"></ge-table-head></ge-table-row></ge-table-header></ge-table>');
        expect(page.querySelector('ge-table-head')!.getAttribute('role')).toBe('presentation');
    });

    it('shares the row width evenly between flexible cells and honours a fixed column width', async () => {
        const page = await table();
        const cells = [...page.querySelectorAll('ge-table-body ge-table-row:first-child ge-table-cell')].map((c) => c.getBoundingClientRect().width);
        expect(cells[0]).toBe(100);
        expect(cells[1]).toBeCloseTo(cells[2]!, 1);
        expect(cells[0]! + cells[1]! + cells[2]!).toBeCloseTo(500, 0);
        const heads = [...page.querySelectorAll('ge-table-head')].map((c) => c.getBoundingClientRect().left);
        const bodyLefts = [...page.querySelectorAll('ge-table-body ge-table-row:first-child ge-table-cell')].map((c) => c.getBoundingClientRect().left);
        expect(heads).toEqual(bodyLefts);
    });

    it('sets the footer apart with a top border and a muted background', async () => {
        const page = await table();
        const footer = getComputedStyle(page.querySelector('ge-table-footer')!);
        expect(footer.borderTopWidth).toBe('1px');
        expect(footer.backgroundColor).not.toBe(getComputedStyle(page.querySelector('ge-table-header')!).backgroundColor);
    });

    it('sizes head and cell padding from the density', async () => {
        const page = await table();
        const head = page.querySelector('ge-table-head')!;
        const cell = page.querySelector('ge-table-cell')!;
        expect([head.getBoundingClientRect().height, getComputedStyle(head).paddingLeft, getComputedStyle(cell).paddingTop]).toEqual([40, '8px', '8px']);
        page.querySelector<HTMLElement>('ge-table')!.style.setProperty('--density', '1.5');
        await settle(page);
        expect([head.getBoundingClientRect().height, getComputedStyle(head).paddingLeft, getComputedStyle(cell).paddingTop]).toEqual([60, '12px', '12px']);
    });

    it('paints a selected row and marks it with data-state', async () => {
        const page = await table();
        const [first, second] = [...page.querySelectorAll<HTMLElement>('ge-table-body ge-table-row')] as [HTMLElement, HTMLElement];
        const plain = getComputedStyle(second).backgroundColor;
        second.toggleAttribute('selected', true);
        await settle(page);
        expect([second.dataset.state, first.dataset.state]).toEqual(['selected', undefined]);
        expect(getComputedStyle(second).backgroundColor).not.toBe(plain);
        second.toggleAttribute('selected', false);
        await settle(page);
        expect(second.dataset.state).toBeUndefined();
    });

    it('replaces the body rows with placeholder rows while loading, leaving the header and footer', async () => {
        const page = await table('', 'skeleton skeleton-rows="3"');
        const body = page.querySelector('ge-table-body')!;
        const rows = body.shadowRoot!.querySelectorAll('ge-table-row');
        expect(rows).toHaveLength(3);
        expect(rows[0]!.querySelector('ge-skeleton')).not.toBeNull();
        expect(body.shadowRoot!.querySelector('slot')).toBeNull();
        expect(page.querySelectorAll('ge-table-head')).toHaveLength(3);
        body.removeAttribute('skeleton');
        await settle(page);
        expect(body.shadowRoot!.querySelectorAll('ge-table-row')).toHaveLength(0);
        expect(body.shadowRoot!.querySelector('slot')).not.toBeNull();
    });

    it('defaults the placeholder to five rows', async () => {
        const page = await table('', 'skeleton');
        expect(page.querySelector('ge-table-body')!.shadowRoot!.querySelectorAll('ge-table-row')).toHaveLength(5);
    });

    it('scrolls the table sideways when a row is wider than it, and keeps the header sticky', async () => {
        const page = await mount(`<ge-table style="width:200px;height:100px"><ge-table-header><ge-table-row><ge-table-head style="flex:none;width:300px">Wide</ge-table-head></ge-table-row></ge-table-header><ge-table-body>${'<ge-table-row><ge-table-cell style="flex:none;width:300px">x</ge-table-cell></ge-table-row>'.repeat(6)}</ge-table-body></ge-table>`);
        await settle(page);
        const root = page.querySelector<HTMLElement>('ge-table')!;
        expect(root.scrollWidth).toBeGreaterThan(root.clientWidth);
        expect(page.querySelector('ge-table-row')!.getBoundingClientRect().width).toBeGreaterThanOrEqual(300);
        root.scrollTop = 60;
        const header = page.querySelector('ge-table-header')!;
        expect(header.getBoundingClientRect().top).toBe(root.getBoundingClientRect().top);
    });

    it('trims the padding on the side a role=checkbox control sits against, mirrored in RTL', async () => {
        const markup = '<ge-table><ge-table-body><ge-table-row><ge-table-cell><span role="checkbox" aria-checked="false" aria-label="Select"></span></ge-table-cell><ge-table-cell>plain</ge-table-cell></ge-table-row></ge-table-body></ge-table>';
        const ltr = await mount(markup);
        await settle(ltr);
        const [boxed, plain] = [...ltr.querySelectorAll('ge-table-cell')] as [HTMLElement, HTMLElement];
        expect([getComputedStyle(boxed).paddingRight, getComputedStyle(boxed).paddingLeft, getComputedStyle(plain).paddingRight]).toEqual(['0px', '8px', '8px']);
        const rtl = await mount(`<div dir="rtl">${markup}</div>`);
        await settle(rtl);
        const cell = rtl.querySelector('ge-table-cell')!;
        expect([getComputedStyle(cell).paddingRight, getComputedStyle(cell).paddingLeft]).toEqual(['8px', '0px']);
    });

    it('has no axe violations in both themes', async () => {
        const page = await table();
        for (const mode of ['light', 'dark']) {
            useTheme(mode);
            const result = await axe.run(page);
            expect(result.violations.map((v) => v.id)).toEqual([]);
        }
    });
});

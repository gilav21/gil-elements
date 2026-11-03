import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import '../badge/define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeDataList } from './index.js';

const list = (page: HTMLElement) => page.querySelector<GeDataList>('ge-data-list')!;
const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        await list(page).updateComplete;
        for (const item of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('ge-data-list-item')) await item.updateComplete;
        await new Promise((r) => setTimeout(r, 0));
    }
};
const dl = (page: HTMLElement) => list(page).shadowRoot!.querySelector('dl')!;
const terms = (page: HTMLElement) => [...dl(page).children].map((c) => `${c.localName}:${c.localName === 'dt' ? c.textContent!.trim() : [...c.querySelector('slot')?.assignedNodes() ?? [c]].map((n) => n.textContent!.trim()).join('')}`);

describe('ge-data-list', () => {
    it('is a real description list: only dt and dd are children of the dl, in label-value pairs', async () => {
        const page = await mount(`<ge-data-list>
            <ge-data-list-item label="Plan"><ge-badge>Pro</ge-badge></ge-data-list-item>
            <ge-data-list-item label="Email">ada@example.com</ge-data-list-item>
        </ge-data-list>`);
        list(page).items = [{ label: 'Name', value: 'Ada Lovelace' }];
        await settle(page);

        expect([...dl(page).children].map((c) => c.localName)).toEqual(['dt', 'dd', 'dt', 'dd', 'dt', 'dd']);
        expect(terms(page)).toEqual(['dt:Name', 'dd:Ada Lovelace', 'dt:Plan', 'dd:Pro', 'dt:Email', 'dd:ada@example.com']);
    });

    it('follows items added, removed, relabelled and reordered in the markup', async () => {
        const page = await mount(`<ge-data-list><ge-data-list-item id="a" label="A">1</ge-data-list-item><ge-data-list-item id="c" label="C">3</ge-data-list-item></ge-data-list>`);
        await settle(page);

        page.querySelector('#c')!.before(Object.assign(document.createElement('ge-data-list-item'), { id: 'b', label: 'B', textContent: '2' }));
        await settle(page);
        expect(terms(page)).toEqual(['dt:A', 'dd:1', 'dt:B', 'dd:2', 'dt:C', 'dd:3']);

        page.querySelector<HTMLElement & { label: string }>('#a')!.label = 'First';
        await settle(page);
        expect(terms(page)).toEqual(['dt:First', 'dd:1', 'dt:B', 'dd:2', 'dt:C', 'dd:3']);

        page.querySelector('#c')!.remove();
        await settle(page);
        expect(terms(page)).toEqual(['dt:First', 'dd:1', 'dt:B', 'dd:2']);

        list(page).append(page.querySelector('#a')!);
        await settle(page);
        expect(terms(page)).toEqual(['dt:B', 'dd:2', 'dt:First', 'dd:1']);
    });

    it('stacks everything in one column, and puts labels beside values from 640px only when horizontal', async () => {
        const rows = '<ge-data-list-item label="Name">Ada</ge-data-list-item>';
        const page = await mount(`<div style="width:40rem"><ge-data-list>${rows}</ge-data-list><ge-data-list orientation="horizontal">${rows}</ge-data-list></div>`);
        await settle(page);
        const [vertical, horizontal] = [...page.querySelectorAll<GeDataList>('ge-data-list')].map((l) => l.shadowRoot!.querySelector('dl')!);
        const columns = (e: Element) => getComputedStyle(e).gridTemplateColumns.split(' ').length;

        expect(columns(vertical)).toBe(1);
        expect(columns(horizontal)).toBe(2);
        const dt = horizontal.querySelector('dt')!.getBoundingClientRect();
        const dd = horizontal.querySelector('dd')!.getBoundingClientRect();
        expect(dd.left).toBeGreaterThan(dt.right);
        expect(dd.top).toBe(dt.top);
    });

    describe.each(['light', 'dark'] as const)('%s theme', (theme) => {
        useTheme(theme);
        it('has no axe violations', async () => {
            const page = await mount(`<ge-data-list orientation="horizontal"><ge-data-list-item label="Name">Ada</ge-data-list-item></ge-data-list>`);
            list(page).items = [{ label: 'Plan', value: 'Pro' }];
            await settle(page);
            const out = await axe.run(page, { rules: { 'color-contrast': { enabled: false } } });
            expect(out.violations).toEqual([]);
        });
    });
});

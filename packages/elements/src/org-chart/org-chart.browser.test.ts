import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeOrgChart, OrgNode } from './index.js';

const n = (id: string, name: string, parentId?: string | null, extra: Partial<OrgNode> = {}): OrgNode => ({ id, name, ...(parentId === undefined ? {} : { parentId }), ...extra });
const TEAM = [
    n('ceo', 'Ada Lovelace', null, { title: 'Chief Executive' }),
    n('cto', 'Grace Hopper', 'ceo', { title: 'CTO', description: 'Owns engineering.' }),
    n('cfo', 'Alan Turing', 'ceo'),
    n('dev1', 'Linus T', 'cto', { color: '#ef4444' }),
    n('dev2', 'Margaret Hamilton-Smith', 'cto'),
];
const chart = async (attrs = '', data = TEAM) => {
    const page = await mount(`<div style="width:700px"><ge-org-chart ${attrs}></ge-org-chart></div>`);
    const el = page.querySelector<GeOrgChart>('ge-org-chart')!;
    el.data = data;
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const objects = (el: Element) => [...root(el).querySelectorAll('foreignObject')];
const cards = (el: Element) => [...root(el).querySelectorAll<HTMLButtonElement>('.card')];
const at = (el: Element) => objects(el).map((o) => ({ x: Number(o.getAttribute('x')), y: Number(o.getAttribute('y')) }));
const ORDER = ['Ada Lovelace', 'Grace Hopper', 'Linus T', 'Margaret Hamilton-Smith', 'Alan Turing'];
const card = (el: Element, name: string) => cards(el)[ORDER.indexOf(name)]!;
const pos = (el: Element, name: string) => at(el)[cards(el).findIndex((c) => c.querySelector('.name')!.textContent === name)]!;
const lines = (el: Element) => [...root(el).querySelectorAll('.line')].map((p) => p.getAttribute('d')!);
const record = (el: Element, ...types: string[]) => {
    const seen: [string, unknown][] = [];
    for (const type of types) el.addEventListener(type, (e) => seen.push([type, (e as CustomEvent).detail]));
    return seen;
};

describe('ge-org-chart', () => {
    it('lays generations top to bottom with each parent centred over its children and siblings a gap apart', async () => {
        const el = await chart();
        expect(cards(el).map((c) => c.querySelector('.name')!.textContent)).toEqual(ORDER);
        const [ceo, cto, dev1, dev2, cfo] = ORDER.map((name) => pos(el, name));
        expect(dev2.x - dev1.x).toBe(180 + 40);
        expect(cto.x + 90).toBeCloseTo((dev1.x + dev2.x + 180) / 2, 5);
        expect(cfo.x - dev2.x - 180).toBe(40);
        expect(ceo.x + 90).toBeCloseTo((dev1.x + cfo.x + 180) / 2, 5);
        expect([ceo.y, cto.y, dev1.y]).toEqual([0, 140, 280]);
        expect(cfo.y).toBe(cto.y);
        const svg = root(el).querySelector('svg')!;
        const [, , w, h] = svg.getAttribute('viewBox')!.split(' ').map(Number);
        expect(w).toBe(Math.max(...at(el).map((p) => p.x)) + 180 + 20);
        expect(h).toBe(280 + 80 + 20);
    });

    it('runs generations left to right in the horizontal layout, honouring node size and the gaps', async () => {
        const el = await chart('layout="horizontal" node-width="150" node-height="100" node-padding-x="16" node-padding-y="30"');
        const ceo = pos(el, 'Ada Lovelace');
        const cto = pos(el, 'Grace Hopper');
        const cfo = pos(el, 'Alan Turing');
        const dev1 = pos(el, 'Linus T');
        const dev2 = pos(el, 'Margaret Hamilton-Smith');
        expect([ceo.x, cto.x, dev1.x]).toEqual([0, 166, 332]);
        expect(dev2.y - dev1.y).toBe(100 + 30);
        expect(cfo.y - dev2.y).toBe(100 + 30);
        expect(ceo.y + 50).toBeCloseTo((Math.min(dev1.y, cto.y) + cfo.y + 100) / 2, 5);
        expect(objects(el)[0]!.getAttribute('width')).toBe('150');
        expect(objects(el)[0]!.getAttribute('height')).toBe('100');
    });

    it('puts every root after the previous subtree, and drops nodes whose parent leads to no root', async () => {
        const forest = [n('r1', 'First', null), n('c1', 'Child', 'r1'), n('r2', 'Second', null), n('lost', 'Lost', 'nobody'), n('a', 'Loop A', 'b'), n('b', 'Loop B', 'a')];
        const vertical = await chart('', forest);
        expect(cards(vertical).map((c) => c.querySelector('.name')!.textContent)).toEqual(['First', 'Child', 'Second']);
        expect(pos(vertical, 'Second').x).toBe(pos(vertical, 'First').x + 180 + 40);
        expect(pos(vertical, 'Second').y).toBe(0);
        const horizontal = await chart('layout="horizontal"', forest);
        expect(pos(horizontal, 'Second').y).toBe(pos(horizontal, 'First').y + 80 + 60);
        expect(root(vertical).querySelector('svg')!.getAttribute('aria-label')).toBe('Organization chart with 3 members');
        const none = await chart('heading="Staff"', []);
        expect(root(none).querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 400 300');
        expect(root(none).querySelector('svg')!.getAttribute('aria-label')).toBe('Staff: Organization chart with 0 members');
        expect(cards(none)).toHaveLength(0);
    });

    it('joins each parent to its children with a curved or elbow connector from edge to edge', async () => {
        const el = await chart();
        expect(lines(el)).toHaveLength(4);
        const ceo = pos(el, 'Ada Lovelace');
        const cto = pos(el, 'Grace Hopper');
        const startX = ceo.x + 90;
        const endX = cto.x + 90;
        const midY = (80 + cto.y) / 2;
        expect(lines(el)[0]).toBe(`M ${startX} 80 C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${cto.y}`);
        const straight = await chart('line-type="straight"');
        expect(lines(straight)[0]).toBe(`M ${startX} 80 L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${cto.y}`);
        const side = await chart('layout="horizontal" line-type="straight"');
        const a = pos(side, 'Ada Lovelace');
        const b = pos(side, 'Grace Hopper');
        expect(lines(side)[0]).toBe(`M ${a.x + 180} ${a.y + 40} L ${(a.x + 180 + b.x) / 2} ${a.y + 40} L ${(a.x + 180 + b.x) / 2} ${b.y + 40} L ${b.x} ${b.y + 40}`);
    });

    it('shows a photo, else initials on the node\'s colour (its own or its generation\'s), or no avatar when hidden', async () => {
        const photo = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
        const el = await chart('', [n('a', 'Pictured Person', null, { image: photo }), n('b', 'Margaret Hamilton-Smith', 'a', { color: '#ef4444' }), n('c', 'dana ann lee', 'a')]);
        expect(root(el).querySelector('img.avatar')!.getAttribute('src')).toBe(photo);
        expect(root(el).querySelector('img.avatar')!.getAttribute('alt')).toBe('Pictured Person');
        const initials = [...root(el).querySelectorAll<HTMLElement>('.initials')];
        expect(initials.map((i) => i.textContent)).toEqual(['MH', 'DA']);
        expect(getComputedStyle(initials[0]!).backgroundColor).toBe('rgb(239, 68, 68)');
        expect(cards(el)[1]!.style.borderLeftColor).toBe('rgb(239, 68, 68)');
        expect(getComputedStyle(initials[1]!).backgroundColor).toBe(getComputedStyle(cards(el)[2]!).borderLeftColor);
        expect(getComputedStyle(initials[1]!).backgroundColor).not.toBe(getComputedStyle(cards(el)[0]!).borderLeftColor);
        const bare = await chart('hide-images');
        expect(root(bare).querySelector('.avatar')).toBeNull();
        expect(cards(bare)[0]!.querySelector('.text')!.getBoundingClientRect().width).toBeGreaterThan(cards(el)[0]!.querySelector('.text')!.getBoundingClientRect().width);
    });

    it('names a card by name and title, and prints the title and description only when there are some', async () => {
        const el = await chart();
        expect(cards(el).map((c) => c.getAttribute('aria-label'))).toEqual(['Ada Lovelace, Chief Executive', 'Grace Hopper, CTO', 'Linus T', 'Margaret Hamilton-Smith', 'Alan Turing']);
        expect(cards(el).map((c) => c.querySelector('.title')?.textContent ?? null)).toEqual(['Chief Executive', 'CTO', null, null, null]);
        expect(cards(el).map((c) => c.querySelector('.description')?.textContent ?? null)).toEqual([null, 'Owns engineering.', null, null, null]);
    });

    it('dims the other cards while one is hovered and reports it, then reports null on leaving', async () => {
        const el = await chart();
        const seen = record(el, 'node-hover');
        cards(el)[1]!.dispatchEvent(new MouseEvent('mouseenter'));
        await el.updateComplete;
        expect(cards(el).map((c) => c.hasAttribute('data-dim'))).toEqual([true, false, true, true, true]);
        expect(seen[0]![1]).toEqual(TEAM[1]);
        cards(el)[1]!.dispatchEvent(new MouseEvent('mouseleave'));
        await el.updateComplete;
        expect(cards(el).some((c) => c.hasAttribute('data-dim'))).toBe(false);
        expect(seen[1]![1]).toBeNull();
    });

    it('reports a pointer click with its event, and Enter or Space once each without one', async () => {
        const el = await chart();
        const seen = record(el, 'node-click');
        card(el, 'Alan Turing').click();
        card(el, 'Alan Turing').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
        expect(seen).toHaveLength(2);
        expect((seen[0]![1] as { event?: MouseEvent }).event).toBeUndefined();
        expect((seen[1]![1] as { node: OrgNode; event?: MouseEvent }).node).toEqual(TEAM[2]);
        expect((seen[1]![1] as { event?: MouseEvent }).event).toBeInstanceOf(MouseEvent);
        const keyboard = await chart();
        const keys = record(keyboard, 'node-click');
        card(keyboard, 'Ada Lovelace').focus();
        await userEvent.keyboard('{Enter}');
        expect(keys).toHaveLength(1);
        await userEvent.keyboard(' ');
        expect(keys).toHaveLength(2);
        expect((keys[0]![1] as { event?: MouseEvent }).event).toBeUndefined();
        expect((keys[1]![1] as { node: OrgNode }).node).toEqual(TEAM[0]);
    });
});

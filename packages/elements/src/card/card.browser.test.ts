import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';

const box = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right };
};

describe('ge-card', () => {
    it('lays the generated header out exactly like the composed one', async () => {
        const page = await mount(`
            <div style="width: 360px">
                <ge-card id="simple" heading="Notifications" description="You have 3 unread messages." content="Push everything to your phone."></ge-card>
            </div>
            <div style="width: 360px">
                <ge-card id="custom">
                    <ge-card-header><ge-card-title>Notifications</ge-card-title><ge-card-description>You have 3 unread messages.</ge-card-description></ge-card-header>
                    <ge-card-content>Push everything to your phone.</ge-card-content>
                </ge-card>
            </div>`);
        const simple = page.querySelector('#simple')!;
        const custom = page.querySelector('#custom')!;
        const at = (card: Element, name: string) => {
            const part = card.shadowRoot!.querySelector(`[part="${name}"]`) ?? card.querySelector(`ge-card-${name}`)!;
            const r = box(part);
            const c = box(card);
            const style = getComputedStyle(part);
            return { dx: r.x - c.x, dy: r.y - c.y, width: r.width, height: r.height, weight: style.fontWeight, size: style.fontSize, colour: style.color };
        };

        expect(box(simple).height).toBe(box(custom).height);
        for (const part of ['title', 'description', 'content']) expect(at(simple, part)).toEqual(at(custom, part));
    });

    it('puts a slotted action at the header end beside the title, and the divider only when asked', async () => {
        const page = await mount(`
            <ge-card style="width: 360px">
                <ge-card-header bordered><ge-card-title>Plan</ge-card-title><ge-card-description>Billed monthly</ge-card-description><button slot="action">Edit</button></ge-card-header>
                <ge-card-footer bordered>Cancel</ge-card-footer>
            </ge-card>
            <ge-card><ge-card-header><ge-card-title>Plain</ge-card-title></ge-card-header><ge-card-footer>x</ge-card-footer></ge-card>`);
        const [withAction, plain] = page.querySelectorAll('ge-card');
        const header = withAction.querySelector('ge-card-header')!;
        const edit = header.querySelector('button')!;
        const title = withAction.querySelector('ge-card-title')!;

        expect(box(edit).right).toBeCloseTo(box(header).right - Number.parseFloat(getComputedStyle(header).paddingInlineEnd), 0);
        expect(box(edit).y).toBe(box(title).y);
        expect(getComputedStyle(header).borderBottomWidth).toBe('1px');
        expect(getComputedStyle(withAction.querySelector('ge-card-footer')!).borderTopWidth).toBe('1px');
        expect(getComputedStyle(plain.querySelector('ge-card-header')!).borderBottomWidth).toBe('0px');
        expect(getComputedStyle(plain.querySelector('ge-card-footer')!).borderTopWidth).toBe('0px');
    });

    it('scales the padding with density and lets the per-component variable win', async () => {
        const page = await mount(`
            <ge-card id="base"><ge-card-content>x</ge-card-content></ge-card>
            <div style="--density: 0.75"><ge-card id="dense"><ge-card-content>x</ge-card-content></ge-card></div>
            <div style="--density: 0.75; --density-card: 1.25"><ge-card id="override"><ge-card-content>x</ge-card-content></ge-card></div>`);
        const block = (id: string) => Number.parseFloat(getComputedStyle(page.querySelector(`#${id}`)!).paddingBlockStart);

        expect(block('dense') / block('base')).toBeCloseTo(0.75, 5);
        expect(block('override') / block('base')).toBeCloseTo(1.25, 5);
    });

    it('keeps content visible under a labelled spinner while loading, and swaps to a placeholder for skeleton', async () => {
        const page = await mount(`
            <ge-card id="loading" loading heading="Report"><p>Body</p></ge-card>
            <ge-card id="skeleton" skeleton heading="Report"><p>Body</p></ge-card>`);
        const loading = page.querySelector('#loading')!;
        const skeleton = page.querySelector('#skeleton')!;

        expect(loading.shadowRoot!.querySelector('output')!.getAttribute('aria-label')).toBe('Loading');
        expect(loading.shadowRoot!.querySelector('slot')!.assignedElements()).toHaveLength(1);
        expect(skeleton.shadowRoot!.querySelector('slot')).toBeNull();
        expect(box(skeleton.shadowRoot!.querySelector('.skeleton')!).height).toBe(160);
        expect(getComputedStyle(skeleton).borderTopWidth).toBe('0px');
    });

    it.each(['light', 'dark'])('has no axe violations in %s mode', async (mode) => {
        useTheme(mode);
        const page = await mount(`<ge-card><ge-card-header><ge-card-title>Plan</ge-card-title><ge-card-description>Billed monthly</ge-card-description></ge-card-header><ge-card-content>Body</ge-card-content></ge-card>`);
        const result = await axe.run(page, { rules: { region: { enabled: false } } });

        expect(result.violations.map((v) => v.id)).toEqual([]);
    });
});

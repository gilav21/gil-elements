import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeAspectRatio } from './aspect-ratio.js';

const box = (el: Element) => el.shadowRoot!.querySelector<HTMLElement>('.box')!.getBoundingClientRect();

describe('ge-aspect-ratio', () => {
    it('fills the width and derives its height from the ratio, square by default, before any content loads', async () => {
        const page = await mount(`
            <div style="width: 320px">
                <ge-aspect-ratio id="square"></ge-aspect-ratio>
                <ge-aspect-ratio id="wide" ratio="1.6"></ge-aspect-ratio>
                <ge-aspect-ratio id="tall" ratio="0.5"></ge-aspect-ratio>
            </div>`);
        const size = (id: string) => [box(page.querySelector(`#${id}`)!).width, box(page.querySelector(`#${id}`)!).height];

        expect([size('square'), size('wide'), size('tall')]).toEqual([[320, 320], [320, 200], [320, 640]]);
    });

    it('follows a changed ratio and lets slotted content fill the box', async () => {
        const page = await mount(`
            <div style="width: 300px"><ge-aspect-ratio ratio="2"><div id="fill" style="position: absolute; inset: 0"></div></ge-aspect-ratio></div>`);
        const el = page.querySelector<GeAspectRatio>('ge-aspect-ratio')!;
        expect(page.querySelector('#fill')!.getBoundingClientRect().height).toBe(150);

        el.ratio = 1;
        await el.updateComplete;

        expect(page.querySelector('#fill')!.getBoundingClientRect().height).toBe(300);
    });
});

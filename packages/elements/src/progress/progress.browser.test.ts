import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { cdp } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeProgress } from './progress.js';

const native = (el: Element) => el.shadowRoot!.querySelector<HTMLProgressElement>('progress')!;
const fill = (el: Element) => el.shadowRoot!.querySelector<HTMLElement>('.fill')!;
const first = (page: HTMLElement) => page.querySelector<GeProgress>('ge-progress')!;

describe('ge-progress', () => {
    it('fills value over max, clamps the fill to the track, and passes the raw value on to the native element', async () => {
        const page = await mount(`
            <ge-progress id="a" value="30" max="40"></ge-progress>
            <ge-progress id="over" value="150"></ge-progress>
            <ge-progress id="under" value="-10"></ge-progress>`);
        const width = (id: string) => fill(page.querySelector(`#${id}`)!).style.width;

        expect([width('a'), width('over'), width('under')]).toEqual(['75%', '100%', '0%']);
        expect([native(page.querySelector('#a')!).max, native(page.querySelector('#over')!).getAttribute('value')]).toEqual([40, '150']);
    });

    it('updates the fill when the value changes', async () => {
        const page = await mount('<ge-progress value="10"></ge-progress>');
        const bar = first(page);

        bar.value = 60;
        await bar.updateComplete;

        expect(fill(bar).style.width).toBe('60%');
    });

    it('speaks the percentage in the requested locale', async () => {
        const page = await mount('<ge-progress id="en" value="45" locale="en"></ge-progress><ge-progress id="fr" value="45" locale="fr-FR"></ge-progress>');
        const text = (id: string) => native(page.querySelector(`#${id}`)!).getAttribute('aria-valuetext');

        expect(text('en')).toBe('45%');
        expect(text('fr')?.replaceAll(/\s/g, ' ')).toBe('45 %');
    });

    it('is named by aria-label, or by an element in the page through aria-labelledby', async () => {
        const page = await mount(`
            <span id="cap">Uploading photos</span>
            <ge-progress value="20" aria-labelledby="cap"></ge-progress>
            <ge-progress value="20" aria-label="Disk usage"></ge-progress>`);
        const session = cdp();
        await session.send('Accessibility.enable');
        const { frameTree } = await session.send('Page.getFrameTree');
        const { nodes } = await session.send('Accessibility.getFullAXTree', { frameId: frameTree.childFrames?.[0]?.frame.id });
        const names = nodes.filter((n) => n.role?.value === 'progressbar').map((n) => n.name?.value);

        expect(names).toEqual(['Uploading photos', 'Disk usage']);
    });

    it('draws a trough and fill from the primary token, rounded and 8px tall', async () => {
        const page = await mount('<div style="--primary: rgb(11, 22, 33)"><ge-progress value="50"></ge-progress></div>');
        const bar = first(page);
        const track = bar.shadowRoot!.querySelector<HTMLElement>('.track')!;

        expect(getComputedStyle(fill(bar)).backgroundColor).toBe('rgb(11, 22, 33)');
        expect(track.getBoundingClientRect().height).toBe(8);
    });

    it.each(['light', 'dark'])('has no axe violations in %s mode', async (mode) => {
        useTheme(mode);
        const page = await mount('<ge-progress value="40" aria-label="Upload"></ge-progress>');
        const result = await axe.run(page, { rules: { region: { enabled: false } } });

        expect(result.violations.map((v) => v.id)).toEqual([]);
    });
});

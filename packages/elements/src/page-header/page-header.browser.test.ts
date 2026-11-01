import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { page as browser } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GePageHeader } from './page-header.js';

const heading = (el: Element) => el.shadowRoot!.querySelector('.title')!;

describe('ge-page-header', () => {
    it('renders a real heading at the requested level, clamps nonsense, and keeps the visual size', async () => {
        const page = await mount(`
            <ge-page-header heading="A"></ge-page-header>
            <ge-page-header heading="B" heading-level="3"></ge-page-header>
            <ge-page-header heading="C" heading-level="9"></ge-page-header>
            <ge-page-header heading="D" heading-level="0"></ge-page-header>
            <ge-page-header heading="E" heading-level="soon"></ge-page-header>`);
        const tags = [...page.querySelectorAll('ge-page-header')].map((h) => heading(h).localName);

        expect(tags).toEqual(['h1', 'h3', 'h6', 'h1', 'h1']);
        expect(getComputedStyle(heading(page.querySelectorAll('ge-page-header')[1])).fontSize).toBe(getComputedStyle(heading(page.querySelector('ge-page-header')!)).fontSize);
    });

    it('re-renders the heading element when the level changes', async () => {
        const header = (await mount('<ge-page-header heading="A"></ge-page-header>')).querySelector<GePageHeader>('ge-page-header')!;
        header.headingLevel = 4;
        await header.updateComplete;

        expect(heading(header).localName).toBe('h4');
        expect(heading(header).textContent).toBe('A');
    });

    it('puts actions beside the heading when there is room and under it when there is not', async () => {
        const page = await mount(`
            <div style="width: 700px"><ge-page-header id="wide" heading="Invoices"><button>New</button></ge-page-header></div>
            <div style="width: 220px"><ge-page-header id="narrow" heading="Quarterly revenue report"><button>New</button></ge-page-header></div>`);
        const rows = (id: string) => {
            const header = page.querySelector(`#${id}`)!;
            return { title: heading(header).getBoundingClientRect(), action: header.querySelector('button')!.getBoundingClientRect() };
        };

        expect(rows('wide').action.y).toBeLessThan(rows('wide').title.bottom);
        expect(rows('narrow').action.y).toBeGreaterThanOrEqual(rows('narrow').title.bottom);
    });

    it('stacks the actions under the heading on a phone even when they would fit beside it', async () => {
        await browser.viewport(500, 800);
        const page = await mount('<ge-page-header heading="Invoices"><button>New</button></ge-page-header>');
        const header = page.querySelector('ge-page-header')!;

        expect(header.querySelector('button')!.getBoundingClientRect().y).toBeGreaterThanOrEqual(heading(header).getBoundingClientRect().bottom);
        await browser.viewport(1280, 800);
    });

    it('takes no space for an empty breadcrumb and sits the trail above the heading when given', async () => {
        const page = await mount(`
            <ge-page-header id="none" heading="Invoices"></ge-page-header>
            <ge-page-header id="some" heading="Invoices"><nav slot="breadcrumb">Home / Billing</nav></ge-page-header>`);
        const top = (id: string) => {
            const header = page.querySelector(`#${id}`)!;
            return heading(header).getBoundingClientRect().y - header.getBoundingClientRect().y;
        };

        expect(top('none')).toBe(0);
        expect(top('some')).toBeGreaterThan(page.querySelector('nav')!.getBoundingClientRect().height);
    });

    it.each(['light', 'dark'])('has no axe violations in %s mode', async (mode) => {
        useTheme(mode);
        const page = await mount('<ge-page-header heading="Invoices" description="Manage and send invoices."><button>New</button></ge-page-header>');
        const result = await axe.run(page, { rules: { region: { enabled: false } } });

        expect(result.violations.map((v) => v.id)).toEqual([]);
    });
});

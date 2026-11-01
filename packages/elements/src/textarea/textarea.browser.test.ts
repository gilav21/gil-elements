import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import '../label/define.js';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeTextarea } from './textarea.js';

const first = (page: HTMLElement) => page.querySelector<GeTextarea>('ge-textarea')!;
const inner = (el: Element) => el.shadowRoot!.querySelector<HTMLTextAreaElement>('textarea')!;

describe('ge-textarea', () => {
    it('reports typing as input events on the host, keeps line breaks, and fires one change when it loses focus', async () => {
        const page = await mount('<ge-textarea></ge-textarea><button>other</button>');
        const area = first(page);
        const events: string[] = [];
        area.addEventListener('input', () => events.push('input'));
        area.addEventListener('change', () => events.push('change'));

        inner(area).focus();
        await userEvent.keyboard('a{Enter}b');
        expect(events).toEqual(['input', 'input', 'input']);
        expect(area.value).toBe('a\nb');

        await userEvent.tab();
        expect(events.filter((e) => e === 'change')).toEqual(['change']);
    });

    it('takes its text from the value attribute, shows the placeholder only while empty, and sizes itself from rows', async () => {
        const page = await mount(`
            <ge-textarea id="filled" value="Gil" placeholder="Bio"></ge-textarea>
            <ge-textarea id="empty" placeholder="Bio"></ge-textarea>
            <ge-textarea id="three"></ge-textarea><ge-textarea id="six" rows="6"></ge-textarea>`);
        const get = (id: string) => inner(page.querySelector(`#${id}`)!);

        expect(get('filled').value).toBe('Gil');
        expect([get('empty').matches(':placeholder-shown'), get('filled').matches(':placeholder-shown')]).toEqual([true, false]);
        expect(get('six').getBoundingClientRect().height).toBeGreaterThan(get('three').getBoundingClientRect().height);
    });

    it('is named by a ge-label and described by an element in the page, across the shadow boundary', async () => {
        await mount(`
            <ge-label for="bio">Biography</ge-label>
            <ge-textarea id="bio" aria-describedby="hint"></ge-textarea>
            <p id="hint">Keep it short.</p>`);
        const session = cdp();
        await session.send('Accessibility.enable');
        const { frameTree } = await session.send('Page.getFrameTree');
        const { nodes } = await session.send('Accessibility.getFullAXTree', { frameId: frameTree.childFrames?.[0]?.frame.id });
        const box = nodes.find((n) => n.role?.value === 'textbox' && n.name?.value === 'Biography');

        expect(box?.description?.value).toBe('Keep it short.');
    });

    it('is a tab stop that lands on the inner field, and disabled ones, directly or by fieldset, are skipped', async () => {
        const page = await mount('<ge-textarea id="a" disabled></ge-textarea><fieldset disabled><ge-textarea id="b"></ge-textarea></fieldset><ge-textarea id="c"></ge-textarea>');
        const target = page.querySelector<GeTextarea>('#c')!;

        await userEvent.tab();

        expect(document.activeElement).toBe(target);
        expect(target.shadowRoot!.activeElement).toBe(inner(target));
        expect([inner(page.querySelector('#a')!).disabled, inner(page.querySelector('#b')!).disabled]).toEqual([true, true]);
    });

    it('submits what was typed under its name, skips a disabled one, and a form reset restores the markup', async () => {
        const page = await mount(`
            <form>
                <ge-textarea name="bio" value="Hello"></ge-textarea>
                <ge-textarea name="off" value="x" disabled></ge-textarea>
            </form>`);
        const form = page.querySelector('form')!;
        const area = first(page);
        const submitted = () => Object.fromEntries(new FormData(form).entries());

        expect(submitted()).toEqual({ bio: 'Hello' });

        inner(area).focus();
        await userEvent.keyboard('{Control>}a{/Control}Bye');
        expect(submitted()).toEqual({ bio: 'Bye' });

        form.reset();
        await area.updateComplete;
        expect(submitted()).toEqual({ bio: 'Hello' });
        expect(inner(area).value).toBe('Hello');
    });

    it('is resizable only in the outline variant, and its 60px minimum height scales with density', async () => {
        const page = await mount(`
            <ge-textarea id="outline" rows="1"></ge-textarea>
            <ge-textarea id="underline" variant="underline"></ge-textarea><ge-textarea id="ghost" variant="ghost"></ge-textarea>
            <div style="--density: 1.5"><ge-textarea id="dense" rows="1"></ge-textarea></div>`);
        const get = (id: string) => inner(page.querySelector(`#${id}`)!);

        expect(['outline', 'underline', 'ghost'].map((id) => getComputedStyle(get(id)).resize)).toEqual(['both', 'none', 'none']);
        // The 640px breakpoint gives 3.75rem; the test viewport is wider than that.
        expect([get('outline').getBoundingClientRect().height, get('dense').getBoundingClientRect().height]).toEqual([60, 90]);
    });

    it('draws a 1px ring for keyboard focus in the outline variant and a border colour change for underline', async () => {
        const page = await mount('<ge-textarea></ge-textarea><ge-textarea variant="underline"></ge-textarea>');
        const [outline, underline] = [...page.querySelectorAll<GeTextarea>('ge-textarea')].map(inner);

        await userEvent.tab();
        expect(getComputedStyle(outline).boxShadow).toMatch(/0px 0px 0px 1px/);
        await userEvent.tab();
        expect(getComputedStyle(underline).borderBottomColor).not.toBe(getComputedStyle(outline).borderTopColor);
        expect(getComputedStyle(underline).boxShadow).toBe('none');
    });

    it.each(['light', 'dark'])('has no axe violations in %s mode', async (mode) => {
        useTheme(mode);
        const page = await mount('<ge-textarea aria-label="Notes" value="Hello"></ge-textarea><ge-textarea aria-label="Locked" disabled placeholder="Locked"></ge-textarea>');

        expect((await axe.run(page, { rules: { region: { enabled: false } } })).violations.map((v) => v.id)).toEqual([]);
    });
});

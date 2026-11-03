import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import { deepActive } from '../shared/overlay.js';
import type { CommandSource, GeCommand } from './index.js';

const MARKUP = (attrs = '') => `<div style="padding:20px;width:400px">
<ge-command ${attrs} style="border:1px solid var(--border)">
  <ge-command-input id="input" placeholder="Type a command"></ge-command-input>
  <ge-command-list aria-label="Commands">
    <ge-command-empty id="empty">No results.</ge-command-empty>
    <ge-command-group id="g1" heading="Suggestions">
      <ge-command-item id="calendar" value="calendar">Calendar</ge-command-item>
      <ge-command-item id="emoji" value="Search-Emoji">Search emoji</ge-command-item>
      <ge-command-item id="launch" value="launch" disabled>Launch</ge-command-item>
    </ge-command-group>
    <ge-command-separator></ge-command-separator>
    <ge-command-group id="g2" heading="Settings">
      <ge-command-item id="profile" value="profile" shortcut="⌘P">Profile</ge-command-item>
      <ge-command-item id="mail" value="mail">Mail</ge-command-item>
    </ge-command-group>
  </ge-command-list>
</ge-command>
</div>`;

const el = (page: HTMLElement, id: string) => page.querySelector<HTMLElement>(`#${id}`)!;
const cmd = (page: HTMLElement) => page.querySelector<GeCommand>('ge-command')!;
const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const e of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await e.updateComplete;
        await new Promise((r) => setTimeout(r, 0));
    }
};
/** Settles without timers, for tests that fake them. */
const flush = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const e of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await e.updateComplete;
        await Promise.resolve();
    }
};
const field = (page: HTMLElement) => el(page, 'input').shadowRoot!.querySelector('input')!;
const shown = (page: HTMLElement) => [...page.querySelectorAll<HTMLElement>('ge-command-item')].filter((i) => !i.hidden).map((i) => i.id);
const highlighted = (page: HTMLElement) => [...page.querySelectorAll<HTMLElement>('ge-command-item[data-active]')].map((i) => i.id);
const type = async (page: HTMLElement, text: string) => {
    field(page).focus();
    await userEvent.keyboard(text);
    await settle(page);
};
const press = async (page: HTMLElement, key: string) => {
    await userEvent.keyboard(key);
    await settle(page);
};

afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
});

describe('ge-command', () => {
    it('filters rows as you type, hides a group it emptied, and shows the empty message when nothing is left', async () => {
        const page = await mount(MARKUP());
        await settle(page);
        expect(shown(page)).toEqual(['calendar', 'emoji', 'launch', 'profile', 'mail']);
        expect(el(page, 'empty').hidden).toBe(true);
        expect(el(page, 'g2').hidden).toBe(false);
        await type(page, 'EMO');
        expect(shown(page)).toEqual(['emoji']);
        expect(el(page, 'g2').hidden).toBe(true);
        expect(el(page, 'g1').hidden).toBe(false);
        await press(page, '{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}');
        // Whitespace around the query does not count.
        await type(page, ' mail ');
        expect(shown(page)).toEqual(['mail']);
        await press(page, '{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}');
        expect(shown(page)).toHaveLength(5);
        await type(page, 'zzz');
        expect(shown(page)).toEqual([]);
        expect(el(page, 'empty').hidden).toBe(false);
        expect(el(page, 'g1').hidden).toBe(true);
        expect(page.querySelector('ge-command-list')!.hasAttribute('role')).toBe(false);
    });

    it('moves the highlight with the arrow keys while focus stays in the field, and Enter activates it', async () => {
        const page = await mount(MARKUP());
        await settle(page);
        const picked: string[] = [];
        page.addEventListener('select-item', (e) => picked.push((e as CustomEvent<string>).detail));
        field(page).focus();
        await press(page, '{ArrowDown}');
        expect(highlighted(page)).toEqual(['calendar']);
        await press(page, '{ArrowDown}');
        expect(highlighted(page)).toEqual(['emoji']);
        expect(deepActive(document)).toBe(field(page));
        await press(page, '{ArrowUp}');
        await press(page, '{ArrowUp}');
        // Wraps past the first row to the last.
        expect(highlighted(page)).toEqual(['mail']);
        await press(page, '{ArrowDown}');
        expect(highlighted(page)).toEqual(['calendar']);
        await press(page, '{Enter}');
        expect(picked).toEqual(['calendar']);
        // A disabled row can hold the highlight but Enter does nothing on it.
        await press(page, '{ArrowDown}{ArrowDown}');
        expect(highlighted(page)).toEqual(['launch']);
        await press(page, '{Enter}');
        expect(picked).toEqual(['calendar']);
    });

    it('starts Up at the last row, and re-points the highlight at the first row that survives the filter', async () => {
        const page = await mount(MARKUP());
        await settle(page);
        field(page).focus();
        await press(page, '{ArrowUp}');
        expect(highlighted(page)).toEqual(['mail']);
        await type(page, 'p');
        expect(shown(page)).toEqual(['profile']);
        expect(highlighted(page)).toEqual(['profile']);
        await type(page, 'zz');
        expect(highlighted(page)).toEqual([]);
        // Without a highlight to begin with, typing still puts it on the first match.
        const fresh = await mount(MARKUP());
        await settle(fresh);
        await type(fresh, 'm');
        expect(highlighted(fresh)).toEqual(['emoji']);
        // A highlight on a row that a new query hides moves to the first row that is left.
        const moved = await mount(MARKUP());
        await settle(moved);
        field(moved).focus();
        await press(moved, '{ArrowDown}{ArrowDown}');
        expect(highlighted(moved)).toEqual(['emoji']);
        cmd(moved).search = 'mail';
        await settle(moved);
        expect(highlighted(moved)).toEqual(['mail']);
    });

    it('activates a row by click, and by Enter while the row itself has focus, but not a disabled one', async () => {
        const page = await mount(MARKUP());
        await settle(page);
        const picked: string[] = [];
        page.addEventListener('select-item', (e) => picked.push((e as CustomEvent<string>).detail));
        el(page, 'profile').click();
        el(page, 'launch').click();
        el(page, 'mail').focus();
        await press(page, '{Enter}');
        expect(picked).toEqual(['profile', 'mail']);
    });

    it('remembers what was picked, newest first without repeats, within the limit, and saves it under recent-key', async () => {
        const page = await mount(MARKUP('recent-key="demo" recent-limit="2"'));
        await settle(page);
        expect(cmd(page).showRecents).toBe(false);
        for (const id of ['calendar', 'mail', 'calendar', 'profile']) el(page, id).click();
        expect(cmd(page).recents).toEqual(['profile', 'calendar']);
        expect(JSON.parse(localStorage.getItem('ge-command:demo')!)).toEqual(['profile', 'calendar']);
        expect(cmd(page).showRecents).toBe(true);
        await type(page, 'x');
        expect(cmd(page).showRecents).toBe(false);
        cmd(page).clearRecents();
        expect(cmd(page).recents).toEqual([]);
        expect(JSON.parse(localStorage.getItem('ge-command:demo')!)).toEqual([]);
        localStorage.setItem('ge-command:other', JSON.stringify(['b', 'a', 5]));
        const again = await mount(MARKUP('recent-key="other"'));
        expect(cmd(again).recents).toEqual(['b', 'a']);
    });

    it('takes the query from `search` when it is set, and shows every row with no-filter', async () => {
        const page = await mount(MARKUP('search="mail"'));
        await settle(page);
        expect(shown(page)).toEqual(['mail']);
        expect(field(page).value).toBe('mail');
        cmd(page).search = 'prof';
        await settle(page);
        expect(shown(page)).toEqual(['profile']);
        const open = await mount(MARKUP('no-filter search="zzz"'));
        await settle(open);
        expect(shown(open)).toHaveLength(5);
    });

    it('drills into pages: the query clears, Escape and Backspace on an empty field go back and Escape stays inside', async () => {
        const page = await mount(MARKUP());
        await settle(page);
        const outer: string[] = [];
        document.addEventListener('keydown', (e) => outer.push(e.key), { once: false });
        await type(page, 'mail');
        cmd(page).pushPage({ id: 'mail', label: 'Mail' });
        await settle(page);
        expect(field(page).value).toBe('');
        expect(cmd(page).currentPage?.id).toBe('mail');
        await press(page, '{Escape}');
        expect(cmd(page).currentPage).toBeNull();
        expect(outer).not.toContain('Escape');
        cmd(page).pushPage({ id: 'a' });
        cmd(page).pushPage({ id: 'b' });
        await settle(page);
        await press(page, 'x');
        await press(page, '{Backspace}');
        expect(cmd(page).pages).toHaveLength(2);
        await press(page, '{Backspace}');
        expect(cmd(page).pages.map((p) => p.id)).toEqual(['a']);
        cmd(page).resetPages();
        expect(cmd(page).pages).toEqual([]);
        // At the top level Escape is not intercepted.
        await press(page, '{Escape}');
        expect(outer).toContain('Escape');
    });

    it('fetches rows from a source after the debounce, drops superseded answers, aborts them, and reports errors', async () => {
        const calls: { query: string; signal: AbortSignal; resolve(rows: { id: string; value: string }[]): void; reject(e: unknown): void }[] = [];
        const source: CommandSource = (query, signal) =>
            new Promise((resolve, reject) => calls.push({ query, signal, resolve, reject }));
        const page = await mount(MARKUP('debounce="200"'));
        await settle(page);
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        cmd(page).source = source;
        await flush(page);
        expect(cmd(page).loading).toBe(true);
        vi.advanceTimersByTime(199);
        expect(calls).toHaveLength(0);
        vi.advanceTimersByTime(1);
        expect(calls.map((c) => c.query)).toEqual(['']);
        calls[0]!.resolve([{ id: '1', value: 'first' }]);
        await flush(page);
        expect(cmd(page).results.map((r) => r.value)).toEqual(['first']);
        expect(cmd(page).loading).toBe(false);
        // Typing again: the slower old answer must not overwrite the newer one.
        cmd(page).search = 'a';
        await flush(page);
        vi.advanceTimersByTime(200);
        cmd(page).search = 'ab';
        await flush(page);
        expect(calls[1]!.signal.aborted).toBe(true);
        vi.advanceTimersByTime(200);
        calls[2]!.resolve([{ id: '3', value: 'new' }]);
        await flush(page);
        calls[1]!.resolve([{ id: '2', value: 'stale' }]);
        await flush(page);
        expect(cmd(page).results.map((r) => r.value)).toEqual(['new']);
        cmd(page).search = 'abc';
        await flush(page);
        vi.advanceTimersByTime(200);
        calls[3]!.reject(new Error('offline'));
        await flush(page);
        expect(cmd(page).results).toEqual([]);
        expect((cmd(page).sourceError as Error).message).toBe('offline');
        expect(cmd(page).loading).toBe(false);
    });

    it('calls the source at once with debounce 0 and announces state changes', async () => {
        const page = await mount(MARKUP('debounce="0"'));
        await settle(page);
        let changes = 0;
        cmd(page).addEventListener('state-change', () => changes++);
        cmd(page).source = async (query) => [{ id: query, value: query }];
        await settle(page);
        expect(cmd(page).results).toEqual([{ id: '', value: '' }]);
        // Not through a timer: with debounce 0 the call is made as the query changes.
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        let called = 0;
        cmd(page).source = async () => {
            called++;
            return [];
        };
        await flush(page);
        expect(called).toBe(1);
        expect(changes).toBeGreaterThan(0);
    });

    it('has no axe violations', async () => {
        useTheme('light');
        const page = await mount(MARKUP());
        await settle(page);
        const results = await axe.run(page, { rules: { 'color-contrast': { enabled: false } } });
        expect(results.violations.map((v) => v.id)).toEqual([]);
        await type(page, 'zzz');
        const empty = await axe.run(page, { rules: { 'color-contrast': { enabled: false } } });
        expect(empty.violations.map((v) => v.id)).toEqual([]);
    });
});

describe('ge-command-dialog', () => {
    const DIALOG = (attrs = '') => `<ge-command-dialog ${attrs}>
  <button id="first">first</button>
  <ge-command>
    <ge-command-input id="input"></ge-command-input>
    <ge-command-list><ge-command-group heading="Suggestions"><ge-command-item value="calendar">Calendar</ge-command-item></ge-command-group></ge-command-list>
  </ge-command>
</ge-command-dialog>`;
    const dialog = (page: HTMLElement) => page.querySelector<HTMLElement & { open: boolean }>('ge-command-dialog')!;

    it('toggles on the shortcut, focuses the field each time it opens, and closes on Escape', async () => {
        const page = await mount(DIALOG());
        await settle(page);
        expect(dialog(page).open).toBe(false);
        await userEvent.keyboard('{Control>}{Shift>}k{/Shift}{/Control}');
        await settle(page);
        expect(dialog(page).open).toBe(false);
        await userEvent.keyboard('{Control>}k{/Control}');
        await settle(page);
        expect(dialog(page).open).toBe(true);
        await new Promise((r) => setTimeout(r, 20));
        expect(deepActive(document)).toBe(field(page));
        await userEvent.keyboard('{Escape}');
        await settle(page);
        expect(dialog(page).open).toBe(false);
        await userEvent.keyboard('{Control>}k{/Control}');
        await settle(page);
        expect(dialog(page).open).toBe(true);
        await userEvent.keyboard('{Control>}k{/Control}');
        await settle(page);
        expect(dialog(page).open).toBe(false);
    });

    it('honours a different shortcut and no-shortcut', async () => {
        const page = await mount(DIALOG('shortcut="Shift+Alt+P"'));
        await settle(page);
        await userEvent.keyboard('{Control>}k{/Control}');
        await settle(page);
        expect(dialog(page).open).toBe(false);
        await userEvent.keyboard('{Shift>}{Alt>}p{/Alt}{/Shift}');
        await settle(page);
        expect(dialog(page).open).toBe(true);
        const off = await mount(DIALOG('no-shortcut'));
        await settle(off);
        await userEvent.keyboard('{Control>}k{/Control}');
        await settle(off);
        expect(dialog(off).open).toBe(false);
    });
});

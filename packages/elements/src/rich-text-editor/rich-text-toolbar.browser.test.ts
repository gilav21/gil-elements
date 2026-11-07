import axe from 'axe-core';
import { html } from 'lit';
import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './toolbar-define.js';
import { mount, useTheme } from '../test-utils.js';
import type { RichTextToolbarSlot } from './rich-text-host.js';
import { RICH_TEXT_LOCALES, type RichTextLocale } from './rich-text-locales.js';
import { SlotRegistry } from './rich-text-registry.js';
import { TOOLBAR_BUTTONS, type GeRichTextToolbar, type ToolbarButtonItem, type ToolbarItem } from './toolbar-index.js';

const en = RICH_TEXT_LOCALES.en;
const he: RichTextLocale = { ...en, code: 'he', rtl: true };

async function toolbar(props: Partial<GeRichTextToolbar> = {}): Promise<GeRichTextToolbar> {
    const page = await mount('<ge-rich-text-toolbar></ge-rich-text-toolbar>');
    const el = page.querySelector<GeRichTextToolbar>('ge-rich-text-toolbar')!;
    Object.assign(el, props);
    await el.updateComplete;
    return el;
}

const root = (el: GeRichTextToolbar) => el.shadowRoot!;
const buttons = (el: GeRichTextToolbar) => [...root(el).querySelectorAll<HTMLButtonElement>('button')];
const first = (el: GeRichTextToolbar) => root(el).querySelector<HTMLButtonElement>('button')!;
const selectOf = (el: GeRichTextToolbar) => root(el).querySelector<HTMLSelectElement>('[data-slot="rich-text-toolbar-text-style"]')!;
const bar = (el: GeRichTextToolbar) => root(el).querySelector<HTMLElement>('[role="toolbar"]')!;
const slotEl = (el: GeRichTextToolbar, id: string) => root(el).querySelector<HTMLElement>(`[data-addon-slot="${id}"]`);

const innerOf = (markup: string) => {
    const probe = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    probe.innerHTML = markup;
    return probe.innerHTML;
};
const iconOf = (button: Element) => button.querySelector('svg')!.innerHTML.replaceAll(/<!--.*?-->/g, '');

function record(el: GeRichTextToolbar, ...names: string[]): Array<[string, unknown]> {
    const seen: Array<[string, unknown]> = [];
    for (const name of names) el.addEventListener(name, (e) => seen.push([name, (e as CustomEvent).detail]));
    return seen;
}

const press = (target: Element, key: string) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, composed: true });
    target.dispatchEvent(event);
    return event;
};

const pick = async (el: GeRichTextToolbar, value: string) => {
    const select = selectOf(el);
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await el.updateComplete;
};

const iconButton = (id: string, extra: Partial<RichTextToolbarSlot> = {}): RichTextToolbarSlot => ({
    id,
    icon: '<svg></svg>',
    tooltip: id,
    ...extra,
});

describe('ge-rich-text-toolbar', () => {
    describe('rendering', () => {
        it('renders a separator element for the separator item', async () => {
            const el = await toolbar({ items: ['bold', 'separator', 'italic'] });
            expect(root(el).querySelector('ge-separator')).not.toBeNull();
            expect(buttons(el)).toHaveLength(2);
        });

        it('is a labelled toolbar whose direction follows the locale', async () => {
            const el = await toolbar();
            expect(bar(el).getAttribute('aria-label')).toBe(en.editor.formattingOptions);
            expect(bar(el).dir).toBe('ltr');
            el.locale = he;
            await el.updateComplete;
            expect(bar(el).dir).toBe('rtl');
        });
    });

    describe('format button click', () => {
        it('emits toolbar-command with the item id when a button is clicked', async () => {
            const el = await toolbar({ items: ['bold'] });
            const seen = record(el, 'toolbar-command');
            first(el).click();
            expect(seen).toEqual([['toolbar-command', 'bold']]);
        });

        it('raises undo, redo and find-toggle as their own events', async () => {
            const el = await toolbar({ items: ['undo', 'redo', 'find'] });
            const seen = record(el, 'toolbar-command', 'undo', 'redo', 'find-toggle');
            for (const button of buttons(el)) button.click();
            expect(seen.map(([name]) => name)).toEqual(['undo', 'redo', 'find-toggle']);
        });

        it.each(['disabled', 'readonly'] as const)('renders disabled and stays silent when %s', async (prop) => {
            const el = await toolbar({ items: ['italic'], [prop]: true });
            const seen = record(el, 'toolbar-command');
            expect(first(el).disabled).toBe(true);
            first(el).click();
            expect(seen).toEqual([]);
        });
    });

    describe('tooltips and icons', () => {
        it('falls back to the raw name for an item outside the union', async () => {
            const el = await toolbar({ items: ['link' as ToolbarItem] });
            expect(first(el).title).toBe('link');
            expect(iconOf(first(el))).toBe('');
        });

        it('keeps the same SVG node across re-renders', async () => {
            const el = await toolbar({ items: ['bold'] });
            const before = first(el).querySelector('svg');
            el.activeFormats = new Set(['bold']);
            await el.updateComplete;
            el.refresh();
            await el.updateComplete;
            expect(before).not.toBeNull();
            expect(first(el).querySelector('svg')).toBe(before);
        });

        it('renders the table icon and the localized label (plus shortcut) for every button item', async () => {
            const items = Object.keys(TOOLBAR_BUTTONS) as ToolbarButtonItem[];
            const el = await toolbar({ items });
            for (const [index, item] of items.entries()) {
                const row = TOOLBAR_BUTTONS[item];
                const label = en.toolbar[row.localeKey];
                const button = buttons(el)[index]!;
                expect(iconOf(button), item).toBe(innerOf(row.icon));
                expect(button.title, item).toBe(row.shortcut ? `${label} (${row.shortcut})` : label);
                expect(button.getAttribute('aria-label')).toBe(button.title);
            }
        });

        it('draws nothing for the separator', async () => {
            const el = await toolbar({ items: ['separator'] });
            expect(root(el).querySelector('svg')).toBeNull();
            expect(buttons(el)).toHaveLength(0);
        });
    });

    describe('TOOLBAR_BUTTONS table', () => {
        const items = Object.keys(TOOLBAR_BUTTONS) as ToolbarButtonItem[];

        it('has no separator row', () => {
            expect(items).not.toContain('separator');
        });

        it('gives every row an icon and a locale key that exists in the dictionary', () => {
            for (const item of items) {
                const row = TOOLBAR_BUTTONS[item];
                expect(row.icon, `${item} icon`).toMatch(/^</);
                expect(en.toolbar[row.localeKey], `${item} label`).toBeTruthy();
            }
        });

        it('covers every item the default toolbar renders', async () => {
            const el = await toolbar();
            for (const item of el.items.filter((i) => i !== 'separator')) expect(items).toContain(item);
        });
    });

    describe('pressed state', () => {
        const pressable = [
            'bold', 'italic', 'underline', 'strikethrough', 'code', 'taskList',
            'bulletList', 'orderedList', 'paragraph', 'heading1', 'heading2', 'heading3',
            'blockquote', 'codeBlock', 'alignLeft', 'alignCenter', 'alignRight',
        ] as const;
        const momentary = ['undo', 'redo', 'clear', 'horizontalRule', 'indent', 'outdent'] as const;

        it.each(pressable)('renders %s pressed when activeFormats reports it', async (item) => {
            const el = await toolbar({ items: [item], activeFormats: new Set([item]) });
            expect(first(el).getAttribute('aria-pressed')).toBe('true');
            expect(first(el).getAttribute('data-state')).toBe('on');
        });

        it.each(pressable)('renders %s unpressed when activeFormats omits it', async (item) => {
            const el = await toolbar({ items: [item], activeFormats: new Set() });
            expect(first(el).getAttribute('aria-pressed')).toBe('false');
            expect(first(el).getAttribute('data-state')).toBe('off');
        });

        it.each(momentary)('never puts aria-pressed on %s', async (item) => {
            const el = await toolbar({ items: [item], activeFormats: new Set([item]) });
            expect(first(el).hasAttribute('aria-pressed')).toBe(false);
            expect(first(el).getAttribute('data-state')).toBe('off');
        });
    });

    describe('text style select', () => {
        const withSelect = (formats: string[] = [], extra: Partial<GeRichTextToolbar> = {}) =>
            toolbar({ items: ['textStyle'], activeFormats: new Set(formats), ...extra });

        it('renders a select rather than a button', async () => {
            const el = await withSelect();
            expect(selectOf(el)).not.toBeNull();
            expect(buttons(el)).toHaveLength(0);
        });

        it('offers exactly the four block types, localized', async () => {
            const options = [...selectOf(await withSelect()).options];
            expect(options.map((o) => o.value)).toEqual(['paragraph', 'heading1', 'heading2', 'heading3']);
            expect(options.map((o) => o.textContent?.trim())).toEqual(['Normal Text', 'Heading 1', 'Heading 2', 'Heading 3']);
        });

        it.each([
            [['heading2'], 'heading2'],
            [['heading1'], 'heading1'],
            [['paragraph'], 'paragraph'],
            [['blockquote'], 'paragraph'],
            [[], 'paragraph'],
            [['paragraph', 'heading3'], 'heading3'],
        ])('shows the caret block for %j as %s', async (formats, expected) => {
            expect(selectOf(await withSelect(formats)).value).toBe(expected);
        });

        it('emits text-style-select with the chosen option id', async () => {
            const el = await withSelect(['paragraph']);
            const seen = record(el, 'text-style-select', 'toolbar-command');
            await pick(el, 'heading2');
            expect(seen).toEqual([['text-style-select', 'heading2']]);
        });

        it('is disabled, and emits nothing, where the caret line takes no text style', async () => {
            const el = await withSelect([], { textStyleAvailable: false });
            const seen = record(el, 'text-style-select');
            expect(selectOf(el).disabled).toBe(true);
            await pick(el, 'heading1');
            expect(seen).toEqual([]);
            expect(selectOf(el).value).toBe('paragraph');
        });

        it('goes back to the caret block when the editor does not apply the pick', async () => {
            const el = await withSelect(['paragraph']);
            await pick(el, 'heading1');
            expect(selectOf(el).value).toBe('paragraph');
        });

        it('moves forward to the block a pick applied', async () => {
            const el = await withSelect(['paragraph']);
            await pick(el, 'heading2');
            el.activeFormats = new Set(['heading2']);
            await el.updateComplete;
            expect(selectOf(el).value).toBe('heading2');
        });

        it('is disabled and silent while the toolbar is disabled', async () => {
            const el = await withSelect([], { disabled: true });
            const seen = record(el, 'text-style-select');
            expect(selectOf(el).disabled).toBe(true);
            await pick(el, 'heading1');
            expect(seen).toEqual([]);
        });

        it('is disabled while the toolbar is readonly', async () => {
            expect(selectOf(await withSelect([], { readonly: true })).disabled).toBe(true);
        });

        it('ignores a change carrying a value outside the option set', async () => {
            const el = await withSelect(['paragraph']);
            const seen = record(el, 'text-style-select');
            const rogue = new Option('x', 'heading9');
            selectOf(el).append(rogue);
            await pick(el, 'heading9');
            expect(seen).toEqual([]);
            expect(selectOf(el).value).toBe('paragraph');
        });

        it('carries an accessible name from the locale and is never announced as pressed', async () => {
            const el = await withSelect(['heading1']);
            expect(selectOf(el).getAttribute('aria-label')).toBe(en.toolbar.textStyle);
            expect(selectOf(el).hasAttribute('aria-pressed')).toBe(false);
        });

        it('takes the arrow, Home and End keys as roving moves, leaving its value and the focus alone', async () => {
            const el = await withSelect(['heading2']);
            const select = selectOf(el);
            select.focus();
            expect(root(el).activeElement).toBe(select);
            for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) {
                expect(press(select, key).defaultPrevented, key).toBe(true);
            }
            expect(root(el).activeElement).toBe(select);
            expect(select.value).toBe('heading2');
            expect(select.tabIndex).toBe(0);
            expect(press(select, 'p').defaultPrevented).toBe(false);
        });

        it('has a non-empty toolbar.textStyle in the locale', () => {
            expect(en.toolbar.textStyle.length).toBeGreaterThan(0);
        });
    });

    describe('addon slots', () => {
        it('renders a button slot with its icon, tooltip and data-addon-slot id, and forwards clicks to onClick', async () => {
            const clicks: Event[] = [];
            const el = await toolbar({ items: [], slots: [iconButton('a.button', { tooltip: 'Addon', onClick: (e) => clicks.push(e) })] });
            const button = slotEl(el, 'a.button') as HTMLButtonElement;
            expect(button.tagName).toBe('BUTTON');
            expect(button.title).toBe('Addon');
            expect(button.hasAttribute('aria-pressed')).toBe(false);
            button.click();
            expect(clicks).toHaveLength(1);
        });

        it('renders a render slot instead of a button', async () => {
            const el = await toolbar({ items: [], slots: [{ id: 'a.component', render: () => html`<span data-testid="slot-probe">probe</span>` }] });
            const slot = slotEl(el, 'a.component')!;
            expect(slot.tagName).toBe('SPAN');
            expect(slot.querySelector('[data-testid="slot-probe"]')).not.toBeNull();
            expect(slot.querySelector('button')).toBeNull();
        });

        it('renders a tag slot as that element and keeps it across re-renders', async () => {
            const el = await toolbar({ items: [], slots: [{ id: 'a.tag', tag: 'x-probe' }] });
            const probe = slotEl(el, 'a.tag')!.firstElementChild!;
            expect(probe.tagName).toBe('X-PROBE');
            el.refresh();
            await el.updateComplete;
            expect(slotEl(el, 'a.tag')!.firstElementChild).toBe(probe);
        });

        it('renders nothing for a malformed slot with neither render, tag nor icon', async () => {
            const el = await toolbar({ items: [], slots: [{ id: 'a.broken', tooltip: 'broken', onClick: () => void 0 }] });
            expect(slotEl(el, 'a.broken')).toBeNull();
        });

        it('tells tag slots when the toolbar is compact', async () => {
            const el = await toolbar({ items: [], slots: [{ id: 'a.ctx', tag: 'x-probe' }] });
            const probe = slotEl(el, 'a.ctx')!.firstElementChild!;
            expect(probe.hasAttribute('compact')).toBe(false);
            el.compact = true;
            await el.updateComplete;
            expect(probe.hasAttribute('compact')).toBe(true);
        });

        it('orders slots by their order value, lowest first', async () => {
            const el = await toolbar({
                items: [],
                slots: [iconButton('late', { order: 900 }), { id: 'early', render: () => html`<i></i>`, order: 10 }],
            });
            const ids = [...root(el).querySelectorAll('[data-addon-slot]')].map((s) => s.getAttribute('data-addon-slot'));
            expect(ids).toEqual(['early', 'late']);
        });

        it('follows a registry live, and stops following when disconnected', async () => {
            const registry = new SlotRegistry<RichTextToolbarSlot>();
            const el = await toolbar({ items: [], slots: registry });
            expect(slotEl(el, 'live')).toBeNull();
            const remove = registry.register(iconButton('live'));
            await el.updateComplete;
            expect(slotEl(el, 'live')).not.toBeNull();
            remove();
            await el.updateComplete;
            expect(slotEl(el, 'live')).toBeNull();

            el.remove();
            registry.register(iconButton('after'));
            await el.updateComplete;
            expect(slotEl(el, 'after')).toBeNull();
        });

        it('polls isEnabled and isActive on refresh()', async () => {
            let enabled = true;
            let active = false;
            const el = await toolbar({ items: [], slots: [iconButton('poll', { isEnabled: () => enabled, isActive: () => active })] });
            const button = slotEl(el, 'poll') as HTMLButtonElement;
            expect(button.disabled).toBe(false);
            expect(button.getAttribute('aria-pressed')).toBe('false');

            enabled = false;
            active = true;
            el.refresh();
            await el.updateComplete;
            expect(button.disabled).toBe(true);
            expect(button.getAttribute('aria-pressed')).toBe('true');
            expect(button.getAttribute('data-state')).toBe('on');
        });

        it('disables slot buttons while the toolbar is disabled', async () => {
            const el = await toolbar({ items: [], disabled: true, slots: [iconButton('x')] });
            expect((slotEl(el, 'x') as HTMLButtonElement).disabled).toBe(true);
        });
    });

    describe('RTL mirroring', () => {
        const mirrored = async () => toolbar({ items: ['alignLeft', 'alignRight', 'indent', 'outdent', 'bold'], locale: he });

        it('mirrors both the icon and the tooltip for the alignment items', async () => {
            const [left, right] = buttons(await mirrored());
            expect(iconOf(left!)).toBe(innerOf(TOOLBAR_BUTTONS.alignRight.icon));
            expect(iconOf(right!)).toBe(innerOf(TOOLBAR_BUTTONS.alignLeft.icon));
            expect(left!.title).toBe(he.toolbar.alignRight);
            expect(right!.title).toBe(he.toolbar.alignLeft);
        });

        it('mirrors the icon but NOT the tooltip for indent/outdent', async () => {
            const [, , indent, outdent] = buttons(await mirrored());
            expect(iconOf(indent!)).toBe(innerOf(TOOLBAR_BUTTONS.outdent.icon));
            expect(iconOf(outdent!)).toBe(innerOf(TOOLBAR_BUTTONS.indent.icon));
            expect(indent!.title).toBe(he.toolbar.indent);
            expect(outdent!.title).toBe(he.toolbar.outdent);
        });

        it('leaves a non-directional item untouched', async () => {
            const bold = buttons(await mirrored())[4]!;
            expect(iconOf(bold)).toBe(innerOf(TOOLBAR_BUTTONS.bold.icon));
            expect(bold.title).toContain(he.toolbar.bold);
        });

        it('swaps the arrow keys', async () => {
            const el = await toolbar({ items: ['bold', 'italic', 'underline'], locale: he });
            press(first(el), 'ArrowLeft');
            expect(buttons(el)[1]!.tabIndex).toBe(0);
        });
    });

    describe('keyboard navigation (WAI-ARIA toolbar pattern)', () => {
        const three = () => toolbar({ items: ['bold', 'italic', 'separator', 'underline'] });
        const current = (el: GeRichTextToolbar) =>
            [...root(el).querySelectorAll<HTMLElement>('button, select')].find((c) => c.tabIndex === 0)!;
        const panel = (id: string): RichTextToolbarSlot => ({
            id,
            render: () => html`<button type="button" data-testid="trigger">Link</button>
                <div data-slot="popover-content">
                    <input data-testid="input" />
                    <button type="button" data-testid="ok">Update</button>
                </div>`,
        });

        it('exposes exactly one tab stop, not one per button', async () => {
            const el = await three();
            const stops = buttons(el).filter((b) => b.tabIndex === 0);
            expect(buttons(el)).toHaveLength(3);
            expect(stops).toEqual([first(el)]);
        });

        it('moves the tab stop with ArrowRight and wraps at the end', async () => {
            const el = await three();
            const [a, b] = buttons(el);
            press(current(el), 'ArrowRight');
            expect([b!.tabIndex, a!.tabIndex]).toEqual([0, -1]);
            press(current(el), 'ArrowRight');
            press(current(el), 'ArrowRight');
            expect(a!.tabIndex).toBe(0);
        });

        it('moves the tab stop with ArrowLeft and wraps at the start', async () => {
            const el = await three();
            press(current(el), 'ArrowLeft');
            expect(buttons(el)[2]!.tabIndex).toBe(0);
        });

        it('jumps to the first and last button with Home and End', async () => {
            const el = await three();
            press(current(el), 'End');
            expect(buttons(el)[2]!.tabIndex).toBe(0);
            press(current(el), 'Home');
            expect(buttons(el)[0]!.tabIndex).toBe(0);
        });

        it('adopts the control the user focused', async () => {
            const el = await three();
            buttons(el)[2]!.focus();
            expect(buttons(el)[2]!.tabIndex).toBe(0);
            expect(buttons(el)[0]!.tabIndex).toBe(-1);
        });

        it('does not trap the tab stop on the text-style select', async () => {
            const el = await toolbar({ items: ['bold', 'textStyle', 'italic'] });
            press(current(el), 'ArrowRight');
            expect(current(el).tagName).toBe('SELECT');
            press(current(el), 'ArrowRight');
            expect(current(el).tagName).toBe('BUTTON');
        });

        it('keeps a single tab stop when a re-render adds the text-style select', async () => {
            const el = await three();
            el.items = ['bold', 'textStyle', 'italic'];
            await el.updateComplete;
            const focusables = [...bar(el).querySelectorAll<HTMLElement>('button, select, input, [tabindex]')];
            expect(focusables.length).toBeGreaterThan(1);
            expect(focusables.filter((c) => c.tabIndex === 0)).toHaveLength(1);
        });

        it('leaves the arrows to a field inside an addon panel instead of moving the tab stop', async () => {
            const el = await three();
            el.slots = [panel('links')];
            await el.updateComplete;
            const input = root(el).querySelector<HTMLInputElement>('[data-testid="input"]')!;
            input.focus();
            expect(press(input, 'ArrowRight').defaultPrevented).toBe(false);
            expect(root(el).activeElement).toBe(input);
            expect(buttons(el)[0]!.tabIndex).toBe(0);
        });

        it("keeps an addon panel's own buttons out of the roving order and in the Tab order", async () => {
            const el = await three();
            el.slots = [panel('links')];
            await el.updateComplete;
            const ok = root(el).querySelector<HTMLButtonElement>('[data-testid="ok"]')!;
            const trigger = root(el).querySelector<HTMLButtonElement>('[data-testid="trigger"]')!;
            expect(ok.tabIndex).not.toBe(-1);
            expect(trigger.tabIndex).toBe(-1);
            press(current(el), 'End');
            expect(trigger.tabIndex).toBe(0);
            expect(ok.tabIndex).not.toBe(-1);
        });

        it("leaves the emoji picker's panel out of the roving order too", async () => {
            const el = await three();
            el.slots = [{
                id: 'emoji',
                render: () => html`<button type="button" data-testid="trigger">Emoji</button>
                    <div data-slot="emoji-picker-content"><button type="button" data-testid="emoji">A</button></div>`,
            }];
            await el.updateComplete;
            const emoji = root(el).querySelector<HTMLButtonElement>('[data-testid="emoji"]')!;
            expect(emoji.tabIndex).not.toBe(-1);
            expect(root(el).querySelector<HTMLButtonElement>('[data-testid="trigger"]')!.tabIndex).toBe(-1);
            expect(press(emoji, 'ArrowRight').defaultPrevented).toBe(false);
        });
    });

    describe('styling', () => {
        it('meets the 44px touch minimum under a coarse pointer', async () => {
            const el = await toolbar({ items: ['textStyle'] });
            const rules = [...root(el).adoptedStyleSheets].flatMap((sheet) => [...sheet.cssRules]);
            const coarse = rules.filter((r): r is CSSMediaRule => r instanceof CSSMediaRule && r.conditionText.includes('pointer: coarse'));
            const styles = coarse.flatMap((r) => [...r.cssRules]).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
            const minHeight = (selector: string) => styles.find((r) => r.selectorText === selector)?.style.minHeight;
            expect(minHeight('select')).toBe('44px');
            expect(minHeight('button')).toBe('44px');
        });

        it('drops the toolbar border and background and tightens its padding when compact', async () => {
            const el = await toolbar();
            const framed = getComputedStyle(bar(el));
            expect(framed.borderBottomWidth).toBe('1px');
            expect(framed.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
            expect(framed.paddingTop).toBe('4px');

            el.compact = true;
            await el.updateComplete;
            const compact = getComputedStyle(bar(el));
            expect(compact.borderBottomWidth).toBe('0px');
            expect(compact.backgroundColor).toBe('rgba(0, 0, 0, 0)');
            expect(compact.paddingTop).toBe('2px');
        });
    });

    it.each(['light', 'dark'])('passes axe in %s mode', async (mode) => {
        useTheme(mode);
        const page = await mount(`<ge-rich-text-toolbar></ge-rich-text-toolbar>`);
        const el = page.querySelector<GeRichTextToolbar>('ge-rich-text-toolbar')!;
        el.items = ['textStyle', 'separator', 'bold', 'italic', 'separator', 'undo', 'redo', 'find'];
        el.activeFormats = new Set(['bold']);
        el.slots = [iconButton('addon', { tooltip: 'Addon' })];
        await el.updateComplete;
        expect((await axe.run(page)).violations).toEqual([]);
    });
});

import { render } from 'lit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RichTextAddonHost, RichTextHistoryEntrySnapshot } from '../../rich-text-host.js';
import { RichTextSanitizer } from '../../rich-text-sanitizer.js';
import { Disposables } from '../../rich-text-registry.js';
import './define.js';
import { HistoryPanel, RICH_TEXT_HISTORY_LOCALES } from './index.js';

const EN = RICH_TEXT_HISTORY_LOCALES.en;

const snapshot = (index: number): RichTextHistoryEntrySnapshot => ({
    index,
    timestamp: 1_700_000_000_000 + index * 1000,
    preview: `entry ${index}`,
    previewLines: [`entry ${index}`],
    lineCount: 1,
});

let entries: RichTextHistoryEntrySnapshot[];
let flags: { disabled: boolean; readonly: boolean };
let host: RichTextAddonHost & { restoreHistoryEntry: ReturnType<typeof vi.fn>; flushPendingHistoryPush: ReturnType<typeof vi.fn>; emit: ReturnType<typeof vi.fn> };
let panel: HistoryPanel;
let element: HTMLElement;
let life: Disposables;
const detached: HTMLElement[] = [];

function setup(showButton = true): void {
    element = document.createElement('div');
    document.body.append(element);
    detached.push(element);
    entries = [snapshot(0), snapshot(1), snapshot(2)];
    flags = { disabled: false, readonly: false };
    life = new Disposables();
    host = {
        element,
        get isDisabled() { return flags.disabled; },
        get readonly() { return flags.readonly; },
        sanitizer: new RichTextSanitizer(),
        currentHistoryIndex: () => 1,
        historyEntries: () => entries,
        reconstructHistoryEntry: vi.fn((index: number) => (index === 0 ? { html: '<p>alpha</p>', markdown: 'alpha' } : null)),
        flushPendingHistoryPush: vi.fn(),
        restoreHistoryEntry: vi.fn(),
        emit: vi.fn(),
        invalidate: vi.fn(),
    } as unknown as typeof host;
    panel = new HistoryPanel(host, EN, showButton, life);
}

/** A history row inside a `[data-history-list]` container of the given type, appended to `parent`. */
function makeRow(listType: 'popover' | 'dialog', index: number, parent: HTMLElement = document.body): HTMLElement {
    const list = document.createElement('div');
    list.dataset['historyList'] = listType;
    const row = document.createElement('div');
    row.dataset['historyEntryAction'] = 'true';
    row.dataset['historyEntryIndex'] = String(index);
    row.tabIndex = 0;
    list.append(row);
    parent.append(list);
    detached.push(list);
    return row;
}

const key = (name: string, row: HTMLElement | null, preventDefault = vi.fn()) =>
    ({ key: name, currentTarget: row, preventDefault, stopPropagation: vi.fn() }) as unknown as KeyboardEvent;

beforeEach(() => setup());

afterEach(() => {
    life.dispose();
    vi.useRealTimers();
    for (const node of detached.splice(0)) node.remove();
});

describe('history panel: view', () => {
    it('labels the corner button with the live history count', async () => {
        render(panel.render(), element);
        const button = element.querySelector('ge-button')!;
        expect(button.textContent?.trim()).toBe('History (3)');

        entries = [...entries, snapshot(3)];
        render(panel.render(), element);
        expect(button.textContent?.trim()).toBe('History (4)');
    });

    it('hides the corner button when readonly or when the button is switched off', () => {
        flags.readonly = true;
        render(panel.render(), element);
        expect(element.querySelector('ge-popover')).toBeNull();

        flags.readonly = false;
        panel = new HistoryPanel(host, EN, false, life);
        render(panel.render(), element);
        expect(element.querySelector('ge-popover')).toBeNull();
    });

    it('reverses the timeline and marks the active entry', () => {
        const timeline = panel.timeline();
        expect(timeline).toHaveLength(3);
        expect(timeline[0]!.index).toBe(2);
        expect(timeline.find((entry) => entry.index === 1)?.active).toBe(true);
    });

    it('marks the entry just applied', () => {
        panel.onPanelOpenChange(true);
        panel.quickApply(2, null);
        render(panel.render(), element);
        expect(element.querySelector('.history-applied')?.textContent).toBe(EN.applied);
    });

    it('lists the preview lines and the count of the ones not shown', () => {
        entries = [{ ...snapshot(0), previewLines: ['a', 'b'], lineCount: 5 }];
        panel.onPanelOpenChange(true);
        render(panel.render(), element);
        const row = element.querySelector('[data-history-list="popover"] .history-entry')!;
        expect([...row.querySelectorAll('.history-lines p')].map((line) => line.textContent)).toEqual(['a', 'b', '+3 more lines']);
        expect(row.getAttribute('aria-label')).toBe('Apply revision 1');
    });
});

describe('history panel: rendered preview', () => {
    it('keeps inline colour the editor allows', () => {
        host.reconstructHistoryEntry = vi.fn(() => ({ html: '<span style="color: rgb(255, 0, 0)">red</span>', markdown: 'red' }));
        panel.openPreview(0);
        const span = panel.selected!.content.querySelector('span')!;
        expect(span.style.color).toBe('rgb(255, 0, 0)');
        expect(span.textContent).toBe('red');
    });

    it('still drops what the editor itself would never allow', () => {
        host.reconstructHistoryEntry = vi.fn(() => ({ html: `<span style="color: red">ok</span><scr${'ipt'}>alert(1)</scr${'ipt'}>`, markdown: '' }));
        panel.openPreview(0);
        expect(panel.selected!.content.querySelector('script')).toBeNull();
        expect(panel.selected!.content.textContent).toBe('ok');
    });

    it('renders the reconstructed html and markdown in the preview dialog', async () => {
        panel.openPreview(0);
        render(panel.render(), element);
        const dialog = element.querySelector<HTMLElement>('ge-dialog')!;
        await (dialog as unknown as { updateComplete: Promise<void> }).updateComplete;
        const content = dialog.querySelector('ge-dialog-content')!;
        expect([...content.querySelector('.history-rendered')!.children].map((child) => child.outerHTML)).toEqual(['<p>alpha</p>']);
        expect(content.querySelector('pre')?.textContent).toBe('alpha');
    });
});

describe('history panel: selected entry', () => {
    it('keeps the reconstructed entry for a valid selection', () => {
        panel.openPreview(0);
        expect(panel.selected?.markdown).toBe('alpha');
        expect(panel.selected?.index).toBe(0);
        expect(panel.selected?.content.textContent).toBe('alpha');
    });

    it('is null when the entry cannot be reconstructed', () => {
        panel.openPreview(2);
        expect(panel.selected).toBeNull();
    });
});

describe('history panel: opening', () => {
    it('re-opens the panel when a close arrives while the preview is open', () => {
        panel.previewOpen = true;
        panel.onPanelOpenChange(false);
        expect(panel.panelOpen).toBe(true);
    });

    it('refuses to open while the editor is disabled, by input or by a surrounding form', () => {
        flags.disabled = true;
        panel.onPanelOpenChange(true);
        expect(panel.panelOpen).toBe(false);
    });

    it('refuses the keyboard shortcut while disabled', () => {
        flags.disabled = true;
        panel.openFromShortcut();
        expect(panel.panelOpen).toBe(false);
        expect(host.flushPendingHistoryPush).not.toHaveBeenCalled();
    });

    it('flushes pending history and opens', () => {
        panel.onPanelOpenChange(true);
        expect(host.flushPendingHistoryPush).toHaveBeenCalled();
        expect(panel.panelOpen).toBe(true);
    });

    it('closes when asked to close with no preview open', () => {
        panel.panelOpen = true;
        panel.onPanelOpenChange(false);
        expect(panel.panelOpen).toBe(false);
    });

    it('does nothing from the shortcut while readonly', () => {
        flags.readonly = true;
        panel.openFromShortcut();
        expect(panel.panelOpen).toBe(false);
        expect(panel.browserOpen).toBe(false);
    });

    it('opens the popover from the shortcut when the button is visible', () => {
        panel.openFromShortcut();
        expect(panel.panelOpen).toBe(true);
    });

    it('opens the browser dialog from the shortcut when the button is hidden', () => {
        setup(false);
        panel.openFromShortcut();
        expect(panel.browserOpen).toBe(true);
        expect(panel.panelOpen).toBe(false);
    });

    it('ignores an out-of-range preview index', () => {
        panel.openPreview(9);
        expect(panel.previewOpen).toBe(false);
    });

    it('opens the preview, closes the browser and stops event propagation', () => {
        const stopPropagation = vi.fn();
        panel.browserOpen = true;
        panel.openPreview(0, { stopPropagation } as unknown as Event);
        expect(stopPropagation).toHaveBeenCalled();
        expect(panel.previewOpen).toBe(true);
        expect(panel.browserOpen).toBe(false);
    });
});

describe('history panel: applying', () => {
    it('applies the entry, emits history-restore and returns focus to that row in the list it was clicked in', () => {
        vi.useFakeTimers();
        const dialogRow = makeRow('dialog', 1, element);
        const popoverRow = makeRow('popover', 1, element);

        panel.quickApply(1, popoverRow);
        vi.advanceTimersByTime(1);

        expect(host.restoreHistoryEntry).toHaveBeenCalledWith(1);
        expect(host.emit).toHaveBeenCalledWith('history-restore', 1);
        expect(document.activeElement).toBe(popoverRow);
        expect(document.activeElement).not.toBe(dialogRow);
    });

    it('applies even when there is no current target', () => {
        panel.quickApply(1, null);
        expect(host.restoreHistoryEntry).toHaveBeenCalledWith(1);
    });

    it('ignores an out-of-range quick apply', () => {
        panel.quickApply(99, null);
        expect(host.restoreHistoryEntry).not.toHaveBeenCalled();
    });

    it('does nothing from the preview when no entry is selected', () => {
        panel.restoreFromPreview();
        expect(host.restoreHistoryEntry).not.toHaveBeenCalled();
    });

    it('applies the selected entry from the preview and closes it', () => {
        panel.openPreview(0);
        panel.restoreFromPreview();
        expect(host.restoreHistoryEntry).toHaveBeenCalledWith(0);
        expect(panel.previewOpen).toBe(false);
    });

    it('closes the panel, preview and browser', () => {
        Object.assign(panel, { panelOpen: true, previewOpen: true, browserOpen: true });
        panel.closePanel();
        panel.closePreview();
        panel.closeBrowser();
        expect([panel.panelOpen, panel.previewOpen, panel.browserOpen]).toEqual([false, false, false]);
    });
});

describe('history panel: keyboard', () => {
    it('returns early without a current target', () => {
        panel.onEntryKeydown(key('Enter', null), 1);
        expect(host.restoreHistoryEntry).not.toHaveBeenCalled();
    });

    it.each(['Enter', ' ', 'Spacebar'])('applies the entry on %s', (name) => {
        const row = makeRow('dialog', 1);
        const preventDefault = vi.fn();
        panel.onEntryKeydown(key(name, row, preventDefault), 1);
        expect(preventDefault).toHaveBeenCalled();
        expect(host.restoreHistoryEntry).toHaveBeenCalledWith(1);
    });

    it('closes the popover on Escape from a popover row', () => {
        panel.panelOpen = true;
        panel.onEntryKeydown(key('Escape', makeRow('popover', 0)), 0);
        expect(panel.panelOpen).toBe(false);
    });

    it('closes the browser dialog on Escape from a dialog row', () => {
        panel.browserOpen = true;
        panel.onEntryKeydown(key('Escape', makeRow('dialog', 0)), 0);
        expect(panel.browserOpen).toBe(false);
    });

    it('leaves state unchanged on Escape from a row with no list type', () => {
        const orphan = document.createElement('div');
        panel.panelOpen = true;
        panel.onEntryKeydown(key('Escape', orphan), 0);
        expect(panel.panelOpen).toBe(true);
    });

    describe('arrow navigation', () => {
        function threeRows(): HTMLElement[] {
            const list = document.createElement('div');
            list.dataset['historyList'] = 'dialog';
            const rows = [0, 1, 2].map((index) => {
                const row = document.createElement('div');
                row.dataset['historyEntryAction'] = 'true';
                row.dataset['historyEntryIndex'] = String(index);
                row.tabIndex = 0;
                list.append(row);
                return row;
            });
            document.body.append(list);
            detached.push(list);
            return rows;
        }

        it('moves focus with ArrowDown, ArrowUp, Home and End', () => {
            const rows = threeRows();
            rows[0]!.focus();
            panel.onEntryKeydown(key('ArrowDown', rows[0]!), 0);
            expect(document.activeElement).toBe(rows[1]);
            panel.onEntryKeydown(key('End', rows[1]!), 1);
            expect(document.activeElement).toBe(rows[2]);
            panel.onEntryKeydown(key('ArrowUp', rows[2]!), 2);
            expect(document.activeElement).toBe(rows[1]);
            panel.onEntryKeydown(key('Home', rows[1]!), 1);
            expect(document.activeElement).toBe(rows[0]);
        });

        it('ignores an unmapped key', () => {
            const rows = threeRows();
            rows[0]!.focus();
            const preventDefault = vi.fn();
            panel.onEntryKeydown(key('Tab', rows[0]!, preventDefault), 0);
            expect(document.activeElement).toBe(rows[0]);
            expect(preventDefault).not.toHaveBeenCalled();
        });

        it('does nothing when the row is not inside a list container', () => {
            const orphan = document.createElement('div');
            orphan.tabIndex = 0;
            document.body.append(orphan);
            detached.push(orphan);
            orphan.focus();
            panel.onEntryKeydown(key('ArrowDown', orphan), 0);
            expect(document.activeElement).toBe(orphan);
        });
    });
});

describe('history panel: focus timers', () => {
    beforeEach(() => vi.useFakeTimers());

    const seedAction = (list: 'popover' | 'dialog', index: number): HTMLElement => {
        const container = document.createElement('div');
        container.dataset['historyList'] = list;
        const action = document.createElement('button');
        action.dataset['historyEntryAction'] = 'true';
        action.dataset['historyEntryIndex'] = String(index);
        container.append(action);
        element.append(container);
        return action;
    };

    it('focuses the first action once it appears', () => {
        const action = seedAction('popover', 0);
        const focus = vi.spyOn(action, 'focus');
        panel.onPanelOpenChange(true);
        vi.advanceTimersByTime(24);
        expect(focus).toHaveBeenCalled();
    });

    it('retries until the first action appears, and gives up after the fifth attempt', () => {
        // Attempts run at 24ms, then every 16ms: 24, 40, 56, 72, 88.
        setup(false);
        panel.openFromShortcut();
        vi.advanceTimersByTime(72);
        const late = seedAction('dialog', 0);
        vi.advanceTimersByTime(16);
        expect(document.activeElement).toBe(late);

        late.blur();
        late.parentElement!.remove();
        panel.openFromShortcut();
        vi.advanceTimersByTime(88);
        const tooLate = seedAction('dialog', 0);
        vi.advanceTimersByTime(1000);
        expect(document.activeElement).not.toBe(tooLate);
    });

    it('focuses a specific entry by index', () => {
        const action = seedAction('dialog', 2);
        const focus = vi.spyOn(action, 'focus');
        panel.quickApply(2, makeRow('dialog', 2));
        vi.advanceTimersByTime(1);
        expect(focus).toHaveBeenCalled();
    });

    it('cancels pending focus work when the addon is torn down', () => {
        const action = seedAction('popover', 0);
        const focus = vi.spyOn(action, 'focus');
        panel.onPanelOpenChange(true);
        life.dispose();
        vi.advanceTimersByTime(200);
        expect(focus).not.toHaveBeenCalled();
    });
});

import { render } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import { RICH_TEXT_ACTIONS_LOCALES } from './actions-locale.js';
import { renderActionsPopover, type ActionsPopoverView, type PopoverActionRow } from './actions-popover.js';

const hosts: HTMLElement[] = [];

afterEach(() => {
    for (const host of hosts.splice(0)) host.remove();
});

function mountPopover(rows: PopoverActionRow[], handlers: Partial<Pick<ActionsPopoverView, 'onEdit' | 'onRemove' | 'onAdd'>> = {}, canAdd = true): HTMLElement {
    const host = document.createElement('div');
    document.body.append(host);
    hosts.push(host);
    render(renderActionsPopover({
        rows,
        canAdd,
        locale: RICH_TEXT_ACTIONS_LOCALES.en,
        anchor: { left: 10, top: 20 },
        onEdit: handlers.onEdit ?? (() => undefined),
        onRemove: handlers.onRemove ?? (() => undefined),
        onAdd: handlers.onAdd ?? (() => undefined),
    }), host);
    return host;
}

describe('actions popover', () => {
    it('lists actions and reports edit/remove per row', () => {
        const edits: string[] = [];
        const removes: PopoverActionRow[] = [];
        const host = mountPopover([
            { trigger: 'click', id: 'open-dialog', label: 'Open dialog', available: true },
            { trigger: 'hover', id: 'ghost', label: 'ghost', available: false },
        ], { onEdit: (t) => edits.push(t), onRemove: (row) => removes.push(row) });

        const editBtns = host.querySelectorAll<HTMLButtonElement>('[data-testid="rta-edit"]');
        expect(editBtns).toHaveLength(1);
        editBtns[0]!.click();
        expect(edits).toEqual(['click']);
        const removeBtns = host.querySelectorAll<HTMLButtonElement>('[data-testid="rta-remove"]');
        expect(removeBtns).toHaveLength(2);
        removeBtns[1]!.click();
        expect(removes).toEqual([{ trigger: 'hover', id: 'ghost', label: 'ghost', available: false }]);
    });

    it('renders a combined row spanning both triggers and reports it whole on remove', () => {
        const combinedRow: PopoverActionRow = { trigger: 'click', id: 'dictionary', label: 'Dictionary', available: true, combined: true };
        const removes: PopoverActionRow[] = [];
        const host = mountPopover([combinedRow], { onRemove: (row) => removes.push(row) });
        expect(host.querySelectorAll('[data-testid="rta-remove"]')).toHaveLength(1);
        expect(host.textContent).toContain('click');
        expect(host.textContent).toContain('hover');
        host.querySelector<HTMLButtonElement>('[data-testid="rta-remove"]')!.click();
        expect(removes).toEqual([combinedRow]);
    });

    it('reports add when the add button is clicked, and omits it when nothing is left to add', () => {
        let added = false;
        const host = mountPopover([], { onAdd: () => { added = true; } });
        host.querySelector<HTMLButtonElement>('[data-testid="rta-add"]')!.click();
        expect(added).toBe(true);
        expect(mountPopover([], {}, false).querySelector('[data-testid="rta-add"]')).toBeNull();
    });

    it('marks an unavailable row and mirrors the locale direction', () => {
        const host = document.createElement('div');
        document.body.append(host);
        hosts.push(host);
        render(renderActionsPopover({
            rows: [{ trigger: 'click', id: 'ghost', label: 'ghost', available: false }],
            canAdd: false,
            locale: RICH_TEXT_ACTIONS_LOCALES.he!,
            anchor: { left: 0, top: 0 },
            onEdit: () => undefined,
            onRemove: () => undefined,
            onAdd: () => undefined,
        }), host);
        expect(host.textContent).toContain(RICH_TEXT_ACTIONS_LOCALES.he!.popover.unavailable);
        expect(host.querySelector('[dir="rtl"]')).not.toBeNull();
    });
});

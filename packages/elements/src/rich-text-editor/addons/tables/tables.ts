import { html, nothing } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { defineAddon, resolveAddonLocale } from '../../rich-text-addon-kit.js';
import type { RichTextAddonOptions } from '../../rich-text-host.js';
import { registerPopoverButton, triggerButton, type PopoverButtonView } from '../../rich-text-popover-button.js';
import { RICH_TEXT_TABLES_LOCALES, type RichTextTablesLocale } from './tables-locale.js';
import css from './tables.css?inline';

export const TABLES_SLOT_ID = 'tables.insert';
export const TABLES_COMMAND_ID = 'insert.table';
const GRID_SIZE = 8;
const COMMAND_SIZE = 3;
const GRID = Array.from({ length: GRID_SIZE }, (_, index) => index + 1);

const ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M12 3v18"/><path d="M3 12h18"/><rect width="18" height="18" x="3" y="3" rx="2"/></svg>';

export interface RichTextTablesOptions extends RichTextAddonOptions {
    /** A locale id or a full dictionary, instead of the editor's. */
    readonly locale?: string | RichTextTablesLocale;
}

/** The detail of the `table-insert` event. */
export interface RichTextTableInsert {
    readonly rows: number;
    readonly cols: number;
}

/** A header row, `rows - 1` body rows of empty cells, and a paragraph after it to keep typing in. */
export function tableHtml(rows: number, cols: number): string {
    const header = '<th><br></th>'.repeat(cols);
    const body = `<tr>${'<td><br></td>'.repeat(cols)}</tr>`.repeat(Math.max(rows - 1, 0));
    return `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table><p><br></p>`;
}

export const tablesAddon = defineAddon<RichTextTablesOptions>('tables', 330, ({ host, options, life }) => {
    const locale = resolveAddonLocale(RICH_TEXT_TABLES_LOCALES, host, options.locale);
    let hover = { rows: 0, cols: 0 };

    const insert = (rows: number, cols: number): void => {
        if (host.isDisabled || host.readonly) return;
        host.restoreSelection();
        host.insertBlockAtCaret(tableHtml(rows, cols));
        host.emit<RichTextTableInsert>('table-insert', { rows, cols });
    };

    const hoverTo = (rows: number, cols: number): void => {
        hover = { rows, cols };
        button?.update();
    };

    const pick = (view: PopoverButtonView, rows: number, cols: number): void => {
        view.close();
        insert(rows, cols);
    };

    const panel = (view: PopoverButtonView) => {
        const { rows, cols } = hover;
        return html`<div class="rte-tables-panel">
            <div class="rte-tables-grid">
                ${GRID.flatMap((row) => GRID.map((col) => html`<button
                    type="button"
                    class="cell"
                    data-grid-cell
                    ?data-on=${row <= rows && col <= cols}
                    aria-label="${row}x${col}"
                    @mouseenter=${() => hoverTo(row, col)}
                    @click=${() => pick(view, row, col)}
                ></button>`))}
            </div>
            <p class="rte-tables-hint">${rows > 0 && cols > 0 ? `${rows} x ${cols}` : locale.insertTable}</p>
        </div>`;
    };

    const button = options.toolbar
        ? registerPopoverButton(host, life, {
            id: TABLES_SLOT_ID,
            order: options.order,
            css,
            onClose: () => hoverTo(0, 0),
            template: (view) => html`<ge-popover close-on-scroll ${ref(view.popover)} @open-change=${view.onOpenChange}>
                <ge-popover-trigger>${triggerButton(locale.tooltip, view.disabled, ICON)}</ge-popover-trigger>
                <ge-popover-content align="start" strategy="fixed">${view.open ? panel(view) : nothing}</ge-popover-content>
            </ge-popover>`,
        })
        : undefined;

    if (options.slashCommand) {
        life.add(host.commands.registerCommand({
            id: TABLES_COMMAND_ID,
            label: locale.insertTable,
            keywords: ['table', 'grid'],
            order: 130,
            when: ({ disabled, readonly }) => !disabled && !readonly,
            run: () => insert(COMMAND_SIZE, COMMAND_SIZE),
        }));
    }
});

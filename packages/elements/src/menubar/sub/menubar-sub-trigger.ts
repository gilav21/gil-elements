import { unsafeCSS } from 'lit';
import { GeMenuSubTrigger } from '../../shared/menu-parts.js';

/**
 * The row that opens a submenu: hover, tap, Enter or the forward arrow.
 *
 * @cssprop --density-menu - Spacing multiplier for this component; falls back to `--density`.
 */
export class GeMenubarSubTrigger extends GeMenuSubTrigger {
    static override styles = [
        ...GeMenuSubTrigger.styles,
        unsafeCSS(':host{--_d:var(--density-menu,var(--density,1));padding-inline:calc(0.5rem * var(--_d));padding-block:calc(0.375rem * var(--_d))}:host([inset]){padding-inline-start:2rem}'),
    ];
    protected readonly slotName = 'menubar-sub-trigger';
}

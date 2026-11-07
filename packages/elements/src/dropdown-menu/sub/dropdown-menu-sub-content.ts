import { unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { GeMenuSubContent } from '../../shared/menu-parts.js';
import css from './dropdown-menu-sub-content.css?inline';

/** The submenu panel (`role="menu"`) of a dropdown menu. */
export class GeDropdownMenuSubContent extends GeMenuSubContent {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    protected readonly slotName = 'dropdown-menu-sub-content';
}

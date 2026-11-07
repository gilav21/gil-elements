import { unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { GeMenuSubContent } from '../../shared/menu-parts.js';
import css from './menubar-sub-content.css?inline';

/** The submenu panel (`role="menu"`) of a menubar menu. */
export class GeMenubarSubContent extends GeMenuSubContent {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    protected readonly slotName = 'menubar-sub-content';
}

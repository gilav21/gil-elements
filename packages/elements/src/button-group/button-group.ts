import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './button-group.css?inline';

export type ButtonGroupOrientation = 'horizontal' | 'vertical';

/**
 * Joins related buttons into one control: they sit flush, the outer corners stay round and
 * neighbouring borders merge into one.
 *
 * Items take part by reading the `--ge-join-*` custom properties the group sets on them, which
 * `ge-button` and `ge-button-group-text` do. A plain `<button>` is not joined, because a page's own
 * styles on it would win over anything the group could say from inside its shadow root.
 *
 * @slot - `ge-button`s, optionally with `ge-button-group-separator` and `ge-button-group-text`.
 * @attr {'horizontal' | 'vertical'} orientation - Direction of the group. Defaults to horizontal.
 */
export class GeButtonGroup extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = { orientation: { reflect: true } };

    declare orientation: ButtonGroupOrientation;

    constructor() {
        super();
        this.orientation = 'horizontal';
    }

    // The group role lives on an inner node; the host is a layout-less wrapper.
    protected override render() {
        return html`<div class="group" role="group"><slot></slot></div>`;
    }
}

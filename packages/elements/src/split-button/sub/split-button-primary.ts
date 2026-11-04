import { css, html } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import '../../button/define.js';
import { findParent } from '../../shared/compound.js';
import { SPLIT_BUTTON_REGISTER, type SplitButtonHost } from '../split-button.js';

/**
 * The primary half, for custom mode. It takes the variant, size and disabled state of the split button and
 * forwards its click as the split button's `primary-click`. Ignored while the split button has a `label`.
 */
export class GeSplitButtonPrimary extends UiElement {
    static override styles = [UiElement.styles, css`:host { display: contents; }`];
    static override properties = { host: { state: true } };
    declare host: SplitButtonHost | undefined;

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'split-button-primary';
        this.host = findParent<SplitButtonHost, GeSplitButtonPrimary>(this, SPLIT_BUTTON_REGISTER);
        this.host?.watch(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.host?.unwatch(this);
    }

    protected override render() {
        const host = this.host;
        return html`<ge-button
            style="--ge-join-se: 0px; --ge-join-ee: 0px; --ge-join-border-inline-end: 0px"
            variant=${host?.variant ?? 'default'}
            size=${host?.size ?? 'default'}
            ?disabled=${host?.disabled ?? false}
            type="button"
            @click=${(event: MouseEvent) => host?.emitPrimary(event)}
            ><slot></slot
        ></ge-button>`;
    }
}

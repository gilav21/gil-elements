import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { COMMAND_REGISTER, type CommandHost } from '../command.js';
import css from './command-input.css?inline';

/**
 * The search field. Down and Up move the highlight (wrapping), Enter activates it; none of the three move the caret
 * or submit a form. Inside a nested page, Escape and Backspace on an empty field go back one page instead, and the
 * first Escape does not reach a surrounding dialog.
 *
 * @attr {string} placeholder - Defaults to "Search...".
 * @attr {string} aria-label - Accessible name of the field. Defaults to "Search".
 * @attr {string} value - Seed query, applied once when it connects and only when non-empty.
 */
export class GeCommandInput extends UiElement {
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        placeholder: {},
        value: {},
    };

    declare placeholder: string | undefined;
    declare value: string;
    private command?: CommandHost;

    constructor() {
        super();
        this.placeholder = undefined;
        this.value = '';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'command-input';
        this.command = findParent<CommandHost, GeCommandInput>(this, COMMAND_REGISTER);
        this.command?.register(this);
        if (this.value) this.command?.setSearch(this.value);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.command?.unregister(this);
        this.command = undefined;
    }

    private readonly onInput = (event: Event) => {
        const command = this.command;
        if (!command) return;
        command.setSearch((event.target as HTMLInputElement).value);
        command.setActive(command.visibleRows()[0]);
    };

    private readonly onKeydown = (event: KeyboardEvent) => {
        const command = this.command;
        if (!command) return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            command.moveNext();
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            command.movePrev();
        } else if (event.key === 'Enter') {
            event.preventDefault();
            command.selectActive();
        } else if (this.shouldGoBack(event, command)) {
            event.preventDefault();
            event.stopPropagation();
            command.popPage();
        }
    };

    private shouldGoBack(event: KeyboardEvent, command: CommandHost): boolean {
        if (command.currentPage === null) return false;
        return event.key === 'Escape' || (event.key === 'Backspace' && command.query === '');
    }

    protected override render() {
        return html`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
                .value=${this.command?.query ?? ''}
                placeholder=${this.placeholder ?? 'Search...'}
                aria-label=${this.getAttribute('aria-label') ?? 'Search'}
                @input=${this.onInput}
                @keydown=${this.onKeydown}
            />`;
    }
}

/**
 * The toolbar's natural-language filter box (wave 7, package D; Angular html 369-381): a search form with the box and a submit button. The box
 * stays editable and focused while a request runs (Angular disables it, which drops focus): `aria-busy` on the form says it is working, and a
 * new question submitted meanwhile replaces the running one.
 */
import { html, type TemplateResult } from 'lit';
import { chromeIcon } from './data-table-icons.js';
import type { DataTableLocale } from './data-table.locales.js';

export interface NlFilterView {
    readonly locale: DataTableLocale;
    readonly text: string;
    readonly busy: boolean;
    onInput(text: string): void;
    submit(): void;
}

export function renderNlFilter(view: NlFilterView): TemplateResult {
    const { locale } = view;
    const submit = (event: Event): void => {
        event.preventDefault();
        view.submit();
    };
    return html`<form data-slot="table-nl-filter" role="search" aria-label=${locale.nlFilterLabel} aria-busy=${view.busy ? 'true' : 'false'} @submit=${submit}>
        <span aria-hidden="true">✨</span>
        <ge-input aria-label=${locale.nlFilterLabel} placeholder=${locale.nlFilterPlaceholder ?? ''} .value=${view.text}
            @input=${(event: Event) => view.onInput((event.currentTarget as HTMLInputElement).value)}
            @keydown=${(event: KeyboardEvent) => event.key === 'Enter' && !event.isComposing && submit(event)}></ge-input>
        <button type="submit" data-slot="data-table-icon-button" data-size="lg" data-kind="nl-filter-apply" aria-label=${locale.nlFilterApply}>${chromeIcon('chevron-right')}</button>
    </form>`;
}

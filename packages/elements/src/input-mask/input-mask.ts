import { html, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './input-mask.css?inline';

/** What each mask character accepts; every other character is a literal that is kept as typed. */
const DEFINITIONS: Record<string, RegExp | undefined> = {
    '0': /\d/,
    '9': /\d/,
    a: /[a-zA-Z]/,
    '*': /[a-zA-Z0-9]/,
};

/**
 * Formats what is typed into a wrapped `ge-input` (or a native `input`) as it is typed. In the `mask`, `0` and `9` accept
 * a digit, `a` a letter and `*` a letter or digit; any other character is a literal, for example `(999) 999-9999`.
 * Characters that do not fit are dropped, so pasting `555.123.4567` into that mask gives `(555) 123-4567`. The element
 * draws no box of its own.
 *
 * The masked text is the value: `value` of the input, the form value of a `ge-input` and the `detail` of its `input`
 * event are all the formatted text, literals included.
 *
 * @attr {string} mask - The pattern.
 * @attr {string} slot-char - Shown for a slot not yet filled when `show-mask-typed` is on. Defaults to `_`.
 * @attr {boolean} show-mask-typed - Keep the whole mask visible while typing: every unfilled slot shows `slot-char` and every literal stays, so `(000) 000-0000` with `123` typed reads `(123) ___-____`.
 * @slot - A `ge-input` or an `input`.
 */
export class GeInputMask extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        mask: { type: String, reflect: true },
        slotChar: { type: String, attribute: 'slot-char', reflect: true },
        showMaskTyped: { type: Boolean, attribute: 'show-mask-typed', reflect: true },
    };

    declare mask: string;
    declare slotChar: string;
    declare showMaskTyped: boolean;
    private target: HTMLInputElement | null = null;

    constructor() {
        super();
        this.mask = '';
        this.slotChar = '_';
        this.showMaskTyped = false;
    }

    protected override render() {
        return html`<slot @slotchange=${this.attach}></slot>`;
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('mask') || changed.has('slotChar') || changed.has('showMaskTyped')) void this.attach();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.target?.removeEventListener('input', this.format);
        this.target = null;
    }

    private async attach(): Promise<void> {
        const host = this.querySelector('ge-input, input');
        const field = host instanceof HTMLInputElement ? host : await this.innerOf(host);
        this.target?.removeEventListener('input', this.format);
        this.target = field;
        field?.addEventListener('input', this.format);
        if (field?.value) this.format();
    }

    private async innerOf(host: Element | null): Promise<HTMLInputElement | null> {
        if (!host) return null;
        await (host as Element & { updateComplete?: Promise<unknown> }).updateComplete;
        return (host as Element & { inner?: HTMLInputElement }).inner ?? null;
    }

    private readonly format = (): void => {
        const field = this.target;
        if (!field) return;
        const typed = field.value;
        const caret = field.selectionStart ?? 0;
        const masked = this.apply(this.unmask(typed));
        if (masked === typed) return;
        field.value = masked;
        const owner = field.getRootNode() instanceof ShadowRoot ? (field.getRootNode() as ShadowRoot).host : null;
        if (owner && 'value' in owner) (owner as Element & { value: string }).value = masked;
        const at = this.caretAfter(caret, typed, masked);
        field.setSelectionRange(at, at);
    };

    private literals(): Set<string> {
        return new Set([...this.mask].filter((char) => !DEFINITIONS[char]));
    }

    private unmask(value: string): string {
        const literals = this.literals();
        return [...value].filter((char) => !literals.has(char)).join('');
    }

    private apply(raw: string): string {
        const fillsEmpty = this.showMaskTyped && this.slotChar !== '';
        let masked = '';
        let rawIndex = 0;
        let maskIndex = 0;
        while (maskIndex < this.mask.length) {
            const maskChar = this.mask[maskIndex]!;
            const accepts = DEFINITIONS[maskChar];
            if (!accepts) {
                masked += maskChar;
                maskIndex++;
            } else if (rawIndex >= raw.length) {
                if (!fillsEmpty) break;
                masked += this.slotChar;
                maskIndex++;
            } else if (accepts.test(raw[rawIndex]!)) {
                masked += raw[rawIndex];
                rawIndex++;
                maskIndex++;
            } else {
                rawIndex++;
            }
        }
        return masked;
    }

    /**
     * Keeps the caret after the same number of typed (non-literal) characters it followed before the reformat, and on
     * the next one when literals follow. (The Angular directive keeps the old index whenever the text got shorter, which
     * puts the caret before a character typed next to a literal.)
     */
    private caretAfter(caret: number, typed: string, masked: string): number {
        if (caret >= typed.length) return masked.length;
        const literals = this.literals();
        const before = [...typed.slice(0, caret)].filter((char) => !literals.has(char)).length;
        let seen = 0;
        for (let i = 0; i < masked.length; i++) {
            if (!literals.has(masked[i]!)) seen++;
            if (seen > before) return i;
        }
        return masked.length;
    }
}

// shadcn-angular field.component.ts and sub/*: the class strings, copied.
import { refPlain } from './input.mjs';
const LABEL = 'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70';
const GROUP = 'grid gap-4';
const SET = 'grid gap-4 border-none p-0';
const LEGEND = 'text-sm font-medium leading-none';
const SEP = 'my-4 border-t border-border';

// cn() is tailwind-merge: horizontal's flex and gap-3 replace the grid and gap-2.
const field = (orientation, inner) => `<ui-field class="contents"><div class="${orientation === 'horizontal' ? 'flex items-center gap-3' : 'grid gap-2'}" data-slot="field" data-orientation="${orientation}">${inner}</div></ui-field>`;
const label = (text, target) => `<ui-field-label class="contents"><label class="${LABEL}" data-slot="field-label" for="${target}">${text}</label></ui-field-label>`;
const desc = (text) => `<ui-field-description class="contents"><p class="text-sm text-muted-foreground" data-slot="field-description">${text}</p></ui-field-description>`;
const error = (text) => `<ui-field-error class="contents"><p class="text-sm text-destructive" data-slot="field-error" role="alert" aria-live="polite">${text}</p></ui-field-error>`;
const text = (value) => refPlain('outline', { placeholder: 'you@example.com', value });

const elField = (orientation, inner) => `<ge-field${orientation === 'horizontal' ? ' orientation="horizontal"' : ''}>${inner}</ge-field>`;
const elLabel = (t, target) => `<ge-field-label for="${target}">${t}</ge-field-label>`;
const elInput = (value) => `<ge-input id="e" placeholder="you@example.com"${value ? ` value="${value}"` : ''}></ge-input>`;

const W = 'width:22rem;';
const vertical = (value) => ({
    ref: field('vertical', label('Email', 'e') + text(value) + desc("We'll never share your email.")),
    el: elField('vertical', elLabel('Email', 'e') + elInput(value) + "<ge-field-description>We'll never share your email.</ge-field-description>"),
});
const horizontal = {
    ref: field('horizontal', label('Subscribe', 'e') + text()),
    el: elField('horizontal', elLabel('Subscribe', 'e') + elInput()),
};
const group = {
    ref: `<ui-field-group class="contents"><div class="${GROUP}" data-slot="field-group">${field('vertical', label('Email', 'e') + text())}${field('vertical', label('Name', 'n') + text('Ada'))}</div></ui-field-group>`,
    el: `<ge-field-group>${elField('vertical', elLabel('Email', 'e') + elInput())}${elField('vertical', elLabel('Name', 'n') + elInput('Ada'))}</ge-field-group>`,
};
const set = {
    ref: `<ui-field-set class="contents"><fieldset class="${SET}" data-slot="field-set"><ui-field-legend class="contents"><legend class="${LEGEND}" data-slot="field-legend">Contact</legend></ui-field-legend>${field('vertical', label('Email', 'e') + text())}<ui-field-separator class="contents"><hr class="${SEP}" data-slot="field-separator"></ui-field-separator>${field('vertical', label('Name', 'n') + text('Ada'))}</fieldset></ui-field-set>`,
    el: `<ge-field-set><ge-field-legend>Contact</ge-field-legend>${elField('vertical', elLabel('Email', 'e') + elInput())}<ge-field-separator></ge-field-separator>${elField('vertical', elLabel('Name', 'n') + elInput('Ada'))}</ge-field-set>`,
};
export default {
    name: 'field',
    items: [
        { id: 'vertical', wrap: W, ...vertical() },
        { id: 'with-error', wrap: W, ref: field('vertical', label('Email', 'e') + text('nope') + error('Enter a valid email address.')), el: elField('vertical', elLabel('Email', 'e') + elInput('nope') + '<ge-field-error>Enter a valid email address.</ge-field-error>') },
        { id: 'description-and-error', wrap: W, ref: field('vertical', label('Email', 'e') + text('nope') + desc("We'll never share your email.") + error('Enter a valid email address.')), el: elField('vertical', elLabel('Email', 'e') + elInput('nope') + "<ge-field-description>We'll never share your email.</ge-field-description><ge-field-error>Enter a valid email address.</ge-field-error>") },
        { id: 'horizontal', wrap: W, ...horizontal },
        { id: 'group', wrap: W, ...group },
        { id: 'set-with-legend-and-separator', wrap: W, ...set },
        { id: 'rtl', wrap: W, ref: `<div dir="rtl">${vertical().ref}</div>`, el: `<div dir="rtl">${vertical().el}</div>` },
    ],
};

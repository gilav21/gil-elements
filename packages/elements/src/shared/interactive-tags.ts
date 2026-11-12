/**
 * The library's own interactive controls: elements a user presses to DO something (type, pick, toggle, drag). Most are form-associated and draw their
 * control in a shadow root, so a press on them is retargeted to the host and no `input` / `button` selector can see it. A press on one of these inside a
 * data-table cell belongs to the control (it keeps its focus and its click); anything that is not here and not a native control is a cell press.
 * ONE place: a new interactive control is added here (the node test fails for every form-associated element missing from it).
 * Not the activator's `INTERACTIVE` (shared/activator.ts): that decides what can already trigger a popover (so it includes `[tabindex]`); this decides what owns a press in a
 * data-table cell (`[tabindex]` is excluded: a component cell sets it for keyboard reasons). Different questions, so the lists are not merged.
 */
export const INTERACTIVE_TAGS: readonly string[] = Object.freeze([
    // form-associated controls
    'autocomplete', 'button', 'checkbox', 'chip-list', 'color-picker', 'currency-input', 'date-picker', 'date-range-picker', 'duration-input', 'input',
    'input-group-input', 'input-otp', 'native-select', 'number-input', 'phone-input', 'radio-group', 'rating', 'rich-text-editor', 'select',
    'signature-pad', 'slider', 'switch', 'textarea', 'time-picker', 'tree-select',
    // other controls
    'copy-to', 'emoji-picker', 'eyedropper', 'file-upload', 'input-mask', 'radio-group-item', 'split-button', 'toggle', 'toggle-group', 'toggle-group-item',
].map((name) => `ge-${name}`));

/** ARIA widget roles that mark an interactive control made of plain elements (a press on one is the widget's own). */
export const INTERACTIVE_ROLES: readonly string[] = Object.freeze([
    'switch', 'checkbox', 'radio', 'combobox', 'slider', 'spinbutton', 'tab', 'menuitem', 'option', 'textbox', 'listbox', 'searchbox', 'button', 'link',
]);

/** The native controls (and what the browser itself makes pressable) whose press is the element's own; a `summary` toggles its `details`. (Not `label`: a styling wrapper is a cell press, and an input inside a label is a control by itself.) */
export const NATIVE_CONTROLS: readonly string[] = Object.freeze([
    'input', 'textarea', 'select', 'button', 'a[href]', 'summary', 'video[controls]', 'audio[controls]',
]);

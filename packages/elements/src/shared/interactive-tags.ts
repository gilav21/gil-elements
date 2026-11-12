/** Controls whose job is to hold or pick a VALUE (typing, sliding, choosing): their own gesture, a drag or a long press, must not be taken for a column drag. */
const VALUE_TAG_NAMES = [
    'autocomplete', 'checkbox', 'chip-list', 'color-picker', 'currency-input', 'date-picker', 'date-range-picker', 'duration-input', 'input', 'input-group-input', 'input-mask',
    'input-otp', 'native-select', 'number-input', 'phone-input', 'radio-group', 'radio-group-item', 'rating', 'rich-text-editor', 'select', 'signature-pad', 'slider', 'switch',
    'textarea', 'time-picker', 'tree-select',
];

/** Controls that are pressed to DO something (a click): a header may still be dragged from them, so a column drag does not count them. */
const ACTION_TAG_NAMES = ['button', 'copy-to', 'emoji-picker', 'eyedropper', 'file-upload', 'split-button', 'toggle', 'toggle-group', 'toggle-group-item'];

/**
 * The library's own interactive controls: elements a user presses to DO something (type, pick, toggle, drag). Most are form-associated and draw their
 * control in a shadow root, so a press on them is retargeted to the host and no `input` / `button` selector can see it. A press on one of these inside a
 * data-table cell belongs to the control (it keeps its focus and its click); anything that is not here and not a native control is a cell press.
 * ONE place: a new interactive control is added here (the node test fails for every form-associated element missing from it).
 * Not the activator's `INTERACTIVE` (shared/activator.ts): that decides what can already trigger a popover (so it includes `[tabindex]`); this decides what owns a press in a
 * data-table cell (`[tabindex]` is excluded: a component cell sets it for keyboard reasons). Different questions, so the lists are not merged.
 */
export const INTERACTIVE_TAGS: readonly string[] = Object.freeze([...VALUE_TAG_NAMES, ...ACTION_TAG_NAMES].map((name) => `ge-${name}`));
const VALUE_TAGS: readonly string[] = VALUE_TAG_NAMES.map((name) => `ge-${name}`);

/** ARIA widget roles that mark an interactive control made of plain elements (a press on one is the widget's own). */
export const INTERACTIVE_ROLES: readonly string[] = Object.freeze([
    'switch', 'checkbox', 'radio', 'combobox', 'slider', 'spinbutton', 'tab', 'menuitem', 'option', 'textbox', 'listbox', 'searchbox', 'button', 'link',
]);

/** The native controls (and what the browser itself makes pressable) whose press is the element's own; a `summary` toggles its `details`. (Not `label`: a styling wrapper is a cell press, and an input inside a label is a control by itself.) */
export const NATIVE_CONTROLS: readonly string[] = Object.freeze([
    'input', 'textarea', 'select', 'button', 'a[href]', 'summary', 'video[controls]', 'audio[controls]',
]);

/**
 * The selector of what owns its own press: native controls, the library's controls (`INTERACTIVE_TAGS`), a checkbox role, an editable region and the explicit
 * `data-table-keeps-focus` opt-out. ONE place for the data-table's cell press and its column drag (a header press on a control must not start a drag).
 */
export const CONTROLS_SELECTOR = `${NATIVE_CONTROLS.join(', ')}, [role="checkbox"], ${INTERACTIVE_TAGS.join(', ')}, [contenteditable]:not([contenteditable="false"]), [data-table-keeps-focus]`;

/** The ARIA widget roles as one selector (`INTERACTIVE_ROLES`). */
export const ROLES_SELECTOR = INTERACTIVE_ROLES.map((role) => `[role="${role}"]`).join(', ');

/**
 * The VALUE controls only (no buttons, links or button-like roles): what a press must leave alone when the press could start a COLUMN DRAG. A click on a header's
 * sort button stays a click and the header stays draggable from its title (as on main); an input, a slider or a select owns its own drag and long press.
 */
export const VALUE_CONTROLS_SELECTOR = [
    'input', 'textarea', 'select', '[contenteditable]:not([contenteditable="false"])', '[data-table-keeps-focus]',
    '[role="checkbox"]', '[role="slider"]', '[role="spinbutton"]', '[role="textbox"]', '[role="searchbox"]', '[role="combobox"]', '[role="listbox"]',
    ...VALUE_TAGS,
].join(', ');

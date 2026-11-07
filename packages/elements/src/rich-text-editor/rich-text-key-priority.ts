/**
 * Where every keydown handler sits in the editor's chain; the lowest number runs first and the first
 * handler to return true ends the chain. The order is the original editor's: addon interceptors, shortcut
 * bindings, undo/redo, Backspace reverting a Markdown rule, caret confinement and task-row keys, table
 * deletion, Tab, then the Enter rules from the most specific block to the most general.
 *
 * Slots whose controller does not exist yet are reserved here so the numbers never move.
 */
export const KEY_PRIORITY = Object.freeze({
    /** Addon keydown interceptors. */
    interceptor: -1000,
    /** Shortcut bindings (reserved: shortcuts controller). */
    shortcuts: -500,
    /** Ctrl/Cmd+Z, Ctrl+Y, Ctrl+Shift+Z. */
    undoRedo: 10,
    /** Backspace reverting the last Markdown input rule (reserved: markdown-shortcuts controller). */
    revertInputRule: 100,
    /** Keeps a caret in a task row inside the row's text; never consumes the key. */
    confineCaret: 200,
    /** Backspace / Delete joining list rows. */
    joinTaskRows: 210,
    /** ArrowUp / ArrowDown out of a task row. */
    verticalArrow: 220,
    /** Delete / Backspace across a table boundary (reserved: tables controller). */
    tableDelete: 300,
    /** Tab and Shift+Tab: list nesting, a literal tab elsewhere. */
    tab: 400,
    /** Enter completing a ``` fence (reserved: markdown-shortcuts controller). */
    enterCodeFence: 500,
    enterTaskList: 510,
    enterSummary: 520,
    enterDetailsEnd: 530,
    enterBlockquote: 540,
    enterLeavingList: 550,
    enterInlineCode: 560,
    enterCodeBlock: 570,
});

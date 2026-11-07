import type { LocaleMeta } from '../shared/calendar-locales.js';

export interface RichTextLocale extends LocaleMeta {
    toolbar: {
        bold: string;
        italic: string;
        underline: string;
        strikethrough: string;
        textStyle: string;
        paragraph: string;
        heading1: string;
        heading2: string;
        heading3: string;
        bulletList: string;
        orderedList: string;
        blockquote: string;
        inlineCode: string;
        codeBlock: string;
        undo: string;
        redo: string;
        clearFormatting: string;
        alignLeft: string;
        alignCenter: string;
        alignRight: string;
        indent: string;
        outdent: string;
        taskList: string;
        horizontalRule: string;
        /** Tooltip of the toolbar button that opens find & replace. */
        find: string;
    };
    findReplace: {
        find: string;
        findPlaceholder: string;
        replace: string;
        replacePlaceholder: string;
        replaceAll: string;
        caseSensitive: string;
        noResults: string;
        close: string;
        wholeWord: string;
        useRegex: string;
        /** Shown in the counter when the pattern cannot be compiled. */
        invalidRegex: string;
        /** Match counter; interpolates `{current}` and `{total}`. */
        matchCounter: string;
        previous: string;
        next: string;
    };
    table: {
        rows: string;
        columns: string;
        insert: string;
        addRowAbove: string;
        addRowBelow: string;
        addColumnLeft: string;
        addColumnRight: string;
        deleteRow: string;
        deleteColumn: string;
        deleteTable: string;
        mergeCells: string;
        splitCell: string;
        toggleHeaderRow: string;
        /** Interpolates `{rows}` and `{cols}`. */
        gridLabel: string;
        borders: string;
        bordersAll: string;
        bordersNone: string;
        bordersOuter: string;
        bordersHorizontal: string;
        cellColor: string;
        cellAlignLeft: string;
        cellAlignCenter: string;
        cellAlignRight: string;
    };
    editor: {
        placeholder: string;
        ariaLabel: string;
        /** Interpolates `{count}`. */
        characters: string;
        /** Interpolates `{count}`. */
        words: string;
        formattingOptions: string;
        /** Caption on an image whose host the resource policy refused. */
        blockedImage: string;
    };
}

const en: RichTextLocale = {
    code: 'en',
    toolbar: {
        bold: 'Bold',
        italic: 'Italic',
        underline: 'Underline',
        strikethrough: 'Strikethrough',
        textStyle: 'Text style',
        paragraph: 'Normal Text',
        heading1: 'Heading 1',
        heading2: 'Heading 2',
        heading3: 'Heading 3',
        bulletList: 'Bullet List',
        orderedList: 'Numbered List',
        blockquote: 'Blockquote',
        inlineCode: 'Inline Code',
        codeBlock: 'Code Block',
        undo: 'Undo',
        redo: 'Redo',
        clearFormatting: 'Clear Formatting',
        alignLeft: 'Align Left',
        alignCenter: 'Align Center',
        alignRight: 'Align Right',
        indent: 'Increase Indent',
        outdent: 'Decrease Indent',
        taskList: 'Task List',
        horizontalRule: 'Horizontal Rule',
        find: 'Find and replace',
    },
    findReplace: {
        find: 'Find',
        findPlaceholder: 'Search text...',
        replace: 'Replace',
        replacePlaceholder: 'Replace with...',
        replaceAll: 'Replace All',
        caseSensitive: 'Match Case',
        noResults: 'No results',
        close: 'Close',
        wholeWord: 'Whole word',
        useRegex: 'Regular expression',
        invalidRegex: 'Invalid expression',
        matchCounter: '{current} of {total}',
        previous: 'Previous match',
        next: 'Next match',
    },
    table: {
        rows: 'Rows',
        columns: 'Columns',
        insert: 'Insert Table',
        addRowAbove: 'Insert Row Above',
        addRowBelow: 'Insert Row Below',
        addColumnLeft: 'Insert Column Left',
        addColumnRight: 'Insert Column Right',
        deleteRow: 'Delete Row',
        deleteColumn: 'Delete Column',
        deleteTable: 'Delete Table',
        mergeCells: 'Merge Cells',
        splitCell: 'Split Cell',
        toggleHeaderRow: 'Toggle Header Row',
        gridLabel: '{rows} x {cols} table',
        borders: 'Borders',
        bordersAll: 'All Borders',
        bordersNone: 'No Borders',
        bordersOuter: 'Outside Borders',
        bordersHorizontal: 'Horizontal Lines',
        cellColor: 'Cell Color',
        cellAlignLeft: 'Align Left',
        cellAlignCenter: 'Align Center',
        cellAlignRight: 'Align Right',
    },
    editor: {
        placeholder: 'Write something...',
        ariaLabel: 'Rich text editor',
        characters: '{count} characters',
        words: '{count} words',
        formattingOptions: 'Formatting options',
        blockedImage: 'Image blocked by security policy',
    },
};

/** Built-in dictionaries by language id. English is the only one so far; register the others here. */
export const RICH_TEXT_LOCALES: Record<string, RichTextLocale | undefined> & { en: RichTextLocale } = { en };

/** An object is used as it is; an id is looked up; anything else follows the page's `lang`, then English. */
export function resolveRichTextLocale(input?: string | RichTextLocale | null): RichTextLocale {
    if (input && typeof input === 'object') return input;
    const page = typeof document === 'undefined' ? '' : (document.documentElement.lang.split('-')[0] ?? '').toLowerCase();
    return (input ? RICH_TEXT_LOCALES[input] : undefined) ?? RICH_TEXT_LOCALES[page] ?? RICH_TEXT_LOCALES.en;
}

/** Fills `{name}` placeholders and leaves unknown ones as written. */
export function interpolate(template: string, values: Record<string, string | number>): string {
    return template.replaceAll(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match));
}

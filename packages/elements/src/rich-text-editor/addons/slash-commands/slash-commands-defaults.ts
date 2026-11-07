import type { RichTextSlashCommand } from '../../rich-text-command-registry.js';
import type { SlashCommandsLocale } from './slash-commands-locale.js';

export interface SlashHistory {
    undo(): void;
    redo(): void;
}

/** A command that forwards to a toolbar command. */
function toolbar(id: string, label: string, description: string, keywords: string[], order: number, command: string): RichTextSlashCommand {
    return { id, label, description, keywords, order, run: (context) => context.executeToolbarCommand(command) };
}

/** The built-in commands: block formats, lists, inserts, and history through the host. */
export function buildDefaultSlashCommands(l: SlashCommandsLocale, history: SlashHistory): RichTextSlashCommand[] {
    return [
        toolbar('format.paragraph', l.paragraph, l.paragraphDescription, ['text', 'normal'], 10, 'paragraph'),
        toolbar('format.heading-1', l.heading1, l.heading1Description, ['h1', 'title'], 20, 'heading1'),
        toolbar('format.heading-2', l.heading2, l.heading2Description, ['h2', 'subtitle'], 30, 'heading2'),
        toolbar('format.heading-3', l.heading3, l.heading3Description, ['h3'], 40, 'heading3'),
        toolbar('format.bullet-list', l.bulletList, l.bulletListDescription, ['list', 'ul', 'bl'], 50, 'bulletList'),
        toolbar('format.numbered-list', l.numberedList, l.numberedListDescription, ['list', 'ol', 'nl'], 60, 'orderedList'),
        toolbar('format.quote', l.blockQuote, l.blockQuoteDescription, ['blockquote', 'quote'], 70, 'blockquote'),
        toolbar('format.inline-code', l.inlineCode, l.inlineCodeDescription, ['code'], 80, 'code'),
        toolbar('format.code-block', l.codeBlock, l.codeBlockDescription, ['pre', 'snippet'], 90, 'codeBlock'),
        toolbar('insert.task-list', l.taskList, l.taskListDescription, ['checkbox', 'todo', 'task', 'checklist'], 65, 'taskList'),
        toolbar('insert.toggle', l.toggle, l.toggleDescription, ['details', 'summary', 'collapse', 'expand', 'accordion'], 75, 'toggle'),
        toolbar('insert.horizontal-rule', l.horizontalRule, l.horizontalRuleDescription, ['hr', 'divider', 'line', 'separator'], 95, 'horizontalRule'),
        { id: 'history.undo', label: l.undo, description: l.undoDescription, keywords: ['ctrl+z', 'revert'], order: 110, run: () => history.undo() },
        { id: 'history.redo', label: l.redo, description: l.redoDescription, keywords: ['ctrl+y', 'ctrl+shift+z'], order: 120, run: () => history.redo() },
    ];
}

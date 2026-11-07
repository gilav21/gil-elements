import { describe, expect, it, vi } from 'vitest';
import type { RichTextSlashCommandContext } from '../../rich-text-command-registry.js';
import { buildDefaultSlashCommands } from './slash-commands-defaults.js';
import { slashCommandsLocales } from './slash-commands-locale.js';

const EN = slashCommandsLocales.en;
const HE = slashCommandsLocales['he']!;

/** id to the toolbar command each built-in slash command forwards to. */
const TOOLBAR_BY_ID: Record<string, string> = {
    'format.paragraph': 'paragraph',
    'format.heading-1': 'heading1',
    'format.heading-2': 'heading2',
    'format.heading-3': 'heading3',
    'format.bullet-list': 'bulletList',
    'format.numbered-list': 'orderedList',
    'format.quote': 'blockquote',
    'format.inline-code': 'code',
    'format.code-block': 'codeBlock',
    'insert.task-list': 'taskList',
    'insert.toggle': 'toggle',
    'insert.horizontal-rule': 'horizontalRule',
};

const history = () => ({ undo: vi.fn(), redo: vi.fn() });

function stubContext() {
    const executeToolbarCommand = vi.fn<(command: string) => void>();
    const context: RichTextSlashCommandContext = {
        query: '',
        selectedText: '',
        executeToolbarCommand,
        insertText: vi.fn(),
        insertHtml: vi.fn(),
        showLinkDialog: vi.fn(),
        focusEditor: vi.fn(),
    };
    return { context, executeToolbarCommand };
}

describe('buildDefaultSlashCommands', () => {
    it('builds every built-in command exactly once with unique ids', () => {
        const commands = buildDefaultSlashCommands(EN, history());
        const ids = commands.map((command) => command.id);
        expect(commands).toHaveLength(Object.keys(TOOLBAR_BY_ID).length + 2);
        expect(new Set(ids).size).toBe(ids.length);
        expect([...ids].sort()).toEqual([...Object.keys(TOOLBAR_BY_ID), 'history.undo', 'history.redo'].sort());
    });

    it('localizes labels when handed a different locale', () => {
        const byId = new Map(buildDefaultSlashCommands(EN, history()).map((command) => [command.id, command]));
        expect(byId.get('format.paragraph')?.label).toBe(EN.paragraph);
        expect(byId.get('format.heading-1')?.label).toBe(EN.heading1);
        expect(byId.get('format.code-block')?.description).toBe(EN.codeBlockDescription);
        expect(byId.get('history.redo')?.label).toBe(EN.redo);

        const paragraph = buildDefaultSlashCommands(HE, history()).find((command) => command.id === 'format.paragraph');
        expect(paragraph?.label).toBe(HE.paragraph);
        expect(paragraph?.description).toBe(HE.paragraphDescription);
    });

    it('runs each command against the toolbar command it maps to', () => {
        for (const command of buildDefaultSlashCommands(EN, history()).filter((entry) => entry.id in TOOLBAR_BY_ID)) {
            const { context, executeToolbarCommand } = stubContext();
            void command.run(context);
            expect(executeToolbarCommand).toHaveBeenCalledExactlyOnceWith(TOOLBAR_BY_ID[command.id]);
        }
    });

    it('runs undo and redo through the host history, not a toolbar command', () => {
        const stack = history();
        const { context, executeToolbarCommand } = stubContext();
        const [undo, redo] = ['history.undo', 'history.redo'].map((id) => buildDefaultSlashCommands(EN, stack).find((command) => command.id === id)!);
        void undo!.run(context);
        void redo!.run(context);
        expect(stack.undo).toHaveBeenCalledTimes(1);
        expect(stack.redo).toHaveBeenCalledTimes(1);
        expect(executeToolbarCommand).not.toHaveBeenCalled();
    });

    it('orders paragraph before headings before history in the built list', () => {
        const commands = buildDefaultSlashCommands(EN, history());
        const orderOf = (id: string): number => commands.find((command) => command.id === id)?.order ?? 0;
        expect(orderOf('format.paragraph')).toBeLessThan(orderOf('format.heading-1'));
        expect(orderOf('format.heading-1')).toBeLessThan(orderOf('history.undo'));
        expect(orderOf('history.undo')).toBeLessThan(orderOf('history.redo'));
    });
});

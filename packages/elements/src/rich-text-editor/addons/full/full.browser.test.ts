import { describe, expect, it } from 'vitest';
import { editorIn } from '../../rich-text-editor.fixture.test.js';
import type { GeRichTextEditor } from '../../rich-text-editor.js';
import { aiAddon } from '../ai/ai.js';
import { linksAddon } from '../links/links.js';
import './define.js';
import { RICH_TEXT_FULL_ADDONS } from './index.js';

const IDS = ['actions', 'ai', 'colors', 'emoji', 'file-import', 'history', 'images', 'links', 'mentions', 'outline', 'slash-commands', 'tables', 'typography'];
const SLOTS: ReadonlyArray<readonly [string, number]> = [
    ['typography.size', 310],
    ['typography.family', 311],
    ['colors.foreground', 300],
    ['colors.background', 301],
    ['links.insert', 320],
    ['images.insert', 325],
    ['tables.insert', 330],
    ['file-import.import', 340],
    ['emoji.insert', 400],
    ['view.outline', 900],
];

const fullEditor = (options?: Record<string, unknown>) =>
    editorIn('<ge-rich-text-editor mode="html" addons="full"></ge-rich-text-editor>').then((editor) => {
        if (options) editor.addonOptions = options;
        return editor;
    });
const slotsOf = (editor: GeRichTextEditor) => editor.toolbarSlots.slots.map((slot) => [slot.id, slot.order]);
const overlaysOf = (editor: GeRichTextEditor) => editor.overlays.slots.map((overlay) => overlay.id);

describe('the full addon bundle', () => {
    it('lists every addon id', () => {
        expect([...RICH_TEXT_FULL_ADDONS].sort()).toEqual(IDS);
    });

    it('turns every addon on with addons="full" and no options', async () => {
        const editor = await fullEditor();
        expect(slotsOf(editor)).toEqual(expect.arrayContaining(SLOTS.map((slot) => [...slot])));
        expect(slotsOf(editor)).toHaveLength(SLOTS.length);
        expect(overlaysOf(editor)).toEqual(expect.arrayContaining(['history', 'links', 'images.insert', 'file-import.import', 'outline']));
        expect(editor.commands.listCommands().map((command) => command.id)).toEqual(expect.arrayContaining(['insert.table', 'insert.link', 'view.outline']));
    });

    it('contributes no toolbar button for history (corner panel), ai (needs a provider), mentions or actions (need configuration)', async () => {
        const editor = await fullEditor();
        const ids = editor.toolbarSlots.slots.map((slot) => slot.id);
        expect(ids.filter((id) => /^(ai|history|mentions|actions)/.test(id))).toEqual([]);
        expect(editor.shadowRoot!.querySelector('[data-slot="rte-history-panel"]')).not.toBeNull();
    });

    it('keeps each addon\'s options under its own id', async () => {
        const editor = await fullEditor({
            typography: { order: 5 },
            ai: { provider: () => 'reply' },
            actions: { definitions: [{ id: 'go', label: 'Go', triggers: ['click'] }] },
        });
        expect(slotsOf(editor)).toContainEqual(['typography.size', 5]);
        expect(editor.commands.listCommands().map((command) => command.id)).toEqual(expect.arrayContaining(['insert.ai']));
        expect(editor.toolbarSlots.slots.map((slot) => slot.id)).toContain('actions.attach');
    });

    it('switches one addon off with false and leaves the rest', async () => {
        const editor = await fullEditor({ colors: false, tables: false });
        const ids = editor.toolbarSlots.slots.map((slot) => slot.id);
        expect(ids).not.toContain('colors.foreground');
        expect(ids).not.toContain('tables.insert');
        expect(ids).toContain('links.insert');
    });

    it('applies a changed options map to the addons it holds', async () => {
        const editor = await fullEditor({ colors: false });
        editor.addonOptions = {};
        await editor.updateComplete;
        expect(editor.toolbarSlots.slots.map((slot) => slot.id)).toContain('colors.foreground');
    });

    describe('naming an addon more than once', () => {
        const mount = (attributes: string) => editorIn(`<ge-rich-text-editor mode="html" ${attributes}></ge-rich-text-editor>`);
        const linkSlots = (editor: GeRichTextEditor) => editor.toolbarSlots.slots.filter((slot) => slot.id === 'links.insert');

        it('sets an addon up once however often its id is listed', async () => {
            expect(linkSlots(await mount('addons="links links, links"'))).toHaveLength(1);
        });

        it('sets an addon up once when use() is given it twice', async () => {
            const editor = await mount('');
            editor.use(linksAddon);
            editor.use(linksAddon);
            expect(linkSlots(editor)).toHaveLength(1);
        });

        it('does not set an addon up again on its own when full already covers it', async () => {
            const editor = await mount('addons="full links"');
            expect(linkSlots(editor)).toHaveLength(1);
            expect(slotsOf(editor)).toHaveLength(SLOTS.length);
        });

        it('sets up a standalone addon that is already running when full arrives later', async () => {
            const editor = await mount('addons="links"');
            editor.addons = 'links full';
            await editor.updateComplete;
            expect(linkSlots(editor)).toHaveLength(1);
            expect(slotsOf(editor)).toHaveLength(SLOTS.length);
        });

        it('keeps the options given to use() when the same id is also listed', async () => {
            const editor = await mount('addons="links"');
            editor.use(linksAddon, { toolbar: false });
            expect(linkSlots(editor)).toHaveLength(0);
        });

        it('hands a bundle the options given to use() for an addon it covers', async () => {
            const editor = await mount('addons="full"');
            editor.use(aiAddon, { provider: () => 'reply' });
            expect(editor.commands.listCommands().map((command) => command.id)).toContain('insert.ai');
        });

        it('keeps a listed addon when full itself is switched off', async () => {
            const editor = await mount('addons="full links"');
            editor.addonOptions = { full: false };
            await editor.updateComplete;
            expect(slotsOf(editor)).toEqual([['links.insert', 320]]);
        });
    });

    it('tears every addon down when the editor is removed', async () => {
        const editor = await fullEditor();
        editor.remove();
        expect(editor.toolbarSlots.slots).toHaveLength(0);
        expect(editor.overlays.slots).toHaveLength(0);
    });

    it('tears every addon down when addons is cleared', async () => {
        const editor = await fullEditor();
        editor.addons = '';
        await editor.updateComplete;
        expect(editor.toolbarSlots.slots).toHaveLength(0);
        expect(editor.overlays.slots).toHaveLength(0);
    });
});

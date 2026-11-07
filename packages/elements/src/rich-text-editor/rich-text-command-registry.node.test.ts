import { beforeEach, describe, expect, it, vi } from 'vitest';
import { globalRichTextCommands, RichTextCommandRegistry, type RichTextSlashCommand } from './rich-text-command-registry.js';

const makeCommand = (id: string, overrides: Partial<RichTextSlashCommand> = {}): RichTextSlashCommand => ({
    id,
    label: id,
    run: () => undefined,
    ...overrides,
});

describe('RichTextCommandRegistry', () => {
    let registry: RichTextCommandRegistry;

    beforeEach(() => {
        registry = new RichTextCommandRegistry();
    });

    it('registers a command and lists it', () => {
        registry.registerCommand(makeCommand('insert.date'));
        const commands = registry.listCommands();
        expect(commands).toHaveLength(1);
        expect(commands[0]?.id).toBe('insert.date');
    });

    it('replaces a command registered under the same id', () => {
        registry.registerCommand(makeCommand('dup', { label: 'first' }));
        registry.registerCommand(makeCommand('dup', { label: 'second' }));
        const commands = registry.listCommands();
        expect(commands).toHaveLength(1);
        expect(commands[0]?.label).toBe('second');
    });

    it('returns a teardown from registerCommand that removes it', () => {
        const off = registry.registerCommand(makeCommand('temp'));
        expect(registry.listCommands()).toHaveLength(1);
        off();
        expect(registry.listCommands()).toHaveLength(0);
    });

    it('registers several commands at once and tears them all down', () => {
        const off = registry.registerCommands([makeCommand('a'), makeCommand('b'), makeCommand('c')]);
        expect(registry.listCommands()).toHaveLength(3);
        off();
        expect(registry.listCommands()).toHaveLength(0);
    });

    it('unregisterCommand removes a known id and no-ops for an unknown id', () => {
        registry.registerCommand(makeCommand('known'));
        registry.unregisterCommand('unknown');
        expect(registry.listCommands()).toHaveLength(1);
        registry.unregisterCommand('known');
        expect(registry.listCommands()).toHaveLength(0);
    });

    it('clear empties the registry and is a no-op when already empty', () => {
        expect(() => registry.clear()).not.toThrow();
        registry.registerCommand(makeCommand('x'));
        registry.registerCommand(makeCommand('y'));
        registry.clear();
        expect(registry.listCommands()).toHaveLength(0);
    });

    it('preserves the run/when metadata of a registered command', () => {
        let ran = 0;
        registry.registerCommand(makeCommand('meta', {
            keywords: ['k'],
            when: () => true,
            run: () => { ran += 1; },
        }));
        const stored = registry.listCommands()[0];
        stored?.run({
            query: '',
            selectedText: '',
            executeToolbarCommand: () => undefined,
            insertText: () => undefined,
            insertHtml: () => undefined,
            showLinkDialog: () => undefined,
            focusEditor: () => undefined,
        });
        expect(ran).toBe(1);
        expect(stored?.when?.({ query: '', disabled: false, readonly: false, hasSelection: false })).toBe(true);
    });

    it('lists in registration order and returns a copy', () => {
        registry.registerCommands([makeCommand('b'), makeCommand('a')]);
        const listed = registry.listCommands();
        expect(listed.map(c => c.id)).toEqual(['b', 'a']);
        listed.pop();
        expect(registry.listCommands()).toHaveLength(2);
    });

    it('a stale teardown removes whatever now holds the id', () => {
        const off = registry.registerCommand(makeCommand('dup', { label: 'first' }));
        registry.registerCommand(makeCommand('dup', { label: 'second' }));
        off();
        expect(registry.listCommands()).toHaveLength(0);
    });

    describe('change notification', () => {
        it('bumps the version and notifies subscribers once per change', () => {
            const listener = vi.fn();
            registry.subscribe(listener);
            const before = registry.version;

            registry.registerCommand(makeCommand('a'));
            registry.registerCommands([makeCommand('b'), makeCommand('c')]);
            registry.unregisterCommand('a');
            registry.clear();

            expect(listener).toHaveBeenCalledTimes(4);
            expect(registry.version).toBe(before + 4);
        });

        it('stays silent for changes that change nothing', () => {
            const listener = vi.fn();
            registry.subscribe(listener);
            registry.unregisterCommand('missing');
            registry.clear();
            expect(listener).not.toHaveBeenCalled();
            expect(registry.version).toBe(0);
        });

        it('stops notifying after the unsubscribe', () => {
            const listener = vi.fn();
            const off = registry.subscribe(listener);
            off();
            registry.registerCommand(makeCommand('a'));
            expect(listener).not.toHaveBeenCalled();
        });

        it('keeps registries independent of each other and of the global one', () => {
            const other = new RichTextCommandRegistry();
            const listener = vi.fn();
            other.subscribe(listener);
            registry.registerCommand(makeCommand('a'));
            expect(listener).not.toHaveBeenCalled();
            expect(other.listCommands()).toHaveLength(0);
            expect(globalRichTextCommands).toBeInstanceOf(RichTextCommandRegistry);
            expect(globalRichTextCommands).not.toBe(registry);
        });
    });
});

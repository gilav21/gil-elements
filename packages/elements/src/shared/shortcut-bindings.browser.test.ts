import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShortcutBindingService, type ShortcutRegistration } from './shortcut-bindings.js';

const key = (init: KeyboardEventInit & { key: string }) => new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
const action = (actionId: string, defaultShortcut: string, extra: Partial<ShortcutRegistration> = {}): ShortcutRegistration => ({
    actionId,
    description: `Do ${actionId}`,
    defaultShortcut,
    handler: () => undefined,
    ...extra,
});

let service: ShortcutBindingService;
beforeEach(() => {
    localStorage.clear();
    service = new ShortcutBindingService();
});
afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
});

describe('ShortcutBindingService dispatch', () => {
    it('runs the handler of the registration whose shortcut the event is, in any spelling of the chord', async () => {
        const hits: string[] = [];
        const handle = service.registerComponent('editor', [
            action('bold', 'Control+B', { handler: () => hits.push('bold') }),
            action('save', 'Primary+S', { handler: () => hits.push('save') }),
            action('close', 'Esc', { handler: () => hits.push('close') }),
            action('space', 'Alt+Spacebar', { handler: () => hits.push('space') }),
            action('redo', 'ctrl + shift + z', { handler: () => hits.push('redo') }),
            action('opt', 'Option+O', { handler: () => hits.push('opt') }),
            action('cmd', 'Cmd+K', { handler: () => hits.push('cmd') }),
            action('sym', '⌘+J', { handler: () => hits.push('sym') }),
        ]);

        handle.dispatch(key({ key: 'o', altKey: true }));
        handle.dispatch(key({ key: 'k', metaKey: true }));
        handle.dispatch(key({ key: 'j', metaKey: true }));
        const results = [
            handle.dispatch(key({ key: 'b', ctrlKey: true })),
            handle.dispatch(key({ key: 's', ctrlKey: true })),
            handle.dispatch(key({ key: 'Escape' })),
            handle.dispatch(key({ key: ' ', altKey: true })),
            handle.dispatch(key({ key: 'Z', ctrlKey: true, shiftKey: true })),
            handle.dispatch(key({ key: 'b', ctrlKey: true, shiftKey: true })),
            handle.dispatch(key({ key: 'b' })),
            handle.dispatch(key({ key: 'b', ctrlKey: true, altKey: true })),
            handle.dispatch(key({ key: 'b', ctrlKey: true, metaKey: true })),
        ];

        expect(hits).toEqual(['opt', 'cmd', 'sym', 'bold', 'save', 'close', 'space', 'redo']);
        expect(results).toEqual([true, true, true, true, true, false, false, false, false]);
    });

    it('treats Mod as Command on a Mac and Control elsewhere', () => {
        const hits: string[] = [];
        const handle = service.registerComponent('editor', [action('open', 'Mod+K', { handler: () => hits.push('open') })]);

        expect([handle.dispatch(key({ key: 'k', metaKey: true })), handle.dispatch(key({ key: 'k', ctrlKey: true }))]).toEqual([false, true]);
        vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
        expect([handle.dispatch(key({ key: 'k', metaKey: true })), handle.dispatch(key({ key: 'k', ctrlKey: true }))]).toEqual([true, false]);
        expect(hits).toEqual(['open', 'open']);
    });

    it('prefers the dispatching component, then priority, then registration order; a global shortcut reaches every component', () => {
        const hits: string[] = [];
        const a = service.registerComponent('panel', [action('x', 'Mod+X', { handler: () => hits.push('a') })]);
        const b = service.registerComponent('panel', [action('x', 'Mod+X', { handler: () => hits.push('b') })]);
        const press = (h: typeof a) => h.dispatch(key({ key: 'x', ctrlKey: true }));

        press(b);
        press(a);
        expect(hits).toEqual(['b', 'a']);

        const g = service.registerComponent('app', [action('g', 'Mod+X', { handler: () => hits.push('global-late'), scope: 'global' })]);
        press(a);
        expect(hits.at(-1)).toBe('a');
        expect(service.dispatch(key({ key: 'x', ctrlKey: true }))).toBe(true);
        expect(hits.at(-1)).toBe('global-late');

        const first = service.registerComponent('app', [action('p', 'Mod+Y', { scope: 'global', handler: () => hits.push('plain') })]);
        const high = service.registerComponent('app', [action('q', 'Mod+Y', { scope: 'global', priority: 5, handler: () => hits.push('high') })]);
        service.dispatch(key({ key: 'y', ctrlKey: true }));
        expect(hits.at(-1)).toBe('high');
        for (const h of [a, b, g, first, high]) h.unregister();
    });

    it('skips a registration whose `when` says no and lets the next one take the key', () => {
        const hits: string[] = [];
        let enabled = false;
        service.registerComponent('menu', [action('a', 'Mod+M', { scope: 'global', when: () => enabled, handler: () => hits.push('guarded') })]);
        service.registerComponent('menu', [action('b', 'Mod+M', { scope: 'global', handler: () => hits.push('fallback') })]);

        service.dispatch(key({ key: 'm', ctrlKey: true }));
        enabled = true;
        service.dispatch(key({ key: 'm', ctrlKey: true }));

        expect(hits).toEqual(['fallback', 'guarded']);
    });

    it('prevents the default and optionally stops propagation, and handles one event only once', () => {
        service.registerComponent('a', [action('stop', 'Mod+S', { scope: 'global', stopPropagation: true })]);
        service.registerComponent('a', [action('keep', 'Mod+D', { scope: 'global', preventDefault: false })]);
        const save = key({ key: 's', ctrlKey: true });
        const stopped = vi.spyOn(save, 'stopPropagation');
        const dup = key({ key: 'd', ctrlKey: true });

        expect([service.dispatch(save), save.defaultPrevented, stopped.mock.calls.length]).toEqual([true, true, 1]);
        expect([service.dispatch(dup), dup.defaultPrevented, service.dispatch(dup)]).toEqual([true, false, false]);
    });
});

describe('ShortcutBindingService overrides', () => {
    it('layers instance over component over bare action id, and dispatch follows the effective chord', () => {
        const hits: string[] = [];
        const one = service.registerComponent('editor', [action('bold', 'Mod+B', { handler: () => hits.push('one') })]);
        const two = service.registerComponent('editor', [action('bold', 'Mod+B', { handler: () => hits.push('two') })]);
        expect([one.componentId, two.componentId]).toEqual(['editor-1', 'editor-2']);

        service.setShortcutOverrideForAllInstances('bold', 'Mod+Shift+B', 'editor');
        service.setShortcutOverrideForInstance('bold', 'Alt+B', 'editor-2');

        expect([service.getShortcutOverrideForInstance('bold', 'editor-1'), service.getShortcutOverrideForInstance('bold', 'editor-2')]).toEqual(['mod+shift+b', 'alt+b']);
        expect([one.dispatch(key({ key: 'b', ctrlKey: true })), one.dispatch(key({ key: 'b', ctrlKey: true, shiftKey: true }))]).toEqual([false, true]);
        expect(two.dispatch(key({ key: 'b', altKey: true }))).toBe(true);
        expect(hits).toEqual(['one', 'two']);

        service.setShortcutOverrideForAllInstances('bold', 'Mod+J', 'editor');
        expect(service.hasShortcutOverrideForInstance('bold', 'editor-2')).toBe(false);
        expect(service.getShortcutOverrideForInstance('bold', 'editor-2')).toBe('mod+j');
        service.clearShortcutOverrideForAllInstances('bold', 'editor');
        expect([service.hasShortcutOverrideForAllInstances('bold', 'editor'), service.getShortcutOverrideForInstance('bold', 'editor-1')]).toEqual([false, null]);
    });

    it('ignores a shortcut that has no key, announces each real change once, and clears one layer at a time', () => {
        const changes = vi.fn();
        service.addEventListener('change', changes);
        service.registerComponent('t', [action('go', 'Mod+G')]);
        changes.mockClear();

        service.setShortcutOverrideForAllInstances('go', 'Ctrl+', 't');
        service.setShortcutOverrideForAllInstances('go', '', 't');
        expect(changes).not.toHaveBeenCalled();

        service.setShortcutOverride('go', 'Mod+H');
        service.clearShortcutOverrideForComponent('go', 't');
        service.clearShortcutOverride('go');
        service.clearShortcutOverride('go');
        expect(changes).toHaveBeenCalledTimes(2);
        service.setShortcutOverride('a', 'Mod+1');
        service.setShortcutOverride('b', 'Mod+2');
        service.clearAllShortcutOverrides();
        service.clearAllShortcutOverrides();
        expect(service.exportOverrideSchema()).toEqual({});
    });

    it('exports a sorted schema and imports it replacing or merging, saying nothing when nothing changed', () => {
        const changes = vi.fn();
        service.setShortcutOverride('zoom', 'Mod+=');
        service.setShortcutOverrideForAllInstances('bold', 'Mod+Shift+B', 'editor');
        const schema = service.exportOverrideSchema();
        expect(Object.keys(schema)).toEqual(['editor::bold', 'zoom']);

        service.addEventListener('change', changes);
        service.importOverrideSchema({ ...schema });
        expect(changes).not.toHaveBeenCalled();

        service.importOverrideSchema({ 'kanban::kanban.undo': 'Mod+U', bad: '' }, false);
        expect(service.exportOverrideSchema()).toEqual({ ...schema, 'kanban::kanban.undo': 'mod+u' });
        service.importOverrideSchema({ only: 'Alt+O' });
        expect(service.exportOverrideSchema()).toEqual({ only: 'alt+o' });
        expect(changes).toHaveBeenCalledTimes(2);
    });

    it('persists overrides across instances and starts clean after a corrupted store', () => {
        service.setShortcutOverrideForAllInstances('bold', 'Mod+Shift+B', 'editor');
        expect(new ShortcutBindingService().exportOverrideSchema()).toEqual({ 'editor::bold': 'mod+shift+b' });

        localStorage.setItem('ge-shortcut-binding-overrides', '{nope');
        expect(new ShortcutBindingService().exportOverrideSchema()).toEqual({});
    });
});

describe('ShortcutBindingService catalog', () => {
    it('lists each action once with its live instances, sorted by category then description, and reuses freed instance numbers', () => {
        const a = service.registerComponent('Data Table', [action('t.sort', 'Mod+S', { description: 'Sort', category: 'Table' })]);
        const b = service.registerComponent('Data Table', [action('t.sort', 'Mod+S', { description: 'Sort', category: 'Table' })]);
        service.registerComponent('app', [action('a.zoom', 'F2', { description: 'Zoom', category: 'App', scope: 'global' }), action('a.help', 'F1', { description: 'Help', category: 'App' })]);
        expect([a.componentId, b.componentId]).toEqual(['data-table-1', 'data-table-2']);

        const catalog = service.getShortcutCatalog();
        expect(catalog.map((c) => [c.actionId, c.componentName, c.activeInstanceCount, c.activeComponentIds])).toEqual([
            ['a.help', 'app', 1, ['app-1']],
            ['a.zoom', 'app', 1, ['app-1']],
            ['t.sort', 'data-table', 2, ['data-table-1', 'data-table-2']],
        ]);

        expect(catalog.map((c) => c.scope)).toEqual(['component', 'global', 'component']);

        a.unregister();
        expect(service.registerComponent('Data Table', [action('t.sort', 'Mod+S', { category: 'Table' })]).componentId).toBe('data-table-1');
        expect(service.getShortcutBindingViews().map((v) => v.componentId)).toEqual(['data-table-2', 'app-1', 'app-1', 'data-table-1']);

        const third = service.registerComponent('Data Table', [action('t.sort', 'Mod+S')]);
        third.unregister();
        b.unregister();
        const reused = [service.registerComponent('Data Table', [action('t.sort', 'Mod+S')]).componentId, service.registerComponent('Data Table', [action('t.sort', 'Mod+S')]).componentId];
        expect(reused).toEqual(['data-table-2', 'data-table-3']);
    });

    it('keeps an unregistered action in the catalog with no live instance, and reports shortcuts two actions share', () => {
        service.defineShortcuts('kanban', [{ actionId: 'k.undo', description: 'Undo', defaultShortcut: 'Mod+Z' }]);
        service.registerComponent('editor', [action('e.undo', 'Mod+Z'), action('e.bold', 'Mod+B')]);
        expect(service.getShortcutCatalog().find((c) => c.actionId === 'k.undo')).toMatchObject({ activeInstanceCount: 0, activeComponentIds: [] });
        expect(service.getConflicts()).toEqual([{ shortcut: 'mod+z', actionIds: ['e.undo', 'k.undo'] }]);

        service.setShortcutOverrideForAllInstances('e.undo', 'Mod+U', 'editor');
        expect(service.getConflicts()).toEqual([]);
    });
});

describe('ShortcutBindingService keys', () => {
    it('turns an event into a normalised chord, never for a bare modifier, and formats chords for the platform', () => {
        expect([
            service.shortcutFromEvent(key({ key: 'K', ctrlKey: true, shiftKey: true })),
            service.shortcutFromEvent(key({ key: ' ', altKey: true, metaKey: true })),
            service.shortcutFromEvent(key({ key: 'Shift', shiftKey: true })),
            service.shortcutFromEvent(key({ key: 'Control', ctrlKey: true })),
        ]).toEqual(['ctrl+shift+k', 'meta+alt+space', null, null]);

        expect([service.formatShortcutForDisplay('mod+k'), service.formatShortcutForDisplay('ctrl+shift+space'), service.formatShortcutForDisplay('alt+escape'), service.formatShortcutForDisplay('+')]).toEqual(['Ctrl+K', 'Ctrl+Shift+Space', 'Alt+Escape', '+']);
        vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
        expect(service.formatShortcutForDisplay('Mod+K')).toBe('Cmd+K');
    });
});

describe('ShortcutBindingService global listener', () => {
    it('runs global shortcuts from real keydowns on the document while one is registered, and never a component-scoped one', () => {
        const hits: string[] = [];
        const handle = service.registerComponent('app', [
            action('g', 'Mod+Q', { scope: 'global', handler: () => hits.push('global') }),
            action('c', 'Mod+W', { handler: () => hits.push('component') }),
        ]);
        document.dispatchEvent(key({ key: 'q', ctrlKey: true }));
        document.dispatchEvent(key({ key: 'w', ctrlKey: true }));
        const claimed = key({ key: 'q', ctrlKey: true });
        claimed.preventDefault();
        document.dispatchEvent(claimed);
        expect(hits).toEqual(['global']);

        handle.unregister();
        document.dispatchEvent(key({ key: 'q', ctrlKey: true }));
        expect(hits).toEqual(['global']);
    });

    it('does not run a handler twice when the app also calls dispatch for the same event', () => {
        const hits: string[] = [];
        const handle = service.registerComponent('app', [action('g', 'Mod+Q', { scope: 'global', handler: () => hits.push('x') })]);
        const event = key({ key: 'q', ctrlKey: true });
        document.addEventListener('keydown', (e) => service.dispatch(e), { once: true });
        document.dispatchEvent(event);
        expect(hits).toEqual(['x']);
        handle.unregister();
    });
});

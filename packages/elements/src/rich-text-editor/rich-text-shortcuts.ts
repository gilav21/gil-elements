import { shortcutBindings, type ShortcutComponentHandle } from '../shared/shortcut-bindings.js';
import type { RichTextControllerHost } from './rich-text-controllers.js';
import type { RichTextController, RichTextFormatCommand } from './rich-text-host.js';
import { KEY_PRIORITY } from './rich-text-key-priority.js';

interface ActionSpec {
    id: string;
    description: string;
    shortcut: string;
    category: string;
    run: () => void;
    /** Whether the action changes the content, and so needs an editable editor. Default true. */
    edits?: boolean;
    /** Extra condition, for actions another controller or an addon supplies. */
    available?: () => boolean;
}

/**
 * The editor's remappable shortcuts, registered per instance with the shared shortcut service. Formatting
 * and history go to the controllers that own them; revision history and find run the action registered
 * with `registerShortcutAction` and stay inert until one exists.
 */
export class ShortcutsController implements RichTextController {
    private handle: ShortcutComponentHandle | null = null;
    private removeKeyHandler: (() => void) | null = null;

    constructor(private readonly host: RichTextControllerHost) {}

    attach(): void {
        const handle = shortcutBindings.registerComponent('rich-text-editor', this.actions().map((action) => ({
            actionId: action.id,
            description: action.description,
            defaultShortcut: action.shortcut,
            category: action.category,
            handler: action.run,
            when: () => (action.edits === false || this.canEdit()) && (action.available?.() ?? true),
        })));
        this.handle = handle;
        this.removeKeyHandler = this.host.addKeyHandler(KEY_PRIORITY.shortcuts, (event) => handle.dispatch(event));
    }

    detach(): void {
        this.removeKeyHandler?.();
        this.removeKeyHandler = null;
        this.handle?.unregister();
        this.handle = null;
    }

    private canEdit(): boolean {
        return !this.host.isDisabled && !this.host.readonly;
    }

    /** The same steps the element's `format()` takes for a toolbar click. */
    private runCommand(command: RichTextFormatCommand): void {
        const run = this.host.commandTable.get(command);
        if (!run) return;
        this.host.restoreSelection();
        this.host.flushPendingHistoryPush();
        run();
        this.host.commit({ focus: true });
    }

    private actions(): ActionSpec[] {
        const format = (command: RichTextFormatCommand) => () => this.runCommand(command);
        const history = (step: 'undo' | 'redo') => () => this.host.provider('history')?.[step]();
        const registered = (id: string): Pick<ActionSpec, 'run' | 'available'> => ({
            run: () => this.host.runShortcutAction(id),
            available: () => this.host.canRunShortcutAction(id),
        });
        return [
            { id: 'rich-text.bold', description: 'Toggle bold', shortcut: 'Mod+B', category: 'Formatting', run: format('bold') },
            { id: 'rich-text.italic', description: 'Toggle italic', shortcut: 'Mod+I', category: 'Formatting', run: format('italic') },
            { id: 'rich-text.underline', description: 'Toggle underline', shortcut: 'Mod+U', category: 'Formatting', run: format('underline') },
            { id: 'rich-text.link', description: 'Insert link', shortcut: 'Mod+K', category: 'Insert', run: () => this.host.showLinkDialog() },
            { id: 'rich-text.undo', description: 'Undo', shortcut: 'Mod+Z', category: 'History', run: history('undo') },
            { id: 'rich-text.redo', description: 'Redo', shortcut: 'Mod+Shift+Z', category: 'History', run: history('redo') },
            { id: 'rich-text.redo.alt', description: 'Redo (alternate)', shortcut: 'Mod+Y', category: 'History', run: history('redo') },
            { id: 'rich-text.history', description: 'Open revision history', shortcut: 'Mod+Shift+H', category: 'History', ...registered('rich-text.history') },
            { id: 'rich-text.find', description: 'Find in editor', shortcut: 'Mod+F', category: 'Navigation', edits: false, ...registered('rich-text.find') },
            { id: 'rich-text.find-replace', description: 'Find and replace', shortcut: 'Mod+H', category: 'Navigation', ...registered('rich-text.find-replace') },
        ];
    }
}

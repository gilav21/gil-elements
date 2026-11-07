/** Read-only editor state passed to a slash command's `when` guard. */
export interface RichTextSlashCommandAvailabilityContext {
    /** The text typed after `/`. */
    query: string;
    disabled: boolean;
    readonly: boolean;
    hasSelection: boolean;
}

/** Passed to a slash command's `run`: the ways to change the editor from a handler. */
export interface RichTextSlashCommandContext {
    /** The text typed after `/` when the command was selected. */
    query: string;
    /** The selected text, or an empty string. */
    selectedText: string;
    /** Runs a toolbar command by name, such as `'bold'`, `'heading1'` or `'bulletList'`. */
    executeToolbarCommand: (command: string) => void;
    insertText: (text: string) => void;
    insertHtml: (html: string) => void;
    /** Opens the editor's link dialog. */
    showLinkDialog: () => void;
    focusEditor: () => void;
}

/**
 * A command in the slash menu. Typing `/` lists the matching commands; the user filters by typing
 * and picks one.
 *
 * @example
 * const date: RichTextSlashCommand = {
 *   id: 'insert.date',
 *   label: "Today's Date",
 *   keywords: ['date', 'now'],
 *   order: 200,
 *   run: ctx => ctx.insertText(new Date().toLocaleDateString()),
 * };
 */
export interface RichTextSlashCommand {
    /** Unique, dot-namespaced (`'format.heading-1'`, `'custom.myCommand'`). */
    id: string;
    label: string;
    /** Shown under the label. */
    description?: string;
    /** Extra search terms; the label is always searched. */
    keywords?: string[];
    /** Alternative names that also trigger the command. */
    aliases?: string[];
    /** Lower sorts first. Built-in commands use 10 to 120; use 200 and up to come after them. */
    order?: number;
    /** Return `false` to hide the command for the current editor state. */
    when?: (context: RichTextSlashCommandAvailabilityContext) => boolean;
    run: (context: RichTextSlashCommandContext) => void | Promise<void>;
}

/**
 * Commands keyed by `id`, so registering an id again replaces rather than duplicates it. Every
 * editor owns one; {@link globalRichTextCommands} holds the commands shared by all of them, and the
 * slash menu merges the two with the editor's own winning on an id collision.
 */
export class RichTextCommandRegistry {
    private readonly commands = new Map<string, RichTextSlashCommand>();
    private readonly listeners = new Set<() => void>();
    private changes = 0;

    /** Increases on every change; compare it to know whether `listCommands()` is stale. */
    get version(): number {
        return this.changes;
    }

    /** Calls `listener` after every change and returns its teardown. */
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Adds or replaces a command. The teardown removes whatever holds that `id` by then, so a later
     * registration of the same id wins and this teardown then removes that one.
     */
    registerCommand(command: RichTextSlashCommand): () => void {
        this.commands.set(command.id, command);
        this.notify();
        return () => this.unregisterCommand(command.id);
    }

    /** Registers several commands as one change. The teardown removes exactly these ids as one change. */
    registerCommands(commands: readonly RichTextSlashCommand[]): () => void {
        for (const command of commands) this.commands.set(command.id, command);
        this.notify();
        return () => {
            for (const command of commands) this.commands.delete(command.id);
            this.notify();
        };
    }

    /** A no-op, with no notification, when nothing is registered under `id`. */
    unregisterCommand(id: string): void {
        if (this.commands.delete(id)) this.notify();
    }

    /** Drops every command of this registry only, notifying once and not at all when already empty. */
    clear(): void {
        if (this.commands.size === 0) return;
        this.commands.clear();
        this.notify();
    }

    /** The commands in registration order, neither sorted by `order` nor filtered by `when`. The command objects are the registered ones: do not mutate them. */
    listCommands(): RichTextSlashCommand[] {
        return Array.from(this.commands.values());
    }

    private notify(): void {
        this.changes++;
        for (const listener of this.listeners) listener();
    }
}

/** Commands available in every editor. */
export const globalRichTextCommands = new RichTextCommandRegistry();

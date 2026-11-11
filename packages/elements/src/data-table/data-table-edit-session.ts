/**
 * Inline editing of the grid's cells (wave 5, package B owns this file). Joint step 0: a session that does nothing, so the
 * service answers "nothing is being edited" and no key, pointer or render is touched. See `data-table-cell-session.ts` for the
 * contract and `KEY_PRIORITY` in `data-table-registry.ts` for the keys it will own (editor 5, history 20, editStart 60).
 */
import type { CellSession, InteractionContext, SessionStandIn } from './data-table-cell-session.js';
import type { CellInteractionService } from './data-table-providers.js';

type EditService = Pick<CellInteractionService, 'editingCell' | 'cellEditError' | 'startEditing' | 'commitEdit' | 'cancelEdit' | 'isEditing' | 'editValue' | 'setEditValue'>;

/** The editing methods that do nothing (the step 0 session is built on them; the controller's fallback when a session cannot make a stand-in). */
export const NEUTRAL_EDIT: EditService = {
    editingCell: () => null,
    cellEditError: () => null,
    startEditing: () => false,
    commitEdit: () => undefined,
    cancelEdit: () => undefined,
    isEditing: () => false,
    editValue: () => undefined,
    setEditValue: () => undefined,
};

export class EditSession<T> implements CellSession {
    // wave 5: state (editing, error, draft, editingRowId), the double-tap detector, the key handlers (editor, history, editStart) and
    // the `retain('edit', ...)` of the edited row join here, registered in `attach` through `context.host`.
    constructor(protected readonly context: InteractionContext<T>) {}

    readonly service: EditService = { ...NEUTRAL_EDIT };

    attach(): void {}

    detach(): void {}

    /** After a failure of this session (see `CellSession.inert`): the inert editing methods, nothing is open and nothing is kept. */
    inert(): SessionStandIn {
        return { service: new EditSession(this.context).service };
    }
}

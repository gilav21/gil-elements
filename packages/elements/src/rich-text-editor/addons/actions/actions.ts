import { html, nothing } from 'lit';
import { defineAddon, resolveAddonLocale } from '../../rich-text-addon-kit.js';
import type { RichTextAddonHost, RichTextAddonOptions } from '../../rich-text-host.js';
import { ActionsDialog, type ActionsDialogConfirm, type ActionsDialogContext } from './actions-dialog.js';
import { RICH_TEXT_ACTIONS_LOCALES, type RichTextActionsLocale } from './actions-locale.js';
import { renderActionsPopover, type PopoverActionRow } from './actions-popover.js';
import {
    ACTIONS_SANITIZER_RULES, applyStarterStyle, assertFlatParams, computeSeedStyleString, isCombinedOnElement,
    readActions, removeAction, stripStyleIfMatches, writeAction, writeCombined,
} from './actions-serializer.js';
import {
    ACTION_ATTRS, type ActionParams, type ActionTargetKind, type RichTextActionDefinition, type RichTextActionTrigger,
} from './actions-types.js';
import css from './actions.css?inline';
import markerCss from './actions-marker.css?inline';

const ATTACH_ID = 'actions.attach';
const ATTACH_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" '
    + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';

export interface RichTextActionsOptions extends RichTextAddonOptions {
    /** The registered action definitions. Empty or absent: no UI appears. */
    readonly definitions?: readonly RichTextActionDefinition[];
    /** Default starter styles seeded onto every newly created action span. */
    readonly style?: Readonly<Record<string, string>>;
    /** A locale id (`'en'`, `'he'`, ...) or a full dictionary; defaults to the editor's locale. */
    readonly locale?: string | RichTextActionsLocale;
}

/** The DOM target captured when a flow opens, since the dialog steals focus and collapses the live selection. */
interface ApplyTarget {
    kind: ActionTargetKind;
    /** An existing action element the caret sits inside, or null. */
    existing: HTMLElement | null;
    /** The selected image, when `kind === 'image'`. */
    image: HTMLImageElement | null;
}

/** The element a flow captured, or null when it captured none and the action wraps the live text selection. */
const capturedElement = (target: ApplyTarget): HTMLElement | null => (target.kind === 'image' ? target.image : target.existing);

const bareSpan = (el: HTMLElement): boolean => el.tagName === 'SPAN' && el.attributes.length === 0;

function unwrap(el: HTMLElement): void {
    el.replaceWith(...el.childNodes);
}

interface PopoverState {
    readonly target: HTMLElement;
    readonly rows: PopoverActionRow[];
    readonly anchor: { left: number; top: number };
}

/**
 * Attaches click or hover actions to a text selection or an image: the "Attach action" toolbar
 * button and `/action` command open a dialog that gathers the params, and a popover under an
 * actioned element offers edit, remove and add.
 */
export class ActionsController {
    private dialog: ActionsDialog | null = null;
    private popover: PopoverState | null = null;

    constructor(
        private readonly host: RichTextAddonHost,
        private readonly definitions: readonly RichTextActionDefinition[],
        private readonly style: Readonly<Record<string, string>>,
        private readonly locale: RichTextActionsLocale,
    ) {}

    canAttach(): boolean {
        if (this.host.isDisabled || this.host.readonly) return false;
        const selection = this.host.selection();
        return selection.kind !== 'none' || !!selection.closestWithAttrs(ACTION_ATTRS);
    }

    renderOverlay() {
        const { popover } = this;
        return html`${this.dialog?.render() ?? nothing}${popover ? renderActionsPopover({
            rows: popover.rows,
            canAdd: popover.rows.length < 2,
            locale: this.locale,
            anchor: popover.anchor,
            onEdit: (trigger) => this.editAction(popover.target, trigger),
            onRemove: (row) => (row.combined ? this.removeCombined(popover.target, row.id) : this.removeTrigger(popover.target, row.trigger)),
            onAdd: () => {
                this.hidePopover();
                this.openAttachFlow();
            },
        }) : nothing}`;
    }

    openAttachFlow(): void {
        this.host.saveSelection();
        const selection = this.host.selection();
        const target: ApplyTarget = {
            kind: selection.kind === 'image' ? 'image' : 'text',
            existing: selection.closestWithAttrs(ACTION_ATTRS),
            image: selection.kind === 'image' ? selection.imageElement : null,
        };
        this.openDialog(target, {
            mode: target.existing ? 'edit' : 'create',
            targetKind: target.kind,
            selectionText: selection.text,
            occupiedTriggers: target.existing ? readActions(target.existing).map((a) => a.trigger) : [],
            prefill: null,
        });
    }

    private editAction(el: HTMLElement, trigger: RichTextActionTrigger): void {
        const actions = readActions(el);
        const action = actions.find((a) => a.trigger === trigger);
        const def = action && this.definitions.find((d) => d.id === action.id);
        if (!action || !def) return;
        this.hidePopover();
        this.openDialog({ kind: 'text', existing: el, image: null }, {
            mode: 'edit',
            targetKind: 'text',
            selectionText: el.textContent ?? '',
            occupiedTriggers: actions.map((a) => a.trigger),
            prefill: {
                def,
                trigger,
                params: action.params,
                hoverParams: isCombinedOnElement(el) ? actions.find((a) => a.trigger === 'hover')?.params : undefined,
            },
        });
    }

    private openDialog(target: ApplyTarget, context: ActionsDialogContext): void {
        const dialog: ActionsDialog = new ActionsDialog({
            definitions: this.definitions,
            context,
            locale: this.locale,
            requestUpdate: () => this.host.invalidate(),
            onDismiss: () => this.closeDialog(dialog),
            onPick: (def) => this.onPick(def, dialog, target),
            onConfirm: (payload) => {
                if (this.applyConfirmed(payload, target)) this.closeDialog(dialog);
            },
        });
        this.dialog = dialog;
        this.host.invalidate();
    }

    closeDialog(dialog = this.dialog): void {
        if (!dialog || dialog !== this.dialog) return;
        this.dialog = null;
        this.host.invalidate();
    }

    private applyConfirmed(payload: ActionsDialogConfirm, target: ApplyTarget): boolean {
        return payload.combinedParams
            ? this.applyCombined(payload.def, payload.combinedParams, target)
            : this.applyAction(payload.def, payload.trigger, payload.params, target);
    }

    private onPick(def: RichTextActionDefinition, dialog: ActionsDialog, target: ApplyTarget): void {
        this.warnOnMisuse(def);
        const { resolveParams } = def;
        if (!resolveParams) return;
        const trigger = def.triggers[0] ?? 'click';
        dialog.setBusy(true);
        resolveParams({
            mode: target.existing ? 'edit' : 'create',
            trigger,
            currentParams: {},
            selectionText: this.host.selection().text,
            targetKind: target.kind,
            targetElement: target.existing,
        })
            .then((params) => {
                this.closeDialog(dialog);
                if (params === null) return;
                if (def.combined && def.triggers.length >= 2) this.applyCombined(def, { click: params, hover: params }, target);
                else this.applyAction(def, trigger, params, target);
            })
            .catch((err: unknown) => {
                this.closeDialog(dialog);
                console.error('[rich-text-actions] resolveParams rejected:', err);
            });
    }

    private warnOnMisuse(def: RichTextActionDefinition): void {
        const tiers = [def.resolveParams, def.formTag, def.fields?.length].filter(Boolean).length;
        if (tiers > 1) {
            console.error(`[rich-text-actions] action "${def.id}" declares multiple param tiers; precedence is resolveParams > formTag > fields.`);
        }
        if (def.combined && def.triggers.length < 2) {
            console.error(`[rich-text-actions] action "${def.id}" is combined but declares fewer than two triggers; treating as single-trigger.`);
        }
        if (def.combined && def.paramsMode === 'separate' && (def.formTag || def.resolveParams)) {
            console.error(`[rich-text-actions] action "${def.id}" combined+separate supports tier-1 fields only; falling back to shared.`);
        }
    }

    // Popover

    refreshPopover(): void {
        this.dropPopoverIfDetached();
        const el = this.host.isDisabled || this.host.readonly ? null : this.host.selection().closestWithAttrs(ACTION_ATTRS);
        if (!el) this.hidePopover();
        else if (el !== this.popover?.target) this.showPopover(el);
    }

    private showPopover(el: HTMLElement): void {
        const rect = el.getBoundingClientRect();
        this.popover = {
            target: el,
            rows: this.popoverRows(el),
            anchor: { left: Math.round(rect.left), top: Math.round(rect.bottom + 4) },
        };
        this.host.invalidate();
    }

    private popoverRows(el: HTMLElement): PopoverActionRow[] {
        const actions = readActions(el);
        const label = (id: string): string => this.definitions.find((d) => d.id === id)?.label ?? id;
        const available = (id: string): boolean => this.definitions.some((d) => d.id === id);
        const first = actions[0];
        if (first && isCombinedOnElement(el)) {
            return [{ trigger: 'click', id: first.id, label: label(first.id), available: available(first.id), combined: true }];
        }
        return actions.map((a) => ({ trigger: a.trigger, id: a.id, label: label(a.id), available: available(a.id) }));
    }

    /** Closes the popover when the element it points at has left the document. */
    dropPopoverIfDetached(): void {
        if (this.popover && !this.popover.target.isConnected) this.hidePopover();
    }

    hidePopover(): void {
        if (!this.popover) return;
        this.popover = null;
        this.host.invalidate();
    }

    onOutsidePointer(event: Event): void {
        const { popover } = this;
        if (!popover) return;
        const inside = event.composedPath().some((node) => node instanceof Element
            && (node.matches('[data-slot="rich-text-actions-popover"]') || node === popover.target));
        if (!inside && !(event.target instanceof Node && popover.target.contains(event.target))) this.hidePopover();
    }

    // Writing

    private removeCombined(el: HTMLElement, id: string): void {
        this.removeActions(el, id, ['click', 'hover']);
        this.host.emit('action-removed', { actionId: id, trigger: 'click', targetKind: 'text' });
        this.host.emit('action-removed', { actionId: id, trigger: 'hover', targetKind: 'text' });
    }

    private removeTrigger(el: HTMLElement, trigger: RichTextActionTrigger): void {
        const actionId = el.getAttribute(`data-action-${trigger}`) ?? '';
        this.removeActions(el, actionId, [trigger]);
        this.host.emit('action-removed', { actionId, trigger, targetKind: 'text' });
    }

    private removeActions(el: HTMLElement, id: string, triggers: RichTextActionTrigger[]): void {
        this.hidePopover();
        const def = this.definitions.find((d) => d.id === id);
        const seed = def ? computeSeedStyleString(el.ownerDocument, this.mergedSeed(def)) : '';
        this.host.mutateContent(() => {
            for (const trigger of triggers) removeAction(el, trigger);
            if (ACTION_ATTRS.some((attr) => el.hasAttribute(attr))) return;
            stripStyleIfMatches(el, seed);
            if (bareSpan(el)) unwrap(el);
        });
    }

    private mergedSeed(def: RichTextActionDefinition): Record<string, string> {
        return { ...this.style, ...def.style };
    }

    /** Whether the captured element can no longer take the action (logged when so): it left the editor while the dialog was open. */
    private targetLost(target: ApplyTarget): boolean {
        const el = capturedElement(target);
        const lost = el ? !this.host.contentRoot.contains(el) : target.kind === 'image';
        if (lost) console.error(`[rich-text-actions] lost the ${target.kind} target before applying the action.`);
        return lost;
    }

    private isFlat(label: string, ...params: unknown[]): boolean {
        try {
            for (const p of params) assertFlatParams(p);
            return true;
        } catch (err) {
            console.error(`[rich-text-actions] refused to attach non-flat ${label}:`, err);
            return false;
        }
    }

    private writeTo(def: RichTextActionDefinition, target: ApplyTarget, write: (el: HTMLElement) => void, what: string): boolean {
        if (this.targetLost(target)) return false;
        const el = capturedElement(target);
        if (el) {
            this.host.mutateContent(() => write(el));
            return true;
        }
        const seed = this.mergedSeed(def);
        const created = this.host.wrapSelection(() => {
            const span = this.host.doc.createElement('span');
            write(span);
            applyStarterStyle(span, seed);
            return span;
        });
        if (created.length > 0) return true;
        console.error(`[rich-text-actions] lost the text selection before applying the ${what}.`);
        return false;
    }

    applyAction(def: RichTextActionDefinition, trigger: RichTextActionTrigger, params: ActionParams, target: ApplyTarget): boolean {
        if (!this.isFlat('params', params)) return false;
        if (!this.writeTo(def, target, (el) => writeAction(el, trigger, def.id, params), 'action')) return false;
        this.host.emit('action-attached', { actionId: def.id, trigger, params, targetKind: target.kind });
        return true;
    }

    applyCombined(def: RichTextActionDefinition, params: { click: ActionParams; hover: ActionParams }, target: ApplyTarget): boolean {
        if (!this.isFlat('combined params', params.click, params.hover)) return false;
        if (!this.writeTo(def, target, (el) => writeCombined(el, def.id, params), 'combined action')) return false;
        this.host.emit('action-attached', { actionId: def.id, trigger: 'click', params: params.click, targetKind: target.kind });
        this.host.emit('action-attached', { actionId: def.id, trigger: 'hover', params: params.hover, targetKind: target.kind });
        return true;
    }
}

/**
 * The actions addon. Options: `definitions`, `style`, `locale` and the shared `toolbar`,
 * `slashCommand`, `order` (default 500). It widens the sanitizer for `data-action-*` attributes,
 * teaches markdown to keep action spans, and fires `action-attached` / `action-removed` (a combined
 * action fires twice, once per trigger). Play the actions back on rendered content with `bindRichTextActions`.
 */
export const actionsAddon = defineAddon<RichTextActionsOptions>('actions', 500, ({ host, options, life }) => {
    const definitions = options.definitions ?? [];
    if (definitions.length === 0) return;
    const controller = new ActionsController(
        host, definitions, options.style ?? {}, resolveAddonLocale(RICH_TEXT_ACTIONS_LOCALES, host, options.locale),
    );

    life.add(host.sanitizer.registerAttributeRules([...ACTIONS_SANITIZER_RULES]));
    life.add(host.markdown.registerSpanSerializer({
        serialize: (el, inner) => {
            if (!ACTION_ATTRS.some((attr) => el.hasAttribute(attr))) return null;
            const clone = el.cloneNode(false) as HTMLElement;
            clone.innerHTML = inner;
            return clone.outerHTML;
        },
    }));
    life.add(host.adoptStyles(css, 'shadow'));
    life.add(host.adoptStyles(markerCss, 'document'));
    life.add(host.overlays.register({ id: ATTACH_ID, render: () => controller.renderOverlay() }));

    if (options.toolbar) {
        life.add(host.toolbarSlots.register({
            id: ATTACH_ID,
            icon: ATTACH_ICON,
            tooltip: 'Attach action',
            order: options.order,
            isEnabled: () => controller.canAttach(),
            onClick: () => controller.openAttachFlow(),
        }));
    }
    if (options.slashCommand) {
        life.add(host.commands.registerCommand({
            id: ATTACH_ID,
            label: 'Attach action',
            description: 'Attach a click or hover action to the selection',
            keywords: ['action', 'link', 'dialog', 'hover'],
            order: 220,
            when: (ctx) => ctx.hasSelection && !ctx.readonly,
            run: () => controller.openAttachFlow(),
        }));
    }

    // A content swap (save/reload, collaborative overwrite, template insert) must not leave the popover over deleted content.
    life.add(host.subscribe('content', () => controller.dropPopoverIfDetached()));
    const refresh = (): void => controller.refreshPopover();
    life.listen(host.contentRoot, 'mouseup', refresh);
    life.listen(host.contentRoot, 'keyup', refresh);
    life.listen(host.doc, 'mousedown', (event) => controller.onOutsidePointer(event));
    life.add(() => {
        controller.hidePopover();
        controller.closeDialog();
    });
});

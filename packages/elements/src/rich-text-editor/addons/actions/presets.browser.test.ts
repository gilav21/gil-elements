import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RichTextActionEvent } from './actions-runtime.js';
import type { ActionParams } from './actions-types.js';
import { hoverCardAction, hoverCardHandlers } from './presets-hover-card.js';
import { linkedPreviewDialogAction, linkedPreviewDialogHandlers } from './presets-linked-preview-dialog.js';
import { openDialogAction, openDialogHandlers } from './presets-open-dialog.js';
import { anchorOverlay, directionOf } from './presets-overlay.js';

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const escape = (): void => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
};
const slot = (name: string): Element | null => document.querySelector(`[data-slot="${name}"]`);

const anchors: HTMLElement[] = [];

function anchorEl(): HTMLElement {
    const el = document.createElement('span');
    el.textContent = 'anchor';
    document.body.append(el);
    anchors.push(el);
    return el;
}

function actionEvent(trigger: 'click' | 'hover', params: ActionParams, phase: 'start' | 'end' = 'start', element = anchorEl()): RichTextActionEvent {
    return {
        actionId: 'x', trigger, params, element,
        domEvent: new Event(trigger === 'click' ? 'click' : 'mouseover'), phase,
    };
}

afterEach(() => {
    escape();
    for (const el of anchors.splice(0)) el.remove();
    document.querySelectorAll('.preset-overlay').forEach((el) => el.remove());
});

describe('hover-card preset', () => {
    it('renders the card in the anchored element\'s direction (rtl)', () => {
        const element = anchorEl();
        element.dir = 'rtl';
        hoverCardHandlers()['preset.hover-card']!(actionEvent('hover', { title: 'טיפ', body: 'תוכן' }, 'start', element));
        expect(slot('preset-hover-card')?.querySelector('[dir]')?.getAttribute('dir')).toBe('rtl');
    });

    it('custom id/label and extraFields are respected', () => {
        const def = hoverCardAction({ id: 'hc2', label: 'My Card', extraFields: [{ key: 'k', label: 'K', type: 'text' }] });
        expect(def.id).toBe('hc2');
        expect(def.label).toBe('My Card');
        expect(def.fields?.some((f) => f.key === 'k')).toBe(true);
    });

    it('handler renders a card with the authored title and body on start', () => {
        const params = { title: 'Refund window', body: 'Refunds are accepted within 30 days of purchase.' };
        hoverCardHandlers()['preset.hover-card']!(actionEvent('hover', params));
        const lines = [...document.querySelectorAll('[data-slot="preset-hover-card"] p')].map((p) => p.textContent?.trim());
        expect(lines).toEqual(['Refund window', 'Refunds are accepted within 30 days of purchase.']);
    });

    it('grace area: moving the pointer into the card cancels the close timer', async () => {
        const handlers = hoverCardHandlers({ closeDelay: 20 });
        handlers['preset.hover-card']!(actionEvent('hover', { body: 'B' }));
        const card = slot('preset-hover-card')!.closest<HTMLElement>('.preset-overlay')!;
        handlers['preset.hover-card']!(actionEvent('hover', { body: 'B' }, 'end'));
        card.dispatchEvent(new MouseEvent('mouseenter'));
        await wait(40);
        expect(slot('preset-hover-card')).not.toBeNull();
    });

    it('closes after the delay when the pointer leaves', async () => {
        const handlers = hoverCardHandlers({ closeDelay: 10 });
        handlers['preset.hover-card']!(actionEvent('hover', { body: 'B' }));
        handlers['preset.hover-card']!(actionEvent('hover', { body: 'B' }, 'end'));
        await wait(40);
        expect(slot('preset-hover-card')).toBeNull();
    });

    it('Escape closes the card', () => {
        hoverCardHandlers()['preset.hover-card']!(actionEvent('hover', { body: 'B' }));
        expect(slot('preset-hover-card')).not.toBeNull();
        escape();
        expect(slot('preset-hover-card')).toBeNull();
    });

    it('teardown on abort removes any open card', () => {
        const controller = new AbortController();
        hoverCardHandlers({ signal: controller.signal })['preset.hover-card']!(actionEvent('hover', { body: 'B' }));
        expect(slot('preset-hover-card')).not.toBeNull();
        controller.abort();
        expect(slot('preset-hover-card')).toBeNull();
    });
});

describe('open-dialog preset', () => {
    it('opens a dialog on click and fires onConfirm with params', () => {
        const onConfirm = vi.fn();
        openDialogHandlers({ onConfirm })['preset.open-dialog']!(actionEvent('click', { title: 'T', body: 'B', confirmLabel: 'Go' }));
        expect(document.body.textContent).toContain('B');
        const confirm = document.querySelector<HTMLElement>('[data-testid="preset-dialog-confirm"]');
        expect(confirm?.textContent).toBe('Go');
        confirm!.click();
        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'T', body: 'B' }));
        expect(slot('preset-dialog')).toBeNull();
    });

    it('renders a custom content element with the params', () => {
        class Body extends HTMLElement {
            params: ActionParams = {};
            connectedCallback(): void {
                this.textContent = String(this.params['body']);
            }
        }
        customElements.define('x-preset-body', Body);
        openDialogHandlers({ contentTag: 'x-preset-body' })['preset.open-dialog']!(actionEvent('click', { body: 'from-property' }));
        expect(document.querySelector('x-preset-body')?.textContent).toBe('from-property');
    });

    it('two dialog presets with custom ids coexist and compose with custom handlers', () => {
        const handlers = { ...openDialogHandlers({ id: 'dialog.a' }), ...openDialogHandlers({ id: 'dialog.b' }), custom: vi.fn() };
        expect(Object.keys(handlers).sort((a, b) => a.localeCompare(b))).toEqual(['custom', 'dialog.a', 'dialog.b']);
        expect(openDialogAction({ id: 'dialog.a' }).id).toBe('dialog.a');
    });

    it('dismisses on the Close button and on the backdrop', () => {
        const open = openDialogHandlers()['preset.open-dialog']!;
        open(actionEvent('click', { title: 'T' }));
        document.querySelector<HTMLElement>('[data-slot="preset-dialog"] ge-button:not([data-testid])')!.click();
        expect(slot('preset-dialog')).toBeNull();
        open(actionEvent('click', { title: 'T' }));
        document.querySelector<HTMLElement>('[data-slot="preset-dialog"] .backdrop')!.click();
        expect(slot('preset-dialog')).toBeNull();
    });

    it('teardown on abort removes any open dialog', () => {
        const controller = new AbortController();
        openDialogHandlers({ signal: controller.signal })['preset.open-dialog']!(actionEvent('click', { title: 'T', body: 'B' }));
        expect(slot('preset-dialog')).not.toBeNull();
        controller.abort();
        expect(slot('preset-dialog')).toBeNull();
    });
});

describe('linked-preview-dialog preset', () => {
    const id = linkedPreviewDialogAction().id;
    const params = { title: 'SLA', body: 'Service level' };

    it('hover start renders a preview card; click opens a dialog', () => {
        const handlers = linkedPreviewDialogHandlers();
        expect(Object.keys(handlers)).toEqual([id]);
        handlers[id]!(actionEvent('hover', params));
        expect(slot('preset-hover-card')).not.toBeNull();
        handlers[id]!(actionEvent('click', params));
        expect(slot('preset-dialog')).not.toBeNull();
    });

    it('reuses hover-card Esc-close logic (delegates, does not reimplement)', () => {
        linkedPreviewDialogHandlers({ closeDelay: 20 })[id]!(actionEvent('hover', params));
        expect(slot('preset-hover-card')).not.toBeNull();
        escape();
        expect(slot('preset-hover-card')).toBeNull();
    });

    it('reuses open-dialog Esc-to-dismiss logic (delegates, does not reimplement)', () => {
        linkedPreviewDialogHandlers()[id]!(actionEvent('click', params));
        expect(slot('preset-dialog')).not.toBeNull();
        escape();
        expect(slot('preset-dialog')).toBeNull();
    });

    it('one signal closes both the card and the dialog', () => {
        const controller = new AbortController();
        const handler = linkedPreviewDialogHandlers({ signal: controller.signal })[id]!;
        handler(actionEvent('hover', params));
        handler(actionEvent('click', params));
        controller.abort();
        expect([slot('preset-hover-card'), slot('preset-dialog')]).toEqual([null, null]);
    });
});

describe('anchorOverlay', () => {
    interface Rect { left: number; top: number; bottom: number; width: number; height: number }

    const anchorAt = (rect: Rect): HTMLElement => ({ getBoundingClientRect: () => rect }) as unknown as HTMLElement;

    function overlayOf(width: number, height: number, vw: number, vh: number): HTMLElement {
        return {
            style: { left: '', top: '' },
            getBoundingClientRect: () => ({ width, height, left: 0, top: 0, bottom: 0, right: 0 }),
            ownerDocument: { documentElement: { clientWidth: vw, clientHeight: vh } },
        } as unknown as HTMLElement;
    }

    it('places the overlay just below the anchor when it fits', () => {
        const overlay = overlayOf(200, 100, 1000, 600);
        anchorOverlay(overlay, anchorAt({ left: 100, top: 100, bottom: 120, width: 30, height: 20 }));
        expect(overlay.style.left).toBe('100px');
        expect(overlay.style.top).toBe('126px');
    });

    it('clamps horizontally so the overlay never overflows the right edge', () => {
        const overlay = overlayOf(200, 100, 1000, 600);
        anchorOverlay(overlay, anchorAt({ left: 950, top: 100, bottom: 120, width: 30, height: 20 }));
        expect(overlay.style.left).toBe('792px');
    });

    it('flips above the anchor when there is no room below', () => {
        const overlay = overlayOf(200, 100, 1000, 600);
        anchorOverlay(overlay, anchorAt({ left: 100, top: 550, bottom: 570, width: 30, height: 20 }));
        expect(overlay.style.top).toBe('444px');
    });

    it('clamps to the viewport when it fits neither below nor above', () => {
        const overlay = overlayOf(200, 590, 1000, 600);
        anchorOverlay(overlay, anchorAt({ left: 100, top: 300, bottom: 320, width: 30, height: 20 }));
        expect(overlay.style.top).toBe('8px');
    });
});

describe('directionOf', () => {
    it('reads rtl from an element in an rtl subtree, ltr otherwise', () => {
        const rtl = document.createElement('div');
        rtl.dir = 'rtl';
        const ltr = document.createElement('div');
        document.body.append(rtl, ltr);
        expect(directionOf(rtl)).toBe('rtl');
        expect(directionOf(ltr)).toBe('ltr');
        rtl.remove();
        ltr.remove();
    });
});

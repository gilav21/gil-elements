import { render } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AI_LOCALES } from './ai-locale.js';
import { renderAiChip, renderAiPanel, type AiViewModel } from './ai-view.js';

const host = document.createElement('div');
document.body.append(host);

function model(patch: Partial<AiViewModel> = {}): AiViewModel {
    const vm: AiViewModel = {
        locale: AI_LOCALES.en,
        tasks: [
            { task: 'rewrite', label: 'Improve writing' },
            { task: 'summarize', label: 'Summarize' },
        ],
        chip: null,
        panel: { x: 5, y: 6 },
        phase: 'menu',
        error: null,
        prompt: '',
        setPrompt: vi.fn((prompt: string) => {
            vm.prompt = prompt;
        }),
        openPanel: vi.fn(),
        runTask: vi.fn(),
        runCustom: vi.fn(),
        accept: vi.fn(),
        discard: vi.fn(),
        retryLast: vi.fn(),
        ...patch,
    };
    return vm;
}

const slot = (name: string) => host.querySelector<HTMLElement>(`[data-slot="${name}"]`);

afterEach(() => render(undefined, host));

describe('ai chip', () => {
    it('renders the localized trigger at the chip position when visible', () => {
        render(renderAiChip(model({ chip: { x: 12, y: 34 } })), host);
        const button = slot('rich-text-ai-trigger')!;
        expect(button.textContent).toContain('Ask AI');
        expect(button.style.left).toBe('12px');
        expect(button.style.top).toBe('34px');
    });

    it('opens the panel when the trigger is clicked', () => {
        const vm = model({ chip: { x: 0, y: 0 } });
        render(renderAiChip(vm), host);
        slot('rich-text-ai-trigger')!.click();
        expect(vm.openPanel).toHaveBeenCalledTimes(1);
    });

    it('keeps the editor selection when the trigger is pressed', () => {
        render(renderAiChip(model({ chip: { x: 0, y: 0 } })), host);
        const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        slot('rich-text-ai-trigger')!.dispatchEvent(press);
        expect(press.defaultPrevented).toBe(true);
    });

    it('hides the trigger when the chip is not visible', () => {
        render(renderAiChip(model({ chip: null })), host);
        expect(slot('rich-text-ai-trigger')).toBeNull();
    });
});

describe('ai panel', () => {
    it('lists the menu task buttons and runs one on click', () => {
        const vm = model();
        render(renderAiPanel(vm), host);
        const buttons = slot('rich-text-ai-menu')!.querySelectorAll(':scope > button');
        expect(buttons).toHaveLength(2);
        buttons[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(vm.runTask).toHaveBeenCalledWith('summarize');
    });

    it('positions the panel and names it for assistive technology', () => {
        render(renderAiPanel(model()), host);
        const panel = slot('rich-text-ai-panel')!;
        expect([panel.style.left, panel.style.top, panel.getAttribute('role'), panel.getAttribute('aria-label')]).toEqual(['5px', '6px', 'dialog', 'AI assistant']);
    });

    it('forwards the typed prompt, runs it on Enter or Go, and keeps Go disabled while blank', () => {
        const vm = model();
        const draw = () => render(renderAiPanel(vm), host);
        draw();
        const go = () => slot('rich-text-ai-menu')!.querySelector<HTMLButtonElement>('.ai-prompt button')!;
        expect(go().disabled).toBe(true);

        const input = slot('rich-text-ai-menu')!.querySelector('input')!;
        input.value = 'make it formal';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        expect(vm.setPrompt).toHaveBeenCalledWith('make it formal');
        draw();
        expect(go().disabled).toBe(false);
        go().click();
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(vm.runCustom).toHaveBeenCalledTimes(2);
    });

    it('shows the streaming status while loading and disables Accept and Try again', () => {
        render(renderAiPanel(model({ phase: 'loading' })), host);
        expect(slot('rich-text-ai-loading')?.textContent).toContain('Generating');
        const [accept, discard, retry] = slot('rich-text-ai-review')!.querySelectorAll('button');
        expect([accept!.disabled, discard!.disabled, retry!.disabled]).toEqual([true, false, true]);
    });

    it('renders the error and wires the review controls', () => {
        const vm = model({ phase: 'review', error: 'boom' });
        render(renderAiPanel(vm), host);
        expect(slot('rich-text-ai-error')?.textContent).toContain('boom');
        for (const button of slot('rich-text-ai-review')!.querySelectorAll('button')) button.click();
        expect([vm.accept, vm.discard, vm.retryLast].map((fn) => vi.mocked(fn).mock.calls.length)).toEqual([1, 1, 1]);
    });

    it('does not render when the panel is closed', () => {
        render(renderAiPanel(model({ panel: null })), host);
        expect(slot('rich-text-ai-panel')).toBeNull();
    });
});

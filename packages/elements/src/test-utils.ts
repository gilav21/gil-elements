import { afterEach } from 'vitest';
import type { LitElement } from 'lit';

const mounted: HTMLElement[] = [];

afterEach(() => {
    for (const el of mounted.splice(0)) el.remove();
    document.documentElement.classList.remove('dark');
    document.body.style.background = '';
    document.body.style.color = '';
});

/**
 * Mounts markup the way a page author writes it and waits for every Lit element in it to finish
 * its first render. Returns the wrapper, so tests can query what they mounted.
 */
export async function mount(markup: string): Promise<HTMLElement> {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = markup;
    document.body.append(wrapper);
    mounted.push(wrapper);
    const lit = [...wrapper.querySelectorAll('*')].filter((el): el is LitElement => 'updateComplete' in el);
    await Promise.all(lit.map((el) => el.updateComplete));
    return wrapper;
}

/** Resolves a token to the colour the browser actually paints, whatever its source syntax (oklch, color-mix). */
export function paintedToken(token: string, at: Element): string {
    const probe = document.createElement('span');
    probe.style.color = `var(${token})`;
    at.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
}

/** Switches the page between the light and dark theme the way a consumer does: a `dark` class plus the page colours. */
export function useTheme(mode: string): void {
    document.documentElement.classList.toggle('dark', mode === 'dark');
    document.body.style.background = 'var(--background)';
    document.body.style.color = 'var(--foreground)';
}

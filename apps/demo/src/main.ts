import '@gilav21/elements-base/tokens.css';
import './demo.css';
import '@gilav21/elements/alert/define';
import '@gilav21/elements/avatar/define';
import '@gilav21/elements/badge/define';
import '@gilav21/elements/button/define';
import '@gilav21/elements/button-group/define';
import '@gilav21/elements/card/define';
import '@gilav21/elements/checkbox/define';
import '@gilav21/elements/empty/define';
import '@gilav21/elements/input/define';
import '@gilav21/elements/kbd/define';
import '@gilav21/elements/label/define';
import '@gilav21/elements/progress/define';
import '@gilav21/elements/switch/define';
import '@gilav21/elements/toggle/define';
import '@gilav21/elements/textarea/define';
import '@gilav21/elements/radio-group/define';
import '@gilav21/elements/aspect-ratio/define';
import '@gilav21/elements/rating/define';
import '@gilav21/elements/slider/define';
import '@gilav21/elements/number-input/define';
import '@gilav21/elements/toggle-group/define';
import '@gilav21/elements/collapsible/define';
import '@gilav21/elements/accordion/define';
import '@gilav21/elements/tabs/define';
import '@gilav21/elements/breadcrumb/define';
import '@gilav21/elements/pagination/define';
import '@gilav21/elements/stepper/define';
import '@gilav21/elements/timeline/define';
import '@gilav21/elements/dialog/define';
import '@gilav21/elements/page-header/define';
import '@gilav21/elements/separator/define';
import '@gilav21/elements/skeleton/define';
import '@gilav21/elements/spinner/define';
import type { GeSlider } from '@gilav21/elements/slider';
import { demos, type Demo, type Example } from './demos.js';

const escapeHtml = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
// Prose may mark code with `backticks`; it is escaped first, so only these tags can appear.
const prose = (s: string) => escapeHtml(s).replaceAll(/`([^`]+)`/g, '<code>$1</code>');

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, html = ''): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    node.innerHTML = html;
    return node;
}

function renderExample(ex: Example): HTMLElement {
    const wrap = el('div', { class: 'example' });
    wrap.append(el('h3', {}, ex.title));
    if (ex.note) wrap.append(el('p', { class: 'note' }, prose(ex.note)));
    const preview = el('div', { class: ex.block ? 'preview block' : 'preview' }, ex.html);
    // Scripts set through innerHTML never run, so each is swapped for a fresh copy that does.
    for (const dead of preview.querySelectorAll('script')) {
        const live = document.createElement('script');
        live.type = dead.type;
        live.textContent = dead.textContent;
        dead.replaceWith(live);
    }
    wrap.append(preview);
    const code = el('div', { class: 'code' }, `<pre><code>${escapeHtml(ex.html)}</code></pre>`);
    const copy = document.createElement('ge-button');
    copy.setAttribute('variant', 'outline');
    copy.setAttribute('size', 'sm');
    copy.textContent = 'Copy';
    copy.addEventListener('click', async () => {
        await navigator.clipboard.writeText(ex.html);
        copy.textContent = 'Copied';
        setTimeout(() => (copy.textContent = 'Copy'), 1200);
    });
    // ge-button draws no box of its own, so the corner placement goes on a wrapper.
    const corner = el('div', { class: 'copy' });
    corner.append(copy);
    code.append(corner);
    wrap.append(code);
    return wrap;
}

function renderApi(demo: Demo): HTMLElement {
    const rows = demo.api
        .map(
            (r) =>
                `<tr><td><code>${escapeHtml(r.name)}</code></td><td><code>${escapeHtml(r.type)}</code></td><td><code>${escapeHtml(r.default)}</code></td><td>${prose(r.description)}</td></tr>`,
        )
        .join('');
    return el(
        'div',
        {},
        `<h4 class="api-title">API</h4><div class="table-scroll"><table class="api"><thead><tr><th>Name</th><th>Type</th><th>Default</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    );
}

function renderSection(demo: Demo): HTMLElement {
    const section = el('section', { class: 'component', id: demo.id });
    section.append(el('h2', {}, demo.name));
    section.append(el('p', { class: 'lede' }, `<code>&lt;${demo.tag}&gt;</code> ${prose(demo.description)}`));
    for (const ex of demo.examples) section.append(renderExample(ex));
    section.append(renderApi(demo));
    return section;
}

const content = document.getElementById('content')!;
content.append(...demos.map(renderSection));

const nav = document.getElementById('nav')!;
let group = '';
for (const d of demos) {
    if (d.group !== group) nav.append(el('div', { class: 'nav-group' }, (group = d.group)));
    nav.append(el('a', { class: 'nav-link', href: `#${d.id}` }, d.name));
}

// Highlight the section nearest the top of the viewport.
const links = new Map([...nav.querySelectorAll<HTMLAnchorElement>('a')].map((a) => [a.hash.slice(1), a]));
const observer = new IntersectionObserver(
    (entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            for (const [id, a] of links) a.setAttribute('aria-current', String(id === entry.target.id));
        }
    },
    { rootMargin: '-10% 0px -80% 0px' },
);
for (const s of content.querySelectorAll('section')) observer.observe(s);

const root = document.documentElement;
const sidebar = document.getElementById('sidebar')!;
const menu = document.getElementById('menu')!;
menu.addEventListener('click', () => {
    const open = sidebar.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open));
});
nav.addEventListener('click', () => sidebar.classList.remove('open'));

function toggle(id: string, apply: (on: boolean) => void) {
    const btn = document.getElementById(id)!;
    btn.addEventListener('click', () => {
        const on = btn.getAttribute('aria-pressed') !== 'true';
        btn.setAttribute('aria-pressed', String(on));
        btn.setAttribute('variant', on ? 'default' : 'outline');
        apply(on);
    });
}
// The tokens match `.dark` or `[data-theme="dark"]`. A host page that embeds this one (the artifact viewer
// sets `data-theme="dark"` on the root) may already have put its own theme there, so the button follows what is actually applied
// instead of keeping its own flag, and the theme is set on the body too in case the root's class is rewritten.
const themeButton = document.getElementById('theme')!;
const isDark = () => [root, document.body].some((el) => el.classList.contains('dark') || el.dataset.theme === 'dark');
function showTheme() {
    const on = isDark();
    themeButton.setAttribute('aria-pressed', String(on));
    themeButton.setAttribute('variant', on ? 'default' : 'outline');
}
themeButton.addEventListener('click', () => {
    const on = !isDark();
    for (const el of [root, document.body]) {
        el.classList.toggle('dark', on);
        el.dataset.theme = on ? 'dark' : 'light';
    }
    root.style.colorScheme = on ? 'dark' : 'light';
    showTheme();
});
new MutationObserver(showTheme).observe(root, { attributes: true, attributeFilter: ['class', 'data-theme'] });
showTheme();
toggle('rtl', (on) => root.setAttribute('dir', on ? 'rtl' : 'ltr'));

const density = document.getElementById('density') as GeSlider;
const densityOut = document.getElementById('density-out')!;
density.addEventListener('input', () => {
    root.style.setProperty('--density', String(density.value));
    densityOut.textContent = String(density.value);
});

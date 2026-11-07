import { ref as buttonRef } from '../lib/button-ref.mjs';
// shadcn-angular code-block.component.html, copied with the compact whitespace it relies on. The tokens are the
// output of the (verbatim) tokenizer for each sample, written out so the reference does not depend on the port.
const SAMPLES = {"ts":{"lang":"typescript","code":"function greet(name: string) {\n  if (name) {\n    return `Hello ${name}`;\n  }\n  return 'hi'; // fallback\n}","lines":[[{"type":"keyword","text":"function"},{"type":"text","text":" "},{"type":"function","text":"greet"},{"type":"text","text":"(name: string) {"}],[{"type":"text","text":"  "},{"type":"keyword","text":"if"},{"type":"text","text":" (name) {"}],[{"type":"text","text":"    "},{"type":"keyword","text":"return"},{"type":"text","text":" `Hello ${name}`;"}],[{"type":"text","text":"  }"}],[{"type":"text","text":"  "},{"type":"keyword","text":"return"},{"type":"text","text":" "},{"type":"string","text":"'hi'"},{"type":"text","text":"; "},{"type":"comment","text":"// fallback"}],[{"type":"text","text":"}"}]]},"py":{"lang":"python","code":"def total(items):\n    result = 0\n    for item in items:\n        result += item\n    return result","lines":[[{"type":"keyword","text":"def"},{"type":"text","text":" "},{"type":"function","text":"total"},{"type":"text","text":"(items):"}],[{"type":"text","text":"    result = "},{"type":"number","text":"0"}],[{"type":"text","text":"    "},{"type":"keyword","text":"for"},{"type":"text","text":" item in items:"}],[{"type":"text","text":"        result += item"}],[{"type":"text","text":"    "},{"type":"keyword","text":"return"},{"type":"text","text":" result"}]]},"html":{"lang":"html","code":"<div class=\"card\">\n  <p id=\"x\">Hi</p>\n</div>","lines":[[{"type":"tag","text":"<div"},{"type":"text","text":" "},{"type":"attr","text":"class"},{"type":"text","text":"="},{"type":"string","text":"\"card\""},{"type":"text","text":">"}],[{"type":"text","text":"  "},{"type":"tag","text":"<p"},{"type":"text","text":" "},{"type":"attr","text":"id"},{"type":"text","text":"="},{"type":"string","text":"\"x\""},{"type":"text","text":">Hi"},{"type":"tag","text":"</p"},{"type":"text","text":">"}],[{"type":"tag","text":"</div"},{"type":"text","text":">"}]]},"json":{"lang":"json","code":"{\n  \"name\": \"ge\",\n  \"count\": 3\n}","lines":[[{"type":"text","text":"{"}],[{"type":"text","text":"  "},{"type":"function","text":"\"name\":"},{"type":"text","text":" "},{"type":"string","text":"\"ge\""},{"type":"text","text":","}],[{"type":"text","text":"  "},{"type":"function","text":"\"count\":"},{"type":"text","text":" "},{"type":"number","text":"3"}],[{"type":"text","text":"}"}]]}};

const TOKEN = {
    keyword: 'text-pink-400 font-bold', string: 'text-green-400', comment: 'text-gray-400 italic', number: 'text-orange-400',
    function: 'text-blue-400', decorator: 'text-yellow-400', tag: 'text-pink-400', attr: 'text-blue-400 italic',
    selector: 'text-pink-400 font-bold', property: 'text-blue-400',
};
const DRACULA = { keyword: 'text-pink-400 font-bold', string: 'text-yellow-200', comment: 'text-purple-400 italic', function: 'text-green-400' };
const DRACULA_CSS = { keyword: 'color: oklch(71.8% 0.202 349.761); font-weight: 700', string: 'color: oklch(94.5% 0.129 101.54)', comment: 'color: oklch(71.4% 0.203 305.504); font-style: italic', function: 'color: oklch(79.2% 0.209 151.711)' };
const COPY = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const CHECK = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3 text-green-500"><polyline points="20 6 9 17 4 12"/></svg>';
const FOLD = 'relative cursor-pointer hover:text-zinc-300 pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-3';
const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const ref = ({ key = 'ts', numbers = true, fold = false, folds = [], collapsed = [], theme = null, rtl = false, copied = false, label = 'Copy' }) => {
    const { lang, lines } = SAMPLES[key];
    const hidden = new Set();
    for (const start of collapsed) for (let i = start + 1; i <= folds.find((f) => f[0] === start)[1]; i++) hidden.add(i);
    const digits = String(lines.length).length;
    const rows = lines.map((tokens, i) => {
        if (hidden.has(i)) return '';
        const isFold = fold && folds.some((f) => f[0] === i);
        const open = !collapsed.includes(i);
        const num = numbers ? `<span class="inline-block shrink-0 me-3 select-none text-zinc-400 leading-5 text-right tabular-nums" style="width: ${digits}ch" data-slot="code-block-line-number" aria-hidden="true">${i + 1}</span>` : '';
        const chevron = fold ? `<span class="inline-block w-4 pointer-coarse:w-11 shrink-0 me-2 select-none text-zinc-500 leading-5 text-center${isFold ? ` ${FOLD}` : ''}"${isFold ? ` role="button" tabindex="0" aria-expanded="${open}" aria-label="${open ? 'Collapse scope' : 'Expand scope'}"` : ''} data-slot="code-block-chevron">${isFold ? (open ? '▾' : '▸') : ''}</span>` : '';
        const spans = tokens.map((t) => `<span class="${theme?.[t.type] ?? TOKEN[t.type] ?? 'text-zinc-50'}">${esc(t.text)}</span>`).join('');
        const marker = isFold && !open ? '<span class="text-zinc-500 ms-1" data-slot="code-block-collapsed-marker">…</span>' : '';
        return `<div class="flex items-start">${num}${chevron}<span class="flex-1 whitespace-pre">${spans}${marker}</span></div>`;
    }).join('');
    const button = buttonRef('ghost', 'icon', copied ? CHECK : COPY, { extra: 'h-6 w-6 pointer-coarse:size-11 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800' })
        .replace(' hover:bg-muted hover:text-foreground', '')
        .replace('type="button" data-slot="button"', `type="button" data-slot="button" aria-label="${label}"`);
    return `<ui-code-block><div class="relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 my-4 text-left" data-slot="code-block" dir="${rtl ? 'rtl' : 'ltr'}"><div class="flex items-center justify-between bg-zinc-900 px-4 py-2 border-b border-zinc-800"><span class="text-xs text-zinc-400 font-mono">${lang}</span>${button}</div><div dir="ltr" class="p-4 overflow-auto font-mono text-sm bg-zinc-950 text-zinc-50"><pre><code class="language-${lang}">${rows}</code></pre></div></div></ui-code-block>`;
};
const el = ({ key = 'ts', numbers = true, fold = false, defaultCollapsed, theme, locale, copied = false }) => {
    const { lang, code } = SAMPLES[key];
    return `<ge-code-block language="${lang}" code="${code.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"${numbers ? '' : ' line-numbers="false"'}${fold ? ' collapse-scope' : ''}${defaultCollapsed === undefined ? '' : ` default-collapsed="${defaultCollapsed}"`}${theme ? ` data-theme-json='${JSON.stringify(theme)}'` : ''}${locale ? ` locale="${locale}"` : ''}${copied ? ' data-copied' : ''}></ge-code-block>`;
};
const TS_FOLDS = [[0, 5], [1, 3]];
const PY_FOLDS = [[0, 4], [2, 3]];
const HTML_FOLDS = [[0, 2]];

export default {
    name: 'code-block',
    items: [
        { id: 'typescript', ref: ref({}), el: el({}) },
        { id: 'no-line-numbers', ref: ref({ numbers: false }), el: el({ numbers: false }) },
        { id: 'python', ref: ref({ key: 'py' }), el: el({ key: 'py' }) },
        { id: 'html', ref: ref({ key: 'html' }), el: el({ key: 'html' }) },
        { id: 'json', ref: ref({ key: 'json' }), el: el({ key: 'json' }) },
        { id: 'fold-open', ref: ref({ fold: true, folds: TS_FOLDS }), el: el({ fold: true }) },
        { id: 'fold-collapsed', ref: ref({ fold: true, folds: TS_FOLDS, collapsed: [1] }), el: el({ fold: true, defaultCollapsed: 1 }) },
        { id: 'fold-all-collapsed', ref: ref({ fold: true, folds: TS_FOLDS, collapsed: [0, 1] }), el: el({ fold: true, defaultCollapsed: 0 }) },
        { id: 'fold-indent', ref: ref({ key: 'py', fold: true, folds: PY_FOLDS, collapsed: [2] }), el: el({ key: 'py', fold: true, defaultCollapsed: 1 }) },
        { id: 'fold-tags', ref: ref({ key: 'html', fold: true, folds: HTML_FOLDS }), el: el({ key: 'html', fold: true }) },
        { id: 'fold-no-numbers', ref: ref({ numbers: false, fold: true, folds: TS_FOLDS }), el: el({ numbers: false, fold: true }) },
        { id: 'theme', ref: ref({ theme: DRACULA }), el: el({ theme: DRACULA_CSS }) },
        { id: 'copied', ref: ref({ copied: true, label: 'Copied' }), el: el({ copied: true }) },
        { id: 'rtl', ref: ref({ rtl: true, label: 'העתק' }), el: el({ locale: 'he' }) },
        { id: 'focus-copy', focus: { ref: 'button', el: 'ge-button' }, ref: ref({}), el: el({}) },
        { id: 'focus-fold', fold: true, focus: { ref: '[role=button]', el: '[role=button]' }, ref: ref({ fold: true, folds: TS_FOLDS }), el: el({ fold: true }) },
    ],
};

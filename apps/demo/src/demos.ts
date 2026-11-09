/**
 * Every example is one HTML string. The preview is that string set as innerHTML and the code
 * block is the same string escaped, so what you read is exactly what runs and they cannot drift.
 */
export interface Example {
    title: string;
    note?: string;
    html: string;
    /** Render the preview as a block instead of a wrapping flex row (for full-width elements). */
    block?: boolean;
}

export interface ApiRow {
    name: string;
    type: string;
    default: string;
    description: string;
}

export interface Demo {
    id: string;
    group: string;
    name: string;
    tag: string;
    description: string;
    examples: Example[];
    api: ApiRow[];
}

const sbIcon = (d: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const SB_HOME = sbIcon('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>');
const SB_MAIL = sbIcon('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-10 5L2 7"/>');
const SB_CAL = sbIcon('<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>');
const SB_SET = sbIcon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>');
const SB_FOLDER = sbIcon('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>');
const SB_USERS = sbIcon('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>');
const SB_MORE = sbIcon('<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>');
const SB_BOX = 'height:400px;overflow:hidden;border:1px solid var(--border);border-radius:var(--radius)';
const SB_TILE = (variant: string, collapsible: string, name: string) => `<div style="height:260px;overflow:hidden;border:1px solid var(--border);border-radius:var(--radius);background:color-mix(in oklab, var(--muted) 20%, transparent)">
  <ge-sidebar-provider>
    <ge-sidebar${variant === 'sidebar' ? '' : ` variant="${variant}"`}${collapsible}>
      <ge-sidebar-header><div style="font-weight:600">Acme Inc</div></ge-sidebar-header>
      <ge-sidebar-content><ge-sidebar-group><ge-sidebar-group-content><ge-sidebar-menu>
        <ge-sidebar-menu-item><ge-sidebar-menu-link active>${SB_HOME}<span>Home</span></ge-sidebar-menu-link></ge-sidebar-menu-item>
        <ge-sidebar-menu-item><ge-sidebar-menu-link>${SB_SET}<span>Settings</span></ge-sidebar-menu-link></ge-sidebar-menu-item>
      </ge-sidebar-menu></ge-sidebar-group-content></ge-sidebar-group></ge-sidebar-content>
    </ge-sidebar>
    <ge-sidebar-inset><header style="display:flex;min-height:3rem;flex-wrap:wrap;align-items:center;gap:.5rem;border-bottom:1px solid var(--border);padding:.5rem 1rem"><ge-sidebar-trigger></ge-sidebar-trigger><span style="font-size:.875rem;font-weight:500">${name}</span></header></ge-sidebar-inset>
  </ge-sidebar-provider>
</div>`;

export const demos: Demo[] = [
    {
        id: 'rich-text-editor',
        group: 'Form inputs',
        name: 'Rich text editor',
        tag: 'ge-rich-text-editor',
        description: 'A form-associated rich text editor. `value` is Markdown (or HTML with `mode="html"`); the toolbar, find and replace, tables, lists, task lists, code blocks and Markdown shortcuts (type `# `, `- `, `> `, `**bold**`) are built in. Addons plug in as separate modules.',
        examples: [
            {
                title: 'Markdown with a toolbar',
                note: 'Edits fire `value-change` with `{ value, html, markdown }`. Writing `value` yourself never does. Try `Ctrl+B`, `Ctrl+F`, `Ctrl+Z`, a table from the toolbar, or typing `## ` at the start of a line.',
                block: true,
                html: `<ge-rich-text-editor id="rte1" counter="both" placeholder="Write something..." style="display:block;max-width:44rem"></ge-rich-text-editor>
<pre id="rte1-out" style="margin-top:.75rem;max-height:9rem;overflow:auto;font-size:.8rem"></pre>
<script>(() => {
  const rte = document.getElementById('rte1');
  const out = document.getElementById('rte1-out');
  rte.value = '# Hello\\n\\nThis is **bold**, *italic* and \`code\`.\\n\\n- one\\n- two\\n\\n- [ ] a task\\n- [x] a done task';
  const show = () => { out.textContent = rte.markdownOutput; };
  rte.addEventListener('value-change', show);
  show();
})();</script>`,
            },
            {
                title: 'Floating toolbar, HTML mode',
                note: '`toolbar="floating"` shows a compact bar next to a selection. `mode="html"` makes `value` HTML (sanitized). Select some text.',
                block: true,
                html: `<ge-rich-text-editor id="rte2" mode="html" toolbar="floating" min-height="8rem" style="display:block;max-width:44rem"></ge-rich-text-editor>
<script>document.getElementById('rte2').value = '<p>Select a few words to format them.</p><blockquote><p>A quote</p></blockquote><p>Press Enter twice in a list to leave it.</p>';</script>`,
            },
            {
                title: 'In a form: required, word and length limits',
                note: 'The editor is form-associated: `required`, `min-words` and `max-length` set its validity, and its value is submitted under `name`.',
                block: true,
                html: `<form id="rte3-form" style="display:grid;gap:.75rem;max-width:44rem">
  <ge-rich-text-editor name="story" required min-words="5" max-length="200" counter="characters" placeholder="At least five words, at most 200 characters"></ge-rich-text-editor>
  <div style="display:flex;gap:.5rem;align-items:center">
    <ge-button type="submit">Submit</ge-button>
    <ge-button type="reset" variant="outline">Reset</ge-button>
    <span id="rte3-status" style="font-size:.875rem;color:var(--muted-foreground)"></span>
  </div>
</form>
<script>(() => {
  const form = document.getElementById('rte3-form');
  const status = document.getElementById('rte3-status');
  const rte = form.querySelector('ge-rich-text-editor');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    status.textContent = rte.checkValidity() ? 'Submitted ' + String(new FormData(form).get('story')).length + ' characters' : rte.validationMessage;
  });
})();</script>`,
            },
            {
                title: 'Right-to-left, with a locale',
                note: 'Locales are opt-in modules: this page imports `@gilav21/elements/rich-text-editor/locales/he`. `dir` follows the locale.',
                block: true,
                html: `<ge-rich-text-editor locale="he" placeholder="כתבו משהו..." style="display:block;max-width:44rem"></ge-rich-text-editor>`,
            },
            {
                title: 'Read-only and disabled',
                note: '`readonly` keeps the text selectable and hides the toolbar; `disabled` blocks everything and dims it.',
                block: true,
                html: `<div style="display:grid;gap:.75rem;max-width:44rem">
  <ge-rich-text-editor id="rte5a" readonly></ge-rich-text-editor>
  <ge-rich-text-editor id="rte5b" disabled></ge-rich-text-editor>
</div>
<script>document.getElementById('rte5a').value = document.getElementById('rte5b').value = '**Read only.** You can select this text but not change it.';</script>`,
            },
        ],
        api: [
            { name: 'value / mode', type: "string / 'markdown' | 'html'", default: "'' / 'markdown'", description: 'The content, in the `mode` format. Writing `value` replaces the content without firing `value-change`.' },
            { name: 'toolbar', type: "'top' | 'floating' | 'none'", default: "'top'", description: 'Where the formatting toolbar goes. `readonly` hides it.' },
            { name: 'counter', type: "'characters' | 'words' | 'both'", default: '-', description: 'A live counter below the editor.' },
            { name: 'name / required / min-words / max-length', type: 'form', default: '-', description: 'Form field name and validity rules. `max-length` is advisory while typing and enforced by validity.' },
            { name: 'placeholder / min-height / max-height', type: 'string', default: "- / '120px' / '400px'", description: 'Hint while empty and the editable area size limits.' },
            { name: 'readonly / disabled', type: 'boolean', default: 'false', description: 'Selectable but not editable / blocked and dimmed.' },
            { name: 'markdown-shortcuts', type: 'boolean', default: 'true', description: '`false` turns typed Markdown markers off.' },
            { name: 'locale / dir', type: 'string', default: "'en'", description: 'A locale id (import its module first) or a `RichTextLocale` object through the property; `dir` follows the locale unless set.' },
            { name: 'allowed-image-hosts / allowed-link-schemes', type: 'string', default: '-', description: 'Resource policy: hosts remote images may load from, extra link schemes.' },
            { name: 'toolbarItems / customToolbarItems / history / addons', type: 'properties', default: '-', description: 'Toolbar contents, custom buttons, undo-stack options and the ids of registered addons to enable.' },
            { name: 'focus() / insertText() / insertHtml() / format(cmd) / undo() / redo() / setContent() / markClean() / isEmpty()', type: 'methods', default: '-', description: 'The imperative API. Inserts are sanitized and each is one undo step.' },
            { name: 'htmlOutput / markdownOutput / characterCount / wordCount / isDirty / canUndo / canRedo', type: 'getters', default: '-', description: 'Derived state, current right after any write.' },
            { name: 'value-change / word-count-change / history-change / image-blocked / custom-toolbar-action', type: 'events', default: '-', description: '`value-change` carries `{ value, html, markdown }`. Native `input`, `change`, `focus` and `blur` fire too.' },
        ],
    },
    {
        id: 'rich-text-addons',
        group: 'Form inputs',
        name: 'Rich text editor: addons',
        tag: 'ge-rich-text-editor',
        description: 'Addons are opt-in modules that add toolbar buttons, slash commands and panels to the rich text editor. Import only the ones you use, or `@gilav21/elements/rich-text-editor/addons/full/define` for all thirteen, then list them in `addons`. Options are one object per addon id in `addonOptions`.',
        examples: [
            {
                title: 'Every addon: addons="full"',
                note: 'Enables history, slash commands, mentions, AI, typography, colors, links, images, tables, file import, emoji, actions and outline. Type `/` for the menu, `@` for people, select text and use Ask AI, or open the history panel with `Ctrl+Shift+H`. Mentions, AI, image upload and actions stay inactive until configured; all of that is wired below and runs offline.',
                block: true,
                html: `<ge-rich-text-editor id="rta1" mode="html" addons="full" min-height="12rem" style="display:block;max-width:56rem"></ge-rich-text-editor>
<script>(() => {
  const rte = document.getElementById('rta1');
  const people = [
    { value: 'ada', label: 'Ada Lovelace', description: 'Mathematician' },
    { value: 'alan', label: 'Alan Turing', description: 'Computer scientist' },
    { value: 'grace', label: 'Grace Hopper', description: 'Admiral' },
  ];
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  rte.addonOptions = {
    mentions: {
      search: (query) => people.filter((p) => p.label.toLowerCase().includes(query.toLowerCase())),
    },
    ai: {
      provider: async function* (request) {
        const words = ('This is a canned ' + request.task + ' reply for: ' + request.input).split(' ');
        let text = '';
        for (const word of words) {
          await wait(60);
          if (request.signal && request.signal.aborted) return;
          text = text ? text + ' ' + word : word;
          yield text;
        }
      },
    },
    images: {
      upload: {
        uploader: (file, signal) => new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }, 800);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
      },
    },
    actions: {
      definitions: [
        {
          id: 'say-hello',
          label: 'Say hello',
          triggers: ['click'],
          fields: [{ key: 'name', label: 'Name', type: 'text', required: true }],
        },
      ],
    },
  };
  rte.value = '<h2>Everything switched on</h2><p>Try <strong>/table</strong>, <strong>/link</strong> or <strong>/outline</strong>, mention @ada, or paste an image.</p>';
})();</script>`,
            },
            {
                title: 'Just two addons',
                note: '`addons="links slash-commands"` loads only those two. `Ctrl+K` and the toolbar button open the link form; `/` opens the command menu with the built-in block commands plus `/link`.',
                block: true,
                html: `<ge-rich-text-editor id="rta2" mode="html" addons="links slash-commands" min-height="8rem" style="display:block;max-width:44rem"></ge-rich-text-editor>
<script>document.getElementById('rta2').value = '<p>Select a word and press Ctrl+K, or type / on an empty line.</p>';</script>`,
            },
            {
                title: 'Floating toolbar with colors and typography',
                note: 'The bubble toolbar carries the addon buttons too. The panels keep the selection while they are open, so a color applies to what you selected.',
                block: true,
                html: `<ge-rich-text-editor id="rta3" mode="html" toolbar="floating" addons="colors typography" min-height="8rem" style="display:block;max-width:44rem"></ge-rich-text-editor>
<script>document.getElementById('rta3').value = '<p>Select some words, then pick a text color, a highlight, a font family or a size.</p>';</script>`,
            },
            {
                title: 'Mentions and tags',
                note: 'Type `@` to mention a person and `#` for a tag. `search` and `tagsSearch` may return an array or a Promise; `debounceMs` waits after the last keystroke. The inserted items carry `data-mention` and `data-tag`.',
                block: true,
                html: `<ge-rich-text-editor id="rta4" mode="html" addons="mentions" min-height="8rem" style="display:block;max-width:44rem"></ge-rich-text-editor>
<pre id="rta4-out" style="margin-top:.75rem;max-height:9rem;overflow:auto;font-size:.8rem"></pre>
<script>(() => {
  const rte = document.getElementById('rta4');
  const out = document.getElementById('rta4-out');
  const people = [
    { value: 'ada', label: 'Ada Lovelace' },
    { value: 'alan', label: 'Alan Turing' },
    { value: 'grace', label: 'Grace Hopper' },
  ];
  const tags = [
    { value: 'urgent', label: 'urgent', color: '#dc2626' },
    { value: 'idea', label: 'idea', color: '#16a34a' },
    { value: 'later', label: 'later', color: '#2563eb' },
  ];
  const match = (items) => (query) => items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  rte.addonOptions = { mentions: { search: match(people), tags: true, tagsSearch: match(tags), debounceMs: 100 } };
  rte.addEventListener('value-change', () => { out.textContent = rte.htmlOutput; });
  rte.value = '<p>Ping @ada about this and tag it #idea.</p>';
  out.textContent = rte.htmlOutput;
})();</script>`,
            },
            {
                title: 'Rendered content with actions',
                note: 'Content saved by the actions addon carries `data-action-*` attributes. `bindRichTextActions(container, { handlers })` makes them work on any page, with no editor: here the span below fires a handler on click and another while hovered.',
                block: true,
                html: `<div id="rta5" style="max-width:44rem;padding:1rem;border:1px solid var(--border);border-radius:var(--radius)">
  <p>Rendered HTML: <span data-action-click="say-hello" data-action-click-params='{"name":"Ada"}' style="text-decoration:underline;cursor:pointer">click me</span>, or hover <span data-action-hover="hint" data-action-hover-params='{"text":"A hover hint"}' style="text-decoration:underline dotted;cursor:help">this phrase</span>.</p>
</div>
<p id="rta5-out" style="margin-top:.5rem;font-size:.875rem;color:var(--muted-foreground)">Nothing happened yet.</p>
<script>(() => {
  const out = document.getElementById('rta5-out');
  globalThis.geBindRichTextActions(document.getElementById('rta5'), {
    handlers: {
      'say-hello': (event) => { out.textContent = 'Hello, ' + event.params.name + '!'; },
      hint: (event) => { out.textContent = event.phase === 'start' ? event.params.text : 'Nothing happened yet.'; },
    },
  });
})();</script>`,
            },
        ],
        api: [
            { name: 'addons', type: 'string', default: "''", description: 'Space or comma separated addon ids to enable: `history slash-commands mentions ai typography colors links images tables file-import emoji actions outline`, or `full` for all. An id needs its `define` module imported first.' },
            { name: 'addonOptions', type: 'Record<string, unknown>', default: '{}', description: 'One entry per addon id. `false` switches that addon off, `true` or no entry uses defaults, an object overrides: every addon accepts `toolbar`, `slashCommand` and `order`. Replace the object to change options.' },
            { name: 'mentions', type: '{ search, tags, tagsSearch, debounceMs, render }', default: '-', description: '`search(query)` returns people (array or Promise); `tags: true` turns on `#`.' },
            { name: 'ai', type: '{ provider }', default: '-', description: 'A function returning a string, a Promise or an async iterable; the Ask AI chip and `/ai` appear only with a provider.' },
            { name: 'images', type: '{ upload: { uploader, auto, sources }, layout }', default: '-', description: '`uploader(file, signal)` resolves to the URL stored in the document; without it images become data URLs.' },
            { name: 'actions', type: '{ definitions }', default: '-', description: 'What a click or hover can do; the attach button appears once definitions exist. `bindRichTextActions` runs them on rendered HTML.' },
            { name: 'use(addon, options)', type: 'method', default: '-', description: 'Enables an addon object on one editor; returns the function that removes it.' },
            { name: 'emoji-insert / history-restore / ai-request / ai-result / ai-error / image-upload-start / image-upload-complete / image-upload-error / file-import-start / file-import-complete / file-import-error', type: 'events', default: '-', description: 'What the addons report through the editor, among others.' },
        ],
    },
    {
        id: 'badge',
        group: 'Display',
        name: 'Badge',
        tag: 'ge-badge',
        description: 'A short status label. Use `label` for plain text or slot anything for full control.',
        examples: [
            {
                title: 'Variants',
                html: `<ge-badge label="Default"></ge-badge>
<ge-badge variant="secondary" label="Secondary"></ge-badge>
<ge-badge variant="destructive" label="Destructive"></ge-badge>
<ge-badge variant="outline" label="Outline"></ge-badge>`,
            },
            {
                title: 'Slotted content',
                note: 'Projecting content replaces the `label` input: the simple/custom dual mode.',
                html: `<ge-badge variant="secondary">
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>
  Verified
</ge-badge>`,
            },
            {
                title: 'Loading skeleton',
                html: `<ge-badge skeleton></ge-badge>`,
            },
        ],
        api: [
            { name: 'variant', type: "'default' | 'secondary' | 'destructive' | 'outline'", default: "'default'", description: 'Colour treatment.' },
            { name: 'label', type: 'string', default: "''", description: 'Plain-text content; the slot wins when both are given.' },
            { name: 'skeleton', type: 'boolean', default: 'false', description: 'Show a fixed-size loading placeholder.' },
        ],
    },
    {
        id: 'kbd',
        group: 'Display',
        name: 'Kbd',
        tag: 'ge-kbd',
        description: 'A keyboard key, for documenting shortcuts.',
        examples: [
            {
                title: 'Single keys and combinations',
                html: `<ge-kbd>Esc</ge-kbd>
<span><ge-kbd>Ctrl</ge-kbd> + <ge-kbd>K</ge-kbd></span>
<span><ge-kbd>⌘</ge-kbd> <ge-kbd>Shift</ge-kbd> <ge-kbd>P</ge-kbd></span>`,
            },
        ],
        api: [{ name: 'default slot', type: 'content', default: '-', description: 'The key text.' }],
    },
    {
        id: 'checkbox',
        group: 'Form inputs',
        name: 'Checkbox',
        tag: 'ge-checkbox',
        description: 'A checkbox that acts like the native one: Space toggles it, a form submits it and a form reset restores it.',
        examples: [
            {
                title: 'States',
                html: `<ge-checkbox></ge-checkbox>
<ge-checkbox checked></ge-checkbox>
<ge-checkbox indeterminate></ge-checkbox>
<ge-checkbox disabled></ge-checkbox>
<ge-checkbox disabled checked></ge-checkbox>`,
            },
            {
                title: 'With a label',
                note: 'Click the text: it toggles the box.',
                html: `<ge-checkbox label="Accept terms and conditions"></ge-checkbox>`,
            },
            {
                title: 'Skeleton',
                html: `<ge-checkbox skeleton label="Loading"></ge-checkbox>`,
            },
        ],
        api: [
            { name: 'checked', type: 'boolean', default: 'false', description: 'Checked state; reflected, so CSS can match it.' },
            { name: 'indeterminate', type: 'boolean', default: 'false', description: 'Shows the dash. Purely visual: it does not change checked.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Blocks interaction; a disabled fieldset does the same.' },
            { name: 'skeleton', type: 'boolean', default: 'false', description: 'Placeholder instead of the box.' },
            { name: 'label', type: 'string', default: '-', description: 'Text beside the box; clicking it toggles.' },
            { name: 'name / value', type: 'string', default: "- / 'on'", description: 'Submitted with the form while checked.' },
        ],
    },
    {
        id: 'input',
        group: 'Form inputs',
        name: 'Input',
        tag: 'ge-input',
        description: 'A text input. The native input lives inside, so typing, selection and autofill stay native.',
        examples: [
            {
                title: 'Variants',
                block: true,
                html: `<div style="display:grid;gap:1rem;width:16rem">
  <ge-input placeholder="Outline (default)"></ge-input>
  <ge-input variant="underline" placeholder="Underline"></ge-input>
  <ge-input variant="ghost" placeholder="Ghost"></ge-input>
</div>`,
            },
            {
                title: 'Prefix, suffix, clearable and loading',
                block: true,
                html: `<div style="display:grid;gap:1rem;width:16rem">
  <ge-input prefix="$" placeholder="0.00"></ge-input>
  <ge-input suffix="kg" placeholder="Weight"></ge-input>
  <ge-input clearable value="Clear me"></ge-input>
  <ge-input loading value="Searching"></ge-input>
</div>`,
            },
            {
                title: 'Floating label',
                block: true,
                html: `<div style="width:16rem"><ge-input floating label="Email" placeholder="you@example.com"></ge-input></div>`,
            },
            {
                title: 'States',
                block: true,
                html: `<div style="display:grid;gap:1rem;width:16rem">
  <ge-input disabled value="Disabled"></ge-input>
  <ge-input skeleton></ge-input>
</div>`,
            },
        ],
        api: [
            { name: 'value / name', type: 'string', default: "''", description: 'Current text; with a name it is submitted with the form.' },
            { name: 'type', type: 'string', default: "'text'", description: 'Native input type.' },
            { name: 'placeholder', type: 'string', default: "''", description: 'Hint shown while empty.' },
            { name: 'variant', type: "'outline' | 'underline' | 'ghost'", default: "'outline'", description: 'Border treatment.' },
            { name: 'disabled / loading / skeleton', type: 'boolean', default: 'false', description: 'Blocks editing / shows a spinner / shows a placeholder bar.' },
            { name: 'clearable', type: 'boolean', default: 'false', description: 'Clear button once there is a value.' },
            { name: 'floating / label', type: 'boolean / string', default: 'false / -', description: 'Floating label above the field.' },
            { name: 'prefix / suffix', type: 'string', default: "''", description: 'Text before / after the field.' },
            { name: 'autofocus, inputmode', type: 'boolean / string', default: '-', description: 'Focus on first render; on-screen keyboard.' },
            { name: 'aria-label, aria-labelledby, aria-describedby', type: 'string', default: '-', description: 'Resolved for the inner input, across the shadow boundary.' },
        ],
    },
    {
        id: 'label',
        group: 'Display',
        name: 'Label',
        tag: 'ge-label',
        description:
            'Names a form control. A native <label for> cannot cross a shadow root, so this one links by aria-labelledby and forwards clicks.',
        examples: [
            {
                title: 'Label for an input',
                note: 'Click the label: the input gets focus.',
                html: `<div style="display:grid;gap:.5rem;width:16rem">
  <ge-label for="email">Email</ge-label>
  <ge-input id="email" type="email" placeholder="you@example.com"></ge-input>
</div>`,
                block: true,
            },
            {
                title: 'Label for a checkbox',
                note: 'Clicking the label toggles the box.',
                html: `<div style="display:flex;align-items:center;gap:.5rem">
  <ge-checkbox id="terms"></ge-checkbox>
  <ge-label for="terms">Accept terms and conditions</ge-label>
</div>`,
                block: true,
            },
        ],
        api: [{ name: 'for', type: 'string', default: '-', description: 'id of the control, looked up in the same tree as the label.' }],
    },
    {
        id: 'aspect-ratio',
        group: 'Display',
        name: 'Aspect Ratio',
        tag: 'ge-aspect-ratio',
        description: 'A box that keeps a fixed width-to-height ratio and reserves its height before content loads, so nothing shifts.',
        examples: [
            {
                title: 'Ratios',
                note: 'Square by default; 16:9 is `ratio="1.7778"`. Slotted content fills the box when it is absolutely positioned.',
                html: `<div style="width:min(100%,14rem)">
  <ge-aspect-ratio ratio="1.7778">
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:.5rem;background:var(--muted);color:var(--muted-foreground)">16:9</div>
  </ge-aspect-ratio>
</div>
<div style="width:min(100%,8rem)">
  <ge-aspect-ratio>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:.5rem;background:var(--muted);color:var(--muted-foreground)">1:1</div>
  </ge-aspect-ratio>
</div>`,
            },
        ],
        api: [
            { name: 'ratio', type: 'number', default: '1', description: 'Width divided by height.' },
        ],
    },
    {
        id: 'separator',
        group: 'Display',
        name: 'Separator',
        tag: 'ge-separator',
        description: 'A thin line dividing content, horizontal or vertical.',
        examples: [
            {
                title: 'Horizontal',
                html: `<div style="width:100%">
  <strong>Gil Elements</strong>
  <div style="color:var(--muted-foreground)">Lit web components</div>
  <ge-separator style="margin:.75rem 0"></ge-separator>
  <div>Docs · Source · Releases</div>
</div>`,
                block: true,
            },
            {
                title: 'Vertical',
                note: 'A vertical separator fills the height of its parent.',
                html: `<div style="display:flex;align-items:center;gap:.75rem;height:1.25rem">
  <span>Blog</span><ge-separator orientation="vertical"></ge-separator>
  <span>Docs</span><ge-separator orientation="vertical"></ge-separator>
  <span>Source</span>
</div>`,
            },
        ],
        api: [{ name: 'orientation', type: "'horizontal' | 'vertical'", default: "'horizontal'", description: 'Direction of the line.' }],
    },
    {
        id: 'skeleton',
        group: 'Display',
        name: 'Skeleton',
        tag: 'ge-skeleton',
        description: 'A placeholder shown while content loads. You size it with ordinary CSS.',
        examples: [
            {
                title: 'Card placeholder',
                html: `<div style="display:flex;align-items:center;gap:1rem">
  <ge-skeleton style="width:3rem;height:3rem;border-radius:9999px"></ge-skeleton>
  <div style="display:grid;gap:.5rem">
    <ge-skeleton style="width:14rem;height:1rem"></ge-skeleton>
    <ge-skeleton style="width:10rem;height:1rem"></ge-skeleton>
  </div>
</div>`,
            },
            {
                title: 'Shimmer variant',
                html: `<ge-skeleton variant="shimmer" style="width:16rem;height:1rem"></ge-skeleton>`,
            },
        ],
        api: [{ name: 'variant', type: "'pulse' | 'shimmer'", default: "'pulse'", description: 'Fading fill, or a highlight sweeping across.' }],
    },
    {
        id: 'spinner',
        group: 'Display',
        name: 'Spinner',
        tag: 'ge-spinner',
        description: 'A loading indicator. The built-in loader is the slot fallback, so slotting your own replaces it.',
        examples: [
            {
                title: 'Variants',
                html: `<ge-spinner></ge-spinner>
<ge-spinner variant="dots"></ge-spinner>
<ge-spinner variant="bars"></ge-spinner>
<ge-spinner variant="pulse"></ge-spinner>`,
            },
            {
                title: 'Sizes',
                html: `<ge-spinner size="xs"></ge-spinner>
<ge-spinner size="sm"></ge-spinner>
<ge-spinner></ge-spinner>
<ge-spinner size="lg"></ge-spinner>
<ge-spinner size="xl"></ge-spinner>
<ge-spinner custom-size="56"></ge-spinner>`,
            },
            {
                title: 'Custom loader',
                note: 'Anything slotted replaces the built-in spinner. Add the global ge-spin class to make it rotate.',
                html: `<ge-spinner><span class="ge-spin" style="font-size:1.5rem">⏳</span></ge-spinner>`,
            },
        ],
        api: [
            { name: 'variant', type: "'ring' | 'dots' | 'bars' | 'pulse'", default: "'ring'", description: 'Animation style.' },
            { name: 'size', type: "'xs' | 'sm' | 'default' | 'lg' | 'xl' | 'page'", default: "'default'", description: 'Size preset.' },
            { name: 'custom-size', type: 'number', default: 'null', description: 'Ring only: exact px size, overrides `size`.' },
            { name: 'label', type: 'string', default: "'Loading'", description: 'Accessible name announced for the status.' },
        ],
    },
    {
        id: 'alert',
        group: 'Display',
        name: 'Alert',
        tag: 'ge-alert',
        description: 'A callout. A leading icon goes in the `icon` slot, so the text sits beside it whatever the icon is.',
        examples: [
            {
                title: 'Composed',
                note: '`destructive` is announced assertively (`role="alert"`), `default` politely (`role="status"`).',
                block: true,
                html: `<div style="display:grid;gap:1rem">
  <ge-alert>
    <ge-alert-title>Heads up!</ge-alert-title>
    <ge-alert-description>You can add components to your app using the CLI.</ge-alert-description>
  </ge-alert>
  <ge-alert variant="destructive">
    <ge-alert-title>Error</ge-alert-title>
    <ge-alert-description>Your session has expired. Please log in again.</ge-alert-description>
  </ge-alert>
</div>`,
            },
            {
                title: 'Simple mode',
                block: true,
                html: `<div style="display:grid;gap:1rem">
  <ge-alert heading="Note" description="This is a simple alert using inputs."></ge-alert>
  <ge-alert variant="destructive" heading="Critical Error" description="Something went wrong, and this alert was created with just two inputs."></ge-alert>
</div>`,
            },
            {
                title: 'With an icon',
                note: 'Put any `<svg>` in the `icon` slot; the text sits beside it. Without one, nothing is reserved.',
                block: true,
                html: `<ge-alert heading="Heads up!" description="You can add components to your app.">
  <svg slot="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16v-4M12 8h.01"/><circle cx="12" cy="12" r="10"/></svg>
</ge-alert>`,
            },
        ],
        api: [
            { name: 'variant', type: "'default' | 'destructive'", default: "'default'", description: 'Colour treatment and announcement urgency.' },
            { name: 'heading', type: 'string', default: "''", description: 'Simple-mode title. Called `heading`, not `title`, because `title` shows a browser tooltip.' },
            { name: 'description', type: 'string', default: "''", description: 'Simple-mode text; only shown when `heading` is set.' },
            { name: 'slot "icon"', type: 'content', default: '-', description: 'A leading icon.' },
        ],
    },
    {
        id: 'avatar',
        group: 'Display',
        name: 'Avatar',
        tag: 'ge-avatar',
        description: 'A round picture that falls back to initials until the image has loaded, or if it fails.',
        examples: [
            {
                title: 'Simple mode',
                html: `<ge-avatar src="https://github.com/shadcn.png" alt="shadcn" fallback="CN"></ge-avatar>
<ge-avatar src="https://invalid.example/missing.png" alt="Missing" fallback="JD"></ge-avatar>
<ge-avatar fallback="AB"></ge-avatar>`,
            },
            {
                title: 'Slotted image and fallback',
                note: 'Your own `<img>` is watched by the avatar; `slot="fallback"` replaces the text fallback.',
                html: `<ge-avatar>
  <img src="https://github.com/gilav21.png" alt="Gil">
  <span slot="fallback">GL</span>
</ge-avatar>`,
            },
            {
                title: 'With dividers',
                note: 'An extra beyond the Angular demo: `bordered` on the header or footer adds a divider with matching padding.',
                block: true,
                html: `<ge-card style="max-width:24rem">
  <ge-card-header bordered>
    <ge-card-title>Team plan</ge-card-title>
    <ge-card-description>Billed monthly</ge-card-description>
  </ge-card-header>
  <ge-card-content>Up to 10 members, unlimited projects.</ge-card-content>
  <ge-card-footer bordered style="gap:.5rem">
    <ge-button variant="outline" size="sm">Cancel</ge-button>
    <ge-button size="sm">Upgrade</ge-button>
  </ge-card-footer>
</ge-card>`,
            },
            {
                title: 'Loading and skeleton',
                html: `<ge-avatar loading fallback="JD"></ge-avatar>
<ge-avatar skeleton></ge-avatar>`,
            },
            {
                title: 'Density',
                note: 'Size follows `--density` (or `--density-avatar`).',
                html: `<ge-avatar fallback="S" style="--density-avatar:.75"></ge-avatar>
<ge-avatar fallback="M"></ge-avatar>
<ge-avatar fallback="L" style="--density-avatar:1.5"></ge-avatar>`,
            },
        ],
        api: [
            { name: 'src', type: 'string', default: "''", description: 'Image URL.' },
            { name: 'alt', type: 'string', default: "''", description: 'Alternative text for `src`.' },
            { name: 'fallback', type: 'string', default: "''", description: 'Text shown until the image has loaded.' },
            { name: 'loading', type: 'boolean', default: 'false', description: 'Dim with a spinner.' },
            { name: 'skeleton', type: 'boolean', default: 'false', description: 'Circular placeholder.' },
            { name: 'status', type: "'loading' | 'loaded' | 'error'", default: "'loading'", description: 'Read-only: state of the image.' },
        ],
    },
    {
        id: 'card',
        group: 'Display',
        name: 'Card',
        tag: 'ge-card',
        description: 'A surface for related content. Simple mode generates the header from inputs; custom mode composes the parts.',
        examples: [
            {
                title: 'Simple mode',
                block: true,
                html: `<ge-card style="max-width:24rem" heading="Notifications" description="You have 3 unread messages." content="Push everything to your phone."></ge-card>`,
            },
            {
                title: 'Composed, with an action',
                note: 'The `action` slot lands top-end beside the title. Give it a box: a `ge-button` draws none of its own, so wrap it in a `div`.',
                block: true,
                html: `<ge-card style="max-width:24rem">
  <ge-card-header>
    <ge-card-title>Team plan</ge-card-title>
    <ge-card-description>Billed monthly</ge-card-description>
    <div slot="action"><ge-button variant="outline" size="sm">Edit</ge-button></div>
  </ge-card-header>
  <ge-card-content>Up to 10 members, unlimited projects.</ge-card-content>
  <ge-card-footer style="gap:.5rem">
    <ge-button variant="outline" size="sm">Cancel</ge-button>
    <ge-button size="sm">Upgrade</ge-button>
  </ge-card-footer>
</ge-card>`,
            },
            {
                title: 'Loading and skeleton',
                block: true,
                html: `<div style="display:grid;gap:1rem;max-width:24rem">
  <ge-card loading heading="Refreshing" content="Content stays visible under the scrim."></ge-card>
  <ge-card skeleton></ge-card>
</div>`,
            },
        ],
        api: [
            { name: 'heading', type: 'string', default: "''", description: 'Simple-mode title; setting it generates the header.' },
            { name: 'description', type: 'string', default: "''", description: 'Simple-mode subtitle.' },
            { name: 'content', type: 'string', default: "''", description: 'Simple-mode body text.' },
            { name: 'loading', type: 'boolean', default: 'false', description: 'Scrim and spinner over the content.' },
            { name: 'skeleton', type: 'boolean', default: 'false', description: 'Replace the card with a placeholder.' },
            { name: 'ge-card-header / ge-card-footer: bordered', type: 'boolean', default: 'false', description: 'Divider plus matching padding.' },
            { name: 'ge-card-header: slot "action"', type: 'content', default: '-', description: 'Control placed top-end.' },
        ],
    },
    {
        id: 'empty',
        group: 'Display',
        name: 'Empty',
        tag: 'ge-empty',
        description: 'A placeholder for a view with nothing to show yet.',
        examples: [
            {
                title: 'With icon and action',
                block: true,
                html: `<ge-empty>
  <ge-empty-header>
    <ge-empty-media variant="icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
    </ge-empty-media>
    <ge-empty-title>No projects yet</ge-empty-title>
    <ge-empty-description>You have not created any projects. <a href="#empty">Learn more</a></ge-empty-description>
  </ge-empty-header>
  <ge-empty-content><ge-button>Create project</ge-button></ge-empty-content>
</ge-empty>`,
            },
        ],
        api: [
            { name: 'ge-empty-media: variant', type: "'default' | 'icon'", default: "'default'", description: '`icon` draws a muted tile and sizes a slotted svg to 1.5rem.' },
        ],
    },
    {
        id: 'chip-list',
        group: 'Form inputs',
        name: 'Chip List',
        tag: 'ge-chip-list',
        description: 'A text field that turns what you type into removable chips. Enter commits, Backspace in an empty field removes the last chip.',
        examples: [
            {
                title: 'Variants',
                block: true,
                html: `<div style="display:grid;gap:1rem;width:24rem;max-width:100%">
  <ge-chip-list></ge-chip-list>
  <ge-chip-list variant="underline"></ge-chip-list>
  <ge-chip-list variant="ghost"></ge-chip-list>
  <ge-chip-list badge-variant="secondary"></ge-chip-list>
</div>
<script>
document.querySelectorAll('ge-chip-list').forEach((c) => (c.value = ['Angular', 'React', 'Vue']));
</script>`,
            },
            {
                title: 'Max rows',
                note: 'The box stops growing at two rows and scrolls; the field stays in view as you add.',
                block: true,
                html: `<div style="display:grid;gap:1rem;width:24rem;max-width:100%">
  <ge-chip-list max-rows="2" placeholder="Add a fruit..."></ge-chip-list>
</div>
<script>
document.querySelector('ge-chip-list[max-rows]').value = ['Apple', 'Banana', 'Cherry', 'Mango', 'Orange', 'Papaya', 'Pear', 'Plum', 'Quince', 'Grape'];
</script>`,
            },
            {
                title: 'Sizes and colours',
                block: true,
                html: `<div style="display:grid;gap:1rem;width:24rem;max-width:100%">
  <ge-chip-list size="sm"></ge-chip-list>
  <ge-chip-list size="md"></ge-chip-list>
  <ge-chip-list size="lg" id="chip-colours"></ge-chip-list>
</div>
<script>
document.querySelectorAll('ge-chip-list').forEach((c) => (c.value = ['Angular', 'React']));
document.getElementById('chip-colours').chipColors = { Angular: '#fde68a', React: '#1e3a8a' };
</script>`,
            },
            {
                title: 'Separator keys and disabled',
                note: '`separatorKeys` adds keys that commit, such as a comma. Disabled drops the remove buttons.',
                block: true,
                html: `<div style="display:grid;gap:1rem;width:24rem;max-width:100%">
  <ge-chip-list id="chip-sep" placeholder="Type, then comma or space"></ge-chip-list>
  <ge-chip-list disabled></ge-chip-list>
</div>
<script>
document.getElementById('chip-sep').separatorKeys = [',', ' '];
document.querySelector('ge-chip-list[disabled]').value = ['Locked', 'Chips'];
</script>`,
            },
        ],
        api: [
            { name: 'value', type: 'string[]', default: '[]', description: 'Property only. The chips, in order; setting it fires no event.' },
            { name: 'placeholder', type: 'string', default: "'Add item...'", description: 'Text in the field and its accessible name. Hides once there is a chip.' },
            { name: 'variant', type: "'outline' | 'underline' | 'ghost'", default: "'outline'", description: 'Bordered box, single rule, or no chrome.' },
            { name: 'badge-variant', type: "'default' | 'secondary' | 'destructive' | 'outline'", default: "'default'", description: 'Badge variant of every chip.' },
            { name: 'size', type: "'sm' | 'md' | 'lg'", default: "'md'", description: 'Chip size; the box and the max-rows cap scale with it.' },
            { name: 'max-rows', type: 'number', default: '0', description: 'Caps the box at this many rows and scrolls. 0 means no cap.' },
            { name: 'allow-duplicates', type: 'boolean', default: 'false', description: 'Keep a repeated text as a second chip.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Disables the field and removes the remove buttons.' },
            { name: 'name', type: 'string', default: "''", description: 'Form field name; each chip submits as its own entry.' },
            { name: 'chipColors', type: 'Record<string, string>', default: '{}', description: 'Property only. Background colour per chip text; the text turns black or white, whichever reads better.' },
            { name: 'separatorKeys', type: 'string[]', default: '[]', description: 'Property only. Extra `KeyboardEvent.key` values that commit the text. Enter always does.' },
            { name: 'addChip(text)', type: 'method', default: '-', description: 'Append a chip programmatically; trimmed, blanks and rejected duplicates are ignored.' },
            { name: 'chip-added / chip-removed / value-change', type: 'event', default: '-', description: 'detail is the chip text, or the full list for `value-change`.' },
        ],
    },
    {
        id: 'page-header',
        group: 'Display',
        name: 'Page header',
        tag: 'ge-page-header',
        description: 'A heading with a description and actions. The heading is a real `h1`–`h6`; the actions wrap under it when there is no room.',
        examples: [
            {
                title: 'Heading, description and actions',
                block: true,
                html: `<ge-page-header heading="Invoices" description="Manage and send invoices.">
  <ge-button variant="outline">Export</ge-button>
  <ge-button>New invoice</ge-button>
</ge-page-header>`,
            },
            {
                title: 'With a breadcrumb and a lower heading level',
                note: '`heading-level` changes the element, not the size, so the outline stays right.',
                block: true,
                html: `<ge-page-header heading="Invoice 1042" heading-level="2" description="Issued 12 March.">
  <nav slot="breadcrumb">Home / Billing / Invoices</nav>
  <ge-button variant="outline">Download</ge-button>
</ge-page-header>`,
            },
        ],
        api: [
            { name: 'heading', type: 'string', default: "''", description: 'The page title.' },
            { name: 'description', type: 'string', default: "''", description: 'Muted text under the title.' },
            { name: 'heading-level', type: '1 | 2 | 3 | 4 | 5 | 6', default: '1', description: 'Which heading element to render; out-of-range values are clamped.' },
            { name: 'slot "breadcrumb"', type: 'content', default: '-', description: 'Trail above the heading.' },
        ],
    },
    {
        id: 'button',
        group: 'Actions',
        name: 'Button',
        tag: 'ge-button',
        description:
            'A button. It is form-associated, so `type="submit"` and `type="reset"` work inside a form even though the real `<button>` is inside the shadow root.',
        examples: [
            {
                title: 'Variants',
                html: `<ge-button>Default</ge-button>
<ge-button variant="secondary">Secondary</ge-button>
<ge-button variant="destructive">Destructive</ge-button>
<ge-button variant="outline">Outline</ge-button>
<ge-button variant="ghost">Ghost</ge-button>
<ge-button variant="link">Link</ge-button>`,
            },
            {
                title: 'Sizes',
                html: `<ge-button size="sm">Small</ge-button>
<ge-button>Default</ge-button>
<ge-button size="lg">Large</ge-button>
<ge-button variant="outline" size="icon-sm" aria-label="Add"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5v14"/></svg></ge-button>
<ge-button variant="outline" size="icon" aria-label="Add"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5v14"/></svg></ge-button>
<ge-button variant="outline" size="icon-lg" aria-label="Add"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5v14"/></svg></ge-button>`,
            },
            {
                title: 'With an icon',
                html: `<ge-button>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-inline-end:.5rem"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
  Send message
</ge-button>`,
            },
            {
                title: 'States',
                note: '`loading` disables the button and shows a spinner; `skeleton` is a placeholder.',
                html: `<ge-button disabled>Disabled</ge-button>
<ge-button loading>Saving</ge-button>
<ge-button skeleton></ge-button>`,
            },
            {
                title: 'Ripple',
                html: `<ge-button ripple>Click me</ge-button>
<ge-button ripple variant="outline">And me</ge-button>`,
            },
            {
                title: 'Inside a form',
                note: 'Submit and Reset act on the surrounding form like native buttons. The page cancels the real submit so you stay here.',
                block: true,
                html: `<form id="demo-form" onsubmit="event.preventDefault(); this.querySelector('output').textContent = 'Submitted: ' + new FormData(this).get('name')" style="display:flex;flex-wrap:wrap;align-items:center;gap:.5rem">
  <ge-input name="name" value="Gil" aria-label="Name"></ge-input>
  <ge-button type="submit">Submit</ge-button>
  <ge-button type="reset" variant="outline">Reset</ge-button>
  <output style="color:var(--muted-foreground)"></output>
</form>`,
            },
        ],
        api: [
            { name: 'variant', type: "'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'", default: "'default'", description: 'Colour treatment.' },
            { name: 'size', type: "'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg'", default: "'default'", description: 'Height, padding and radius; the icon sizes are square.' },
            { name: 'type', type: "'button' | 'submit' | 'reset'", default: "'button'", description: 'What a click does inside a form.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Blocks interaction; a disabled fieldset does the same.' },
            { name: 'loading', type: 'boolean', default: 'false', description: 'Disables and shows a spinner.' },
            { name: 'skeleton', type: 'boolean', default: 'false', description: 'Placeholder instead of the button.' },
            { name: 'ripple / ripple-color', type: 'boolean / string', default: 'false / tint of the text colour', description: 'Pointer ripple on click.' },
            { name: 'label', type: 'string', default: "''", description: 'Plain-text label; slotted content wins.' },
            { name: 'aria-label, aria-expanded, aria-pressed, aria-haspopup', type: 'string', default: '-', description: 'Forwarded to the inner button, where assistive technology looks.' },
        ],
    },
    {
        id: 'progress',
        group: 'Display',
        name: 'Progress',
        tag: 'ge-progress',
        description: 'A progress bar. The fill is visual; a hidden native progress element carries the value for assistive technology.',
        examples: [
            {
                title: 'Values',
                block: true,
                html: `<div style="display:grid;gap:1rem;width:16rem">
  <ge-progress value="0" aria-label="Empty"></ge-progress>
  <ge-progress value="50" aria-label="Half"></ge-progress>
  <ge-progress value="100" aria-label="Complete"></ge-progress>
</div>`,
            },
            {
                title: 'Custom max',
                note: '30 of 40 fills 75%.',
                block: true,
                html: `<div style="width:16rem"><ge-progress value="30" max="40" aria-label="Tasks done"></ge-progress></div>`,
            },
            {
                title: 'Localised announcement',
                note: 'The spoken percentage follows `locale` (French spells it "45 %").',
                block: true,
                html: `<div style="width:16rem"><ge-progress value="45" locale="fr-FR" aria-label="Progression"></ge-progress></div>`,
            },
        ],
        api: [
            { name: 'value', type: 'number', default: '0', description: 'Current progress, in units of max. The fill is clamped to 0-100%.' },
            { name: 'max', type: 'number', default: '100', description: 'Upper bound of value.' },
            { name: 'aria-label / aria-labelledby', type: 'string', default: '-', description: 'Accessible name; labelledby takes an id from the host tree.' },
            { name: 'locale', type: 'string', default: 'page language', description: 'BCP 47 tag for the spoken percentage.' },
        ],
    },
    {
        id: 'rating',
        group: 'Form inputs',
        name: 'Rating',
        tag: 'ge-rating',
        description: 'A star rating. Hover previews, click commits, clicking the current value clears it, and a finger can slide across the row.',
        examples: [
            {
                title: 'Basic',
                html: `<ge-rating value="3"></ge-rating>
<ge-rating value="5" max="5"></ge-rating>
<ge-rating></ge-rating>`,
            },
            {
                title: 'Half stars and sizes',
                note: 'With `precision="0.5"` the half is chosen from where the star is hit, mirrored in right-to-left text.',
                html: `<ge-rating value="2.5" precision="0.5" size="sm"></ge-rating>
<ge-rating value="3.5" precision="0.5"></ge-rating>
<ge-rating value="4.5" precision="0.5" size="lg"></ge-rating>`,
            },
            {
                title: 'Read-only and disabled',
                html: `<ge-rating value="4" readonly></ge-rating>
<ge-rating value="4" disabled></ge-rating>`,
            },
            {
                title: 'Keyboard',
                note: 'Tab to it, then Arrow keys step, Home clears and End fills every star.',
                html: `<ge-rating value="2" max="10" aria-label="Rating out of ten"></ge-rating>`,
            },
        ],
        api: [
            { name: 'value', type: 'number', default: '0', description: 'Committed rating, 0 for none.' },
            { name: 'max', type: 'number', default: '5', description: 'Number of stars.' },
            { name: 'precision', type: '0.5 | 1', default: '1', description: 'Whole or half stars.' },
            { name: 'size', type: "'sm' | 'md' | 'lg'", default: "'md'", description: 'Star box of 16, 20 or 24px.' },
            { name: 'readonly / disabled', type: 'boolean', default: 'false', description: 'Display only / blocked and dimmed.' },
            { name: 'name', type: 'string', default: '-', description: 'Submitted with the form.' },
            { name: 'aria-label / rate-label', type: 'string', default: "'Rating' / 'Rate {n} out of {total}'", description: 'Group name and the template for each star name.' },
            { name: 'rating-change', type: 'event', default: '-', description: 'Fires on a user commit; detail is the new value. Never on hover.' },
        ],
    },
    {
        id: 'slider',
        group: 'Form inputs',
        name: 'Slider',
        tag: 'ge-slider',
        description: 'Pick a number by dragging or pressing the track, with a mouse or a finger. The keys work too.',
        examples: [
            {
                title: 'Basic',
                html: `<ge-slider value="40" aria-label="Volume" style="max-width:20rem"></ge-slider>`,
                block: true,
            },
            {
                title: 'Range and step',
                note: 'The value always snaps onto the grid: here 5, 7.5, 10, 12.5 or 15.',
                html: `<ge-slider min="5" max="15" step="2.5" value="10" aria-label="Temperature" style="max-width:20rem"></ge-slider>`,
                block: true,
            },
            {
                title: 'Disabled',
                html: `<ge-slider value="60" disabled aria-label="Locked" style="max-width:20rem"></ge-slider>`,
                block: true,
            },
            {
                title: 'Labelled from elsewhere',
                note: 'Arrow keys step, PageUp and PageDown move ten steps, Home and End jump to the ends.',
                html: `<div style="display:grid;gap:.5rem;max-width:20rem;width:100%">
  <ge-label for="bright">Brightness</ge-label>
  <ge-slider id="bright" value="70"></ge-slider>
</div>`,
                block: true,
            },
        ],
        api: [
            { name: 'value', type: 'number', default: '0', description: 'Current value, shown snapped to the grid and clamped to the range.' },
            { name: 'min / max / step', type: 'number', default: '0 / 100 / 1', description: 'Range and grid spacing.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Blocks interaction and dims it.' },
            { name: 'name', type: 'string', default: '-', description: 'Submitted with the form.' },
            { name: 'locale', type: 'string', default: 'page language', description: 'BCP 47 tag for the spoken value.' },
            { name: 'aria-label / aria-labelledby', type: 'string', default: '-', description: 'Accessible name; labelledby takes an id from the host tree.' },
            { name: 'input / change', type: 'event', default: '-', description: 'input on every change including dragging; change when the pointer is released or a key is pressed.' },
        ],
    },
    {
        id: 'number-input',
        group: 'Form inputs',
        name: 'Number Input',
        tag: 'ge-number-input',
        description: 'A number field with stepping. Arrow Up and Down step it, so does the mouse wheel while it has focus, and blur clamps it to the limits.',
        examples: [
            {
                title: 'Basic',
                html: `<ge-number-input value="42" aria-label="Quantity" style="max-width:12rem"></ge-number-input>`,
                block: true,
            },
            {
                title: 'Limits and step',
                note: 'Type 99 and leave the field: it clamps to 10. Arrow keys move in steps of 2.5.',
                html: `<ge-number-input min="0" max="10" step="2.5" value="5" aria-label="Rating" style="max-width:12rem"></ge-number-input>`,
                block: true,
            },
            {
                title: 'Variants',
                html: `<ge-number-input variant="underline" value="3" aria-label="Underline" style="max-width:12rem"></ge-number-input>
<ge-number-input variant="ghost" value="3" aria-label="Ghost" style="max-width:12rem"></ge-number-input>`,
                block: true,
            },
            {
                title: 'Disabled',
                html: `<ge-number-input value="7" disabled aria-label="Locked" style="max-width:12rem"></ge-number-input>`,
                block: true,
            },
        ],
        api: [
            { name: 'value', type: 'number | null', default: 'null', description: 'Current value; empty is null, which steps from 0.' },
            { name: 'min / max / step', type: 'number', default: '- / - / 1', description: 'Limits and step size. Blur clamps to the limits.' },
            { name: 'placeholder', type: 'string', default: "'0'", description: 'Hint shown while empty.' },
            { name: 'variant', type: "'outline' | 'underline' | 'ghost'", default: "'outline'", description: 'Border treatment.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Blocks editing and dims it.' },
            { name: 'name / locale', type: 'string', default: '-', description: 'Form field name; BCP 47 tag for the decimal separator.' },
            { name: 'increment() / decrement()', type: 'method', default: '-', description: 'Step programmatically.' },
        ],
    },
    {
        id: 'switch',
        group: 'Form inputs',
        name: 'Switch',
        tag: 'ge-switch',
        description: 'An on/off toggle. Click, Enter and Space all toggle it, and in a form it submits like a checkbox.',
        examples: [
            {
                title: 'States',
                html: `<ge-switch aria-label="Off"></ge-switch>
<ge-switch checked aria-label="On"></ge-switch>
<ge-switch disabled aria-label="Disabled off"></ge-switch>
<ge-switch disabled checked aria-label="Disabled on"></ge-switch>`,
            },
            {
                title: 'With a label',
                note: 'Click the text: it toggles the switch.',
                html: `<ge-switch label="Airplane mode"></ge-switch>`,
            },
            {
                title: 'Labelled from elsewhere',
                note: 'A ge-label anywhere in the page names it and toggles it.',
                html: `<div style="display:flex;align-items:center;gap:.5rem">
  <ge-switch id="wifi"></ge-switch>
  <ge-label for="wifi">Wi-Fi</ge-label>
</div>`,
            },
            {
                title: 'Skeleton',
                html: `<ge-switch skeleton label="Loading"></ge-switch>`,
            },
        ],
        api: [
            { name: 'checked', type: 'boolean', default: 'false', description: 'On state; reflected, so CSS can match it.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Blocks interaction; a disabled fieldset does the same.' },
            { name: 'skeleton', type: 'boolean', default: 'false', description: 'Placeholder instead of the switch.' },
            { name: 'label', type: 'string', default: '-', description: 'Text beside the switch; clicking it toggles.' },
            { name: 'name / value', type: 'string', default: "- / 'on'", description: 'Submitted with the form while on.' },
        ],
    },
    {
        id: 'radio-group',
        group: 'Form inputs',
        name: 'Radio Group',
        tag: 'ge-radio-group',
        description: 'Mutually exclusive choices. One item is in the tab order and the arrow keys move and select, like a native group.',
        examples: [
            {
                title: 'With labels',
                html: `<ge-radio-group value="comfortable" aria-label="Density">
  <ge-radio-group-item value="default" label="Default"></ge-radio-group-item>
  <ge-radio-group-item value="comfortable" label="Comfortable"></ge-radio-group-item>
  <ge-radio-group-item value="compact" label="Compact"></ge-radio-group-item>
</ge-radio-group>`,
            },
            {
                title: 'Horizontal, without labels',
                html: `<ge-radio-group orientation="horizontal" value="b" aria-label="Choice">
  <ge-radio-group-item value="a" aria-label="A"></ge-radio-group-item>
  <ge-radio-group-item value="b" aria-label="B"></ge-radio-group-item>
  <ge-radio-group-item value="c" aria-label="C"></ge-radio-group-item>
</ge-radio-group>`,
            },
            {
                title: 'Disabled',
                note: 'One item disabled, then the whole group.',
                html: `<ge-radio-group value="default" aria-label="Plan">
  <ge-radio-group-item value="default" label="Default"></ge-radio-group-item>
  <ge-radio-group-item value="pro" label="Pro" disabled></ge-radio-group-item>
</ge-radio-group>
<ge-radio-group value="a" disabled aria-label="Locked">
  <ge-radio-group-item value="a" label="Locked on"></ge-radio-group-item>
  <ge-radio-group-item value="b" label="Locked off"></ge-radio-group-item>
</ge-radio-group>`,
            },
            {
                title: 'From data',
                note: 'Set options, displayWith, valueWith and disabledWith from script.',
                html: `<ge-radio-group id="plans" value="pro" aria-label="Plans"></ge-radio-group>
<script type="module">
  const group = document.getElementById('plans');
  group.options = [{ id: 'free', name: 'Free' }, { id: 'pro', name: 'Pro' }, { id: 'team', name: 'Team', locked: true }];
  group.valueWith = (o) => o.id;
  group.displayWith = (o) => o.name;
  group.disabledWith = (o) => Boolean(o.locked);
</script>`,
            },
        ],
        api: [
            { name: 'value', type: 'string', default: '-', description: 'Value of the selected item.' },
            { name: 'name', type: 'string', default: '-', description: 'Submitted with the form.' },
            { name: 'orientation', type: "'vertical' | 'horizontal'", default: 'vertical', description: 'Layout and arrow-key axis.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Disables every item.' },
            { name: 'options / displayWith / valueWith / disabledWith', type: 'property', default: '-', description: 'Render items from data.' },
            { name: 'item: value / label / disabled / aria-label', type: 'string / boolean', default: '-', description: 'On ge-radio-group-item.' },
        ],
    },
    {
        id: 'toggle',
        group: 'Actions',
        name: 'Toggle',
        tag: 'ge-toggle',
        description: 'A button that stays pressed until it is pressed again.',
        examples: [
            {
                title: 'Variants',
                html: `<ge-toggle>Bold</ge-toggle>
<ge-toggle pressed>Italic</ge-toggle>
<ge-toggle variant="outline">Outline</ge-toggle>
<ge-toggle variant="outline" pressed>Pressed</ge-toggle>`,
            },
            {
                title: 'With an icon',
                note: 'An icon-only toggle needs an aria-label.',
                html: `<ge-toggle variant="outline" aria-label="Bold"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" /></svg></ge-toggle>
<ge-toggle variant="outline"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" /></svg> Bold</ge-toggle>`,
            },
            {
                title: 'Sizes and disabled',
                html: `<ge-toggle size="sm" variant="outline">Small</ge-toggle>
<ge-toggle variant="outline">Default</ge-toggle>
<ge-toggle size="lg" variant="outline">Large</ge-toggle>
<ge-toggle disabled>Disabled</ge-toggle>`,
            },
        ],
        api: [
            { name: 'pressed', type: 'boolean', default: 'false', description: 'Pressed state; set it in markup for an initially pressed toggle.' },
            { name: 'variant', type: "'default' | 'outline'", default: "'default'", description: 'Plain, or with a border and shadow.' },
            { name: 'size', type: "'default' | 'sm' | 'lg'", default: "'default'", description: 'Height, padding and minimum width.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Blocks interaction.' },
            { name: 'aria-label', type: 'string', default: '-', description: 'Accessible name for an icon-only toggle.' },
            { name: 'pressed-change', type: 'event', default: '-', description: 'Fires after the user toggles it; detail is the new state.' },
        ],
    },
    {
        id: 'toggle-group',
        group: 'Actions',
        name: 'Toggle group',
        tag: 'ge-toggle-group',
        description: 'A row of toggle buttons that share a selection: one at a time, or any number.',
        examples: [
            {
                title: 'Single',
                note: 'Press the one that is on to clear it.',
                html: `<ge-toggle-group aria-label="Alignment" value="center">
  <ge-toggle-group-item value="left">Left</ge-toggle-group-item>
  <ge-toggle-group-item value="center">Center</ge-toggle-group-item>
  <ge-toggle-group-item value="right">Right</ge-toggle-group-item>
</ge-toggle-group>`,
            },
            {
                title: 'Multiple, outline',
                html: `<ge-toggle-group type="multiple" variant="outline" aria-label="Text style" value="bold,italic">
  <ge-toggle-group-item value="bold" aria-label="Bold"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" /></svg></ge-toggle-group-item>
  <ge-toggle-group-item value="italic" aria-label="Italic"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg></ge-toggle-group-item>
  <ge-toggle-group-item value="underline">Underline</ge-toggle-group-item>
</ge-toggle-group>`,
            },
            {
                title: 'Sizes and disabled',
                html: `<div style="display:grid;gap:1rem;justify-items:start">
  <ge-toggle-group variant="outline" size="sm" aria-label="Small"><ge-toggle-group-item value="a">One</ge-toggle-group-item><ge-toggle-group-item value="b">Two</ge-toggle-group-item></ge-toggle-group>
  <ge-toggle-group variant="outline" size="lg" aria-label="Large"><ge-toggle-group-item value="a">One</ge-toggle-group-item><ge-toggle-group-item value="b" disabled>Two</ge-toggle-group-item></ge-toggle-group>
  <ge-toggle-group variant="outline" disabled aria-label="Disabled"><ge-toggle-group-item value="a">One</ge-toggle-group-item><ge-toggle-group-item value="b">Two</ge-toggle-group-item></ge-toggle-group>
</div>`,
            },
        ],
        api: [
            { name: 'type', type: "'single' | 'multiple'", default: "'single'", description: 'How many items can be on at once.' },
            { name: 'value', type: 'string | string[]', default: '-', description: 'Selected value(s); in the attribute a comma-separated list for multiple. Single mode gives an empty string when cleared.' },
            { name: 'variant', type: "'default' | 'outline'", default: "'default'", description: 'Plain, or with borders and a shadow.' },
            { name: 'size', type: "'default' | 'sm' | 'lg'", default: "'default'", description: 'Height and padding of every item.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Disables every item.' },
            { name: 'options', type: 'property', default: '-', description: 'Render items from data: { value, label?, disabled? }.' },
            { name: 'item: value / disabled / aria-label', type: 'string / boolean', default: '-', description: 'On ge-toggle-group-item. Icon-only items need an aria-label.' },
            { name: 'change, input', type: 'event', default: '-', description: 'Fire after the user changes the selection; read value.' },
        ],
    },
    {
        id: 'collapsible',
        group: 'Layout',
        name: 'Collapsible',
        tag: 'ge-collapsible',
        description: 'Shows or hides a panel. The panel is not rendered at all while it is closed.',
        examples: [
            {
                title: 'Basic',
                note: 'Plain content makes the trigger a button: Tab to it, then Enter or Space.',
                block: true,
                html: `<ge-collapsible style="width:20rem">
  <ge-collapsible-trigger><strong>Show details</strong></ge-collapsible-trigger>
  <ge-collapsible-content><p style="margin:.5rem 0 0">Hidden until you open it.</p></ge-collapsible-content>
</ge-collapsible>`,
            },
            {
                title: 'With your own control',
                note: 'A ge-button inside the trigger stays the only tab stop; clicking it toggles.',
                block: true,
                html: `<ge-collapsible open style="width:20rem">
  <ge-collapsible-trigger><ge-button variant="outline">Toggle</ge-button></ge-collapsible-trigger>
  <ge-collapsible-content><p style="margin:.5rem 0 0">Open from the start because of the open attribute.</p></ge-collapsible-content>
</ge-collapsible>`,
            },
            {
                title: 'Disabled',
                note: 'A disabled collapsible cannot be opened; hide() can still close it.',
                block: true,
                html: `<ge-collapsible disabled style="width:20rem">
  <ge-collapsible-trigger>Cannot open</ge-collapsible-trigger>
  <ge-collapsible-content>Never shown.</ge-collapsible-content>
</ge-collapsible>`,
            },
        ],
        api: [
            { name: 'open', type: 'boolean', default: 'false', description: 'Whether the panel is showing; set it in markup for an initially open collapsible.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Blocks opening: toggle() and show() do nothing, hide() still closes.' },
            { name: 'toggle() / show() / hide()', type: 'method', default: '-', description: 'show() and hide() announce even when nothing changes.' },
            { name: 'open-change', type: 'event', default: '-', description: 'After the state changes; detail is the new state.' },
        ],
    },
    {
        id: 'accordion',
        group: 'Layout',
        name: 'Accordion',
        tag: 'ge-accordion',
        description: 'A stack of items that each open to reveal a panel. Quick form from attributes, or design the trigger and panel yourself.',
        examples: [
            {
                title: 'Quick form',
                block: true,
                html: `<ge-accordion value="a" style="width:24rem">
  <ge-accordion-item value="a" heading="Is it accessible?" content="Yes. Every trigger is a real button with its expanded state."></ge-accordion-item>
  <ge-accordion-item value="b" heading="Is it styled?" content="Yes. It matches the other components."></ge-accordion-item>
  <ge-accordion-item value="c" heading="Is it animated?" content="No, it simply shows and hides."></ge-accordion-item>
</ge-accordion>`,
            },
            {
                title: 'Custom trigger and panel',
                note: 'Project a ge-accordion-trigger and ge-accordion-content to put anything inside.',
                block: true,
                html: `<ge-accordion type="multiple" value="a,b" style="width:24rem">
  <ge-accordion-item value="a">
    <ge-accordion-trigger>Shipping <ge-badge variant="secondary">New</ge-badge></ge-accordion-trigger>
    <ge-accordion-content>Free over $50, two to four days.</ge-accordion-content>
  </ge-accordion-item>
  <ge-accordion-item value="b">
    <ge-accordion-trigger>Returns</ge-accordion-trigger>
    <ge-accordion-content><ge-button size="sm" variant="outline">Start a return</ge-button></ge-accordion-content>
  </ge-accordion-item>
</ge-accordion>`,
            },
            {
                title: 'Always one open, and loading',
                block: true,
                html: `<ge-accordion value="a" collapsible="false" style="width:24rem">
  <ge-accordion-item value="a" heading="Pressing me again does nothing" content="One item always stays open."></ge-accordion-item>
  <ge-accordion-item value="b" heading="Another one" content="Opening it closes the first."></ge-accordion-item>
  <ge-accordion-item value="c" skeleton></ge-accordion-item>
</ge-accordion>`,
            },
        ],
        api: [
            { name: 'type', type: "'single' | 'multiple'", default: "'single'", description: 'One item open at a time, or any number.' },
            { name: 'value', type: 'string[]', default: '[]', description: 'Values of the open items; in the attribute a comma-separated list. In single mode only the first counts.' },
            { name: 'collapsible', type: 'boolean', default: 'true', description: 'Single mode: whether pressing the open item closes it. Write collapsible="false" to keep one open.' },
            { name: 'change', type: 'event', default: '-', description: 'After the user opens or closes an item; read value.' },
            { name: 'item: value / heading / content / skeleton', type: 'string / boolean', default: '-', description: 'On ge-accordion-item. heading and content are the quick form; skeleton shows a placeholder row.' },
            { name: '--density-accordion', type: 'css', default: '1', description: 'Trigger padding multiplier; falls back to --density.' },
        ],
    },
    {
        id: 'card-accordion',
        group: 'Layout',
        name: 'Card accordion',
        tag: 'ge-card-accordion',
        description: 'An accordion whose items are elevated cards with a smooth height animation. Same state engine as the accordion: type, value, collapsible, change.',
        examples: [
            {
                title: 'Quick form',
                note: 'A heading, an optional description and the body text; the closed card keeps its body out of the tab order.',
                block: true,
                html: `<ge-card-accordion value="billing" style="width:26rem">
  <ge-card-accordion-item value="billing" heading="Billing" description="Invoices and plans" content="Your next invoice is due in May. You can download past ones from the invoices tab."></ge-card-accordion-item>
  <ge-card-accordion-item value="security" heading="Security" content="Two-factor authentication is on."></ge-card-accordion-item>
  <ge-card-accordion-item value="notifications" heading="Notifications" description="Email and push" content="You get a weekly digest."></ge-card-accordion-item>
</ge-card-accordion>`,
            },
            {
                title: 'Header actions',
                note: 'Project a trigger, actions and content. Controls inside ge-card-accordion-actions sit beside the chevron and never toggle the card; every click inside is stopped there, so listen on the controls themselves.',
                block: true,
                html: `<ge-card-accordion type="multiple" value="deploys" style="width:26rem">
  <ge-card-accordion-item value="deploys">
    <ge-card-accordion-trigger>Deploys
      <ge-card-accordion-actions><ge-button variant="outline" size="sm">Retry</ge-button></ge-card-accordion-actions>
    </ge-card-accordion-trigger>
    <ge-card-accordion-content>Last deploy finished 4 minutes ago.</ge-card-accordion-content>
  </ge-card-accordion-item>
  <ge-card-accordion-item value="backups">
    <ge-card-accordion-trigger>Backups</ge-card-accordion-trigger>
    <ge-card-accordion-content>Nightly, kept for 30 days.</ge-card-accordion-content>
  </ge-card-accordion-item>
</ge-card-accordion>`,
            },
            {
                title: 'Loading',
                block: true,
                html: `<ge-card-accordion style="width:26rem">
  <ge-card-accordion-item value="a" skeleton></ge-card-accordion-item>
  <ge-card-accordion-item value="b" heading="Loaded card" content="The skeleton keeps the card's shape while data loads."></ge-card-accordion-item>
</ge-card-accordion>`,
            },
        ],
        api: [
            { name: 'type / value / collapsible', type: "'single' | 'multiple' / string[] / boolean", default: "'single' / [] / true", description: 'As on ge-accordion; `value` is a comma-separated list in the attribute and `collapsible="false"` keeps one card open.' },
            { name: 'change', type: 'event', default: '-', description: 'After the user opens or closes a card; read `value`.' },
            { name: 'item: value / heading / description / content / skeleton', type: 'string / boolean', default: '-', description: 'On ge-card-accordion-item. The first four are the quick form; `skeleton` shows placeholders in the card shape.' },
            { name: 'ge-card-accordion-trigger / -actions / -content', type: 'parts', default: '-', description: 'Custom form. The trigger label truncates; the actions row is outside the toggle button; the content is always rendered so it can animate, and is `inert` while closed.' },
            { name: '--density-card-accordion', type: 'css', default: '1', description: 'Card padding and gap multiplier; falls back to --density.' },
        ],
    },
    {
        id: 'tabs',
        group: 'Layout',
        name: 'Tabs',
        tag: 'ge-tabs',
        description: 'Tabbed panels. Only the panel of the active tab is rendered.',
        examples: [
            {
                title: 'Template form',
                block: true,
                html: `<ge-tabs value="account" style="width:24rem">
  <ge-tabs-list aria-label="Settings">
    <ge-tabs-trigger value="account">Account</ge-tabs-trigger>
    <ge-tabs-trigger value="password">Password</ge-tabs-trigger>
    <ge-tabs-trigger value="team">Team</ge-tabs-trigger>
  </ge-tabs-list>
  <ge-tabs-content value="account">Make changes to your account here.</ge-tabs-content>
  <ge-tabs-content value="password">Change your password here.</ge-tabs-content>
  <ge-tabs-content value="team">Invite your team.</ge-tabs-content>
</ge-tabs>`,
            },
            {
                title: 'Loading',
                note: 'A skeleton list stands in for the triggers.',
                block: true,
                html: `<ge-tabs style="width:24rem"><ge-tabs-list skeleton skeleton-count="3"></ge-tabs-list></ge-tabs>`,
            },
        ],
        api: [
            { name: 'value', type: 'string', default: "''", description: 'The active tab. With tabs set and no value, the first tab is active.' },
            { name: 'tabs', type: 'property', default: '-', description: 'Data-driven mode: { value, label, content?, disabled? }[]. content is plain text.' },
            { name: 'tab-change', type: 'event', default: '-', description: 'When the user picks a tab; detail is its value.' },
            { name: 'trigger: value / disabled', type: 'string / boolean', default: '-', description: 'On ge-tabs-trigger. value names the panel it opens.' },
            { name: 'content: value', type: 'string', default: '-', description: 'On ge-tabs-content: the tab the panel belongs to.' },
            { name: 'list: aria-label / skeleton / skeleton-count', type: 'string / boolean / number', default: '- / false / 3', description: 'On ge-tabs-list.' },
            { name: '--density-tabs', type: 'css', default: '1', description: 'Trigger padding multiplier; falls back to --density.' },
        ],
    },
    {
        id: 'breadcrumb',
        group: 'Navigation',
        name: 'Breadcrumb',
        tag: 'ge-breadcrumb',
        description: 'The trail from the root to the current page. Give the list items for the quick form, or compose the crumbs yourself.',
        examples: [
            {
                title: 'Custom form',
                block: true,
                html: `<ge-breadcrumb>
  <ge-breadcrumb-list>
    <ge-breadcrumb-item><ge-breadcrumb-link href="#">Home</ge-breadcrumb-link></ge-breadcrumb-item>
    <ge-breadcrumb-separator></ge-breadcrumb-separator>
    <ge-breadcrumb-item><ge-breadcrumb-link href="#">Components</ge-breadcrumb-link></ge-breadcrumb-item>
    <ge-breadcrumb-separator></ge-breadcrumb-separator>
    <ge-breadcrumb-item><ge-breadcrumb-page>Breadcrumb</ge-breadcrumb-page></ge-breadcrumb-item>
  </ge-breadcrumb-list>
</ge-breadcrumb>`,
            },
            {
                title: 'Ellipsis and a custom separator',
                block: true,
                html: `<ge-breadcrumb>
  <ge-breadcrumb-list>
    <ge-breadcrumb-item><ge-breadcrumb-link href="#">Home</ge-breadcrumb-link></ge-breadcrumb-item>
    <ge-breadcrumb-separator>/</ge-breadcrumb-separator>
    <ge-breadcrumb-item><ge-breadcrumb-ellipsis></ge-breadcrumb-ellipsis></ge-breadcrumb-item>
    <ge-breadcrumb-separator>/</ge-breadcrumb-separator>
    <ge-breadcrumb-item><ge-breadcrumb-page>Breadcrumb</ge-breadcrumb-page></ge-breadcrumb-item>
  </ge-breadcrumb-list>
</ge-breadcrumb>`,
            },
            {
                title: 'Loading',
                block: true,
                html: `<ge-breadcrumb><ge-breadcrumb-list skeleton skeleton-count="3"></ge-breadcrumb-list></ge-breadcrumb>`,
            },
        ],
        api: [
            { name: 'aria-label', type: 'string', default: "'breadcrumb'", description: 'On ge-breadcrumb: the name of the navigation landmark.' },
            { name: 'list: items', type: 'property', default: '-', description: 'On ge-breadcrumb-list, quick form: { label, href?, isCurrentPage? }[] with separators added for you.' },
            { name: 'list: skeleton / skeleton-count', type: 'boolean / number', default: 'false / 3', description: 'Placeholder crumbs.' },
            { name: 'link: href', type: 'string', default: "'#'", description: 'On ge-breadcrumb-link.' },
            { name: 'ellipsis: label', type: 'string', default: "'More'", description: 'Screen-reader text for the dots.' },
            { name: 'separator slot', type: 'slot', default: 'chevron', description: 'Project text or an svg to replace the chevron.' },
        ],
    },
    {
        id: 'pagination',
        group: 'Navigation',
        name: 'Pagination',
        tag: 'ge-pagination',
        description: 'Page navigation. Set total-pages and it builds previous, the numbers, ellipses and next; or compose the row yourself.',
        examples: [
            {
                title: 'Quick form',
                note: 'It announces page-change; you set current-page in response. Try the buttons.',
                block: true,
                html: `<ge-pagination id="pg-demo" current-page="5" total-pages="20"></ge-pagination>
<script>document.getElementById('pg-demo').addEventListener('page-change', (e) => { e.currentTarget.currentPage = e.detail; });</script>`,
            },
            {
                title: 'Composed',
                block: true,
                html: `<ge-pagination>
  <ge-pagination-content>
    <ge-pagination-item><ge-pagination-previous disabled></ge-pagination-previous></ge-pagination-item>
    <ge-pagination-item><ge-pagination-link active>1</ge-pagination-link></ge-pagination-item>
    <ge-pagination-item><ge-pagination-link>2</ge-pagination-link></ge-pagination-item>
    <ge-pagination-item><ge-pagination-link>3</ge-pagination-link></ge-pagination-item>
    <ge-pagination-item><ge-pagination-ellipsis></ge-pagination-ellipsis></ge-pagination-item>
    <ge-pagination-item><ge-pagination-next></ge-pagination-next></ge-pagination-item>
  </ge-pagination-content>
</ge-pagination>`,
            },
        ],
        api: [
            { name: 'current-page / total-pages', type: 'number', default: '0', description: 'Quick form: the page shown (from 1) and how many there are. total-pages of 0 means composed mode.' },
            { name: 'sibling-count', type: 'number', default: '1', description: 'Page numbers kept on each side of the current one.' },
            { name: 'page-change', type: 'event', default: '-', description: 'When the user picks another page; detail is its number. Nothing moves until you set current-page.' },
            { name: 'previous-label / next-label / more-label / aria-label', type: 'string', default: "'Previous' / 'Next' / 'More pages' / 'pagination'", description: 'Text, since there are no locale tables here yet.' },
            { name: 'link: active / size / disabled', type: 'boolean / string / boolean', default: "false / 'icon' / false", description: 'On ge-pagination-link. size: default, sm, lg or icon.' },
            { name: 'previous, next: label / disabled', type: 'string / boolean', default: '-', description: 'On ge-pagination-previous and ge-pagination-next.' },
        ],
    },
    {
        id: 'stepper',
        group: 'Navigation',
        name: 'Stepper',
        tag: 'ge-stepper',
        description: 'A row or column of steps. It tracks which are complete, current and pending, and each step can carry its own panel.',
        examples: [
            {
                title: 'With panels',
                note: 'Click a step to jump; the Next and Back buttons call `nextStep()` and `prevStep()`.',
                block: true,
                html: `<ge-stepper id="st-demo" active-step="0">
  <ge-stepper-item value="account"><ge-stepper-trigger><ge-stepper-title>Account</ge-stepper-title><ge-stepper-description>Create your login</ge-stepper-description></ge-stepper-trigger><ge-stepper-content>Pick a username and a password.</ge-stepper-content></ge-stepper-item>
  <ge-stepper-item value="profile"><ge-stepper-trigger><ge-stepper-title>Profile</ge-stepper-title><ge-stepper-description>Tell us about you</ge-stepper-description></ge-stepper-trigger><ge-stepper-content>Add a name and a photo.</ge-stepper-content></ge-stepper-item>
  <ge-stepper-item value="done"><ge-stepper-trigger><ge-stepper-title>Done</ge-stepper-title></ge-stepper-trigger><ge-stepper-content>You are all set.</ge-stepper-content></ge-stepper-item>
</ge-stepper>
<div style="display:flex;gap:0.5rem;margin-top:1rem">
  <ge-button variant="outline" onclick="document.getElementById('st-demo').prevStep()">Back</ge-button>
  <ge-button onclick="document.getElementById('st-demo').nextStep()">Next</ge-button>
</div>`,
            },
            {
                title: 'Vertical',
                block: true,
                html: `<ge-stepper orientation="vertical" active-step="1">
  <ge-stepper-item value="a"><ge-stepper-trigger><ge-stepper-title>Order placed</ge-stepper-title></ge-stepper-trigger></ge-stepper-item>
  <ge-stepper-item value="b"><ge-stepper-trigger><ge-stepper-title>Packed</ge-stepper-title></ge-stepper-trigger></ge-stepper-item>
  <ge-stepper-item value="c"><ge-stepper-trigger><ge-stepper-title>Shipped</ge-stepper-title></ge-stepper-trigger></ge-stepper-item>
</ge-stepper>`,
            },
            {
                title: 'Linear',
                note: 'Steps ahead are disabled; only Next moves forward.',
                block: true,
                html: `<ge-stepper id="st-linear" linear active-step="0">
  <ge-stepper-item value="a"><ge-stepper-trigger><ge-stepper-title>Cart</ge-stepper-title></ge-stepper-trigger></ge-stepper-item>
  <ge-stepper-item value="b"><ge-stepper-trigger><ge-stepper-title>Address</ge-stepper-title></ge-stepper-trigger></ge-stepper-item>
  <ge-stepper-item value="c"><ge-stepper-trigger><ge-stepper-title>Payment</ge-stepper-title></ge-stepper-trigger></ge-stepper-item>
</ge-stepper>
<div style="margin-top:1rem"><ge-button onclick="document.getElementById('st-linear').nextStep()">Next</ge-button></div>`,
            },
            {
                title: 'Quick form with a guard',
                note: 'Set `steps` and `canLeave` from script. The guard may return a promise; every step is disabled while it decides.',
                block: true,
                html: `<ge-stepper id="st-quick" active-step="0"></ge-stepper>
<script>
const s = document.getElementById('st-quick');
s.steps = [{ value: 'a', title: 'Details', description: 'Needs a check' }, { value: 'b', title: 'Review' }, { value: 'c', title: 'Finish' }];
s.canLeave = (from, to) => to < from || new Promise((ok) => setTimeout(() => ok(true), 800));
</script>`,
            },
        ],
        api: [
            { name: 'active-step', type: 'number', default: '0', description: 'Index of the current step; earlier ones are complete.' },
            { name: 'orientation', type: "'horizontal' | 'vertical'", default: "'horizontal'", description: 'Row with connectors, or column.' },
            { name: 'linear', type: 'boolean', default: 'false', description: 'Steps ahead of the current one cannot be jumped to; `nextStep()` still advances.' },
            { name: 'steps', type: '{ value, title, description? }[]', default: '-', description: 'Property only. Quick form; leave empty to project `ge-stepper-item`s.' },
            { name: 'canLeave', type: '(from, to) => boolean | Promise<boolean>', default: '-', description: 'Property only. Runs before every move that changes the step. A refusal, a throw or a rejection fires `step-blocked`.' },
            { name: 'goToStep(i) / nextStep() / prevStep()', type: 'methods', default: '-', description: 'Move programmatically. `nextStep` and `prevStep` stop at the ends.' },
            { name: 'step-change / step-blocked', type: 'event', default: '-', description: 'detail is the new index, or `{ from, to }` when the guard refused.' },
            { name: 'guardPending', type: 'boolean', default: 'false', description: 'True while an async guard is deciding.' },
        ],
    },
    {
        id: 'timeline',
        group: 'Display',
        name: 'Timeline',
        tag: 'ge-timeline',
        description: 'Events in order. Give each item a heading, description and time, or slot the dot, line and text yourself.',
        examples: [
            {
                title: 'Simple mode',
                block: true,
                html: `<ge-timeline>
  <ge-timeline-item heading="Version 2.0 released" description="Major update with new features." time="January 2024" variant="success"></ge-timeline-item>
  <ge-timeline-item heading="Beta started" description="Invited the first testers." time="November 2023" variant="filled"></ge-timeline-item>
  <ge-timeline-item heading="Build failed" time="October 2023" variant="error"></ge-timeline-item>
  <ge-timeline-item heading="Kickoff" time="September 2023"></ge-timeline-item>
</ge-timeline>`,
            },
            {
                title: 'Dot variants',
                block: true,
                html: `<ge-timeline>
  <ge-timeline-item heading="default"></ge-timeline-item>
  <ge-timeline-item heading="filled" variant="filled"></ge-timeline-item>
  <ge-timeline-item heading="outline" variant="outline"></ge-timeline-item>
  <ge-timeline-item heading="success" variant="success"></ge-timeline-item>
  <ge-timeline-item heading="error" variant="error"></ge-timeline-item>
  <ge-timeline-item heading="warning" variant="warning" hide-connector></ge-timeline-item>
</ge-timeline>`,
            },
            {
                title: 'Custom mode',
                note: 'Slot a header and content to take over. An icon in the dot works too.',
                block: true,
                html: `<ge-timeline>
  <ge-timeline-item>
    <ge-timeline-header>
      <ge-timeline-dot variant="filled"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></ge-timeline-dot>
      <ge-timeline-connector></ge-timeline-connector>
    </ge-timeline-header>
    <ge-timeline-content>
      <ge-timeline-title>Deployed</ge-timeline-title>
      <ge-timeline-description>Rolled out to every region.</ge-timeline-description>
      <ge-timeline-time>Today</ge-timeline-time>
    </ge-timeline-content>
  </ge-timeline-item>
  <ge-timeline-item>
    <ge-timeline-header><ge-timeline-dot variant="outline"></ge-timeline-dot></ge-timeline-header>
    <ge-timeline-content><ge-timeline-title>Queued</ge-timeline-title></ge-timeline-content>
  </ge-timeline-item>
</ge-timeline>`,
            },
        ],
        api: [
            { name: 'orientation', type: "'vertical' | 'horizontal'", default: "'vertical'", description: 'Direction the items are laid out.' },
            { name: 'item: heading / description / time', type: 'string', default: "''", description: 'Simple mode text. `heading` rather than `title`, which would show a browser tooltip.' },
            { name: 'item: variant', type: "'default' | 'filled' | 'outline' | 'success' | 'error' | 'warning'", default: "'default'", description: 'Colour of the dot in simple mode. Also an attribute of `ge-timeline-dot`.' },
            { name: 'item: hide-connector', type: 'boolean', default: 'false', description: 'Simple mode: no line under the dot.' },
        ],
    },
    {
        id: 'dialog',
        group: 'Overlays',
        name: 'Dialog',
        tag: 'ge-dialog',
        description: 'A modal box over the page. Wrap a trigger and a content in `ge-dialog`; it locks page scroll, keeps focus inside, and closes on Escape, the overlay or the close button.',
        examples: [
            {
                title: 'Simple mode',
                note: '`heading` and `description` generate the header. Focus returns to the button when it closes.',
                block: true,
                html: `<ge-dialog>
  <ge-dialog-trigger><ge-button variant="outline">Edit profile</ge-button></ge-dialog-trigger>
  <ge-dialog-content heading="Edit profile" description="Make changes to your profile here.">
    <ge-input aria-label="Name" placeholder="Your name"></ge-input>
    <ge-dialog-footer>
      <ge-button id="dlg-save">Save changes</ge-button>
    </ge-dialog-footer>
  </ge-dialog-content>
</ge-dialog>
<script>document.getElementById('dlg-save').addEventListener('click', (e) => e.target.closest('ge-dialog').hide());</script>`,
            },
            {
                title: 'Custom mode',
                note: 'Slot a header, title, description and footer for full control.',
                block: true,
                html: `<ge-dialog>
  <ge-dialog-trigger><ge-button variant="destructive">Delete project</ge-button></ge-dialog-trigger>
  <ge-dialog-content>
    <ge-dialog-header>
      <ge-dialog-title>Delete this project?</ge-dialog-title>
      <ge-dialog-description>All its files are removed. This cannot be undone.</ge-dialog-description>
    </ge-dialog-header>
    <ge-dialog-footer>
      <ge-button variant="outline" onclick="this.closest('ge-dialog').hide()">Cancel</ge-button>
      <ge-button variant="destructive" onclick="this.closest('ge-dialog').hide()">Delete</ge-button>
    </ge-dialog-footer>
  </ge-dialog-content>
</ge-dialog>`,
            },
            {
                title: 'Nested',
                note: 'Escape closes the inner dialog first.',
                block: true,
                html: `<ge-dialog>
  <ge-dialog-trigger><ge-button variant="outline">Open outer</ge-button></ge-dialog-trigger>
  <ge-dialog-content heading="Outer" description="Open another one from here.">
    <ge-dialog>
      <ge-dialog-trigger><ge-button>Open inner</ge-button></ge-dialog-trigger>
      <ge-dialog-content heading="Inner" description="Press Escape to close only this one."></ge-dialog-content>
    </ge-dialog>
  </ge-dialog-content>
</ge-dialog>`,
            },
        ],
        api: [
            { name: 'open', type: 'boolean', default: 'false', description: 'Whether the dialog is showing. `show()`, `hide()` and `toggle()` also work.' },
            { name: 'open-change', type: 'event', default: '-', description: 'When the user opens or closes it; detail is the new state. Setting `open` yourself does not fire it.' },
            { name: 'content: heading / description', type: 'string', default: "''", description: 'Simple mode header. `heading` rather than `title`, which would show a browser tooltip.' },
            { name: 'content: close-label', type: 'string', default: "'Close'", description: 'Accessible name of the overlay and close button (no locale tables yet).' },
            { name: '--density-dialog', type: 'css', default: '--density', description: 'Spacing multiplier for padding and gaps.' },
        ],
    },
    {
        id: 'alert-dialog',
        group: 'Overlays',
        name: 'Alert Dialog',
        tag: 'ge-alert-dialog',
        description: 'A modal that asks for a decision. Unlike a dialog it has no close button and the overlay does not dismiss it; Escape and the two choices do.',
        examples: [
            {
                title: 'Simple mode',
                note: '`heading` and `description` generate the header; the footer gets Cancel and Continue. Listen for `action-click`.',
                block: true,
                html: `<ge-alert-dialog>
  <ge-alert-dialog-trigger><ge-button variant="destructive">Delete account</ge-button></ge-alert-dialog-trigger>
  <ge-alert-dialog-content heading="Are you absolutely sure?" description="This action cannot be undone. It permanently deletes your account." action-text="Delete" cancel-text="Keep it"></ge-alert-dialog-content>
</ge-alert-dialog>`,
            },
            {
                title: 'Custom mode',
                block: true,
                html: `<ge-alert-dialog>
  <ge-alert-dialog-trigger><ge-button variant="outline">Discard draft</ge-button></ge-alert-dialog-trigger>
  <ge-alert-dialog-content>
    <ge-alert-dialog-header>
      <ge-alert-dialog-title>Discard this draft?</ge-alert-dialog-title>
      <ge-alert-dialog-description>You will lose the text you wrote.</ge-alert-dialog-description>
    </ge-alert-dialog-header>
    <ge-alert-dialog-footer>
      <ge-alert-dialog-cancel>Stay</ge-alert-dialog-cancel>
      <ge-alert-dialog-action>Discard</ge-alert-dialog-action>
    </ge-alert-dialog-footer>
  </ge-alert-dialog-content>
</ge-alert-dialog>`,
            },
        ],
        api: [
            { name: 'open', type: 'boolean', default: 'false', description: 'Whether it is showing. `show()`, `hide()` and `toggle()` also work.' },
            { name: 'open-change', type: 'event', default: '-', description: 'When the user opens or closes it; detail is the new state.' },
            { name: 'content: heading / description', type: 'string', default: "''", description: 'Simple mode header; setting `heading` also generates the footer.' },
            { name: 'content: action-text / cancel-text', type: 'string', default: "'Continue' / 'Cancel'", description: 'Labels of the generated buttons.' },
            { name: 'content: action-click / cancel-click', type: 'event', default: '-', description: 'The generated button was clicked; the dialog closes too. Slotted `ge-alert-dialog-action` and `-cancel` close it as well: listen to `click` on them.' },
            { name: '--density-alert-dialog', type: 'css', default: '--density', description: 'Spacing multiplier for the box padding and gap.' },
        ],
    },
    {
        id: 'sheet',
        group: 'Overlays',
        name: 'Sheet',
        tag: 'ge-sheet',
        description: 'A panel that slides in from an edge. Same behaviour as the dialog: scroll lock, focus kept inside, closes on Escape, the overlay or the close button.',
        examples: [
            {
                title: 'Sides',
                note: 'Left and right follow the text direction: flip RTL in the toolbar and try again.',
                html: `<ge-sheet>
  <ge-sheet-trigger><ge-button variant="outline">Right</ge-button></ge-sheet-trigger>
  <ge-sheet-content heading="Edit profile" description="Make changes to your profile here.">
    <ge-input aria-label="Name" placeholder="Your name"></ge-input>
  </ge-sheet-content>
</ge-sheet>
<ge-sheet>
  <ge-sheet-trigger><ge-button variant="outline">Left</ge-button></ge-sheet-trigger>
  <ge-sheet-content side="left" heading="Navigation" description="Where do you want to go?"></ge-sheet-content>
</ge-sheet>
<ge-sheet>
  <ge-sheet-trigger><ge-button variant="outline">Top</ge-button></ge-sheet-trigger>
  <ge-sheet-content side="top" heading="Announcement" description="A banner that slides from the top."></ge-sheet-content>
</ge-sheet>
<ge-sheet>
  <ge-sheet-trigger><ge-button variant="outline">Bottom</ge-button></ge-sheet-trigger>
  <ge-sheet-content side="bottom" heading="Share" description="Pick where to send it."></ge-sheet-content>
</ge-sheet>`,
            },
            {
                title: 'Custom mode with a close button of your own',
                block: true,
                html: `<ge-sheet>
  <ge-sheet-trigger><ge-button>Open filters</ge-button></ge-sheet-trigger>
  <ge-sheet-content>
    <ge-sheet-header>
      <ge-sheet-title>Filters</ge-sheet-title>
      <ge-sheet-description>Narrow the list down.</ge-sheet-description>
    </ge-sheet-header>
    <ge-sheet-footer>
      <ge-sheet-close><ge-button variant="outline">Reset</ge-button></ge-sheet-close>
      <ge-sheet-close><ge-button>Apply</ge-button></ge-sheet-close>
    </ge-sheet-footer>
  </ge-sheet-content>
</ge-sheet>`,
            },
        ],
        api: [
            { name: 'open', type: 'boolean', default: 'false', description: 'Whether it is showing. `show()`, `hide()` and `toggle()` also work.' },
            { name: 'open-change', type: 'event', default: '-', description: 'When the user opens or closes it; detail is the new state.' },
            { name: 'content: side', type: "'top' | 'bottom' | 'left' | 'right'", default: "'right'", description: 'Edge it slides from. Left and right follow the text direction.' },
            { name: 'content: heading / description / close-label', type: 'string', default: "'' / '' / 'Close'", description: 'Simple mode header and the close button name.' },
            { name: 'ge-sheet-close', type: 'element', default: '-', description: 'Closes the sheet when clicked; wrap a button of your own.' },
            { name: '--density-sheet', type: 'css', default: '--density', description: 'Spacing multiplier for the panel padding.' },
        ],
    },
    {
        id: 'drawer',
        group: 'Overlays',
        name: 'Drawer',
        tag: 'ge-drawer',
        description: 'A modal panel that slides in from an edge, with a drag handle on top and bottom. Same behaviour as the dialog; unlike the sheet it has no close button, so give it a ge-drawer-close of your own.',
        examples: [
            {
                title: 'Simple mode',
                note: '`heading` and `description` generate the header.',
                block: true,
                html: `<ge-drawer>
  <ge-drawer-trigger><ge-button variant="outline">Open drawer</ge-button></ge-drawer-trigger>
  <ge-drawer-content heading="Move goal" description="Set your daily activity goal.">
    <div style="padding:1rem"><p>Pick a number of steps that feels reachable.</p></div>
  </ge-drawer-content>
</ge-drawer>`,
            },
            {
                title: 'Custom mode',
                block: true,
                html: `<ge-drawer>
  <ge-drawer-trigger><ge-button variant="outline">Open with actions</ge-button></ge-drawer-trigger>
  <ge-drawer-content>
    <ge-drawer-header>
      <ge-drawer-title>Are you sure?</ge-drawer-title>
      <ge-drawer-description>This action cannot be undone.</ge-drawer-description>
    </ge-drawer-header>
    <div style="padding:1rem"><p>Anything you want can go here.</p></div>
    <ge-drawer-footer>
      <ge-button>Save</ge-button>
      <ge-drawer-close><ge-button variant="outline">Cancel</ge-button></ge-drawer-close>
    </ge-drawer-footer>
  </ge-drawer-content>
</ge-drawer>`,
            },
            {
                title: 'Directions',
                note: 'Left and right follow the text direction: flip RTL in the toolbar and try again.',
                html: `<ge-drawer direction="top">
  <ge-drawer-trigger><ge-button variant="outline">Top</ge-button></ge-drawer-trigger>
  <ge-drawer-content heading="From the top" description="The handle sits at the bottom edge."></ge-drawer-content>
</ge-drawer>
<ge-drawer direction="left">
  <ge-drawer-trigger><ge-button variant="outline">Left</ge-button></ge-drawer-trigger>
  <ge-drawer-content heading="From the left" description="Three quarters of the width, up to 24rem."></ge-drawer-content>
</ge-drawer>
<ge-drawer direction="right">
  <ge-drawer-trigger><ge-button variant="outline">Right</ge-button></ge-drawer-trigger>
  <ge-drawer-content heading="From the right" description="Same, mirrored."></ge-drawer-content>
</ge-drawer>`,
            },
        ],
        api: [
            { name: 'open', type: 'boolean', default: 'false', description: 'Whether it is showing. `show()`, `hide()` and `toggle()` also work.' },
            { name: 'open-change', type: 'event', default: '-', description: 'When the user opens or closes it; detail is the new state.' },
            { name: 'direction', type: "'top' | 'bottom' | 'left' | 'right'", default: "'bottom'", description: 'Edge it slides from. The drag handle shows for top and bottom only.' },
            { name: 'content: heading / description', type: 'string', default: "''", description: 'Simple mode header.' },
            { name: 'ge-drawer-close', type: 'element', default: '-', description: 'Closes the drawer when clicked; wrap a button of your own.' },
        ],
    },
    {
        id: 'input-otp',
        group: 'Form inputs',
        name: 'Input OTP',
        tag: 'ge-input-otp',
        description: 'A one-time-code field: a row of slots drawn over one visually hidden input, so typing, paste and autofill work natively.',
        examples: [
            {
                title: 'Default',
                note: 'Six slots with a dot after the third. Type, paste a code, or use the arrow keys, Home and End.',
                html: `<ge-input-otp id="otp-basic"></ge-input-otp>
<p id="otp-basic-out" style="margin:0.5rem 0 0;font-size:0.875rem;color:var(--muted-foreground)" dir="ltr">Code: —</p>
<script>
(() => {
const otp = document.getElementById('otp-basic');
otp.addEventListener('value-change', (e) => (document.getElementById('otp-basic-out').textContent = 'Code: ' + (e.detail || '—')));
})();
</script>`,
            },
            {
                title: 'Length and separators',
                block: true,
                html: `<div style="display:grid;gap:1rem">
  <ge-input-otp max-length="4" separator=""></ge-input-otp>
  <ge-input-otp max-length="8" separator="1,5" value="12AB"></ge-input-otp>
  <ge-input-otp disabled value="123"></ge-input-otp>
</div>`,
            },
            {
                title: 'In a form',
                note: 'With a `name` the code is submitted with the form, and a reset restores the initial value.',
                html: `<form id="otp-form" style="display:grid;gap:0.75rem;justify-items:start">
  <ge-input-otp name="code"></ge-input-otp>
  <div style="display:flex;gap:0.5rem">
    <ge-button type="submit" size="sm">Verify</ge-button>
    <ge-button type="reset" size="sm" variant="outline">Reset</ge-button>
  </div>
  <p id="otp-form-out" style="margin:0;font-size:0.875rem;color:var(--muted-foreground)" dir="ltr">Submitted: —</p>
</form>
<script>
(() => {
document.getElementById('otp-form').addEventListener('submit', (e) => {
  e.preventDefault();
  document.getElementById('otp-form-out').textContent = 'Submitted: ' + (new FormData(e.target).get('code') || '—');
});
})();
</script>`,
            },
        ],
        api: [
            { name: 'value', type: 'string', default: "''", description: 'The code. A value set from outside is shown as it is; typed text is stripped to letters and digits, upper-cased and cut to `max-length`.' },
            { name: 'max-length', type: 'number', default: '6', description: 'Number of slots and the cap on the code.' },
            { name: 'separator', type: 'string', default: "'2'", description: 'Comma-separated zero-based slot indices after which a dot is drawn. Empty draws none.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Disables the field and dims the row.' },
            { name: 'name', type: 'string', default: "''", description: 'Form field name; the code is submitted with the form.' },
            { name: 'aria-label / locale', type: 'string', default: "'One-time code'", description: 'Accessible name of the field; the default follows `locale` or the page `lang`.' },
            { name: 'value-change', type: 'event', default: '-', description: 'After a user edit; detail is the sanitised code.' },
        ],
    },
    {
        id: 'split-button',
        group: 'Actions',
        name: 'Split Button',
        tag: 'ge-split-button',
        description: 'A primary action joined to a dropdown of related actions. Set `label` and `items` for the quick form, or slot the parts yourself.',
        examples: [
            {
                title: 'Simple mode',
                note: 'The `items` property takes the rows; each row\'s own `click` runs after `item-click`.',
                html: `<ge-split-button id="split-data" label="Save changes"></ge-split-button>
<p id="split-data-out" style="margin:0.5rem 0 0;font-size:0.875rem;color:var(--muted-foreground)">Nothing yet.</p>
<script>
(() => {
const split = document.getElementById('split-data');
const out = document.getElementById('split-data-out');
split.items = [{ label: 'Edit', icon: '✎' }, { label: 'Duplicate', icon: '📄' }, { label: 'Delete', icon: '🗑️', disabled: true }];
split.addEventListener('primary-click', () => (out.textContent = 'Primary action'));
split.addEventListener('item-click', (e) => (out.textContent = 'Menu item: ' + e.detail.label));
})();
</script>`,
            },
            {
                title: 'Custom mode',
                note: 'A projected row reports its `value`, not its text.',
                html: `<ge-split-button>
  <ge-split-button-primary>Deploy</ge-split-button-primary>
  <ge-split-button-menu>
    <ge-split-button-item value="staging">Deploy to staging</ge-split-button-item>
    <ge-split-button-item value="production">Deploy to production</ge-split-button-item>
    <ge-split-button-item value="rollback" disabled>Roll back</ge-split-button-item>
  </ge-split-button-menu>
</ge-split-button>`,
            },
            {
                title: 'Variants and sizes',
                block: true,
                html: `<div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">
  <ge-split-button label="Secondary" variant="secondary"></ge-split-button>
  <ge-split-button label="Destructive" variant="destructive"></ge-split-button>
  <ge-split-button label="Outline" variant="outline"></ge-split-button>
  <ge-split-button label="Small" size="sm"></ge-split-button>
  <ge-split-button label="Large" size="lg"></ge-split-button>
  <ge-split-button label="Disabled" disabled></ge-split-button>
</div>
<script>
(() => {
document.querySelectorAll('ge-split-button[label]').forEach((s) => { if (!s.items.length && s.id === '') s.items = [{ label: 'One' }, { label: 'Two' }]; });
})();
</script>`,
            },
        ],
        api: [
            { name: 'label', type: 'string', default: "''", description: 'Text of the primary half. A non-empty label wins over a projected `ge-split-button-primary`.' },
            { name: 'items', type: '{ label, value?, icon?, disabled?, click? }[]', default: '[]', description: 'Property only. Menu rows; non-empty wins over a projected `ge-split-button-menu`.' },
            { name: 'variant / size', type: 'button variant / size', default: "'default'", description: 'Applied to both halves.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Disables both halves.' },
            { name: 'open', type: 'boolean', default: 'false', description: 'Whether the menu is showing. It opens upward when fewer than 150px remain below.' },
            { name: 'dropdown-label', type: 'string', default: "'More options'", description: 'Accessible name of the toggle.' },
            { name: 'primary-click', type: 'event', default: '-', description: 'The primary half was clicked; the toggle never fires it.' },
            { name: 'item-click', type: 'event', default: '-', description: 'A row was activated; detail is the item, or `{ label: \'\', value }` for a projected row.' },
        ],
    },
    {
        id: 'table',
        group: 'Display',
        name: 'Table',
        tag: 'ge-table',
        description: 'A table made of flex rows, so the header can stick while the body scrolls. Size a column by giving its head and cells the same width.',
        examples: [
            {
                title: 'Basic',
                block: true,
                html: `<ge-table>
  <ge-table-caption>A list of your recent invoices.</ge-table-caption>
  <ge-table-header>
    <ge-table-row>
      <ge-table-head style="flex:none;width:100px">Invoice</ge-table-head>
      <ge-table-head>Status</ge-table-head>
      <ge-table-head>Method</ge-table-head>
      <ge-table-head style="flex:none;width:100px;text-align:right">Amount</ge-table-head>
    </ge-table-row>
  </ge-table-header>
  <ge-table-body>
    <ge-table-row>
      <ge-table-cell style="flex:none;width:100px;font-weight:500">INV001</ge-table-cell>
      <ge-table-cell>Paid</ge-table-cell>
      <ge-table-cell>Credit Card</ge-table-cell>
      <ge-table-cell style="flex:none;width:100px;text-align:right">$250.00</ge-table-cell>
    </ge-table-row>
    <ge-table-row>
      <ge-table-cell style="flex:none;width:100px;font-weight:500">INV002</ge-table-cell>
      <ge-table-cell>Pending</ge-table-cell>
      <ge-table-cell>PayPal</ge-table-cell>
      <ge-table-cell style="flex:none;width:100px;text-align:right">$150.00</ge-table-cell>
    </ge-table-row>
    <ge-table-row>
      <ge-table-cell style="flex:none;width:100px;font-weight:500">INV003</ge-table-cell>
      <ge-table-cell>Unpaid</ge-table-cell>
      <ge-table-cell>Bank Transfer</ge-table-cell>
      <ge-table-cell style="flex:none;width:100px;text-align:right">$350.00</ge-table-cell>
    </ge-table-row>
  </ge-table-body>
</ge-table>`,
            },
            {
                title: 'Selected row and footer',
                note: '`selected` only paints the row; it does not manage a selection.',
                block: true,
                html: `<ge-table>
  <ge-table-caption>A list of your recent invoices.</ge-table-caption>
  <ge-table-header>
    <ge-table-row>
      <ge-table-head style="flex:none;width:100px">Invoice</ge-table-head>
      <ge-table-head>Status</ge-table-head>
      <ge-table-head>Method</ge-table-head>
      <ge-table-head style="flex:none;width:100px;text-align:right">Amount</ge-table-head>
    </ge-table-row>
  </ge-table-header>
  <ge-table-body>
    <ge-table-row>
      <ge-table-cell style="flex:none;width:100px;font-weight:500">INV001</ge-table-cell>
      <ge-table-cell>Paid</ge-table-cell>
      <ge-table-cell>Credit Card</ge-table-cell>
      <ge-table-cell style="flex:none;width:100px;text-align:right">$250.00</ge-table-cell>
    </ge-table-row>
    <ge-table-row selected>
      <ge-table-cell style="flex:none;width:100px;font-weight:500">INV002</ge-table-cell>
      <ge-table-cell>Pending</ge-table-cell>
      <ge-table-cell>PayPal</ge-table-cell>
      <ge-table-cell style="flex:none;width:100px;text-align:right">$150.00</ge-table-cell>
    </ge-table-row>
    <ge-table-row>
      <ge-table-cell style="flex:none;width:100px;font-weight:500">INV003</ge-table-cell>
      <ge-table-cell>Unpaid</ge-table-cell>
      <ge-table-cell>Bank Transfer</ge-table-cell>
      <ge-table-cell style="flex:none;width:100px;text-align:right">$350.00</ge-table-cell>
    </ge-table-row>
  </ge-table-body>
  <ge-table-footer>
    <ge-table-row>
      <ge-table-cell style="flex:none;width:100px;font-weight:500">Total</ge-table-cell>
      <ge-table-cell></ge-table-cell>
      <ge-table-cell></ge-table-cell>
      <ge-table-cell style="flex:none;width:100px;text-align:right">$750.00</ge-table-cell>
    </ge-table-row>
  </ge-table-footer>
</ge-table>`,
            },
            {
                title: 'Loading',
                note: '`skeleton` swaps the body rows for placeholders; the header and footer stay.',
                block: true,
                html: `<ge-table>
  <ge-table-caption>A list of your recent invoices.</ge-table-caption>
  <ge-table-header>
    <ge-table-row>
      <ge-table-head style="flex:none;width:100px">Invoice</ge-table-head>
      <ge-table-head>Status</ge-table-head>
      <ge-table-head>Method</ge-table-head>
      <ge-table-head style="flex:none;width:100px;text-align:right">Amount</ge-table-head>
    </ge-table-row>
  </ge-table-header>
  <ge-table-body skeleton skeleton-rows="3">
  </ge-table-body>
</ge-table>`,
            },
        ],
        api: [
            { name: 'table: role', type: "'table' | 'grid' | 'treegrid'", default: "'table'", description: 'The ARIA role of the table (the `role` attribute itself). Use `grid` for an interactive table, `treegrid` when rows expand. Cells follow with `cell` or `gridcell`.' },
            { name: 'row: selected', type: 'boolean', default: 'false', description: 'Paints the selected background and sets `data-state="selected"`.' },
            { name: 'body: skeleton / skeleton-rows', type: 'boolean / number', default: 'false / 5', description: 'Shows placeholder rows instead of the projected ones while data loads.' },
            { name: 'head: role', type: "'columnheader' | 'presentation'", default: "'columnheader'", description: 'Use `presentation` on a decorative filler cell.' },
            { name: 'cells: width', type: 'CSS', default: 'equal share', description: 'Cells are `flex: 1`. Set `flex: none` and a width on a head and its cells to size a column.' },
        ],
    },
    {
        id: 'time-picker',
        group: 'Form inputs',
        name: 'Time picker',
        tag: 'ge-time-picker',
        description: 'A time of day edited one segment at a time. The value is always 24-hour "HH:mm"; the order, separators, digits and AM/PM come from the locale.',
        examples: [
            {
                title: 'Basic',
                note: 'Arrow Up and Down step the segment under the caret; typing keeps the last two digits. The value stays empty until both hour and minute are set.',
                html: `<ge-time-picker id="tp-basic" value="09:05" aria-label="Time"></ge-time-picker>
<p id="tp-basic-out" style="margin-top:.5rem;font-size:.875rem;color:var(--muted-foreground)">Value: 09:05</p>
<script>
(() => {
document.getElementById('tp-basic').addEventListener('value-change', (e) => {
  document.getElementById('tp-basic-out').textContent = 'Value: ' + (e.detail || 'none');
});
})();
</script>`,
            },
            {
                title: 'Locales',
                note: 'Each locale decides the layout: 12 or 24 hours, digits, and where the meridiem goes (first in zh-TW).',
                block: true,
                html: `<div style="display:grid;gap:.75rem;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))">
  <ge-time-picker value="21:05" locale="en-US" aria-label="US English"></ge-time-picker>
  <ge-time-picker value="21:05" locale="de-DE" aria-label="German"></ge-time-picker>
  <ge-time-picker value="21:05" locale="ar-EG" aria-label="Egyptian Arabic"></ge-time-picker>
  <ge-time-picker value="21:05" locale="zh-TW" aria-label="Traditional Chinese"></ge-time-picker>
</div>`,
            },
            {
                title: 'With seconds',
                html: `<ge-time-picker value="09:05:09" locale="en-GB" with-seconds aria-label="Time"></ge-time-picker>`,
            },
            {
                title: 'Variants and disabled',
                html: `<div style="display:flex;flex-wrap:wrap;gap:1rem;align-items:center">
  <ge-time-picker value="21:05" variant="underline" aria-label="Underline"></ge-time-picker>
  <ge-time-picker value="21:05" variant="ghost" aria-label="Ghost"></ge-time-picker>
  <ge-time-picker value="21:05" disabled aria-label="Disabled"></ge-time-picker>
</div>`,
            },
        ],
        api: [
            { name: 'value', type: 'string', default: "''", description: 'The time as `HH:mm` (`HH:mm:ss` with `with-seconds`), always 24-hour. Empty while incomplete. Setting it renders without firing `value-change`.' },
            { name: 'locale', type: 'string (BCP-47)', default: 'page lang', description: 'Decides the layout, digits and day-period names.' },
            { name: 'with-seconds', type: 'boolean', default: 'false', description: 'Adds a seconds segment.' },
            { name: 'variant', type: "'outline' | 'underline' | 'ghost'", default: "'outline'", description: 'Visual style of the wrapper.' },
            { name: 'disabled / name', type: 'boolean / string', default: '-', description: 'Disables every segment; submits the value with its form (form-associated, resettable).' },
            { name: 'aria-label', type: 'string', default: "'Time'", description: 'Accessible name of the group.' },
            { name: 'value-change', type: 'event', default: '-', description: 'When the user changes the value; detail is the new `HH:mm` (empty while incomplete).' },
        ],
    },
    {
        id: 'carousel',
        group: 'Layout',
        name: 'Carousel',
        tag: 'ge-carousel',
        description: 'Scroll-snapping slides with previous and next buttons. The arrow keys page it when the track has focus, and a finger swipes it.',
        examples: [
            {
                title: 'Horizontal',
                block: true,
                html: `<div style="margin-inline:auto;max-width:24rem;padding-inline:3rem">
<ge-carousel style="width:100%">
  <ge-carousel-content>
    <ge-carousel-item><div style="padding:.25rem"><ge-card><ge-card-content style="display:flex;aspect-ratio:1;align-items:center;justify-content:center;padding:1.5rem"><span style="font-size:2.25rem;font-weight:600">1</span></ge-card-content></ge-card></div></ge-carousel-item>
    <ge-carousel-item><div style="padding:.25rem"><ge-card><ge-card-content style="display:flex;aspect-ratio:1;align-items:center;justify-content:center;padding:1.5rem"><span style="font-size:2.25rem;font-weight:600">2</span></ge-card-content></ge-card></div></ge-carousel-item>
    <ge-carousel-item><div style="padding:.25rem"><ge-card><ge-card-content style="display:flex;aspect-ratio:1;align-items:center;justify-content:center;padding:1.5rem"><span style="font-size:2.25rem;font-weight:600">3</span></ge-card-content></ge-card></div></ge-carousel-item>
    <ge-carousel-item><div style="padding:.25rem"><ge-card><ge-card-content style="display:flex;aspect-ratio:1;align-items:center;justify-content:center;padding:1.5rem"><span style="font-size:2.25rem;font-weight:600">4</span></ge-card-content></ge-card></div></ge-carousel-item>
    <ge-carousel-item><div style="padding:.25rem"><ge-card><ge-card-content style="display:flex;aspect-ratio:1;align-items:center;justify-content:center;padding:1.5rem"><span style="font-size:2.25rem;font-weight:600">5</span></ge-card-content></ge-card></div></ge-carousel-item>
  </ge-carousel-content>
  <ge-carousel-previous></ge-carousel-previous>
  <ge-carousel-next></ge-carousel-next>
</ge-carousel>
</div>`,
            },
            {
                title: 'Vertical',
                block: true,
                html: `<div style="margin-inline:auto;max-width:24rem;padding-block:3rem">
<ge-carousel orientation="vertical" style="width:100%">
  <ge-carousel-content style="height:200px">
    <ge-carousel-item><div style="padding:.25rem"><ge-card><ge-card-content style="display:flex;align-items:center;justify-content:center;padding:1.5rem"><span style="font-size:1.5rem;font-weight:600">Slide 1</span></ge-card-content></ge-card></div></ge-carousel-item>
    <ge-carousel-item><div style="padding:.25rem"><ge-card><ge-card-content style="display:flex;align-items:center;justify-content:center;padding:1.5rem"><span style="font-size:1.5rem;font-weight:600">Slide 2</span></ge-card-content></ge-card></div></ge-carousel-item>
    <ge-carousel-item><div style="padding:.25rem"><ge-card><ge-card-content style="display:flex;align-items:center;justify-content:center;padding:1.5rem"><span style="font-size:1.5rem;font-weight:600">Slide 3</span></ge-card-content></ge-card></div></ge-carousel-item>
    <ge-carousel-item><div style="padding:.25rem"><ge-card><ge-card-content style="display:flex;align-items:center;justify-content:center;padding:1.5rem"><span style="font-size:1.5rem;font-weight:600">Slide 4</span></ge-card-content></ge-card></div></ge-carousel-item>
    <ge-carousel-item><div style="padding:.25rem"><ge-card><ge-card-content style="display:flex;align-items:center;justify-content:center;padding:1.5rem"><span style="font-size:1.5rem;font-weight:600">Slide 5</span></ge-card-content></ge-card></div></ge-carousel-item>
  </ge-carousel-content>
  <ge-carousel-previous></ge-carousel-previous>
  <ge-carousel-next></ge-carousel-next>
</ge-carousel>
</div>`,
            },
        ],
        api: [
            { name: 'orientation', type: "'horizontal' | 'vertical'", default: "'horizontal'", description: 'Scroll axis; it also decides the paging keys and where the buttons sit.' },
            { name: 'slide-change', type: 'event', default: '-', description: 'When the first visible slide changes; detail is its index. Assumes slides of one size.' },
            { name: 'scrollPrev() / scrollNext() / scrollToSlide(i)', type: 'methods', default: '-', description: 'Page back or forward by one view, or bring a slide into view. `scrollToSlide` is Angular\'s `scrollTo`, renamed because `scrollTo` is a native element method.' },
            { name: 'item: flex-basis', type: 'CSS', default: '100%', description: 'Set it on a slide to show several at once, such as `50%`.' },
            { name: 'previous / next: locale', type: 'string', default: 'page language', description: 'Language of the button labels.' },
        ],
    },
    {
        id: 'resizable',
        group: 'Layout',
        name: 'Resizable',
        tag: 'ge-resizable-panel-group',
        description: 'Panels you resize by dragging the divider between them, with a finger, or with the arrow keys (5% a press). Each panel keeps to its own limits.',
        examples: [
            {
                title: 'Horizontal',
                block: true,
                html: `<ge-resizable-panel-group style="min-height:200px;max-width:28rem;border:1px solid var(--border);border-radius:var(--radius)">
  <ge-resizable-panel default-size="30"><div style="display:flex;height:100%;align-items:center;justify-content:center;background:color-mix(in oklab,var(--muted) 30%,transparent);padding:1.5rem"><b>Left (30%)</b></div></ge-resizable-panel>
  <ge-resizable-handle handle-size="2"></ge-resizable-handle>
  <ge-resizable-panel default-size="70"><div style="display:flex;height:100%;align-items:center;justify-content:center;padding:1.5rem"><b>Right (70%)</b></div></ge-resizable-panel>
</ge-resizable-panel-group>`,
            },
            {
                title: 'Vertical',
                block: true,
                html: `<ge-resizable-panel-group direction="vertical" style="height:300px;max-width:28rem;border:1px solid var(--border);border-radius:var(--radius)">
  <ge-resizable-panel default-size="40"><div style="display:flex;height:100%;align-items:center;justify-content:center;background:color-mix(in oklab,var(--muted) 30%,transparent);padding:1.5rem"><b>Top (40%)</b></div></ge-resizable-panel>
  <ge-resizable-handle handle-size="2"></ge-resizable-handle>
  <ge-resizable-panel default-size="60"><div style="display:flex;height:100%;align-items:center;justify-content:center;padding:1.5rem"><b>Bottom (60%)</b></div></ge-resizable-panel>
</ge-resizable-panel-group>`,
            },
            {
                title: 'Limits and a grip',
                note: 'The left panel stays between 20% and 60%, the right between 40% and 80%.',
                block: true,
                html: `<ge-resizable-panel-group style="min-height:200px;max-width:28rem;border:1px solid var(--border);border-radius:var(--radius)">
  <ge-resizable-panel id="rz-a" default-size="30" min-size="20" max-size="60"><div style="display:flex;height:100%;align-items:center;justify-content:center;background:color-mix(in oklab,var(--muted) 30%,transparent);padding:1rem;text-align:center"><span id="rz-a-out"><b>Left (30%)</b><br><small>range 20–60%</small></span></div></ge-resizable-panel>
  <ge-resizable-handle with-handle handle-size="8"></ge-resizable-handle>
  <ge-resizable-panel id="rz-b" default-size="70" min-size="40" max-size="80"><div style="display:flex;height:100%;align-items:center;justify-content:center;padding:1rem;text-align:center"><span id="rz-b-out"><b>Right (70%)</b><br><small>range 40–80%</small></span></div></ge-resizable-panel>
</ge-resizable-panel-group>
<script>
(() => {
for (const [id, label, range] of [['rz-a', 'Left', '20–60%'], ['rz-b', 'Right', '40–80%']]) {
  document.getElementById(id).addEventListener('size-change', (e) => {
    document.getElementById(id + '-out').innerHTML = '<b>' + label + ' (' + Math.round(e.detail) + '%)</b><br><small>range ' + range + '</small>';
  });
}
})();
</script>`,
            },
        ],
        api: [
            { name: 'group: direction', type: "'horizontal' | 'vertical'", default: "'horizontal'", description: 'Axis the panels are laid out and resized along. A vertical group is `height: 100%`: give its parent a height.' },
            { name: 'panel: default-size / min-size / max-size', type: 'number (%)', default: '50 / 10 / 90', description: 'Starting size, read once; the limits are enforced on every drag, key and method.' },
            { name: 'panel: setSize(n) / updateSize(n)', type: 'methods', default: '-', description: '`setSize` moves this panel alone; `updateSize` takes the difference out of its neighbour.' },
            { name: 'panel: size-change', type: 'event', default: '-', description: 'When the size moves; detail is the new percentage.' },
            { name: 'handle: with-handle / handle-size', type: 'boolean / number (px)', default: 'false / 4', description: 'Draw the grip; divider thickness, which is also its hit area.' },
            { name: 'handle: disabled', type: 'boolean', default: 'false', description: 'Removes the divider and freezes the panels.' },
            { name: 'handle: resized', type: 'event', default: '-', description: 'While the boundary moves; detail is `{ delta, sizes }`.' },
        ],
    },
    {
        id: 'textarea',
        group: 'Form inputs',
        name: 'Textarea',
        tag: 'ge-textarea',
        description: 'A multi-line text field. The native textarea lives inside, so typing, selection and resizing stay native.',
        examples: [
            {
                title: 'Variants',
                block: true,
                html: `<div style="display:grid;gap:1rem;width:20rem">
  <ge-textarea placeholder="Outline (default)"></ge-textarea>
  <ge-textarea variant="underline" placeholder="Underline"></ge-textarea>
  <ge-textarea variant="ghost" placeholder="Ghost"></ge-textarea>
</div>`,
            },
            {
                title: 'Rows and value',
                block: true,
                html: `<div style="display:grid;gap:1rem;width:20rem">
  <ge-textarea rows="6" placeholder="Six lines"></ge-textarea>
  <ge-textarea value="First line&#10;Second line"></ge-textarea>
</div>`,
            },
            {
                title: 'States',
                block: true,
                html: `<div style="display:grid;gap:1rem;width:20rem">
  <ge-textarea disabled value="Locked"></ge-textarea>
  <ge-textarea skeleton></ge-textarea>
</div>`,
            },
            {
                title: 'Labelled',
                note: 'A ge-label anywhere in the page names it and focuses it.',
                block: true,
                html: `<div style="display:grid;gap:.5rem;width:20rem">
  <ge-label for="bio">Biography</ge-label>
  <ge-textarea id="bio" placeholder="Tell us a little about yourself"></ge-textarea>
</div>`,
            },
        ],
        api: [
            { name: 'value / name', type: 'string', default: "''", description: 'Current text; with a name it is submitted with the form.' },
            { name: 'placeholder', type: 'string', default: "''", description: 'Hint shown while empty.' },
            { name: 'rows', type: 'number', default: '3', description: 'Visible lines.' },
            { name: 'variant', type: "'outline' | 'underline' | 'ghost'", default: "'outline'", description: 'Border treatment; underline and ghost cannot be resized.' },
            { name: 'disabled / skeleton', type: 'boolean', default: 'false', description: 'Blocks editing / shows a placeholder.' },
            { name: 'aria-label, aria-labelledby, aria-describedby', type: 'string', default: '-', description: 'Resolved for the inner textarea, across the shadow boundary.' },
        ],
    },
    {
        id: 'button-group',
        group: 'Actions',
        name: 'Button group',
        tag: 'ge-button-group',
        description: 'Joins buttons into one control: outer corners stay round, neighbouring borders merge.',
        examples: [
            {
                title: 'Horizontal',
                html: `<ge-button-group>
  <ge-button variant="outline">Years</ge-button>
  <ge-button variant="outline">Months</ge-button>
  <ge-button variant="outline">Days</ge-button>
</ge-button-group>`,
            },
            {
                title: 'Vertical',
                html: `<ge-button-group orientation="vertical">
  <ge-button variant="outline">Top</ge-button>
  <ge-button variant="outline">Middle</ge-button>
  <ge-button variant="outline">Bottom</ge-button>
</ge-button-group>`,
            },
            {
                title: 'With text and a separator',
                html: `<ge-button-group>
  <ge-button-group-text>USD</ge-button-group-text>
  <ge-button variant="outline">Pay</ge-button>
  <ge-button-group-separator></ge-button-group-separator>
  <ge-button variant="outline">Cancel</ge-button>
</ge-button-group>`,
            },
        ],
        api: [
            { name: 'orientation', type: "'horizontal' | 'vertical'", default: "'horizontal'", description: 'Direction of the group.' },
            { name: 'ge-button-group-separator: orientation', type: "'horizontal' | 'vertical'", default: "'vertical'", description: 'Direction of the line.' },
        ],
    },
    {
        id: 'popover',
        group: 'Overlays',
        name: 'Popover',
        tag: 'ge-popover',
        description: 'A panel anchored to a trigger. It does not lock the page or trap focus; a click outside or Escape closes it, and focus goes back to the trigger.',
        examples: [
            {
                title: 'Simple',
                note: 'Style the panel through its `panel` part, e.g. a wider box.',
                html: `<style>#pop-dims::part(panel) { width: 20rem; }</style>
<ge-popover>
  <ge-popover-trigger><ge-button variant="outline">Open popover</ge-button></ge-popover-trigger>
  <ge-popover-content id="pop-dims">
    <div style="display:grid;gap:1rem">
      <div style="display:grid;gap:0.5rem">
        <h4 style="margin:0;font-weight:500;line-height:1">Dimensions</h4>
        <p style="margin:0;font-size:0.875rem;color:var(--muted-foreground)">Set the dimensions for the layer.</p>
      </div>
      <ge-input aria-label="Width" value="100%"></ge-input>
      <div style="display:flex;justify-content:flex-end">
        <ge-popover-close><ge-button size="sm">Close</ge-button></ge-popover-close>
      </div>
    </div>
  </ge-popover-content>
</ge-popover>`,
            },
            {
                title: 'Sides and alignment',
                note: '`side` is a preference: `top` and `bottom` flip when there is no room, and a panel near an edge is nudged back inside.',
                html: `<ge-popover>
  <ge-popover-trigger><ge-button variant="outline">Top, start</ge-button></ge-popover-trigger>
  <ge-popover-content side="top" align="start">Opens above, aligned to the trigger's start.</ge-popover-content>
</ge-popover>
<ge-popover>
  <ge-popover-trigger><ge-button variant="outline">Right</ge-button></ge-popover-trigger>
  <ge-popover-content side="right">Opens beside the trigger.</ge-popover-content>
</ge-popover>
<ge-popover>
  <ge-popover-trigger><ge-button variant="outline">Left, 12px away</ge-button></ge-popover-trigger>
  <ge-popover-content side="left" side-offset="12">Opens to the left, with a wider gap.</ge-popover-content>
</ge-popover>`,
            },
            {
                title: 'Top layer',
                note: '`strategy="fixed"` promotes the panel to the browser top layer, so an `overflow: hidden` ancestor cannot clip it.',
                html: `<div style="overflow:hidden;height:3.5rem;padding:0.5rem;border:1px dashed var(--border);border-radius:var(--radius)">
  <ge-popover>
    <ge-popover-trigger><ge-button variant="outline">Escapes the box</ge-button></ge-popover-trigger>
    <ge-popover-content strategy="fixed">Not clipped by the dashed box around it.</ge-popover-content>
  </ge-popover>
</div>`,
            },
            {
                title: 'Plain-text trigger',
                note: 'Content that is not a control becomes a button: Tab to it and press Enter or Space.',
                html: `<ge-popover>
  <ge-popover-trigger><span style="text-decoration:underline;cursor:pointer">What is this?</span></ge-popover-trigger>
  <ge-popover-content>It opens and closes like any popover.</ge-popover-content>
</ge-popover>`,
            },
        ],
        api: [
            { name: 'open', type: 'boolean', default: 'false', description: 'Whether the popover is showing. `show()`, `hide()` and `toggle()` also work.' },
            { name: 'open-change', type: 'event', default: '-', description: 'When the user opens or closes it; detail is the new state. Setting `open` yourself does not fire it.' },
            { name: 'close-on-scroll', type: 'boolean', default: 'false', description: 'Closes when anything outside the popover scrolls.' },
            { name: 'content: side', type: "'top' | 'right' | 'bottom' | 'left'", default: "'bottom'", description: 'Preferred edge of the trigger.' },
            { name: 'content: align', type: "'start' | 'center' | 'end'", default: "'center'", description: 'Alignment along that edge.' },
            { name: 'content: side-offset', type: 'number', default: '4', description: 'Gap in pixels between trigger and panel.' },
            { name: 'content: no-collisions', type: 'boolean', default: 'false', description: 'Pins the panel to `side` and `align` and accepts clipping.' },
            { name: 'content: no-restore-focus', type: 'boolean', default: 'false', description: 'Does not return focus to the trigger on close.' },
            { name: 'content: strategy', type: "'absolute' | 'fixed'", default: "'absolute'", description: '`fixed` renders in the browser top layer.' },
            { name: '--density-popover', type: 'css', default: '--density', description: 'Spacing multiplier for the panel padding.' },
            { name: '--popover-offset', type: 'css', default: 'side-offset', description: 'Gap between trigger and panel. `side-offset` supplies it; set it on `ge-popover-content::part(panel)` to override. Not inherited.' },
            { name: '--trigger-width', type: 'css', default: '-', description: 'Set on the open panel to the trigger\'s width, so it can match it with `width: var(--trigger-width)`.' },
        ],
    },
    {
        id: 'tooltip',
        group: 'Overlays',
        name: 'Tooltip',
        tag: 'ge-tooltip',
        description: 'A short label beside a trigger. It opens on hover after a short dwell, at once on keyboard focus, and on a tap on touch screens. It does not flip near a viewport edge.',
        examples: [
            {
                title: 'Simple mode',
                note: 'Set `content` and wrap the trigger. Tab to the button to see it open with the keyboard.',
                html: `<ge-tooltip content="Add to library">
  <ge-tooltip-trigger><ge-button variant="outline">Hover me</ge-button></ge-tooltip-trigger>
</ge-tooltip>`,
            },
            {
                title: 'Sides',
                html: `<ge-tooltip content="On top" side="top"><ge-tooltip-trigger><ge-button variant="outline">Top</ge-button></ge-tooltip-trigger></ge-tooltip>
<ge-tooltip content="On the right" side="right"><ge-tooltip-trigger><ge-button variant="outline">Right</ge-button></ge-tooltip-trigger></ge-tooltip>
<ge-tooltip content="Underneath" side="bottom"><ge-tooltip-trigger><ge-button variant="outline">Bottom</ge-button></ge-tooltip-trigger></ge-tooltip>
<ge-tooltip content="On the left" side="left"><ge-tooltip-trigger><ge-button variant="outline">Left</ge-button></ge-tooltip-trigger></ge-tooltip>`,
            },
            {
                title: 'Custom mode and a longer dwell',
                note: 'Slot a `ge-tooltip-content` for markup in the bubble; `delay-duration` is the hover dwell in milliseconds.',
                html: `<ge-tooltip delay-duration="600">
  <ge-tooltip-trigger><ge-button variant="outline">Slow to open</ge-button></ge-tooltip-trigger>
  <ge-tooltip-content><strong>Save</strong> <kbd>Ctrl</kbd> + <kbd>S</kbd></ge-tooltip-content>
</ge-tooltip>`,
            },
        ],
        api: [
            { name: 'content', type: 'string', default: "''", description: 'Simple mode text. A `ge-tooltip-content` is generated for you.' },
            { name: 'side', type: "'top' | 'right' | 'bottom' | 'left'", default: "'top'", description: 'Side of the trigger the bubble sits on, 8px away.' },
            { name: 'delay-duration', type: 'number', default: '200', description: 'Hover dwell in milliseconds. Focus and touch open it at once.' },
            { name: 'open', type: 'boolean', default: 'false', description: 'Whether the bubble is showing. `show()` and `hide()` also work.' },
        ],
    },
    {
        id: 'hover-card',
        group: 'Overlays',
        name: 'Hover card',
        tag: 'ge-hover-card',
        description: 'A preview card that opens when the pointer rests on a trigger or the trigger takes focus. Moving onto the card keeps it open. On a touch screen a tap opens it and a tap elsewhere closes it.',
        examples: [
            {
                title: 'Simple mode',
                note: '`heading` and `description` generate the card text.',
                html: `<ge-hover-card>
  <ge-hover-card-trigger><ge-button variant="link">@gilav21</ge-button></ge-hover-card-trigger>
  <ge-hover-card-content heading="@gilav21" description="Maintains shadcn-angular and the web components port."></ge-hover-card-content>
</ge-hover-card>`,
            },
            {
                title: 'Custom body',
                note: 'Slot anything; content you slot after a `heading` is shown below it.',
                html: `<ge-hover-card>
  <ge-hover-card-trigger><ge-button variant="link">Release notes</ge-button></ge-hover-card-trigger>
  <ge-hover-card-content>
    <div style="display:grid;gap:0.5rem">
      <div style="display:flex;align-items:center;gap:0.5rem"><ge-badge>v2.0</ge-badge><strong style="font-size:0.875rem">Major update</strong></div>
      <p style="margin:0;font-size:0.875rem;color:var(--muted-foreground)">New components, faster builds and a refreshed theme.</p>
    </div>
  </ge-hover-card-content>
</ge-hover-card>`,
            },
            {
                title: 'Side and alignment',
                note: 'It flips to the other side and nudges sideways when it would leave its clipping box.',
                html: `<ge-hover-card>
  <ge-hover-card-trigger><ge-button variant="outline">Above, start</ge-button></ge-hover-card-trigger>
  <ge-hover-card-content side="top" align="start" heading="Above" description="Aligned to the trigger's start edge."></ge-hover-card-content>
</ge-hover-card>
<ge-hover-card>
  <ge-hover-card-trigger><ge-button variant="outline">Below, end</ge-button></ge-hover-card-trigger>
  <ge-hover-card-content align="end" heading="Below" description="Aligned to the trigger's end edge."></ge-hover-card-content>
</ge-hover-card>`,
            },
        ],
        api: [
            { name: 'open', type: 'boolean', default: 'false', description: 'Whether the card is showing. Hover, focus and touch drive it; `toggle()` opens or closes at once.' },
            { name: 'content: side', type: "'top' | 'bottom'", default: "'bottom'", description: 'Preferred side. Flips to the other when there is no room.' },
            { name: 'content: align', type: "'start' | 'center' | 'end'", default: "'center'", description: 'Alignment against the trigger. Start and end follow text direction.' },
            { name: 'content: heading / description', type: 'string', default: "''", description: 'Simple mode text. `heading` rather than `title`, which would show a browser tooltip.' },
            { name: '--density-popover', type: 'css', default: '--density', description: 'Spacing multiplier for the card padding.' },
        ],
    },
    {
        id: 'dropdown-menu',
        group: 'Overlays',
        name: 'Dropdown menu',
        tag: 'ge-dropdown-menu',
        description: 'A menu of actions opened from a button. Up and Down move through the items, Right (Left in right-to-left text) opens a submenu, Escape closes the innermost menu and a click outside closes it. Build it from parts, or hand it `items` data.',
        examples: [
            {
                title: 'Simple mode (data-driven)',
                note: 'Set `items` and the menu builds its own content, nested submenus included. Each row can carry a `click` callback.',
                html: `<ge-dropdown-menu id="dm-data">
  <ge-dropdown-menu-trigger><ge-button variant="outline">Open menu (data)</ge-button></ge-dropdown-menu-trigger>
</ge-dropdown-menu>
<script>
document.getElementById('dm-data').items = [
  { label: 'My Account', type: 'label' },
  { type: 'separator' },
  { label: 'Profile', shortcut: '⇧⌘P' },
  { label: 'Billing', shortcut: '⌘B' },
  { label: 'Settings', shortcut: '⌘S' },
  { label: 'Keyboard shortcuts', shortcut: '⌘K' },
  { type: 'separator' },
  { label: 'Team', type: 'label' },
  { label: 'Invite users', type: 'sub', children: [
    { label: 'Email', shortcut: '⌘E' },
    { label: 'Message', shortcut: '⌘M' },
    { type: 'separator' },
    { label: 'More', type: 'sub', children: [{ label: 'Discord' }, { label: 'Slack' }] },
  ] },
  { type: 'separator' },
  { label: 'GitHub' },
  { label: 'Support' },
  { label: 'API' },
  { type: 'separator' },
  { label: 'Log out', shortcut: '⇧⌘Q' },
];
</script>`,
            },
            {
                title: 'Complex mode (template-driven)',
                note: 'Compose the parts yourself for full control. A key press on an item is a real click, so one `click` listener serves pointer and keyboard.',
                html: `<ge-dropdown-menu>
  <ge-dropdown-menu-trigger><ge-button variant="outline">Open menu (template)</ge-button></ge-dropdown-menu-trigger>
  <ge-dropdown-menu-content style="width:14rem">
    <ge-dropdown-menu-label>My Account</ge-dropdown-menu-label>
    <ge-dropdown-menu-separator></ge-dropdown-menu-separator>
    <ge-dropdown-menu-item shortcut="⇧⌘P">Profile</ge-dropdown-menu-item>
    <ge-dropdown-menu-item shortcut="⌘B">Billing</ge-dropdown-menu-item>
    <ge-dropdown-menu-item shortcut="⌘S">Settings</ge-dropdown-menu-item>
    <ge-dropdown-menu-item shortcut="⌘K">Keyboard shortcuts</ge-dropdown-menu-item>
    <ge-dropdown-menu-separator></ge-dropdown-menu-separator>
    <ge-dropdown-menu-item>Team</ge-dropdown-menu-item>
    <ge-dropdown-menu-sub>
      <ge-dropdown-menu-sub-trigger>Invite users</ge-dropdown-menu-sub-trigger>
      <ge-dropdown-menu-sub-content>
        <ge-dropdown-menu-item>Email</ge-dropdown-menu-item>
        <ge-dropdown-menu-item>Message</ge-dropdown-menu-item>
        <ge-dropdown-menu-separator></ge-dropdown-menu-separator>
        <ge-dropdown-menu-item>More...</ge-dropdown-menu-item>
      </ge-dropdown-menu-sub-content>
    </ge-dropdown-menu-sub>
    <ge-dropdown-menu-item shortcut="⌘+T">New Team</ge-dropdown-menu-item>
    <ge-dropdown-menu-separator></ge-dropdown-menu-separator>
    <ge-dropdown-menu-item>GitHub</ge-dropdown-menu-item>
    <ge-dropdown-menu-item>Support</ge-dropdown-menu-item>
    <ge-dropdown-menu-item disabled>API</ge-dropdown-menu-item>
    <ge-dropdown-menu-separator></ge-dropdown-menu-separator>
    <ge-dropdown-menu-item shortcut="⇧⌘Q">Log out</ge-dropdown-menu-item>
  </ge-dropdown-menu-content>
</ge-dropdown-menu>`,
            },
            {
                title: 'Disabled submenu branch',
                note: 'The dimmed branch refuses to open: hover, click and Enter or the forward arrow all do nothing.',
                html: `<ge-dropdown-menu>
  <ge-dropdown-menu-trigger><ge-button variant="outline">Open menu (disabled branch)</ge-button></ge-dropdown-menu-trigger>
  <ge-dropdown-menu-content style="width:14rem">
    <ge-dropdown-menu-label>Team</ge-dropdown-menu-label>
    <ge-dropdown-menu-separator></ge-dropdown-menu-separator>
    <ge-dropdown-menu-item>Settings</ge-dropdown-menu-item>
    <ge-dropdown-menu-sub>
      <ge-dropdown-menu-sub-trigger disabled>Invite users</ge-dropdown-menu-sub-trigger>
      <ge-dropdown-menu-sub-content>
        <ge-dropdown-menu-item>Email</ge-dropdown-menu-item>
        <ge-dropdown-menu-item>Message</ge-dropdown-menu-item>
      </ge-dropdown-menu-sub-content>
    </ge-dropdown-menu-sub>
    <ge-dropdown-menu-item>New Team</ge-dropdown-menu-item>
  </ge-dropdown-menu-content>
</ge-dropdown-menu>`,
            },
        ],
        api: [
            { name: 'open', type: 'boolean', default: 'false', description: 'Whether the menu is showing. `open-change` fires for changes the user makes, not for ones you set.' },
            { name: 'items', type: 'DropdownItem[]', default: '[]', description: 'Builds the content from descriptors: `label`, `shortcut`, `disabled`, `inset`, `type` (`item`, `separator`, `label`, `sub`), `children` and a `click` callback. Use it or projected content, not both.' },
            { name: 'content: align', type: "'start' | 'center' | 'end'", default: "'start'", description: 'Which edge lines up with the trigger. Start and end follow text direction. There is no collision handling.' },
            { name: 'item: disabled', type: 'boolean', default: 'false', description: 'Dims the row, blocks every activation and removes it from the arrow-key ring.' },
            { name: 'item: inset', type: 'boolean', default: 'false', description: 'Indents the label to line up with rows that carry an icon.' },
            { name: 'item: shortcut', type: 'string', default: "''", description: 'Right-aligned hint such as `⌘K`. Decorative: it binds no key.' },
            { name: 'sub-trigger: disabled / inset', type: 'boolean', default: 'false', description: 'As for an item; a disabled branch never opens.' },
            { name: '--density-menu', type: 'css', default: '--density', description: 'Spacing multiplier for the item padding.' },
        ],
    },
    {
        id: 'context-menu',
        group: 'Overlays',
        name: 'Context menu',
        tag: 'ge-context-menu',
        description: 'A menu that opens at the pointer on right-click, or on a long press on a touch screen. It sits in the top layer, stays 8px inside the viewport, and closes on a click outside, a scroll, Tab or Escape. Up, Down, Home and End move through the items.',
        examples: [
            {
                title: 'Basic',
                note: 'Wrap the area that answers a right-click in `ge-context-menu-trigger`. A `ge-context-menu-shortcut` puts hint text at the far end of a row.',
                html: `<ge-context-menu>
  <ge-context-menu-trigger>
    <div style="display:flex;height:150px;width:300px;align-items:center;justify-content:center;border:1px dashed var(--border);border-radius:calc(var(--radius) - 2px);font-size:0.875rem">Right click here</div>
  </ge-context-menu-trigger>
  <ge-context-menu-content>
    <ge-context-menu-item>Back<ge-context-menu-shortcut>⌘[</ge-context-menu-shortcut></ge-context-menu-item>
    <ge-context-menu-item>Forward<ge-context-menu-shortcut>⌘]</ge-context-menu-shortcut></ge-context-menu-item>
    <ge-context-menu-item>Reload<ge-context-menu-shortcut>⌘R</ge-context-menu-shortcut></ge-context-menu-item>
    <ge-context-menu-separator></ge-context-menu-separator>
    <ge-context-menu-item>Save as...<ge-context-menu-shortcut>⇧⌘S</ge-context-menu-shortcut></ge-context-menu-item>
    <ge-context-menu-item>Print</ge-context-menu-item>
  </ge-context-menu-content>
</ge-context-menu>`,
            },
            {
                title: 'Attach a menu to any element',
                note: '`variant="destructive"` paints a row in the destructive colour. Put the menu anywhere and name it with `for` on a `ge-context-menu-trigger` that wraps the area; several areas can share one menu.',
                html: `<ge-context-menu id="cm-shared">
  <ge-context-menu-content style="width:14rem">
    <ge-context-menu-item>Edit<ge-context-menu-shortcut>⌘E</ge-context-menu-shortcut></ge-context-menu-item>
    <ge-context-menu-item>Copy<ge-context-menu-shortcut>⌘C</ge-context-menu-shortcut></ge-context-menu-item>
    <ge-context-menu-item>Share</ge-context-menu-item>
    <ge-context-menu-separator></ge-context-menu-separator>
    <ge-context-menu-item variant="destructive">Delete<ge-context-menu-shortcut>⌘⌫</ge-context-menu-shortcut></ge-context-menu-item>
  </ge-context-menu-content>
</ge-context-menu>
<ge-context-menu-trigger for="cm-shared">
  <div style="display:flex;height:150px;width:100%;max-width:400px;align-items:center;justify-content:center;border:2px dashed var(--border);border-radius:var(--radius);background:var(--muted);color:var(--muted-foreground);font-size:0.875rem">Right click this area</div>
</ge-context-menu-trigger>`,
            },
            {
                title: 'Manual opening',
                note: 'Without a trigger, call `show(x, y)` from your own listener, for example to open the menu from a button.',
                html: `<ge-context-menu id="cm-manual">
  <ge-context-menu-content style="width:14rem">
    <ge-context-menu-item>Edit</ge-context-menu-item>
    <ge-context-menu-item>Copy</ge-context-menu-item>
  </ge-context-menu-content>
</ge-context-menu>
<div id="cm-area" style="display:flex;height:100px;width:100%;max-width:400px;align-items:center;justify-content:center;border:1px dashed var(--border);border-radius:var(--radius);font-size:0.875rem">Right click (your own listener)</div>
<script>
document.getElementById('cm-area').addEventListener('contextmenu', (e) => {
  e.preventDefault();
  document.getElementById('cm-manual').show(e.clientX, e.clientY);
});
</script>`,
            },
            {
                title: 'Disabled submenu branch',
                note: 'The dimmed branch refuses to open: hover and Enter or the forward arrow do nothing.',
                html: `<ge-context-menu>
  <ge-context-menu-trigger>
    <div style="display:flex;height:150px;width:100%;max-width:300px;align-items:center;justify-content:center;border:1px dashed var(--border);border-radius:calc(var(--radius) - 2px);padding:1rem;text-align:center;font-size:0.875rem">Right click for a menu with a disabled branch</div>
  </ge-context-menu-trigger>
  <ge-context-menu-content style="width:14rem">
    <ge-context-menu-item>Edit<ge-context-menu-shortcut>⌘E</ge-context-menu-shortcut></ge-context-menu-item>
    <ge-context-menu-item>Copy<ge-context-menu-shortcut>⌘C</ge-context-menu-shortcut></ge-context-menu-item>
    <ge-context-menu-sub>
      <ge-context-menu-sub-trigger disabled>Send to</ge-context-menu-sub-trigger>
      <ge-context-menu-sub-content>
        <ge-context-menu-item>Phone</ge-context-menu-item>
        <ge-context-menu-item>Tablet</ge-context-menu-item>
      </ge-context-menu-sub-content>
    </ge-context-menu-sub>
    <ge-context-menu-separator></ge-context-menu-separator>
    <ge-context-menu-item variant="destructive">Delete</ge-context-menu-item>
  </ge-context-menu-content>
</ge-context-menu>`,
            },
            {
                title: 'Data-driven',
                note: 'Set `items` and the menu builds its own content, submenus included. Open it with `show(x, y)`.',
                html: `<ge-context-menu id="cm-data">
  <ge-context-menu-trigger>
    <div style="display:flex;height:100px;width:300px;align-items:center;justify-content:center;border:1px dashed var(--border);border-radius:calc(var(--radius) - 2px);font-size:0.875rem">Right click (data-driven)</div>
  </ge-context-menu-trigger>
</ge-context-menu>
<script>
document.getElementById('cm-data').items = [
  { label: 'Actions', type: 'label' },
  { label: 'Copy', shortcut: '⌘C' },
  { label: 'Paste', shortcut: '⌘V', disabled: true },
  { type: 'separator' },
  { label: 'Share', type: 'sub', children: [{ label: 'Email' }, { label: 'Message' }] },
];
</script>`,
            },
        ],
        api: [
            { name: 'open', type: 'boolean', default: 'false', description: 'Whether the menu is showing. Read it; open the menu with `show(x, y)`.' },
            { name: 'show(x, y, data?)', type: 'method', default: '-', description: 'Opens with its top-left corner at viewport coordinates, shifted to stay 8px inside the viewport. `data` is kept on the element for your handlers.' },
            { name: 'close()', type: 'method', default: '-', description: 'Closes the menu and any open submenu.' },
            { name: 'trigger: for', type: 'string', default: "''", description: 'The id of the `ge-context-menu` to open, for a menu that is not around the trigger. Without it the trigger opens the menu it sits in.' },
            { name: 'items', type: 'ContextMenuItem[]', default: '[]', description: 'Builds the content from descriptors: `label`, `shortcut`, `disabled`, `inset`, `type`, `children` and a `click` callback.' },
            { name: 'item: variant', type: "'default' | 'destructive'", default: "'default'", description: 'Destructive paints the row in the destructive colour.' },
            { name: 'item / sub-trigger / label: inset', type: 'boolean', default: 'false', description: 'Indents the text to line up with rows that carry an icon.' },
        ],
    },
    {
        id: 'menubar',
        group: 'Navigation',
        name: 'Menubar',
        tag: 'ge-menubar',
        description: 'A bar of menus like a desktop app. One menu is open at a time; once one is open, hovering another trigger or pressing Left or Right switches to it. Down or Enter opens a menu into its first item, Up and Down walk the items, and Escape closes and returns to the trigger.',
        examples: [
            {
                title: 'Basic',
                note: 'Each `ge-menubar-menu` holds a trigger and its content. Rows take `shortcut`, `inset` and `disabled`, or a `ge-menubar-shortcut` child; submenus nest as many levels as you need.',
                html: `<ge-menubar>
  <ge-menubar-menu>
    <ge-menubar-trigger>File</ge-menubar-trigger>
    <ge-menubar-content>
      <ge-menubar-item>New tab<ge-menubar-shortcut>⌘T</ge-menubar-shortcut></ge-menubar-item>
      <ge-menubar-item>New window<ge-menubar-shortcut>⌘N</ge-menubar-shortcut></ge-menubar-item>
      <ge-menubar-item disabled>New incognito window</ge-menubar-item>
      <ge-menubar-separator></ge-menubar-separator>
      <ge-menubar-sub>
        <ge-menubar-sub-trigger>Share</ge-menubar-sub-trigger>
        <ge-menubar-sub-content>
          <ge-menubar-sub>
            <ge-menubar-sub-trigger>Email link</ge-menubar-sub-trigger>
            <ge-menubar-sub-content>
              <ge-menubar-item>Personal</ge-menubar-item>
              <ge-menubar-item>Work</ge-menubar-item>
            </ge-menubar-sub-content>
          </ge-menubar-sub>
          <ge-menubar-item>Messages</ge-menubar-item>
          <ge-menubar-item>Notes</ge-menubar-item>
        </ge-menubar-sub-content>
      </ge-menubar-sub>
      <ge-menubar-separator></ge-menubar-separator>
      <ge-menubar-item>Print<ge-menubar-shortcut>⌘P</ge-menubar-shortcut></ge-menubar-item>
    </ge-menubar-content>
  </ge-menubar-menu>
  <ge-menubar-menu>
    <ge-menubar-trigger>Edit</ge-menubar-trigger>
    <ge-menubar-content>
      <ge-menubar-item>Undo<ge-menubar-shortcut>⌘Z</ge-menubar-shortcut></ge-menubar-item>
      <ge-menubar-item>Redo<ge-menubar-shortcut>⇧⌘Z</ge-menubar-shortcut></ge-menubar-item>
      <ge-menubar-separator></ge-menubar-separator>
      <ge-menubar-item>Cut<ge-menubar-shortcut>⌘X</ge-menubar-shortcut></ge-menubar-item>
      <ge-menubar-item>Copy<ge-menubar-shortcut>⌘C</ge-menubar-shortcut></ge-menubar-item>
      <ge-menubar-item>Paste<ge-menubar-shortcut>⌘V</ge-menubar-shortcut></ge-menubar-item>
      <ge-menubar-separator></ge-menubar-separator>
      <ge-menubar-item>Select all<ge-menubar-shortcut>⌘A</ge-menubar-shortcut></ge-menubar-item>
    </ge-menubar-content>
  </ge-menubar-menu>
  <ge-menubar-menu>
    <ge-menubar-trigger>View</ge-menubar-trigger>
    <ge-menubar-content>
      <ge-menubar-item inset shortcut="⌘R">Reload</ge-menubar-item>
      <ge-menubar-item inset disabled shortcut="⇧⌘R">Force reload</ge-menubar-item>
      <ge-menubar-separator></ge-menubar-separator>
      <ge-menubar-item inset>Toggle fullscreen</ge-menubar-item>
      <ge-menubar-separator></ge-menubar-separator>
      <ge-menubar-item inset>Hide sidebar</ge-menubar-item>
    </ge-menubar-content>
  </ge-menubar-menu>
</ge-menubar>`,
            },
            {
                title: 'Disabled branch and disabled first item',
                note: 'A dimmed submenu branch never opens, and a disabled first row is skipped: Down from the trigger lands on the first enabled row, and the arrow keys wrap around.',
                html: `<ge-menubar>
  <ge-menubar-menu>
    <ge-menubar-trigger>Export</ge-menubar-trigger>
    <ge-menubar-content>
      <ge-menubar-item>PDF</ge-menubar-item>
      <ge-menubar-item>Image</ge-menubar-item>
      <ge-menubar-separator></ge-menubar-separator>
      <ge-menubar-sub>
        <ge-menubar-sub-trigger disabled>Cloud</ge-menubar-sub-trigger>
        <ge-menubar-sub-content>
          <ge-menubar-item>Drive</ge-menubar-item>
          <ge-menubar-item>Dropbox</ge-menubar-item>
        </ge-menubar-sub-content>
      </ge-menubar-sub>
    </ge-menubar-content>
  </ge-menubar-menu>
  <ge-menubar-menu>
    <ge-menubar-trigger>History</ge-menubar-trigger>
    <ge-menubar-content>
      <ge-menubar-item disabled>Restore session</ge-menubar-item>
      <ge-menubar-item>Recently closed</ge-menubar-item>
      <ge-menubar-separator></ge-menubar-separator>
      <ge-menubar-item>Clear history</ge-menubar-item>
    </ge-menubar-content>
  </ge-menubar-menu>
</ge-menubar>`,
            },
        ],
        api: [
            { name: 'menu: open', type: 'boolean', default: 'false', description: 'Read-only: whether this menu is the open one. Open it with `show()`, close with `hide()`, or `toggle()`.' },
            { name: 'item: disabled', type: 'boolean', default: 'false', description: 'Dims the row, blocks every activation and removes it from the arrow-key ring.' },
            { name: 'item: inset', type: 'boolean', default: 'false', description: 'Indents the label to line up with rows that carry an icon.' },
            { name: 'item: shortcut', type: 'string', default: "''", description: 'Right-aligned hint such as `⌘K`. Decorative: it binds no key.' },
            { name: 'sub-trigger: disabled / inset', type: 'boolean', default: 'false', description: 'As for an item; a disabled branch never opens.' },
            { name: '--density-menu', type: 'css', default: '--density', description: 'Spacing multiplier for the bar, triggers and rows.' },
        ],
    },
    {
        id: 'select',
        group: 'Form inputs',
        name: 'Select',
        tag: 'ge-select',
        description: 'Picks one value from a list. It takes part in forms, opens from the keyboard (Enter, Space, Down), and walks the rows with the arrow keys. The panel either sits over the trigger so the chosen row lines up with it, or drops beside it.',
        examples: [
            {
                title: 'Item-aligned (default)',
                note: 'The panel opens so the selected row sits on the trigger, and falls back to `popper` when that would run off the screen.',
                html: `<ge-select style="width:200px" position="item-aligned">
  <ge-select-trigger>
    <ge-select-value placeholder="Select a fruit"></ge-select-value>
  </ge-select-trigger>
  <ge-select-content>
    <ge-select-group>
      <ge-select-label>Fruits</ge-select-label>
      <ge-select-item value="apple">Apple</ge-select-item>
      <ge-select-item value="banana">Banana</ge-select-item>
      <ge-select-item value="blueberry">Blueberry</ge-select-item>
      <ge-select-item value="grapes">Grapes</ge-select-item>
      <ge-select-item value="pineapple">Pineapple</ge-select-item>
    </ge-select-group>
  </ge-select-content>
</ge-select>`,
            },
            {
                title: 'Simple mode (data-driven)',
                note: 'Set `options` and the select builds its own trigger and rows. For objects, set `value-attribute` and `displayWith`; `disabledWith` marks rows that cannot be picked.',
                html: `<ge-select id="sel-data" style="width:200px" placeholder="Select a fruit"></ge-select>
<script>
document.getElementById('sel-data').options = ['Apple', 'Banana', 'Blueberry', 'Grapes', 'Pineapple'];
</script>`,
            },
            {
                title: 'Popper',
                note: 'The panel drops beside the trigger, on the side with more room.',
                html: `<ge-select style="width:200px" position="popper">
  <ge-select-trigger>
    <ge-select-value placeholder="Select a fruit"></ge-select-value>
  </ge-select-trigger>
  <ge-select-content>
    <ge-select-group>
      <ge-select-label>Fruits</ge-select-label>
      <ge-select-item value="apple">Apple</ge-select-item>
      <ge-select-item value="banana">Banana</ge-select-item>
      <ge-select-item value="blueberry">Blueberry</ge-select-item>
      <ge-select-item value="grapes">Grapes</ge-select-item>
      <ge-select-item value="pineapple">Pineapple</ge-select-item>
    </ge-select-group>
  </ge-select-content>
</ge-select>`,
            },
            {
                title: 'Disabled item',
                note: 'A disabled row is dimmed, cannot be picked and is skipped by the arrow keys.',
                html: `<ge-select style="width:200px">
  <ge-select-trigger>
    <ge-select-value placeholder="Select a fruit"></ge-select-value>
  </ge-select-trigger>
  <ge-select-content>
    <ge-select-group>
      <ge-select-label>Fruits</ge-select-label>
      <ge-select-item value="apple">Apple</ge-select-item>
      <ge-select-item value="banana" disabled>Banana</ge-select-item>
      <ge-select-item value="blueberry">Blueberry</ge-select-item>
      <ge-select-item value="grapes">Grapes</ge-select-item>
      <ge-select-item value="pineapple">Pineapple</ge-select-item>
    </ge-select-group>
  </ge-select-content>
</ge-select>`,
            },
            {
                title: 'In a form',
                note: 'With a `name` the value is submitted as a string; `default-value` is what a reset returns to. `loading` swaps the chevron for a spinner and disables the trigger, and `skeleton` draws a placeholder instead.',
                html: `<form id="sel-form" style="display:flex;flex-wrap:wrap;gap:1rem;align-items:center">
  <ge-select name="fruit" default-value="grapes" style="width:200px">
    <ge-select-trigger><ge-select-value></ge-select-value></ge-select-trigger>
    <ge-select-content>
      <ge-select-item value="apple">Apple</ge-select-item>
      <ge-select-item value="grapes">Grapes</ge-select-item>
    </ge-select-content>
  </ge-select>
  <ge-button type="reset" variant="outline">Reset</ge-button>
  <ge-select style="width:200px">
    <ge-select-trigger loading><ge-select-value></ge-select-value></ge-select-trigger>
  </ge-select>
  <ge-select style="width:200px">
    <ge-select-trigger skeleton></ge-select-trigger>
  </ge-select>
</form>`,
            },
        ],
        api: [
            { name: 'value', type: 'unknown', default: 'undefined', description: 'The selected value. Setting it does not fire events; only a user pick does.' },
            { name: 'default-value', type: 'string', default: 'undefined', description: 'Used while no value is set.' },
            { name: 'name', type: 'string', default: "''", description: 'Field name for forms; the value is submitted as a string.' },
            { name: 'placeholder', type: 'string', default: "'Select...'", description: 'Shown while nothing is selected.' },
            { name: 'position', type: "'item-aligned' | 'popper'", default: "'item-aligned'", description: 'Where the panel opens.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Blocks opening and picking.' },
            { name: 'options / displayWith / value-attribute / disabledWith', type: 'property', default: '-', description: 'Data-driven mode; the select builds its own trigger and rows.' },
            { name: 'value-change', type: 'event', default: '-', description: 'A user picked a different value; `detail` is the value itself. `input` and `change` fire too.' },
            { name: 'trigger: loading / skeleton', type: 'boolean', default: 'false', description: 'A spinner in place of the chevron (disables the trigger) / a loading placeholder instead of the trigger.' },
            { name: '--density-select', type: 'css', default: '--density', description: 'Spacing multiplier for the trigger and rows.' },
        ],
    },
    {
        id: 'navigation-menu',
        group: 'Navigation',
        name: 'Navigation menu',
        tag: 'ge-navigation-menu',
        description: 'A row of links where some open a dropdown. Hover opens an item and leaving closes it after a short grace period; a click or tap toggles it, which is how touch opens it. Following a link does not close the panel. From the keyboard, Tab goes through the entries and into an open panel; Left and Right (and Home and End) move along the bar, Down opens a panel onto its first link, the arrows walk its links and Escape closes it back onto the trigger.',
        examples: [
            {
                title: 'Basic',
                note: 'A trigger and its content, or a lone link. Give the content a width with `style` on `ge-navigation-menu-content`; the host of a link takes part in grid layouts, so `grid-column` works on it, and `::part(base)` styles the row itself.',
                html: `<style>
  .nm-title { font-size: 0.875rem; font-weight: 500; line-height: 1; }
  .nm-desc { margin: 0; font-size: 0.875rem; line-height: 1.375; color: var(--muted-foreground); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
  .nm-grid { display: grid; gap: 0.75rem; padding: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .nm-docs::part(base) { display: inline-flex; align-items: center; justify-content: center; width: max-content; height: 2.5rem; padding: 0.5rem 1rem; background: var(--background); font-size: 0.875rem; font-weight: 500; line-height: 1.25rem; }
  .nm-docs::part(base):hover, .nm-docs::part(base):focus { background: var(--accent); color: var(--accent-foreground); }
</style>
<ge-navigation-menu>
  <ge-navigation-menu-list>
    <ge-navigation-menu-item>
      <ge-navigation-menu-trigger>Getting started</ge-navigation-menu-trigger>
      <ge-navigation-menu-content style="width: min(400px, calc(100vw - 2rem))">
        <div class="nm-grid">
          <ge-navigation-menu-link href="#" style="grid-column: span 2">
            <div class="nm-title">Introduction</div>
            <p class="nm-desc">Re-usable components built with Tailwind CSS.</p>
          </ge-navigation-menu-link>
          <ge-navigation-menu-link href="#">
            <div class="nm-title">Installation</div>
            <p class="nm-desc">How to install dependencies and structure your app.</p>
          </ge-navigation-menu-link>
          <ge-navigation-menu-link href="#">
            <div class="nm-title">Typography</div>
            <p class="nm-desc">Styles for headings, paragraphs, lists and more.</p>
          </ge-navigation-menu-link>
        </div>
      </ge-navigation-menu-content>
    </ge-navigation-menu-item>
    <ge-navigation-menu-item>
      <ge-navigation-menu-trigger>Components</ge-navigation-menu-trigger>
      <ge-navigation-menu-content style="width: min(500px, calc(100vw - 2rem))">
        <div class="nm-grid">
          <ge-navigation-menu-link href="#">
            <div class="nm-title">Alert dialog</div>
            <p class="nm-desc">A modal dialog that interrupts the user with important content.</p>
          </ge-navigation-menu-link>
          <ge-navigation-menu-link href="#">
            <div class="nm-title">Hover card</div>
            <p class="nm-desc">For sighted users to preview content behind a link.</p>
          </ge-navigation-menu-link>
          <ge-navigation-menu-link href="#">
            <div class="nm-title">Progress</div>
            <p class="nm-desc">Displays an indicator showing the completion progress of a task.</p>
          </ge-navigation-menu-link>
          <ge-navigation-menu-link href="#">
            <div class="nm-title">Tooltip</div>
            <p class="nm-desc">A popup that displays information related to an element.</p>
          </ge-navigation-menu-link>
        </div>
      </ge-navigation-menu-content>
    </ge-navigation-menu-item>
    <ge-navigation-menu-item>
      <ge-navigation-menu-link class="nm-docs" href="#">Documentation</ge-navigation-menu-link>
    </ge-navigation-menu-item>
  </ge-navigation-menu-list>
</ge-navigation-menu>`,
            },
            {
                title: 'Simple mode (data-driven)',
                note: 'Set `items`: an entry with `children` becomes a trigger with a two-column dropdown of titled links, an entry without becomes a plain link.',
                html: `<ge-navigation-menu id="nm-data"></ge-navigation-menu>
<script>
document.getElementById('nm-data').items = [
  { label: 'Home', href: '#' },
  { label: 'Guides', children: [
    { title: 'Introduction', description: 'Re-usable components built with Tailwind CSS.', href: '#' },
    { title: 'Installation', description: 'How to install dependencies and structure your app.', href: '#' },
  ] },
  { label: 'Docs', href: '#' },
];
</script>`,
            },
        ],
        api: [
            { name: 'items', type: 'NavigationMenuEntry[]', default: '[]', description: 'Builds the list for you: `{ label, href?, children?: { title, description?, href }[] }`. A projected `ge-navigation-menu-list` wins.' },
            { name: 'link: href', type: 'string', default: "'#'", description: 'Where the link goes. A plain anchor: no router integration, and it does not close the dropdown.' },
            { name: 'link: active', type: 'boolean', default: 'false', description: 'Tints the row as the current one. Visual only; it sets no `aria-current`.' },
            { name: '--density-menu', type: 'css', default: '--density', description: 'Spacing multiplier for triggers, links and panels.' },
        ],
    },
    {
        id: 'command',
        group: 'Navigation',
        name: 'Command',
        tag: 'ge-command',
        description: 'A searchable palette: type to filter the rows, arrow keys move the highlight, Enter selects. Groups and separators are plain children, and `ge-command-dialog` wraps one in a dialog opened with Mod+K. Rows fire `select-item`; set `source` for async results and `recent-key` to remember picks.',
        examples: [
            {
                title: 'Palette',
                note: 'A group hides itself when none of its rows match; the separator stays, as in the Angular version.',
                html: `<ge-command style="max-width: 28rem; border: 1px solid var(--border); box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)">
  <ge-command-input placeholder="Type a command"></ge-command-input>
  <ge-command-list>
    <ge-command-empty>No results.</ge-command-empty>
    <ge-command-group heading="Suggestions">
      <ge-command-item value="calendar">Calendar</ge-command-item>
      <ge-command-item value="search-emoji">Search emoji</ge-command-item>
      <ge-command-item value="launch" disabled>Launch</ge-command-item>
    </ge-command-group>
    <ge-command-separator></ge-command-separator>
    <ge-command-group heading="Settings">
      <ge-command-item value="profile">Profile <ge-command-shortcut>⌘P</ge-command-shortcut></ge-command-item>
      <ge-command-item value="mail">Mail <ge-command-shortcut>⌘B</ge-command-shortcut></ge-command-item>
      <ge-command-item value="settings">Settings <ge-command-shortcut>⌘S</ge-command-shortcut></ge-command-item>
    </ge-command-group>
  </ge-command-list>
</ge-command>`,
            },
            {
                title: 'Dialog',
                note: 'Press `/` or use the button (Ctrl+K opens the page search of this demo). `shortcut` takes comma-separated alternatives; add `no-shortcut` to turn the key off.',
                html: `<div style="display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start">
  <ge-button variant="outline" id="cmd-open" style="width: 15rem">Show command dialog</ge-button>
  <p style="margin: 0; font-size: 0.875rem; color: var(--muted-foreground)">Or press <ge-kbd>/</ge-kbd></p>
</div>
<ge-command-dialog id="cmd-dialog" shortcut="/">
  <ge-command>
    <ge-command-input placeholder="Type a command"></ge-command-input>
    <ge-command-list>
      <ge-command-empty>No results.</ge-command-empty>
      <ge-command-group heading="Suggestions">
        <ge-command-item value="calendar">Calendar</ge-command-item>
        <ge-command-item value="search-emoji">Search emoji</ge-command-item>
        <ge-command-item value="launch">Launch</ge-command-item>
      </ge-command-group>
      <ge-command-separator></ge-command-separator>
      <ge-command-group heading="Settings">
        <ge-command-item value="profile">Profile <ge-command-shortcut>⌘P</ge-command-shortcut></ge-command-item>
        <ge-command-item value="mail">Mail <ge-command-shortcut>⌘B</ge-command-shortcut></ge-command-item>
      </ge-command-group>
    </ge-command-list>
  </ge-command>
</ge-command-dialog>
<script>
document.getElementById('cmd-open').addEventListener('click', () => { document.getElementById('cmd-dialog').open = true; });
</script>`,
            },
        ],
        api: [
            { name: 'search', type: 'string', default: "''", description: 'The query. Typing in `ge-command-input` sets it.' },
            { name: 'no-filter', type: 'boolean', default: 'false', description: 'Skip the built-in filter, for results you already filtered.' },
            { name: 'source', type: 'CommandSource', default: 'undefined', description: 'Async results: `(query, signal) => Promise<CommandResult[]>`, debounced and aborted when the query changes.' },
            { name: 'debounce', type: 'number', default: '200', description: 'Milliseconds to wait before calling `source`.' },
            { name: 'recent-key', type: 'string', default: "''", description: 'Remember picked values in localStorage under this key and list them first.' },
            { name: 'recent-limit', type: 'number', default: '5', description: 'How many recents to keep.' },
            { name: 'item: value', type: 'string', default: "''", description: 'What the row matches against and reports in `select-item`.' },
            { name: 'item: disabled', type: 'boolean', default: 'false', description: 'Dimmed and cannot be selected; the arrow keys still reach it, as in the Angular version.' },
            { name: 'group: heading', type: 'string', default: "''", description: 'The group label.' },
            { name: 'dialog: shortcut', type: 'string', default: "'Mod+K'", description: 'The key that toggles the dialog; Mod is ⌘ on a Mac and Ctrl elsewhere. Separate alternatives with commas (`Mod+K, /`); a bare key like `/` is ignored while typing in a field.' },
            { name: 'dialog: no-shortcut', type: 'boolean', default: 'false', description: 'Turn the key off.' },
            { name: '--density-menu', type: 'css', default: '--density', description: 'Spacing multiplier for rows and group headings.' },
        ],
    },
    {
        id: 'banner',
        group: 'Display',
        name: 'Banner',
        tag: 'ge-banner',
        description: 'A persistent, page-level announcement bar for system status and account notices. Set `message` for plain text, or project your own content and it replaces the message.',
        examples: [
            {
                title: 'Variants',
                note: '`destructive` is announced assertively (`role="alert"`), the others politely (`role="status"`).',
                block: true,
                html: `<div style="display:flex;flex-direction:column;gap:0.5rem;overflow:hidden;border:1px solid var(--border);border-radius:var(--radius)">
  <ge-banner variant="info" message="A new version of the console is available."></ge-banner>
  <ge-banner variant="warning" message="Scheduled maintenance at 02:00 UTC."></ge-banner>
  <ge-banner variant="success" message="Your workspace was migrated successfully."></ge-banner>
  <ge-banner variant="destructive" message="Billing failed — update your card to avoid interruption."></ge-banner>
</div>`,
            },
            {
                title: 'Dismissible',
                note: '`dismissed` fires once; the banner then hides and stops being a live region.',
                block: true,
                html: `<div style="overflow:hidden;border:1px solid var(--border);border-radius:var(--radius)">
  <ge-banner id="bn-dismiss" variant="warning" message="You are impersonating another user." dismissible></ge-banner>
</div>
<p id="bn-count" style="margin:0.5rem 0 0;font-size:0.875rem;color:var(--muted-foreground)">0</p>
<script>
let bnCount = 0;
document.getElementById('bn-dismiss').addEventListener('dismissed', () => { document.getElementById('bn-count').textContent = String(++bnCount); });
</script>`,
            },
            {
                title: 'Custom content',
                note: 'Projected content replaces `message`, so it can hold a button or a link.',
                block: true,
                html: `<div style="overflow:hidden;border:1px solid var(--border);border-radius:var(--radius)">
  <ge-banner variant="info" dismissible>
    <span style="display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem">
      Trial ends in 3 days.
      <ge-button size="sm" label="Upgrade"></ge-button>
    </span>
  </ge-banner>
</div>`,
            },
        ],
        api: [
            { name: 'variant', type: "'info' | 'warning' | 'success' | 'destructive'", default: "'info'", description: 'Colour treatment and announcement urgency.' },
            { name: 'message', type: 'string', default: "''", description: 'Plain-text announcement; ignored when content is projected.' },
            { name: 'dismissible', type: 'boolean', default: 'false', description: 'Shows a close button that hides the banner.' },
            { name: 'close-label', type: 'string', default: "'Close'", description: 'Accessible name of the close button.' },
            { name: 'dismissed', type: 'event', default: '-', description: 'Fires once when the user closes the banner. `dismiss()` does the same from code.' },
        ],
    },
    {
        id: 'native-select',
        group: 'Form inputs',
        name: 'Native select',
        tag: 'ge-native-select',
        description: 'The platform\'s own `<select>`, styled like an input. The browser draws the list, so it behaves as it does on every device. Project `<option>` and `<optgroup>` children; they are mirrored into the control and kept in step as you change them.',
        examples: [
            {
                title: 'Sizes and states',
                note: '`value` picks the option; with none, the empty option (or the first) shows. `name` submits it with a form.',
                html: `<ge-native-select aria-label="Role">
  <option value="">Select a role</option>
  <option value="admin">Admin</option>
  <option value="editor">Editor</option>
  <option value="viewer">Viewer</option>
</ge-native-select>
<ge-native-select size="sm" aria-label="Quantity">
  <option value="">Small size</option>
  <option value="1">Option 1</option>
  <option value="2">Option 2</option>
</ge-native-select>
<ge-native-select disabled aria-label="Disabled">
  <option value="">Disabled</option>
</ge-native-select>
<ge-native-select invalid aria-label="Invalid">
  <option value="">Invalid</option>
</ge-native-select>`,
            },
            {
                title: 'Groups',
                note: 'Disabled options stay in the list but cannot be picked.',
                html: `<ge-native-select aria-label="Fruit" value="orange">
  <option value="">Select a fruit</option>
  <optgroup label="Citrus">
    <option value="orange">Orange</option>
    <option value="lemon" disabled>Lemon</option>
  </optgroup>
  <optgroup label="Berries">
    <option value="blueberry">Blueberry</option>
  </optgroup>
</ge-native-select>`,
            },
        ],
        api: [
            { name: 'name', type: 'string', default: "''", description: 'Field name; with it the value is submitted with the surrounding form.' },
            { name: 'value', type: 'string', default: "''", description: 'The picked option\'s value. A value no option has leaves the control blank.' },
            { name: 'size', type: "'default' | 'sm'", default: "'default'", description: 'Control height.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Blocks picking and dims the control.' },
            { name: 'invalid', type: 'boolean', default: 'false', description: 'Destructive border and `aria-invalid`.' },
            { name: 'aria-label', type: 'string', default: '-', description: 'Accessible name, forwarded to the inner select.' },
            { name: 'change', type: 'event', default: '-', description: 'Fires when the user picks an option; `input` fires too.' },
            { name: '--density-input', type: 'css', default: '--density', description: 'Spacing multiplier for height and padding.' },
        ],
    },
    {
        id: 'scroll-area',
        group: 'Layout',
        name: 'Scroll area',
        tag: 'ge-scroll-area',
        description: 'A clipped box whose content scrolls under thin custom scrollbars. The element is the root, so give it a height; each thumb shows only while its content overflows.',
        examples: [
            {
                title: 'Tags',
                note: 'Drag the thumb, use the wheel, or focus the box and use the arrow keys.',
                html: `<ge-scroll-area id="sa-tags" style="height: 18rem; width: 12rem; border: 1px solid var(--border); border-radius: calc(var(--radius) - 2px)">
  <div style="padding: 1rem"></div>
</ge-scroll-area>
<script>
const box = document.querySelector('#sa-tags > div');
box.innerHTML = '<h4 style="margin:0 0 1rem;font-size:0.875rem;font-weight:500;line-height:1">Tags</h4>' +
  Array.from({ length: 50 }, (_, i) => 'v1.2.0-beta.' + (50 - i)).map((tag) => '<div style="font-size:0.875rem">' + tag + '</div><ge-separator style="margin:0.5rem 0"></ge-separator>').join('');
</script>`,
            },
            {
                title: 'Both directions',
                note: '`orientation="both"` also styles the horizontal thumb and fills the corner between them.',
                html: `<ge-scroll-area orientation="both" style="height: 12rem; width: 18rem; border: 1px solid var(--border); border-radius: calc(var(--radius) - 2px)">
  <div style="width: 40rem; padding: 1rem; font-size: 0.875rem; line-height: 2rem">
    <div>Row 1 with a line that runs well past the right edge of the box</div><div>Row 2 with a line that runs well past the right edge of the box</div><div>Row 3 with a line that runs well past the right edge of the box</div><div>Row 4 with a line that runs well past the right edge of the box</div><div>Row 5 with a line that runs well past the right edge of the box</div><div>Row 6 with a line that runs well past the right edge of the box</div><div>Row 7 with a line that runs well past the right edge of the box</div>
  </div>
</ge-scroll-area>`,
            },
        ],
        api: [
            { name: 'orientation', type: "'vertical' | 'horizontal' | 'both'", default: "'vertical'", description: 'Which custom scrollbars may appear. The native ones are always hidden and the box scrolls both ways.' },
            { name: 'scrollToBottom()', type: 'method', default: '-', description: 'Jumps to the end after layout; safe right after appending content. Also refreshes the thumbs.' },
        ],
    },
    {
        id: 'stat-card',
        group: 'Display',
        name: 'Stat card',
        tag: 'ge-stat-card',
        description: 'A KPI tile: a label, a headline value, an optional delta badge and an optional projected sparkline. The host draws nothing, so the card inside is the real grid item; style it through `::part(card)`.',
        examples: [
            {
                title: 'Trends',
                note: '`up` and `down` mean favourable and unfavourable, not the sign of the number: a falling churn rate is `up`. Values and deltas are shown as given, so format them first.',
                html: `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));gap:1rem;width:100%">
  <ge-stat-card label="Total revenue" value="$45,231.89" delta="+20.1%" trend="up"></ge-stat-card>
  <ge-stat-card label="Churn rate" value="2.4%" delta="-0.6%" trend="up"></ge-stat-card>
  <ge-stat-card label="Refunds" value="$1,204.00" delta="+18%" trend="down"></ge-stat-card>
  <ge-stat-card label="Active sessions" value="573" delta="+0.4%"></ge-stat-card>
</div>`,
                block: true,
            },
            {
                title: 'Without the arrow, without a delta, with a sparkline',
                note: '`hide-trend-icon` keeps the colour but drops the glyph. With no delta and nothing slotted, the card shows only the header. Slotted content lands under the delta.',
                html: `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));gap:1rem;width:100%">
  <ge-stat-card label="Signups" value="1,240" delta="+12%" trend="up" hide-trend-icon></ge-stat-card>
  <ge-stat-card label="Open tickets" value="38"></ge-stat-card>
  <ge-stat-card label="Active users" value="2,350" delta="+5.2%" trend="up">
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" style="display:block;width:100%;height:2.5rem;margin-top:0.5rem" aria-hidden="true"><polyline fill="none" stroke="var(--primary)" stroke-width="2" points="0,20 12,16 25,18 37,10 50,12 62,6 75,9 88,3 100,5"/></svg>
  </ge-stat-card>
</div>`,
                block: true,
            },
        ],
        api: [
            { name: 'label', type: 'string', default: "''", description: 'Metric name, muted above the value. Truncates instead of wrapping.' },
            { name: 'value', type: 'string', default: "''", description: 'The headline figure, shown as given. Truncates instead of wrapping.' },
            { name: 'delta', type: 'string', default: "''", description: 'Change since the previous period, e.g. `+20.1%`. Empty means no badge.' },
            { name: 'trend', type: "'up' | 'down' | 'neutral'", default: "'neutral'", description: 'Direction of the change: badge colour and arrow.' },
            { name: 'hide-trend-icon', type: 'boolean', default: 'false', description: 'Keep the trend colour without the arrow.' },
            { name: 'card', type: 'part', default: '-', description: 'The card surface.' },
        ],
    },
    {
        id: 'result',
        group: 'Display',
        name: 'Result',
        tag: 'ge-result',
        description: 'A centred outcome panel shown after an operation completes. It announces politely and never takes focus, whatever the status. Projected content lands in the actions row; a `ge-result-detail` goes above it.',
        examples: [
            {
                title: 'Statuses',
                note: 'The status picks the glyph and its colour, never how loudly the panel is announced.',
                html: `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(18rem,1fr));gap:1rem;width:100%">
  <ge-result status="success" heading="Payment received" description="We emailed your receipt.">
    <ge-button size="sm">Back to dashboard</ge-button>
  </ge-result>
  <ge-result status="error" heading="Upload failed" description="The file could not be saved."></ge-result>
  <ge-result status="warning" heading="Check your details" description="Some fields need attention."></ge-result>
  <ge-result status="info" heading="Scheduled" description="Your export starts at 02:00 UTC."></ge-result>
</div>`,
                block: true,
            },
            {
                title: 'With detail and actions',
                note: '`ge-result-detail` is drawn above the actions and is kept out of the live announcement.',
                html: `<ge-result status="error" heading="Upload failed" description="The server rejected the file.">
  <ge-result-detail>Error 413: the file is larger than the 10 MB limit.</ge-result-detail>
  <ge-button size="sm">Try again</ge-button>
  <ge-button size="sm" variant="outline">Contact support</ge-button>
</ge-result>`,
                block: true,
            },
        ],
        api: [
            { name: 'status', type: "'success' | 'error' | 'warning' | 'info'", default: "'info'", description: 'Outcome: the glyph and its colour.' },
            { name: 'heading', type: 'string', default: "''", description: 'Headline. Hidden when empty.' },
            { name: 'description', type: 'string', default: "''", description: 'Supporting line under the headline. Hidden when empty.' },
            { name: 'detail', type: 'slot', default: '-', description: '`ge-result-detail` assigns itself here; it has no attributes.' },
            { name: 'panel', type: 'part', default: '-', description: 'The `<output>` box.' },
        ],
    },
    {
        id: 'data-list',
        group: 'Display',
        name: 'Data list',
        tag: 'ge-data-list',
        description: 'Label and value pairs as a real `<dl>`. Set the `items` property for plain text, or write `ge-data-list-item` children when a value needs markup. Both can be mixed; data rows come first.',
        examples: [
            {
                title: 'From data',
                note: '`items` is a property (an array of `{ label, value }`), set from script.',
                html: `<ge-data-list id="dl-data" style="width:100%;max-width:28rem"></ge-data-list>
<script>
document.getElementById('dl-data').items = [
  { label: 'Name', value: 'Ada Lovelace' },
  { label: 'Email', value: 'ada@example.com' },
  { label: 'Address', value: '12 St James Square, London, SW1Y 4JH' },
];
</script>`,
                block: true,
            },
            {
                title: 'Horizontal with custom values',
                note: '`horizontal` puts labels in a column beside the values from 640px up. Slotted values can be anything.',
                html: `<ge-data-list orientation="horizontal" style="width:100%;max-width:36rem">
  <ge-data-list-item label="Plan"><ge-badge label="Pro"></ge-badge></ge-data-list-item>
  <ge-data-list-item label="Email"><a href="mailto:ada@example.com">ada@example.com</a></ge-data-list-item>
  <ge-data-list-item label="Status"><span style="color:var(--status-success)">Active</span></ge-data-list-item>
</ge-data-list>`,
                block: true,
            },
        ],
        api: [
            { name: 'items', type: 'DataListEntry[]', default: '[]', description: 'Property only. Rows of `{ label, value }`, both shown as text.' },
            { name: 'orientation', type: "'vertical' | 'horizontal'", default: "'vertical'", description: '`horizontal` puts labels beside values from 640px up and stacks them below that.' },
            { name: 'item: label', type: 'string', default: "''", description: 'The term of a `ge-data-list-item`; its content is the value.' },
            { name: 'list / label / value', type: 'part', default: '-', description: 'The `<dl>`, a `<dt>` and a `<dd>`.' },
        ],
    },
    {
        id: 'input-group',
        group: 'Form inputs',
        name: 'Input group',
        tag: 'ge-input-group',
        description: 'One bordered row that holds a text field and its addons (an icon, a unit, a button) under a single border and focus ring. The ring shows while the field has focus, not when an addon button does.',
        examples: [
            {
                title: 'Addons',
                note: '`ge-input-group-text` is muted text. A bare `<svg>` in an addon is 1rem. Put an `align="inline-end"` addon after the field.',
                html: `<div style="display:flex;flex-direction:column;gap:0.75rem;width:100%;max-width:24rem">
  <ge-input-group>
    <ge-input-group-addon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></ge-input-group-addon>
    <ge-input-group-input placeholder="Search" aria-label="Search"></ge-input-group-input>
  </ge-input-group>
  <ge-input-group>
    <ge-input-group-addon><ge-input-group-text>https://</ge-input-group-text></ge-input-group-addon>
    <ge-input-group-input placeholder="example.com" aria-label="Website"></ge-input-group-input>
    <ge-input-group-addon align="inline-end"><ge-input-group-text>.com</ge-input-group-text></ge-input-group-addon>
  </ge-input-group>
</div>`,
                block: true,
            },
            {
                title: 'Variants and disabled',
                html: `<div style="display:flex;flex-direction:column;gap:0.75rem;width:100%;max-width:24rem">
  <ge-input-group variant="underline"><ge-input-group-addon><ge-input-group-text>$</ge-input-group-text></ge-input-group-addon><ge-input-group-input placeholder="0.00" aria-label="Amount, underline"></ge-input-group-input></ge-input-group>
  <ge-input-group variant="ghost"><ge-input-group-addon><ge-input-group-text>$</ge-input-group-text></ge-input-group-addon><ge-input-group-input placeholder="0.00" aria-label="Amount, ghost"></ge-input-group-input></ge-input-group>
  <ge-input-group disabled><ge-input-group-addon><ge-input-group-text>$</ge-input-group-text></ge-input-group-addon><ge-input-group-input value="12.50" aria-label="Amount, disabled"></ge-input-group-input></ge-input-group>
</div>`,
                block: true,
            },
            {
                title: 'With a button',
                html: `<ge-input-group style="max-width:24rem">
  <ge-input-group-input placeholder="you@example.com" type="email" name="email" aria-label="Email"></ge-input-group-input>
  <ge-input-group-addon align="inline-end"><ge-button size="sm" variant="ghost" label="Subscribe"></ge-button></ge-input-group-addon>
</ge-input-group>`,
                block: true,
            },
        ],
        api: [
            { name: 'variant', type: "'outline' | 'underline' | 'ghost'", default: "'outline'", description: 'Border treatment of the row.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Disables the field and dims the row.' },
            { name: 'addon: align', type: "'inline-start' | 'inline-end'", default: "'inline-start'", description: 'Which end of the row the addon sits at, which sets its padding.' },
            { name: 'input: name / value / type / placeholder / disabled / inputmode', type: 'attributes', default: '-', description: 'As on `ge-input`. The field is form-associated and resets with its form.' },
            { name: 'input: aria-label / aria-labelledby / aria-describedby', type: 'string', default: '-', description: 'Forwarded to the inner input.' },
            { name: 'input, change', type: 'event', default: '-', description: 'From the field; `change` is re-fired on the host.' },
            { name: '--density-input', type: 'css', default: '--density', description: 'Spacing multiplier for height and padding.' },
        ],
    },
    {
        id: 'field',
        group: 'Form inputs',
        name: 'Field',
        tag: 'ge-field',
        description: 'A form field: a label, a control and helper text laid out together. Set the label\'s `for` to the control\'s `id`. The field keeps the ids of its descriptions and errors as `describedBy`, for the control\'s `aria-describedby`.',
        examples: [
            {
                title: 'Description and error',
                note: 'The error is a polite alert, so it is announced when it appears. Clicking the label focuses the control.',
                html: `<div style="display:flex;flex-direction:column;gap:1.5rem;width:100%;max-width:24rem">
  <ge-field>
    <ge-field-label for="f-email">Email</ge-field-label>
    <ge-input id="f-email" type="email" placeholder="you@example.com" aria-describedby="f-hint"></ge-input>
    <ge-field-description id="f-hint">We will never share your email.</ge-field-description>
  </ge-field>
  <ge-field>
    <ge-field-label for="f-name">Name</ge-field-label>
    <ge-input id="f-name" value="A" aria-describedby="f-err"></ge-input>
    <ge-field-error id="f-err">Enter at least two characters.</ge-field-error>
  </ge-field>
</div>`,
                block: true,
            },
            {
                title: 'Horizontal',
                note: 'For a checkbox or switch with its label beside it.',
                html: `<ge-field orientation="horizontal">
  <ge-switch id="f-news" aria-label="Newsletter"></ge-switch>
  <ge-field-label for="f-news">Send me the newsletter</ge-field-label>
</ge-field>`,
            },
            {
                title: 'Set, group and separator',
                note: '`ge-field-set` is a semantic group named by its legend; `ge-field-group` only spaces fields.',
                html: `<ge-field-set style="width:100%;max-width:24rem">
  <ge-field-legend>Contact</ge-field-legend>
  <ge-field-group>
    <ge-field>
      <ge-field-label for="f-a">Email</ge-field-label>
      <ge-input id="f-a" placeholder="you@example.com"></ge-input>
    </ge-field>
    <ge-field-separator></ge-field-separator>
    <ge-field>
      <ge-field-label for="f-b">Phone</ge-field-label>
      <ge-input id="f-b" placeholder="+44 …"></ge-input>
    </ge-field>
  </ge-field-group>
</ge-field-set>`,
                block: true,
            },
        ],
        api: [
            { name: 'orientation', type: "'vertical' | 'horizontal'", default: "'vertical'", description: '`horizontal` is a centred row, for a checkbox or switch beside its label.' },
            { name: 'describedBy', type: 'string | null', default: '-', description: 'Property. Ids of the descriptions and errors inside, in document order.' },
            { name: 'described-by-change', type: 'event', default: '-', description: 'Fires when a description or error is added or removed.' },
            { name: 'label: for', type: 'string', default: "''", description: 'Id of the control; it is named by the label, and clicking the label focuses it.' },
            { name: 'description / error: id', type: 'string', default: 'generated', description: 'Element id; generated when empty.' },
        ],
    },
    {
        id: 'calendar',
        group: 'Form inputs',
        name: 'Calendar',
        tag: 'ge-calendar',
        description: 'A month grid. `mode` picks what a click selects: one day, a range or several days. Optional month and year selects and time fields; `locale` names the days and months and sets the direction. Fires `selected-change`.',
        examples: [
            {
                title: 'Modes',
                html: `<ge-calendar mode="single" style="border: 1px solid var(--border); border-radius: calc(var(--radius) - 2px); box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)"></ge-calendar>
<ge-calendar mode="range" style="border: 1px solid var(--border); border-radius: calc(var(--radius) - 2px); box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)"></ge-calendar>
<ge-calendar mode="multi" style="border: 1px solid var(--border); border-radius: calc(var(--radius) - 2px); box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)"></ge-calendar>`,
            },
            {
                title: 'Month and year selects',
                html: `<ge-calendar mode="single" show-month-select show-year-select style="border: 1px solid var(--border); border-radius: calc(var(--radius) - 2px)"></ge-calendar>`,
            },
            {
                title: 'With time',
                note: 'The time is applied to the picked date. `time-mode="range"` shows a start and an end time, which makes sense for a range.',
                html: `<ge-calendar mode="single" show-time-select style="border: 1px solid var(--border); border-radius: calc(var(--radius) - 2px)"></ge-calendar>
<ge-calendar mode="single" show-time-select time-mode="range" style="border: 1px solid var(--border); border-radius: calc(var(--radius) - 2px)"></ge-calendar>
<ge-calendar mode="range" show-time-select time-mode="range" style="border: 1px solid var(--border); border-radius: calc(var(--radius) - 2px)"></ge-calendar>`,
            },
            {
                title: 'Week starts on Monday, with a date',
                html: `<ge-calendar mode="single" week-starts-on="1" selected="2024-01-01" style="border: 1px solid var(--border); border-radius: calc(var(--radius) - 2px)"></ge-calendar>`,
            },
            {
                title: 'Read the selection',
                html: `<div style="display: flex; flex-direction: column; gap: 0.5rem">
  <ge-calendar id="cal-live" mode="single" show-time-select style="border: 1px solid var(--border); border-radius: calc(var(--radius) - 2px)"></ge-calendar>
  <code id="cal-out" style="font-size: 0.875rem">Selected: none</code>
</div>
<script>
const cal = document.getElementById('cal-live');
cal.addEventListener('selected-change', (e) => {
  document.getElementById('cal-out').textContent = 'Selected: ' + (e.detail ? e.detail.toLocaleString() : 'none');
});
</script>`,
            },
            {
                title: 'Locales',
                note: 'The same dictionaries as the Angular library. Without a `locale` the calendar follows the page `lang`, then English.',
                html: `<ge-calendar locale="en" show-month-select show-year-select style="border: 1px solid var(--border); border-radius: calc(var(--radius) - 2px)"></ge-calendar>
<ge-calendar locale="he" show-month-select show-year-select show-time-select time-mode="range" style="border: 1px solid var(--border); border-radius: calc(var(--radius) - 2px)"></ge-calendar>
<ge-calendar locale="ja" show-month-select show-year-select style="border: 1px solid var(--border); border-radius: calc(var(--radius) - 2px)"></ge-calendar>`,
            },
        ],
        api: [
            { name: 'mode', type: "'single' | 'range' | 'multi'", default: "'single'", description: 'What a click selects, and the shape of `selected`: a `Date`, `{ start, end }` or `Date[]`.' },
            { name: 'selected', type: 'Date | DateRange | Date[] | null', default: 'null', description: 'The selection. The attribute accepts one date (`2024-01-01`); ranges and lists are property-only.' },
            { name: 'selectedTimeRange', type: '{ start, end }', default: "{ start: '', end: '' }", description: 'Property. The start and end times as `HH:mm`, with `time-mode="range"`.' },
            { name: 'show-month-select', type: 'boolean', default: 'false', description: 'A month dropdown in the header.' },
            { name: 'show-year-select', type: 'boolean', default: 'false', description: 'A year dropdown in the header.' },
            { name: 'show-time-select', type: 'boolean', default: 'false', description: 'Time fields under the grid.' },
            { name: 'time-mode', type: "'single' | 'range'", default: "'single'", description: 'One time field, or a start and an end.' },
            { name: 'week-starts-on', type: 'number', default: '0', description: 'The first day of the week: 0 is Sunday, 1 is Monday.' },
            { name: 'locale', type: 'string | CalendarLocale', default: "''", description: 'A locale id (`en`, `he`, `ar`, `de`, `fr`, `es`, `ja`, `zh`, `ru`, `pt`) or a dictionary. Empty follows the page `lang`.' },
            { name: 'selected-change', type: 'event', default: '-', description: 'After the user changes the selection; `detail` is the new `selected`.' },
            { name: 'time-range-change', type: 'event', default: '-', description: 'After the user changes a time; `detail` is `{ start, end }`.' },
            { name: '--density-picker', type: 'css', default: '--density', description: 'Spacing multiplier.' },
        ],
    },
    {
        id: 'date-picker',
        group: 'Form inputs',
        name: 'Date picker',
        tag: 'ge-date-picker',
        description: 'A button that shows the picked date and opens a `ge-calendar` in a popover. `ge-date-range-picker` picks a start and an end. Picking closes the panel, unless `show-time` is on. Form-associated: a `name` submits `YYYY-MM-DD`.',
        examples: [
            {
                title: 'Date, date and time, range',
                html: `<div style="display: flex; flex-wrap: wrap; gap: 2rem">
  <ge-date-picker placeholder="Pick a date"></ge-date-picker>
  <ge-date-picker show-time placeholder="Pick a date and time"></ge-date-picker>
  <ge-date-range-picker placeholder="Select a date range"></ge-date-range-picker>
</div>`,
            },
            {
                title: 'Hebrew, right to left',
                html: `<div dir="rtl"><ge-date-picker show-time locale="he" placeholder="בחר תאריך"></ge-date-picker></div>`,
            },
            {
                title: 'Clear and read the value',
                html: `<div style="display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start">
  <ge-date-picker id="dp-live" placeholder="Pick a date"></ge-date-picker>
  <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem">
    <ge-button id="dp-clear" variant="outline" size="sm">Clear</ge-button>
    <code id="dp-out" style="font-size: 0.875rem">Value: none</code>
  </div>
</div>
<script>
const dp = document.getElementById('dp-live');
const out = document.getElementById('dp-out');
dp.addEventListener('date-change', (e) => { out.textContent = 'Value: ' + e.detail.toDateString(); });
document.getElementById('dp-clear').addEventListener('click', () => { dp.date = null; out.textContent = 'Value: none'; });
</script>`,
            },
            {
                title: 'Inside an overflow-hidden card',
                note: 'The panel is promoted to the top layer, so the card does not clip it.',
                html: `<div style="width: 100%; max-width: 320px; overflow: hidden; border: 1px solid var(--border); border-radius: calc(var(--radius) + 4px); padding: 1rem">
  <ge-date-picker placeholder="Pick a date"></ge-date-picker>
</div>`,
            },
        ],
        api: [
            { name: 'date', type: 'Date | null', default: 'null', description: '`ge-date-picker`. The picked date; the attribute takes `YYYY-MM-DD`.' },
            { name: 'range / timeRange', type: '{ start, end }', default: 'empty', description: '`ge-date-range-picker`. Properties for the picked days and times.' },
            { name: 'placeholder', type: 'string', default: "'Pick a date'", description: 'Muted text while nothing is picked.' },
            { name: 'show-time', type: 'boolean', default: 'false', description: 'Adds a time field and keeps the panel open after a pick.' },
            { name: 'locale', type: 'string', default: "'en'", description: 'BCP 47 tag for the calendar and the label format.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Disables the button.' },
            { name: 'name', type: 'string', default: "''", description: 'Form field name. Submits `YYYY-MM-DD` (`YYYY-MM-DDTHH:mm` with `show-time`); the range submits `start/end`.' },
            { name: 'date-change / range-change', type: 'event', default: '-', description: 'After the user picks; `detail` is the `Date` or `{ start, end }`.' },
            { name: 'time-range-change', type: 'event', default: '-', description: 'Range picker: after a time changes.' },
            { name: 'show() / hide() / toggle()', type: 'method', default: '-', description: 'Open or close the panel.' },
            { name: '--density-picker', type: 'css', default: '--density', description: 'Spacing multiplier for the button.' },
        ],
    },
    {
        id: 'autocomplete',
        group: 'Form inputs',
        name: 'Autocomplete',
        tag: 'ge-autocomplete',
        description: 'A text box that suggests `options` as you type, filtering them and highlighting the match. One pick, or `multiple` chips. Options can be objects: give `displayWith` and `value-attribute`. Fires `value-change` and `search-change` (debounced with `debounce-time`, for server search).',
        examples: [
            {
                title: 'Single and multiple',
                html: `<div style="display: grid; gap: 2rem; max-width: 24rem">
  <div style="display: grid; gap: 0.5rem">
    <p style="margin: 0; font-size: 0.875rem; font-weight: 500">Single selection</p>
    <ge-autocomplete id="ac-single" placeholder="Select framework..."></ge-autocomplete>
    <p id="ac-single-out" style="margin: 0; font-size: 0.875rem; color: var(--muted-foreground)">Selected: null</p>
  </div>
  <div style="display: grid; gap: 0.5rem">
    <p style="margin: 0; font-size: 0.875rem; font-weight: 500">Multiple selection</p>
    <ge-autocomplete id="ac-multi" multiple placeholder="Select frameworks..."></ge-autocomplete>
    <p id="ac-multi-out" style="margin: 0; font-size: 0.875rem; color: var(--muted-foreground)">Selected: Next.js, Angular</p>
  </div>
</div>
<script>
const frameworks = [
  { value: 'next.js', label: 'Next.js' }, { value: 'sveltekit', label: 'SvelteKit' },
  { value: 'nuxt.js', label: 'Nuxt.js' }, { value: 'remix', label: 'Remix' },
  { value: 'astro', label: 'Astro' }, { value: 'angular', label: 'Angular' },
  { value: 'vue', label: 'Vue' }, { value: 'react', label: 'React' },
];
for (const id of ['ac-single', 'ac-multi']) {
  const ac = document.getElementById(id);
  ac.options = frameworks;
  ac.displayWith = (option) => option.label;
  ac.valueAttribute = 'value';
}
document.getElementById('ac-multi').value = [frameworks[0], frameworks[5]];
document.getElementById('ac-single').addEventListener('value-change', (e) => {
  document.getElementById('ac-single-out').textContent = 'Selected: ' + JSON.stringify(e.detail);
});
document.getElementById('ac-multi').addEventListener('value-change', (e) => {
  document.getElementById('ac-multi-out').textContent = 'Selected: ' + e.detail.map((o) => o.label).join(', ');
});
</script>`,
            },
            {
                title: 'Disabled',
                html: `<div style="max-width: 24rem"><ge-autocomplete disabled placeholder="Disabled"></ge-autocomplete></div>`,
            },
            {
                title: 'Search on the server',
                note: '`no-filter` keeps whatever `options` holds visible, and `debounce-time` waits for a pause in typing before `search-change` fires. Here a timer stands in for the request.',
                html: `<div style="display: grid; gap: 0.5rem; max-width: 24rem">
  <ge-autocomplete id="ac-remote" no-filter debounce-time="300" placeholder="Search countries..."></ge-autocomplete>
  <p id="ac-remote-out" style="margin: 0; font-size: 0.875rem; color: var(--muted-foreground)">Requests: 0</p>
</div>
<script>
const countries = ['Argentina', 'Australia', 'Austria', 'Belgium', 'Brazil', 'Canada', 'Chile', 'Denmark', 'Egypt', 'Finland', 'France', 'Germany', 'Greece', 'Ireland', 'Israel', 'Italy', 'Japan', 'Kenya', 'Mexico', 'Norway', 'Peru', 'Poland', 'Portugal', 'Spain', 'Sweden', 'Turkey'];
const remote = document.getElementById('ac-remote');
let requests = 0;
remote.options = [];
remote.addEventListener('search-change', (e) => {
  requests += 1;
  document.getElementById('ac-remote-out').textContent = 'Requests: ' + requests;
  setTimeout(() => { remote.options = countries.filter((c) => c.toLowerCase().includes(e.detail.toLowerCase())).slice(0, 6); }, 200);
});
</script>`,
            },
            {
                title: 'Inside a clipped box',
                note: 'The list is promoted to the top layer, so the box around the input does not cut it off.',
                html: `<div style="max-width: 24rem; height: 7rem; overflow: hidden; border: 1px solid var(--border); border-radius: calc(var(--radius) + 2px); padding: 1rem; background: var(--card)">
  <ge-autocomplete id="ac-clip" placeholder="Select framework..."></ge-autocomplete>
</div>
<script>document.getElementById('ac-clip').options = ['Next.js', 'SvelteKit', 'Nuxt.js', 'Remix', 'Astro', 'Angular', 'Vue', 'React'];</script>`,
            },
        ],
        api: [
            { name: 'options', type: 'unknown[]', default: '[]', description: 'Property. The candidates; every one is rendered and hidden by the filter.' },
            { name: 'displayWith', type: '(option) => string', default: 'String', description: 'Property. The text shown for an option and matched against what is typed.' },
            { name: 'value-attribute', type: 'string', default: "''", description: 'The property that identifies an option, such as `id`. Without it options are compared by reference.' },
            { name: 'value', type: 'unknown', default: 'null', description: 'Property. The selection: an option or `null`, or an array with `multiple`. Setting it does not fire `value-change`.' },
            { name: 'multiple', type: 'boolean', default: 'false', description: 'Chips: picks toggle, the list stays open, Backspace in an empty box removes the last chip.' },
            { name: 'placeholder', type: 'string', default: "'Select...'", description: 'Hint text; the default follows `locale`.' },
            { name: 'no-filter', type: 'boolean', default: 'false', description: 'Do not hide options that do not contain the text; for server-side search.' },
            { name: 'debounce-time', type: 'number', default: '0', description: 'Milliseconds of quiet typing before `search-change` fires.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Disables the box.' },
            { name: 'name', type: 'string', default: "''", description: 'Form field name; submits `value-attribute` of each pick, or its label.' },
            { name: 'locale', type: 'string', default: "''", description: 'A locale id for the placeholder, the empty message and the direction. Empty follows the page `lang`.' },
            { name: 'value-change', type: 'event', default: '-', description: 'After the user picks or removes; `detail` is the option (or `null`), or the array with `multiple`.' },
            { name: 'search-change', type: 'event', default: '-', description: 'As the user types; `detail` is the text.' },
            { name: 'show() / hide()', type: 'method', default: '-', description: 'Open or close the list.' },
            { name: '--density-select', type: 'css', default: '--density', description: 'Spacing multiplier for the box.' },
        ],
    },
    {
        id: 'toast',
        group: 'Overlays',
        name: 'Toast',
        tag: 'ge-toaster',
        description: 'Transient messages. Put one `ge-toaster` in the page and call the shared `toast` service from anywhere; the demo page exposes it as `globalThis.geToast`.',
        examples: [
            {
                title: 'Variants',
                html: `<ge-button variant="outline" id="t-default">Default</ge-button>
<ge-button variant="outline" id="t-success">Success</ge-button>
<ge-button variant="outline" id="t-error">Error</ge-button>
<ge-button variant="outline" id="t-info">Info</ge-button>
<ge-button variant="outline" id="t-warning">Warning</ge-button>
<script>(() => {
  const t = globalThis.geToast;
  const on = (id, fn) => document.getElementById(id).addEventListener('click', fn);
  on('t-default', () => t.toast({ heading: 'Event created', description: 'Friday, 4 November at 9:00' }));
  on('t-success', () => t.success('Saved', 'Your changes are live.'));
  on('t-error', () => t.error('Upload failed', 'The file is larger than 10 MB.'));
  on('t-info', () => t.info('Update available', 'Reload to get version 2.'));
  on('t-warning', () => t.warning('Storage almost full', '92% of your quota is used.'));
})();</script>`,
            },
            {
                title: 'Promise',
                note: 'The toast follows the promise: loading, then success or error.',
                html: `<ge-button variant="outline" id="t-promise">Save</ge-button>
<script>(() => {
  document.getElementById('t-promise').addEventListener('click', () => {
    globalThis.geToast.promise(new Promise((resolve) => setTimeout(resolve, 1800)), {
      loading: 'Saving...',
      success: 'Saved',
      error: 'Could not save',
    });
  });
})();</script>`,
            },
            {
                title: 'Action and countdown',
                note: 'Hovering or focusing a toast pauses its timer.',
                html: `<ge-button variant="outline" id="t-action">Delete file</ge-button>
<script>(() => {
  document.getElementById('t-action').addEventListener('click', () => {
    globalThis.geToast.toast({
      heading: 'File deleted',
      description: 'report.pdf was moved to trash.',
      duration: 8000,
      showCountdown: true,
      action: { label: 'Undo', onClick: () => globalThis.geToast.success('Restored') },
    });
  });
})();</script>`,
            },
        ],
        api: [
            { name: 'toast.success / error / info / warning', type: '(heading, description?, duration?)', default: '-', description: 'Show a toast of that variant and return its id.' },
            { name: 'toast.toast(data)', type: '{ heading, description, duration, showCountdown, action }', default: 'duration 5000', description: 'Show a toast with full options; `action` is `{ label, onClick }`. A duration of `0` keeps it until dismissed.' },
            { name: 'toast.promise(promise, messages)', type: '{ loading, success, error }', default: '-', description: 'Show a loading toast that turns into the outcome of the promise.' },
            { name: 'vertical', type: "'top' | 'bottom'", default: "'bottom'", description: 'Where `ge-toaster` stacks toasts.' },
            { name: 'horizontal', type: "'start' | 'center' | 'end'", default: "'end'", description: 'Horizontal anchor; start and end follow the text direction.' },
        ],
    },
    {
        id: 'tree',
        group: 'Navigation',
        name: 'Tree',
        tag: 'ge-tree',
        description: 'A hierarchy of expandable, optionally selectable nodes. The whole tree is one tab stop: arrow keys move, expand and collapse, `*` opens every visible parent and Enter or Space selects.',
        examples: [
            {
                title: 'Items',
                html: `<div style="max-width:24rem;border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);padding:1rem">
  <ge-tree id="tree-items" selectable="single">
    <ge-tree-item value="documents">
      <ge-tree-label><ge-tree-icon>📁</ge-tree-icon> Documents</ge-tree-label>
      <ge-tree-item value="resume"><ge-tree-label><ge-tree-icon>📄</ge-tree-icon> Resume.pdf</ge-tree-label></ge-tree-item>
      <ge-tree-item value="cover-letter"><ge-tree-label><ge-tree-icon>📄</ge-tree-icon> Cover letter.docx</ge-tree-label></ge-tree-item>
    </ge-tree-item>
    <ge-tree-item value="images">
      <ge-tree-label><ge-tree-icon>📁</ge-tree-icon> Images</ge-tree-label>
      <ge-tree-item value="photo1"><ge-tree-label><ge-tree-icon>🖼️</ge-tree-icon> Vacation.jpg</ge-tree-label></ge-tree-item>
    </ge-tree-item>
  </ge-tree>
</div>
<p id="tree-items-out" class="note" style="margin-top:.5rem">Selected: none</p>
<script>(() => {
  const tree = document.getElementById('tree-items');
  tree.addEventListener('selection-change', (e) => {
    document.getElementById('tree-items-out').textContent = 'Selected: ' + (e.detail.join(', ') || 'none');
  });
})();</script>`,
            },
            {
                title: 'From data',
                note: 'Set the `data` property to a list of `{ key, label, icon?, children? }` nodes and the tree draws them.',
                html: `<div style="max-width:24rem;border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);padding:1rem">
  <ge-tree id="tree-data"></ge-tree>
</div>
<script>(() => {
  document.getElementById('tree-data').data = [
    { key: '1', label: 'Projects', children: [
      { key: '1-1', label: 'Frontend', children: [
        { key: '1-1-1', label: 'app.component.ts', icon: '📄' },
        { key: '1-1-2', label: 'app.html', icon: '📄' },
      ] },
      { key: '1-2', label: 'Backend' },
    ] },
    { key: '2', label: 'Settings', icon: '⚙️' },
  ];
})();</script>`,
            },
            {
                title: 'Initial expand depth',
                note: '`initial-expand-depth="1"` opens the first level; `-1` opens everything.',
                html: `<div style="max-width:24rem;border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);padding:1rem">
  <ge-tree id="tree-depth" selectable="multiple" initial-expand-depth="1"></ge-tree>
</div>
<script>(() => {
  document.getElementById('tree-depth').data = [
    { key: 'documents', label: 'Documents', icon: '📁', children: [
      { key: 'work', label: 'Work', icon: '📂', children: [
        { key: 'report', label: 'Report.docx', icon: '📄' },
        { key: 'expenses', label: 'Expenses.xlsx', icon: '📊' },
      ] },
      { key: 'personal', label: 'Personal', icon: '📂', children: [{ key: 'resume', label: 'Resume.pdf', icon: '📄' }] },
    ] },
    { key: 'images', label: 'Images', icon: '🖼️', children: [
      { key: 'vacation', label: 'Vacation', children: [
        { key: 'beach', label: 'Beach.jpg', icon: '📷' },
        { key: 'mountains', label: 'Mountains.jpg', icon: '📷' },
      ] },
    ] },
  ];
})();</script>`,
            },
            {
                title: 'Custom node content',
                note: 'Set `nodeContent` to a function returning the label content of each node.',
                html: `<div style="max-width:24rem;border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);padding:1rem">
  <ge-tree id="tree-custom" initial-expand-depth="-1"></ge-tree>
</div>
<script>(() => {
  const tree = document.getElementById('tree-custom');
  tree.nodeContent = (node) => {
    const strong = document.createElement('b');
    strong.textContent = node.label;
    const note = node.children ? node.children.length + ' items' : 'file';
    const content = document.createDocumentFragment();
    content.append(strong, ' (' + note + ')');
    return content;
  };
  tree.data = [{ key: 'a', label: 'src', children: [{ key: 'a1', label: 'index.ts' }, { key: 'a2', label: 'app.ts' }] }];
})();</script>`,
            },
        ],
        api: [
            { name: 'selectable', type: "'none' | 'single' | 'multiple'", default: "'none'", description: 'Selection mode. `none` ignores clicks and omits `aria-selected`; `single` replaces the selection; `multiple` accumulates.' },
            { name: 'data', type: 'TreeNode[]', default: '[]', description: 'Nodes to draw (`{ key, label, icon?, children?, data? }`). When non-empty the tree ignores projected items.' },
            { name: 'initial-expand-depth', type: 'number', default: '0', description: 'Levels of `data` open on load: `0` none, `n` down to depth `n`, `-1` all. Re-applied, discarding the user\'s expansion, whenever `data` changes.' },
            { name: 'nodeContent', type: '(node) => TemplateResult | string | Node', default: '-', description: 'Draws a node\'s label content in place of its icon and text.' },
            { name: 'selection-change', type: 'event', default: '-', description: 'After the selection changes; `detail` is every selected key.' },
            { name: 'expand-change', type: 'event', default: '-', description: 'After a node expands or collapses, and when the initial depth applies; `detail` is every expanded key.' },
            { name: 'toggleExpanded / toggleSelected(key)', type: 'method', default: '-', description: 'Flip a node. Selection does nothing while `selectable` is `none`.' },
            { name: 'expandAll(keys) / collapseAll()', type: 'method', default: '-', description: '`expandAll` makes exactly `keys` the open set; `collapseAll` closes everything.' },
            { name: 'focusNode(key?)', type: 'method', default: '-', description: 'Focuses the tree and points it at `key`, or at the first node when none is set.' },
            { name: 'ge-tree-item value / has-nested', type: 'string / boolean', default: '- / auto', description: '`value` is the unique node key. `has-nested` forces the chevron on (lazy branches) or off (`false`); unset it counts child items.' },
        ],
    },
    {
        id: 'sidebar',
        group: 'Navigation',
        name: 'Sidebar',
        tag: 'ge-sidebar',
        description: 'An app-shell sidebar. On a page 768px or wider it is a sticky column that collapses to a 60px icon rail; below that it is a drawer with a scrim, Escape to close and a focus trap. The collapsed flag is remembered in `localStorage`.',
        examples: [
            {
                title: 'App shell',
                note: 'Press the trigger, or hover the edge of the sidebar and press the rail. Resize the window under 768px for the drawer.',
                block: true,
                html: `<div style="${SB_BOX}">
  <ge-sidebar-provider>
    <ge-sidebar>
      <ge-sidebar-header><div style="font-weight:600">Gil Elements</div></ge-sidebar-header>
      <ge-sidebar-content>
        <ge-sidebar-group>
          <ge-sidebar-group-label>Navigation</ge-sidebar-group-label>
          <ge-sidebar-group-content>
            <ge-sidebar-menu>
              <ge-sidebar-menu-item><ge-sidebar-menu-link href="#" active>${SB_HOME}<span>Home</span></ge-sidebar-menu-link></ge-sidebar-menu-item>
              <ge-sidebar-menu-item><ge-sidebar-menu-link href="#">${SB_MAIL}<span>Inbox</span></ge-sidebar-menu-link></ge-sidebar-menu-item>
              <ge-sidebar-menu-item><ge-sidebar-menu-link href="#">${SB_CAL}<span>Calendar</span></ge-sidebar-menu-link></ge-sidebar-menu-item>
              <ge-sidebar-menu-item><ge-sidebar-menu-link href="#">${SB_SET}<span>Settings</span></ge-sidebar-menu-link></ge-sidebar-menu-item>
            </ge-sidebar-menu>
          </ge-sidebar-group-content>
        </ge-sidebar-group>
      </ge-sidebar-content>
      <ge-sidebar-footer>
        <ge-sidebar-separator></ge-sidebar-separator>
        <div style="font-size:.75rem;color:var(--muted-foreground)">v1.0.0</div>
      </ge-sidebar-footer>
    </ge-sidebar>
    <ge-sidebar-inset>
      <header style="display:flex;height:3rem;align-items:center;border-bottom:1px solid var(--border);padding-inline:1rem">
        <ge-sidebar-trigger></ge-sidebar-trigger>
        <span style="margin-inline-start:1rem;font-size:.875rem;font-weight:500">Main content</span>
      </header>
      <div style="padding:1rem"><p style="margin:0;color:var(--muted-foreground)">The sidebar remembers whether you collapsed it.</p></div>
    </ge-sidebar-inset>
  </ge-sidebar-provider>
</div>`,
            },
            {
                title: 'Variants',
                note: '`variant="sidebar"`, `"floating"` and `"inset"`, and `collapsible="false"`, which pins the rail open.',
                block: true,
                html: `<div style="display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(18rem,1fr))">
${SB_TILE('sidebar', '', 'sidebar')}
${SB_TILE('floating', '', 'floating')}
${SB_TILE('inset', '', 'inset')}
${SB_TILE('sidebar', ' collapsible="false"', 'collapsible = false')}
</div>`,
            },
            {
                title: 'Nested menus, badges, actions and the rail',
                note: 'A sub-menu keeps its rows in the DOM and collapses with a grid-row transition; closed rows are `inert`. Point the trigger\'s `for` at the sub-menu\'s id. The rail at the sidebar\'s edge collapses it.',
                block: true,
                html: `<div style="height:460px;overflow:hidden;border:1px solid var(--border);border-radius:var(--radius)">
  <ge-sidebar-provider persist-collapsed="false">
    <ge-sidebar>
      <ge-sidebar-header><div style="font-weight:600">Acme Inc</div></ge-sidebar-header>
      <ge-sidebar-content>
        <ge-sidebar-group>
          <ge-sidebar-group-label>Workspace</ge-sidebar-group-label>
          <ge-sidebar-group-content>
            <ge-sidebar-menu>
              <ge-sidebar-menu-item><ge-sidebar-menu-link href="#" active>${SB_HOME}<span>Dashboard</span></ge-sidebar-menu-link></ge-sidebar-menu-item>
              <ge-sidebar-menu-item>
                <ge-sidebar-menu-link href="#">${SB_MAIL}<span>Inbox</span></ge-sidebar-menu-link>
                <ge-sidebar-menu-badge>12</ge-sidebar-menu-badge>
              </ge-sidebar-menu-item>
              <ge-sidebar-menu-item>
                <ge-sidebar-menu-sub-trigger for="sb-projects">${SB_FOLDER}<span>Projects</span></ge-sidebar-menu-sub-trigger>
                <ge-sidebar-menu-sub id="sb-projects">
                  <ge-sidebar-menu-sub-item><ge-sidebar-menu-sub-button href="#" active><span>Apollo</span></ge-sidebar-menu-sub-button></ge-sidebar-menu-sub-item>
                  <ge-sidebar-menu-sub-item><ge-sidebar-menu-sub-button href="#"><span>Borealis</span></ge-sidebar-menu-sub-button></ge-sidebar-menu-sub-item>
                  <ge-sidebar-menu-sub-item><ge-sidebar-menu-sub-button href="#"><span>Cartograph</span></ge-sidebar-menu-sub-button></ge-sidebar-menu-sub-item>
                </ge-sidebar-menu-sub>
              </ge-sidebar-menu-item>
              <ge-sidebar-menu-item>
                <ge-sidebar-menu-sub-trigger for="sb-team">${SB_USERS}<span>Team</span></ge-sidebar-menu-sub-trigger>
                <ge-sidebar-menu-sub id="sb-team" expanded="false">
                  <ge-sidebar-menu-sub-item><ge-sidebar-menu-sub-button href="#"><span>Members</span></ge-sidebar-menu-sub-button></ge-sidebar-menu-sub-item>
                  <ge-sidebar-menu-sub-item><ge-sidebar-menu-sub-button href="#"><span>Invitations</span></ge-sidebar-menu-sub-button></ge-sidebar-menu-sub-item>
                </ge-sidebar-menu-sub>
              </ge-sidebar-menu-item>
              <ge-sidebar-menu-item>
                <ge-sidebar-menu-link href="#">${SB_SET}<span>Settings</span></ge-sidebar-menu-link>
                <ge-sidebar-menu-action id="sb-action" label="Settings options">${SB_MORE}</ge-sidebar-menu-action>
              </ge-sidebar-menu-item>
              <ge-sidebar-menu-item>
                <ge-sidebar-menu-button tooltip="Reports">${SB_CAL}<span>Reports</span></ge-sidebar-menu-button>
                <ge-sidebar-menu-action label="Report options" show-on-hover>${SB_MORE}</ge-sidebar-menu-action>
              </ge-sidebar-menu-item>
            </ge-sidebar-menu>
          </ge-sidebar-group-content>
        </ge-sidebar-group>
        <ge-sidebar-group>
          <ge-sidebar-group-label>Loading</ge-sidebar-group-label>
          <ge-sidebar-group-content>
            <ge-sidebar-menu>
              <ge-sidebar-menu-skeleton seed="0"></ge-sidebar-menu-skeleton>
              <ge-sidebar-menu-skeleton seed="1"></ge-sidebar-menu-skeleton>
              <ge-sidebar-menu-skeleton seed="2"></ge-sidebar-menu-skeleton>
            </ge-sidebar-menu>
          </ge-sidebar-group-content>
        </ge-sidebar-group>
      </ge-sidebar-content>
      <ge-sidebar-rail></ge-sidebar-rail>
    </ge-sidebar>
    <ge-sidebar-inset>
      <div style="padding:1rem">
        <ge-sidebar-trigger></ge-sidebar-trigger>
        <p id="sb-out" style="margin:.5rem 0 0;font-size:.875rem;color:var(--muted-foreground)">Try the actions and sub-menus.</p>
      </div>
    </ge-sidebar-inset>
  </ge-sidebar-provider>
</div>
<script>(() => {
  const out = document.getElementById('sb-out');
  document.getElementById('sb-action').addEventListener('triggered', () => { out.textContent = 'Last action: settings'; });
  for (const sub of document.querySelectorAll('#sb-projects, #sb-team')) {
    sub.addEventListener('expanded-change', (e) => { out.textContent = sub.id.slice(3) + (e.detail ? ' opened' : ' closed'); });
  }
})();</script>`,
            },
        ],
        api: [
            { name: 'ge-sidebar-provider persist-collapsed / storage-key', type: 'boolean / string', default: "true / 'ge-sidebar:collapsed'", description: 'Whether the collapsed flag is remembered in `localStorage` (set `persist-collapsed="false"` to turn it off), and under which key. Read once on load, written on each change; storage errors are swallowed.' },
            { name: 'ge-sidebar side', type: "'left' | 'right'", default: "'left'", description: 'The edge it sits on; also the way the mobile drawer slides off-screen.' },
            { name: 'ge-sidebar variant', type: "'sidebar' | 'floating' | 'inset'", default: "'sidebar'", description: 'Desktop look: flush with a border, a detached shadowed card, or a detached card with no border or shadow.' },
            { name: 'ge-sidebar collapsible', type: 'boolean', default: 'true', description: 'Whether the desktop rail may collapse; `collapsible="false"` pins it open and the trigger does nothing on desktop.' },
            { name: 'ge-sidebar collapse-mode', type: "'icon' | 'hidden'", default: "'icon'", description: 'Collapsed form: a 60px rail of icons (labels go visually hidden, menu buttons show a bubble) or zero width.' },
            { name: 'ge-sidebar-menu-link / -sub-button', type: 'href, target, active', default: "'#'", description: '`active` highlights the row and sets `aria-current="page"`. `-sub-button` also takes `size` (`sm` | `md`). Router-aware links are Angular-specific; use `href`.' },
            { name: 'ge-sidebar-menu-button tooltip', type: 'string', default: '-', description: 'Bubble text shown beside a collapsed rail on hover, also the accessible name. `active` highlights the row.' },
            { name: 'ge-sidebar-menu-sub expanded', type: 'boolean', default: 'true', description: 'Whether the nested list is open; `expanded-change` fires after the user toggles it. Always closed on a collapsed rail.' },
            { name: 'ge-sidebar-menu-sub-trigger for', type: 'string', default: '-', description: 'The id of the `ge-sidebar-menu-sub` it opens and closes.' },
            { name: 'ge-sidebar-menu-action label / show-on-hover', type: 'string / boolean', default: '- / false', description: 'An icon button pinned to the end of a row; `triggered` fires on press without following the row\'s link. `show-on-hover` fades it in on hover or focus (always shown on touch).' },
            { name: 'ge-sidebar-menu-badge announce', type: 'boolean', default: 'false', description: 'The badge is `aria-hidden` unless set to announce. On a collapsed rail it shrinks to a dot.' },
            { name: 'ge-sidebar-menu-skeleton hide-icon / variant / seed', type: 'boolean / string / number', default: "false / 'pulse' / 0", description: 'A loading row; `seed` picks the text bar width from four.' },
            { name: 'ge-sidebar-rail label / side', type: 'string / string', default: "- / 'left'", description: 'The edge handle that collapses and expands the rail (desktop only).' },
        ],
    },
    {
        id: 'eyedropper',
        group: 'Form inputs',
        name: 'Eyedropper',
        tag: 'ge-eyedropper',
        description: 'Picks a colour from the screen with the browser\'s own EyeDropper where it exists, and otherwise samples an image, canvas or video you point it at.',
        examples: [
            {
                title: 'Native picker',
                note: 'Chromium shows its magnifier over the whole screen; other browsers show the button disabled with a tooltip.',
                html: `<div style="display:flex;align-items:center;gap:1rem">
  <ge-eyedropper id="ed-native" variant="button" label="Pick a pixel"></ge-eyedropper>
  <span id="ed-native-out" style="display:none;align-items:center;gap:.5rem"><span id="ed-native-swatch" style="width:2rem;height:2rem;border-radius:.25rem;border:1px solid var(--border)"></span><code id="ed-native-hex"></code></span>
</div>
<script>(() => {
  const el = document.getElementById('ed-native');
  el.addEventListener('color-pick', (e) => {
    document.getElementById('ed-native-out').style.display = 'flex';
    document.getElementById('ed-native-swatch').style.background = e.detail;
    document.getElementById('ed-native-hex').textContent = e.detail;
  });
})();</script>`,
            },
            {
                title: 'In-page fallback',
                note: 'Set `fallbackTarget` to an image, canvas or video. Where the native picker exists it is used instead; click the image after pressing the button otherwise. Escape cancels.',
                html: `<div style="display:flex;align-items:flex-start;gap:1rem;flex-wrap:wrap">
  <canvas id="ed-canvas" width="320" height="200" style="border-radius:.375rem;max-width:100%"></canvas>
  <div style="display:flex;flex-direction:column;gap:.75rem">
    <ge-eyedropper id="ed-fallback" variant="button" label="Sample from image"></ge-eyedropper>
    <span id="ed-fallback-out" style="display:none;align-items:center;gap:.5rem"><span id="ed-fallback-swatch" style="width:2rem;height:2rem;border-radius:.25rem;border:1px solid var(--border)"></span><code id="ed-fallback-hex"></code></span>
  </div>
</div>
<script>(() => {
  const canvas = document.getElementById('ed-canvas');
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 320, 200);
  for (const [at, colour] of [[0, '#ef4444'], [0.35, '#f59e0b'], [0.65, '#22c55e'], [1, '#3b82f6']]) gradient.addColorStop(at, colour);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 320, 200);
  const el = document.getElementById('ed-fallback');
  el.fallbackTarget = canvas;
  el.addEventListener('color-pick', (e) => {
    document.getElementById('ed-fallback-out').style.display = 'flex';
    document.getElementById('ed-fallback-swatch').style.background = e.detail;
    document.getElementById('ed-fallback-hex').textContent = e.detail;
  });
})();</script>`,
            },
            {
                title: 'Variants and disabled',
                html: `<div style="display:flex;align-items:center;gap:.75rem">
  <ge-eyedropper></ge-eyedropper>
  <ge-eyedropper variant="button"></ge-eyedropper>
  <ge-eyedropper disabled></ge-eyedropper>
  <ge-eyedropper variant="button" locale="he"></ge-eyedropper>
</div>`,
            },
        ],
        api: [
            { name: 'variant', type: "'icon' | 'button'", default: "'icon'", description: 'A square icon button, or a wider one that also shows the label.' },
            { name: 'label', type: 'string', default: "'Pick color'", description: 'Button text and `aria-label`; the default follows `locale`.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Blocks picking. It is also disabled, with an explanatory tooltip, when there is neither a native picker nor a `fallbackTarget`.' },
            { name: 'fallbackTarget', type: 'HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | null', default: 'null', description: 'Element to sample when the browser has no EyeDropper. A cross-origin image needs `crossorigin`, or the canvas is tainted and nothing is picked. A property, not an attribute.' },
            { name: 'locale', type: 'string', default: "page lang, then 'en'", description: 'Language of the default label and the unsupported tooltip.' },
            { name: 'pick()', type: 'method', default: '-', description: 'Starts picking, like pressing the button. Ignored while disabled, unsupported or already picking.' },
            { name: 'color-pick / pick-start / pick-cancel', type: 'event', default: '-', description: '`color-pick` carries the hex string in `detail`. `pick-start` fires first; a session ends with exactly one of `color-pick` or `pick-cancel` (dismissed, Escape, or a click outside the target).' },
        ],
    },
    {
        id: 'color-picker',
        group: 'Form inputs',
        name: 'Color Picker',
        tag: 'ge-color-picker',
        description: 'A popover colour picker with saturation/value area, hue and alpha sliders, per-format editing, presets, recents, image palette extraction, harmonies and a WCAG contrast checker.',
        examples: [
            {
                title: 'Default with presets',
                html: `<div style="display:flex;align-items:center;gap:1rem">
  <ge-color-picker id="cp-basic" style="width:12rem" value="#3b82f6" presets='["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899"]'></ge-color-picker>
  <span style="display:flex;align-items:center;gap:.5rem"><span id="cp-basic-swatch" style="width:2rem;height:2rem;border-radius:.25rem;border:1px solid var(--border);background:#3b82f6"></span><code id="cp-basic-hex">#3b82f6</code></span>
</div>
<script>(() => {
  const el = document.getElementById('cp-basic');
  el.addEventListener('color-change', () => {
    document.getElementById('cp-basic-swatch').style.background = el.value;
    document.getElementById('cp-basic-hex').textContent = el.value;
  });
})();</script>`,
            },
            {
                title: 'With alpha',
                html: `<ge-color-picker style="width:12rem" alpha value="#3b82f6cc"></ge-color-picker>`,
            },
            {
                title: 'Eyedropper and image pick',
                note: 'The eyedropper uses the browser picker where it exists. Image pick extracts a palette from an uploaded picture.',
                html: `<ge-color-picker style="width:12rem" enable-image-pick image-extract-count="6" value="#22c55e"></ge-color-picker>`,
            },
            {
                title: 'Harmonies and contrast',
                html: `<ge-color-picker style="width:12rem" show-harmonies show-contrast contrast-background="#ffffff" value="#fbbf24"></ge-color-picker>`,
            },
            {
                title: 'OKLCH tab and persisted recents',
                note: 'Recents are stored in localStorage under `storage-key`.',
                html: `<ge-color-picker style="width:12rem" formats="hex rgb hsl oklch" storage-key="demo-recents" value="#ec4899"></ge-color-picker>`,
            },
            {
                title: 'Programmatic write',
                note: 'Setting `value` from code does not fire `color-change`, so the dirty flag only flips on a user pick.',
                html: `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:1rem">
  <ge-color-picker id="cp-prog" style="width:12rem" value="#0ea5e9"></ge-color-picker>
  <ge-button id="cp-prog-btn" variant="outline" size="sm">Set programmatically</ge-button>
  <code id="cp-prog-state">dirty: no</code>
</div>
<script>(() => {
  const el = document.getElementById('cp-prog');
  const state = document.getElementById('cp-prog-state');
  el.addEventListener('color-change', () => { state.textContent = 'dirty: yes'; });
  document.getElementById('cp-prog-btn').addEventListener('click', () => { el.value = '#8b5cf6'; });
})();</script>`,
            },
            {
                title: 'Inline panel',
                html: `<ge-color-picker inline value="#8b5cf6"></ge-color-picker>`,
            },
        ],
        api: [
            { name: 'value', type: 'string', default: "'#000000'", description: 'Current colour, always normalised to hex (`#rrggbb`, or `#rrggbbaa` with `alpha`). Writing it from code does not fire `color-change`.' },
            { name: 'name', type: 'string', default: '-', description: 'Form field name; the hex is submitted with the form.' },
            { name: 'presets', type: 'string[]', default: '[]', description: 'Swatches shown in the panel. As an attribute, a JSON array.' },
            { name: 'inline', type: 'boolean', default: 'false', description: 'Renders the panel in place with no trigger or popover.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Blocks opening and editing.' },
            { name: 'alpha', type: 'boolean', default: 'false', description: 'Adds the alpha slider and field.' },
            { name: 'show-recent / max-recent / storage-key', type: 'boolean / number / string', default: 'true / 8 / -', description: 'Recent colours row. With `storage-key` the list is persisted in localStorage; `recent-colors-change` fires on change.' },
            { name: 'enable-eyedropper / fallback-target', type: 'boolean / element', default: 'true / null', description: 'Shows a ge-eyedropper in the toolbar; `fallbackTarget` (property) is forwarded for browsers without a native picker.' },
            { name: 'enable-image-pick / image-extract-algorithm / image-extract-count', type: 'boolean / string / number', default: "false / 'median-cut' / 6", description: 'Pick a file and extract its dominant colours (`median-cut` or `k-means`).' },
            { name: 'show-harmonies', type: 'boolean', default: 'false', description: 'Complementary, analogous, triadic and other harmony swatches for the current colour.' },
            { name: 'show-contrast / contrast-background', type: 'boolean / string', default: "false / '#ffffff'", description: 'WCAG ratio against a background with AA/AAA badges.' },
            { name: 'formats', type: 'string', default: "'hex rgb hsl'", description: 'Space-separated list of editing tabs; add `oklch` for the OKLCH tab.' },
            { name: 'locale', type: 'string', default: "page lang, then 'en'", description: 'Language of the built-in labels.' },
            { name: 'slot trigger', type: 'slot', default: '-', description: 'Replaces the default trigger button; the part `trigger` styles the default.' },
            { name: 'color-change / recent-colors-change', type: 'event', default: '-', description: '`color-change` fires on user changes only, with the new hex in `detail`.' },
        ],
    },
    {
        id: 'code-block',
        group: 'Display',
        name: 'Code Block',
        tag: 'ge-code-block',
        description: 'A syntax-highlighted code viewer with a copy button, line numbers and optional scope folding. The surface is dark in both themes.',
        examples: [
            {
                title: 'Default',
                html: `<ge-code-block id="cb1" style="width:100%;min-width:0" language="typescript" code="import { Component, signal } from '@angular/core';&#10;&#10;// A counter that never goes below zero.&#10;@Component({ selector: 'app-counter', template: '<button (click)=&quot;inc()&quot;>{{ count() }}</button>' })&#10;export class CounterComponent {&#10;  readonly count = signal(0);&#10;&#10;  inc(by = 1) {&#10;    if (by > 0) {&#10;      this.count.update((n) => n + by);&#10;    }&#10;  }&#10;}"></ge-code-block>`,
            },
            {
                title: 'Languages',
                note: 'Built in: typescript, javascript, python, java, csharp, html, xml, css, json, yaml, bash and sql, plus the common fence aliases such as `ts`, `py`, `yml` and `sh`. An unknown key falls back to TypeScript.',
                html: `<div style="display:grid;gap:.5rem;width:100%"><ge-code-block id="cb2" style="width:100%;min-width:0" language="python" code="def total(items):&#10;    result = 0&#10;    for item in items:&#10;        if item > 0:&#10;            result += item&#10;    return result"></ge-code-block><ge-code-block id="cb3" style="width:100%;min-width:0" language="html" code="<section class=&quot;card&quot;>&#10;  <h2 id=&quot;title&quot;>Hello</h2>&#10;  <p>Some <b>bold</b> text.</p>&#10;</section>"></ge-code-block><ge-code-block id="cb4" style="width:100%;min-width:0" language="json" code="{&#10;  &quot;name&quot;: &quot;gil-elements&quot;,&#10;  &quot;scripts&quot;: {&#10;    &quot;build&quot;: &quot;vite build&quot;&#10;  },&#10;  &quot;private&quot;: true&#10;}"></ge-code-block></div>`,
            },
            {
                title: 'Folding',
                note: '`collapse-scope` adds chevrons on brace, bracket, tag and indent scopes. Click or press Enter or Space on one. Copy still copies every line.',
                html: `<ge-code-block id="cb5" style="width:100%;min-width:0" language="typescript" collapse-scope code="import { Component, signal } from '@angular/core';&#10;&#10;// A counter that never goes below zero.&#10;@Component({ selector: 'app-counter', template: '<button (click)=&quot;inc()&quot;>{{ count() }}</button>' })&#10;export class CounterComponent {&#10;  readonly count = signal(0);&#10;&#10;  inc(by = 1) {&#10;    if (by > 0) {&#10;      this.count.update((n) => n + by);&#10;    }&#10;  }&#10;}"></ge-code-block>`,
            },
            {
                title: 'Start folded',
                note: '`default-collapsed="1"` folds every scope at depth 1 or deeper on load; `0` folds them all.',
                html: `<ge-code-block id="cb6" style="width:100%;min-width:0" language="typescript" collapse-scope default-collapsed="1" code="import { Component, signal } from '@angular/core';&#10;&#10;// A counter that never goes below zero.&#10;@Component({ selector: 'app-counter', template: '<button (click)=&quot;inc()&quot;>{{ count() }}</button>' })&#10;export class CounterComponent {&#10;  readonly count = signal(0);&#10;&#10;  inc(by = 1) {&#10;    if (by > 0) {&#10;      this.count.update((n) => n + by);&#10;    }&#10;  }&#10;}"></ge-code-block>`,
            },
            {
                title: 'No line numbers',
                html: `<ge-code-block id="cb7" style="width:100%;min-width:0" language="python" line-numbers="false" code="def total(items):&#10;    result = 0&#10;    for item in items:&#10;        if item > 0:&#10;            result += item&#10;    return result"></ge-code-block>`,
            },
            {
                title: 'Theme',
                note: '`theme` maps token types to CSS declarations. A type it names replaces the built-in look; the rest keep it. Exported `CODE_BLOCK_THEMES` has vscode, dracula, github and monokai.',
                html: `<ge-code-block id="cb8" style="width:100%;min-width:0" language="typescript" code="const greeting = 'hello'; // dracula-ish&#10;function shout(text: string) {&#10;  return text.toUpperCase();&#10;}"></ge-code-block>
<script>(() => {
  document.getElementById('cb8').theme = {
    keyword: 'color: oklch(71.8% 0.202 349.761); font-weight: 700',
    string: 'color: oklch(94.5% 0.129 101.54)',
    comment: 'color: oklch(71.4% 0.203 305.504); font-style: italic',
    function: 'color: oklch(79.2% 0.209 151.711)',
  };
})();</script>`,
            },
            {
                title: 'Custom language',
                note: '`customLanguages` adds or replaces a language by lowercase name. A bare pattern array only colours; a `{ patterns, scopes }` object can also fold.',
                html: String.raw`<ge-code-block id="cb9" style="width:100%;min-width:0" language="shout" code="HELLO there, WORLD"></ge-code-block>
<script>(() => {
  document.getElementById('cb9').customLanguages = { shout: [{ type: 'keyword', regex: /\b[A-Z]{2,}\b/ }] };
})();</script>`,
            },
            {
                title: 'Locale',
                html: `<ge-code-block id="cb10" style="width:100%;min-width:0" language="typescript" locale="he" code="const x = 1;"></ge-code-block>`,
            },
        ],
        api: [
            { name: 'code', type: 'string', default: '\'\'', description: 'Source text. Split on newlines and tokenised line by line, so a multi-line string or block comment is coloured per line.' },
            { name: 'language', type: 'string', default: '\'typescript\'', description: 'Highlighter key, matched case-insensitively against the built-ins and `customLanguages`. Shown in the header.' },
            { name: 'line-numbers', type: 'boolean', default: 'true', description: 'The gutter, sized to the digit count of the last line. `line-numbers="false"` hides it.' },
            { name: 'collapse-scope', type: 'boolean', default: 'false', description: 'Fold chevrons for languages that have a scope detector (brace, bracket, tag and indent based).' },
            { name: 'default-collapsed', type: 'number', default: '-', description: 'Folds every scope at this depth or deeper on load (`0` folds all). Only applies with `collapse-scope`.' },
            { name: 'theme', type: 'Record<string, string> | null', default: 'null', description: 'Per-token-type CSS declarations; unnamed types keep the built-in palette. A property.' },
            { name: 'customLanguages', type: 'Record<string, LanguagePattern | LanguageConfig> | null', default: 'null', description: 'Extra or replacement languages by lowercase name. An entry shadows the built-in of that name but inherits its fold detector unless it brings one. A property.' },
            { name: 'locale', type: 'string', default: 'page lang, then en', description: 'Labels of the copy button and fold chevrons.' },
            { name: 'copyToClipboard()', type: 'method', default: '-', description: 'Copies the full `code`, folded lines included, and shows the copied state for two seconds. A no-op without the Clipboard API.' },
            { name: 'toggleScope(line) / isCollapsed(line)', type: 'method', default: '-', description: 'Fold or unfold the scope starting at a line index; ask whether it is folded.' },
            { name: '::part(base)', type: 'css part', default: '-', description: 'The outer surface.' },
        ],
    },
    {
        id: 'speed-dial',
        group: 'Actions',
        name: 'Speed Dial',
        tag: 'ge-speed-dial',
        description: 'A floating action button that fans out a menu of actions in a line or along an arc, or opens at the pointer. A click outside closes it.',
        examples: [
            {
                title: 'Linear',
                note: '`direction` sets which way the stack grows: `up`, `down`, `left` or `right`. Style the round buttons through `::part(base)`; the trigger turns a quarter while the menu is open.',
                html: `<style>.sd-fab::part(base){border-radius:9999px;width:3rem;height:3rem;box-shadow:0 10px 15px -3px rgb(0 0 0 / .1),0 4px 6px -4px rgb(0 0 0 / .1)}.sd-fab::part(base):focus-visible{box-shadow:0 0 0 3px color-mix(in oklab,var(--ring) 50%,transparent),0 10px 15px -3px rgb(0 0 0 / .1),0 4px 6px -4px rgb(0 0 0 / .1)}.sd-act::part(base){border-radius:9999px}</style><div style="position:relative;width:100%;height:240px;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden"><ge-speed-dial type="linear" direction="up" style="position:absolute;left:12.5%;top:70%;margin:-1.5rem 0 0 -1.5rem"><ge-speed-dial-trigger><ge-button class="sd-fab" size="icon" aria-label="Open actions"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg></ge-button></ge-speed-dial-trigger><ge-speed-dial-menu label="Actions"><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Share"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg></ge-button></ge-speed-dial-item></ge-speed-dial-menu></ge-speed-dial><ge-speed-dial type="linear" direction="right" style="position:absolute;left:30%;top:50%;margin:-1.5rem 0 0 -1.5rem"><ge-speed-dial-trigger><ge-button class="sd-fab" size="icon" aria-label="Open actions"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg></ge-button></ge-speed-dial-trigger><ge-speed-dial-menu label="Actions"><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Share"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg></ge-button></ge-speed-dial-item></ge-speed-dial-menu></ge-speed-dial><ge-speed-dial type="linear" direction="down" style="position:absolute;left:62%;top:25%;margin:-1.5rem 0 0 -1.5rem"><ge-speed-dial-trigger><ge-button class="sd-fab" size="icon" aria-label="Open actions"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg></ge-button></ge-speed-dial-trigger><ge-speed-dial-menu label="Actions"><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Share"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg></ge-button></ge-speed-dial-item></ge-speed-dial-menu></ge-speed-dial><ge-speed-dial type="linear" direction="left" style="position:absolute;left:92%;top:50%;margin:-1.5rem 0 0 -1.5rem"><ge-speed-dial-trigger><ge-button class="sd-fab" size="icon" aria-label="Open actions"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg></ge-button></ge-speed-dial-trigger><ge-speed-dial-menu label="Actions"><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Share"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg></ge-button></ge-speed-dial-item></ge-speed-dial-menu></ge-speed-dial></div>`,
            },
            {
                title: 'Circle, semi-circle and quarter-circle',
                note: '`radius` is the distance in px from the trigger centre. A full circle ignores `direction`; arcs spread items so the first and last sit on the end angles.',
                html: `<style>.sd-fab::part(base){border-radius:9999px;width:3rem;height:3rem;box-shadow:0 10px 15px -3px rgb(0 0 0 / .1),0 4px 6px -4px rgb(0 0 0 / .1)}.sd-fab::part(base):focus-visible{box-shadow:0 0 0 3px color-mix(in oklab,var(--ring) 50%,transparent),0 10px 15px -3px rgb(0 0 0 / .1),0 4px 6px -4px rgb(0 0 0 / .1)}.sd-act::part(base){border-radius:9999px}</style><div style="position:relative;width:100%;height:240px;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden"><ge-speed-dial type="circle" direction="up" radius="60" style="position:absolute;left:14%;top:50%;margin:-1.5rem 0 0 -1.5rem"><ge-speed-dial-trigger><ge-button class="sd-fab" size="icon" aria-label="Open actions"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg></ge-button></ge-speed-dial-trigger><ge-speed-dial-menu label="Actions"><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Share"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Copy"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Move"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></ge-button></ge-speed-dial-item></ge-speed-dial-menu></ge-speed-dial><ge-speed-dial type="semi-circle" direction="up" radius="50" style="position:absolute;left:46%;top:70%;margin:-1.5rem 0 0 -1.5rem"><ge-speed-dial-trigger><ge-button class="sd-fab" size="icon" aria-label="Open actions"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg></ge-button></ge-speed-dial-trigger><ge-speed-dial-menu label="Actions"><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Share"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Copy"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Move"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></ge-button></ge-speed-dial-item></ge-speed-dial-menu></ge-speed-dial><ge-speed-dial type="quarter-circle" direction="up-right" radius="80" style="position:absolute;left:80%;top:80%;margin:-1.5rem 0 0 -1.5rem"><ge-speed-dial-trigger><ge-button class="sd-fab" size="icon" aria-label="Open actions"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg></ge-button></ge-speed-dial-trigger><ge-speed-dial-menu label="Actions"><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Share"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg></ge-button></ge-speed-dial-item></ge-speed-dial-menu></ge-speed-dial></div>`,
            },
            {
                title: 'Mask',
                note: 'A `ge-speed-dial-mask` dims the page behind an open dial. It is focusable and named Close, so it is the keyboard way to dismiss.',
                html: `<style>.sd-fab::part(base){border-radius:9999px;width:3rem;height:3rem;box-shadow:0 10px 15px -3px rgb(0 0 0 / .1),0 4px 6px -4px rgb(0 0 0 / .1)}.sd-fab::part(base):focus-visible{box-shadow:0 0 0 3px color-mix(in oklab,var(--ring) 50%,transparent),0 10px 15px -3px rgb(0 0 0 / .1),0 4px 6px -4px rgb(0 0 0 / .1)}.sd-act::part(base){border-radius:9999px}</style><div style="position:relative;width:100%;height:220px;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden"><ge-speed-dial type="circle" radius="60" style="position:absolute;left:50%;top:50%;margin:-1.5rem 0 0 -1.5rem"><ge-speed-dial-mask></ge-speed-dial-mask><ge-speed-dial-trigger><ge-button class="sd-fab" size="icon" aria-label="Open actions"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg></ge-button></ge-speed-dial-trigger><ge-speed-dial-menu label="Actions"><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Share"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Copy"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></ge-button></ge-speed-dial-item></ge-speed-dial-menu></ge-speed-dial></div>`,
            },
            {
                title: 'Context menu',
                note: 'Right-click (or long-press) anywhere in the dashed area; the dial opens there. `ge-speed-dial-context-trigger for="id"` attaches a dial that is elsewhere on the page to whatever it wraps. A left click dismisses.',
                html: `<style>.sd-fab::part(base){border-radius:9999px;width:3rem;height:3rem;box-shadow:0 10px 15px -3px rgb(0 0 0 / .1),0 4px 6px -4px rgb(0 0 0 / .1)}.sd-fab::part(base):focus-visible{box-shadow:0 0 0 3px color-mix(in oklab,var(--ring) 50%,transparent),0 10px 15px -3px rgb(0 0 0 / .1),0 4px 6px -4px rgb(0 0 0 / .1)}.sd-act::part(base){border-radius:9999px}</style><ge-speed-dial id="sd-ctx" type="circle" radius="40" transition-delay="120" direction="down-right"><ge-speed-dial-menu label="Edit actions"><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Share"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Copy"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Move"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></ge-button></ge-speed-dial-item></ge-speed-dial-menu></ge-speed-dial><ge-speed-dial-context-trigger for="sd-ctx"><div style="height:8rem;width:100%;display:flex;align-items:center;justify-content:center;border:2px dashed var(--border);border-radius:var(--radius);color:var(--muted-foreground);cursor:context-menu">Right-click anywhere here</div></ge-speed-dial-context-trigger>`,
            },
            {
                title: 'Events',
                html: `<style>.sd-fab::part(base){border-radius:9999px;width:3rem;height:3rem;box-shadow:0 10px 15px -3px rgb(0 0 0 / .1),0 4px 6px -4px rgb(0 0 0 / .1)}.sd-fab::part(base):focus-visible{box-shadow:0 0 0 3px color-mix(in oklab,var(--ring) 50%,transparent),0 10px 15px -3px rgb(0 0 0 / .1),0 4px 6px -4px rgb(0 0 0 / .1)}.sd-act::part(base){border-radius:9999px}</style><div style="position:relative;width:100%;height:220px;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden"><ge-speed-dial id="sd-ev" type="linear" direction="up" style="position:absolute;left:50%;top:70%;margin:-1.5rem 0 0 -1.5rem"><ge-speed-dial-trigger><ge-button class="sd-fab" size="icon" aria-label="Open actions"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg></ge-button></ge-speed-dial-trigger><ge-speed-dial-menu label="Actions"><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></ge-button></ge-speed-dial-item><ge-speed-dial-item><ge-button class="sd-act" variant="secondary" size="icon-sm" aria-label="Share"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg></ge-button></ge-speed-dial-item></ge-speed-dial-menu></ge-speed-dial></div><p id="sd-ev-out" style="margin-top:.5rem;font-size:.875rem;color:var(--muted-foreground)">No events yet.</p>
<script>(() => {
  const dial = document.getElementById('sd-ev');
  const out = document.getElementById('sd-ev-out');
  for (const name of ['visible-change', 'shown', 'hidden']) dial.addEventListener(name, (e) => { out.textContent = name + (e.detail === null ? '' : ': ' + e.detail); });
})();</script>`,
            },
        ],
        api: [
            { name: 'ge-speed-dial type', type: '\'linear\' | \'circle\' | \'semi-circle\' | \'quarter-circle\'', default: '\'linear\'', description: 'Layout of the open menu. Arcs place items `radius` px from the trigger centre.' },
            { name: 'ge-speed-dial direction', type: 'string', default: '\'up\'', description: '`up`, `down`, `left`, `right` for linear and semi-circle (a diagonal falls back to up), the four diagonals for quarter-circle (a straight one falls back to up-right); ignored by circle.' },
            { name: 'ge-speed-dial radius', type: 'number', default: '80', description: 'Distance in px from the trigger centre to each item on an arc; also how far `showAt` keeps the menu from the viewport edges (`radius + 24`, plus an 8px gutter).' },
            { name: 'ge-speed-dial transition-delay', type: 'number', default: '80', description: 'Per-item stagger in ms; reversed on close. Opened at a point it is a fixed 30ms.' },
            { name: 'ge-speed-dial disabled', type: 'boolean', default: 'false', description: 'Blocks `toggle`, `show` and `showAt`. `hide` still works, and the projected trigger is not dimmed.' },
            { name: 'show() / hide() / toggle() / showAt(x, y)', type: 'method', default: '-', description: '`showAt` takes viewport coordinates, clamps them on screen, and defers opening one task so items jump to the new origin instead of animating across the screen.' },
            { name: 'visible-change / shown / hidden', type: 'event', default: '-', description: '`visible-change` carries the new state on every show and hide (a click outside calls hide, so `false` can repeat). `shown` follows an open; `hidden` follows every hide.' },
            { name: 'ge-speed-dial-trigger label', type: 'string', default: '\'Toggle speed dial\'', description: 'Accessible name while the wrapper is the button. A projected control (a `ge-button`) stays the one tab stop and carries its own `aria-label`. `::part(base){transform:none}` turns the quarter-turn off.' },
            { name: 'ge-speed-dial-menu label', type: 'string', default: '-', description: '`aria-label` of the item group; set it when several dials share a page. Closed, the group is `aria-hidden` and `inert`.' },
            { name: 'ge-speed-dial-item', type: 'element', default: '-', description: 'One action. Its place on the arc and its stagger come from its order in the menu.' },
            { name: 'ge-speed-dial-mask', type: 'element', default: '-', description: 'A dimmed, blurred scrim while open; Enter, Space or a click on it closes the dial.' },
            { name: 'ge-speed-dial-context-trigger for', type: 'string', default: '-', description: 'The id of the `ge-speed-dial` to open on right-click or long-press; without it, the dial this element sits in.' },
        ],
    },
    {
        id: 'dock',
        group: 'Actions',
        name: 'Dock',
        tag: 'ge-dock',
        description: 'A macOS-style dock: icons swell towards the pointer on a cosine curve. Mouse only; on touch it stays at rest.',
        examples: [
            {
                title: 'Custom items',
                note: 'Put `ge-dock-item`s in the dock. Hover for the label; `active` shows the running dot; click one to bounce it.',
                html: `<style>.app-a::part(base){background:linear-gradient(to bottom in oklab,oklch(74.6% .16 232.661),oklch(58.8% .158 241.966));color:#fff;border-radius:calc(var(--radius) + 4px)}.app-b::part(base){background:linear-gradient(to bottom in oklab,oklch(79.2% .209 151.711),oklch(62.7% .194 149.214));color:#fff;border-radius:calc(var(--radius) + 4px)}.app-c::part(base){background:var(--card);border:2px solid var(--border);border-radius:calc(var(--radius) + 4px)}</style><div style="position:relative;width:100%;height:200px;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden"><div style="position:absolute;inset-inline:0;bottom:1rem"><ge-dock id="dk1"><ge-dock-item active><ge-dock-label>Finder</ge-dock-label><ge-dock-icon class="app-a">F</ge-dock-icon></ge-dock-item><ge-dock-item><ge-dock-label>Messages</ge-dock-label><ge-dock-icon class="app-b">M</ge-dock-icon></ge-dock-item><ge-dock-item active><ge-dock-label>Photos</ge-dock-label><ge-dock-icon class="app-c">P</ge-dock-icon></ge-dock-item><ge-dock-item><ge-dock-label>Calendar</ge-dock-label><ge-dock-icon class="app-c">C</ge-dock-icon></ge-dock-item></ge-dock></div></div>
<script>(() => {
  for (const item of document.querySelectorAll('#dk1 ge-dock-item')) item.addEventListener('click', () => item.startBounce());
})();</script>`,
            },
            {
                title: 'Magnification and distance',
                note: '`magnification` is the peak width in px under the pointer (items rest at 40); `distance` is how far the influence reaches. Values below 40 shrink the hovered icon instead.',
                html: `<style>.app-a::part(base){background:linear-gradient(to bottom in oklab,oklch(74.6% .16 232.661),oklch(58.8% .158 241.966));color:#fff;border-radius:calc(var(--radius) + 4px)}.app-b::part(base){background:linear-gradient(to bottom in oklab,oklch(79.2% .209 151.711),oklch(62.7% .194 149.214));color:#fff;border-radius:calc(var(--radius) + 4px)}.app-c::part(base){background:var(--card);border:2px solid var(--border);border-radius:calc(var(--radius) + 4px)}</style><div style="position:relative;width:100%;height:200px;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden"><div style="position:absolute;inset-inline:0;bottom:1rem"><ge-dock magnification="90" distance="160"><ge-dock-item><ge-dock-label>Finder</ge-dock-label><ge-dock-icon class="app-a">F</ge-dock-icon></ge-dock-item><ge-dock-item><ge-dock-label>Messages</ge-dock-label><ge-dock-icon class="app-b">M</ge-dock-icon></ge-dock-item><ge-dock-item><ge-dock-label>Photos</ge-dock-label><ge-dock-icon class="app-c">P</ge-dock-icon></ge-dock-item></ge-dock></div></div>`,
            },
            {
                title: 'Simple mode',
                note: 'Set `items` and the dock builds the items. An entry with `href` renders a link, one with only `onClick` a button, and one with neither stays decorative. Ignored once any `ge-dock-item` is projected.',
                html: `<div style="position:relative;width:100%;height:160px;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden"><div style="position:absolute;inset-inline:0;bottom:1rem"><ge-dock id="dk2"></ge-dock></div></div><p id="dk2-out" style="margin-top:.5rem;font-size:.875rem;color:var(--muted-foreground)">Last activated: none</p>
<script>(() => {
  const out = document.getElementById('dk2-out');
  document.getElementById('dk2').items = [
    { label: 'Home', icon: '🏠', href: '#dock', active: true },
    { label: 'Search', icon: '🔍', onClick: () => { out.textContent = 'Last activated: Search'; } },
    { label: 'Trash', icon: '🗑️', onClick: () => { out.textContent = 'Last activated: Trash'; } },
  ];
})();</script>`,
            },
            {
                title: 'Vertical',
                note: '`position="left"` or `"right"` stacks a column; the magnification follows the pointer along Y.',
                html: `<div style="position:relative;width:100%;height:340px;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden"><div style="position:absolute;inset-block:0;inset-inline-start:1rem;display:flex;align-items:center"><ge-dock id="dk3" position="left" magnification="72" distance="120"></ge-dock></div></div>
<script>(() => {
  document.getElementById('dk3').items = [
    { label: 'Home', icon: '🏠', active: true },
    { label: 'Files', icon: '📁' },
    { label: 'Search', icon: '🔍' },
    { label: 'Trash', icon: '🗑️' },
  ];
})();</script>`,
            },
        ],
        api: [
            { name: 'magnification', type: 'number', default: '60', description: 'Peak item width in px directly under the pointer; items rest at 40px.' },
            { name: 'distance', type: 'number', default: '100', description: 'How far in px the pointer\'s influence reaches. The width falls off on a cosine curve from `magnification` at the centre to 40px at this distance.' },
            { name: 'position', type: '\'bottom\' | \'top\' | \'left\' | \'right\'', default: '\'bottom\'', description: 'Where the dock is anchored: sets alignment and axis (`left` and `right` stack a column and magnify along Y).' },
            { name: 'items', type: 'DockItemData[]', default: '[]', description: 'Simple mode: `{ label, icon, class, active, href, onClick }` per item. A property.' },
            { name: 'recalculateItemCenters()', type: 'method', default: '-', description: 'Re-caches each item\'s centre. It runs on every pointer entry; call it after adding or removing items while the pointer is already over the dock.' },
            { name: 'ge-dock-item active', type: 'boolean', default: 'false', description: 'The small "running" dot under the icon. Presentational.' },
            { name: 'ge-dock-item startBounce()', type: 'method', default: '-', description: 'Plays the 750ms bounce; ignored while one is running.' },
            { name: 'ge-dock-icon ::part(base)', type: 'css part', default: '-', description: 'The icon box; it fills the item, so it grows with the magnification. Style the background, border and radius here.' },
            { name: 'ge-dock-label', type: 'element', default: '-', description: 'The name bubble above an item, shown while the item is hovered. Hover-driven, so never on touch.' },
            { name: '::part(base)', type: 'css part', default: '-', description: 'On `ge-dock`, the bar (set a height, margin or background here).' },
        ],
    },
    {
        id: 'data-table',
        group: 'Display',
        name: 'Data table',
        tag: 'ge-data-table',
        description: 'A grid with a sticky header, sorting, paging, a footer, pinned columns and the full grid ARIA. It renders into its own light DOM, so cells hold your markup and elements. `columns` and `data` are properties; the data is never mutated.',
        examples: [
            {
                title: 'Sortable and paged',
                note: 'Click a header to sort (Shift-click with `enable-multi-sort` adds a column). The pager and the filter box work on the local rows; `page-change` and `sort-change` announce what the user did.',
                block: true,
                html: `<ge-data-table id="dt-basic" enable-multi-sort style="height:26rem"></ge-data-table>
<script>(() => {
  const table = document.getElementById('dt-basic');
  const names = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin', 'Frank', 'Grace', 'Heidi', 'Ivan', 'Judy'];
  const roles = ['Engineer', 'Designer', 'Manager', 'Analyst'];
  table.columns = [
    { accessorKey: 'id', header: 'ID', width: '80px' },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'role', header: 'Role' },
    { accessorKey: 'age', header: 'Age', width: '100px' },
  ];
  table.data = Array.from({ length: 36 }, (_, i) => ({ id: 'U-' + (i + 1), name: names[i % 10] + ' ' + (i + 1), role: roles[i % 4], age: 22 + ((i * 7) % 30) }));
})();</script>`,
            },
            {
                title: 'Pinned columns',
                note: '`pin: \'left\'` and `pin: \'right\'` mean the start and the end edge, so they follow `dir="rtl"`. Scroll sideways.',
                block: true,
                html: `<div style="max-width:32rem"><ge-data-table id="dt-pinned" show-toolbar="false" show-pagination="false"></ge-data-table></div>
<script>(() => {
  document.getElementById('dt-pinned').columns = [
    { accessorKey: 'id', header: 'ID', width: '90px', pin: 'left' },
    { accessorKey: 'name', header: 'Name', width: '220px', pin: 'left' },
    { accessorKey: 'email', header: 'Email', width: '320px' },
    { accessorKey: 'city', header: 'City', width: '220px' },
    { accessorKey: 'total', header: 'Total', width: '120px', pin: 'right' },
  ];
  document.getElementById('dt-pinned').data = [
    { id: 'U-1', name: 'Alice Martin', email: 'alice.martin@example.com', city: 'Lisbon', total: 1250 },
    { id: 'U-2', name: 'Bob Stone', email: 'bob.stone@example.com', city: 'Oslo', total: 980 },
    { id: 'U-3', name: 'Carol Diaz', email: 'carol.diaz@example.com', city: 'Madrid', total: 2310 },
  ];
})();</script>`,
            },
            {
                title: 'Footer and aggregates',
                note: 'A column\'s `footer` is text or a function of the rows; `aggregateFn` is `sum`, `avg`, `count`, `min`, `max` or your own. The footer reads every filtered row, not only the page. `colorScale` and `dataBar` format a cell by its value.',
                block: true,
                html: `<ge-data-table id="dt-footer" show-toolbar="false" show-pagination="false"></ge-data-table>
<script>(() => {
  const table = document.getElementById('dt-footer');
  table.columns = [
    { accessorKey: 'item', header: 'Item', footer: 'Total' },
    { accessorKey: 'qty', header: 'Qty', width: '120px', aggregateFn: 'sum' },
    { accessorKey: 'price', header: 'Price', width: '160px', aggregateFn: 'avg', colorScale: { min: 0, max: 100, from: 'transparent', to: '#3b82f6' } },
    { accessorKey: 'stock', header: 'Stock', width: '200px', dataBar: { min: 0, max: 100, color: '#22c55e', track: '#e5e7eb' } },
  ];
  table.data = [
    { item: 'Pen', qty: 12, price: 4, stock: 80 },
    { item: 'Notebook', qty: 5, price: 35, stock: 45 },
    { item: 'Backpack', qty: 2, price: 90, stock: 10 },
  ];
})();</script>`,
            },
            {
                title: 'A custom element in a cell',
                note: '`component` is a tag name: the element is created per cell, `componentInputs` are assigned as properties and `componentOutputs` listen for events. Anything a framework can expose as a custom element works the same way; `cellRenderer` returns a string, a Node or a lit template.',
                block: true,
                html: `<ge-data-table id="dt-component" show-toolbar="false" show-pagination="false"></ge-data-table>
<script>(() => {
  if (!customElements.get('demo-status')) {
    customElements.define('demo-status', class extends HTMLElement {
      set status(value) {
        this.textContent = value;
        this.style.cssText = 'display:inline-block;padding:0 .5rem;border-radius:9999px;font-size:.75rem;background:' + (value === 'Active' ? 'color-mix(in oklab, #22c55e 20%, transparent)' : 'var(--muted)');
      }
    });
  }
  const table = document.getElementById('dt-component');
  table.columns = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'status', header: 'Status', width: '160px', component: 'demo-status', componentInputs: (row) => ({ status: row.status }), componentOutputs: () => ({}) },
    { accessorKey: 'email', header: 'Email', cellRenderer: ({ row }) => { const a = document.createElement('a'); a.href = 'mailto:' + row.email; a.textContent = row.email; return a; } },
  ];
  table.data = [
    { name: 'Alice Martin', status: 'Active', email: 'alice@example.com' },
    { name: 'Bob Stone', status: 'Invited', email: 'bob@example.com' },
  ];
})();</script>`,
            },
            {
                title: 'Loading, skeleton and empty',
                note: '`loading` dims the rows under an overlay, `skeleton` replaces the whole table until the first data arrives, and no rows draw the empty state (or a child with `slot="empty"`).',
                block: true,
                html: `<div style="display:flex;flex-direction:column;gap:1.5rem">
  <ge-data-table id="dt-loading" loading show-toolbar="false" show-pagination="false"></ge-data-table>
  <ge-data-table skeleton skeleton-rows="3"></ge-data-table>
  <ge-data-table id="dt-empty" show-toolbar="false" show-pagination="false"><div slot="empty" style="padding:2rem;color:var(--muted-foreground)">Nothing here yet. Add a row to begin.</div></ge-data-table>
</div>
<script>(() => {
  const columns = [{ accessorKey: 'name', header: 'Name' }, { accessorKey: 'role', header: 'Role', width: '160px' }];
  const loading = document.getElementById('dt-loading');
  loading.columns = columns;
  loading.data = [{ name: 'Alice Martin', role: 'Engineer' }, { name: 'Bob Stone', role: 'Designer' }];
  document.getElementById('dt-empty').columns = columns;
})();</script>`,
            },
        ],
        api: [
            { name: 'columns', type: 'ColumnDef<T>[]', default: '[]', description: 'Property only. `accessorKey`, `header`, `width`, `minWidth`, `pin`, `footer`, `aggregateFn`, `component`, `cellRenderer`, `cellClassRules`, `colorScale`, `dataBar`, `iconSet`.' },
            { name: 'data', type: 'T[]', default: '[]', description: 'The rows. Never mutated: replace it to update. Writing it fires no event; a change the table makes fires `data-change`.' },
            { name: 'getRowId', type: '(row) => string', default: 'row.id', description: 'Row identity for keys and `data-row-id`. Without an `id` a per-object identity is used.' },
            { name: 'show-toolbar / show-pagination', type: 'boolean', default: 'true', description: '`="false"` hides the filter box and columns menu, or the pager.' },
            { name: 'show-row-borders / show-column-borders', type: 'boolean', default: 'true', description: 'Cell borders.' },
            { name: 'show-footer', type: '\'auto\' | boolean', default: '\'auto\'', description: 'Auto shows the footer when a column has a `footer` or an `aggregateFn`.' },
            { name: 'local-sorting / local-pagination / local-filtering', type: 'boolean', default: 'true', description: 'Set one to `false` for server data: the table still emits, and `total` sizes the pager.' },
            { name: 'enable-multi-sort / max-multi-sort-columns', type: 'boolean / number', default: 'false / 3', description: 'Shift-click a header to add to the sort chain; a badge shows the priority.' },
            { name: 'loading / skeleton / skeleton-rows', type: 'boolean / number', default: 'false / 5', description: 'The overlay, and the first-paint placeholder.' },
            { name: 'locale / theme', type: 'string', default: '-', description: 'Language id (`en` is built in) and a colour preset name.' },
            { name: 'sortState, multiSortState, paginationState, columnVisibility, ...', type: 'two-way states', default: '-', description: 'Properties you may write; the table fires `*-change` only for changes it makes itself.' },
            { name: 'sort-change, multi-sort-change, page-change, filter-change, query', type: 'events', default: '-', description: '`query` carries the whole server request, once per change.' },
            { name: 'slot toolbar-start / toolbar-end / empty / loading / footer', type: 'slots', default: '-', description: 'Light-DOM children with that `slot` are moved into place once and kept.' },
            { name: 'ge-data-table [data-slot=...]', type: 'css hooks', default: '-', description: 'Style hooks (`table-cell`, `table-head`, `cell-formatted`, ...); also `--ge-dt-cell-bg`, `--ge-dt-header-bg`, `--ge-dt-pin-shadow`. Classes from `cellClassRules` land on `[data-slot=cell-formatted]`.' },
        ],
    },
    {
        id: 'file-upload',
        group: 'Form inputs',
        name: 'File upload',
        tag: 'ge-file-upload',
        description: 'A dropzone that validates and queues files, and can crop images first. It never transfers anything: upload on `file-added` and report back with `updateFileProgress`.',
        examples: [
            {
                title: 'Images and PDFs, up to five',
                note: '`accept` takes native syntax (extensions, `image/*`, exact MIME) and is re-checked on drop. `max-size` is in bytes and appears in the caption.',
                html: `<div style="width:100%;max-width:28rem"><ge-file-upload accept="image/*,.pdf" max-files="5" max-size="5242880"></ge-file-upload></div>`,
            },
            {
                title: 'A cap, and the refusals',
                note: 'Refused files never enter the queue and nothing renders them, so listen to `file-error` yourself.',
                html: `<div style="width:100%;max-width:28rem;display:flex;flex-direction:column;gap:.5rem"><ge-file-upload id="fu1" max-files="2"></ge-file-upload><p style="margin:0;font-size:.875rem;color:var(--muted-foreground)">At most two files; drop three to see one refused.</p><p style="margin:0;font-size:.875rem;font-weight:500">Refused files</p><ul id="fu1-out" style="margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:.25rem;font-size:.875rem;color:var(--destructive)"></ul><p id="fu1-none" style="margin:0;font-size:.875rem;color:var(--muted-foreground)">None yet.</p></div>
<script>(() => {
  const list = document.getElementById('fu1-out');
  const none = document.getElementById('fu1-none');
  document.getElementById('fu1').addEventListener('file-error', (event) => {
    none.hidden = true;
    const li = document.createElement('li');
    li.textContent = event.detail.file.name + ' — ' + event.detail.error;
    list.prepend(li);
    while (list.children.length > 5) list.lastChild.remove();
  });
})();</script>`,
            },
            {
                title: 'Crop images first',
                note: '`crop-images` holds each image in an inline crop step; `crop-aspect="1"` locks it square. Drag the box or its corner, or use the arrows and +/-. Non-images skip the step.',
                html: `<div style="width:100%;max-width:28rem"><ge-file-upload crop-images crop-aspect="1" accept="image/*"></ge-file-upload></div>`,
            },
            {
                title: 'Reporting upload progress',
                note: 'The component queues; you transfer. Each queued item has an `id` to pass to `updateFileProgress` (0-99 uploading, 100 complete) and `setFileError`. This demo fakes the transfer.',
                html: `<div style="width:100%;max-width:28rem"><ge-file-upload id="fu2"></ge-file-upload></div>
<script>(() => {
  const el = document.getElementById('fu2');
  el.addEventListener('file-added', (event) => {
    const item = event.detail;
    let progress = 0;
    const timer = setInterval(() => {
      progress += 10;
      if (item.file.name.includes('fail') && progress >= 50) {
        clearInterval(timer);
        el.setFileError(item.id, 'Upload failed: server refused the file');
        return;
      }
      el.updateFileProgress(item.id, Math.min(progress, 100));
      if (progress >= 100) clearInterval(timer);
    }, 250);
  });
})();</script>`,
            },
            {
                title: 'Folders and a single file',
                note: '`allow-directories` accepts dropped folders (walked recursively) and puts the picker in folder mode. `multiple="false"` limits one picker selection to a single file.',
                html: `<div style="width:100%;max-width:28rem;display:flex;flex-direction:column;gap:1rem"><ge-file-upload allow-directories></ge-file-upload><ge-file-upload multiple="false" max-files="1"></ge-file-upload></div>`,
            },
            {
                title: 'Hebrew (RTL)',
                note: '`locale` is an id or a dictionary object; the layout follows its direction.',
                html: `<div style="width:100%;max-width:28rem"><ge-file-upload locale="he" max-size="10485760"></ge-file-upload></div>`,
            },
        ],
        api: [
            { name: 'accept', type: 'string', default: "''", description: 'Comma-separated filter in native `accept` syntax; rejected files fire `file-error` only.' },
            { name: 'multiple', type: 'boolean', default: 'true', description: 'Native input `multiple`. Only limits one picker selection; use `max-files` to cap the list. `multiple="false"` turns it off.' },
            { name: 'max-files', type: 'number', default: 'none', description: 'Cap on queued files, counting images waiting to be cropped. The dropzone disables itself while full.' },
            { name: 'max-size', type: 'number', default: 'none', description: 'Per-file ceiling in bytes; shown in the caption.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Blocks picking and dropping; queued files stay removable.' },
            { name: 'allow-directories', type: 'boolean', default: 'false', description: 'Accept dropped folders (walked recursively) and switch the picker to folder mode. Files are still validated one by one.' },
            { name: 'crop-images', type: 'boolean', default: 'false', description: 'Hold each image in an inline crop step before it is queued.' },
            { name: 'crop-aspect', type: 'number', default: 'none', description: 'Lock the crop box to a width / height ratio.' },
            { name: 'locale', type: 'string | FileUploadLocale', default: "''", description: 'Locale id or dictionary; defaults to the page `lang`, then `en`.' },
            { name: 'files', type: 'FileUploadItem[]', default: '[]', description: 'The queue, read only: `{ file, id, progress, status, error, preview }`.' },
            { name: 'addFiles(files)', type: 'method', default: '-', description: 'Validate and queue files from script.' },
            { name: 'removeFile(id)', type: 'method', default: '-', description: 'Remove one queued file, revoking its preview.' },
            { name: 'clearFiles()', type: 'method', default: '-', description: 'Empty the queue.' },
            { name: 'updateFileProgress(id, n)', type: 'method', default: '-', description: '0-99 shows the bar; 100 or more marks the file complete.' },
            { name: 'setFileError(id, message)', type: 'method', default: '-', description: 'Mark a file failed and show the message.' },
            { name: 'openFilePicker()', type: 'method', default: '-', description: 'Open the OS dialog (needs a user gesture).' },
            { name: 'applyCrop() / skipCrop() / cancelCrop() / setCropRect(rect)', type: 'method', default: '-', description: 'Drive the crop step from your own UI. The rect is in source-image pixels.' },
            { name: 'files-change', type: 'event', default: '-', description: 'After any add, remove or clear; `detail` is the whole queue.' },
            { name: 'file-added / file-removed', type: 'event', default: '-', description: '`detail` is the queue item.' },
            { name: 'file-error', type: 'event', default: '-', description: '`detail` is `{ file, error }` with a localised message.' },
            { name: 'cropped', type: 'event', default: '-', description: '`detail` is `{ original, file, rect }`.' },
            { name: '::part(dropzone)', type: 'css part', default: '-', description: 'The dashed drop target.' },
        ],
    },
    {
        id: 'tree-context-menu',
        group: 'Overlays',
        name: 'Tree context menu',
        tag: 'ge-tree-context-menu',
        description: 'Wrap a `ge-tree` so that a right-click, the context-menu key or a long press on a node opens a `ge-context-menu` at the pointer, with the node it hit as the menu\'s `data`.',
        examples: [
            {
                title: 'A file explorer',
                note: 'The menu is one element shared by every node. `node-context-menu` fires first, so the handler can shape the menu for the node (here: folders get New file / New folder, files get Open). With the keyboard, move to a node with the arrows and press the context-menu key (or Shift+F10).',
                html: `<div style="display:flex;flex-wrap:wrap;gap:1rem;align-items:flex-start">
  <div style="width:100%;max-width:20rem;border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);padding:1rem">
    <ge-context-menu id="tcm-menu">
      <ge-context-menu-content style="width:14rem">
        <ge-context-menu-label id="tcm-label"></ge-context-menu-label>
        <ge-context-menu-separator></ge-context-menu-separator>
        <ge-context-menu-item data-for="folder">New file<ge-context-menu-shortcut>⌘N</ge-context-menu-shortcut></ge-context-menu-item>
        <ge-context-menu-item data-for="folder">New folder</ge-context-menu-item>
        <ge-context-menu-item data-for="file">Open<ge-context-menu-shortcut>⏎</ge-context-menu-shortcut></ge-context-menu-item>
        <ge-context-menu-item>Rename<ge-context-menu-shortcut>F2</ge-context-menu-shortcut></ge-context-menu-item>
        <ge-context-menu-item>Duplicate</ge-context-menu-item>
        <ge-context-menu-separator></ge-context-menu-separator>
        <ge-context-menu-item variant="destructive">Delete<ge-context-menu-shortcut>⌘⌫</ge-context-menu-shortcut></ge-context-menu-item>
      </ge-context-menu-content>
      <ge-tree-context-menu id="tcm">
        <ge-tree id="tcm-tree" selectable="single" initial-expand-depth="2"></ge-tree>
      </ge-tree-context-menu>
    </ge-context-menu>
  </div>
  <dl id="tcm-out" style="margin:0;display:grid;grid-template-columns:auto 1fr;gap:.25rem .75rem;font-size:.75rem">
    <dt style="color:var(--muted-foreground)">Last node</dt><dd id="tcm-node" style="margin:0">none yet</dd>
  </dl>
</div>
<script>(() => {
  const tree = document.getElementById('tcm-tree');
  tree.data = [
    { key: 'src', label: 'src', icon: '📁', children: [
      { key: 'app', label: 'app', icon: '📁', children: [{ key: 'main', label: 'main.ts', icon: '📄' }, { key: 'styles', label: 'styles.css', icon: '📄' }] },
      { key: 'index', label: 'index.html', icon: '📄' },
    ] },
    { key: 'docs', label: 'docs', icon: '📁', children: [{ key: 'guide', label: 'guide.md', icon: '📄' }] },
    { key: 'readme', label: 'README.md', icon: '📄' },
  ];
  const menu = document.getElementById('tcm-menu');
  const wrapper = document.getElementById('tcm');
  wrapper.addEventListener('node-context-menu', (event) => {
    const { node } = event.detail;
    const folder = node.element.hasAttribute('has-nested') || node.element.querySelector(':scope > ge-tree-item') !== null;
    document.getElementById('tcm-label').textContent = (folder ? 'Folder' : 'File') + ' — ' + node.label;
    for (const row of menu.querySelectorAll('[data-for]')) row.hidden = row.dataset.for !== (folder ? 'folder' : 'file');
    document.getElementById('tcm-node').textContent = node.label + ' (key ' + node.key + ', ' + (node.expanded ? 'expanded' : 'collapsed') + (node.selected ? ', selected' : '') + ')';
  });
})();</script>`,
            },
            {
                title: 'Disabled',
                note: '`disabled` leaves the gesture to the browser: no menu and no event.',
                html: `<div style="max-width:20rem;border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);padding:1rem">
  <ge-context-menu><ge-context-menu-content><ge-context-menu-item>Never shown</ge-context-menu-item></ge-context-menu-content>
    <ge-tree-context-menu disabled>
      <ge-tree selectable="single"><ge-tree-item value="a"><ge-tree-label>Right-click me: the browser's own menu opens</ge-tree-label></ge-tree-item></ge-tree>
    </ge-tree-context-menu>
  </ge-context-menu>
</div>`,
            },
        ],
        api: [
            { name: 'for', type: 'string', default: "''", description: 'Id of the `ge-context-menu` to open. Left empty, the one this element sits in.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Leaves the gesture to the browser: no menu, no event.' },
            { name: 'node-context-menu', type: 'event', default: '-', description: '`detail` is `{ node, event }`; `node` is `{ key, label, expanded, selected, element }`, the same object the menu gets as `data`. `event` is the `contextmenu` event, or the `touchstart` that began a long press.' },
            { name: 'menu.data', type: 'unknown', default: '-', description: 'On the `ge-context-menu`: the node that opened it.' },
        ],
    },
    {
        id: 'tree-select',
        group: 'Form inputs',
        name: 'Tree select',
        tag: 'ge-tree-select',
        description: 'A select whose options are the nodes of a tree. It is form-associated: the selected key is submitted under `name`.',
        examples: [
            {
                title: 'Data-driven',
                note: 'Set `nodes` and it draws its own combobox button and a single-select tree in a popover as wide as the button. Opening puts the tree\'s focus on the selected node.',
                html: `<div style="width:100%;max-width:20rem"><ge-tree-select id="ts1" placeholder="Pick a location"></ge-tree-select></div>
<p id="ts1-out" style="font-size:.875rem;color:var(--muted-foreground)">Selected: none</p>
<script>(() => {
  const el = document.getElementById('ts1');
  el.nodes = [
    { key: 'eu', label: 'Europe', children: [{ key: 'de', label: 'Germany' }, { key: 'fr', label: 'France' }, { key: 'es', label: 'Spain' }] },
    { key: 'na', label: 'North America', children: [{ key: 'us', label: 'United States' }, { key: 'ca', label: 'Canada' }] },
    { key: 'other', label: 'Elsewhere' },
  ];
  el.addEventListener('selection-change', (event) => {
    document.getElementById('ts1-out').textContent = 'Selected: ' + (event.detail[0] ?? 'none');
  });
})();</script>`,
            },
            {
                title: 'A preselected value, disabled and in a form',
                note: '`value` is a node key. With `name` the key is part of the form data.',
                html: `<form id="ts-form" style="display:flex;flex-direction:column;gap:.75rem;max-width:20rem">
  <ge-tree-select id="ts2" name="region" value="fr"></ge-tree-select>
  <ge-tree-select id="ts3" value="us" disabled></ge-tree-select>
  <div style="display:flex;gap:.5rem;align-items:center"><ge-button type="submit">Submit</ge-button><ge-button type="reset" variant="outline">Reset</ge-button></div>
  <p id="ts2-out" style="margin:0;font-size:.875rem;color:var(--muted-foreground)">Form data: region=fr</p>
</form>
<script>(() => {
  const nodes = [
    { key: 'eu', label: 'Europe', children: [{ key: 'de', label: 'Germany' }, { key: 'fr', label: 'France' }] },
    { key: 'na', label: 'North America', children: [{ key: 'us', label: 'United States' }, { key: 'ca', label: 'Canada' }] },
  ];
  for (const id of ['ts2', 'ts3']) document.getElementById(id).nodes = nodes;
  const form = document.getElementById('ts-form');
  const out = document.getElementById('ts2-out');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    out.textContent = 'Form data: ' + new URLSearchParams(new FormData(form)).toString();
  });
})();</script>`,
            },
            {
                title: 'Custom trigger and content',
                note: 'Leave `nodes` empty and project a `ge-popover-trigger` and a `ge-popover-content` (optionally inside `ge-tree-select-trigger` / `-content`). Call `select(key)` from your own content; it sets the value, fires `selection-change` and closes.',
                html: `<ge-tree-select id="ts4">
  <ge-tree-select-trigger><ge-popover-trigger><ge-button variant="outline">Choose a size</ge-button></ge-popover-trigger></ge-tree-select-trigger>
  <ge-tree-select-content><ge-popover-content align="start" strategy="fixed">
    <div style="display:flex;flex-direction:column;gap:.25rem">
      <ge-button variant="ghost" data-pick="s">Small</ge-button><ge-button variant="ghost" data-pick="m">Medium</ge-button><ge-button variant="ghost" data-pick="l">Large</ge-button>
    </div>
  </ge-popover-content></ge-tree-select-content>
</ge-tree-select>
<p id="ts4-out" style="font-size:.875rem;color:var(--muted-foreground)">Picked: none</p>
<script>(() => {
  const el = document.getElementById('ts4');
  for (const button of el.querySelectorAll('[data-pick]')) button.addEventListener('click', () => el.select(button.dataset.pick));
  el.addEventListener('selection-change', (event) => { document.getElementById('ts4-out').textContent = 'Picked: ' + (event.detail[0] ?? 'none'); });
})();</script>`,
            },
            {
                title: 'Hebrew (RTL)',
                html: `<div style="width:100%;max-width:20rem"><ge-tree-select id="ts5" locale="he"></ge-tree-select></div>
<script>document.getElementById('ts5').nodes = [{ key: 'a', label: 'אירופה', children: [{ key: 'b', label: 'גרמניה' }] }, { key: 'c', label: 'אחר' }];</script>`,
            },
        ],
        api: [
            { name: 'nodes', type: 'TreeNode[]', default: '[]', description: '`{ key, label, icon?, children?, disabled?, data? }`. Non-empty switches on the built-in trigger and tree.' },
            { name: 'value', type: 'string', default: 'none', description: 'Key of the selected node. Setting it does not fire events.' },
            { name: 'name', type: 'string', default: "''", description: 'Form field name; the selected key is submitted. A form reset restores the starting value.' },
            { name: 'placeholder', type: 'string', default: "'Select...'", description: 'Text while nothing is selected.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Disables the built-in trigger; a fieldset also disables it.' },
            { name: 'locale', type: 'string | CommonLocale', default: "''", description: 'Locale id or dictionary; defaults to the page `lang`, then `en`.' },
            { name: 'open / show() / hide()', type: 'boolean / method', default: 'false', description: 'It is a `ge-popover`, so these work as they do there.' },
            { name: 'select(key)', type: 'method', default: '-', description: 'Pick a node from custom content (`null` clears). Sets the value, fires `selection-change` and `change`, closes. Ignores `disabled`.' },
            { name: 'selection-change', type: 'event', default: '-', description: '`detail` is the selected keys, at most one (empty when cleared).' },
            { name: 'change', type: 'event', default: '-', description: 'Fires with it, as for any form field.' },
            { name: 'open-change', type: 'event', default: '-', description: 'The user opened or closed the popover; `detail` is the new state.' },
            { name: '::part(trigger)', type: 'css part', default: '-', description: 'The combobox button (built-in trigger).' },
        ],
    },
    {
        id: 'sortable',
        group: 'Layout',
        name: 'Sortable',
        tag: 'ge-sortable',
        description: 'A list you reorder by dragging, with the keyboard, or between lists. Write `ge-sortable-item`s yourself, or set `items` and `renderItem` and let it render them.',
        examples: [
            {
                title: 'Vertical list',
                note: 'Drag a row, or focus it and press Space, then the arrows (Home and End jump to the ends), then Space again; Escape puts it back. Each step is announced to screen readers. The list fires `reorder` with where the row came from and went.',
                html: `<style>.sx-card{box-sizing:border-box;width:100%;padding:.5rem .75rem;border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);background:var(--card);color:var(--card-foreground);font-size:.875rem}</style>
<ge-sortable id="sx1" style="width:100%;max-width:20rem">
  <ge-sortable-item><div class="sx-card">Write the spec</div></ge-sortable-item>
  <ge-sortable-item><div class="sx-card">Review the pull request</div></ge-sortable-item>
  <ge-sortable-item><div class="sx-card">Ship it</div></ge-sortable-item>
  <ge-sortable-item><div class="sx-card">Write the announcement</div></ge-sortable-item>
</ge-sortable>
<p id="sx1-out" style="font-size:.875rem;color:var(--muted-foreground)">Drag a row.</p>
<script>document.getElementById('sx1').addEventListener('reorder', (event) => {
  const { from, to, item } = event.detail;
  document.getElementById('sx1-out').textContent = item.textContent.trim() + ': ' + from.index + ' to ' + to.index;
});</script>`,
            },
            {
                title: 'Horizontal',
                html: `<ge-sortable orientation="horizontal" style="width:100%;max-width:34rem">
  <ge-sortable-item><div class="sx-card" style="width:7rem;text-align:center">Mon</div></ge-sortable-item>
  <ge-sortable-item><div class="sx-card" style="width:7rem;text-align:center">Tue</div></ge-sortable-item>
  <ge-sortable-item><div class="sx-card" style="width:7rem;text-align:center">Wed</div></ge-sortable-item>
  <ge-sortable-item><div class="sx-card" style="width:7rem;text-align:center">Thu</div></ge-sortable-item>
</ge-sortable>`,
            },
            {
                title: 'Handle only',
                note: 'With `handle-only` a row drags from its `ge-sortable-handle` (or any `[data-sortable-handle]`), so its text stays selectable. Keyboard reordering still works from the row.',
                html: `<ge-sortable handle-only style="width:100%;max-width:20rem">
  <ge-sortable-item><ge-sortable-handle><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--muted-foreground)"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg></ge-sortable-handle><div class="sx-card">Alpha</div></ge-sortable-item>
  <ge-sortable-item><ge-sortable-handle><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--muted-foreground)"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg></ge-sortable-handle><div class="sx-card">Beta</div></ge-sortable-item>
  <ge-sortable-item><ge-sortable-handle><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--muted-foreground)"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg></ge-sortable-handle><div class="sx-card">Gamma</div></ge-sortable-item>
</ge-sortable>`,
            },
            {
                title: 'Disabled',
                html: `<ge-sortable disabled style="width:100%;max-width:20rem">
  <ge-sortable-item><div class="sx-card">Locked one</div></ge-sortable-item>
  <ge-sortable-item><div class="sx-card">Locked two</div></ge-sortable-item>
</ge-sortable>`,
            },
            {
                title: 'Data-driven',
                note: 'Set `items` and `renderItem`; every reorder arrives as a new array in `items-change` (your array is never mutated) and is written back to `items`. `trackBy` keeps each row\'s node, so the move animates.',
                html: `<ge-sortable id="sx2" style="width:100%;max-width:20rem"></ge-sortable>
<p id="sx2-out" style="font-size:.875rem;color:var(--muted-foreground)"></p>
<script>(() => {
  const el = document.getElementById('sx2');
  const out = document.getElementById('sx2-out');
  el.renderItem = (task) => { const card = document.createElement('div'); card.className = 'sx-card'; card.textContent = task.title; return card; };
  el.trackBy = (task) => task.id;
  el.items = [{ id: 1, title: 'Plan' }, { id: 2, title: 'Build' }, { id: 3, title: 'Test' }, { id: 4, title: 'Release' }];
  el.addEventListener('items-change', (event) => { out.textContent = event.detail.map((task) => task.title).join(' > '); });
  out.textContent = el.items.map((task) => task.title).join(' > ');
})();</script>`,
            },
            {
                title: 'Between lists',
                note: 'Lists that share a `group` exchange rows by drag, or with Tab and Shift+Tab while a row is lifted. `accepts` on the receiving list returns a boolean or `{ ok, reason }`; a refused drop sets `data-reject` on the list, fires `drop-rejected` and is announced. Here Done takes at most three rows.',
                html: `<style>.sx-col{flex:1;min-width:11rem;min-height:9rem;padding:.5rem;border:1px dashed var(--border);border-radius:var(--radius)}.sx-col[data-receiving]{background:var(--accent)}.sx-col[data-reject]{border-color:var(--destructive)}.sx-col h4{margin:0 0 .5rem;font-size:.75rem;color:var(--muted-foreground)}</style>
<div style="display:flex;gap:1rem;flex-wrap:wrap;max-width:38rem">
  <ge-sortable id="sx3a" class="sx-col" group="board" list-id="todo">
    <h4 slot="header">To do</h4>
    <ge-sortable-item><div class="sx-card">Design</div></ge-sortable-item>
    <ge-sortable-item><div class="sx-card">Prototype</div></ge-sortable-item>
    <ge-sortable-item><div class="sx-card">Research</div></ge-sortable-item>
    <ge-sortable-item><div class="sx-card">Estimate</div></ge-sortable-item>
  </ge-sortable>
  <ge-sortable id="sx3b" class="sx-col" group="board" list-id="done">
    <h4 slot="header">Done (max 3)</h4>
    <span slot="empty" style="font-size:.875rem;color:var(--muted-foreground)">Drop rows here</span>
  </ge-sortable>
</div>
<p id="sx3-out" style="font-size:.875rem;color:var(--muted-foreground)"></p>
<script>(() => {
  const done = document.getElementById('sx3b');
  done.accepts = (item, ctx) => done.querySelectorAll(':scope > ge-sortable-item').length < 3 || { ok: false, reason: 'Done is full' };
  const out = document.getElementById('sx3-out');
  document.getElementById('sx3a').addEventListener('drop-rejected', (event) => { out.textContent = 'Rejected: ' + event.detail.reason; });
  for (const id of ['sx3a', 'sx3b']) document.getElementById(id).addEventListener('reorder', (event) => { out.textContent = event.detail.from.listId + ' > ' + event.detail.to.listId; });
})();</script>`,
            },
            {
                title: 'Land effects',
                note: '`landEffect(item, from, to)` returns a built-in name from `SORTABLE_LAND_EFFECTS` (flash, pulse, shake, glow) or any class of yours, played on the row after it lands. The built-ins are skipped under reduced motion.',
                html: `<ge-sortable id="sx4" style="width:100%;max-width:20rem">
  <ge-sortable-item><div class="sx-card">Flash</div></ge-sortable-item>
  <ge-sortable-item><div class="sx-card">Pulse</div></ge-sortable-item>
  <ge-sortable-item><div class="sx-card">Glow</div></ge-sortable-item>
</ge-sortable>
<script>document.getElementById('sx4').landEffect = (item) => 'ge-sortable-land-' + item.textContent.trim().toLowerCase();</script>`,
            },
            {
                title: 'Custom ghost and placeholder',
                note: 'A `ge-sortable-ghost` replaces the faded copy shown at the drop gap and a `ge-sortable-placeholder` replaces the dashed box left at the lift origin. Their content is copied.',
                html: `<ge-sortable style="width:100%;max-width:20rem">
  <ge-sortable-item><div class="sx-card">One</div></ge-sortable-item>
  <ge-sortable-item><div class="sx-card">Two</div></ge-sortable-item>
  <ge-sortable-item><div class="sx-card">Three</div></ge-sortable-item>
  <ge-sortable-ghost><div style="height:2.5rem;border:2px solid var(--primary);border-radius:var(--radius);box-sizing:border-box"></div></ge-sortable-ghost>
  <ge-sortable-placeholder><div style="height:100%;background:repeating-linear-gradient(45deg,var(--muted),var(--muted) 6px,transparent 6px,transparent 12px);border-radius:var(--radius)"></div></ge-sortable-placeholder>
</ge-sortable>`,
            },
            {
                title: 'Nested outline',
                note: 'A list inside a row is its own list. Rows drag within it, or out to the list around it when the pointer leaves it. `reorder` carries the `path` of ids from the outermost list down.',
                html: `<ge-sortable group="outline" list-id="root" style="width:100%;max-width:22rem">
  <ge-sortable-item style="flex-direction:column;align-items:stretch"><div class="sx-card">Fruit</div>
    <ge-sortable group="outline" list-id="fruit" style="padding-inline-start:1.5rem;min-height:1.5rem">
      <ge-sortable-item><div class="sx-card">Apple</div></ge-sortable-item>
      <ge-sortable-item><div class="sx-card">Pear</div></ge-sortable-item>
    </ge-sortable>
  </ge-sortable-item>
  <ge-sortable-item style="flex-direction:column;align-items:stretch"><div class="sx-card">Vegetables</div>
    <ge-sortable group="outline" list-id="veg" style="padding-inline-start:1.5rem;min-height:1.5rem">
      <ge-sortable-item><div class="sx-card">Leek</div></ge-sortable-item>
    </ge-sortable>
  </ge-sortable-item>
</ge-sortable>`,
            },
        ],
        api: [
            { name: 'items / renderItem', type: 'unknown[] / (item, index) => unknown', default: '[] / none', description: 'Data mode. `renderItem` returns a Lit template, a node or text; every reorder is written back to `items` as a new array.' },
            { name: 'trackBy', type: '(item, index) => unknown', default: 'the item', description: 'Key for data mode, so rows keep their nodes across changes.' },
            { name: 'orientation', type: "'vertical' | 'horizontal'", default: "'vertical'", description: 'Axis the rows flow along; picks the arrow keys and the pointer axis.' },
            { name: 'handle-only', type: 'boolean', default: 'false', description: 'Only a `ge-sortable-handle` (or `[data-sortable-handle]`) starts a pointer drag.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Blocks drags, lifts and incoming drops (rejected with reason `disabled`).' },
            { name: 'list-id', type: 'string', default: "'sortable-N'", description: 'Id reported in events and announced when a row changes list.' },
            { name: 'group', type: 'string', default: "''", description: 'Lists with the same group exchange rows.' },
            { name: 'accepts', type: 'boolean | (item, ctx) => boolean | { ok, reason? }', default: 'true', description: 'Gate for rows arriving from a peer; set on the receiving list.' },
            { name: 'auto-scroll', type: 'boolean', default: 'true', description: 'Scroll the nearest scrollable ancestor while the pointer is near its edge; `auto-scroll="false"` turns it off.' },
            { name: 'ariaItemLabel', type: '(item, index) => string', default: "'item N'", description: 'The spoken name of a row.' },
            { name: 'positionClass', type: '(item, index, total, listId) => string', default: 'none', description: 'Class names put on each row by position.' },
            { name: 'landEffect', type: '(item, from, to) => string | null', default: 'none', description: 'A `SORTABLE_LAND_EFFECTS` name or any class, played after a successful reorder.' },
            { name: 'locale', type: 'string | SortableLocale', default: "''", description: 'Locale id or object for the announcements; defaults to the page `lang`, then `en`.' },
            { name: 'reorder', type: 'event', default: '-', description: '`detail` is `{ from, to, item }`, each end `{ listId, index, path }`. Not fired when Escape puts a row back.' },
            { name: 'items-change', type: 'event', default: '-', description: 'Data mode: `detail` is the new array.' },
            { name: 'drop-rejected', type: 'event', default: '-', description: '`detail` is `{ item, fromListId, toListId, toIndex, reason }`.' },
            { name: 'item-enter / item-leave', type: 'event', default: '-', description: 'On the receiving list while a foreign row hovers it.' },
            { name: 'data-receiving / data-reject', type: 'attribute', default: '-', description: 'On the list while a foreign row hovers it, and the refusal reason while `accepts` says no.' },
            { name: 'slots', type: 'slot', default: '-', description: 'Default (rows), `header`, `footer`, `empty`.' },
        ],
    },
    {
        id: 'kanban',
        group: 'Apps & tools',
        name: 'Kanban',
        tag: 'ge-kanban',
        description: 'A board of columns and cards. Drag a card between columns (on touch, hold a card until it lifts, then drag it; let go without moving for its menu); right-click or long-press elsewhere for menus; Mod+Z undoes. The board is controlled: it reports every change as an event and waits for you to apply it.',
        examples: [
            {
                title: 'Data-driven',
                note: 'Set `columns` and `cards`. Each change leaves as an event carrying the next array, or the data to add, so apply it yourself (the demo pages share one small `geKanbanWire` helper for that, shown here in full for the first example). Right-click a card, a column header or empty board space; Ctrl+Z and Ctrl+Shift+Z undo and redo.',
                html: `<div style="height:36rem;overflow:auto;background:color-mix(in srgb, var(--muted) 30%, transparent);border:1px solid var(--border);border-radius:calc(var(--radius) + 4px)">
  <ge-kanban id="kb1"></ge-kanban>
</div>
<script>(() => {
  const board = document.getElementById('kb1');
  const columns = [
    { id: 'backlog', title: 'Backlog', order: 0 },
    { id: 'in-progress', title: 'In Progress', order: 1 },
    { id: 'review', title: 'In Review', order: 2 },
    { id: 'done', title: 'Done', order: 3 },
  ];
  const cards = [
    { id: 'card-1', columnId: 'backlog', title: 'Set up CI/CD pipeline', description: 'Configure GitHub Actions for automated testing and deployment.', priority: 'high', labels: [{ text: 'DevOps', color: '#6366f1' }], assignees: [{ name: 'Alice Chen' }], order: 0 },
    { id: 'card-2', columnId: 'backlog', title: 'Design token refresh', description: 'Update color palette and spacing tokens to match the new brand guidelines.', priority: 'medium', labels: [{ text: 'Design', color: '#ec4899' }], assignees: [{ name: 'Bob Martin' }], order: 1 },
    { id: 'card-3', columnId: 'in-progress', title: 'Implement Kanban board', description: 'Drag and drop, context menus and undo.', priority: 'urgent', labels: [{ text: 'Feature', color: '#22c55e' }, { text: 'UI', color: '#3b82f6' }], assignees: [{ name: 'Alice Chen' }, { name: 'Carol Diaz' }], order: 0 },
    { id: 'card-4', columnId: 'review', title: 'Accessibility audit', description: 'Check contrast, focus order and screen reader names.', priority: 'low', labels: [{ text: 'A11y', color: '#f97316' }], assignees: [{ name: 'Bob Martin' }], order: 0 },
    { id: 'card-5', columnId: 'done', title: 'Release v1.8.0', priority: 'medium', labels: [{ text: 'Release', color: '#8b5cf6' }], order: 0 },
  ];
  board.columns = columns;
  board.cards = cards;
  const on = (name, handler) => board.addEventListener(name, (event) => handler(event.detail));
  on('cards-change', (next) => (board.cards = next));
  on('columns-change', (next) => (board.columns = next));
  on('card-added', (card) => {
    const order = board.cards.filter((c) => c.columnId === card.columnId).length;
    board.cards = [...board.cards, { ...card, id: 'card-' + Date.now(), order }];
  });
  on('card-updated', (card) => (board.cards = board.cards.map((c) => (c.id === card.id ? card : c))));
  on('column-added', (column) => (board.columns = [...board.columns, { ...column, id: 'col-' + Date.now() }]));
  on('column-updated', (column) => (board.columns = board.columns.map((c) => (c.id === column.id ? column : c))));
  on('column-deleted', ({ columnId, moveCardsTo }) => {
    board.columns = board.columns.filter((c) => c.id !== columnId);
    board.cards = moveCardsTo
      ? board.cards.map((c) => (c.columnId === columnId ? { ...c, columnId: moveCardsTo } : c))
      : board.cards.filter((c) => c.columnId !== columnId);
  });
})();</script>`,
            },
            {
                title: 'WIP limits',
                note: 'A column with `wipLimit` shows `/ n` beside its count; going over turns the count and the border destructive. It never blocks a drop.',
                html: `<div style="overflow:auto;border:1px solid var(--border);border-radius:calc(var(--radius) + 4px)">
  <ge-kanban id="kb2"></ge-kanban>
</div>
<script>(() => {
  const board = document.getElementById('kb2');
  board.columns = [
    { id: 'todo', title: 'To Do', order: 0, wipLimit: 4 },
    { id: 'doing', title: 'Doing', order: 1, wipLimit: 2 },
    { id: 'blocked', title: 'Blocked', order: 2, wipLimit: 1 },
    { id: 'done', title: 'Done', order: 3 },
  ];
  board.cards = [
    { id: 'w1', columnId: 'todo', title: 'Write unit tests for auth module', priority: 'high', order: 0 },
    { id: 'w2', columnId: 'todo', title: 'Update API documentation', order: 1 },
    { id: 'w3', columnId: 'doing', title: 'Dashboard analytics charts', order: 0 },
    { id: 'w4', columnId: 'doing', title: 'Mobile responsive fixes', order: 1 },
    { id: 'w5', columnId: 'doing', title: 'Refactor data fetching layer', order: 2 },
    { id: 'w6', columnId: 'blocked', title: 'Third-party SSO integration', priority: 'urgent', order: 0 },
    { id: 'w7', columnId: 'blocked', title: 'Payment provider approval', order: 1 },
  ];
  globalThis.geKanbanWire(board);
})();</script>`,
            },
            {
                title: 'Search, and no labels or assignees',
                note: '`search-term` filters by title, description and label text, and the count badges follow. `have-labels="false"` and `have-assignees="false"` hide those fields in the card dialog.',
                html: `<div style="overflow:auto;border:1px solid var(--border);border-radius:calc(var(--radius) + 4px)">
  <ge-kanban id="kb3" search-term="audit" have-labels="false" have-assignees="false"></ge-kanban>
</div>
<script>(() => {
  const board = document.getElementById('kb3');
  const columns = [
    { id: 'backlog', title: 'Backlog', order: 0 },
    { id: 'in-progress', title: 'In Progress', order: 1 },
    { id: 'review', title: 'In Review', order: 2 },
    { id: 'done', title: 'Done', order: 3 },
  ];
  const cards = [
    { id: 'card-1', columnId: 'backlog', title: 'Set up CI/CD pipeline', description: 'Configure GitHub Actions for automated testing and deployment.', priority: 'high', labels: [{ text: 'DevOps', color: '#6366f1' }], assignees: [{ name: 'Alice Chen' }], order: 0 },
    { id: 'card-2', columnId: 'backlog', title: 'Design token refresh', description: 'Update color palette and spacing tokens to match the new brand guidelines.', priority: 'medium', labels: [{ text: 'Design', color: '#ec4899' }], assignees: [{ name: 'Bob Martin' }], order: 1 },
    { id: 'card-3', columnId: 'in-progress', title: 'Implement Kanban board', description: 'Drag and drop, context menus and undo.', priority: 'urgent', labels: [{ text: 'Feature', color: '#22c55e' }, { text: 'UI', color: '#3b82f6' }], assignees: [{ name: 'Alice Chen' }, { name: 'Carol Diaz' }], order: 0 },
    { id: 'card-4', columnId: 'review', title: 'Accessibility audit', description: 'Check contrast, focus order and screen reader names.', priority: 'low', labels: [{ text: 'A11y', color: '#f97316' }], assignees: [{ name: 'Bob Martin' }], order: 0 },
    { id: 'card-5', columnId: 'done', title: 'Release v1.8.0', priority: 'medium', labels: [{ text: 'Release', color: '#8b5cf6' }], order: 0 },
  ];
  board.columns = columns;
  board.cards = cards;
  globalThis.geKanbanWire(board);
})();</script>`,
            },
            {
                title: 'Hebrew (RTL)',
                html: `<div style="overflow:auto;border:1px solid var(--border);border-radius:calc(var(--radius) + 4px)">
  <ge-kanban id="kb4" locale="he"></ge-kanban>
</div>
<script>(() => {
  const board = document.getElementById('kb4');
  const columns = [
    { id: 'backlog', title: 'Backlog', order: 0 },
    { id: 'in-progress', title: 'In Progress', order: 1 },
    { id: 'review', title: 'In Review', order: 2 },
    { id: 'done', title: 'Done', order: 3 },
  ];
  const cards = [
    { id: 'card-1', columnId: 'backlog', title: 'Set up CI/CD pipeline', description: 'Configure GitHub Actions for automated testing and deployment.', priority: 'high', labels: [{ text: 'DevOps', color: '#6366f1' }], assignees: [{ name: 'Alice Chen' }], order: 0 },
    { id: 'card-2', columnId: 'backlog', title: 'Design token refresh', description: 'Update color palette and spacing tokens to match the new brand guidelines.', priority: 'medium', labels: [{ text: 'Design', color: '#ec4899' }], assignees: [{ name: 'Bob Martin' }], order: 1 },
    { id: 'card-3', columnId: 'in-progress', title: 'Implement Kanban board', description: 'Drag and drop, context menus and undo.', priority: 'urgent', labels: [{ text: 'Feature', color: '#22c55e' }, { text: 'UI', color: '#3b82f6' }], assignees: [{ name: 'Alice Chen' }, { name: 'Carol Diaz' }], order: 0 },
    { id: 'card-4', columnId: 'review', title: 'Accessibility audit', description: 'Check contrast, focus order and screen reader names.', priority: 'low', labels: [{ text: 'A11y', color: '#f97316' }], assignees: [{ name: 'Bob Martin' }], order: 0 },
    { id: 'card-5', columnId: 'done', title: 'Release v1.8.0', priority: 'medium', labels: [{ text: 'Release', color: '#8b5cf6' }], order: 0 },
  ];
  board.columns = columns;
  board.cards = cards;
  globalThis.geKanbanWire(board);
})();</script>`,
            },
            {
                title: 'Swimlanes by a property',
                note: '`swimlane-by="assignee"` adds a second axis. Each lane collapses on its own, and because the grouping is a property name, dragging a card into another lane rewrites that field.',
                html: `<div style="overflow:auto;border:1px solid var(--border);border-radius:calc(var(--radius) + 4px)">
  <ge-kanban id="kb5" swimlane-by="assignee"></ge-kanban>
</div>
<script>(() => {
  const board = document.getElementById('kb5');
  const columns = [
    { id: 'backlog', title: 'Backlog', order: 0 },
    { id: 'in-progress', title: 'In Progress', order: 1 },
    { id: 'review', title: 'In Review', order: 2 },
    { id: 'done', title: 'Done', order: 3 },
  ];
  const cards = [
    { id: 'card-1', columnId: 'backlog', title: 'Set up CI/CD pipeline', description: 'Configure GitHub Actions for automated testing and deployment.', priority: 'high', labels: [{ text: 'DevOps', color: '#6366f1' }], assignees: [{ name: 'Alice Chen' }], order: 0 },
    { id: 'card-2', columnId: 'backlog', title: 'Design token refresh', description: 'Update color palette and spacing tokens to match the new brand guidelines.', priority: 'medium', labels: [{ text: 'Design', color: '#ec4899' }], assignees: [{ name: 'Bob Martin' }], order: 1 },
    { id: 'card-3', columnId: 'in-progress', title: 'Implement Kanban board', description: 'Drag and drop, context menus and undo.', priority: 'urgent', labels: [{ text: 'Feature', color: '#22c55e' }, { text: 'UI', color: '#3b82f6' }], assignees: [{ name: 'Alice Chen' }, { name: 'Carol Diaz' }], order: 0 },
    { id: 'card-4', columnId: 'review', title: 'Accessibility audit', description: 'Check contrast, focus order and screen reader names.', priority: 'low', labels: [{ text: 'A11y', color: '#f97316' }], assignees: [{ name: 'Bob Martin' }], order: 0 },
    { id: 'card-5', columnId: 'done', title: 'Release v1.8.0', priority: 'medium', labels: [{ text: 'Release', color: '#8b5cf6' }], order: 0 },
  ];
  board.columns = columns;
  board.cards = cards.map((c) => ({ ...c, assignee: c.assignees?.[0]?.name ?? '' }));
  globalThis.geKanbanWire(board);
})();</script>`,
            },
            {
                title: 'Swimlanes derived by a function',
                note: 'Set `swimlaneBy` to a function to group by anything. A derived lane cannot be inverted, so a cross-lane drop only changes the column and reports `toSwimlaneId` for you to act on. `swimlaneLabel` names a lane and `initiallyCollapsedSwimlanes` starts some closed.',
                html: `<div style="overflow:auto;border:1px solid var(--border);border-radius:calc(var(--radius) + 4px)">
  <ge-kanban id="kb6"></ge-kanban>
</div>
<script>(() => {
  const board = document.getElementById('kb6');
  const columns = [
    { id: 'backlog', title: 'Backlog', order: 0 },
    { id: 'in-progress', title: 'In Progress', order: 1 },
    { id: 'review', title: 'In Review', order: 2 },
    { id: 'done', title: 'Done', order: 3 },
  ];
  const cards = [
    { id: 'card-1', columnId: 'backlog', title: 'Set up CI/CD pipeline', description: 'Configure GitHub Actions for automated testing and deployment.', priority: 'high', labels: [{ text: 'DevOps', color: '#6366f1' }], assignees: [{ name: 'Alice Chen' }], order: 0 },
    { id: 'card-2', columnId: 'backlog', title: 'Design token refresh', description: 'Update color palette and spacing tokens to match the new brand guidelines.', priority: 'medium', labels: [{ text: 'Design', color: '#ec4899' }], assignees: [{ name: 'Bob Martin' }], order: 1 },
    { id: 'card-3', columnId: 'in-progress', title: 'Implement Kanban board', description: 'Drag and drop, context menus and undo.', priority: 'urgent', labels: [{ text: 'Feature', color: '#22c55e' }, { text: 'UI', color: '#3b82f6' }], assignees: [{ name: 'Alice Chen' }, { name: 'Carol Diaz' }], order: 0 },
    { id: 'card-4', columnId: 'review', title: 'Accessibility audit', description: 'Check contrast, focus order and screen reader names.', priority: 'low', labels: [{ text: 'A11y', color: '#f97316' }], assignees: [{ name: 'Bob Martin' }], order: 0 },
    { id: 'card-5', columnId: 'done', title: 'Release v1.8.0', priority: 'medium', labels: [{ text: 'Release', color: '#8b5cf6' }], order: 0 },
  ];
  board.columns = columns;
  board.cards = cards;
  board.swimlaneBy = (card) => card.priority ?? '';
  board.swimlaneLabel = (id) => (id === '' ? 'No priority' : id.toUpperCase());
  board.initiallyCollapsedSwimlanes = ['low'];
  globalThis.geKanbanWire(board);
})();</script>`,
            },
            {
                title: 'Custom mode',
                note: 'Place `ge-kanban-column`s yourself, with your own `ge-kanban-column-header` and `ge-kanban-card` children holding a `ge-kanban-card-content`. The board still gives you the menus, undo and drag coordination; set `cards` so drops know what they move.',
                html: `<div style="overflow:auto;border:1px solid var(--border);border-radius:calc(var(--radius) + 4px)">
  <ge-kanban id="kb7">
    <ge-kanban-column column-id="todo" collapsible="false">
      <ge-kanban-column-header>
        <div style="display:flex;align-items:center;gap:.5rem;width:100%"><span style="width:.5rem;height:.5rem;border-radius:9999px;background:var(--muted-foreground)"></span><h3 style="margin:0;font-size:.875rem">To Do</h3></div>
      </ge-kanban-column-header>
      <ge-kanban-card card-id="c1"><ge-kanban-card-content><p style="margin:0;font-size:.875rem;font-weight:600">Competitor analysis report</p><p style="margin:.25rem 0 0;font-size:.75rem;color:var(--muted-foreground)">Evaluate the top five and summarize.</p></ge-kanban-card-content></ge-kanban-card>
      <ge-kanban-card card-id="c2"><ge-kanban-card-content><p style="margin:0;font-size:.875rem;font-weight:600">Q2 roadmap planning</p></ge-kanban-card-content></ge-kanban-card>
    </ge-kanban-column>
    <ge-kanban-column column-id="active" collapsible="false">
      <ge-kanban-column-header>
        <div style="display:flex;align-items:center;gap:.5rem;width:100%"><span style="width:.5rem;height:.5rem;border-radius:9999px;background:var(--primary)"></span><h3 style="margin:0;font-size:.875rem">Active</h3></div>
      </ge-kanban-column-header>
      <ge-kanban-card card-id="c3"><ge-kanban-card-content><p style="margin:0;font-size:.875rem;font-weight:600">Fix production memory leak</p></ge-kanban-card-content></ge-kanban-card>
    </ge-kanban-column>
  </ge-kanban>
</div>
<script>(() => {
  const board = document.getElementById('kb7');
  board.cards = [
    { id: 'c1', columnId: 'todo', title: 'Competitor analysis report', order: 0 },
    { id: 'c2', columnId: 'todo', title: 'Q2 roadmap planning', order: 1 },
    { id: 'c3', columnId: 'active', title: 'Fix production memory leak', order: 0 },
  ];
  board.addEventListener('card-moved', (event) => console.log('card moved', event.detail));
})();</script>`,
            },
        ],
        api: [
            { name: 'columns', type: 'KanbanColumn[]', default: '[]', description: '`{ id, title, wipLimit?, order }`, in any order; the board sorts by `order`. Ignored when `ge-kanban-column` children are placed by hand.' },
            { name: 'cards', type: 'KanbanCard[]', default: '[]', description: '`{ id, columnId, title, description?, priority?, labels?, assignees?, order }`. The board never mutates it: apply the events.' },
            { name: 'search-term', type: 'string', default: "''", description: 'Case-insensitive filter over title, description and label text. Hidden cards drop out of the count and so out of the WIP check.' },
            { name: 'swimlane-by', type: 'string | (card) => string', default: 'null', description: 'Groups cards into lanes. A property name lets a cross-lane drop rewrite it; a function derives the lane and cannot be inverted.' },
            { name: 'swimlaneLabel / initiallyCollapsedSwimlanes', type: 'function / string[]', default: 'none', description: 'Lane headings (the empty lane is "Unassigned"), and lanes closed on first render.' },
            { name: 'have-labels / have-assignees', type: 'boolean', default: 'true', description: 'Show the label and assignee editors in the card dialog; `="false"` hides them.' },
            { name: 'assigneeOptions', type: '{ name, avatar? }[]', default: '[]', description: 'Known assignees; with any, the dialog field is a multi-select that keeps their avatars.' },
            { name: 'locale', type: 'string | KanbanLocale', default: "''", description: 'Locale id or object; defaults to the page `lang`, then `en`. A right-to-left locale mirrors the board.' },
            { name: 'cards-change / columns-change', type: 'event', default: '-', description: '`detail` is the next array, after a move, delete, column move, undo or redo.' },
            { name: 'card-moved', type: 'event', default: '-', description: '`detail` is `{ cardId, fromColumnId, toColumnId, newOrder }`, plus `fromSwimlaneId` and `toSwimlaneId` with lanes.' },
            { name: 'card-added / card-updated / card-deleted', type: 'event', default: '-', description: 'Added: the data without an `id`. Updated: the whole card. Deleted: the id, once the six-second undo toast has ended.' },
            { name: 'column-added / column-updated / column-deleted', type: 'event', default: '-', description: 'Added: no `id`. Updated: the whole column. Deleted: `{ columnId, moveCardsTo? }`; you remove it and move or drop its cards.' },
            { name: 'history-change', type: 'event', default: '-', description: '`detail` is `{ canUndo, canRedo }`; drive your own buttons with `undo()` and `redo()`.' },
            { name: 'undo() / redo()', type: 'method', default: '-', description: 'Fifty steps. Also Mod+Z and Mod+Shift+Z, except while typing in a field.' },
            { name: 'showCardContextMenu(x, y, card)', type: 'method', default: '-', description: 'Opens the card menu from your own trigger, such as a kebab button.' },
            { name: 'ge-kanban-column', type: 'element', default: '-', description: '`column-id`, `heading`, `wip-limit`, `collapsible`, `swimlane-id`; slots `header` and the default (cards).' },
            { name: 'ge-kanban-card', type: 'element', default: '-', description: '`card` (or `card-id`); project a `ge-kanban-card-content` for your own layout.' },
        ],
    },
    {
        id: 'effects',
        group: 'Charts & motion',
        name: 'Effects',
        tag: 'ge-marquee',
        description: 'Motion that decorates a page. All of them stand still under `prefers-reduced-motion: reduce`.',
        examples: [
            {
                title: 'Text reveal',
                note: 'A sentence that blurs in word by word. `delay` is the stagger in milliseconds.',
                html: `<ge-text-reveal id="reveal1" text="Build once and use it in every framework you write." delay="80" style="font-size:1.5rem;font-weight:700;max-width:28rem"></ge-text-reveal>
<ge-button variant="outline" size="sm" id="reveal1-again">Replay</ge-button>
<script>document.getElementById('reveal1-again').addEventListener('click', () => {
  const el = document.getElementById('reveal1');
  const text = el.text;
  el.text = '';
  requestAnimationFrame(() => { el.text = text; });
});</script>`,
            },
            {
                title: 'Marquee',
                note: 'The content loops forever with no seam. `direction` is physical (`left`, `right`, `up`, `down`), `speed` is seconds per loop, and `pause-on-hover` also pauses while a touch is held.',
                block: true,
                html: `<ge-marquee pause-on-hover speed="14" gap="12">
  <ge-badge>Lit 3</ge-badge><ge-badge variant="secondary">Web components</ge-badge><ge-badge variant="outline">Shadow DOM</ge-badge><ge-badge>SSR safe</ge-badge><ge-badge variant="secondary">Tokens</ge-badge><ge-badge variant="outline">Parity tested</ge-badge>
</ge-marquee>
<ge-marquee direction="right" speed="22" gap="12" style="margin-top:.75rem">
  <ge-badge variant="outline">Right</ge-badge><ge-badge variant="outline">to</ge-badge><ge-badge variant="outline">left</ge-badge><ge-badge variant="outline">and</ge-badge><ge-badge variant="outline">back</ge-badge><ge-badge variant="outline">again</ge-badge>
</ge-marquee>
<ge-marquee direction="up" speed="8" gap="8" style="height:5rem;margin-top:.75rem;max-width:12rem">
  <ge-badge>First</ge-badge><ge-badge variant="secondary">Second</ge-badge><ge-badge variant="outline">Third</ge-badge>
</ge-marquee>`,
            },
            {
                title: 'Particles',
                note: 'A canvas of drifting dots over a positioned box. It takes the surrounding text colour; move the pointer to push the dots away. Set `mouse-interaction="false"` to let clicks through.',
                block: true,
                html: `<div style="position:relative;height:14rem;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;color:var(--primary);background:var(--card)">
  <ge-particles count="60"></ge-particles>
  <div style="position:relative;pointer-events:none;display:flex;height:100%;align-items:center;justify-content:center;font-weight:600;color:var(--foreground)">Move the pointer over the dots</div>
</div>`,
            },
            {
                title: 'Ripple',
                note: 'Wraps anything that should ripple from the click point. The wrapper is the box (relative, clipping), so give it the radius and background. `duration` is in milliseconds; `color` defaults to a tint of the text colour.',
                html: `<ge-ripple style="width:12rem;height:4rem;border-radius:var(--radius);background:var(--primary);color:var(--primary-foreground);cursor:pointer">
  <div style="display:flex;height:100%;align-items:center;justify-content:center;font-weight:500">Click anywhere</div>
</ge-ripple>
<ge-ripple duration="1200" color="color-mix(in srgb, var(--primary) 30%, transparent)" style="width:12rem;height:4rem;border-radius:var(--radius);border:1px solid var(--border);cursor:pointer;margin-top:.75rem">
  <div style="display:flex;height:100%;align-items:center;justify-content:center;font-weight:500">Slower, tinted</div>
</ge-ripple>`,
            },
            {
                title: 'Magnetic',
                note: 'The wrapped element leans towards the pointer while the pointer is within `radius` of its centre. `strength` is the fraction of the distance, `smoothing` the easing time.',
                html: `<div style="padding:2rem;display:flex;gap:2rem;flex-wrap:wrap">
  <ge-magnetic><ge-button>Default pull</ge-button></ge-magnetic>
  <ge-magnetic strength="0.6" radius="120" smoothing="250"><ge-button variant="outline">Strong pull</ge-button></ge-magnetic>
</div>`,
            },
            {
                title: 'Copy to clipboard',
                note: 'Click to copy `value`; a "Copied!" label floats above for a moment and `copied` fires. It draws no box of its own. Needs a secure context (https or localhost).',
                html: `<div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap">
  <ge-copy-to value="sk-live-1234567890"><ge-button variant="outline">Copy API key</ge-button></ge-copy-to>
  <ge-copy-to value="#ef4444" locale="he"><div style="width:2.5rem;height:2.5rem;border-radius:.5rem;background:#ef4444;cursor:pointer" role="button" tabindex="0" aria-label="Copy colour"></div></ge-copy-to>
</div>`,
            },
            {
                title: 'Confetti',
                note: 'The element is the box. Call `fire()`, or turn `manual-trigger` on. `options` carries the count, angle, spread, colours and physics; `variant: \'side-cannons\'` fires from the bottom corners.',
                block: true,
                html: `<ge-confetti id="confetti1" style="height:14rem;border:1px dashed var(--border);border-radius:var(--radius)">
  <div style="display:flex;height:100%;align-items:center;justify-content:center;gap:.75rem">
    <ge-button id="confetti1-burst">Burst</ge-button>
    <ge-button variant="outline" id="confetti1-cannons">Side cannons</ge-button>
  </div>
</ge-confetti>
<script>(() => {
  const box = document.getElementById('confetti1');
  document.getElementById('confetti1-burst').addEventListener('click', () => { box.options = { particleCount: 80, spread: 70 }; box.fire(); });
  document.getElementById('confetti1-cannons').addEventListener('click', () => { box.options = { variant: 'side-cannons', particleCount: 60 }; box.fire(); });
})();</script>`,
            },
            {
                title: 'Blur fade',
                note: 'Fades its content in with a blur, from `direction` (`up`, `down`, `left`, `right`), once it scrolls into view. Set `in-view="false"` to play on load.',
                html: `<ge-blur-fade id="bf1" delay="100" duration="600"><ge-card style="max-width:20rem"><ge-card-header><ge-card-title>Fades in</ge-card-title></ge-card-header><ge-card-content>Blurred, then sharp.</ge-card-content></ge-card></ge-blur-fade>
<ge-button variant="outline" size="sm" id="bf1-again" style="margin-top:.5rem">Replay</ge-button>
<script>document.getElementById('bf1-again').addEventListener('click', () => document.getElementById('bf1').playAnimation());</script>`,
            },
            {
                title: 'Flip text',
                note: 'Each character flips in from above; `delay` is the stagger in milliseconds.',
                html: `<ge-flip-text id="ft1" text="Flip it good" style="font-size:2rem;font-weight:800"></ge-flip-text>
<ge-button variant="outline" size="sm" id="ft1-again" style="margin-left:1rem">Replay</ge-button>
<script>document.getElementById('ft1-again').addEventListener('click', () => document.getElementById('ft1').playAnimation());</script>`,
            },
            {
                title: 'Gradient text',
                note: 'A gradient that pans through `colors`; `speed` is seconds per loop and `direction` is the angle of travel.',
                html: `<ge-gradient-text id="gt1" speed="4" style="font-size:2.5rem;font-weight:800">Gradient text</ge-gradient-text>
<script>document.getElementById('gt1').colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'];</script>`,
            },
            {
                title: 'Typing animation',
                note: 'Types each string, pauses, deletes it, and moves on. `loop="false"` stops on the last string; `complete` fires when it does.',
                html: `<ge-typing-animation id="ta1" style="font-size:1.5rem;font-weight:600"></ge-typing-animation>
<script>document.getElementById('ta1').strings = ['Build once.', 'Use everywhere.', 'Any framework.'];</script>`,
            },
            {
                title: 'Word rotate',
                note: 'Slides through `words` in place. The words are stacked, so the element has no size of its own: give it a width and height.',
                html: `<span style="font-size:1.5rem;font-weight:700">Made for <ge-word-rotate id="wr1" duration="1800" style="width:8rem;height:2.25rem;vertical-align:bottom"></ge-word-rotate></span>
<script>document.getElementById('wr1').words = ['designers', 'developers', 'everyone'];</script>`,
            },
            {
                title: 'Streaming text',
                note: 'Types `text` as it grows, the way a chat reply arrives. Text that does not extend the old one restarts.',
                html: `<ge-streaming-text id="st1" text="Streaming text types itself out, a character at a time, with a pulsing cursor." speed="25" style="display:block;max-width:24rem"></ge-streaming-text>`,
            },
            {
                title: 'Number ticker',
                note: 'Counts to `value`, each digit rolling like an odometer. `duration` and `delay` are seconds; `decimal-places` keeps the width steady; `locale` sets the separators.',
                html: `<div style="display:flex;gap:2rem;flex-wrap:wrap;font-size:2.25rem;font-weight:700">
  <ge-number-ticker value="1234567" duration="2"></ge-number-ticker>
  <ge-number-ticker value="98.6" decimal-places="1" delay="0.5"></ge-number-ticker>
  <ge-number-ticker value="1234.5" decimal-places="1" locale="de"></ge-number-ticker>
</div>`,
            },
            {
                title: 'Morphing text',
                note: 'Cross-fades between `texts` with a blur; the box is the size of the longest one. `interval` is milliseconds per text.',
                html: `<span style="font-size:1.75rem;font-weight:700">We ship <ge-morphing-text id="mt1" interval="2400"></ge-morphing-text></span>
<script>document.getElementById('mt1').texts = ['faster', 'safer', 'everywhere'];</script>`,
            },
            {
                title: 'Shine border',
                note: 'A gradient that turns round the edge of whatever it wraps. Set the width on the host; `colors` is a property.',
                html: `<ge-shine-border id="sb1" duration="4" border-width="3" border-radius="14" style="width:min(18rem,100%)">
  <div style="padding:1.25rem"><strong>Pro plan</strong><p style="margin:.25rem 0 0;color:var(--muted-foreground)">Everything, unlimited.</p></div>
</ge-shine-border>
<ge-shine-border style="width:min(18rem,100%)"><div style="padding:1.25rem">Default colours</div></ge-shine-border>
<script>document.getElementById('sb1').colors = ['#22c55e', '#38bdf8', '#a855f7'];</script>`,
            },
            {
                title: 'Orbit',
                note: 'Each `ge-orbit` fills the positioned box and carries one item round a circle of `radius` pixels. Give concentric rings different durations, or `reverse` one.',
                html: `<div style="position:relative;width:min(17rem,100%);aspect-ratio:1;margin:auto;border-radius:9999px;border:1px dashed var(--border);display:grid;place-items:center">
  <ge-badge>Core</ge-badge>
  <ge-orbit radius="60" duration="8"><ge-badge variant="secondary">A</ge-badge></ge-orbit>
  <ge-orbit radius="100" duration="14" reverse><ge-badge variant="outline">B</ge-badge></ge-orbit>
  <ge-orbit radius="100" duration="14" delay="-7" reverse><ge-badge variant="outline">C</ge-badge></ge-orbit>
</div>`,
            },
            {
                title: 'Sparkles',
                note: 'A four-point star that pings out and fades. Size and place it yourself; it takes the current text colour. Stagger several with `animation-delay`.',
                html: `<div style="position:relative;display:inline-block;padding:0 1.5rem;font-size:1.75rem;font-weight:700">
  Magic
  <ge-sparkles style="top:-6px;left:0;width:16px;height:16px;color:#f59e0b"></ge-sparkles>
  <ge-sparkles style="top:20px;right:0;width:22px;height:22px;color:#ec4899;animation-delay:.5s"></ge-sparkles>
  <ge-sparkles style="top:-10px;right:30px;width:12px;height:12px;color:#38bdf8;animation-delay:1s"></ge-sparkles>
</div>`,
            },
            {
                title: 'Wobble card',
                note: 'Tilts towards the pointer and settles flat when it leaves (mouse only). Supply the background and padding; `intensity` is the maximum degrees.',
                html: `<ge-wobble-card intensity="12" style="width:min(18rem,100%);background:var(--card);border:1px solid var(--border);padding:1.5rem">
  <strong>Hover me</strong><p style="margin:.25rem 0 0;color:var(--muted-foreground)">I lean towards your pointer.</p>
</ge-wobble-card>`,
            },
            {
                title: 'Stagger children',
                note: 'The direct children rise in one after another when the block scrolls into view. `play()` runs it again.',
                html: `<ge-stagger-children id="sc1" direction="up" stagger-delay="120" style="max-width:20rem">
  <ge-card style="margin-bottom:.5rem"><div style="padding:.75rem 1rem">First</div></ge-card>
  <ge-card style="margin-bottom:.5rem"><div style="padding:.75rem 1rem">Second</div></ge-card>
  <ge-card><div style="padding:.75rem 1rem">Third</div></ge-card>
</ge-stagger-children>
<ge-button variant="outline" size="sm" style="margin-top:.75rem" id="sc1-again">Replay</ge-button>
<script>document.getElementById('sc1-again').addEventListener('click', () => document.getElementById('sc1').play());</script>`,
            },
            {
                title: 'Meteors',
                note: 'Shooting stars on a canvas that fills the nearest positioned box. `count` is how many are alive at once; `speed` is `slow`, `medium` or `fast`.',
                html: `<div style="position:relative;height:12rem;border-radius:var(--radius);background:#0b1020;color:#fff;overflow:hidden;display:grid;place-items:center">
  <ge-meteors count="24" color="#a5b4fc"></ge-meteors>
  <strong style="position:relative;font-size:1.25rem">Night sky</strong>
</div>`,
            },
            {
                title: 'Scroll progress',
                note: 'A thin bar that fills as you scroll. It follows the scrolling box it sits in, or the page; `container` takes a CSS selector. `position="bottom"` moves it to the bottom edge.',
                html: `<div id="sp-demo" style="position:relative;height:9rem;overflow:auto;border:1px solid var(--border);border-radius:var(--radius);padding:1rem;transform:translateZ(0)">
  <ge-scroll-progress container="#sp-demo" height="4"></ge-scroll-progress>
  <p style="height:20rem;margin:0">Scroll this box. The bar sits at the top of the box here because it is inside a transformed ancestor; on a normal page it pins to the viewport.</p>
</div>`,
            },
        ],
        api: [
            { name: 'text / delay (text reveal)', type: 'string / number', default: "'' / 50", description: 'Words split at whitespace runs; each starts `index * delay` ms after the first and animates for 1s. Plain text only.' },
            { name: 'direction / speed / gap / pause-on-hover (marquee)', type: "string / number / number / boolean", default: "'left' / 20 / 16 / false", description: '`speed` is seconds per loop (more content moves faster at the same value). Vertical directions need a height on the host. The copy is hidden from assistive tech.' },
            { name: 'count / color / speed / connect-distance / mouse-interaction (particles)', type: 'number / string / number / number / boolean', default: "50 / 'currentColor' / 0.5 / 120 / true", description: 'Fills its nearest positioned ancestor. Cost grows with the square of `count`. While `mouse-interaction` is on it captures pointer events.' },
            { name: 'color / duration / disabled (ripple)', type: 'string / number / boolean', default: "tint of currentColor / 600 / false", description: 'The wrapper is `display: block`, relative and clipping. A click from the keyboard ripples from the centre.' },
            { name: 'strength / radius / smoothing (magnetic)', type: 'number', default: '0.3 / 200 / 150', description: 'Inline-block; the element itself moves. Distance is measured from its current, moved, centre.' },
            { name: 'value / locale / copied (copy-to)', type: 'string / string | object / event', default: "'' / page lang / -", description: '`value` is read at click time. `copied` fires only when the clipboard write succeeds.' },
            { name: 'options / manual-trigger / fire() (confetti)', type: 'ConfettiOptions / boolean / method', default: '{} / false / -', description: '`particleCount`, `angle`, `spread`, `startVelocity`, `decay`, `gravity`, `drift`, `ticks`, `origin`, `colors`, `shapes`, `scalar`, `zIndex`, `disableForReducedMotion`, `variant`. A `0` falls back to the default.' },
            { name: 'delay / duration / direction / in-view (blur fade)', type: 'number / number / string / boolean', default: "0 / 400 / 'up' / true", description: 'Milliseconds. `replay` fires and `playAnimation()` plays again. The host is the animated box.' },
            { name: 'text / delay / duration (flip text)', type: 'string / number / number', default: "'' / 50 / 500", description: 'Spaces stay as spaces. `playAnimation()` replays.' },
            { name: 'colors / speed / direction (gradient text)', type: 'string[] / number / string', default: '- / 3 / -', description: '`colors` is a property. The gradient clips to the text, so give it a `font-size`.' },
            { name: 'strings / type-speed / delete-speed / pause-duration / loop / cursor (typing animation)', type: 'string[] / number / number / number / boolean / boolean', default: '- / 50 / 30 / 1500 / true / true', description: 'Milliseconds per character, and the hold before deleting. `complete` fires when a non-looping run ends.' },
            { name: 'words / duration (word rotate)', type: 'string[] / number', default: '- / 2000', description: 'Milliseconds each word stays. Changing either restarts the timer.' },
            { name: 'text / speed / show-cursor (streaming text)', type: 'string / number / boolean', default: "'' / 30 / true", description: 'Milliseconds per character. `complete` fires each time it catches up with `text`.' },
            { name: 'value / delay / duration / decimal-places / locale (number ticker)', type: 'number / number / number / number / string', default: "0 / 0 / 1 / 0 / page lang", description: 'Seconds. Every change of `value` counts from what is showing. Text takes the theme foreground; set `color` to override. `direction` is accepted and does nothing.' },
            { name: 'texts / interval (morphing text)', type: 'string[] / number', default: '- / 3000', description: 'Milliseconds per text; the cross-fade takes a third of it, at most 500ms. Changing either restarts from the first text.' },
            { name: 'colors / duration / border-width / border-radius (shine border)', type: 'string[] / number / number / number', default: "3 colours / 3 / 2 / 8", description: 'Seconds per turn, pixels. The host is inline-block and shrinks to its content; set its width.' },
            { name: 'radius / duration / delay / reverse (orbit)', type: 'number / number / number / boolean', default: '100 / 10 / 0 / false', description: 'Pixels and seconds. The host is absolute, inset 0 and click-through; the item itself stays clickable.' },
            { name: 'sparkles', type: 'element', default: '-', description: 'Absolute, click-through; size, place and colour it from outside. `animation-delay` on the host staggers it.' },
            { name: 'intensity / perspective (wobble card)', type: 'number', default: '15 / 1000', description: 'Maximum tilt in degrees, and the CSS perspective distance. The card has no background of its own.' },
            { name: 'delay / duration / stagger-delay / direction / play() (stagger children)', type: 'number / number / number / string / method', default: "0 / 400 / 80 / 'up'", description: 'Milliseconds. Only direct children animate. Starts when the block is 10% on screen.' },
            { name: 'count / speed / color (meteors)', type: 'number / string / string', default: "20 / 'medium' / 'white'", description: 'Fills its nearest positioned ancestor and ignores clicks. Changing `count` starts a fresh sky.' },
            { name: 'position / color / height / container (scroll progress)', type: 'string / string / number / string', default: "'top' / var(--primary) / 3 / auto", description: 'Fixed to the viewport edge, full width, z-index 50. Without `container` it follows the nearest scrolling ancestor, else the page.' },
            { name: '::part(base)', type: 'css part', default: '-', description: 'Text reveal\'s word container; set `justify-content` here.' },
            { name: '::part(viewport)', type: 'css part', default: '-', description: 'The marquee\'s clipping box.' },
        ],
    },
    {
        id: 'comparison-slider',
        group: 'Layout',
        name: 'Comparison slider',
        tag: 'ge-comparison-slider',
        description: 'Two images in one box with a draggable divider. Drag anywhere, tap to jump, or focus the handle and use the arrow keys, Home and End.',
        examples: [
            {
                title: 'Before and after',
                note: 'The box is 16:9 and fills its width. Both images should share dimensions so they line up under the reveal.',
                block: true,
                html: `<ge-comparison-slider before-src="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23f97316'/%3E%3Cstop offset='1' stop-color='%23be123c'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='640' height='360' fill='url(%23g)'/%3E%3Ccircle cx='180' cy='120' r='68' fill='white' fill-opacity='.7'/%3E%3Crect x='340' y='200' width='220' height='100' fill='black' fill-opacity='.35'/%3E%3C/svg%3E" after-src="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%2306b6d4'/%3E%3Cstop offset='1' stop-color='%234f46e5'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='640' height='360' fill='url(%23g)'/%3E%3Ccircle cx='180' cy='120' r='68' fill='white' fill-opacity='.7'/%3E%3Crect x='340' y='200' width='220' height='100' fill='black' fill-opacity='.35'/%3E%3C/svg%3E" before-alt="Before" after-alt="After" before-label="Original" after-label="Edited" style="max-width:36rem;border-radius:var(--radius)"></ge-comparison-slider>`,
            },
            {
                title: 'Vertical, starting at 30%',
                note: '`orientation="vertical"` wipes top to bottom; Up and Down then move the divider up and down. Set `aspect-ratio` on the host to match your images.',
                html: `<ge-comparison-slider id="cs2" orientation="vertical" position="30" before-src="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23f97316'/%3E%3Cstop offset='1' stop-color='%23be123c'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='640' height='360' fill='url(%23g)'/%3E%3Ccircle cx='180' cy='120' r='68' fill='white' fill-opacity='.7'/%3E%3Crect x='340' y='200' width='220' height='100' fill='black' fill-opacity='.35'/%3E%3C/svg%3E" after-src="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%2306b6d4'/%3E%3Cstop offset='1' stop-color='%234f46e5'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='640' height='360' fill='url(%23g)'/%3E%3Ccircle cx='180' cy='120' r='68' fill='white' fill-opacity='.7'/%3E%3Crect x='340' y='200' width='220' height='100' fill='black' fill-opacity='.35'/%3E%3C/svg%3E" before-alt="Before" after-alt="After" style="width:min(18rem,100%);aspect-ratio:4/3;border-radius:var(--radius)"></ge-comparison-slider>
<p id="cs2-out" style="margin:.5rem 0 0;font-size:.875rem;color:var(--muted-foreground)">30%</p>
<script>document.getElementById('cs2').addEventListener('position-change', (e) => { document.getElementById('cs2-out').textContent = Math.round(e.detail) + '%'; });</script>`,
            },
        ],
        api: [
            { name: 'before-src / after-src / before-alt / after-alt', type: 'string', default: "''", description: 'The two images. The before image is clipped to the start side of the divider.' },
            { name: 'before-label / after-label', type: 'string', default: '-', description: 'Caption badges in the top corners; omitted when unset, truncated when long.' },
            { name: 'position', type: 'number', default: '50', description: 'Divider position in percent from the start edge, shown clamped to 0-100.' },
            { name: 'orientation', type: "'horizontal' | 'vertical'", default: "'horizontal'", description: 'Wipe left-to-right or top-to-bottom.' },
            { name: 'locale', type: 'string', default: 'page lang', description: 'Language of the handle accessible name.' },
            { name: 'position-change', type: 'event', default: '-', description: '`detail` is the new position after each drag move or key press.' },
        ],
    },
    {
        id: 'masonry',
        group: 'Layout',
        name: 'Masonry',
        tag: 'ge-masonry',
        description: 'A column-balanced wall for items of uneven height. Unlike CSS columns, reading order, keyboard order and DOM order all agree.',
        examples: [
            {
                title: 'Responsive wall',
                note: 'Column counts are chosen from the wall own width (`sm` 640, `md` 768, `lg` 1024, `xl` 1280), so a wall in a narrow pane behaves like a wall on a narrow screen. Resize the window to watch it re-balance.',
                block: true,
                html: `<ge-masonry columns='{"base":1,"sm":2,"lg":3}' gap="12">
  <div style="height:120px;background:var(--muted);border-radius:var(--radius);padding:.75rem">1</div>
  <div style="height:80px;background:var(--secondary);border-radius:var(--radius);padding:.75rem">2</div>
  <div style="height:150px;background:var(--accent);border-radius:var(--radius);padding:.75rem">3</div>
  <div style="height:70px;background:var(--secondary);border-radius:var(--radius);padding:.75rem">4</div>
  <div style="height:110px;background:var(--muted);border-radius:var(--radius);padding:.75rem">5</div>
  <div style="height:90px;background:var(--accent);border-radius:var(--radius);padding:.75rem">6</div>
  <div style="height:130px;background:var(--muted);border-radius:var(--radius);padding:.75rem">7</div>
</ge-masonry>`,
            },
        ],
        api: [
            { name: 'columns', type: 'number | { base, sm, md, lg, xl }', default: '{ base: 1, sm: 2, lg: 3 }', description: 'A count (`columns="3"`), or JSON for the attribute and an object for the property.' },
            { name: 'gap', type: 'number', default: '16', description: 'Pixels, between columns and between stacked items.' },
            { name: 'layout()', type: 'method', default: '-', description: 'Re-balance now. Needed only after a change the element cannot see, such as a font swap or an image decode.' },
        ],
    },
    {
        id: 'virtual-scroll',
        group: 'Layout',
        name: 'Virtual scroll',
        tag: 'ge-virtual-scroll',
        description: 'Renders only the rows in view of a very long list, with variable heights, and anchors the scroll position when a row above changes size. Give it a bounded height.',
        examples: [
            {
                title: 'Ten thousand rows',
                note: '`renderItem` returns a Lit template, a node or text. Rows are rendered into the element light DOM, so your own styles reach them. The counter shows how many rows exist in the DOM right now.',
                html: `<ge-virtual-scroll id="vs1" min-item-height="44" style="height:18rem;max-width:26rem;border:1px solid var(--border);border-radius:var(--radius)"></ge-virtual-scroll>
<p id="vs1-out" style="margin:.5rem 0 0;font-size:.875rem;color:var(--muted-foreground)"></p>
<ge-button variant="outline" size="sm" id="vs1-jump" style="margin-top:.5rem">Jump to row 5000</ge-button>
<script>
const vs = document.getElementById('vs1');
vs.items = Array.from({ length: 10000 }, (_, id) => ({ id, tall: id % 7 === 0 }));
vs.renderItem = (row) => {
  const el = document.createElement('div');
  el.style.cssText = 'padding:.75rem 1rem;border-bottom:1px solid var(--border);box-sizing:border-box;min-height:' + (row.tall ? '88px' : '44px');
  el.textContent = 'Row ' + row.id + (row.tall ? ' (a taller one)' : '');
  return el;
};
vs.addEventListener('scroll-state', (e) => {
  document.getElementById('vs1-out').textContent = 'Rows in the DOM: ' + e.detail.windowSize + ' of ' + e.detail.totalItems;
});
document.getElementById('vs1-jump').addEventListener('click', () => vs.scrollToIndex(5000));
</script>`,
            },
            {
                title: 'Infinite scroll',
                note: '`scroll-end` fires near the end while `has-more` is on and `loading` is off; set `loading` in the handler, add the next page, then clear it.',
                html: `<ge-virtual-scroll id="vs2" min-item-height="44" style="height:14rem;max-width:26rem;border:1px solid var(--border);border-radius:var(--radius)"></ge-virtual-scroll>
<script>
const more = document.getElementById('vs2');
let count = 0;
const page = () => Array.from({ length: 20 }, () => ({ id: count++ }));
more.items = page();
more.renderItem = (row) => Object.assign(document.createElement('div'), { textContent: 'Item ' + row.id, style: 'padding:.75rem 1rem;border-bottom:1px solid var(--border);box-sizing:border-box;height:44px' });
more.addEventListener('scroll-end', () => {
  more.loading = true;
  setTimeout(() => {
    more.items = [...more.items, ...page()];
    more.hasMore = more.items.length < 100;
    more.loading = false;
  }, 800);
});
</script>`,
            },
            {
                title: 'A grid of cells',
                note: '`orientation="both"` reads `items` as a flat row-major grid of `column-count` columns and windows both axes. `scrollToCell(row, column)` jumps to one.',
                html: `<ge-virtual-scroll id="vs3" orientation="both" column-count="100" min-item-height="40" min-item-width="80" style="height:12rem;max-width:26rem;border:1px solid var(--border);border-radius:var(--radius)"></ge-virtual-scroll>
<script>
const grid = document.getElementById('vs3');
grid.items = Array.from({ length: 100 * 1000 }, (_, id) => ({ id }));
grid.renderItem = (cell) => Object.assign(document.createElement('div'), { textContent: cell.id, style: 'height:40px;width:80px;box-sizing:border-box;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:.75rem' });
</script>`,
            },
        ],
        api: [
            { name: 'items / renderItem / trackBy', type: 'unknown[] / (item, index) => unknown / (item, index) => unknown', default: '[] / - / item.id, then index', description: 'Properties. Rows with a stable key keep their nodes as the window moves.' },
            { name: 'min-item-height / min-item-width', type: 'number', default: '50 / 100', description: 'Estimates in pixels for rows not yet measured; roughly right is enough. Width is used by `horizontal` and `both`.' },
            { name: 'orientation / column-count', type: "'vertical' | 'horizontal' | 'both' / number", default: "'vertical' / 1", description: 'In `horizontal` every cell is as tall as the box; give cells an explicit width. In `both`, `items` is a flat row-major grid.' },
            { name: 'buffer', type: 'number', default: '5', description: 'Extra rows rendered beyond each edge of the viewport.' },
            { name: 'loading / has-more', type: 'boolean', default: 'false / true', description: '`loading` shows the indicator and suppresses `scroll-end`; `has-more="false"` stops `scroll-end`. Replace the indicator with a `slot="loading"` child.' },
            { name: 'window-change / scroll-state / cell-window-change / scroll-end', type: 'event', default: '-', description: '`detail` of the first is `{ start, end }`; of the second `{ windowStart, windowEnd, windowSize, totalItems, scrollProgress }`; of the third `{ rowStart, rowEnd, columnStart, columnEnd }`.' },
            { name: 'scrollToIndex / scrollToCell / scrollToTop / scrollToBottom', type: 'method', default: '-', description: 'Instant jumps. Far into unmeasured territory a jump lands approximately and settles as rows are measured.' },
            { name: '::part(viewport)', type: 'css part', default: '-', description: 'The scrolling box.' },
        ],
    },
    {
        id: 'bento-grid',
        group: 'Layout',
        name: 'Bento grid',
        tag: 'ge-bento-grid',
        description: 'A dashboard canvas of cards on a grid: drag to move, pull a grip to resize, select neighbours and merge them, split or delete from the context menu, and right-click empty space to add.',
        examples: [
            {
                title: 'Editable dashboard',
                note: 'Hand it `items` ({ id, x, y, cols, rows, content }, 1-based). The element never edits your array: it emits `items-change` with the new layout and you decide whether to keep it. Dropping a card over others shrinks them or removes them. Click cards to select, then use the Merge bar. Touch works too: drag a card with a finger, long-press for the menu.',
                block: true,
                html: `<ge-bento-grid id="bg1" cols="4" row-height="64" gap="12"></ge-bento-grid>
<p id="bg1-out" style="margin:.75rem 0 0;font-size:.875rem;color:var(--muted-foreground)"></p>
<script>
const board = document.getElementById('bg1');
board.items = [
  { id: 'revenue', x: 1, y: 1, cols: 2, rows: 2, content: 'Revenue' },
  { id: 'orders', x: 3, y: 1, cols: 2, rows: 1, content: 'Orders' },
  { id: 'users', x: 3, y: 2, cols: 1, rows: 1, content: 'Users' },
  { id: 'churn', x: 4, y: 2, cols: 1, rows: 1, content: 'Churn' },
];
board.addEventListener('items-change', (e) => {
  board.items = e.detail;
  document.getElementById('bg1-out').textContent = e.detail.map((i) => i.content + ' ' + i.x + ',' + i.y + ' ' + i.cols + 'x' + i.rows).join('  ·  ');
});
</script>`,
            },
            {
                title: 'Rendering your own cards',
                note: '`renderItem` returns a Lit template or a node. It is rendered into the light DOM, so page styles reach it. With `editable="false"` there are no grips, pattern or menus, and `resize-handle-type` picks edges, corners or both while editing.',
                block: true,
                html: `<ge-bento-grid id="bg2" cols="3" row-height="80" gap="12" editable="false"></ge-bento-grid>
<script>
const stats = document.getElementById('bg2');
stats.items = [
  { id: 'a', x: 1, y: 1, cols: 2, rows: 1, content: { label: 'Visitors', value: '12,480' } },
  { id: 'b', x: 3, y: 1, cols: 1, rows: 2, content: { label: 'Conversion', value: '3.4%' } },
  { id: 'c', x: 1, y: 2, cols: 2, rows: 1, content: { label: 'Revenue', value: '$48,200' } },
];
stats.renderItem = (item) => {
  const el = document.createElement('div');
  el.innerHTML = '<div style="font-size:.75rem;color:var(--muted-foreground)">' + item.content.label + '</div><div style="font-size:1.5rem;font-weight:600">' + item.content.value + '</div>';
  return el;
};
</script>`,
            },
            {
                title: 'Static cards',
                note: '`ge-bento-grid-item` children place themselves by `span` and `row-span`, for a bento layout that is not editable data.',
                block: true,
                html: `<ge-bento-grid cols="3" row-height="72" gap="12" editable="false">
  <ge-bento-grid-item span="2" row-span="2"><strong>Wide card</strong><span style="color:var(--muted-foreground)">Spans two columns and two rows.</span></ge-bento-grid-item>
  <ge-bento-grid-item><strong>Small</strong></ge-bento-grid-item>
  <ge-bento-grid-item><strong>Small</strong></ge-bento-grid-item>
</ge-bento-grid>`,
            },
        ],
        api: [
            { name: 'items', type: 'DashboardItem[]', default: '[]', description: '{ id, x, y, cols, rows, content }; x and y are 1-based grid lines.' },
            { name: 'renderItem', type: '(item) => unknown', default: 'null', description: 'Returns a Lit template or node for a card. Without it the content is shown as text.' },
            { name: 'cols', type: 'number', default: '12', description: 'Number of columns.' },
            { name: 'row-height', type: 'length', default: '120px', description: 'Row height. A bare number is pixels.' },
            { name: 'column-width', type: 'length', default: '1fr', description: 'Column width; the fluid default shares the space equally.' },
            { name: 'gap', type: 'length', default: '1.5rem', description: 'Space between cards.' },
            { name: 'show-borders', type: 'boolean', default: 'true', description: 'Border and shadow on every card. Editable cards are outlined anyway.' },
            { name: 'border-radius', type: 'length', default: '0.75rem', description: 'Card corner radius.' },
            { name: 'item-padding', type: 'length', default: '1rem', description: 'Card padding.' },
            { name: 'editable', type: 'boolean', default: 'true', description: 'Dragging, resizing, selecting, merging and the menus.' },
            { name: 'resize-handle-type', type: "'edges' | 'corners' | 'both'", default: "'both'", description: 'Which grips cards show while editable.' },
            { name: 'drag-handle-label', type: 'string', default: "'Drag to reorder'", description: 'Accessible name of the drag grip shown when any pointer is coarse. A touch drag starts only from it.' },
            { name: 'items-change', type: 'event', default: '-', description: 'detail is the whole new layout after a move, resize, merge, split, add or delete.' },
            { name: 'selection-change', type: 'event', default: '-', description: 'detail is the selected ids.' },
            { name: 'external-drop', type: 'event', default: '-', description: 'A widget dragged in from elsewhere (application/json { type: "widget", id }); detail has widgetId, targetId and, on empty canvas, x and y.' },
            { name: 'toggleSelection(id, add?) / clearSelection() / isSelected(id)', type: 'method', default: '-', description: 'Drive the selection from code.' },
            { name: 'mergeSelected() / splitItem(id, direction) / deleteItem(id) / addItemAt(x, y, cols, rows)', type: 'method', default: '-', description: 'The menu actions, callable directly. Each emits items-change.' },
        ],
    },
    {
        id: 'currency-input',
        group: 'Form inputs',
        name: 'Currency Input',
        tag: 'ge-currency-input',
        description: 'An amount of money written the way the reader\'s locale writes it. While you type it is a plain number; on blur it rounds to the currency\'s own decimals, clamps to the limits and shows the full formatting.',
        examples: [
            {
                title: 'Locales and currencies',
                note: '`value` is in major units (12.34 means twelve dollars thirty-four), `null` when empty. The decimals come from the currency: yen has none, dinar three. Pasted text such as `€1.234,50` or Arabic-Indic digits is read back.',
                html: `<div style="display:grid;gap:.75rem;max-width:16rem">
  <ge-currency-input value="12345.6" locale="en-US" aria-label="Dollars"></ge-currency-input>
  <ge-currency-input value="12345.6" locale="de-DE" currency="EUR" aria-label="Euro"></ge-currency-input>
  <ge-currency-input value="12345.6" locale="ja-JP" currency="JPY" aria-label="Yen"></ge-currency-input>
  <ge-currency-input value="12.345" locale="en-US" currency="KWD" aria-label="Dinar"></ge-currency-input>
</div>`,
                block: true,
            },
            {
                title: 'Limits and events',
                note: '`min` and `max` apply on blur so typing is never interrupted. `input` fires while typing, `change` only when editing ends on a different value.',
                html: `<ge-currency-input id="cur1" min="10" max="500" placeholder="$10 to $500" aria-label="Donation" style="display:block;max-width:16rem"></ge-currency-input>
<p id="cur1-out" style="margin:.5rem 0 0;font-size:.875rem;color:var(--muted-foreground)">Type an amount, then tab away.</p>
<script>
const money = document.getElementById('cur1');
money.addEventListener('change', () => {
  document.getElementById('cur1-out').textContent = 'value ' + money.value + ' (' + money.minorUnits + ' minor units)';
});
</script>`,
                block: true,
            },
            {
                title: 'Variants',
                html: `<div style="display:grid;gap:.75rem;max-width:16rem">
  <ge-currency-input value="99.9" variant="underline" aria-label="Underline"></ge-currency-input>
  <ge-currency-input value="99.9" variant="ghost" aria-label="Ghost"></ge-currency-input>
  <ge-currency-input value="99.9" disabled aria-label="Disabled"></ge-currency-input>
</div>`,
                block: true,
            },
        ],
        api: [
            { name: 'value', type: 'number | null', default: 'null', description: 'The amount in major units.' },
            { name: 'currency', type: 'string', default: 'USD', description: 'ISO 4217 code: symbol, decimal places and parsing follow it.' },
            { name: 'locale', type: 'string', default: 'page lang, then en', description: 'BCP 47 tag the amount is written in.' },
            { name: 'min / max', type: 'number', default: '-', description: 'Bounds, enforced on blur.' },
            { name: 'placeholder', type: 'string', default: '\'\'', description: 'Shown while empty.' },
            { name: 'variant', type: "'outline' | 'underline' | 'ghost'", default: "'outline'", description: 'Border treatment.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Blocks editing.' },
            { name: 'name', type: 'string', default: '-', description: 'Submits the value with a form.' },
            { name: 'aria-label', type: 'string', default: 'Amount', description: 'Accessible name.' },
            { name: 'minorUnits / scale', type: 'readonly', default: '-', description: 'The amount in cents, sen or fils, and the currency\'s decimal places.' },
            { name: 'input / change', type: 'event', default: '-', description: 'See above.' },
        ],
    },
    {
        id: 'duration-input',
        group: 'Form inputs',
        name: 'Duration Input',
        tag: 'ge-duration-input',
        description: 'A length of time edited one unit at a time, as `h:mm`. Each unit is its own field, so there is never a guess about what `130` means. Arrow keys step the segment under the caret.',
        examples: [
            {
                title: 'Units',
                note: '`value` is in seconds. Only the leading segment is unbounded, and it absorbs the units that are not shown, so ninety minutes with `minutes,seconds` reads `90:00`. Minutes below hours stop at 59 and wrap.',
                html: `<div style="display:grid;gap:.75rem;justify-items:start">
  <ge-duration-input value="5400" aria-label="Hours and minutes"></ge-duration-input>
  <ge-duration-input value="3725" units="hours,minutes,seconds" aria-label="Hours, minutes and seconds"></ge-duration-input>
  <ge-duration-input value="5400" units="minutes,seconds" aria-label="Minutes and seconds"></ge-duration-input>
  <ge-duration-input value="125" units="seconds" aria-label="Seconds"></ge-duration-input>
</div>`,
            },
            {
                title: 'Reading the value',
                note: '`change` fires once when focus leaves the whole control, not when it moves between segments.',
                html: `<ge-duration-input id="dur1" value="1800" units="hours,minutes,seconds" aria-label="Timer"></ge-duration-input>
<p id="dur1-out" style="margin:.5rem 0 0;font-size:.875rem;color:var(--muted-foreground)">1800 seconds</p>
<script>
const timer = document.getElementById('dur1');
timer.addEventListener('input', () => { document.getElementById('dur1-out').textContent = timer.value + ' seconds'; });
</script>`,
            },
            {
                title: 'Variants',
                html: `<div style="display:grid;gap:.75rem;justify-items:start">
  <ge-duration-input value="5400" variant="underline" aria-label="Underline"></ge-duration-input>
  <ge-duration-input value="5400" variant="ghost" aria-label="Ghost"></ge-duration-input>
  <ge-duration-input value="5400" disabled aria-label="Disabled"></ge-duration-input>
</div>`,
            },
        ],
        api: [
            { name: 'value', type: 'number | null', default: 'null', description: 'Seconds; empty shows empty segments.' },
            { name: 'units', type: "'hours,minutes,seconds' subset", default: "'hours,minutes'", description: 'Comma-separated units to show, largest first.' },
            { name: 'locale', type: 'string', default: 'page lang, then en', description: 'Language of the spoken value for screen readers.' },
            { name: 'variant', type: "'outline' | 'underline' | 'ghost'", default: "'outline'", description: 'Border treatment.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Blocks editing.' },
            { name: 'name', type: 'string', default: '-', description: 'Submits the seconds with a form.' },
            { name: 'aria-label', type: 'string', default: 'Duration', description: 'Accessible name of the group.' },
            { name: 'input / change', type: 'event', default: '-', description: 'See above.' },
        ],
    },
    {
        id: 'phone-input',
        group: 'Form inputs',
        name: 'Phone Input',
        tag: 'ge-phone-input',
        description: 'An international phone number: a searchable country picker beside a masked number field. The value is E.164, so it can go straight to an API.',
        examples: [
            {
                title: 'Basic',
                note: 'The mask follows the country, so characters that do not fit cannot be typed. Picking another country clears the number, since digits typed under the old dial code are not valid under the new one.',
                html: `<ge-phone-input id="ph1" default-country="US" style="display:block;max-width:22rem"></ge-phone-input>
<p id="ph1-out" style="margin:.5rem 0 0;font-size:.875rem;color:var(--muted-foreground)">Type a number or choose a country.</p>
<script>
const phone = document.getElementById('ph1');
phone.addEventListener('input', () => { document.getElementById('ph1-out').textContent = 'value: ' + (phone.value || '(empty)'); });
</script>`,
                block: true,
            },
            {
                title: 'From an E.164 value',
                note: 'Setting `value` picks the country from the longest matching dial code and shows the national part masked.',
                html: `<div style="display:grid;gap:.75rem;max-width:22rem">
  <ge-phone-input value="+442071234567"></ge-phone-input>
  <ge-phone-input value="+33612345678" locale="fr"></ge-phone-input>
  <ge-phone-input value="+972501234567" locale="he"></ge-phone-input>
</div>`,
                block: true,
            },
            {
                title: 'Variants',
                html: `<div style="display:grid;gap:.75rem;max-width:22rem">
  <ge-phone-input variant="underline" default-country="DE"></ge-phone-input>
  <ge-phone-input variant="ghost" default-country="JP"></ge-phone-input>
  <ge-phone-input disabled value="+15551234567"></ge-phone-input>
</div>`,
                block: true,
            },
        ],
        api: [
            { name: 'value', type: 'string', default: "''", description: 'The number as E.164, for example `+15551234567`.' },
            { name: 'default-country', type: 'string', default: 'US', description: 'ISO 3166-1 alpha-2 code of the initial country; ignored once the user has picked one.' },
            { name: 'countries', type: 'PhoneCountry[]', default: '35 countries', description: '{ code, name, flag, dialCode, mask, placeholder? } entries for the list (property).' },
            { name: 'placeholder', type: 'string', default: 'the country\'s example', description: 'Overrides the example number.' },
            { name: 'variant', type: "'outline' | 'underline' | 'ghost'", default: "'outline'", description: 'Border treatment.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Disables the picker and the field.' },
            { name: 'name', type: 'string', default: '-', description: 'Submits the E.164 value with a form.' },
            { name: 'locale', type: 'string | object', default: 'page lang, then en', description: 'Wording of the search box and empty result; Hebrew and Arabic lay out right to left.' },
            { name: 'selectedCountry / nationalNumber', type: 'readonly', default: '-', description: 'The country in use and the digits typed after the dial code.' },
            { name: 'input / change / open-change', type: 'event', default: '-', description: 'Edits, committed edits and country picks, and the list opening or closing.' },
        ],
    },
    {
        id: 'signature-pad',
        group: 'Form inputs',
        name: 'Signature pad',
        tag: 'ge-signature-pad',
        description: 'A canvas to sign on with a mouse, finger or pen. Undo removes the last stroke, Clear removes all; the result exports as a PNG data URL or an SVG.',
        examples: [
            {
                title: 'Default',
                html: `<div style="max-width:28rem"><ge-signature-pad></ge-signature-pad></div>`,
                block: true,
            },
            {
                title: 'Pen, height and variants',
                html: `<div style="display:grid;gap:.75rem;max-width:28rem">
  <ge-signature-pad pen-color="#2563eb" pen-width="3" height="120"></ge-signature-pad>
  <ge-signature-pad variant="underline" hide-controls height="100"></ge-signature-pad>
  <ge-signature-pad disabled height="100"></ge-signature-pad>
</div>`,
                block: true,
            },
        ],
        api: [
            { name: 'value', type: 'string', default: "''", description: 'A PNG data URL drawn as the backdrop; written back after every stroke.' },
            { name: 'pen-color', type: 'string', default: 'currentColor', description: 'Ink colour; a token such as `var(--primary)` works.' },
            { name: 'pen-width', type: 'number', default: '2', description: 'Stroke width in pixels.' },
            { name: 'height', type: 'number', default: '160', description: 'Canvas height in pixels.' },
            { name: 'variant', type: "'outline' | 'underline' | 'ghost'", default: "'outline'", description: 'Border treatment.' },
            { name: 'hide-controls', type: 'boolean', default: 'false', description: 'Hides the Undo and Clear buttons.' },
            { name: 'disabled', type: 'boolean', default: 'false', description: 'Stops drawing.' },
            { name: 'name', type: 'string', default: '-', description: 'Submits the PNG data URL with a form.' },
            { name: 'clear() / undo() / toDataURL(type?)', type: 'method', default: '-', description: '`toDataURL("svg")` returns the strokes as an SVG.' },
            { name: 'strokes / hasSignature / canUndo', type: 'readonly', default: '-', description: 'The recorded strokes and the state of the buttons.' },
            { name: 'input / change / stroke-end', type: 'event', default: '-', description: 'Fired as the signature changes.' },
        ],
    },
    {
        id: 'emoji-picker',
        group: 'Form inputs',
        name: 'Emoji picker',
        tag: 'ge-emoji-picker',
        description: 'A button that opens a panel of emoji: search by name or keyword, jump between categories with the tabs, and pick one. It is a `ge-popover`, so `open`, `show()` and `hide()` work as they do there.',
        examples: [
            {
                title: 'Default',
                html: `<ge-emoji-picker id="emoji-demo">
  <ge-emoji-picker-trigger><ge-button variant="outline">Pick an emoji</ge-button></ge-emoji-picker-trigger>
  <ge-emoji-picker-content></ge-emoji-picker-content>
</ge-emoji-picker>
<span id="emoji-demo-out" style="margin-inline-start:.75rem;font-size:1.5rem"></span>
<script>document.getElementById('emoji-demo').addEventListener('emoji-select', (e) => { document.getElementById('emoji-demo-out').textContent += e.detail; });</script>`,
                block: true,
            },
            {
                title: 'Several picks in one visit',
                html: `<ge-emoji-picker close-on-select="false">
  <ge-emoji-picker-trigger><ge-button variant="secondary">Keep open</ge-button></ge-emoji-picker-trigger>
  <ge-emoji-picker-content></ge-emoji-picker-content>
</ge-emoji-picker>`,
                block: true,
            },
            {
                title: 'Fixed strategy',
                html: `<ge-card style="max-width:20rem;overflow:hidden"><ge-card-content>
  <ge-emoji-picker close-on-scroll>
    <ge-emoji-picker-trigger><ge-button variant="ghost">😀 Inside a clipped card</ge-button></ge-emoji-picker-trigger>
    <ge-emoji-picker-content strategy="fixed"></ge-emoji-picker-content>
  </ge-emoji-picker>
</ge-card-content></ge-card>`,
                block: true,
            },
        ],
        api: [
            { name: 'open', type: 'boolean', default: 'false', description: 'Whether the panel is showing.' },
            { name: 'close-on-select', type: 'boolean', default: 'true', description: 'Closes the panel after a pick; `close-on-select="false"` keeps it open.' },
            { name: 'close-on-scroll', type: 'boolean', default: 'false', description: 'Closes when anything outside the picker scrolls.' },
            { name: 'ge-emoji-picker-content: side / align / side-offset', type: 'string / string / number', default: 'bottom / start / 4', description: 'Placement against the trigger, as for `ge-popover-content`.' },
            { name: 'ge-emoji-picker-content: strategy', type: "'absolute' | 'fixed'", default: "'absolute'", description: '`fixed` lifts the panel into the top layer so clipping ancestors cannot cut it.' },
            { name: 'show() / hide() / toggle() / selectEmoji(emoji)', type: 'method', default: '-', description: '`selectEmoji` commits a pick from your own control.' },
            { name: 'emoji-select', type: 'event', default: '-', description: '`detail` is the emoji; a flag or skin-tone variant is several code points, so count it with `Intl.Segmenter`.' },
            { name: 'open-change', type: 'event', default: '-', description: 'The panel opened or closed; `detail` is the new state.' },
        ],
    },
    {
        id: 'input-mask',
        group: 'Form inputs',
        name: 'Input mask',
        tag: 'ge-input-mask',
        description: 'Formats what is typed into a wrapped `ge-input` or native `input`. `0` and `9` take a digit, `a` a letter, `*` either; every other character is a literal. The wrapper draws no box.',
        examples: [
            {
                title: 'Phone, date and plate',
                note: 'Characters that do not fit are dropped, and pasted text is reformatted whatever punctuation it carries. The formatted text is the value, also in a form.',
                html: `<div style="display:grid;gap:1rem;max-width:20rem">
  <ge-label>Phone</ge-label>
  <ge-input-mask mask="(000) 000-0000"><ge-input placeholder="(555) 555-5555"></ge-input></ge-input-mask>
  <ge-label>Date</ge-label>
  <ge-input-mask mask="99/99/9999"><ge-input placeholder="DD/MM/YYYY"></ge-input></ge-input-mask>
  <ge-label>Licence plate</ge-label>
  <ge-input-mask mask="aaa-999"><ge-input placeholder="abc-123"></ge-input></ge-input-mask>
</div>`,
            },
            {
                title: 'Show the whole mask',
                note: '`show-mask-typed` keeps every literal and fills the empty slots with `slot-char`.',
                html: `<div style="display:grid;gap:1rem;max-width:20rem">
  <ge-input-mask mask="(000) 000-0000" show-mask-typed><ge-input placeholder="Type a number"></ge-input></ge-input-mask>
  <ge-input-mask mask="99/99/9999" show-mask-typed slot-char="•"><ge-input placeholder="Type a date"></ge-input></ge-input-mask>
</div>`,
            },
            {
                title: 'Native input',
                html: `<ge-input-mask mask="(000) 000-0000"><input placeholder="Native input (000) 000-0000" style="height:2.25rem;width:20rem;max-width:100%;padding:0 .75rem;border:1px solid var(--input);border-radius:var(--radius);background:transparent;font:inherit;color:inherit"></ge-input-mask>`,
            },
        ],
        api: [
            { name: 'mask', type: 'string', default: "''", description: '`0`/`9` digit, `a` letter, `*` letter or digit; anything else is a literal. Changing it reformats the current text.' },
            { name: 'slot-char / show-mask-typed', type: 'string / boolean', default: "'_' / false", description: 'With `show-mask-typed` every unfilled slot shows `slot-char`; an empty `slot-char` shows nothing for it.' },
            { name: 'slot', type: 'ge-input | input', default: '-', description: 'The first one inside is masked. The caret stays after what was typed, also when editing in the middle.' },
        ],
    },
    {
        id: 'charts',
        group: 'Charts & motion',
        name: 'Charts',
        tag: 'ge-line-chart',
        description: 'Pure SVG charts that measure their own width, follow `dir`, and take their data as a property. Hover, focus or tap a point for its tooltip; the legend hides and shows series.',
        examples: [
            {
                title: 'Line chart',
                note: 'Several series over shared categories, with a crosshair, a tooltip listing every visible series, and a legend that toggles them. `curve` is `linear`, `monotone` or `step`. A missing value (`NaN`, `null`) is a gap.',
                block: true,
                html: `<ge-line-chart id="line1" curve="monotone" heading="Line chart" height="300"></ge-line-chart>
<script>(() => {
  const cats = ['Q1', 'Q2', 'Q3', 'Q4'];
  const series = (name, values) => ({ name, data: cats.map((c, i) => ({ name: c, value: values[i] })) });
  document.getElementById('line1').series = [series('Desktop', [50, 55, 60, 65]), series('Mobile', [40, 50, 55, 68]), series('Tablet', [10, 12, 8, 10])];
})();</script>`,
            },
            {
                title: 'Pie chart',
                note: 'Slices share the circle by value; a slice is a button. `legend-position` is `right`, `left`, `top`, `bottom` or `none`.',
                html: `<ge-pie-chart id="pie1" size="280" legend-position="right"></ge-pie-chart>
<script>document.getElementById('pie1').data = [
  { name: 'Chrome', value: 61.41 }, { name: 'Safari', value: 24.43 }, { name: 'Edge', value: 6.28 }, { name: 'Firefox', value: 4.14 }, { name: 'Other', value: 3.74 },
];</script>`,
            },
            {
                title: 'Donut chart',
                note: '`inner-radius` is the hole as a fraction of the radius.',
                html: `<ge-pie-chart id="pie2" size="280" inner-radius="0.5"></ge-pie-chart>
<script>document.getElementById('pie2').data = [
  { name: 'Chrome', value: 61.41 }, { name: 'Safari', value: 24.43 }, { name: 'Edge', value: 6.28 }, { name: 'Firefox', value: 4.14 }, { name: 'Other', value: 3.74 },
];</script>`,
            },
            {
                title: 'Bar chart (vertical)',
                note: 'Columns on a nice value axis from a zero baseline, with captions for both axes.',
                block: true,
                html: `<ge-bar-chart id="bar1" height="280" x-axis-label="Month" y-axis-label="Revenue ($)"></ge-bar-chart>
<script>document.getElementById('bar1').data = [
  { name: 'Jan', value: 4500 }, { name: 'Feb', value: 3800 }, { name: 'Mar', value: 5200 }, { name: 'Apr', value: 4800 }, { name: 'May', value: 6100 }, { name: 'Jun', value: 5500 },
];</script>`,
            },
            {
                title: 'Bar chart (profit and loss)',
                note: 'Bars grow from a zero baseline: gains rise and losses fall below it.',
                block: true,
                html: `<ge-bar-chart id="bar2" height="280"></ge-bar-chart>
<script>document.getElementById('bar2').data = [{ name: 'Q1', value: 120 }, { name: 'Q2', value: -45 }, { name: 'Q3', value: 30 }, { name: 'Q4', value: -10 }];</script>`,
            },
            {
                title: 'Bar chart (horizontal)',
                note: 'Horizontal bars for comparing categorical data.',
                block: true,
                html: `<ge-bar-chart id="bar3" height="280" orientation="horizontal"></ge-bar-chart>
<script>document.getElementById('bar3').data = [
  { name: 'Chrome', value: 61.41 }, { name: 'Safari', value: 24.43 }, { name: 'Edge', value: 6.28 }, { name: 'Firefox', value: 4.14 }, { name: 'Other', value: 3.74 },
];</script>`,
            },
            {
                title: 'Area chart',
                note: 'Filled areas over shared categories; `stacked` stacks them and `stacking-mode="percent"` turns the stack into shares. `fill-opacity` sets the fill.',
                block: true,
                html: `<ge-area-chart id="area1" stacked curve="monotone" heading="Traffic"></ge-area-chart>
<script>(() => {
  const cats = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const series = (name, values) => ({ name, data: cats.map((c, i) => ({ name: c, value: values[i] })) });
  document.getElementById('area1').series = [series('Desktop', [186, 305, 237, 273, 209, 314]), series('Mobile', [80, 200, 120, 190, 130, 140])];
})();</script>`,
            },
            {
                title: 'Stacked bar chart',
                note: 'Stacked columns; positive segments rise from zero and negative ones fall below it. `stacking="percent"` fills every stack, `show-total` prints the total above it. A segment is a button.',
                block: true,
                html: `<ge-stacked-bar-chart id="stack1" height="300" show-total></ge-stacked-bar-chart>
<script>(() => {
  const series = (name, values) => ({ name, data: values.map((value, i) => ({ name: 'c' + i, value })) });
  const chart = document.getElementById('stack1');
  chart.categories = ['Q1', 'Q2', 'Q3', 'Q4'];
  chart.series = [series('Desktop', [120, 150, 90, 200]), series('Mobile', [80, 60, 110, 70]), series('Tablet', [30, 40, 25, 50])];
})();</script>`,
            },
            {
                title: 'Stacked bar chart (percent)',
                note: 'Each stack normalised to 100%; the tooltip adds the share.',
                block: true,
                html: `<ge-stacked-bar-chart id="stack2" height="300" stacking="percent"></ge-stacked-bar-chart>
<script>(() => {
  const series = (name, values) => ({ name, data: values.map((value, i) => ({ name: 'c' + i, value })) });
  const chart = document.getElementById('stack2');
  chart.categories = ['Q1', 'Q2', 'Q3', 'Q4'];
  chart.series = [series('Desktop', [120, 150, 90, 200]), series('Mobile', [80, 60, 110, 70]), series('Tablet', [30, 40, 25, 50])];
})();</script>`,
            },
            {
                title: 'Scatter chart',
                note: 'Clouds of points in continuous x/y space. The nearest point to the pointer is lifted and read out; hiding a series in the legend rescales both axes.',
                block: true,
                html: `<ge-scatter-chart id="scatter1" height="320"></ge-scatter-chart>
<script>(() => {
  const pts = (list) => list.map(([x, y]) => ({ x, y }));
  document.getElementById('scatter1').series = [
    { name: 'Group A', points: pts([[10, 20], [25, 45], [40, 38], [55, 70], [70, 62], [85, 90]]) },
    { name: 'Group B', points: pts([[15, 60], [30, 30], [45, 80], [60, 25], [75, 50], [90, 35]]) },
  ];
})();</script>`,
            },
            {
                title: 'Bubble chart',
                note: 'A third value `z` sets the radius; the area, not the diameter, follows it. `min-radius` and `max-radius` bound the sizes.',
                block: true,
                html: `<ge-bubble-chart id="bubble1" height="340"></ge-bubble-chart>
<script>(() => {
  const pts = (list) => list.map(([x, y, z]) => ({ x, y, z }));
  document.getElementById('bubble1').series = [
    { name: 'Europe', points: pts([[20, 30, 10], [45, 60, 40], [70, 40, 90], [85, 80, 25]]) },
    { name: 'Asia', points: pts([[15, 70, 60], [35, 20, 15], [60, 85, 100], [90, 45, 55]]) },
  ];
})();</script>`,
            },
            {
                title: 'Radar chart',
                note: 'One polygon per series on shared axes; `max-value` pins the outer ring and `fill-opacity` the fill.',
                html: `<ge-radar-chart id="radar1"></ge-radar-chart>
<script>(() => {
  const axes = ['Speed', 'Power', 'Range', 'Armor', 'Agility'];
  const make = (name, values) => ({ name, data: axes.map((a, i) => ({ name: a, value: values[i] })) });
  document.getElementById('radar1').series = [make('Alpha', [80, 60, 90, 40, 70]), make('Beta', [50, 85, 40, 75, 60])];
})();</script>`,
            },
            {
                title: 'Gauge chart',
                note: 'A semicircle for one value. Thresholds colour it by the highest step reached.',
                html: `<div style="display:flex;flex-wrap:wrap;gap:1.5rem">
  <ge-gauge-chart value="42" label="CPU load" unit="%" id="gauge1"></ge-gauge-chart>
  <ge-gauge-chart value="92" label="Disk" unit="%" id="gauge2"></ge-gauge-chart>
</div>
<script>(() => {
  const zones = [{ value: 0, color: '#22c55e' }, { value: 60, color: '#eab308' }, { value: 85, color: '#ef4444' }];
  document.getElementById('gauge1').thresholds = zones;
  document.getElementById('gauge2').thresholds = zones;
})();</script>`,
            },
            {
                title: 'Funnel chart',
                note: 'Stages narrow with their values. `percentage-mode` measures a share against the first stage or the previous one.',
                block: true,
                html: `<ge-funnel-chart id="funnel1" width="440"></ge-funnel-chart>
<script>document.getElementById('funnel1').data = [
  { name: 'Visitors', value: 5000 }, { name: 'Signups', value: 3200 }, { name: 'Trials', value: 1800 }, { name: 'Paid', value: 640 }, { name: 'Retained', value: 410 },
];</script>`,
            },
            {
                title: 'Waterfall chart',
                note: 'A running total: gains rise, losses fall, and a `total` bar stands from zero and resets the level.',
                block: true,
                html: `<ge-waterfall-chart id="waterfall1" show-values></ge-waterfall-chart>
<script>document.getElementById('waterfall1').data = [
  { name: 'Start', value: 1000, type: 'total' }, { name: 'Sales', value: 450 }, { name: 'Refunds', value: -120 }, { name: 'Costs', value: -380 }, { name: 'Tax', value: -90 }, { name: 'End', value: 860, type: 'total' },
];</script>`,
            },
            {
                title: 'Bullet chart',
                note: 'One measure against a target and qualitative bands, in a single row. `ranges` are upper bounds.',
                block: true,
                html: `<div style="display:grid;gap:1rem;max-width:480px">
  <ge-bullet-chart id="bullet1" value="270" target="250" label="Revenue" unit="k"></ge-bullet-chart>
  <ge-bullet-chart id="bullet2" value="68" target="80" label="Satisfaction" unit="%" color="#22c55e"></ge-bullet-chart>
</div>
<script>(() => {
  document.getElementById('bullet1').ranges = [150, 225, 300];
  document.getElementById('bullet2').ranges = [50, 75, 100];
})();</script>`,
            },
            {
                title: 'Heatmap',
                note: 'Cells coloured by value on a sequential scale; hover or focus a cell for its row, column and value.',
                block: true,
                html: `<ge-heatmap id="heat1" show-values></ge-heatmap>
<script>(() => {
  const rows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const cols = ['9am', '11am', '1pm', '3pm', '5pm'];
  document.getElementById('heat1').data = rows.flatMap((row, r) => cols.map((col, c) => ({ row, col, value: ((r * 7 + c * 5) % 11) * 9 + 4 })));
})();</script>`,
            },
            {
                title: 'Calendar heatmap',
                note: 'A year of days, a column per week. Only the days you pass are drawn.',
                block: true,
                html: `<ge-calendar-heatmap id="cal1" heading="Contributions"></ge-calendar-heatmap>
<script>(() => {
  const days = [];
  for (let i = 0; i < 180; i++) {
    const d = new Date(Date.UTC(2025, 0, 1 + i));
    days.push({ date: d.toISOString().slice(0, 10), value: (i * 37) % 11 });
  }
  document.getElementById('cal1').data = days;
})();</script>`,
            },
            {
                title: 'Column range chart',
                note: 'Floating columns from a low to a high value.',
                block: true,
                html: `<ge-column-range-chart id="range1" unit="°C" width="480"></ge-column-range-chart>
<script>document.getElementById('range1').data = [
  { name: 'Jan', low: -2, high: 6 }, { name: 'Feb', low: 0, high: 9 }, { name: 'Mar', low: 4, high: 15 }, { name: 'Apr', low: 8, high: 20 }, { name: 'May', low: 12, high: 25 }, { name: 'Jun', low: 16, high: 30 },
];</script>`,
            },
            {
                title: 'Combo chart',
                note: 'Bars on one axis and lines on a hidden second one. `show-cumulative` adds a Pareto line.',
                block: true,
                html: `<ge-combo-chart id="combo1" show-cumulative cumulative-label="Cumulative share"></ge-combo-chart>
<script>(() => {
  const cats = ['Crash', 'Slow', 'UI', 'Login', 'Other'];
  const make = (name, values) => ({ name, data: cats.map((c, i) => ({ name: c, value: values[i] })) });
  const chart = document.getElementById('combo1');
  chart.barSeries = [make('Defects', [120, 80, 45, 30, 15])];
  chart.lineSeries = [];
})();</script>`,
            },
            {
                title: 'Bar race chart',
                note: 'Ranked bars that slide between frames, with play, pause and a slider.',
                block: true,
                html: `<ge-bar-race-chart id="race1" auto-play loop animation-duration="900" max-bars="4"></ge-bar-race-chart>
<script>(() => {
  const names = ['Lit', 'React', 'Vue', 'Svelte', 'Solid'];
  const frames = [0, 1, 2, 3, 4].map((t) => names.map((name, i) => ({ name, value: 20 + ((i * 17 + t * (9 + i * 4)) % 60) + t * 8 })));
  const chart = document.getElementById('race1');
  chart.frames = frames;
  chart.frameLabels = ['2021', '2022', '2023', '2024', '2025'];
})();</script>`,
            },
            {
                title: 'Histogram',
                note: 'Pass raw observations and it bins them (Sturges\' rule unless `bin-count` is set).',
                block: true,
                html: `<ge-histogram id="hist1" unit="ms"></ge-histogram>
<script>document.getElementById('hist1').values = Array.from({ length: 120 }, (_, i) => 40 + ((i * 53) % 97) * 0.9 + (i % 7) * 3);</script>`,
            },
            {
                title: 'Treemap',
                note: 'Areas are proportional to value; a node with `children` is a group whose area is their sum.',
                block: true,
                html: `<ge-treemap id="tm1" unit=" GB"></ge-treemap>
<script>document.getElementById('tm1').nodes = [
  { label: 'Media', children: [{ label: 'Photos', value: 420 }, { label: 'Video', value: 300 }, { label: 'Music', value: 120 }] },
  { label: 'Code', children: [{ label: 'Repos', value: 180 }, { label: 'Builds', value: 60 }] },
  { label: 'Docs', value: 90 },
  { label: 'Trash', value: 30 },
];</script>`,
            },
            {
                title: 'Box plot',
                note: 'Pass raw samples and it draws the quartiles, the whiskers and the outliers; `orientation="horizontal"` turns it.',
                block: true,
                html: `<ge-boxplot id="bp1" unit="ms"></ge-boxplot>
<script>document.getElementById('bp1').groups = [
  { label: 'API', values: [12, 14, 15, 15, 16, 17, 18, 19, 21, 22, 24, 95] },
  { label: 'Web', values: [30, 32, 35, 36, 38, 40, 41, 44, 47, 52] },
  { label: 'DB', values: [5, 6, 6, 7, 7, 8, 9, 9, 10, 12, 30] },
];</script>`,
            },
            {
                title: 'Candlestick',
                note: 'Open, high, low and close per period; the ordinal axis leaves no gap for a weekend, `axis-mode="time"` shows it.',
                block: true,
                html: `<ge-candlestick id="cs1" unit="$"></ge-candlestick>
<script>document.getElementById('cs1').points = Array.from({ length: 16 }, (_, i) => {
  const open = 100 + Math.sin(i / 2) * 8 + i;
  const close = open + Math.cos(i * 1.3) * 6;
  return { date: new Date(Date.UTC(2024, 2, 4 + i + Math.floor(i / 5) * 2)), open, close, high: Math.max(open, close) + 3 + (i % 3), low: Math.min(open, close) - 3 - (i % 4) };
});</script>`,
            },
            {
                title: 'Chart brush',
                note: 'Drag the track to select a range, the band to move it, an edge to resize it.',
                block: true,
                html: `<ge-chart-brush id="brush1" width="480"></ge-chart-brush>
<p id="brush1-out" style="font-size:.875rem;color:var(--muted-foreground)">No selection</p>
<script>document.getElementById('brush1').addEventListener('selection-change', (event) => {
  const d = event.detail;
  document.getElementById('brush1-out').textContent = d ? 'From ' + Math.round(d.start) + ' to ' + Math.round(d.end) : 'No selection';
});</script>`,
            },
            {
                title: 'Pie chart with drilldown',
                note: 'A slice that names a child series opens it; a breadcrumb leads back.',
                block: true,
                html: `<ge-pie-chart-drilldown id="pdd1"></ge-pie-chart-drilldown>
<script>(() => {
  const chart = document.getElementById('pdd1');
  chart.data = [{ name: 'Web', value: 60, drilldown: 'web' }, { name: 'Mobile', value: 30, drilldown: 'mobile' }, { name: 'Desktop', value: 10 }];
  chart.drilldownSeries = [
    { id: 'web', name: 'Web', data: [{ name: 'Chrome', value: 35 }, { name: 'Safari', value: 15 }, { name: 'Firefox', value: 10 }] },
    { id: 'mobile', name: 'Mobile', data: [{ name: 'iOS', value: 18 }, { name: 'Android', value: 12 }] },
  ];
})();</script>`,
            },
            {
                title: 'Bar chart with drilldown',
                note: 'The same idea for columns.',
                block: true,
                html: `<ge-bar-chart-drilldown id="bdd1"></ge-bar-chart-drilldown>
<script>(() => {
  const chart = document.getElementById('bdd1');
  chart.data = [{ name: '2024', value: 480, drilldown: 'y24' }, { name: '2025', value: 620, drilldown: 'y25' }, { name: '2026', value: 300 }];
  chart.drilldownSeries = [
    { id: 'y24', name: '2024', data: [{ name: 'Q1', value: 100 }, { name: 'Q2', value: 120 }, { name: 'Q3', value: 130 }, { name: 'Q4', value: 130 }] },
    { id: 'y25', name: '2025', data: [{ name: 'Q1', value: 140 }, { name: 'Q2', value: 150 }, { name: 'Q3', value: 160 }, { name: 'Q4', value: 170 }] },
  ];
})();</script>`,
            },
            {
                title: 'Org chart',
                note: 'A flat list linked by `parentId`. Cards are buttons; `layout="horizontal"` runs left to right.',
                block: true,
                html: `<ge-org-chart id="org1"></ge-org-chart>
<script>document.getElementById('org1').data = [
  { id: 'ceo', name: 'Ada Lovelace', title: 'Chief Executive' },
  { id: 'cto', name: 'Grace Hopper', title: 'CTO', description: 'Owns engineering.', parentId: 'ceo' },
  { id: 'cfo', name: 'Alan Turing', title: 'CFO', parentId: 'ceo' },
  { id: 'dev1', name: 'Linus Torvalds', title: 'Engineer', parentId: 'cto' },
  { id: 'dev2', name: 'Margaret Hamilton', title: 'Engineer', parentId: 'cto' },
];</script>`,
            },
            {
                title: 'Chart legend',
                note: 'The legend on its own: it reports `item-toggle` and the chart you pair it with decides what to hide.',
                html: `<ge-chart-legend id="legend1"></ge-chart-legend>
<script>(() => {
  const legend = document.getElementById('legend1');
  legend.items = [{ key: 'a', label: 'Revenue', color: 'var(--chart-1)' }, { key: 'b', label: 'Costs', color: 'var(--chart-2)' }, { key: 'c', label: 'Profit', color: 'var(--chart-3)' }];
  legend.addEventListener('item-toggle', (event) => {
    const key = event.detail;
    legend.hiddenKeys = legend.hiddenKeys.includes(key) ? legend.hiddenKeys.filter((k) => k !== key) : [...legend.hiddenKeys, key];
  });
})();</script>`,
            },
        ],
        api: [
            { name: 'series (line)', type: 'ChartSeries[]', default: '[]', description: 'One entry per line: `{ id?, name, color?, data: { name, value }[] }`. Points match across series by position; categories come from the first series.' },
            { name: 'data (bar, pie)', type: 'ChartDataPoint[]', default: '[]', description: 'One entry per bar or slice: `{ name, value, color? }`.' },
            { name: 'width / height', type: 'number', default: '500 / 300', description: 'Line and bar charts measure their own width; `width` is used until then. `height` is applied literally.' },
            { name: 'heading', type: 'string', default: '-', description: 'A name for the chart, put before its accessible summary.' },
            { name: 'dir', type: "'auto' | 'ltr' | 'rtl'", default: "'auto'", description: 'Layout direction; `auto` follows the inherited one.' },
            { name: 'curve (line)', type: "'linear' | 'monotone' | 'step'", default: "'linear'", description: 'Interpolation between points.' },
            { name: 'show-points / show-grid / show-crosshair (line)', type: 'boolean', default: 'true', description: 'Markers, gridlines and the hover crosshair; `="false"` hides them.' },
            { name: 'orientation (bar)', type: "'vertical' | 'horizontal'", default: "'vertical'", description: 'Columns or rows.' },
            { name: 'show-values / show-grid (bar)', type: 'boolean', default: 'true', description: 'The value on each bar and the gridlines.' },
            { name: 'bar-radius / bar-gap (bar)', type: 'number', default: '4 / 8', description: 'Corner radius and gap in px.' },
            { name: 'x-axis-label / y-axis-label (bar)', type: 'string', default: "''", description: 'Axis captions.' },
            { name: 'size (pie)', type: 'number', default: '300', description: 'Width and height of the circle in px.' },
            { name: 'inner-radius (pie)', type: 'number', default: '0', description: 'The hole as a fraction of the radius; 0.5 is a donut.' },
            { name: 'show-labels / show-legend (pie)', type: 'boolean', default: 'true', description: 'Percentages on slices of 5% or more, and the legend.' },
            { name: 'legend-position (pie)', type: "'right' | 'left' | 'top' | 'bottom' | 'none'", default: "'right'", description: 'Where the legend sits.' },
            { name: 'stacked / stacking-mode / fill-opacity (area)', type: 'boolean / string / number', default: "false / 'absolute' / 0.25", description: 'Stack the areas; `percent` shows shares; opacity of the fill.' },
            { name: 'series / categories / stacking (stacked bar)', type: 'ChartSeries[] / string[] / string', default: "[] / [] / 'absolute'", description: 'Series pair with categories by index; a missing entry counts as 0. `stacking="percent"` fills each stack.' },
            { name: 'show-total / bar-radius / bar-gap (stacked bar)', type: 'boolean / number / number', default: 'false / 4 / 12', description: 'The stack total above each stack, corner radius and gap in px.' },
            { name: 'segment-click (stacked bar)', type: 'CustomEvent', default: '-', description: '`detail` is `{ series, category, value }` with the raw value.' },
            { name: 'series (scatter, bubble)', type: 'XYSeries[] / XYZSeries[]', default: '[]', description: '`{ id?, name, color?, points: { x, y, z? }[] }`. Bubble radii follow `z` between `min-radius` (6) and `max-radius` (28); scatter takes `point-radius` (5).' },
            { name: 'series / size / levels / max-value (radar)', type: 'ChartSeries[] / number', default: '[] / 320 / 4 / auto', description: 'Axes come from the first series. `max-value` is the value on the outer ring; `fill-opacity` is 0.2.' },
            { name: 'value / min / max / thickness / thresholds / label / unit (gauge)', type: 'number / GaugeThreshold[] / string', default: '0 / 0 / 100 / 0.2 / [] / - / -', description: '`size` is 220; `show-value="false"` hides the readout.' },
            { name: 'data / percentage-mode / gap / show-values (funnel)', type: 'ChartDataPoint[] / string / number / boolean', default: "[] / 'first' / 2 / true", description: '`percentage-mode` is `first` or `previous`. Fires `stage-click`.' },
            { name: 'data / show-connectors / show-values / positive-color / negative-color / total-color (waterfall)', type: 'WaterfallBar[] / boolean / string', default: 'true / false / green / red / blue', description: 'A bar is `{ name, value, type?: \'total\', color? }`. Fires `bar-click`.' },
            { name: 'value / target / ranges / min / color / label / unit (bullet)', type: 'number / number[] / string', default: '0 / - / [] / 0 / primary / - / -', description: '`ranges` are upper bounds of the bands, in any order.' },
            { name: 'data / max-cell-size / min-cell-size / from-color / to-color / show-values (heatmap)', type: 'HeatmapCell[] / number / string / boolean', default: '[] / 52 / 18 / blue / blue / false', description: 'A cell is `{ row, col, value }`. Fires `cell-hover` with the cell, or `null`.' },
            { name: 'data / cell-size / from-color / to-color (calendar heatmap)', type: 'CalendarDay[] / number / string', default: '[] / 13 / blue / blue', description: 'A day is `{ date: \'YYYY-MM-DD\', value }`. Fires `day-hover`.' },
            { name: 'data / unit / show-range-labels / bar-radius / bar-gap (column range)', type: 'RangeDataPoint[] / string / boolean / number', default: "[] / - / true / 4 / 12", description: 'A column is `{ name, low, high, color? }`. Fires `bar-click`.' },
            { name: 'barSeries / lineSeries / show-cumulative / cumulative-label (combo)', type: 'ChartSeries[] / boolean / string', default: '[] / [] / false / Cumulative', description: 'Lines use a second hidden axis. `bar-click` detail is `{ point, index }` of the bar\'s own series.' },
            { name: 'frames / frame-labels / auto-play / loop / max-bars / animation-duration (bar race)', type: 'ChartDataPoint[][] / string[] / boolean / number', default: '[] / [] / false / false / 10 / 500', description: 'Methods `play`, `pause`, `togglePlay`, `reset`, `goToFrame`; fires `frame-change` and `animation-complete`.' },
            { name: 'nodes / group-padding / show-labels / min-label-width / min-label-height / cell-radius / unit (treemap)', type: 'TreemapNode[]', default: '[]', description: '`{ label, value?, color?, children? }`. A group takes the sum of its children and passes its colour down. Fires `node-click` and `node-hover`.' },
            { name: 'groups / orientation / show-outliers / box-radius / unit (box plot)', type: 'BoxplotGroup[]', default: '[]', description: '`{ label, values?, stats?, color? }`; `stats` wins over `values`. Fires `group-click` and `group-hover`.' },
            { name: 'points / axis-mode / rising-color / falling-color / unit / locale (candlestick)', type: 'OhlcPoint[]', default: '[]', description: '`{ date, open, high, low, close }`; `axis-mode` is `ordinal` or `time`. Fires `candle-click` and `candle-hover`.' },
            { name: 'values / bin-count / binEdges / unit (histogram)', type: 'number[] / number', default: '[] / Sturges / -', description: 'Explicit `binEdges` win over `bin-count`. Fires `bin-click` and `bin-hover`.' },
            { name: 'selection / width / height (chart brush)', type: 'BrushSelection / number', default: 'null / 400 / 40', description: 'Work in pixels along the x axis of `width`. `selection` only seeds the brush; fires `selection-change` with `{ start, end }` or `null`.' },
            { name: 'data / drilldownSeries / show-breadcrumb / back-button-text (drilldown charts)', type: 'DrilldownDataPoint[] / DrilldownSeries[]', default: '[] / [] / true / Back', description: 'A point with `drilldown` opens the series with that `id`. Fires `drilldown`, `drillup`; `drillUp()` goes back.' },
            { name: 'data / layout / node-width / node-height / line-type / hide-images (org chart)', type: 'OrgNode[] / string / number', default: "[] / 'vertical' / 180 / 80 / 'curved' / false", description: 'A node is `{ id, name, title?, description?, image?, color?, parentId? }`. Fires `node-click` and `node-hover`.' },
            { name: 'show-tooltip / show-legend', type: 'boolean', default: 'true', description: 'The hover tooltip and, on the line chart, the legend.' },
            { name: 'point-click / bar-click / slice-click', type: 'CustomEvent', default: '-', description: '`detail` is `{ point, index }`.' },
            { name: 'point-hover / bar-hover / slice-hover', type: 'CustomEvent', default: '-', description: '`detail` is `{ point, index }`, or `null` when the pointer leaves.' },
            { name: 'ge-chart-legend', type: 'element', default: '-', description: '`items` (`{ key, label, color }`), `hiddenKeys`, `position`, `interactive`; fires `item-toggle` with the key.' },
            { name: 'ge-chart-tooltip', type: 'element', default: '-', description: '`visible`, `x`, `y`, `heading`, `rows` (`{ label, value, color? }`), `flip-x`, `flip-y`.' },
        ],
    },
    {
        id: 'chat',
        group: 'Apps & tools',
        name: 'Chat',
        tag: 'ge-chat-message',
        description: 'A message list, a message bubble and a composer. The list follows new messages; the composer sends on Enter.',
        examples: [
            {
                title: 'A conversation',
                note: 'Type a message and press Enter (Shift+Enter adds a line). The reply streams in by updating `content`, and the list keeps following it because `auto-scroll` is on.',
                html: `<div style="border:1px solid var(--border);border-radius:var(--radius);width:100%;max-width:28rem;height:25rem;display:flex;flex-direction:column;overflow:hidden">
  <ge-chat-list id="chat1" auto-scroll style="flex:1">
    <ge-chat-message sender="assistant" avatar-fallback="AI" content="Hello! I am a simulated assistant. Ask me anything."></ge-chat-message>
  </ge-chat-list>
  <div style="padding:1rem;border-top:1px solid var(--border);background:color-mix(in srgb, var(--muted) 20%, transparent)">
    <ge-chat-input id="chat1-input"></ge-chat-input>
  </div>
</div>
<script>(() => {
  const list = document.getElementById('chat1');
  const reply = 'This is a simulated reply that streams in one letter at a time, so the list has to keep following it down as it grows.';
  document.getElementById('chat1-input').addEventListener('send', (event) => {
    const mine = document.createElement('ge-chat-message');
    mine.setAttribute('sender', 'user');
    mine.setAttribute('avatar-fallback', 'ME');
    mine.setAttribute('content', event.detail);
    list.append(mine);
    setTimeout(() => {
      const theirs = document.createElement('ge-chat-message');
      theirs.setAttribute('sender', 'assistant');
      theirs.setAttribute('avatar-fallback', 'AI');
      list.append(theirs);
      let i = 0;
      const timer = setInterval(() => {
        i += 1;
        theirs.content = reply.slice(0, i);
        if (i >= reply.length) clearInterval(timer);
      }, 25);
    }, 400);
  });
})();</script>`,
            },
            {
                title: 'Senders and projected content',
                note: '`sender` is `user` (end side, primary), `assistant` (start side, muted and bordered) or `system` (centred, small, italic, no avatar). Anything placed inside the message replaces `content`.',
                html: `<div style="width:100%;max-width:28rem">
  <ge-chat-message sender="system" content="Conversation started"></ge-chat-message>
  <ge-chat-message sender="user" avatar-fallback="GL" content="Can you show me a list?"></ge-chat-message>
  <ge-chat-message sender="assistant" avatar-fallback="AI"><strong>Sure.</strong> Here you go:<ul style="margin:.25rem 0 0 1rem;list-style:disc"><li>One</li><li>Two</li></ul></ge-chat-message>
</div>`,
            },
            {
                title: 'Composer',
                note: '`placeholder` and `disabled`. The send button stays off until there is something to send, and the box clears the moment `send` fires.',
                html: `<div style="display:grid;gap:1rem;width:100%;max-width:28rem">
  <ge-chat-input placeholder="Ask anything"></ge-chat-input>
  <ge-chat-input disabled></ge-chat-input>
</div>`,
            },
        ],
        api: [
            { name: 'sender / content / avatar-src / avatar-fallback (message)', type: 'string', default: "'user' / '' / '' / '?'", description: '`sender` is `user`, `assistant` or `system` (named `role` in the Angular library; an attribute called `role` would be read as an ARIA role). Projected content wins over `content`.' },
            { name: 'auto-scroll / scrollToBottom() (list)', type: 'boolean / method', default: 'false / -', description: 'While on, any added message or changed text scrolls to the bottom, even if the reader scrolled up. Call `scrollToBottom()` for a "jump to latest" button.' },
            { name: 'placeholder / disabled / send (input)', type: 'string / boolean / event', default: "'Type a message...' / false / -", description: '`send` carries the raw text. Enter sends, Shift+Enter breaks the line, and the Enter that confirms an IME composition does nothing. A blank draft is never sent. `disabled` blocks sending but leaves the box editable.' },
            { name: '::part(row) / ::part(bubble) (message)', type: 'css part', default: '-', description: 'The row and the bubble.' },
            { name: '::part(scroll-area) (list) / ::part(send) (input)', type: 'css part', default: '-', description: 'The inner scroll area and the send button.' },
        ],
    },
    {
        id: 'tour',
        group: 'Navigation',
        name: 'Tour',
        tag: 'ge-tour',
        description: 'A guided tour: the page dims, one element at a time is spotlit, and a card explains it. Set `steps` as a property and turn `active` on.',
        examples: [
            {
                title: 'A three-step tour',
                note: 'Each `target` is a CSS selector looked up when the step starts. Enter or ArrowRight go on, ArrowLeft goes back, Escape skips. The card sits on the side with the most room unless a step names a `side`.',
                html: `<div style="display:flex;flex-wrap:wrap;gap:1rem;align-items:center">
  <ge-button id="tour1-search" variant="outline">Search</ge-button>
  <ge-badge id="tour1-badge">New</ge-badge>
  <ge-button id="tour1-save">Save</ge-button>
  <ge-button id="tour1-start" variant="secondary">Start the tour</ge-button>
</div>
<ge-tour id="tour1"></ge-tour>
<p id="tour1-log" style="margin-top:1rem;font-size:.875rem;color:var(--muted-foreground)">Waiting.</p>
<script>(() => {
  const tour = document.getElementById('tour1');
  const log = document.getElementById('tour1-log');
  tour.steps = [
    { target: '#tour1-search', title: 'Search', description: 'Find anything in the project.' },
    { target: '#tour1-badge', title: 'What is new', description: 'Badges mark recent changes.', side: 'right' },
    { target: '#tour1-save', title: 'Save', description: 'Saves your work.' },
  ];
  document.getElementById('tour1-start').addEventListener('click', () => { tour.active = true; });
  tour.addEventListener('step-change', (e) => { log.textContent = 'Step ' + (e.detail + 1); });
  tour.addEventListener('done', (e) => { log.textContent = 'Ended: ' + e.detail; });
})();</script>`,
            },
            {
                title: 'Hooks, branching and remembering',
                note: '`beforeActivate` opens the panel the next step points at and `target-timeout` waits for it. `when` leaves a step out, and `next` branches. `storage-key` remembers that the tour ran, so it will not start again until `resetCompletion()`.',
                html: `<div style="display:flex;flex-wrap:wrap;gap:1rem;align-items:center">
  <ge-button id="tour2-menu" variant="outline">Menu</ge-button>
  <div id="tour2-panel-slot" style="min-width:12rem;min-height:2.5rem"></div>
  <ge-button id="tour2-start" variant="secondary">Start</ge-button>
  <ge-button id="tour2-reset" variant="ghost">Forget it ran</ge-button>
</div>
<ge-tour id="tour2" target-timeout="1500" storage-key="demo-tour-2" next-label="Continue"></ge-tour>
<p id="tour2-log" style="margin-top:1rem;font-size:.875rem;color:var(--muted-foreground)">Waiting.</p>
<script>(() => {
  const tour = document.getElementById('tour2');
  const slot = document.getElementById('tour2-panel-slot');
  const log = document.getElementById('tour2-log');
  tour.steps = [
    { target: '#tour2-menu', title: 'The menu', description: 'The next step opens a panel from here.' },
    {
      target: '#tour2-panel',
      title: 'Settings',
      description: 'This panel did not exist until the step asked for it.',
      beforeActivate: async () => {
        await new Promise((r) => setTimeout(r, 300));
        slot.innerHTML = '<ge-card id="tour2-panel" style="padding:.5rem 1rem">Settings panel</ge-card>';
      },
      afterDeactivate: () => { slot.innerHTML = ''; },
    },
    { target: '#tour2-never', title: 'Skipped', when: () => false },
    { target: '#tour2-start', title: 'That is all', description: 'Press Done to finish.' },
  ];
  document.getElementById('tour2-start').addEventListener('click', () => {
    if (tour.isCompleted()) { log.textContent = 'It already ran. Forget it first.'; return; }
    tour.active = true;
  });
  document.getElementById('tour2-reset').addEventListener('click', () => { tour.resetCompletion(); log.textContent = 'Forgotten.'; });
  tour.addEventListener('step-skipped', (e) => { log.textContent = 'Skipped step ' + (e.detail.index + 1) + ': ' + e.detail.reason; });
  tour.addEventListener('done', (e) => { log.textContent = 'Ended: ' + e.detail; });
})();</script>`,
            },
        ],
        api: [
            { name: 'steps', type: 'TourStep[]', default: '[]', description: '`{ target, title, description?, side?, beforeActivate?, afterDeactivate?, when?, targetTimeout?, next? }`. A missing, unrendered or failing step is skipped in the direction of travel with a console warning and a `step-skipped` event.' },
            { name: 'active', type: 'boolean', default: 'false', description: 'Turning it on starts at the first step. Turning it off yourself cancels without a `done` event.' },
            { name: 'show-skip / target-timeout', type: 'boolean / number', default: 'true / 0', description: '`show-skip="false"` hides Skip. `target-timeout` is the milliseconds to wait for a target a hook renders; 0 looks once.' },
            { name: 'next-label / prev-label / finish-label / skip-label / locale', type: 'string', default: '-', description: 'Button wording; `locale` (an id or object) also sets `dir="rtl"` for Hebrew and Arabic.' },
            { name: 'storage-key', type: 'string', default: "''", description: 'Remember under `ge-tour:<key>` in localStorage that the tour ended (finished or skipped), and refuse to start again. A tour that never showed a step records nothing.' },
            { name: 'next() / previous() / skip() / goTo(i) / restart() / isCompleted() / resetCompletion()', type: 'methods', default: '-', description: '`next()` and `previous()` are ignored while a step\'s hooks run; `skip()` never is.' },
            { name: 'done / active-change / step-change / step-skipped', type: 'events', default: '-', description: '`done` carries `finished` or `skipped`; `active-change` (`false`) fires when the tour turns itself off; `step-change` carries the index; `step-skipped` carries `{ index, reason }`.' },
            { name: '::part(card)', type: 'css part', default: '-', description: 'The step card.' },
        ],
    },
    {
        id: 'icon',
        group: 'Display',
        name: 'Icon',
        tag: 'ge-icon',
        description: 'An inline SVG icon from about a thousand built-in glyphs, drawn in the surrounding text colour. An unknown name draws nothing instead of throwing.',
        examples: [
            {
                title: 'Sizes',
                note: '`size` takes xs, sm, md (the default), lg or xl, or any SVG length such as `2rem`.',
                html: `<ge-icon name="settings" size="xs"></ge-icon>
<ge-icon name="settings" size="sm"></ge-icon>
<ge-icon name="settings"></ge-icon>
<ge-icon name="settings" size="lg"></ge-icon>
<ge-icon name="settings" size="xl"></ge-icon>
<ge-icon name="settings" size="2rem"></ge-icon>`,
            },
            {
                title: 'Weights',
                note: '`solid` fills the glyph where it has a filled form (heart, bell, star...) and stays outlined where it has not.',
                html: `<ge-icon name="heart" size="lg" weight="light"></ge-icon>
<ge-icon name="heart" size="lg"></ge-icon>
<ge-icon name="heart" size="lg" weight="thick"></ge-icon>
<ge-icon name="heart" size="lg" weight="solid"></ge-icon>
<ge-icon name="circle-check" size="lg" weight="solid"></ge-icon>
<ge-icon name="arrow-up" size="lg" weight="solid"></ge-icon>`,
            },
            {
                title: 'Colour',
                note: '`color` tints the whole glyph, `fill-color` colours in an outline, `stroke-width` overrides the weight.',
                html: `<ge-icon name="heart" size="lg" color="var(--destructive)"></ge-icon>
<ge-icon name="circle" size="lg" fill-color="#22c55e"></ge-icon>
<ge-icon name="star" size="lg" stroke-width="1"></ge-icon>
<span style="color:var(--primary);display:inline-flex;align-items:center;gap:.375rem"><ge-icon name="info"></ge-icon> inherits the text colour</span>`,
            },
            {
                title: 'Your own glyphs',
                note: '`registerIcons({ name: "<svg inner markup>" })` (the demo page exposes it as `globalThis.geRegisterIcons`) adds glyphs, or replaces built-in ones, for every icon on the page. The markup is trusted: never build it from user input.',
                html: `<ge-icon id="brand" name="brand-mark" size="xl"></ge-icon>
<script>
  globalThis.geRegisterIcons({ 'brand-mark': '<circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" />' });
</script>`,
            },
        ],
        api: [
            { name: 'name', type: 'string', default: "''", description: 'Glyph key, looked up in your icons before the built-in set. Unknown or empty draws an empty svg.' },
            { name: 'size', type: "'xs' | 'sm' | 'md' | 'lg' | 'xl' | string", default: "'md'", description: '12 / 16 / 24 / 32 / 48px, or any SVG length.' },
            { name: 'weight', type: "'light' | 'regular' | 'thick' | 'solid'", default: "'regular'", description: 'Stroke 1.5 / 2 / 2.5, or a filled glyph with no stroke when the icon has a solid form.' },
            { name: 'stroke-width / color / fill-color', type: 'number / string / string', default: '-', description: 'Stroke width overriding the weight; colour of the whole glyph (else inherited); explicit fill.' },
            { name: 'registerIcons(icons)', type: 'function', default: '-', description: 'From `@gilav21/elements/icon`. Adds or replaces glyphs; icons already on the page redraw. The counterpart of `provideIcons`.' },
            { name: '::part(base)', type: 'css part', default: '-', description: 'The svg.' },
        ],
    },
    {
        id: 'error-page',
        group: 'Display',
        name: 'Error page',
        tag: 'ge-error-page',
        description: 'A full-page 404, 403 or 500 state with the status code (or your own artwork), a message and two recovery actions. It reports; you decide where to go.',
        examples: [
            {
                title: 'Status codes',
                note: 'Copy comes from the locale, keyed by `code`; any other code gets the generic copy. Press the buttons: the page fires `go-back` and `go-home`.',
                block: true,
                html: `<div style="display:grid;gap:1rem;width:100%">
  <div style="border:1px solid var(--border);border-radius:var(--radius)"><ge-error-page code="404"></ge-error-page></div>
  <div style="border:1px solid var(--border);border-radius:var(--radius)"><ge-error-page code="500"></ge-error-page></div>
</div>`,
            },
            {
                title: 'Your own copy, artwork and actions',
                note: 'A direct `ge-error-page-illustration` replaces the code; a direct `ge-error-page-actions` replaces both default buttons, and then `go-back` and `go-home` no longer fire.',
                block: true,
                html: `<div style="border:1px solid var(--border);border-radius:var(--radius)">
  <ge-error-page code="418" heading="I'm a teapot" description="The server refuses to brew coffee.">
    <ge-error-page-illustration><ge-icon name="coffee" size="48" stroke-width="1.5"></ge-icon></ge-error-page-illustration>
    <ge-error-page-actions><ge-button>Try tea</ge-button></ge-error-page-actions>
  </ge-error-page>
</div>`,
            },
            {
                title: 'Hebrew',
                block: true,
                html: `<div style="border:1px solid var(--border);border-radius:var(--radius)"><ge-error-page code="403" locale="he"></ge-error-page></div>`,
            },
        ],
        api: [
            { name: 'code', type: 'string', default: "'404'", description: 'Shown as the default illustration and used to pick the copy: 404, 403 and 500 have their own, anything else the generic.' },
            { name: 'heading / description', type: 'string', default: "''", description: 'Override the code\'s default heading and supporting line.' },
            { name: 'locale', type: 'string | ErrorPageLocale', default: "''", description: 'Locale id or object; defaults to the page `lang`, then English. Right-to-left locales set `dir="rtl"`.' },
            { name: 'go-back / go-home', type: 'event', default: '-', description: 'The default buttons were pressed. The page has no routing of its own.' },
            { name: 'ge-error-page-illustration / ge-error-page-actions', type: 'slots', default: '-', description: 'Direct children only; each assigns itself to its slot and removes the default it replaces.' },
        ],
    },
    {
        id: 'shortcut-bindings-dialog',
        group: 'Apps & tools',
        name: 'Shortcut bindings dialog',
        tag: 'ge-shortcut-bindings-dialog',
        description: 'A searchable list of every keyboard shortcut the page registers, where each can be rebound by pressing a new key. Components register through the shared `shortcutBindings` registry; this dialog edits it.',
        examples: [
            {
                title: 'Rebind the page shortcuts',
                note: 'Press Ctrl+B or Ctrl+S on this page first (a toast confirms), then rebind one here and try the new key. Overrides persist in localStorage. When a `ge-command-dialog` or `ge-kanban` is on screen it appears too.',
                html: `<ge-button onclick="this.nextElementSibling.open = true">Keyboard shortcuts</ge-button>
<ge-shortcut-bindings-dialog></ge-shortcut-bindings-dialog>`,
            },
            {
                title: 'With Save Changes',
                note: '`allow-save-mapping` adds the button; `mapping-save` carries the override schema, ready to store on a server and load back through `mappingSchema`.',
                html: `<ge-button variant="outline" onclick="this.nextElementSibling.open = true">Open with Save</ge-button>
<ge-shortcut-bindings-dialog allow-save-mapping></ge-shortcut-bindings-dialog>`,
            },
            {
                title: 'Hebrew',
                html: `<ge-button variant="outline" onclick="this.nextElementSibling.open = true">פתח</ge-button>
<ge-shortcut-bindings-dialog locale="he"></ge-shortcut-bindings-dialog>`,
            },
        ],
        api: [
            { name: 'open', type: 'boolean', default: 'false', description: 'Whether the dialog is showing. `open-change` fires when it closes itself.' },
            { name: 'allow-save-mapping', type: 'boolean', default: 'false', description: 'Shows Save Changes, which fires `mapping-save` with the override schema.' },
            { name: 'replace-on-schema-load', type: 'boolean', default: 'true', description: 'Whether a loaded `mappingSchema` replaces the current overrides (`replace-on-schema-load="false"` merges).' },
            { name: 'mappingSchema', type: 'Record<string, string>', default: '-', description: 'Property: overrides to import, e.g. the schema saved earlier.' },
            { name: 'locale', type: 'string | object', default: "''", description: 'Locale id or object; defaults to the page `lang`, then English.' },
            { name: 'shortcutBindings', type: 'singleton', default: '-', description: 'Import from `@gilav21/elements/shortcut-bindings-dialog`: `registerComponent(name, [{ actionId, description, defaultShortcut, handler, scope }])` to list your own action here.' },
        ],
    },
    {
        id: 'field-mapper',
        group: 'Apps & tools',
        name: 'Field mapper',
        tag: 'ge-field-mapper',
        description: 'Two lists joined by lines that say which goes with which: import columns to fields, schema to schema. Draw a line three ways: drag from an item\'s dot, tap an item then one in the other list, or the keyboard (arrows move, Enter picks, Delete removes). Below about 28rem it becomes stacked rows with a picker for each item.',
        examples: [
            {
                title: 'Map columns to fields',
                note: 'Set `start`, `end` and `links`. The element updates its own `links` and fires `links-change`. By default each item holds one link, so a new line takes the old one with it; linked end items move level with their partner.',
                block: true,
                html: `<ge-field-mapper id="fm1" start-heading="Column in the file" end-heading="Field in the CRM"></ge-field-mapper>
<pre id="fm1-out" style="margin:.75rem 0 0;font-size:.75rem;color:var(--muted-foreground)"></pre>
<script>(() => {
  const mapper = document.getElementById('fm1');
  const out = document.getElementById('fm1-out');
  mapper.start = ['customer_id', 'region', 'order_id', 'placed_at'].map((id) => ({ id, label: id }));
  mapper.end = ['segment', 'id', 'name', 'area'].map((id) => ({ id, label: id }));
  mapper.links = [{ startId: 'customer_id', endId: 'id' }];
  const show = () => (out.textContent = JSON.stringify(mapper.links));
  mapper.addEventListener('links-change', show);
  show();
})();</script>`,
            },
            {
                title: 'Many links, filters, tones and labels',
                note: '`maxLinks` is per side (`Infinity` for any number); `searchable` adds a filter over each list and runs a line to a hidden item to the list\'s edge; `linkTone` returns `default`, `muted` or `strong` (dash and weight, never colour alone); `renderLinkLabel` puts a short label at each line\'s middle; `renderItem` replaces an item\'s content.',
                block: true,
                html: `<ge-field-mapper id="fm2" searchable no-align></ge-field-mapper>
<script>(() => {
  const mapper = document.getElementById('fm2');
  const fields = ['id', 'email', 'first_name', 'last_name', 'phone', 'company'];
  mapper.start = ['Email', 'Name', 'Telephone', 'Organisation'].map((label) => ({ id: label.toLowerCase(), label }));
  mapper.end = fields.map((id) => ({ id, label: id }));
  mapper.maxLinks = { start: Infinity, end: 1 };
  mapper.links = [{ startId: 'email', endId: 'email' }, { startId: 'name', endId: 'first_name' }, { startId: 'name', endId: 'last_name' }];
  mapper.linkTone = (link) => (link.startId === 'name' ? 'muted' : 'strong');
  mapper.renderLinkLabel = (link) => (link.startId === 'name' ? 'split' : 'exact');
  mapper.renderItem = (item, { side, linked }) => side === 'end' && !linked ? item.label + ' (unmapped)' : item.label;
})();</script>`,
            },
            {
                title: 'Disabled items, rows layout, Hebrew',
                note: '`disabled` items stay visible but never link. `layout="rows"` forces the stacked layout whatever the width; `locale="he"` mirrors the whole component.',
                block: true,
                html: `<div style="display:grid;gap:1.5rem;width:100%">
  <ge-field-mapper id="fm3" layout="rows"></ge-field-mapper>
  <ge-field-mapper id="fm4" locale="he"></ge-field-mapper>
</div>
<script>(() => {
  for (const id of ['fm3', 'fm4']) {
    const mapper = document.getElementById(id);
    mapper.start = [{ id: 'a', label: 'שם' }, { id: 'b', label: 'עיר' }, { id: 'c', label: 'טלפון' }];
    mapper.end = [{ id: 'x', label: 'name' }, { id: 'y', label: 'city' }, { id: 'z', label: 'phone', disabled: true }];
    mapper.links = [{ startId: 'a', endId: 'x' }];
  }
})();</script>`,
            },
        ],
        api: [
            { name: 'start / end', type: '{ id, label, disabled? }[]', default: '[]', description: 'Property: the two lists. Ids are unique within a list; the lists may reuse each other\'s ids.' },
            { name: 'links', type: '{ startId, endId }[]', default: '[]', description: 'Property: the lines. The element sets it itself and fires `links-change`; the component never invents a link.' },
            { name: 'maxLinks', type: '{ start?, end? }', default: '{ start: 1, end: 1 }', description: 'Property: links one item may hold per side. Over the limit, the item\'s oldest link moves out. `Infinity` allows any number.' },
            { name: 'start-heading / end-heading', type: 'string', default: "'From' / 'To'", description: 'Headings over the lists; the locale supplies the defaults.' },
            { name: 'no-align', type: 'boolean', default: 'false', description: 'Keep the end list in its own order instead of putting each linked item level with its partner.' },
            { name: 'layout', type: "'auto' | 'columns' | 'rows'", default: "'auto'", description: '`auto` switches to rows below about 28rem of its own width.' },
            { name: 'searchable', type: 'boolean', default: 'false', description: 'A filter box over each list.' },
            { name: 'linkTone / renderItem / renderLinkLabel', type: 'functions', default: 'null', description: 'Properties: `(link) => tone`, `(item, { side, linked }) => content`, `(link, { start, end }) => content`.' },
            { name: 'locale', type: 'string | object', default: "''", description: 'Locale id or object; defaults to the page `lang`, then English. Right-to-left locales mirror the component.' },
            { name: 'links-change / link-select', type: 'event', default: '-', description: '`detail` is the new links, or the selected link (`null` when cleared).' },
            { name: 'link() / unlink() / unlinkItem() / pick() / cancel() / selectLink()', type: 'methods', default: '-', description: 'Drive it from code; `link` honours `maxLinks` and refuses disabled items.' },
        ],
    },
    {
        id: 'file-viewer',
        group: 'Apps & tools',
        name: 'File viewer',
        tag: 'ge-file-viewer',
        description: 'Previews a file in the page without uploading it: PDF, Word (DOCX and DOC), PowerPoint (PPTX and PPT), Excel (XLSX), images (SVG is sanitised first), text, video and audio. The type is read from the file\'s bytes, so a wrong extension does not matter. Parsing runs in the browser and each format loads only when it is first opened.',
        examples: [
            {
                title: 'Open any file',
                note: 'Set `file` to a `File` or `Blob`. Pick a PDF, a Word or Excel file, a slide deck or an image; the toolbar offers pages for PDF and slides, zoom where it makes sense, and a download link. `loaded` and `load-error` report the outcome.',
                block: true,
                html: String.raw`<div style="display:grid;gap:.75rem;width:100%">
  <input id="fv1-pick" type="file" accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,image/*,text/*,video/*,audio/*" />
  <ge-file-viewer id="fv1" height="420px"></ge-file-viewer>
  <p id="fv1-out" style="margin:0;font-size:.75rem;color:var(--muted-foreground)">Nothing opened yet.</p>
</div>
<script>(() => {
  const viewer = document.getElementById('fv1');
  const out = document.getElementById('fv1-out');
  document.getElementById('fv1-pick').addEventListener('change', (e) => { viewer.file = e.target.files[0] ?? null; });
  viewer.addEventListener('loaded', (e) => (out.textContent = 'loaded: ' + JSON.stringify(e.detail)));
  viewer.addEventListener('load-error', (e) => (out.textContent = 'load-error: ' + JSON.stringify(e.detail)));
  viewer.file = new File(['Pick a file above to preview it here.\n\nNothing leaves your browser: the file is parsed locally.\n'], 'welcome.txt');
})();</script>`,
            },
            {
                title: 'From a URL, with a zoom to start from',
                note: '`src` is fetched with `fetch()`, so the server must allow CORS; the name comes from the URL path unless you set `filename`. `zoom` and `page` are starting values; the toolbar steps zoom by 25% between 25% and 300%.',
                block: true,
                html: `<ge-file-viewer height="260px" zoom="1.5" filename="logo.svg" src="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='100'%3E%3Crect width='160' height='100' rx='12' fill='%232563eb'/%3E%3Ccircle cx='80' cy='50' r='26' fill='white'/%3E%3C/svg%3E"></ge-file-viewer>`,
            },
            {
                title: 'Your own toolbar and content',
                note: 'Put a `ge-file-viewer-toolbar` or `ge-file-viewer-content` directly inside and the built-in chrome is replaced entirely; the page and zoom are then yours to drive (`prevPage()`, `zoomIn()` and so on).',
                block: true,
                html: `<ge-file-viewer height="160px">
  <ge-file-viewer-toolbar>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem .75rem;border-bottom:1px solid var(--border)">
      <strong>My preview</strong><ge-badge>custom</ge-badge>
    </div>
  </ge-file-viewer-toolbar>
  <ge-file-viewer-content>
    <p style="padding:.75rem;margin:0;color:var(--muted-foreground)">Anything goes here.</p>
  </ge-file-viewer-content>
</ge-file-viewer>`,
            },
        ],
        api: [
            { name: 'file', type: 'File | Blob | null', default: 'null', description: 'Property: the file to render. Takes precedence over `src`.' },
            { name: 'src', type: 'string', default: "''", description: 'URL fetched and treated like `file`; subject to CORS.' },
            { name: 'type', type: "'pdf' | 'docx' | 'doc' | 'pptx' | 'ppt' | 'xlsx' | 'image' | 'text' | 'video' | 'audio'", default: "''", description: 'Forces a viewer instead of sniffing the bytes.' },
            { name: 'height', type: 'string', default: "'600px'", description: 'CSS height of the frame; the content scrolls inside it.' },
            { name: 'zoom / page', type: 'number', default: '1 / 1', description: 'Starting zoom factor and 1-based page or slide.' },
            { name: 'filename', type: 'string', default: "''", description: 'Overrides the name in the toolbar.' },
            { name: 'loaded / load-error', type: 'event', default: '-', description: '`detail` is `{ type, filename }` or `{ type, message }`.' },
            { name: 'page-change / zoom-change', type: 'event', default: '-', description: '`detail` is the new page or the clamped zoom factor.' },
            { name: 'prevPage() / nextPage() / zoomIn() / zoomOut() / setActiveSheet(i)', type: 'methods', default: '-', description: 'Drive it from code, for instance from a custom toolbar.' },
        ],
    },
    {
        id: 'page-builder',
        group: 'Apps & tools',
        name: 'Page builder',
        tag: 'ge-page-builder',
        description: 'A drag-and-drop page editor: a palette of your own components, a grid canvas, and a property editor that is drawn from each widget\'s own properties. Save emits a plain JSON document that `ge-page-renderer` turns back into a live page. Widgets are any custom element named by `tag`, so the palette can hold anything on the page.',
        examples: [
            {
                title: 'Build a page, then render it',
                note: 'Drag a palette entry onto the canvas (or press its Add button), select it, and edit its properties on the right. Save emits the document; the renderer below shows the saved page read-only, with a binding filling the badge from `context`.',
                block: true,
                html: `<div style="display:grid;gap:1rem;width:100%">
  <ge-page-builder id="pb1" style="height:560px"></ge-page-builder>
  <ge-page-renderer id="pr1" style="height:220px"></ge-page-renderer>
</div>
<script>(() => {
  const components = [
    { id: 'badge', name: 'Badge', category: 'Display', tag: 'ge-badge', icon: 'tag', defaultInputs: { label: 'New' }, defaultCols: 3, defaultRows: 2 },
    { id: 'stat', name: 'Stat card', category: 'Display', tag: 'ge-stat-card', icon: 'chart-column', defaultInputs: { label: 'Revenue', value: '$12,400' }, defaultCols: 4, defaultRows: 3 },
    { id: 'button', name: 'Button', category: 'Actions', tag: 'ge-button', icon: 'mouse-pointer-click', defaultInputs: { label: 'Click me' }, defaultCols: 3, defaultRows: 2 },
  ];
  const builder = document.getElementById('pb1');
  const renderer = document.getElementById('pr1');
  builder.components = components;
  renderer.components = components;
  renderer.context = { user: { plan: 'Pro' } };
  builder.addEventListener('save', (e) => {
    const data = structuredClone(e.detail);
    for (const item of data.items) if (item.componentId === 'badge') item.bindings = { label: 'user.plan' };
    renderer.data = data;
  });
})();</script>`,
            },
        ],
        api: [
            { name: 'components', type: 'ComponentMeta[]', default: '[]', description: 'Property: the palette. `tag` names the custom element to create; `defaultInputs`, `inputs` (schema overrides), `defaultCols` and `defaultRows` are optional.' },
            { name: 'data', type: 'PageData | null', default: 'null', description: 'Property: layout to load. A new value replaces the board; items whose `componentId` is not in `components` are dropped.' },
            { name: 'enable-save', type: 'boolean', default: 'true', description: 'Shows the Save button (`enable-save="false"` hides it).' },
            { name: 'enable-export', type: 'boolean', default: 'false', description: 'Shows Export, which downloads the layout as JSON; Import is always available.' },
            { name: 'save / view-mode-change', type: 'event', default: '-', description: '`detail` is the current `PageData`, or `\'edit\'` / `\'preview\'`.' },
            { name: 'ge-page-renderer: data / components / context', type: 'properties', default: '-', description: 'The read-only counterpart. A binding maps an input name to a dot-path in `context`; a path that resolves overrides the saved value.' },
        ],
    },
];

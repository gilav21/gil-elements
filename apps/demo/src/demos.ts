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

export const demos: Demo[] = [
    {
        id: 'badge',
        group: 'Rung 1 · Static',
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
        group: 'Rung 1 · Static',
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
        id: 'label',
        group: 'Rung 1 · Static',
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
  <input id="email" type="email" placeholder="you@example.com" style="padding:.4rem .6rem;border:1px solid var(--input);border-radius:6px;background:transparent;color:inherit">
</div>`,
                block: true,
            },
            {
                title: 'Label for a checkbox',
                note: 'Clicking the label toggles the box.',
                html: `<div style="display:flex;align-items:center;gap:.5rem">
  <input id="terms" type="checkbox">
  <ge-label for="terms">Accept terms and conditions</ge-label>
</div>`,
                block: true,
            },
        ],
        api: [{ name: 'for', type: 'string', default: '-', description: 'id of the control, looked up in the same tree as the label.' }],
    },
    {
        id: 'separator',
        group: 'Rung 1 · Static',
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
        group: 'Rung 1 · Static',
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
        group: 'Rung 1 · Static',
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
                note: 'Anything slotted replaces the built-in spinner.',
                html: `<ge-spinner><span style="font-size:1.5rem">⏳</span></ge-spinner>`,
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
        group: 'Rung 2 · Slots',
        name: 'Alert',
        tag: 'ge-alert',
        description: 'A callout. A leading icon goes in the `icon` slot, so the text sits beside it whatever the icon is.',
        examples: [
            {
                title: 'Variants',
                note: '`destructive` is announced assertively (`role="alert"`), `default` politely (`role="status"`).',
                block: true,
                html: `<div style="display:grid;gap:1rem;width:100%;max-width:32rem">
  <ge-alert heading="Heads up!" description="You can add components to your app.">
    <svg slot="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
  </ge-alert>
  <ge-alert variant="destructive" heading="Error" description="Your session has expired. Please log in again.">
    <svg slot="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
  </ge-alert>
</div>`,
            },
            {
                title: 'Composed',
                note: 'Slot `ge-alert-title` and `ge-alert-description` for full control, including paragraphs.',
                block: true,
                html: `<ge-alert style="max-width:32rem">
  <svg slot="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
  <ge-alert-title>Update available</ge-alert-title>
  <ge-alert-description>
    <p>A new version is ready.</p>
    <p>Restart to apply it.</p>
  </ge-alert-description>
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
        group: 'Rung 2 · Slots',
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
        group: 'Rung 2 · Slots',
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
                title: 'Composed, with an action and dividers',
                note: 'The `action` slot lands top-end beside the title; `bordered` adds the divider and its padding.',
                block: true,
                html: `<ge-card style="max-width:24rem">
  <ge-card-header bordered>
    <ge-card-title>Team plan</ge-card-title>
    <ge-card-description>Billed monthly</ge-card-description>
    <button slot="action">Edit</button>
  </ge-card-header>
  <ge-card-content>Up to 10 members, unlimited projects.</ge-card-content>
  <ge-card-footer bordered>
    <ge-badge variant="secondary" label="Active"></ge-badge>
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
        group: 'Rung 2 · Slots',
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
  <ge-empty-content><button>Create project</button></ge-empty-content>
</ge-empty>`,
            },
        ],
        api: [
            { name: 'ge-empty-media: variant', type: "'default' | 'icon'", default: "'default'", description: '`icon` draws a muted tile and sizes a slotted svg to 1.5rem.' },
        ],
    },
    {
        id: 'page-header',
        group: 'Rung 2 · Slots',
        name: 'Page header',
        tag: 'ge-page-header',
        description: 'A heading with a description and actions. The heading is a real `h1`–`h6`; the actions wrap under it when there is no room.',
        examples: [
            {
                title: 'Heading, description and actions',
                block: true,
                html: `<ge-page-header heading="Invoices" description="Manage and send invoices.">
  <button>Export</button>
  <button>New invoice</button>
</ge-page-header>`,
            },
            {
                title: 'With a breadcrumb and a lower heading level',
                note: '`heading-level` changes the element, not the size, so the outline stays right.',
                block: true,
                html: `<ge-page-header heading="Invoice 1042" heading-level="2" description="Issued 12 March.">
  <nav slot="breadcrumb">Home / Billing / Invoices</nav>
  <button>Download</button>
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
];

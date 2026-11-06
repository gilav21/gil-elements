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
        id: 'checkbox',
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 1 · Static',
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
        group: 'Rung 2 · Slots',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 2 · Slots',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        id: 'tabs',
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 4 · Overlays',
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
        group: 'Rung 4 · Overlays',
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
        ],
    },
    {
        id: 'sheet',
        group: 'Rung 4 · Overlays',
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
        ],
    },
    {
        id: 'drawer',
        group: 'Rung 4 · Overlays',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 4 · Overlays',
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
        ],
    },
    {
        id: 'tooltip',
        group: 'Rung 4 · Overlays',
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
        group: 'Rung 4 · Overlays',
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
        group: 'Rung 4 · Overlays',
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
        group: 'Rung 4 · Overlays',
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
        group: 'Rung 4 · Overlays',
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
        group: 'Rung 4 · Overlays',
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
        group: 'Rung 4 · Overlays',
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
        group: 'Rung 4 · Overlays',
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
                note: 'Press Ctrl+K (⌘K on a Mac), `/`, or use the button. `shortcut` takes comma-separated alternatives; add `no-shortcut` to turn the key off.',
                html: `<div style="display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start">
  <ge-button variant="outline" id="cmd-open" style="width: 15rem">Show command dialog</ge-button>
  <p style="margin: 0; font-size: 0.875rem; color: var(--muted-foreground)">Or press <ge-kbd>⌘</ge-kbd> <ge-kbd>K</ge-kbd> or <ge-kbd>/</ge-kbd></p>
</div>
<ge-command-dialog id="cmd-dialog" shortcut="Mod+K, /">
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 2 · Slots',
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
        group: 'Rung 2 · Slots',
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
        group: 'Rung 2 · Slots',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 4 · Overlays',
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
        group: 'Rung 4 · Overlays',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
                html: `<ge-code-block id="cb9" style="width:100%;min-width:0" language="shout" code="HELLO there, WORLD"></ge-code-block>
<script>(() => {
  document.getElementById('cb9').customLanguages = { shout: [{ type: 'keyword', regex: /\\b[A-Z]{2,}\\b/ }] };
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        id: 'file-upload',
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
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
        group: 'Rung 3 · Interactive',
        name: 'Sortable',
        tag: 'ge-sortable',
        description: 'A list you reorder by dragging, with the keyboard, or between lists. Write `ge-sortable-item`s yourself, or set `items` and `renderItem` and let it render them.',
        examples: [
            {
                title: 'Vertical list',
                note: 'Drag a row, or focus it and press Space, then the arrows (Home and End jump to the ends), then Space again; Escape puts it back. Each step is announced to screen readers. The list fires `reorder` with where the row came from and went.',
                html: `<style>.sx-card{box-sizing:border-box;width:100%;padding:.5rem .75rem;border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);background:var(--card);color:var(--card-foreground);font-size:.875rem}</style>
<ge-sortable id="sx1" style="max-width:20rem">
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
                html: `<ge-sortable orientation="horizontal" style="max-width:34rem">
  <ge-sortable-item><div class="sx-card" style="width:7rem;text-align:center">Mon</div></ge-sortable-item>
  <ge-sortable-item><div class="sx-card" style="width:7rem;text-align:center">Tue</div></ge-sortable-item>
  <ge-sortable-item><div class="sx-card" style="width:7rem;text-align:center">Wed</div></ge-sortable-item>
  <ge-sortable-item><div class="sx-card" style="width:7rem;text-align:center">Thu</div></ge-sortable-item>
</ge-sortable>`,
            },
            {
                title: 'Handle only',
                note: 'With `handle-only` a row drags from its `ge-sortable-handle` (or any `[data-sortable-handle]`), so its text stays selectable. Keyboard reordering still works from the row.',
                html: `<ge-sortable handle-only style="max-width:20rem">
  <ge-sortable-item><ge-sortable-handle><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--muted-foreground)"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg></ge-sortable-handle><div class="sx-card">Alpha</div></ge-sortable-item>
  <ge-sortable-item><ge-sortable-handle><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--muted-foreground)"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg></ge-sortable-handle><div class="sx-card">Beta</div></ge-sortable-item>
  <ge-sortable-item><ge-sortable-handle><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--muted-foreground)"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg></ge-sortable-handle><div class="sx-card">Gamma</div></ge-sortable-item>
</ge-sortable>`,
            },
            {
                title: 'Disabled',
                html: `<ge-sortable disabled style="max-width:20rem">
  <ge-sortable-item><div class="sx-card">Locked one</div></ge-sortable-item>
  <ge-sortable-item><div class="sx-card">Locked two</div></ge-sortable-item>
</ge-sortable>`,
            },
            {
                title: 'Data-driven',
                note: 'Set `items` and `renderItem`; every reorder arrives as a new array in `items-change` (your array is never mutated) and is written back to `items`. `trackBy` keeps each row\'s node, so the move animates.',
                html: `<ge-sortable id="sx2" style="max-width:20rem"></ge-sortable>
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
                html: `<ge-sortable id="sx4" style="max-width:20rem">
  <ge-sortable-item><div class="sx-card">Flash</div></ge-sortable-item>
  <ge-sortable-item><div class="sx-card">Pulse</div></ge-sortable-item>
  <ge-sortable-item><div class="sx-card">Glow</div></ge-sortable-item>
</ge-sortable>
<script>document.getElementById('sx4').landEffect = (item) => 'ge-sortable-land-' + item.textContent.trim().toLowerCase();</script>`,
            },
            {
                title: 'Custom ghost and placeholder',
                note: 'A `ge-sortable-ghost` replaces the faded copy shown at the drop gap and a `ge-sortable-placeholder` replaces the dashed box left at the lift origin. Their content is copied.',
                html: `<ge-sortable style="max-width:20rem">
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
                html: `<ge-sortable group="outline" list-id="root" style="max-width:22rem">
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
        group: 'Rung 3 · Interactive',
        name: 'Kanban',
        tag: 'ge-kanban',
        description: 'A board of columns and cards. Drag a card between columns; right-click or long-press for menus; Mod+Z undoes. The board is controlled: it reports every change as an event and waits for you to apply it.',
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
        id: 'charts',
        group: 'Rung 3 · Interactive',
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
            { name: 'show-tooltip / show-legend', type: 'boolean', default: 'true', description: 'The hover tooltip and, on the line chart, the legend.' },
            { name: 'point-click / bar-click / slice-click', type: 'CustomEvent', default: '-', description: '`detail` is `{ point, index }`.' },
            { name: 'point-hover / bar-hover / slice-hover', type: 'CustomEvent', default: '-', description: '`detail` is `{ point, index }`, or `null` when the pointer leaves.' },
            { name: 'ge-chart-legend', type: 'element', default: '-', description: '`items` (`{ key, label, color }`), `hiddenKeys`, `position`, `interactive`; fires `item-toggle` with the key.' },
            { name: 'ge-chart-tooltip', type: 'element', default: '-', description: '`visible`, `x`, `y`, `heading`, `rows` (`{ label, value, color? }`), `flip-x`, `flip-y`.' },
        ],
    },
];

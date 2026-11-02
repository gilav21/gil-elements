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
];

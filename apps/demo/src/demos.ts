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

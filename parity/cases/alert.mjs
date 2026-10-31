// shadcn-angular alert.component.ts (alertVariants), sub/alert-title.ts and sub/alert-description.ts
const BASE = 'relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:start-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:ps-7 block';
const DEFAULT = 'bg-background text-foreground';
// Angular merges the two with tailwind-merge, so the variant's svg colour replaces the base one.
const withoutSvgForeground = (base) => base.replace(' [&>svg]:text-foreground', '');
const DESTRUCTIVE = 'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive';
const TITLE = 'mb-1 block font-medium leading-none tracking-tight';
const DESC = 'block text-sm [&_p]:leading-relaxed';
const ICON = (attrs) => `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>`;
const ref = (variant, icon, body) =>
    `<div role="${variant === 'destructive' ? 'alert' : 'status'}" data-slot="alert" class="${variant === 'destructive' ? `${withoutSvgForeground(BASE)} ${DESTRUCTIVE}` : `${BASE} ${DEFAULT}`}">${icon ? ICON('class="size-4"') : ''}${body}</div>`;
const simple = `<ui-alert-title class="${TITLE}">Heads up!</ui-alert-title><ui-alert-description class="${DESC}">You can add components to your app.</ui-alert-description>`;
const W = 'width:26rem;';
export default {
    name: 'alert',
    items: [
        { id: 'default-icon', wrap: W, ref: ref('default', true, simple), el: `<ge-alert heading="Heads up!" description="You can add components to your app.">${ICON('slot="icon" width="16" height="16"')}</ge-alert>` },
        { id: 'destructive-icon', wrap: W, ref: ref('destructive', true, simple), el: `<ge-alert variant="destructive" heading="Heads up!" description="You can add components to your app.">${ICON('slot="icon" width="16" height="16"')}</ge-alert>` },
        { id: 'default-no-icon', wrap: W, ref: ref('default', false, simple), el: '<ge-alert heading="Heads up!" description="You can add components to your app."></ge-alert>' },
        {
            id: 'custom-paragraphs',
            wrap: W,
            ref: ref('default', true, `<ui-alert-title class="${TITLE}">Update available</ui-alert-title><ui-alert-description class="${DESC}"><p>A new version is ready. It includes fixes.</p><p>Restart to apply it.</p></ui-alert-description>`),
            el: `<ge-alert>${ICON('slot="icon" width="16" height="16"')}<ge-alert-title>Update available</ge-alert-title><ge-alert-description><p>A new version is ready. It includes fixes.</p><p>Restart to apply it.</p></ge-alert-description></ge-alert>`,
        },
    ],
};

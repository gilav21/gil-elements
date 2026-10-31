import { ref as buttonRef } from '../lib/button-ref.mjs';
// shadcn-angular empty.component.ts and sub/*.ts
const BOX = 'flex min-w-0 flex-1 flex-col items-center justify-center gap-4 sm:gap-6 rounded-lg border border-dashed p-4 sm:p-6 text-center text-balance md:p-12';
const HEADER = 'flex max-w-sm flex-col items-center gap-2 text-center';
const MEDIA = 'flex shrink-0 items-center justify-center mb-2 [&_svg]:pointer-events-none [&_svg]:shrink-0';
const MEDIA_ICON = 'bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg:not([class*="size-"])]:size-6';
const TITLE = 'text-lg font-medium tracking-tight';
const DESC = 'text-muted-foreground text-sm/relaxed [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4';
const CONTENT = 'flex flex-col items-center gap-3';
const FOLDER = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>';
const W = 'width:30rem;';
export default {
    name: 'empty',
    items: [
        {
            id: 'icon-full',
            wrap: W,
            ref: `<div data-slot="empty" class="${BOX}"><div data-slot="empty-header" class="${HEADER}"><div data-slot="empty-media" class='${MEDIA} ${MEDIA_ICON}'>${FOLDER}</div><div class="${TITLE}">No projects yet</div><p class="${DESC}">You have not created any projects. <a href="#">Learn more</a></p></div><div class="${CONTENT}">${buttonRef('default', 'default', 'Create project')}</div></div>`,
            el: `<ge-empty><ge-empty-header><ge-empty-media variant="icon">${FOLDER}</ge-empty-media><ge-empty-title>No projects yet</ge-empty-title><ge-empty-description>You have not created any projects. <a href="#">Learn more</a></ge-empty-description></ge-empty-header><ge-empty-content><ge-button>Create project</ge-button></ge-empty-content></ge-empty>`,
        },
        {
            id: 'text-only',
            wrap: W,
            ref: `<div data-slot="empty" class="${BOX}"><div class="${HEADER}"><div class="${TITLE}">Nothing here</div><p class="${DESC}">Try another search.</p></div></div>`,
            el: '<ge-empty><ge-empty-header><ge-empty-title>Nothing here</ge-empty-title><ge-empty-description>Try another search.</ge-empty-description></ge-empty-header></ge-empty>',
        },
    ],
};

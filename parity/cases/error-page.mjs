// shadcn-angular error-page.component.html, sub/error-page-{illustration,actions}.component.html and error-page.locales.ts
import { ref as buttonRef } from '../lib/button-ref.mjs';
const PAGE = 'flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 p-4 text-center sm:min-h-[70vh] sm:gap-6 sm:p-6';
const CODE = (code) => `<div class="text-6xl font-bold tracking-tight text-muted-foreground sm:text-8xl" data-slot="error-page-code" aria-hidden="true">${code}</div>`;
const ACTIONS = (back, home) =>
    `<div class="flex w-full flex-wrap items-center justify-center gap-2" data-slot="error-page-actions">${buttonRef('outline', 'default', back, { host: 'data-slot="error-page-back"' })}${buttonRef('default', 'default', home, { host: 'data-slot="error-page-home"' })}</div>`;
const page = ({ title, description, illustration = null, actions = null, back = 'Go back', home = 'Go home', code = '404', dir = '' }) =>
    `<ui-error-page class="contents" data-slot="error-page-host"><div class="${PAGE}"${dir ? ` dir="${dir}"` : ''} data-slot="error-page">${illustration ?? CODE(code)}<h1 class="text-2xl font-semibold text-balance sm:text-3xl" data-slot="error-page-title">${title}</h1><p class="max-w-prose text-sm text-muted-foreground text-balance sm:text-base" data-slot="error-page-description">${description}</p>${actions ?? ACTIONS(back, home)}</div></ui-error-page>`;

const NOT_FOUND = { title: 'Page not found', description: "The page you're looking for doesn't exist or has moved." };
const ART = '<svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M8 15c1.5-2 6.5-2 8 0M9 9h.01M15 9h.01"/></svg>';
const illustration = `<ui-error-page-illustration class="contents"><div class="flex max-w-full items-center justify-center [&_img]:max-w-full [&_svg]:max-w-full" data-slot="error-page-illustration">${ART}</div></ui-error-page-illustration>`;
const actions = `<ui-error-page-actions class="contents"><div class="flex w-full flex-wrap items-center justify-center gap-2" data-slot="error-page-actions">${buttonRef('default', 'default', 'Try again')}</div></ui-error-page-actions>`;
const WRAP = 'display:block;width:640px;';

export default {
    name: 'error-page',
    items: [
        { id: '404', wrap: WRAP, ref: page(NOT_FOUND), el: '<ge-error-page></ge-error-page>' },
        { id: '403', wrap: WRAP, ref: page({ code: '403', title: 'Access denied', description: "You don't have permission to view this page." }), el: '<ge-error-page code="403"></ge-error-page>' },
        { id: '500', wrap: WRAP, ref: page({ code: '500', title: 'Server error', description: 'Something broke on our end. We have been notified.' }), el: '<ge-error-page code="500"></ge-error-page>' },
        { id: 'unknown-code', wrap: WRAP, ref: page({ code: '418', title: 'Something went wrong', description: 'An unexpected error occurred. Please try again.' }), el: '<ge-error-page code="418"></ge-error-page>' },
        { id: 'custom-copy', wrap: WRAP, ref: page({ title: 'Lost in space', description: 'Try the map.' }), el: '<ge-error-page heading="Lost in space" description="Try the map."></ge-error-page>' },
        { id: 'illustration-and-actions', wrap: WRAP, ref: page({ ...NOT_FOUND, illustration, actions }), el: `<ge-error-page><ge-error-page-illustration>${ART}</ge-error-page-illustration><ge-error-page-actions><ge-button>Try again</ge-button></ge-error-page-actions></ge-error-page>` },
        { id: 'hebrew', wrap: WRAP, ref: page({ code: '403', title: 'הגישה נחסמה', description: 'אין לכם הרשאה לצפות בדף הזה.', back: 'חזרה', home: 'לדף הבית', dir: 'rtl' }), el: '<ge-error-page code="403" locale="he"></ge-error-page>' },
        { id: 'narrow', wrap: 'display:block;width:320px;', ref: page(NOT_FOUND), el: '<ge-error-page></ge-error-page>' },
    ],
};

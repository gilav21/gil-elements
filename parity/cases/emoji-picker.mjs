// shadcn-angular emoji-picker.component.ts and sub/emoji-picker-{trigger,content}.component.ts (absolute strategy, as promoted
// to the top layer: the harness shows the panel in place). The data is read from the ported tables, which are verbatim copies.
import { readFileSync } from 'node:fs';
import { ref as button } from '../lib/button-ref.mjs';

const dir = new URL('../../packages/elements/src/emoji-picker/', import.meta.url);
const table = (file, name) => new Function(`${readFileSync(new URL(file, dir), 'utf8').replace(/export interface[\s\S]*?\r?\n}\r?\n/, '').replace(/export const (\w+)(: [^=]+)? =/, 'const $1 =')}; return ${name};`)();
const CATEGORIES = table('emoji-picker.categories.ts', 'EMOJI_CATEGORIES');
const DATA = table('emoji-picker.keywords.ts', 'EMOJI_DATA');

const label = (emoji) => (DATA[emoji]?.length ? DATA[emoji].slice(0, 3).join(' ') : emoji);
const PANEL = 'absolute start-0 top-full z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] p-3 rounded-md border bg-popover text-popover-foreground shadow-md outline-none overflow-hidden animate-in fade-in-0 zoom-in-95';
const TAB = 'size-8 flex items-center justify-center text-lg rounded-md transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring';
const CELL = 'size-8 flex items-center justify-center text-xl rounded-md hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1';
const GROUP = 'group/input-group relative flex w-full items-center transition-[color,box-shadow] outline-none min-w-0 has-[input:focus-visible]:ring-[3px] rounded-md border border-input shadow-xs has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-ring/50 min-w-0';
const ADDON = 'text-muted-foreground flex h-auto items-center justify-center gap-2 text-sm font-medium select-none [&>svg:not([class*=size-])]:size-4';
const INPUT = 'border-input aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-transparent transition-colors md:text-sm placeholder:text-muted-foreground w-full min-w-0 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 border-none shadow-none focus-visible:ring-0 px-0 text-sm';
const SEARCH = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';

const section = (c) =>
    `<div class="mb-4 [content-visibility:auto] [contain-intrinsic-size:auto_320px]" data-category="${c.id}"><div class="text-xs font-medium text-muted-foreground mb-2 sticky top-0 bg-popover py-1">${c.name}</div><div class="grid grid-cols-8 gap-0.5">${c.emojis.map((e) => `<button type="button" class="${CELL}" aria-label="${label(e)}">${e}</button>`).join('')}</div></div>`;
const panel = (thumb) =>
    `<ui-emoji-picker-content class="contents"><div class="${PANEL.replace(' p-3', '')}" style="padding:calc(0.75rem * var(--density, 1))" data-slot="emoji-picker-content" data-state="open"><div class="flex flex-col" style="gap:calc(0.75rem * var(--density, 1))">` +
    `<ui-input-group class="contents"><fieldset class="${GROUP}" data-slot="input-group"><ui-input-group-addon class="contents"><div class="${ADDON}" data-slot="input-group-addon" data-align="inline-start">${SEARCH}</div></ui-input-group-addon>` +
    `<ui-input class="contents"><input class="${INPUT}" type="text" placeholder="Search emojis..." data-slot="input"></ui-input></fieldset></ui-input-group>` +
    `<div class="flex gap-1 pb-2 border-b border-border">${CATEGORIES.map((c, i) => `<button type="button" class="${TAB}${i === 0 ? ' bg-accent' : ''}">${c.icon}</button>`).join('')}</div>` +
    `<ui-scroll-area class="h-64"><div class="relative overflow-hidden h-64" data-slot="scroll-area"><div class="size-full rounded-[inherit] overflow-auto scrollbar-none focus-visible:ring-ring/50 transition-[color,box-shadow] outline-none focus-visible:ring-[3px]" data-slot="scroll-area-viewport" tabindex="0"><div class="pe-3">${CATEGORIES.map(section).join('')}</div></div>` +
    `<div class="absolute end-0 top-0 flex touch-none p-px transition-colors select-none h-full w-2.5 border-s border-s-transparent" data-slot="scroll-area-scrollbar" data-orientation="vertical"><div class="bg-border relative w-full rounded-full" data-slot="scroll-area-thumb" style="height:${thumb}%;top:0%"></div></div></div></ui-scroll-area>` +
    '</div></div></ui-emoji-picker-content>';

const ref = ({ open = false, thumb = 0, trigger = button('outline', 'default', 'Pick') } = {}) =>
    `<ui-emoji-picker class="contents"><div class="relative inline-block" data-slot="emoji-picker"><ui-emoji-picker-trigger class="contents"><span class="" data-slot="emoji-picker-trigger">${trigger}</span></ui-emoji-picker-trigger>${open ? panel(thumb) : ''}</div></ui-emoji-picker>`;
const el = ({ open = false } = {}) =>
    `<ge-emoji-picker${open ? ' open' : ''}><ge-emoji-picker-trigger><ge-button variant="outline">Pick</ge-button></ge-emoji-picker-trigger><ge-emoji-picker-content></ge-emoji-picker-content></ge-emoji-picker>`;

const W = 'width:400px;height:420px;padding:0 0 0 12px;box-sizing:content-box;';
export default {
    name: 'emoji-picker',
    items: [
        { id: 'closed', wrap: 'width:12rem;', ref: ref(), el: el() },
        { id: 'open', wrap: W, ref: ref({ open: true, thumb: 10 }), el: el({ open: true }) },
        { id: 'open-density-1.5', wrap: `${W}--density:1.5;`, ref: ref({ open: true, thumb: 10 }), el: el({ open: true }) },
        { id: 'open-rtl', wrap: `${W}direction:rtl;`, ref: `<div dir="rtl">${ref({ open: true, thumb: 10 })}</div>`, el: `<div dir="rtl">${el({ open: true })}</div>` },
    ],
};

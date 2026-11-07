// shadcn-angular color-picker.component.html and .ts (inline panel and trigger), with ui-tabs, ui-input and ui-eyedropper as they render inside it.
import { BASE, VARIANT } from './input.mjs';

const SVG = (paths, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${paths}</svg>`;
const ICON = (name, size, paths) => `<ui-icon class="${size}">${SVG(paths, `class="ui-icon ui-icon-${name} ${size}" data-slot="icon"`)}</ui-icon>`;
const COPY = (size = 'h-4 w-4') => ICON('copy', size, '<rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />');
const CHECK = (size) => ICON('check', size, '<path d="m4 12.5 5 5L20 6.5" />');
const PIPETTE = ICON('pipette', 'h-4 w-4', '<path d="m16 3 5 5-2 2-5-5z" /><path d="m14 9-9 9v3h3l9-9" />');
const PIPETTE_IMAGE = ICON('pipette-image', 'h-4 w-4', '<rect width="13" height="13" x="2" y="9" rx="2" /><circle cx="6" cy="13" r="1.5" /><path d="m2 19 4-4 3 3 3-3 3 3" /><g transform="translate(11 1) scale(0.5)" stroke-width="3.2"><path d="m2 22 1-1h3l9-9" /><path d="M3 21v-3l9-9" /><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" /></g>');
const CHEVRON = ICON('chevron-down', 'h-4 w-4 opacity-50', '<path d="m5 9 7 7 7-7" />');

const TOOL = 'inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
const EYEDROPPER = `<ui-eyedropper class="inline-block"><button type="button" class="${TOOL} disabled:cursor-not-allowed disabled:opacity-50" aria-label="Pick color" aria-pressed="false" title="Pick color" dir="ltr" data-slot="eyedropper-trigger">${PIPETTE}</button></ui-eyedropper>`;
const MONO = 'font-mono';
const INPUT = (extra, attrs) => `<ui-input class="contents"><input class="${BASE.replace('text-base ', '')} ${VARIANT.outline} ${extra}" ${attrs} data-slot="input"></ui-input>`;

const LIST = 'items-center rounded-lg bg-muted p-1 text-muted-foreground flex justify-start w-full h-8 gap-1';
const TRIGGER = 'inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-xs uppercase';
const CONTENT = 'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
const COPY_BUTTON = (size, label, copy = COPY()) => `<button type="button" class="inline-flex ${size} pointer-coarse:size-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground" aria-label="${label}">${copy}</button>`;

const channels = (letters, labels, values, max) =>
    `<div class="grid grid-cols-3 gap-2">${letters.map((l, i) => `<div><span class="text-xs text-muted-foreground" aria-hidden="true">${l}</span>${INPUT('h-8 text-xs', `type="number" min="0" max="${max[i]}" aria-label="${labels[i]}" value="${values[i]}"`)}</div>`).join('')}</div>`;
const VALUE = (text) => `<span class="flex-1 truncate text-xs font-mono text-muted-foreground">${text}</span>`;
const PANELS = {
    hex: (c) => `<div class="flex items-center gap-1">${INPUT('h-8 text-xs font-mono flex-1', `type="text" placeholder="#000000" value="${c.hex}"`)}${COPY_BUTTON('h-8 w-8', 'Copy hex')}</div>`,
    rgb: (c) => `<div class="space-y-2">${channels(['R', 'G', 'B'], ['Red', 'Green', 'Blue'], [c.r, c.g, c.b], [255, 255, 255])}<div class="flex items-center gap-1">${VALUE(c.rgb)}${COPY_BUTTON('h-7 w-7', 'Copy rgb')}</div></div>`,
    hsl: (c) => `<div class="space-y-2">${channels(['H', 'S', 'L'], ['Hue', 'Saturation', 'Lightness'], [c.h, c.s, c.l], [360, 100, 100])}<div class="flex items-center gap-1">${VALUE(c.hsl)}${COPY_BUTTON('h-7 w-7', 'Copy hsl')}</div></div>`,
    oklch: (c) => `<div class="flex items-center gap-1">${VALUE(c.oklch)}${COPY_BUTTON('h-7 w-7', 'Copy oklch')}</div>`,
};
const tabs = (formats, c) =>
    `<ui-tabs class="contents"><div class="w-full" data-slot="tabs"><ui-tabs-list class="contents"><div role="tablist" class="${LIST}" data-slot="tabs-list">${formats
        .map((f, i) => `<ui-tabs-trigger class="contents"><button type="button" role="tab" aria-selected="${i === 0}" data-state="${i === 0 ? 'active' : 'inactive'}" tabindex="${i === 0 ? 0 : -1}" class="${TRIGGER} ${i === 0 ? 'bg-background text-foreground shadow' : 'hover:bg-background/50'}" data-slot="tabs-trigger">${f}</button></ui-tabs-trigger>`)
        .join('')}</div></ui-tabs-list>${formats.map((f, i) => `<ui-tabs-content class="contents">${i === 0 ? `<div role="tabpanel" tabindex="0" class="${CONTENT}" data-slot="tabs-content">${PANELS[f](c)}</div>` : ''}</ui-tabs-content>`).join('')}</div></ui-tabs>`;

const SWATCH = 'aspect-square w-6 rounded border cursor-pointer hover:scale-110 transition-transform';
const LEGEND = 'text-xs text-muted-foreground p-0';
const FIELDSET = 'space-y-1 border-0 p-0 m-0';
const fieldset = (legend, body) => `<fieldset class="${FIELDSET}"><legend class="${LEGEND}">${legend}</legend>${body}</fieldset>`;
const list = (label, buttons) => `<ul class="flex flex-wrap gap-1 list-none p-0 m-0" aria-label="${label}">${buttons.map((b) => `<li>${b}</li>`).join('')}</ul>`;

const BLUE = { hex: '#3366cc', r: 51, g: 102, b: 204, h: 220, s: 60, l: 50, rgb: 'rgb(51, 102, 204)', hsl: 'hsl(220, 60%, 50%)', oklch: 'oklch(53.2% 0.168 262.3)' };
const HARMONIES = [
    ['Readable', ['#ffffff', '#000000']],
    ['Opposite', ['#3366cc', '#cc9933']],
    ['Neighbors', ['#33b2cc', '#3366cc', '#4c33cc']],
    ['Trio', ['#3366cc', '#cc3366', '#66cc33']],
    ['Quartet', ['#3366cc', '#cc33b2', '#cc9933', '#33cc4d']],
];

const panel = ({ color = BLUE, formats = ['hex', 'rgb', 'hsl'], eyedropper = false, imagePick = false, alpha = false, presets = [], recents = [], extracted = [], harmonies = false, contrast = false }) => {
    const parts = [];
    if (eyedropper || imagePick) {
        parts.push(`<div class="flex items-center justify-end gap-1">${eyedropper ? EYEDROPPER : ''}${imagePick ? `<button type="button" class="${TOOL}" aria-label="Pick color from image" data-slot="image-pick-trigger">${PIPETTE_IMAGE}</button>` : ''}</div>`);
    }
    parts.push(`<div class="relative h-32 w-full cursor-crosshair rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" style="touch-action: none; background: linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(220, 100%, 50%));" tabindex="0" role="slider" aria-label="Saturation and value" aria-valuenow="75" aria-valuemin="0" aria-valuemax="100" aria-valuetext="S 75%, V 80%"><div class="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm pointer-events-none" style="left: 75%; top: 20%; background-color: ${color.hex};"></div></div>`);
    parts.push(`<div class="space-y-1"><label for="ui-color-picker-hue" class="text-xs text-muted-foreground">Hue</label><input id="ui-color-picker-hue" type="range" min="0" max="360" value="220" aria-label="Hue" class="w-full h-3 rounded-md cursor-pointer appearance-none" style="background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);"></div>`);
    if (alpha) {
        parts.push(`<div class="space-y-1"><label for="ui-color-picker-alpha" class="text-xs text-muted-foreground">Alpha</label><div class="relative h-3 w-full rounded-md ui-color-picker-checker"><input id="ui-color-picker-alpha" type="range" min="0" max="100" step="1" value="100" aria-label="Alpha" class="absolute inset-0 w-full h-3 rounded-md cursor-pointer appearance-none" style="background: linear-gradient(to right, rgba(51,102,204,0), rgba(51,102,204,1));"></div></div>`);
    }
    if (recents.length) {
        parts.push(fieldset('Recent', list('Recent colors', recents.map((c) => `<button type="button" class="${SWATCH} ui-color-picker-checker" style="background-color: ${c};" aria-label="Apply recent ${c}"></button>`))).replace(`<fieldset class="${FIELDSET}">`, `<fieldset class="${FIELDSET}">`));
    }
    if (extracted.length) {
        parts.push(`<fieldset class="${FIELDSET}"><div class="flex items-center justify-between"><legend class="${LEGEND}">From image</legend><button type="button" class="text-xs text-muted-foreground hover:text-foreground">Clear</button></div>${list('Extracted palette', extracted.map((c) => `<button type="button" class="${SWATCH}" style="background-color: ${c};" aria-label="Apply extracted ${c}"></button>`))}</fieldset>`);
    }
    if (presets.length) {
        parts.push(fieldset('Presets', `<div class="flex flex-wrap gap-1">${presets.map((c) => `<button type="button" data-color-btn class="${SWATCH}${c === color.hex ? ' ring-2 ring-primary' : ''}" style="background-color: ${c};" aria-label="Select ${c}"></button>`).join('')}</div>`));
    }
    if (harmonies) {
        parts.push(fieldset('Harmonies', `<div class="space-y-1">${HARMONIES.map(([label, swatches]) => `<div class="flex items-center gap-2"><span class="w-20 text-[10px] text-muted-foreground cursor-help underline decoration-dotted underline-offset-2">${label}</span><div class="flex items-center gap-1">${swatches.map((c) => `<button type="button" class="relative aspect-square w-5 rounded border cursor-pointer hover:scale-110 transition-transform" style="background-color: ${c};" aria-label="Copy ${c}"></button>`).join('')}</div></div>`).join('')}</div>`));
    }
    if (contrast) {
        const slot = (which, hex, active) => `<button type="button" class="flex flex-col items-center gap-0.5 rounded p-1 transition focus:outline-none${active ? ' ring-2 ring-ring' : ''}" aria-label="Edit color ${which} ${hex}"><span class="block h-6 w-6 rounded border" style="background-color: ${hex};"></span><span class="font-mono text-[9px] text-muted-foreground">${hex}</span></button>`;
        parts.push(`<div class="mt-3 flex items-center justify-between gap-2 rounded-md border border-input px-2 py-1.5"><div class="flex items-center gap-2 min-w-0">${slot('A', '#3366cc', true)}<span class="text-xs text-muted-foreground shrink-0">vs</span>${slot('B', '#ffffff', false)}</div><div class="flex items-center gap-2 shrink-0"><span class="font-mono text-xs">5.37:1</span><span class="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-green-500 text-white">AA</span></div></div>`);
    }
    parts.push(tabs(formats, color));
    return `<div class="flex flex-col gap-3">${parts.join('')}</div>`;
};
const refPanel = (opts) => `<ui-color-picker class="inline-block">${panel(opts)}</ui-color-picker>`;

const elPanel = ({ formats, eyedropper = false, imagePick = false, alpha = false, presets = [], recents = [], extracted = [], harmonies = false, contrast = false } = {}) =>
    `<ge-color-picker inline value="#3366cc"${formats ? ` formats="${formats.join(' ')}"` : ''}${eyedropper ? ' data-fallback' : ' enable-eyedropper="false"'}${imagePick ? ' enable-image-pick' : ''}${alpha ? ' alpha' : ''}${presets.length ? ` presets='${JSON.stringify(presets)}'` : ''}${recents.length ? ` data-recents='${JSON.stringify(recents)}'` : ''}${extracted.length ? ` data-extracted='${JSON.stringify(extracted)}'` : ''}${harmonies ? ' show-harmonies' : ''}${contrast ? ' show-contrast' : ''} show-recent="${recents.length ? 'true' : 'false'}"></ge-color-picker>`;

const TRIGGER_BUTTON = (hex, disabled) =>
    `<button type="button" class="flex w-full items-center rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2${disabled ? ' cursor-not-allowed opacity-50' : ''}" ${disabled ? 'disabled' : ''} data-slot="color-picker-trigger"><span class="h-6 w-6 rounded border ui-color-picker-checker" style="background-color: ${hex};"></span><span class="flex-1 text-start text-sm truncate font-mono">${hex}</span>${CHEVRON}</button>`;
const refTrigger = (hex, disabled = false) =>
    `<ui-color-picker class="inline-block"><ui-popover class="relative inline-block" data-slot="popover" dir="ltr"><ui-popover-trigger class="contents"><span class="" data-slot="popover-trigger">${TRIGGER_BUTTON(hex, disabled)}</span></ui-popover-trigger></ui-popover></ui-color-picker>`;
const elTrigger = (attrs = '') => `<ge-color-picker enable-eyedropper="false" ${attrs}></ge-color-picker>`;

const W = 'width:20rem;';
const PRESETS = ['#3366cc', '#ef4444', '#22c55e', '#f59e0b'];
export default {
    name: 'color-picker',
    items: [
        { id: 'trigger', wrap: W, ref: refTrigger('#3366cc'), el: elTrigger('value="#3366cc"') },
        { id: 'trigger-disabled', wrap: W, ref: refTrigger('#3366cc', true), el: elTrigger('value="#3366cc" disabled') },
        { id: 'trigger-alpha', wrap: W, ref: refTrigger('#3366cc80'), el: elTrigger('value="#3366cc80" alpha') },
        { id: 'trigger-density-1.5', wrap: `${W}--density:1.5;`, ref: refTrigger('#3366cc'), el: elTrigger('value="#3366cc"') },
        { id: 'trigger-focus', wrap: W, focus: { ref: 'button', el: 'button' }, ref: refTrigger('#3366cc'), el: elTrigger('value="#3366cc"') },
        { id: 'panel', wrap: W, ref: refPanel({}), el: elPanel() },
        { id: 'panel-toolbar', wrap: W, ref: refPanel({ eyedropper: true, imagePick: true }), el: elPanel({ eyedropper: true, imagePick: true }) },
        { id: 'panel-alpha', wrap: W, ref: refPanel({ alpha: true }), el: elPanel({ alpha: true }) },
        { id: 'panel-presets', wrap: W, ref: refPanel({ presets: PRESETS }), el: elPanel({ presets: PRESETS }) },
        { id: 'panel-recents', wrap: W, ref: refPanel({ recents: ['#ef4444', '#22c55e80'] }), el: elPanel({ recents: ['#ef4444', '#22c55e80'] }) },
        { id: 'panel-extracted', wrap: W, ref: refPanel({ extracted: ['#e03030', '#3050e0'] }), el: elPanel({ extracted: ['#e03030', '#3050e0'] }) },
        { id: 'panel-harmonies', wrap: W, ref: refPanel({ harmonies: true }), el: elPanel({ harmonies: true }) },
        { id: 'panel-contrast', wrap: W, ref: refPanel({ contrast: true }), el: elPanel({ contrast: true }) },
        { id: 'panel-rgb', wrap: W, ref: refPanel({ formats: ['rgb', 'hsl', 'hex'] }), el: elPanel({ formats: ['rgb', 'hsl', 'hex'] }) },
        { id: 'panel-hsl', wrap: W, ref: refPanel({ formats: ['hsl', 'oklch'] }), el: elPanel({ formats: ['hsl', 'oklch'] }) },
        { id: 'panel-oklch', wrap: W, ref: refPanel({ formats: ['oklch', 'hex'] }), el: elPanel({ formats: ['oklch', 'hex'] }) },
        { id: 'panel-area-focus', wrap: W, focus: { ref: '[role=slider]', el: '.area' }, ref: refPanel({}), el: elPanel() },
        { id: 'panel-rtl', wrap: W, ref: `<div dir="rtl">${refPanel({ presets: PRESETS })}</div>`, el: `<div dir="rtl">${elPanel({ presets: PRESETS })}</div>` },
    ],
};

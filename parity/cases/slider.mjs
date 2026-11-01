// shadcn-angular slider.component.html and .ts (classes, percentage).
const ROOT = 'relative flex w-full touch-none select-none items-center';
const THUMB = 'absolute block rounded-full border border-primary/50 bg-background shadow transition-colors peer-focus-visible:outline-none peer-focus-visible:ring-1 peer-focus-visible:ring-ring cursor-grab active:cursor-grabbing';

const ref = ({ value = 0, min = 0, max = 100, disabled = false, rtl = false } = {}) => {
    const percent = ((value - min) / (max - min)) * 100;
    const fillSide = rtl ? 'right:0;left:auto' : 'left:0;right:auto';
    const thumbSide = rtl ? `right:${percent}%;left:auto` : `left:${percent}%;right:auto`;
    const body = `<ui-slider class="contents"><div class="${ROOT}${disabled ? ' opacity-50 pointer-events-none' : ''}" data-slot="slider"><input type="range" class="peer sr-only" min="${min}" max="${max}" step="1" value="${value}" ${disabled ? 'disabled' : ''} aria-label="Volume"><div data-slot="slider-track" class="relative w-full grow overflow-hidden rounded-full bg-primary/20 cursor-pointer"><div class="absolute h-full bg-primary pointer-events-none" style="${fillSide};width:${percent}%"></div></div><div data-slot="slider-thumb" class="${THUMB}" style="${thumbSide};transform:translateX(${rtl ? '50%' : '-50%'})"></div></div></ui-slider>`;
    return rtl ? `<div dir="rtl">${body}</div>` : body;
};
const el = ({ value = 0, min = 0, max = 100, disabled = false, rtl = false } = {}) => {
    const tag = `<ge-slider aria-label="Volume"${value ? ` value="${value}"` : ''}${min === 0 ? '' : ` min="${min}"`}${max === 100 ? '' : ` max="${max}"`}${disabled ? ' disabled' : ''}></ge-slider>`;
    return rtl ? `<div dir="rtl">${tag}</div>` : tag;
};

const W = 'width:240px;';
const pair = (id, props, extra = {}) => ({ id, wrap: W + (extra.wrap ?? ''), ref: ref(props), el: el(props), ...extra, ...(extra.wrap ? { wrap: W + extra.wrap } : {}) });
const focus = { ref: 'input', el: 'input' };
export default {
    name: 'slider',
    items: [
        pair('start', { value: 0 }),
        pair('middle', { value: 50 }),
        pair('end', { value: 100 }),
        pair('quarter', { value: 25 }),
        pair('custom-range', { value: 7, min: 5, max: 15 }),
        pair('disabled', { value: 40, disabled: true }),
        pair('rtl-30', { value: 30, rtl: true }),
        pair('rtl-end', { value: 100, rtl: true }),
        pair('focus', { value: 60 }, { focus }),
        pair('density-1.5', { value: 60 }, { wrap: '--density:1.5;' }),
        pair('density-0.75', { value: 60 }, { wrap: '--density:0.75;' }),
    ],
};

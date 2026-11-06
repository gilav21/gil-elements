import { ref as buttonRef } from '../lib/button-ref.mjs';
// shadcn-angular speed-dial.component.ts and sub/*.ts: the class strings and inline styles Angular renders, copied.
// Items are round buttons like the Angular demo's, so the case also exercises ge-button's ::part(base) styling.
const PLUS = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';
const PENCIL = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';

const round = (html) => html.replace(/\brounded-lg\b/, 'rounded-full');
const FAB = (open) => `<ui-speed-dial-trigger class="contents"><span tabindex="0" role="button" class="inline-flex transition-transform duration-200${open ? ' rotate-45' : ''}" aria-label="Toggle speed dial" data-slot="speed-dial-trigger" data-state="${open ? 'open' : 'closed'}">${round(buttonRef('default', 'icon', PLUS, { extra: 'rounded-full h-12 w-12 shadow-lg' }))}</span></ui-speed-dial-trigger>`;
const ACTION = () => round(buttonRef('secondary', 'icon-sm', PENCIL, { extra: 'rounded-full' }));

const LINEAR = {
    up: 'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex flex-col-reverse gap-2',
    down: 'absolute top-full left-1/2 -translate-x-1/2 mt-2 flex flex-col gap-2',
    left: 'absolute right-full top-1/2 -translate-y-1/2 mr-2 flex flex-row-reverse gap-2 max-w-[calc(100vw-2rem)]',
    right: 'absolute left-full top-1/2 -translate-y-1/2 ml-2 flex flex-row gap-2 max-w-[calc(100vw-2rem)]',
};
const RANGES = {
    'semi-circle': { up: [-180, 0], down: [0, 180], left: [90, 270], right: [-90, 90], other: [180, 360] },
    'quarter-circle': { 'up-right': [270, 360], 'up-left': [180, 270], 'down-right': [0, 90], 'down-left': [90, 180], other: [270, 360] },
};
const position = (type, direction, radius, index, total) => {
    const [start, end] = type === 'circle' ? [0, 360] : (RANGES[type][direction] ?? RANGES[type].other);
    const steps = type === 'circle' ? total : Math.max(total - 1, 1);
    const radians = ((start + index * ((end - start) / steps)) * Math.PI) / 180;
    return [Math.cos(radians) * radius, Math.sin(radians) * radius];
};

const ref = ({ type = 'linear', direction = 'up', radius = 80, count = 3, open = false, mask = false, trigger = FAB(open) }) => {
    // Angular puts neither the trigger nor an anchored menu above its `z-40` mask, so an open dial is dimmed under it; the proposed fix is `z-50` on both while open.
    const above = mask && open;
    const menuClass = (type === 'linear' ? (LINEAR[direction] ?? LINEAR.up) : 'absolute inset-0') + (open ? '' : ' pointer-events-none') + (above ? ' z-50' : '');
    if (above) trigger = trigger.replace('class="inline-flex', 'class="relative z-50 inline-flex');
    const items = Array.from({ length: count }, (_, i) => {
        const circular = type !== 'linear';
        const delay = (open ? i : count - 1 - i) * 80;
        const easing = open ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' : 'cubic-bezier(0.4, 0, 0.2, 1)';
        const duration = open ? '300ms' : '200ms';
        let style = `transition: all ${duration} ${easing}; transition-delay: ${delay}ms;`;
        if (circular) {
            const [x, y] = open ? position(type, direction, radius, i, count) : [0, 0];
            style = `transform: translate(${x}px, ${y}px); transition: transform ${duration} ${easing}, opacity ${duration} ${easing}, scale ${duration} ${easing}; transition-delay: ${delay}ms; left: 50%; top: 50%; margin-left: -1.125rem; margin-top: -1.125rem;`;
        }
        return `<ui-speed-dial-item class="contents"><div class="${circular ? 'absolute ' : ''}${open ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}" style="${style}" data-slot="speed-dial-item" data-state="${open ? 'open' : 'closed'}">${ACTION()}</div></ui-speed-dial-item>`;
    }).join('');
    const menu = `<ui-speed-dial-menu class="contents"><div role="group" class="${menuClass}" data-slot="speed-dial-menu" data-state="${open ? 'open' : 'closed'}" aria-hidden="${!open}"${open ? '' : ' inert=""'}>${items}</div></ui-speed-dial-menu>`;
    const maskHtml = mask && open ? '<ui-speed-dial-mask class="contents"><div class="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm animate-in fade-in-0" tabindex="0" role="button" aria-label="Close" data-slot="speed-dial-mask"></div></ui-speed-dial-mask>' : '';
    return `<div style="position:relative;width:260px;height:260px"><ui-speed-dial class="relative inline-flex" data-slot="speed-dial" data-state="${open ? 'open' : 'closed'}" style="position:absolute;left:106px;top:106px">${maskHtml}${trigger}${menu}</ui-speed-dial></div>`;
};

const STYLE = '<style>.fab::part(base){border-radius:9999px;width:3rem;height:3rem;box-shadow:0 10px 15px -3px rgb(0 0 0 / 0.1),0 4px 6px -4px rgb(0 0 0 / 0.1)}.fab::part(base):focus-visible{box-shadow:0 0 0 3px color-mix(in oklab,var(--ring) 50%,transparent),0 10px 15px -3px rgb(0 0 0 / 0.1),0 4px 6px -4px rgb(0 0 0 / 0.1)}.act::part(base){border-radius:9999px}</style>';
const el = ({ type = 'linear', direction = 'up', radius, count = 3, open = false, mask = false, trigger = '<ge-speed-dial-trigger><ge-button class="fab" size="icon">__PLUS__</ge-button></ge-speed-dial-trigger>' }) => {
    const items = Array.from({ length: count }, () => `<ge-speed-dial-item><ge-button class="act" variant="secondary" size="icon-sm">${PENCIL}</ge-button></ge-speed-dial-item>`).join('');
    return `${STYLE}<div style="position:relative;width:260px;height:260px"><ge-speed-dial type="${type}" direction="${direction}"${radius ? ` radius="${radius}"` : ''}${open ? ' data-opened' : ''} style="position:absolute;left:106px;top:106px">${mask ? '<ge-speed-dial-mask></ge-speed-dial-mask>' : ''}${trigger.replace('__PLUS__', PLUS)}<ge-speed-dial-menu>${items}</ge-speed-dial-menu></ge-speed-dial></div>`;
};

const items = [{ id: 'closed', ref: ref({}), el: el({}) }];
for (const direction of ['up', 'down', 'left', 'right']) {
    items.push({ id: `linear-${direction}`, ref: ref({ direction, open: true }), el: el({ direction, open: true }) });
}
items.push({ id: 'circle', ref: ref({ type: 'circle', radius: 60, count: 5, open: true }), el: el({ type: 'circle', radius: 60, count: 5, open: true }) });
items.push({ id: 'circle-closed', ref: ref({ type: 'circle', radius: 60, count: 5 }), el: el({ type: 'circle', radius: 60, count: 5 }) });
for (const direction of ['up', 'down', 'left', 'right']) {
    items.push({ id: `semi-${direction}`, ref: ref({ type: 'semi-circle', direction, radius: 60, count: 5, open: true }), el: el({ type: 'semi-circle', direction, radius: 60, count: 5, open: true }) });
}
items.push({ id: 'semi-diagonal-fallback', ref: ref({ type: 'semi-circle', direction: 'up-left', radius: 60, count: 4, open: true }), el: el({ type: 'semi-circle', direction: 'up-left', radius: 60, count: 4, open: true }) });
for (const direction of ['up-right', 'up-left', 'down-right', 'down-left']) {
    items.push({ id: `quarter-${direction}`, ref: ref({ type: 'quarter-circle', direction, count: 3, open: true }), el: el({ type: 'quarter-circle', direction, count: 3, open: true }) });
}
items.push({ id: 'quarter-straight-fallback', ref: ref({ type: 'quarter-circle', direction: 'up', count: 3, open: true }), el: el({ type: 'quarter-circle', direction: 'up', count: 3, open: true }) });
items.push({ id: 'linear-diagonal-fallback', ref: ref({ direction: 'down-left', open: true }), el: el({ direction: 'down-left', open: true }) });
items.push({ id: 'single-item-arc', ref: ref({ type: 'semi-circle', radius: 60, count: 1, open: true }), el: el({ type: 'semi-circle', radius: 60, count: 1, open: true }) });
items.push({ id: 'mask', ref: ref({ open: true, mask: true }), el: el({ open: true, mask: true }) });
const PLAIN = (open) => `<ui-speed-dial-trigger class="contents"><span tabindex="0" role="button" class="inline-flex transition-transform duration-200${open ? ' rotate-45' : ''}" aria-label="Toggle speed dial" data-slot="speed-dial-trigger" data-state="${open ? 'open' : 'closed'}">+</span></ui-speed-dial-trigger>`;
items.push({ id: 'plain-trigger', ref: ref({ trigger: PLAIN(false) }), el: el({ trigger: '<ge-speed-dial-trigger>+</ge-speed-dial-trigger>' }) });
items.push({ id: 'plain-trigger-open', ref: ref({ open: true, trigger: PLAIN(true) }), el: el({ open: true, trigger: '<ge-speed-dial-trigger>+</ge-speed-dial-trigger>' }) });
items.push({ id: 'plain-trigger-focus', focus: { ref: '[role=button]', el: '[role=button]' }, ref: ref({ trigger: PLAIN(false) }), el: el({ trigger: '<ge-speed-dial-trigger>+</ge-speed-dial-trigger>' }) });
items.push({ id: 'button-trigger-focus', focus: { ref: 'button', el: 'ge-speed-dial-trigger ge-button' }, ref: ref({}), el: el({}) });

export default { name: 'speed-dial', isolated: true, items };

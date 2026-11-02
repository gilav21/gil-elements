// shadcn-angular stepper.component.ts (connector per shadcn-angular PR #231) / stepper.component.html (simple mode); the elements are projected items.
const OL = (o) => `flex ${o === 'horizontal' ? 'flex-row items-start overflow-x-auto' : 'flex-col'}`;
const ITEM = (o) => `flex shrink-0 ${o === 'vertical' ? 'flex-row gap-4' : 'flex-col items-center gap-2'}`;
const TRIG = (ok) => `group flex items-center gap-3 text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md ${ok ? '' : 'cursor-not-allowed opacity-50'}`;
const IND = (s) => `flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${s === 'pending' ? 'border-muted bg-muted text-muted-foreground' : 'border-primary bg-primary text-primary-foreground'}`;
const TICK = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><polyline points="20 6 9 17 4 12"/></svg>';

const STEPS = [
    { value: 'account', title: 'Account', description: 'Create your login' },
    { value: 'profile', title: 'Profile', description: 'Tell us about you' },
    { value: 'done', title: 'Done' },
];
const status = (i, active) => (i < active ? 'complete' : i === active ? 'current' : 'pending');
const ref = (active, o = 'horizontal', { linear = false } = {}) =>
    `<ui-stepper class="contents"><ol class="${OL(o)}" data-slot="stepper" data-orientation="${o}">${STEPS.map((s, i) => {
        const st = status(i, active);
        const ok = !(linear && i > active);
        return `<li class="contents"><div class="${ITEM(o)}" data-slot="stepper-item" data-status="${st}" data-orientation="${o}"><button type="button" class="${TRIG(ok)}" data-slot="stepper-trigger" data-status="${st}" ${ok ? '' : 'disabled'}><div class="${IND(st === 'complete' ? 'current' : st)}">${st === 'complete' ? TICK : `<span class="text-sm font-medium">${i + 1}</span>`}</div><div class="flex flex-col items-start"><span class="text-sm font-medium" data-slot="stepper-title">${s.title}</span>${s.description ? `<span class="text-xs text-muted-foreground" data-slot="stepper-description">${s.description}</span>` : ''}</div></button></div>${i < STEPS.length - 1 ? `<div class="transition-colors ${o === 'vertical' ? 'ms-4 mt-2 mb-2 w-0.5 h-8' : 'mx-2 flex-1 h-0.5 mt-4'} ${st === 'complete' ? 'bg-primary' : 'bg-border'}"></div>` : ''}</li>`;
    }).join('')}</ol></ui-stepper>`;
const el = (active, o = 'horizontal', { linear = false } = {}) =>
    `<ge-stepper active-step="${active}" orientation="${o}"${linear ? ' linear' : ''}>${STEPS.map((s) => `<ge-stepper-item value="${s.value}"><ge-stepper-trigger><ge-stepper-title>${s.title}</ge-stepper-title>${s.description ? `<ge-stepper-description>${s.description}</ge-stepper-description>` : ''}</ge-stepper-trigger></ge-stepper-item>`).join('')}</ge-stepper>`;

const W = 'display:block;width:640px;';
const items = [
    { id: 'horizontal-first', wrap: W, ref: ref(0), el: el(0) },
    { id: 'horizontal-middle', wrap: W, ref: ref(1), el: el(1) },
    { id: 'horizontal-last', wrap: W, ref: ref(2), el: el(2) },
    { id: 'vertical', wrap: W, ref: ref(1, 'vertical'), el: el(1, 'vertical') },
    { id: 'linear-blocks-jump', wrap: W, ref: ref(0, 'horizontal', { linear: true }), el: el(0, 'horizontal', { linear: true }) },
    { id: 'focus', wrap: W, focus: { ref: 'button', el: 'ge-stepper-trigger' }, ref: ref(0), el: el(0) },
    { id: 'rtl', wrap: W, ref: `<div dir="rtl">${ref(1)}</div>`, el: `<div dir="rtl">${el(1)}</div>` },
];
export default { name: 'stepper', items };

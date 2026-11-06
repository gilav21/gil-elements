// shadcn-angular input-mask.directive.ts sits on a ui-input and rewrites its value as it is typed, so what it paints is
// the plain input showing the formatted text. The wrapper itself draws no box.
import { refPlain } from './input.mjs';

const W = 'width:260px;';
const el = (mask, p, attrs = '') => `<ge-input-mask mask="${mask}"${attrs}><ge-input placeholder="${p.placeholder ?? ''}" value="${p.value ?? ''}"></ge-input></ge-input-mask>`;

export default {
    name: 'input-mask',
    items: [
        { id: 'empty-shows-placeholder', wrap: W, ref: refPlain('outline', { placeholder: '(555) 555-5555' }), el: el('(000) 000-0000', { placeholder: '(555) 555-5555' }) },
        { id: 'phone-formatted', wrap: W, ref: refPlain('outline', { placeholder: '(555) 555-5555', value: '(555) 123-4567' }), el: el('(000) 000-0000', { placeholder: '(555) 555-5555', value: '5551234567' }) },
        { id: 'partial-phone', wrap: W, ref: refPlain('outline', { value: '(555) 12' }), el: el('(000) 000-0000', { value: '55512' }) },
        { id: 'date', wrap: W, ref: refPlain('outline', { value: '31/12/1999' }), el: el('99/99/9999', { value: '31121999' }) },
        { id: 'mask-typed-shown', wrap: W, ref: refPlain('outline', { value: '(123) ___-____' }), el: el('(000) 000-0000', { value: '123' }, ' show-mask-typed') },
        { id: 'mask-typed-custom-slot', wrap: W, ref: refPlain('outline', { value: '1#/##' }), el: el('99/99', { value: '1' }, ' show-mask-typed slot-char="#"') },
        { id: 'letters-and-any', wrap: W, ref: refPlain('outline', { value: 'Qb-12-Z7-A' }), el: el('aa-99-**-A', { value: 'Qb12Z7' }) },
    ],
};

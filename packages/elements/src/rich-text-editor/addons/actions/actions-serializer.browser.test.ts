import { describe, expect, it } from 'vitest';
import {
    applyStarterStyle, computeSeedStyleString, isCombinedOnElement, readActions, removeAction,
    stripStyleIfMatches, writeAction, writeCombined,
} from './actions-serializer.js';

const span = (): HTMLSpanElement => document.createElement('span');

describe('action serializer (DOM)', () => {
    it('writes and reads both triggers off one element', () => {
        const el = span();
        writeAction(el, 'click', 'open-dialog', { dialogId: 'pricing' });
        writeAction(el, 'hover', 'term-preview', { termId: 'sla' });
        expect(readActions(el)).toEqual([
            { trigger: 'click', id: 'open-dialog', params: { dialogId: 'pricing' } },
            { trigger: 'hover', id: 'term-preview', params: { termId: 'sla' } },
        ]);
    });

    it('reads empty params when the params attribute holds malformed or non-object JSON', () => {
        const malformed = span();
        malformed.setAttribute('data-action-click', 'a');
        malformed.setAttribute('data-action-click-params', '{bad');
        expect(readActions(malformed)).toEqual([{ trigger: 'click', id: 'a', params: {} }]);

        const nonObject = span();
        nonObject.setAttribute('data-action-hover', 'b');
        nonObject.setAttribute('data-action-hover-params', '[1,2]');
        expect(readActions(nonObject)).toEqual([{ trigger: 'hover', id: 'b', params: {} }]);
    });

    it('writes no params attribute for an empty params object', () => {
        const el = span();
        writeAction(el, 'click', 'a', {});
        expect(el.hasAttribute('data-action-click')).toBe(true);
        expect(el.hasAttribute('data-action-click-params')).toBe(false);
    });

    it('removeAction drops one trigger and its params, keeps the other', () => {
        const el = span();
        writeAction(el, 'click', 'a', { x: 1 });
        writeAction(el, 'hover', 'b', { y: 2 });
        removeAction(el, 'click');
        expect(el.hasAttribute('data-action-click')).toBe(false);
        expect(el.hasAttribute('data-action-click-params')).toBe(false);
        expect(el.getAttribute('data-action-hover')).toBe('b');
    });

    describe('starter style helpers', () => {
        it('applyStarterStyle writes camelCase keys as kebab CSS properties', () => {
            const el = span();
            applyStarterStyle(el, { color: '#2563eb', textUnderlineOffset: '3px' });
            expect(el.style.color).toBe('rgb(37, 99, 235)');
            expect(el.style.getPropertyValue('text-underline-offset')).toBe('3px');
        });

        it('computeSeedStyleString is the browser-canonical inline-style string', () => {
            const seed = computeSeedStyleString(document, { color: '#2563eb' });
            const el = span();
            applyStarterStyle(el, { color: '#2563eb' });
            expect(el.getAttribute('style')).toBe(seed);
        });

        it('stripStyleIfMatches removes an unedited seed but keeps an edited style', () => {
            const seed = computeSeedStyleString(document, { color: '#2563eb' });
            const unedited = span();
            applyStarterStyle(unedited, { color: '#2563eb' });
            stripStyleIfMatches(unedited, seed);
            expect(unedited.hasAttribute('style')).toBe(false);

            const edited = span();
            applyStarterStyle(edited, { color: '#2563eb' });
            edited.style.fontWeight = '700';
            stripStyleIfMatches(edited, seed);
            expect(edited.hasAttribute('style')).toBe(true);
        });
    });

    describe('combined actions', () => {
        it('writeCombined writes the same id on both triggers with per-trigger params', () => {
            const el = span();
            writeCombined(el, 'dictionary', { click: { value: 'sla' }, hover: { value: 'sla' } });
            expect(el.getAttribute('data-action-click')).toBe('dictionary');
            expect(el.getAttribute('data-action-hover')).toBe('dictionary');
            expect(el.getAttribute('data-action-click-params')).toBe('{"value":"sla"}');
            expect(el.getAttribute('data-action-hover-params')).toBe('{"value":"sla"}');
        });

        it('isCombinedOnElement is true only when both triggers carry the same id', () => {
            const combined = span();
            writeCombined(combined, 'dictionary', { click: {}, hover: {} });
            expect(isCombinedOnElement(combined)).toBe(true);

            const split = span();
            writeAction(split, 'click', 'a', {});
            writeAction(split, 'hover', 'b', {});
            expect(isCombinedOnElement(split)).toBe(false);
        });
    });
});

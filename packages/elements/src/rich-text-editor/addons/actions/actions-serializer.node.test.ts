import { describe, expect, it } from 'vitest';
import { ACTIONS_SANITIZER_RULES, assertFlatParams, validateActionId, validateActionParams } from './actions-serializer.js';

describe('action serializer (pure)', () => {
    it('validates ids', () => {
        expect(validateActionId('open-dialog')).toBe('open-dialog');
        expect(validateActionId('a.b.c')).toBe('a.b.c');
        expect(validateActionId('bad id')).toBeNull();
        expect(validateActionId('')).toBeNull();
        expect(validateActionId('<script>')).toBeNull();
    });

    it('validates and canonicalizes flat params', () => {
        expect(validateActionParams('{"a":1,"b":"x","c":true}')).toBe('{"a":1,"b":"x","c":true}');
        expect(validateActionParams('{"a":{"nested":1}}')).toBeNull();
        expect(validateActionParams('{"a":[1,2]}')).toBeNull();
        expect(validateActionParams('{"a":null}')).toBeNull();
        expect(validateActionParams('not json')).toBeNull();
        expect(validateActionParams('[1,2]')).toBeNull();
        expect(validateActionParams('42')).toBeNull();
        expect(validateActionParams('null')).toBeNull();
    });

    it('rejects params over 4096 serialized chars', () => {
        expect(validateActionParams(JSON.stringify({ a: 'x'.repeat(5000) }))).toBeNull();
    });

    it('assertFlatParams throws on nested values', () => {
        expect(() => assertFlatParams({ a: { b: 1 } })).toThrow();
        expect(() => assertFlatParams({ a: 1, b: 'x', c: false })).not.toThrow();
    });

    it('the shared sanitizer rules cover the four action attributes', () => {
        // Order carries no meaning to the sanitizer, so this asserts the set, not the sequence.
        const attrs = ACTIONS_SANITIZER_RULES.map((rule) => rule.attr).sort((a, b) => a.localeCompare(b));
        expect(attrs).toEqual(['data-action-click', 'data-action-click-params', 'data-action-hover', 'data-action-hover-params']);
        // The -params rules stay gated on their id attribute, or params could ride in on an element that carries no action.
        for (const rule of ACTIONS_SANITIZER_RULES.filter((r) => r.attr.endsWith('-params'))) {
            expect(rule.requiresAttr, rule.attr).toBe(rule.attr.replace('-params', ''));
        }
    });
});

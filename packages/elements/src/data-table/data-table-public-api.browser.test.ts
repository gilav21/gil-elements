import { describe, expect, it } from 'vitest';
import { KEY_PRIORITY } from './index.js';
import { KEY_PRIORITY as registry } from './data-table-registry.js';

describe('the package index', () => {
    it('exports KEY_PRIORITY, the one public table of the key chain', () => {
        expect(KEY_PRIORITY).toBe(registry);
        expect(KEY_PRIORITY.navigation).toBeGreaterThan(KEY_PRIORITY.range);
    });
});

import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

// Two projects: real Chromium for everything that needs layout, shadow DOM or computed
// style, and plain Node for server rendering, which must work without a DOM.
export default defineConfig({
    resolve: { conditions: ['development'] },
    test: {
        projects: [
            {
                extends: true,
                test: {
                    name: 'browser',
                    include: ['packages/**/*.browser.test.ts'],
                    browser: {
                        enabled: true,
                        headless: true,
                        provider: playwright(),
                        instances: [{ browser: 'chromium' }],
                    },
                },
            },
            {
                extends: true,
                test: { name: 'node', include: ['packages/**/*.node.test.ts'], environment: 'node' },
            },
        ],
    },
});

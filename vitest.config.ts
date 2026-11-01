import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

// Two projects: real Chromium for everything that needs layout, shadow DOM or computed
// style, and plain Node for server rendering, which must work without a DOM.
export default defineConfig({
    resolve: { conditions: ['development'] },
    // Pre-bundled up front: discovering a dependency mid-run makes Vite reload the page under a test.
    optimizeDeps: { include: ['lit/static-html.js', 'lit/directives/if-defined.js', 'lit/directives/ref.js'] },
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
                        // A desktop-sized page, so the 640px and 768px breakpoints are deterministic; tests that
                        // need a phone call page.viewport().
                        viewport: { width: 1280, height: 800 },
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

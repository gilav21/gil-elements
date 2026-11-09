import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

// Two projects: real Chromium for everything that needs layout, shadow DOM or computed
// style, and plain Node for server rendering, which must work without a DOM.
export default defineConfig({
    resolve: { conditions: ['development'] },
    // Pre-bundled up front: discovering a dependency mid-run makes Vite reload the page under a test.
    optimizeDeps: { include: ['lit/static-html.js', 'lit/directives/if-defined.js', 'lit/directives/ref.js', 'lit/directive.js', 'lit/async-directive.js', 'lit/directives/repeat.js'] },
    test: {
        // Only used by `pnpm run test:coverage`; lcov is what the Sonar scan reads.
        coverage: {
            provider: 'v8',
            reporter: ['lcov', 'text-summary'],
            include: ['packages/*/src/**/*.ts'],
            exclude: ['**/*.test.ts', '**/*.d.ts', '**/*-fixtures.ts'],
        },
        projects: [
            {
                extends: true,
                test: {
                    name: 'browser',
                    include: ['packages/**/*.browser.test.ts'],
                    // Keyboard tests press keys into whichever frame holds focus, and every test file runs in its own frame:
                    // run side by side, one file's focus() steals the other's Enter.
                    fileParallelism: false,
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

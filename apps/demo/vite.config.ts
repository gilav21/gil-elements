import { defineConfig } from 'vite';

// `development` makes the workspace packages resolve to their TypeScript source, so editing an
// element hot-reloads the demo without rebuilding the library first.
export default defineConfig({
    base: './',
    resolve: { conditions: ['development'] },
    build: { target: 'es2022' },
});

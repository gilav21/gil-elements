import { defineConfig } from 'vite';

// One entry per element so a page loads only what it uses; `define` entries are separate
// because importing a class must never register a tag as a side effect.
export default defineConfig({
    build: {
        lib: {
            entry: {
                index: 'src/index.ts',
                'badge/index': 'src/badge/index.ts',
                'badge/define': 'src/badge/define.ts',
                'kbd/index': 'src/kbd/index.ts',
                'kbd/define': 'src/kbd/define.ts',
                'label/index': 'src/label/index.ts',
                'label/define': 'src/label/define.ts',
                'separator/index': 'src/separator/index.ts',
                'separator/define': 'src/separator/define.ts',
                'skeleton/index': 'src/skeleton/index.ts',
                'skeleton/define': 'src/skeleton/define.ts',
                'spinner/index': 'src/spinner/index.ts',
                'spinner/define': 'src/spinner/define.ts',
            },
            formats: ['es'],
        },
        rollupOptions: {
            external: [/^lit(\/.*)?$/, /^@gilav21\/elements-base(\/.*)?$/],
            output: { chunkFileNames: 'chunks/[name].js' },
        },
        minify: true,
        emptyOutDir: true,
    },
});

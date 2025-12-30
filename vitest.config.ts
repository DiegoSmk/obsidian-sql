import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['src/**/*.test.ts'],
        setupFiles: ['./vitest.setup.ts'],
        alias: {
            'obsidian': path.resolve(__dirname, './src/__mocks__/obsidian.ts'),
        },
    },
});

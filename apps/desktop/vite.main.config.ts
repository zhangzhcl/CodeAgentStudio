import { defineConfig } from 'vite';
export default defineConfig({ build: { outDir: '.vite/build', emptyOutDir: false, lib: { entry: 'src/main/main.ts', formats: ['es'], fileName: () => 'main.js' }, rollupOptions: { external: ['electron', 'better-sqlite3'] } } });

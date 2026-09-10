import { defineConfig } from 'vite';
export default defineConfig({ build: { outDir: '.vite/build', emptyOutDir: false, lib: { entry: 'src/main/preload.ts', formats: ['es'], fileName: () => 'preload.js' }, rollupOptions: { external: ['electron'] } } });

import { defineConfig } from 'vite';
// Electron loads preload scripts as CommonJS. Keeping this bundle in CJS
// avoids a silent preload failure (and an empty window.codeagent bridge).
export default defineConfig({ build: { outDir: '.vite/build', emptyOutDir: false, lib: { entry: 'src/main/preload.ts', formats: ['cjs'], fileName: () => 'preload.js' }, rollupOptions: { external: ['electron'] } } });

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import config from './vite.main.config.js';

describe('Vite main-process configuration', () => {
  it('uses better-sqlite3 rather than Node SQLite in the Electron main process', () => {
    const external = config.build?.rollupOptions?.external;
    expect(external).toContain('better-sqlite3');
    expect(external).not.toContain('node:sqlite');
  });
});

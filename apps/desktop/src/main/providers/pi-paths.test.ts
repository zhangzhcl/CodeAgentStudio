import { describe, expect, it } from 'vitest';
import { resolvePiSessionsDir } from './pi-paths.js';

describe('resolvePiSessionsDir', () => {
  it('keeps Pi creation and discovery on one directory', () => {
    expect(resolvePiSessionsDir({ CODEAGENT_PI_HOME: 'D:\\pi' })).toBe('D:\\pi\\sessions');
    expect(resolvePiSessionsDir({ CODEAGENT_PI_HOME: 'D:\\pi', CODEAGENT_PI_SESSION_DIR: 'E:\\sessions' })).toBe('E:\\sessions');
  });
});

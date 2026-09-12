import { describe, expect, it } from 'vitest';
import { providerConfigCandidates } from './provider-config-paths.js';

describe('provider config paths', () => {
  it('uses platform-independent home and provider overrides', () => {
    const paths = providerConfigCandidates('codex', { home: 'C:/Users/test', env: { CODEX_HOME: 'D:/codex' } });
    expect(paths[0].replaceAll('\\', '/')).toContain('D:/codex');
    expect(providerConfigCandidates('pi', { home: '/home/test', env: {} })[0].replaceAll('\\', '/')).toContain('.pi/agent');
  });
});

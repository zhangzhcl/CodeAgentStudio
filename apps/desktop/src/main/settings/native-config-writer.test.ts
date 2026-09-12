import { describe, expect, it } from 'vitest';
import { assertNativeWriteAllowed } from './native-config-writer.js';

describe('native config write policy', () => {
  it('allows Claude and rejects Codex', () => {
    expect(() => assertNativeWriteAllowed('claude')).not.toThrow();
    expect(() => assertNativeWriteAllowed('codex')).toThrowError('read_only_provider');
  });
});

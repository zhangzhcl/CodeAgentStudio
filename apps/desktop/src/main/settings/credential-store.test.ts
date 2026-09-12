import { describe, expect, it } from 'vitest';
import { maskCredential } from './credential-store.js';

describe('credential masking', () => {
  it('never exposes the full key', () => {
    expect(maskCredential('sk-super-secret-key')).toBe('••••••••key');
    expect(maskCredential(undefined)).toBe('');
  });
});

import { describe, expect, it } from 'vitest';
import { validateHandshake } from './handshake.js';
describe('protocol handshake', () => { it('accepts current version and rejects mismatch', () => { expect(validateHandshake({ protocolVersion: 1, client: 'renderer', build: 'dev' })).toBe(true); expect(() => validateHandshake({ protocolVersion: 99, client: 'main', build: 'x' })).toThrow('mismatch'); }); });

import { describe, expect, it } from 'vitest';
import { parseCliEvent } from './cli-event-parser.js';
describe('CLI event parser', () => {
  it('normalizes JSON text and completion events', () => { expect(parseCliEvent('{"type":"text","delta":"hi"}', 'claude', 's', 1)?.type).toBe('text_delta'); expect(parseCliEvent('{"event":"complete"}', 'claude', 's', 2)?.type).toBe('done'); });
  it('falls back to plain text output', () => { expect(parseCliEvent('hello', 'codex', 's', 0)?.payload).toEqual({ text: 'hello' }); });
});

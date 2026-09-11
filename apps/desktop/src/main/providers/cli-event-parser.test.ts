import { describe, expect, it } from 'vitest';
import { parseCliEvent } from './cli-event-parser.js';
describe('CLI event parser', () => {
  it('normalizes JSON text and completion events', () => { expect(parseCliEvent('{"type":"text","delta":"hi"}', 'claude', 's', 1)?.type).toBe('text_delta'); expect(parseCliEvent('{"event":"complete"}', 'claude', 's', 2)?.type).toBe('done'); });
  it('falls back to plain text output', () => { expect(parseCliEvent('hello', 'codex', 's', 0)?.payload).toEqual({ text: 'hello' }); });
  it('classifies missing credentials as auth errors', () => { const event = parseCliEvent('No API key found for the selected model.', 'pi', 's', 0); expect(event?.type).toBe('error'); expect(event?.payload).toMatchObject({ code: 'auth' }); });
  it('normalizes provider-specific streaming event envelopes', () => { expect(parseCliEvent('{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"claude"}}}', 'claude', 's', 1)?.payload).toEqual({ text: 'claude' }); expect(parseCliEvent('{"type":"item.delta","item":{"text":"codex"}}', 'codex', 's', 2)?.payload).toEqual({ text: 'codex' }); expect(parseCliEvent('{"type":"message.part.updated","part":{"text":"open"}}', 'opencode', 's', 3)?.payload).toEqual({ text: 'open' }); });
  it('normalizes Cursor and Pi streaming envelopes', () => { expect(parseCliEvent('{"type":"assistant","message":{"content":[{"type":"text","text":"cursor"}]}}', 'cursor', 's', 4)?.payload).toEqual({ text: 'cursor' }); expect(parseCliEvent('{"type":"message_update","assistantMessageEvent":{"type":"text_delta","delta":"pi"}}', 'pi', 's', 5)?.payload).toEqual({ text: 'pi' }); expect(parseCliEvent('{"type":"agent_end"}', 'pi', 's', 6)?.type).toBe('done'); });
});

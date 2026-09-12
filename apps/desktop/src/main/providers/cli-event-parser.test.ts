import { describe, expect, it } from 'vitest';
import { extractNativeSessionId, parseCliEvent } from './cli-event-parser.js';
describe('CLI event parser', () => {
  it('normalizes JSON text and completion events', () => { expect(parseCliEvent('{"type":"text","delta":"hi"}', 'claude', 's', 1)?.type).toBe('text_delta'); expect(parseCliEvent('{"event":"complete"}', 'claude', 's', 2)?.type).toBe('done'); });
  it('uses a distinct message id for each provider run', () => { expect(parseCliEvent('{"type":"text","delta":"second"}', 'claude', 's', 1, 's:run-2')?.messageId).toBe('s:run-2'); });
  it('preserves provider reasoning as a separate thinking event', () => { expect(parseCliEvent('{"type":"reasoning","text":"先检查配置"}', 'claude', 's', 1)?.type).toBe('thinking_delta'); expect(parseCliEvent('{"type":"content_block_delta","delta":{"type":"thinking_delta","text":"再检查依赖"}}', 'claude', 's', 2)?.type).toBe('thinking_delta'); });
  it('falls back to plain text output', () => { expect(parseCliEvent('hello', 'codex', 's', 0)?.payload).toEqual({ text: 'hello' }); });
  it('classifies missing credentials as auth errors', () => { const event = parseCliEvent('No API key found for the selected model.', 'pi', 's', 0); expect(event?.type).toBe('error'); expect(event?.payload).toMatchObject({ code: 'auth' }); });
  it('normalizes provider-specific streaming event envelopes', () => { expect(parseCliEvent('{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"claude"}}}', 'claude', 's', 1)?.payload).toEqual({ text: 'claude' }); expect(parseCliEvent('{"type":"item.delta","item":{"text":"codex"}}', 'codex', 's', 2)?.payload).toEqual({ text: 'codex' }); expect(parseCliEvent('{"type":"message.part.updated","part":{"text":"open"}}', 'opencode', 's', 3)?.payload).toEqual({ text: 'open' }); });
  it('normalizes Cursor and Pi streaming envelopes', () => { expect(parseCliEvent('{"type":"assistant","message":{"content":[{"type":"text","text":"cursor"}]}}', 'cursor', 's', 4)?.payload).toEqual({ text: 'cursor' }); expect(parseCliEvent('{"type":"message_update","assistantMessageEvent":{"type":"text_delta","delta":"pi"}}', 'pi', 's', 5)?.payload).toEqual({ text: 'pi' }); expect(parseCliEvent('{"type":"agent_end"}', 'pi', 's', 6)?.type).toBe('done'); });
});

describe('native session id extraction', () => {
  // 样本取自各 CLI 在本机的真实输出
  it('reads session_id from Claude and Cursor stream lines', () => {
    expect(extractNativeSessionId('{"type":"system","subtype":"init","cwd":"D:\\\\demo","session_id":"4bce8226-16df-4c1b-98a6-169a60a75ac5","model":"Auto"}')).toBe('4bce8226-16df-4c1b-98a6-169a60a75ac5');
  });
  it('reads sessionID from OpenCode part events', () => {
    expect(extractNativeSessionId('{"type":"step_start","timestamp":1789228081437,"sessionID":"ses_f69b25a9dffeKF60n1kVjO80U6","part":{"type":"step-start"}}')).toBe('ses_f69b25a9dffeKF60n1kVjO80U6');
  });
  it('reads thread_id from Codex thread.started events', () => {
    expect(extractNativeSessionId('{"type":"thread.started","thread_id":"01a0964c-a198-7483-99d2-c0bd6022f901"}')).toBe('01a0964c-a198-7483-99d2-c0bd6022f901');
  });
  it('ignores plain text and id-free JSON lines', () => {
    expect(extractNativeSessionId('hello world')).toBeUndefined();
    expect(extractNativeSessionId('{"type":"turn.started"}')).toBeUndefined();
  });
});

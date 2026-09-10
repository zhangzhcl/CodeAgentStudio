import { describe, expect, it } from 'vitest';
import { AgentEventSchema, MessageDeltaSchema, ProviderIdSchema } from './index.js';

describe('CodeAgent Studio protocol', () => {
  it('rejects providers outside the built-in adapter set', () => {
    expect(ProviderIdSchema.safeParse('openai').success).toBe(false);
    expect(ProviderIdSchema.safeParse('pi').success).toBe(true);
  });

  it('requires sequence and text for message deltas', () => {
    expect(MessageDeltaSchema.safeParse({ sessionId: 's1', messageId: 'm1' }).success).toBe(false);
    expect(MessageDeltaSchema.safeParse({ sessionId: 's1', messageId: 'm1', text: 'hi', sequence: 0 }).success).toBe(true);
  });

  it('validates a normalized text event', () => {
    const event = {
      protocolVersion: 1,
      sessionId: 's1',
      messageId: 'm1',
      provider: 'pi',
      type: 'text_delta',
      sequence: 0,
      occurredAt: '2026-09-10T00:00:00.000Z',
      payload: { text: 'hello' },
    };
    expect(AgentEventSchema.safeParse(event).success).toBe(true);
  });
});

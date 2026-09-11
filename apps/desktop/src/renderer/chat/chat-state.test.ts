import { describe, expect, it } from 'vitest';
import type { AgentEvent } from '@codeagent-studio/protocol';
import { applyAgentEvent } from './chat-state.js';

const event = (text: string, sequence: number): AgentEvent => ({ protocolVersion: 1, type: 'text_delta', sessionId: 's', messageId: 'm', provider: 'codex', sequence, occurredAt: new Date().toISOString(), payload: { text } });
describe('chat state', () => { it('merges ordered stream deltas', () => expect(applyAgentEvent(applyAgentEvent([], event('你好', 1)), event('，世界', 2))[0].content).toBe('你好，世界')); });
describe('chat state message identity', () => {
  it('gives tool and error entries distinct ids within one run', () => {
    const base = { protocolVersion: 1 as const, sessionId: 's', messageId: 'm', provider: 'codex' as const, occurredAt: new Date().toISOString() };
    let messages = applyAgentEvent([], event('你好', 0));
    messages = applyAgentEvent(messages, { ...base, sequence: 1, type: 'tool.started', payload: { toolName: 'Bash', input: {} } });
    messages = applyAgentEvent(messages, { ...base, sequence: 2, type: 'tool.completed', payload: { toolName: 'Bash', output: '' } });
    messages = applyAgentEvent(messages, { ...base, sequence: 3, type: 'error', payload: { code: 'x', message: '失败' } });
    const ids = messages.map((message) => message.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

import { describe, expect, it } from 'vitest';
import type { AgentEvent } from '@codeagent-studio/protocol';
import { applyAgentEvent } from './chat-state.js';

const event = (text: string, sequence: number): AgentEvent => ({ protocolVersion: 1, type: 'text_delta', sessionId: 's', messageId: 'm', provider: 'codex', sequence: String(sequence), occurredAt: Date.now(), payload: { text } });
describe('chat state', () => { it('merges ordered stream deltas', () => expect(applyAgentEvent(applyAgentEvent([], event('你好', 1)), event('，世界', 2))[0].content).toBe('你好，世界')); });

import type { AgentEvent } from '@codeagent-studio/protocol';

export type ChatMessage = { id: string; role: 'user' | 'agent' | 'tool'; content: string; status?: 'streaming' | 'done' | 'error' };

export function applyAgentEvent(messages: ChatMessage[], event: AgentEvent): ChatMessage[] {
  if (event.type === 'text_delta') {
    const index = messages.findIndex((message) => message.id === event.messageId);
    if (index < 0) return [...messages, { id: event.messageId, role: 'agent', content: event.payload.text, status: 'streaming' }];
    const next = messages.slice();
    next[index] = { ...next[index], content: next[index].content + event.payload.text, status: 'streaming' };
    return next;
  }
  if (event.type === 'done') return messages.map((message) => message.status === 'streaming' ? { ...message, status: 'done' } : message);
  if (event.type === 'error') return [...messages, { id: event.messageId, role: 'agent', content: event.payload.message, status: 'error' }];
  return messages;
}

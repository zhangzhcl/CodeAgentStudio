import type { AgentEvent, ProviderId } from '@codeagent-studio/protocol';

type RawEvent = { type?: string; event?: string | Record<string, unknown>; message?: string | Record<string, unknown>; text?: string; delta?: string | { text?: string; type?: string }; toolName?: string; input?: unknown; output?: unknown; code?: string; item?: Record<string, unknown>; part?: Record<string, unknown>; data?: Record<string, unknown>; assistantMessageEvent?: Record<string, unknown> };

function textFrom(raw: RawEvent): string {
  if (typeof raw.text === 'string') return raw.text;
  if (typeof raw.message === 'string') return raw.message;
  if (typeof raw.delta === 'string') return raw.delta;
  if (raw.delta && typeof raw.delta.text === 'string') return raw.delta.text;
  if (typeof raw.item?.text === 'string') return raw.item.text;
  if (typeof raw.part?.text === 'string') return raw.part.text;
  if (typeof raw.data?.text === 'string') return raw.data.text;
  if (typeof raw.assistantMessageEvent?.delta === 'string') return raw.assistantMessageEvent.delta;
  if (typeof raw.assistantMessageEvent?.content === 'string') return raw.assistantMessageEvent.content;
  if (raw.message && typeof raw.message === 'object') {
    const content = raw.message.content;
    if (Array.isArray(content)) return content.map((part) => part && typeof part === 'object' && 'text' in part ? String((part as { text?: unknown }).text ?? '') : '').join('');
  }
  if (raw.event && typeof raw.event === 'object') return textFrom(raw.event as RawEvent);
  return '';
}

export function parseCliEvent(line: string, provider: ProviderId, sessionId: string, sequence: number): AgentEvent | undefined {
  if (/no api key|not logged in|authentication required/i.test(line)) return base(provider, sessionId, sequence, 'error', { code: 'auth', message: line.trim() });
  let raw: RawEvent;
  try { raw = JSON.parse(line) as RawEvent; } catch { return line.trim() ? base(provider, sessionId, sequence, 'text_delta', { text: line }) : undefined; }
  const kind = raw.type ?? (typeof raw.event === 'string' ? raw.event : undefined);
  if (kind === 'text' || kind === 'text_delta' || kind === 'message.delta' || kind === 'stream_event' || kind === 'content_block_delta' || kind === 'assistant' || kind === 'assistant_message' || kind === 'item.delta' || kind === 'item.completed' || kind === 'message.part.updated' || kind === 'message_update' || kind === 'response.output_text.delta') return base(provider, sessionId, sequence, 'text_delta', { text: textFrom(raw) });
  if (kind === 'tool.started' || kind === 'tool_start') return base(provider, sessionId, sequence, 'tool.started', { toolName: raw.toolName ?? 'tool', input: raw.input });
  if (kind === 'tool.completed' || kind === 'tool_end') return base(provider, sessionId, sequence, 'tool.completed', { toolName: raw.toolName ?? 'tool', output: raw.output });
  if (kind === 'error') return base(provider, sessionId, sequence, 'error', { code: raw.code ?? 'unknown', message: typeof raw.message === 'string' ? raw.message : '' });
  if (kind === 'done' || kind === 'complete' || kind === 'exit' || kind === 'result' || kind === 'agent_end' || kind === 'agent_settled' || kind === 'turn_end' || kind === 'response.completed' || kind === 'turn.completed' || kind === 'session.completed' || kind === 'message.completed') return base(provider, sessionId, sequence, 'done', {});
  return undefined;
}

function base<T extends AgentEvent['type']>(provider: ProviderId, sessionId: string, sequence: number, type: T, payload: Extract<AgentEvent, { type: T }>['payload']): Extract<AgentEvent, { type: T }> {
  return { protocolVersion: 1, provider, sessionId, messageId: `${sessionId}:stream`, sequence, occurredAt: new Date().toISOString(), type, payload } as Extract<AgentEvent, { type: T }>;
}

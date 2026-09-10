import type { AgentEvent, ProviderId } from '@codeagent-studio/protocol';

type RawEvent = { type?: string; event?: string; message?: string; text?: string; delta?: string; toolName?: string; input?: unknown; output?: unknown; code?: string };

export function parseCliEvent(line: string, provider: ProviderId, sessionId: string, sequence: number): AgentEvent | undefined {
  let raw: RawEvent;
  try { raw = JSON.parse(line) as RawEvent; } catch { return line.trim() ? base(provider, sessionId, sequence, 'text_delta', { text: line }) : undefined; }
  const kind = raw.type ?? raw.event;
  if (kind === 'text' || kind === 'text_delta' || kind === 'message.delta') return base(provider, sessionId, sequence, 'text_delta', { text: raw.text ?? raw.delta ?? raw.message ?? '' });
  if (kind === 'tool.started' || kind === 'tool_start') return base(provider, sessionId, sequence, 'tool.started', { toolName: raw.toolName ?? 'tool', input: raw.input });
  if (kind === 'tool.completed' || kind === 'tool_end') return base(provider, sessionId, sequence, 'tool.completed', { toolName: raw.toolName ?? 'tool', output: raw.output });
  if (kind === 'error') return base(provider, sessionId, sequence, 'error', { code: raw.code ?? 'unknown', message: raw.message ?? '' });
  if (kind === 'done' || kind === 'complete' || kind === 'exit') return base(provider, sessionId, sequence, 'done', {});
  return undefined;
}

function base<T extends AgentEvent['type']>(provider: ProviderId, sessionId: string, sequence: number, type: T, payload: Extract<AgentEvent, { type: T }>['payload']): Extract<AgentEvent, { type: T }> {
  return { protocolVersion: 1, provider, sessionId, messageId: `${sessionId}:stream`, sequence, occurredAt: new Date().toISOString(), type, payload } as Extract<AgentEvent, { type: T }>;
}

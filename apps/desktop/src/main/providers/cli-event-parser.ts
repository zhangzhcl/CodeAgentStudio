import type { AgentEvent, ProviderId } from '@codeagent-studio/protocol';

type RawEvent = { type?: string; event?: string | Record<string, unknown>; message?: string | Record<string, unknown>; text?: string; delta?: string | { text?: string; type?: string }; reasoning?: string; thinking?: string; analysis?: string; toolName?: string; input?: unknown; output?: unknown; code?: string; item?: Record<string, unknown>; part?: Record<string, unknown>; data?: Record<string, unknown>; assistantMessageEvent?: Record<string, unknown> };

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

/**
 * 从一行 CLI 输出中提取原生 session 标识，用于登记该轮运行产生的 transcript 归属。
 * 字段名来自实测：claude/cursor 顶层 session_id、opencode 顶层 sessionID、
 * codex 在 thread.started 事件上报 thread_id（对应 rollout 文件名后缀）。
 */
export function extractNativeSessionId(line: string): string | undefined {
  try {
    const raw = JSON.parse(line) as { session_id?: unknown; sessionID?: unknown; thread_id?: unknown };
    for (const value of [raw.session_id, raw.sessionID, raw.thread_id]) if (typeof value === 'string' && value) return value;
  } catch { /* 非 JSON 行忽略 */ }
  return undefined;
}

export function parseCliEvent(line: string, provider: ProviderId, sessionId: string, sequence: number, messageId = `${sessionId}:stream`): AgentEvent | undefined {
  if (/no api key|not logged in|authentication required/i.test(line)) return base(provider, sessionId, sequence, 'error', { code: 'auth', message: line.trim() }, messageId);
  let raw: RawEvent;
  try { raw = JSON.parse(line) as RawEvent; } catch { return line.trim() ? base(provider, sessionId, sequence, 'text_delta', { text: line }, messageId) : undefined; }
  const kind = raw.type ?? (typeof raw.event === 'string' ? raw.event : undefined);
  const nestedKind = raw.delta && typeof raw.delta === 'object' ? raw.delta.type : raw.assistantMessageEvent?.type;
  if (kind === 'thinking' || kind === 'reasoning' || kind === 'analysis' || kind === 'thinking_delta' || kind === 'reasoning.delta' || nestedKind === 'thinking' || nestedKind === 'reasoning' || nestedKind === 'thinking_delta' || nestedKind === 'reasoning_delta') return base(provider, sessionId, sequence, 'thinking_delta', { text: thinkingFrom(raw) }, messageId);
  if (kind === 'text' || kind === 'text_delta' || kind === 'message.delta' || kind === 'stream_event' || kind === 'content_block_delta' || kind === 'assistant' || kind === 'assistant_message' || kind === 'item.delta' || kind === 'item.completed' || kind === 'message.part.updated' || kind === 'message_update' || kind === 'response.output_text.delta') return base(provider, sessionId, sequence, 'text_delta', { text: textFrom(raw) }, messageId);
  if (kind === 'tool.started' || kind === 'tool_start') return base(provider, sessionId, sequence, 'tool.started', { toolName: raw.toolName ?? 'tool', input: raw.input }, messageId);
  if (kind === 'tool.completed' || kind === 'tool_end') return base(provider, sessionId, sequence, 'tool.completed', { toolName: raw.toolName ?? 'tool', output: raw.output }, messageId);
  if (kind === 'error') return base(provider, sessionId, sequence, 'error', { code: raw.code ?? 'unknown', message: typeof raw.message === 'string' ? raw.message : '' }, messageId);
  if (kind === 'done' || kind === 'complete' || kind === 'exit' || kind === 'result' || kind === 'agent_end' || kind === 'agent_settled' || kind === 'turn_end' || kind === 'response.completed' || kind === 'turn.completed' || kind === 'session.completed' || kind === 'message.completed') return base(provider, sessionId, sequence, 'done', {}, messageId);
  return undefined;
}

function base<T extends AgentEvent['type']>(provider: ProviderId, sessionId: string, sequence: number, type: T, payload: Extract<AgentEvent, { type: T }>['payload'], messageId: string): Extract<AgentEvent, { type: T }> {
  return { protocolVersion: 1, provider, sessionId, messageId, sequence, occurredAt: new Date().toISOString(), type, payload } as Extract<AgentEvent, { type: T }>;
}

function thinkingFrom(raw: RawEvent): string {
  if (typeof raw.text === 'string') return raw.text;
  if (typeof raw.reasoning === 'string') return raw.reasoning;
  if (typeof raw.thinking === 'string') return raw.thinking;
  if (typeof raw.analysis === 'string') return raw.analysis;
  if (raw.delta && typeof raw.delta === 'object' && typeof raw.delta.text === 'string') return raw.delta.text;
  return '';
}

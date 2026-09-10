import type { AgentEvent, ProviderId, SessionScope } from '@codeagent-studio/protocol';

export type SessionRecord = { id: string; provider: ProviderId; scope: SessionScope; title?: string; projectId?: string; projectRoot?: string; projectName?: string; nativeId?: string; nativeSessionFile?: string; status: 'active' | 'done' | 'aborted' | 'error'; createdAt: number; updatedAt: number };
export type MessageRecord = { id: string; sessionId: string; role: 'user' | 'agent' | 'tool'; content: unknown; sequence: number; createdAt: number };
type SessionStore = { save(session: SessionRecord): unknown; get?(id: string): SessionRecord | undefined; list?(): SessionRecord[]; saveMessage?(message: MessageRecord): unknown; listMessages?(sessionId: string): MessageRecord[] };

export class SessionService {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly messages = new Map<string, MessageRecord>();
  constructor(private readonly store?: SessionStore) { for (const session of store?.list?.() ?? []) { this.sessions.set(session.id, session); if (!session.title) { const first = store?.listMessages?.(session.id).find((message) => message.role === 'user' && typeof message.content === 'string' && message.content.trim()); if (first && typeof first.content === 'string') this.setTitleIfMissing(session.id, first.content); } } }

  create(input: Omit<SessionRecord, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { id?: string }): SessionRecord {
    const now = Date.now();
    const record: SessionRecord = { ...input, id: input.id ?? crypto.randomUUID(), status: 'active', createdAt: now, updatedAt: now };
    this.sessions.set(record.id, record);
    this.store?.save(record);
    return record;
  }
  get(sessionId: string): SessionRecord { const record = this.sessions.get(sessionId) ?? this.store?.get?.(sessionId); if (!record) throw new Error(`Unknown session: ${sessionId}`); this.sessions.set(sessionId, record); return record; }
  appendEvent(event: AgentEvent): MessageRecord | undefined {
    if (event.type !== 'text_delta') return undefined;
    const id = `${event.sessionId}:${event.messageId}`;
    const existing = this.messages.get(id);
    const message: MessageRecord = existing
      ? { ...existing, content: typeof existing.content === 'string' ? existing.content + event.payload.text : event.payload.text, sequence: event.sequence }
      : { id, sessionId: event.sessionId, role: 'agent', content: event.payload.text, sequence: event.sequence, createdAt: Date.now() };
    this.messages.set(id, message);
    this.store?.saveMessage?.(message);
    return message;
  }
  appendUserMessage(sessionId: string, content: string): MessageRecord { const message: MessageRecord = { id: `${sessionId}:user:${crypto.randomUUID()}`, sessionId, role: 'user', content, sequence: -1, createdAt: Date.now() }; this.messages.set(message.id, message); this.store?.saveMessage?.(message); if (content.trim()) this.setTitleIfMissing(sessionId, content); return message; }
  importMessage(message: MessageRecord): void { if (this.messages.has(message.id)) return; this.messages.set(message.id, message); this.store?.saveMessage?.(message); if (message.role === 'user' && typeof message.content === 'string' && message.content.trim()) this.setTitleIfMissing(message.sessionId, message.content); }
  private setTitleIfMissing(sessionId: string, content: string): void { const session = this.sessions.get(sessionId); if (!session || session.title) return; const title = content.trim().replace(/\s+/g, ' ').slice(0, 80); const updated = { ...session, title, updatedAt: Date.now() }; this.sessions.set(sessionId, updated); this.store?.save(updated); }
  listMessages(sessionId: string): MessageRecord[] { const stored = this.store?.listMessages?.(sessionId); if (stored?.length) return stored; return [...this.messages.values()].filter((message) => message.sessionId === sessionId).sort((a, b) => a.sequence - b.sequence || a.createdAt - b.createdAt); }
  list(): SessionRecord[] { return [...this.sessions.values()].sort((a, b) => b.updatedAt - a.updatedAt); }
  replayTranscript(sessionId: string): MessageRecord[] { return this.listMessages(sessionId).map((message) => ({ ...message })); }
  markStatus(sessionId: string, status: SessionRecord['status']): SessionRecord { const updated = { ...this.get(sessionId), status, updatedAt: Date.now() }; this.sessions.set(sessionId, updated); this.store?.save(updated); return updated; }
  updateNative(sessionId: string, native: Pick<SessionRecord, 'nativeId' | 'nativeSessionFile'>): SessionRecord { const updated = { ...this.get(sessionId), ...native, updatedAt: Date.now() }; this.sessions.set(sessionId, updated); this.store?.save(updated); return updated; }
  updateProject(sessionId: string, project: Pick<SessionRecord, 'projectId' | 'projectRoot' | 'projectName'>): SessionRecord { const updated = { ...this.get(sessionId), ...project, updatedAt: Date.now() }; this.sessions.set(sessionId, updated); this.store?.save(updated); return updated; }
}

import type { AgentEvent, ProviderId, SessionScope } from '@codeagent-studio/protocol';

export type SessionRecord = { id: string; provider: ProviderId; scope: SessionScope; title?: string; projectId?: string; projectRoot?: string; projectName?: string; nativeId?: string; nativeSessionFile?: string; status: 'active' | 'done' | 'aborted' | 'error'; createdAt: number; updatedAt: number };
export type MessageRecord = { id: string; sessionId: string; role: 'user' | 'agent' | 'tool'; content: unknown; sequence: number; createdAt: number };
/** 一次 prompt 运行产生的原生 transcript 归属记录（一个会话多轮运行会积累多条）。 */
export type NativeRunRecord = { sessionId: string; nativeId: string; nativeSessionFile?: string; createdAt: number };
type SessionStore = { save(session: SessionRecord): unknown; get?(id: string): SessionRecord | undefined; list?(): SessionRecord[]; saveMessage?(message: MessageRecord): unknown; listMessages?(sessionId: string): MessageRecord[]; saveNativeRun?(run: NativeRunRecord): unknown; listNativeRuns?(): NativeRunRecord[]; deleteNativeRuns?(sessionId: string): unknown; delete?(id: string): unknown };

export class SessionService {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly messages = new Map<string, MessageRecord>();
  private readonly nextSequences = new Map<string, number>();
  private readonly nativeRuns = new Map<string, NativeRunRecord>();
  constructor(private readonly store?: SessionStore) { for (const session of store?.list?.() ?? []) { this.sessions.set(session.id, session); if (!session.title) { const first = store?.listMessages?.(session.id).find((message) => message.role === 'user' && typeof message.content === 'string' && message.content.trim()); if (first && typeof first.content === 'string') this.setTitleIfMissing(session.id, first.content); } } for (const run of store?.listNativeRuns?.() ?? []) this.nativeRuns.set(run.nativeId, run); }

  create(input: Omit<SessionRecord, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { id?: string; createdAt?: number; updatedAt?: number }): SessionRecord {
    const now = Date.now();
    const createdAt = input.createdAt ?? now;
    const record: SessionRecord = { ...input, id: input.id ?? crypto.randomUUID(), status: 'active', createdAt, updatedAt: input.updatedAt ?? createdAt };
    this.sessions.set(record.id, record);
    this.store?.save(record);
    return record;
  }
  get(sessionId: string): SessionRecord { const record = this.sessions.get(sessionId) ?? this.store?.get?.(sessionId); if (!record) throw new Error(`Unknown session: ${sessionId}`); this.sessions.set(sessionId, record); return record; }
  /**
   * 会话内单调递增的写入序号。Provider 事件的 sequence 每轮运行都会从 0 重新计数，
   * 用户消息如果固定为 -1，回放时会把所有提问挤到回复之前，因此落库统一改用本序号。
   */
  private nextSequence(sessionId: string): number {
    if (!this.nextSequences.has(sessionId)) {
      const stored = this.store?.listMessages?.(sessionId) ?? [];
      const known = stored.length ? stored : [...this.messages.values()].filter((message) => message.sessionId === sessionId);
      const max = known.reduce((acc, message) => Math.max(acc, message.sequence), -1);
      this.nextSequences.set(sessionId, max);
    }
    const next = (this.nextSequences.get(sessionId) ?? -1) + 1;
    this.nextSequences.set(sessionId, next);
    return next;
  }
  appendEvent(event: AgentEvent): MessageRecord | undefined {
    if (event.type !== 'text_delta') return undefined;
    const id = `${event.sessionId}:${event.messageId}`;
    const existing = this.messages.get(id);
    const message: MessageRecord = existing
      ? { ...existing, content: typeof existing.content === 'string' ? existing.content + event.payload.text : event.payload.text }
      : { id, sessionId: event.sessionId, role: 'agent', content: event.payload.text, sequence: this.nextSequence(event.sessionId), createdAt: Date.now() };
    this.messages.set(id, message);
    this.store?.saveMessage?.(message);
    return message;
  }
  appendUserMessage(sessionId: string, content: string): MessageRecord { const message: MessageRecord = { id: `${sessionId}:user:${crypto.randomUUID()}`, sessionId, role: 'user', content, sequence: this.nextSequence(sessionId), createdAt: Date.now() }; this.messages.set(message.id, message); this.store?.saveMessage?.(message); if (content.trim()) this.setTitleIfMissing(sessionId, content); return message; }
  importMessage(message: MessageRecord): void { if (this.messages.has(message.id)) return; this.messages.set(message.id, message); this.store?.saveMessage?.(message); if (message.role === 'user' && typeof message.content === 'string' && message.content.trim()) this.setTitleIfMissing(message.sessionId, message.content, message.createdAt); }
  private setTitleIfMissing(sessionId: string, content: string, updatedAt = Date.now()): void { const session = this.sessions.get(sessionId); if (!session || session.title) return; const title = content.trim().replace(/\s+/g, ' ').slice(0, 80); const updated = { ...session, title, updatedAt }; this.sessions.set(sessionId, updated); this.store?.save(updated); }
  ensureTitle(sessionId: string, content: string): void { this.setTitleIfMissing(sessionId, content); }
  listMessages(sessionId: string): MessageRecord[] { const stored = this.store?.listMessages?.(sessionId); if (stored?.length) return stored; return [...this.messages.values()].filter((message) => message.sessionId === sessionId).sort((a, b) => a.sequence - b.sequence || a.createdAt - b.createdAt); }
  list(): SessionRecord[] { return [...this.sessions.values()].sort((a, b) => b.updatedAt - a.updatedAt); }
  /** 登记一轮运行产生的原生 session 归属；发现扫描据此跳过重复导入。 */
  recordNativeRun(sessionId: string, nativeId: string, nativeSessionFile?: string): NativeRunRecord { const run: NativeRunRecord = { sessionId, nativeId, ...(nativeSessionFile ? { nativeSessionFile } : {}), createdAt: Date.now() }; this.nativeRuns.set(nativeId, run); this.store?.saveNativeRun?.(run); return run; }
  ownsNativeId(nativeId: string): boolean { return this.nativeRuns.has(nativeId); }
  listNativeRuns(sessionId: string): NativeRunRecord[] { return [...this.nativeRuns.values()].filter((run) => run.sessionId === sessionId); }
  delete(sessionId: string): boolean { const existed = this.sessions.delete(sessionId); for (const key of this.messages.keys()) if (key.startsWith(`${sessionId}:`)) this.messages.delete(key); this.nextSequences.delete(sessionId); for (const [nativeId, run] of this.nativeRuns) if (run.sessionId === sessionId) this.nativeRuns.delete(nativeId); this.store?.deleteNativeRuns?.(sessionId); this.store?.delete?.(sessionId); return existed; }
  replayTranscript(sessionId: string): MessageRecord[] { return this.listMessages(sessionId).map((message) => ({ ...message })); }
  markStatus(sessionId: string, status: SessionRecord['status']): SessionRecord { const updated = { ...this.get(sessionId), status, updatedAt: Date.now() }; this.sessions.set(sessionId, updated); this.store?.save(updated); return updated; }
  updateNative(sessionId: string, native: Pick<SessionRecord, 'nativeId' | 'nativeSessionFile'>): SessionRecord { const updated = { ...this.get(sessionId), ...native, updatedAt: Date.now() }; this.sessions.set(sessionId, updated); this.store?.save(updated); return updated; }
  updateTimestamps(sessionId: string, createdAt: number, updatedAt: number): SessionRecord { const current = this.get(sessionId); const updated = { ...current, createdAt, updatedAt }; this.sessions.set(sessionId, updated); this.store?.save(updated); return updated; }
  updateProject(sessionId: string, project: Pick<SessionRecord, 'projectId' | 'projectRoot' | 'projectName'>): SessionRecord { const updated = { ...this.get(sessionId), ...project, updatedAt: Date.now() }; this.sessions.set(sessionId, updated); this.store?.save(updated); return updated; }
  updateScope(sessionId: string, scope: SessionScope, project?: Pick<SessionRecord, 'projectId' | 'projectRoot' | 'projectName'>): SessionRecord {
    const updated = { ...this.get(sessionId), scope, ...(project ?? { projectId: undefined, projectRoot: undefined, projectName: undefined }), updatedAt: Date.now() };
    this.sessions.set(sessionId, updated);
    this.store?.save(updated);
    return updated;
  }
}

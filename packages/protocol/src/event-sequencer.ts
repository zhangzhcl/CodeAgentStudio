import type { AgentEvent } from './index.js';
export class EventSequencer {
  private readonly latest = new Map<string, number>();
  accept(event: AgentEvent) { const key = `${event.sessionId}:${event.messageId}`; const previous = this.latest.get(key) ?? -1; if (event.sequence <= previous) return false; this.latest.set(key, event.sequence); return true; }
  reset(sessionId: string) { for (const key of this.latest.keys()) if (key.startsWith(`${sessionId}:`)) this.latest.delete(key); }
}

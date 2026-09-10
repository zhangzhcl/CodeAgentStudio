import { useEffect, useState } from 'react';
import type { AgentEvent } from '@codeagent-studio/protocol';
import { applyAgentEvent, type ChatMessage } from './chat-state.js';

type Props = { sessionId: string; providerName?: string; subscribe?: (listener: (event: AgentEvent) => void) => () => void; onPrompt?: (text: string) => Promise<void> | void };

export function ChatPanel({ sessionId, providerName = 'Agent', subscribe, onPrompt }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  useEffect(() => subscribe?.((event) => { if (event.sessionId === sessionId) setMessages((current) => applyAgentEvent(current, event)); }), [sessionId, subscribe]);
  const send = async () => { const text = draft.trim(); if (!text || sending) return; setDraft(''); setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', content: text, status: 'done' }]); setSending(true); try { await onPrompt?.(text); } finally { setSending(false); } };
  return <section className="chat-panel" aria-label="Agent 对话">
    <header><h1>{providerName} 对话</h1><span>会话 {sessionId}</span></header>
    <div role="log" aria-live="polite">{messages.length === 0 ? <p>输入消息开始对话。</p> : messages.map((message) => <article key={message.id} data-role={message.role}><strong>{message.role === 'user' ? '你' : providerName}</strong><p>{message.content}{message.status === 'streaming' ? '▍' : ''}</p></article>)}</div>
    <form onSubmit={(event) => { event.preventDefault(); void send(); }}><textarea aria-label="消息" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={sending} /><button type="submit" disabled={!draft.trim() || sending}>发送</button></form>
  </section>;
}

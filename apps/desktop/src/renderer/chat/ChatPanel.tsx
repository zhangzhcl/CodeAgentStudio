import { useEffect, useRef, useState } from 'react';
import { EventSequencer } from '@codeagent-studio/protocol';
import type { AgentEvent } from '@codeagent-studio/protocol';
import { applyAgentEvent, type ChatMessage } from './chat-state.js';

type Props = { sessionId: string; providerName?: string; providers?: string[]; subscribe?: (listener: (event: AgentEvent) => void) => () => void; onPrompt?: (text: string, provider: string) => Promise<void> | void };

export function ChatPanel({ sessionId, providerName = 'Claude', providers = ['Claude', 'Cursor', 'Codex', 'Pi', 'OpenCode'], subscribe, onPrompt }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [provider, setProvider] = useState(providerName);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const sequencer = useRef(new EventSequencer());
  useEffect(() => subscribe?.((event) => { if (event.sessionId === sessionId && sequencer.current.accept(event)) setMessages((current) => applyAgentEvent(current, event)); }), [sessionId, subscribe]);
  const send = async () => { const text = draft.trim(); if (!text || sending) return; setDraft(''); setError(undefined); setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', content: text, status: 'done' }]); setSending(true); try { await onPrompt?.(text, provider); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Agent 请求失败'); } finally { setSending(false); } };
  return <section className="chat-panel" aria-label="Agent 对话">
    <header><h1>{provider} 对话</h1><label>Provider <select aria-label="选择 Provider" value={provider} onChange={(event) => setProvider(event.target.value)}>{providers.map((item) => <option key={item}>{item}</option>)}</select></label><span>会话 {sessionId}</span></header>
    {error && <p role="alert">{error}</p>}<div role="log" aria-live="polite">{messages.length === 0 ? <p>输入消息开始对话。</p> : messages.map((message) => <article key={message.id} data-role={message.role}><strong>{message.role === 'user' ? '你' : provider}</strong><p>{message.content}{message.status === 'streaming' ? '▍' : ''}</p></article>)}</div>
    <form onSubmit={(event) => { event.preventDefault(); void send(); }}><textarea aria-label="消息" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={sending} /><button type="submit" disabled={!draft.trim() || sending}>发送</button></form>
  </section>;
}

import { useEffect, useRef, useState } from 'react';
import { EventSequencer } from '@codeagent-studio/protocol';
import type { AgentEvent } from '@codeagent-studio/protocol';
import { applyAgentEvent, type ChatMessage } from './chat-state.js';

type Props = { sessionId: string; providerName?: string; providers?: string[]; disabledProviders?: string[]; loadMessages?: () => Promise<ChatMessage[]>; subscribe?: (listener: (event: AgentEvent) => void) => () => void; onPrompt?: (text: string, provider: string) => Promise<void> | void; onAbort?: (sessionId: string) => Promise<unknown> | unknown };

export function ChatPanel({ sessionId, providerName = 'Claude', providers = ['Claude', 'Cursor', 'Codex', 'Pi', 'OpenCode'], disabledProviders = [], loadMessages, subscribe, onPrompt, onAbort }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [provider, setProvider] = useState(providerName);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const [composerHint, setComposerHint] = useState('支持 Markdown、代码和多行输入');
  const sequencer = useRef(new EventSequencer());
  useEffect(() => { setProvider(providerName); }, [providerName]);
  useEffect(() => subscribe?.((event) => { if (event.sessionId === sessionId && sequencer.current.accept(event)) setMessages((current) => applyAgentEvent(current, event)); }), [sessionId, subscribe]);
  useEffect(() => { let active = true; sequencer.current = new EventSequencer(); setMessages([]); if (loadMessages && sessionId !== 'new-chat') void loadMessages().then((loaded) => { if (active) setMessages(loaded); }); return () => { active = false; }; }, [sessionId]);
  const send = async () => { const text = draft.trim(); if (!text || sending) return; setDraft(''); setError(undefined); setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', content: text, status: 'done' }]); setSending(true); try { await onPrompt?.(text, provider); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Agent 请求失败'); } finally { setSending(false); } };
  return <section className="chat-panel" aria-label="Agent 对话">
    <header className="chat-header"><div><span className="eyebrow">WORKSPACE CHAT</span><h1>{provider} 对话</h1><span className="session-meta">会话 {sessionId}</span></div><label className="provider-picker">Provider<select aria-label="选择 Provider" value={provider} onChange={(event) => setProvider(event.target.value)}>{providers.map((item) => <option key={item} value={item} disabled={disabledProviders.includes(item)}>{item}{disabledProviders.includes(item) ? '（未安装）' : ''}</option>)}</select></label></header>
    {error && <p className="chat-error" role="alert">{error}</p>}
    <div className="chat-transcript" role="log" aria-live="polite">{messages.length === 0 ? <div className="chat-empty"><div className="empty-mark">✦</div><h2>开始一次新的 Agent 对话</h2><p>描述任务、粘贴代码，或让 Agent 从当前项目开始工作。</p></div> : messages.map((message) => <article className={`chat-message chat-message-${message.role} ${message.status === 'error' ? 'is-error' : ''}`} key={message.id} data-role={message.role}><div className="message-avatar" aria-hidden="true">{message.role === 'user' ? '你' : message.role === 'tool' ? '⌘' : '✦'}</div><div className="message-body"><div className="message-heading"><strong>{message.role === 'user' ? '你' : message.role === 'tool' ? '工具调用' : provider}</strong>{message.status === 'streaming' && <span className="streaming-badge">生成中</span>}</div><p>{message.content}{message.status === 'streaming' ? <span className="cursor-block" aria-label="正在生成">▍</span> : ''}</p></div></article>)}</div>
    <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}><textarea aria-label="消息" placeholder="向 Agent 描述你要完成的任务…" value={draft} onFocus={() => setComposerHint('Enter 发送 · Shift + Enter 换行')} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} disabled={sending} /><div className="composer-toolbar"><span>{composerHint}</span><div><button type="button" className="secondary-action" onClick={() => setDraft('')} disabled={!draft.trim() || sending}>清空</button>{sending ? <button type="button" className="stop-action" onClick={() => { setSending(false); void onAbort?.(sessionId); }}>停止</button> : <button type="submit" className="send-action" aria-label="发送" disabled={!draft.trim()}>发送 <span>↵</span></button>}</div></div></form>
  </section>;
}

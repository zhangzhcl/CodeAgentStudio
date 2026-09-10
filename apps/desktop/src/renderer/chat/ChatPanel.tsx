import { useEffect, useRef, useState } from 'react';
import { EventSequencer } from '@codeagent-studio/protocol';
import type { AgentEvent } from '@codeagent-studio/protocol';
import { applyAgentEvent, type ChatMessage } from './chat-state.js';
import { MessageItem } from './message-item.js';
import { Composer } from './Composer.js';

type Props = { sessionId: string; providerName?: string; providers?: string[]; disabledProviders?: string[]; loadMessages?: () => Promise<ChatMessage[]>; subscribe?: (listener: (event: AgentEvent) => void) => () => void; onPrompt?: (text: string, provider: string) => Promise<void> | void; onAbort?: (sessionId: string) => Promise<unknown> | unknown; onProviderChange?: (provider: string) => void };


export function ChatPanel({ sessionId, providerName = 'Claude', providers = ['Claude', 'Cursor', 'Codex', 'Pi', 'OpenCode'], disabledProviders = [], loadMessages, subscribe, onPrompt, onAbort, onProviderChange }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [provider, setProvider] = useState(providerName);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const [composerNotice, setComposerNotice] = useState('');
  const [copiedMessage, setCopiedMessage] = useState<string>();
  const [showScrollButton, setShowScrollButton] = useState(false);
  const sequencer = useRef(new EventSequencer());
  const transcriptRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  useEffect(() => { setProvider(providerName); }, [providerName]);
  useEffect(() => subscribe?.((event) => {
    if (event.sessionId !== sessionId || !sequencer.current.accept(event)) return;
    setMessages((current) => applyAgentEvent(current, event));
    if (event.type === 'done' || event.type === 'error') setSending(false);
  }), [sessionId, subscribe]);
  useEffect(() => { let active = true; sequencer.current = new EventSequencer(); setMessages([]); if (loadMessages) void loadMessages().then((loaded) => { if (active) setMessages(loaded); }).catch(() => { if (active) setError('会话记录加载失败'); }); return () => { active = false; }; }, [sessionId]);
  useEffect(() => { const element = transcriptRef.current; if (!element || !stickToBottom.current) return; element.scrollTop = element.scrollHeight; }, [messages]);
  const scrollToBottom = () => { const element = transcriptRef.current; if (!element) return; element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' }); stickToBottom.current = true; setShowScrollButton(false); };
  const useQuickPrompt = (text: string) => { setDraft(text); setComposerNotice('已填入快捷任务，按 Enter 发送'); requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.chat-composer textarea')?.focus()); };
  const send = async () => { const text = draft.trim(); if (!text || sending) return; setDraft(''); setError(undefined); setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', content: text, status: 'done', createdAt: Date.now() }]); setSending(true); try { if (!onPrompt) throw new Error('Agent 接口不可用，请重启应用'); await onPrompt(text, provider); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Agent 请求失败'); } finally { setSending(false); } };
  const regenerate = async () => { const text = [...messages].reverse().find((message) => message.role === 'user')?.content; if (!text || sending || !onPrompt) return; setError(undefined); setSending(true); try { await onPrompt(text, provider); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Agent 请求失败'); } finally { setSending(false); } };
  const copyMessage = async (id: string, content: string) => { try { await navigator.clipboard?.writeText(content); setCopiedMessage(id); window.setTimeout(() => setCopiedMessage((current) => current === id ? undefined : current), 1400); } catch { setComposerNotice('当前环境不支持复制'); } };
  return <section className="chat-panel" aria-label="Agent 对话">
    <header className="chat-header"><div><span className="eyebrow">WORKSPACE CHAT</span><h1>{provider}</h1><span className="session-meta">会话 {sessionId}</span></div><label className="provider-picker">Agent<select aria-label="选择 Provider" value={provider} onChange={(event) => { setProvider(event.target.value); onProviderChange?.(event.target.value); }}>{providers.map((item) => <option key={item} value={item} disabled={disabledProviders.includes(item)}>{item}{disabledProviders.includes(item) ? '（未安装）' : ''}</option>)}</select></label></header>
    {error && <p className="chat-error" role="alert">{error}</p>}
    <div ref={transcriptRef} className="chat-transcript" role="log" aria-live="polite" onScroll={(event) => { const element = event.currentTarget; const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 48; stickToBottom.current = atBottom; setShowScrollButton(!atBottom && element.scrollHeight > element.clientHeight + 80); }}>{messages.length === 0 ? <div className="chat-empty"><div className="empty-mark">✦</div><h2>今天想让 Agent 做什么？</h2><p>从一个快捷任务开始，或直接描述你的代码问题。</p><div className="quick-prompts"><button type="button" onClick={() => useQuickPrompt('帮我快速了解这个项目的目录结构和主要技术栈')}>了解项目</button><button type="button" onClick={() => useQuickPrompt('检查当前项目中最值得优先修复的问题，并给出修复计划')}>检查问题</button><button type="button" onClick={() => useQuickPrompt('帮我实现一个小功能，并先说明你准备修改哪些文件')}>实现功能</button><button type="button" onClick={() => useQuickPrompt('阅读当前代码，找出潜在的性能或安全风险')}>代码审查</button></div></div> : messages.map((message) => <MessageItem key={message.id} message={message} provider={provider} copied={copiedMessage === message.id} sending={sending} onCopy={(id, content) => void copyMessage(id, content)} onRegenerate={() => void regenerate()} onFeedback={() => setComposerNotice('已记录反馈')} />)}</div>
    {showScrollButton && <button type="button" className="scroll-bottom" onClick={scrollToBottom}>↓ 回到底部</button>}
    <Composer draft={draft} messages={messages} provider={provider} sending={sending} notice={composerNotice} onDraftChange={(value) => setDraft(value)} onSend={() => void send()} onStop={() => { setSending(false); void onAbort?.(sessionId); }} />
  </section>;
}

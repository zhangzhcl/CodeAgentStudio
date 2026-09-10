import { useRef, useState } from 'react';
import type { ChatMessage } from './chat-state.js';

type Props = {
  draft: string;
  messages: ChatMessage[];
  provider: string;
  sending: boolean;
  onDraftChange: (value: string, element: HTMLTextAreaElement) => void;
  onSend: () => void;
  onStop: () => void;
  notice?: string;
  queued: string[];
  onCancelQueued: (index: number) => void;
  onEditQueued: (index: number) => void;
  onPromoteQueued: (index: number) => void;
};

export function Composer({ draft, messages, provider, sending, onDraftChange, onSend, onStop, notice: externalNotice, queued, onCancelQueued, onEditQueued, onPromoteQueued }: Props) {
  const attachmentInput = useRef<HTMLInputElement>(null);
  const [hint, setHint] = useState('支持 Markdown、代码和多行输入');
  const [notice, setNotice] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [commandIndex, setCommandIndex] = useState(0);
  const [deepThink, setDeepThink] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const history = useRef<string[]>([]);
  const historyIndex = useRef(-1);
  const commands = [{ value: '/help', label: '查看可用命令' }, { value: '/clear', label: '清空当前会话' }];

  const resize = (element: HTMLTextAreaElement) => {
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 240)}px`;
  };
  const applyDraft = (value: string, element: HTMLTextAreaElement) => {
    onDraftChange(value, element);
    requestAnimationFrame(() => resize(element));
  };

  const submit = () => { if (!draft.trim() && attachments.length === 0) return; if (draft.trim() && history.current.at(-1) !== draft.trim()) history.current.push(draft.trim()); historyIndex.current = -1; onSend(); setAttachments([]); };
  return <form className="chat-composer" aria-busy={sending} data-sending={sending ? 'true' : 'false'} onSubmit={(event) => { event.preventDefault(); submit(); }}>
    {queued.length > 0 && <div className="composer-queue"><div className="composer-queue-head">排队中 · {queued.length} 条<span>当前回复结束后自动发送</span></div>{queued.map((item, index) => <div className="composer-queue-item" key={`${item}-${index}`}><b>{String(index + 1).padStart(2, '0')}</b><span title={item}>{item}</span><button type="button" aria-label={`立即发送 ${index + 1}`} onClick={() => onPromoteQueued(index)}>↑</button><button type="button" aria-label={`编辑排队消息 ${index + 1}`} onClick={() => onEditQueued(index)}>✎</button><button type="button" aria-label={`取消排队消息 ${index + 1}`} onClick={() => onCancelQueued(index)}>×</button></div>)}</div>}
    <textarea
      aria-label="消息"
      placeholder="输入 / 调用命令，@ 选择文件，或向 Agent 提问…"
      value={draft}
      onFocus={() => setHint('Enter 发送 · Shift + Enter 换行')}
      onChange={(event) => {
        onDraftChange(event.target.value, event.currentTarget);
        setShowCommandMenu(event.target.value.startsWith('/') && !event.target.value.includes(' '));
        setCommandIndex(0);
        resize(event.currentTarget);
      }}
      onKeyDown={(event) => {
        const slashActive = draft.startsWith('/') && !draft.includes(' ');
        const matches = slashActive ? commands.filter((command) => command.value.startsWith(draft)) : [];
        if (matches.length > 0) {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setCommandIndex((index) => event.key === 'ArrowDown' ? (index + 1) % matches.length : (index - 1 + matches.length) % matches.length); return; }
          if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') { event.preventDefault(); applyDraft(`${matches[commandIndex]?.value ?? matches[0]!.value} `, event.currentTarget); setShowCommandMenu(false); return; }
          if (event.key === 'Escape') { event.preventDefault(); applyDraft('', event.currentTarget); setShowCommandMenu(false); return; }
        }
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          submit();
        }
        if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && !slashActive && history.current.length > 0 && (draft === '' || historyIndex.current >= 0)) { event.preventDefault(); historyIndex.current = event.key === 'ArrowUp' ? Math.min(historyIndex.current + 1, history.current.length - 1) : Math.max(historyIndex.current - 1, -1); applyDraft(historyIndex.current < 0 ? '' : history.current[history.current.length - 1 - historyIndex.current]!, event.currentTarget); }
      }}
      disabled={false}
    />
      <div className="composer-toolbar">
        <div className="composer-tools">
        <input ref={attachmentInput} type="file" multiple hidden onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) {
            setAttachments((current) => [...current, ...files.map((file) => file.name)]);
            setNotice(`已选择 ${files.length} 个附件`);
          }
          event.target.value = '';
        }} />
        <button type="button" aria-label="添加附件" className="toolbar-icon" onClick={() => attachmentInput.current?.click()}>⌕</button>
        <button type="button" aria-label="查看 Token 统计" className="token-chip" onClick={() => setNotice('Token 统计为当前草稿和会话文本的估算值。')}>
          ⌁ <strong>{Math.max(1, Math.ceil((draft.length + messages.reduce((total, item) => total + item.content.length, 0)) / 4))}K</strong> tokens
        </button>
        <button type="button" aria-label="引用文件" className="toolbar-icon" onClick={() => {
          setNotice('请在左侧文件资源管理器点击文件，即可打开并引用。');
          onDraftChange(draft || '@', document.querySelector<HTMLTextAreaElement>('.chat-composer textarea') ?? document.createElement('textarea'));
        }}>▢</button>
        <button type="button" className={`composer-toggle${deepThink ? ' is-on' : ''}`} aria-pressed={deepThink} onClick={() => { setDeepThink((value) => !value); setNotice(deepThink ? '已关闭深度思考' : '已开启深度思考'); }} title="深度思考模式">✦ 深度思考</button>
        <button type="button" className={`composer-toggle${webSearch ? ' is-on' : ''}`} aria-pressed={webSearch} onClick={() => { setWebSearch((value) => !value); setNotice(webSearch ? '已关闭联网搜索' : '已开启联网搜索'); }} title="联网搜索模式">⌁ 联网</button>
      </div>
      <div className="composer-actions">
        <span className="composer-model" title={`当前 Agent：${provider}`}>Agent · {provider}</span>
        {sending && !draft.trim() && attachments.length === 0 ? <button type="button" className="stop-action" aria-label="停止" onClick={onStop}>停止</button> : <button type="submit" className="send-action" aria-label="发送" disabled={!draft.trim() && attachments.length === 0}>➤</button>}
      </div>
    </div>
    {attachments.length > 0 && <div className="composer-attachments">{attachments.map((attachment, index) => <span className="attachment-chip" key={`${attachment}-${index}`}>附件 · {attachment}<button type="button" aria-label={`移除附件 ${attachment}`} onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></span>)}</div>}
    {showCommandMenu && <div className="command-menu" role="listbox">
      {commands.map((command, index) => <button key={command.value} type="button" className={index === commandIndex ? 'is-active' : ''} onClick={() => { const element = document.querySelector<HTMLTextAreaElement>('.chat-composer textarea') ?? document.createElement('textarea'); applyDraft(`${command.value} `, element); setShowCommandMenu(false); }}>{command.value} <span>{command.label}</span></button>)}
    </div>}
    <span className="composer-hint">{sending ? 'Agent 正在生成，可点击“停止”中断' : externalNotice || notice || hint}</span>
  </form>;
}

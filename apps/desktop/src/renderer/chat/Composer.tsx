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
};

export function Composer({ draft, messages, provider, sending, onDraftChange, onSend, onStop, notice: externalNotice }: Props) {
  const attachmentInput = useRef<HTMLInputElement>(null);
  const [hint, setHint] = useState('支持 Markdown、代码和多行输入');
  const [notice, setNotice] = useState('');
  const [showCommandMenu, setShowCommandMenu] = useState(false);

  const resize = (element: HTMLTextAreaElement) => {
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 240)}px`;
  };

  return <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); onSend(); }}>
    <textarea
      aria-label="消息"
      placeholder="输入 / 调用命令，@ 选择文件，或向 Agent 提问…"
      value={draft}
      onFocus={() => setHint('Enter 发送 · Shift + Enter 换行')}
      onChange={(event) => {
        onDraftChange(event.target.value, event.currentTarget);
        setShowCommandMenu(event.target.value.startsWith('/'));
        resize(event.currentTarget);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          onSend();
        }
      }}
      disabled={sending}
    />
    <div className="composer-toolbar">
      <div className="composer-tools">
        <input ref={attachmentInput} type="file" hidden onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) setNotice(`已选择附件：${file.name}`);
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
      </div>
      <div className="composer-actions">
        <span className="composer-model" title={`当前 Agent：${provider}`}>{provider}</span>
        {sending ? <button type="button" className="stop-action" onClick={onStop}>停止</button> : <button type="submit" className="send-action" aria-label="发送" disabled={!draft.trim()}>➤</button>}
      </div>
    </div>
    {showCommandMenu && <div className="command-menu" role="listbox">
      <button type="button" onClick={() => { onDraftChange('/help ', document.querySelector<HTMLTextAreaElement>('.chat-composer textarea') ?? document.createElement('textarea')); setShowCommandMenu(false); }}>/help <span>查看可用命令</span></button>
      <button type="button" onClick={() => { onDraftChange('/clear ', document.querySelector<HTMLTextAreaElement>('.chat-composer textarea') ?? document.createElement('textarea')); setShowCommandMenu(false); }}>/clear <span>清空当前会话</span></button>
    </div>}
    <span className="composer-hint">{externalNotice || notice || hint}</span>
  </form>;
}

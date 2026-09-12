import { useEffect, useState } from "react";
import { MarkdownLite } from "./markdown-lite.js";
import type { ChatMessage } from "./chat-state.js";
import {
  IconCheck,
  IconCopy,
  IconChevronRight,
  IconChevronLeft,
  IconPencil,
  IconRefresh,
  IconSparkle,
  IconSpinner,
  IconTerminal,
  IconThumbDown,
  IconThumbUp,
} from "../icons.js";
import { getAgentPresentation } from "../agent-presentation.js";

type Props = {
  message: ChatMessage;
  provider: string;
  copied: boolean;
  sending: boolean;
  onCopy: (id: string, content: string) => void;
  onRegenerate: () => void;
  onFeedback: () => void;
  onEditResend?: (text: string) => void;
  onSuggestion?: (text: string) => void;
  isLastAgent?: boolean;
  onSelectBranch?: (index: number) => void;
};

function BranchPicker({ branch, onSelect }: { branch: { index: number; total: number }; onSelect?: (index: number) => void }) {
  if (branch.total < 2) return null;
  return <span className="branch" aria-label={`第 ${branch.index + 1} 个版本，共 ${branch.total} 个`}>
    <button type="button" className="branch-btn" disabled={branch.index <= 0} onClick={() => onSelect?.(branch.index - 1)} aria-label="上一个版本"><IconChevronLeft size={13} /></button>
    <span className="branch-count">{branch.index + 1}/{branch.total}</span>
    <button type="button" className="branch-btn" disabled={branch.index >= branch.total - 1} onClick={() => onSelect?.(branch.index + 1)} aria-label="下一个版本"><IconChevronRight size={13} /></button>
  </span>;
}

function AgentMarkdown({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const taskLines = lines.filter((line) =>
    /^\s*[-*]\s+\[[ xX~]\]\s+/.test(line),
  );
  if (taskLines.length < 2) return <MarkdownLite content={content} />;
  const taskSet = new Set(taskLines);
  const rest = lines
    .filter((line) => !taskSet.has(line))
    .join("\n")
    .trim();
  const done = taskLines.filter((line) => /\[[xX]\]/.test(line)).length;
  return (
    <>
      <div className={`tasks${done < taskLines.length ? " is-live" : ""}`}>
        <div className="tasks-head">
          <span className="tasks-label">执行计划</span>
          <span className="tasks-progress">
            {done}/{taskLines.length}
          </span>
        </div>
        <ul className="tasks-list">
          {taskLines.map((line, index) => {
            const complete = /\[[xX]\]/.test(line);
            const running = /\[~\]/.test(line);
            return (
              <li
                className={`task-item is-${complete ? "done" : running ? "running" : "pending"}`}
                key={`${line}-${index}`}
              >
                <span className="task-check">
                  {complete ? <IconCheck size={11} /> : running ? <IconSpinner size={11} /> : null}
                </span>
                <span className="task-content">
                  {line.replace(/^\s*[-*]\s+\[[ xX~]\]\s+/, "")}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      {rest && <MarkdownLite content={rest} />}
    </>
  );
}

export function MessageItem({
  message,
  provider,
  copied,
  sending,
  onCopy,
  onRegenerate,
  onFeedback,
  onEditResend,
  onSuggestion,
  isLastAgent = true,
  onSelectBranch,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [toolOpen, setToolOpen] = useState(false);
  const [thinkingOpen, setThinkingOpen] = useState(message.thinking === "running");
  useEffect(() => setThinkingOpen(message.thinking === "running"), [message.thinking]);
  const [editDraft, setEditDraft] = useState(message.content);
  const toolParts = message.role === "tool" ? message.content.split("\n") : [];
  const toolName = toolParts[0] || "工具调用";
  const toolDetail = toolParts.slice(1).join("\n");
  return (
    <article
      className={`msg chat-message chat-message-${message.role} ${message.role === "user" ? "msg-user" : message.role === "agent" ? "msg-agent" : ""} ${message.status === "error" ? "is-error" : ""}`}
      data-role={message.role}
      data-message-id={message.id}
    >
      {message.role !== "agent" && (
        <div className="message-avatar" aria-hidden="true">
          {message.role === "user" ? "你" : "⌘"}
        </div>
      )}
      <div
        className={`message-body${message.role === "agent" ? " msg-agent-body" : message.role === "user" ? " msg-bubble" : ""}`}
      >
        {message.role !== "user" && (
          <div
            className={`message-heading${message.role === "agent" ? " msg-agent-head" : ""}`}
          >
            {message.role === "agent" && (
              <span className="agent-mark" aria-hidden="true">
                <IconSparkle size={11} />
              </span>
            )}
            <strong
              className={message.role === "agent" ? "agent-name" : undefined}
            >
              {message.role === "tool" ? "工具调用" : getAgentPresentation(provider).name}
            </strong>
            {message.role === "agent" && message.branch && <BranchPicker branch={message.branch} onSelect={onSelectBranch} />}
            {message.status === "streaming" && (
              <span className="streaming-badge">生成中</span>
            )}
            <time>
              {new Date(message.createdAt ?? Date.now()).toLocaleTimeString(
                [],
                {
                  hour: "2-digit",
                  minute: "2-digit",
                },
              )}
            </time>
          </div>
        )}
        {message.role === "agent" && message.thinking && (
          <div className={`think${thinkingOpen ? " is-open" : ""}${message.thinking === "running" ? " is-running" : ""}`}>
            <button type="button" className="think-head" onClick={() => setThinkingOpen((open) => !open)}>
              <IconChevronRight size={13} className={`think-chevron${thinkingOpen ? " is-open" : ""}`} />
              <span className="think-label">
                {message.thinking === "running" ? "正在思考" : "已完成思考"}
              </span>
              {message.thinking === "running" ? (
                <span className="think-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                <span className="think-cost">已完成</span>
              )}
            </button>
            {thinkingOpen && <div className="think-body"><div className="think-text">{message.thinkingContent || (message.thinking === "running" ? "正在整理思路…" : "思考过程未返回可展示内容")}</div></div>}
          </div>
        )}
        {message.role === "tool" ? (
          <div
            className={`tool${message.status === "streaming" ? " is-running" : ""}${message.status === "error" ? " is-error" : ""}${toolOpen ? " is-open" : ""}`}
          >
            <button type="button" className="tool-line" onClick={() => setToolOpen((open) => !open)} title="展开调用详情">
              <IconChevronRight size={12} className={`tool-fold${toolOpen ? " is-open" : ""}`} />
              <IconTerminal size={13} className="tool-icon" />
              <span className="tool-name">{toolName}</span>
              <span className="tool-args">{toolParts[1] ?? ""}</span>
              <span className="tool-status">
                {message.status === "streaming" ? <><IconSpinner size={12} /><em>执行中</em></> : message.status === "error" ? <em className="tool-err">中断</em> : <><IconCheck size={12} /><em>完成</em></>}
              </span>
            </button>
            {toolOpen && (
              <div className="tool-detail">
                <div className="tool-detail-row">
                  <span className="tool-detail-label">参数</span>
                  <pre>{toolDetail}</pre>
                </div>
              </div>
            )}
          </div>
        ) : message.role === "user" && editing ? (
          <div className="message-edit-box">
            <textarea
              aria-label="编辑消息"
              value={editDraft}
              onChange={(event) => setEditDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setEditing(false);
                }
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (editDraft.trim()) {
                    setEditing(false);
                    onEditResend?.(editDraft.trim());
                  }
                }
              }}
            />
            <div>
              <button type="button" onClick={() => setEditing(false)}>
                取消
              </button>
              <button
                type="button"
                disabled={!editDraft.trim()}
                onClick={() => {
                  if (!editDraft.trim()) return;
                  setEditing(false);
                  onEditResend?.(editDraft.trim());
                }}
              >
                保存并重发
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={message.role === "agent" ? "msg-agent-text" : undefined}>
              {message.role === "agent" ? <AgentMarkdown content={message.content} /> : <MarkdownLite content={message.content} />}
            </div>
          </>
        )}
        {message.status === "streaming" && (
          <span className="cursor-block stream-caret" aria-label="正在生成" />
        )}
        {message.role === "agent" && message.status === "done" && message.suggestions?.length && onSuggestion && (
            <div className="message-suggestions sugg-row">
              {message.suggestions.map((suggestion) => (
                <button key={suggestion} className="sugg-chip" type="button" onClick={() => onSuggestion(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        <div
          className={`message-actions msg-actions${message.role === "user" ? " msg-user-meta" : ""}`}
        >
          {message.role === "user" && (
            message.branch && <BranchPicker branch={message.branch} onSelect={onSelectBranch} />
          )}
          {message.role === "user" && (
            <time className="msg-time">
              {new Date(message.createdAt ?? Date.now()).toLocaleTimeString(
                [],
                {
                  hour: "2-digit",
                  minute: "2-digit",
                },
              )}
            </time>
          )}
          {message.role === "agent" && message.content.length > 0 && (
            <button
              className={`act${copied ? " is-ok" : ""}`}
              type="button"
              aria-label={copied ? "已复制" : "复制消息"}
              title={copied ? "已复制" : "复制消息"}
              onClick={() => onCopy(message.id, message.content)}
            >
              {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
            </button>
          )}
          {message.role === "user" && onEditResend && !editing && (
            <button
              className="act"
              type="button"
              aria-label="编辑并重发"
              onClick={() => {
                setEditDraft(message.content);
                setEditing(true);
              }}
            >
              <IconPencil size={14} />
            </button>
          )}
          {message.role === "agent" && message.content.length > 0 && (
            <>
              {isLastAgent && <button
                className="act"
                type="button"
                aria-label="重新生成"
                onClick={onRegenerate}
                disabled={sending}
              >
                <IconRefresh size={15} />
              </button>}
              <span className="act-sep" aria-hidden="true" />
              <button
                className="act"
                type="button"
                aria-label="赞"
                onClick={onFeedback}
              >
                <IconThumbUp size={15} />
              </button>
              <button
                className="act"
                type="button"
                aria-label="踩"
                onClick={onFeedback}
              >
                <IconThumbDown size={15} />
              </button>
            </>
          )}{" "}
        </div>
      </div>
    </article>
  );
}

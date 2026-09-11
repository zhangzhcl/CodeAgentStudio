import { useState } from "react";
import { MarkdownLite } from "./markdown-lite.js";
import type { ChatMessage } from "./chat-state.js";
import {
  IconCheck,
  IconCopy,
  IconFile,
  IconChevronRight,
  IconPencil,
  IconRefresh,
  IconSparkle,
  IconThumbDown,
  IconThumbUp,
} from "../icons.js";

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
};

function AgentMarkdown({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const taskLines = lines.filter((line) =>
    /^\s*[-*]\s+\[[ xX]\]\s+/.test(line),
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
            return (
              <li
                className={`task-item is-${complete ? "done" : "pending"}`}
                key={`${line}-${index}`}
              >
                <span className="task-check">
                  {complete && <IconCheck size={11} />}
                </span>
                <span className="task-content">
                  {line.replace(/^\s*[-*]\s+\[[ xX]\]\s+/, "")}
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
}: Props) {
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(message.content);
  const toolParts = message.role === "tool" ? message.content.split("\n") : [];
  const toolName = toolParts[0] || "工具调用";
  const toolDetail = toolParts.slice(1).join("\n");
  return (
    <article
      className={`msg chat-message chat-message-${message.role} ${message.role === "user" ? "msg-user" : message.role === "agent" ? "msg-agent" : ""} ${message.status === "error" ? "is-error" : ""}`}
      data-role={message.role}
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
              {message.role === "tool" ? "工具调用" : "AGENT-01"}
            </strong>
            {message.role === "agent" && (
              <span className="message-model-badge agent-model">
                {provider}
              </span>
            )}
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
          <details
            className={`think${message.thinking === "running" ? " is-running" : ""}`}
            open={message.thinking === "running"}
          >
            <summary className="think-head">
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
            </summary>
            {message.thinking === "running" && (
              <div className="think-body" aria-hidden="true" />
            )}
          </details>
        )}
        {message.role === "tool" ? (
          <details
            className="tool-call-block tool"
            open={message.status === "streaming"}
          >
            <summary className="tool-line">
              <IconChevronRight size={13} className="tool-caret tool-icon" />
              <strong className="tool-name">{toolName}</strong>
              <span
                className={`tool-status tool-status-${message.status ?? "done"}`}
              >
                {message.status === "streaming"
                  ? "执行中"
                  : message.status === "error"
                    ? "失败"
                    : "已完成"}
              </span>
            </summary>
            <pre className="tool-result">{toolDetail}</pre>
          </details>
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
            {message.role === "user" && message.attachments?.length ? (
              <div className="msg-files">
                {message.attachments.map((file, index) => (
                  <span className="file-chip" key={`${file.name}-${index}`}>
                    <IconFile size={13} />
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{file.size >= 1024 ? `${Math.round(file.size / 1024)} KB` : `${file.size} B`}</span>
                  </span>
                ))}
              </div>
            ) : null}
            <div className={message.role === "agent" ? "msg-agent-text" : undefined}>
              {message.role === "agent" ? <AgentMarkdown content={message.content} /> : <MarkdownLite content={message.content} />}
            </div>
          </>
        )}
        {message.status === "streaming" && (
          <span className="cursor-block stream-caret" aria-label="正在生成" />
        )}
        {message.role === "agent" &&
          message.status === "done" &&
          onSuggestion && (
            <div className="message-suggestions sugg-row">
              <button
                className="sugg-chip"
                type="button"
                onClick={() => onSuggestion("继续优化刚才的实现")}
              >
                继续优化
              </button>
              <button
                className="sugg-chip"
                type="button"
                onClick={() => onSuggestion("解释刚才的改动")}
              >
                解释改动
              </button>
              <button
                className="sugg-chip"
                type="button"
                onClick={() => onSuggestion("运行测试并检查问题")}
              >
                运行测试
              </button>
            </div>
          )}
        <div
          className={`message-actions msg-actions${message.role === "user" ? " msg-user-meta" : ""}`}
        >
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
              <button
                className="act"
                type="button"
                aria-label="重新生成"
                onClick={onRegenerate}
                disabled={sending}
              >
                <IconRefresh size={15} />
              </button>
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

import { useState } from "react";
import { MarkdownLite } from "./markdown-lite.js";
import type { ChatMessage } from "./chat-state.js";
import {
  IconCheck,
  IconCopy,
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
              {message.role === "tool" ? "工具调用" : provider}
            </strong>
            {message.role === "agent" && (
              <span className="message-model-badge agent-model">AGENT</span>
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
        {message.role === "tool" ? (
          <details
            className="tool-call-block tool"
            open={message.status === "streaming"}
          >
            <summary>
              <span className="tool-caret">›</span>
              <strong>{toolName}</strong>
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
            <pre>{toolDetail}</pre>
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
          <div
            className={message.role === "agent" ? "msg-agent-text" : undefined}
          >
            <MarkdownLite content={message.content} />
          </div>
        )}
        {message.status === "streaming" && (
          <span className="cursor-block stream-caret" aria-label="正在生成">
            ▍
          </span>
        )}
        {message.role === "agent" &&
          message.status === "done" &&
          onSuggestion && (
            <div className="message-suggestions">
              <button
                type="button"
                onClick={() => onSuggestion("继续优化刚才的实现")}
              >
                继续优化
              </button>
              <button
                type="button"
                onClick={() => onSuggestion("解释刚才的改动")}
              >
                解释改动
              </button>
              <button
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
          {message.role === "agent" && (
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
          {message.role === "agent" && (
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

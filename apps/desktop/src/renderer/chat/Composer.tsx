import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "./chat-state.js";

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

export function Composer({
  draft,
  messages,
  provider,
  sending,
  onDraftChange,
  onSend,
  onStop,
  notice: externalNotice,
  queued,
  onCancelQueued,
  onEditQueued,
  onPromoteQueued,
}: Props) {
  const attachmentInput = useRef<HTMLInputElement>(null);
  const [hint, setHint] = useState("支持 Markdown、代码和多行输入");
  const [notice, setNotice] = useState("");
  const [attachments, setAttachments] = useState<
    Array<{ name: string; size: number; type: string }>
  >([]);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [commandIndex, setCommandIndex] = useState(0);
  const [deepThink, setDeepThink] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [model, setModel] = useState("GLM-4.7");
  const [modelOpen, setModelOpen] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);
  const history = useRef<string[]>([]);
  const historyIndex = useRef(-1);
  const commands = [
    { value: "/help", label: "查看可用命令" },
    { value: "/clear", label: "清空当前会话" },
  ];
  useEffect(() => {
    if (!modelOpen) return;
    const close = (event: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(event.target as Node))
        setModelOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModelOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [modelOpen]);

  const resize = (element: HTMLTextAreaElement) => {
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 240)}px`;
  };
  const applyDraft = (value: string, element: HTMLTextAreaElement) => {
    onDraftChange(value, element);
    requestAnimationFrame(() => resize(element));
  };

  const submit = () => {
    if (!draft.trim() && attachments.length === 0) return;
    if (draft.trim() && history.current.at(-1) !== draft.trim())
      history.current.push(draft.trim());
    historyIndex.current = -1;
    onSend();
    setAttachments([]);
  };
  return (
    <div className="composer">
      <form
        className="chat-composer composer-box"
        aria-busy={sending}
        data-sending={sending ? "true" : "false"}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {queued.length > 0 && (
          <div className="composer-queue">
            <div className="composer-queue-head">
              排队中 · {queued.length} 条<span>当前回复结束后自动发送</span>
            </div>
            {queued.map((item, index) => (
              <div className="composer-queue-item" key={`${item}-${index}`}>
                <b>{String(index + 1).padStart(2, "0")}</b>
                <span title={item}>{item}</span>
                <button
                  type="button"
                  aria-label={`立即发送 ${index + 1}`}
                  onClick={() => onPromoteQueued(index)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`编辑排队消息 ${index + 1}`}
                  onClick={() => onEditQueued(index)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  aria-label={`取消排队消息 ${index + 1}`}
                  onClick={() => onCancelQueued(index)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          className="composer-input"
          aria-label="消息"
          placeholder="给 AGENT-01 下达指令，输入 / 唤起命令面板"
          value={draft}
          onFocus={() => setHint("Enter 发送 · Shift + Enter 换行")}
          onChange={(event) => {
            onDraftChange(event.target.value, event.currentTarget);
            setShowCommandMenu(
              event.target.value.startsWith("/") &&
                !event.target.value.includes(" "),
            );
            setCommandIndex(0);
            resize(event.currentTarget);
          }}
          onKeyDown={(event) => {
            const slashActive = draft.startsWith("/") && !draft.includes(" ");
            const matches = slashActive
              ? commands.filter((command) => command.value.startsWith(draft))
              : [];
            if (matches.length > 0) {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setCommandIndex((index) =>
                  event.key === "ArrowDown"
                    ? (index + 1) % matches.length
                    : (index - 1 + matches.length) % matches.length,
                );
                return;
              }
              if (
                (event.key === "Enter" && !event.shiftKey) ||
                event.key === "Tab"
              ) {
                event.preventDefault();
                applyDraft(
                  `${matches[commandIndex]?.value ?? matches[0]!.value} `,
                  event.currentTarget,
                );
                setShowCommandMenu(false);
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                applyDraft("", event.currentTarget);
                setShowCommandMenu(false);
                return;
              }
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
            if (
              (event.key === "ArrowUp" || event.key === "ArrowDown") &&
              !slashActive &&
              history.current.length > 0 &&
              (draft === "" || historyIndex.current >= 0)
            ) {
              event.preventDefault();
              historyIndex.current =
                event.key === "ArrowUp"
                  ? Math.min(
                      historyIndex.current + 1,
                      history.current.length - 1,
                    )
                  : Math.max(historyIndex.current - 1, -1);
              applyDraft(
                historyIndex.current < 0
                  ? ""
                  : history.current[
                      history.current.length - 1 - historyIndex.current
                    ]!,
                event.currentTarget,
              );
            }
          }}
          disabled={false}
        />
        <div className="composer-toolbar composer-bar">
          <div className="composer-tools composer-bar-left">
            <input
              ref={attachmentInput}
              type="file"
              multiple
              hidden
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length) {
                  setAttachments((current) => [
                    ...current,
                    ...files.map((file) => ({
                      name: file.name,
                      size: file.size,
                      type: file.type,
                    })),
                  ]);
                  setNotice(`已选择 ${files.length} 个附件`);
                }
                event.target.value = "";
              }}
            />
            <button
              type="button"
              aria-label="添加附件"
              className="toolbar-icon pill pill-icon"
              onClick={() => attachmentInput.current?.click()}
            >
              ⌕
            </button>
            <button
              type="button"
              aria-label="查看 Token 统计"
              className="token-chip pill"
              onClick={() =>
                setNotice("Token 统计为当前草稿和会话文本的估算值。")
              }
            >
              ⌁{" "}
              <strong>
                {Math.max(
                  1,
                  Math.ceil(
                    (draft.length +
                      messages.reduce(
                        (total, item) => total + item.content.length,
                        0,
                      )) /
                      4,
                  ),
                )}
                K
              </strong>{" "}
              tokens
            </button>
            <button
              type="button"
              aria-label="引用文件"
              className="toolbar-icon pill pill-icon"
              onClick={() => {
                setNotice("请在左侧文件资源管理器点击文件，即可打开并引用。");
                onDraftChange(
                  draft || "@",
                  document.querySelector<HTMLTextAreaElement>(
                    ".chat-composer textarea",
                  ) ?? document.createElement("textarea"),
                );
              }}
            >
              ▢
            </button>
            <button
              type="button"
              className={`composer-toggle pill${deepThink ? " is-on" : ""}`}
              aria-pressed={deepThink}
              onClick={() => {
                setDeepThink((value) => !value);
                setNotice(deepThink ? "已关闭深度思考" : "已开启深度思考");
              }}
              title="深度思考模式"
            >
              ✦ 深度思考
            </button>
            <button
              type="button"
              className={`composer-toggle pill${webSearch ? " is-on" : ""}`}
              aria-pressed={webSearch}
              onClick={() => {
                setWebSearch((value) => !value);
                setNotice(webSearch ? "已关闭联网搜索" : "已开启联网搜索");
              }}
              title="联网搜索模式"
            >
              ⌁ 联网
            </button>
          </div>
          <div className="composer-actions composer-bar-right">
            <div className="composer-model-wrap" ref={modelRef}>
              <button
                type="button"
                className={`composer-model pill${modelOpen ? " is-open" : ""}`}
                aria-haspopup="listbox"
                aria-expanded={modelOpen}
                onClick={() => setModelOpen((open) => !open)}
                title={`当前模型：${model}`}
              >
                {model}
                <span aria-hidden="true">⌄</span>
              </button>
              {modelOpen && (
                <div
                  className="composer-model-menu"
                  role="listbox"
                  aria-label="选择模型"
                >
                  {[
                    ["GLM-4.7", "通用", 3],
                    ["Claude Sonnet", "代码", 2],
                    ["GPT-5.5", "推理", 2],
                    ["DeepSeek V4", "长上下文", 1],
                  ].map(([item, tag, speed]) => (
                    <button
                      key={String(item)}
                      type="button"
                      role="option"
                      aria-selected={item === model}
                      onClick={() => {
                        setModel(String(item));
                        setModelOpen(false);
                        setNotice(`已切换模型：${item}`);
                      }}
                    >
                      <span className="model-option-main">
                        <strong>{String(item)}</strong>
                        <small>{String(tag)}</small>
                      </span>
                      <span
                        className="model-speed"
                        aria-label={`速度 ${speed}/3`}
                      >
                        {[0, 1, 2].map((bar) => (
                          <i
                            key={bar}
                            className={bar < Number(speed) ? "is-on" : ""}
                          />
                        ))}
                      </span>
                      {item === model && (
                        <span className="model-check" aria-hidden="true">
                          ✓
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {sending && !draft.trim() && attachments.length === 0 ? (
              <button
                type="button"
                className="stop-action send-btn is-stop"
                aria-label="停止"
                onClick={onStop}
              >
                停止
              </button>
            ) : (
              <button
                type="submit"
                className="send-action send-btn"
                aria-label="发送"
                disabled={!draft.trim() && attachments.length === 0}
              >
                ➤
              </button>
            )}
          </div>
        </div>
        {attachments.length > 0 && (
          <div className="composer-attachments">
            {attachments.map((attachment, index) => (
              <span
                className="attachment-chip"
                key={`${attachment.name}-${index}`}
              >
                <span className="attachment-kind">
                  {attachment.type.startsWith("image/") ? "IMG" : "FILE"}
                </span>
                <span title={attachment.name}>{attachment.name}</span>
                <small>
                  {attachment.size >= 1024 * 1024
                    ? `${(attachment.size / 1024 / 1024).toFixed(1)} MB`
                    : `${Math.max(1, Math.round(attachment.size / 1024))} KB`}
                </small>
                <button
                  type="button"
                  aria-label={`移除附件 ${attachment.name}`}
                  onClick={() =>
                    setAttachments((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {showCommandMenu && (
          <div className="command-menu" role="listbox">
            {commands.map((command, index) => (
              <button
                key={command.value}
                type="button"
                className={index === commandIndex ? "is-active" : ""}
                onClick={() => {
                  const element =
                    document.querySelector<HTMLTextAreaElement>(
                      ".chat-composer textarea",
                    ) ?? document.createElement("textarea");
                  applyDraft(`${command.value} `, element);
                  setShowCommandMenu(false);
                }}
              >
                {command.value} <span>{command.label}</span>
              </button>
            ))}
          </div>
        )}
        <div className="composer-hint">
          {sending ? (
            <span className="composer-hint-state">
              Agent 正在生成，可点击“停止”中断
            </span>
          ) : (
            <>
              <span>
                <kbd>Enter</kbd> 发送
              </span>
              <span>
                <kbd>Shift</kbd> + <kbd>Enter</kbd> 换行
              </span>
              <span>
                <kbd>/</kbd> 唤起命令
              </span>
              <span className="composer-hint-note">
                {externalNotice || notice || "内容由 AI 生成，请注意甄别"}
              </span>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

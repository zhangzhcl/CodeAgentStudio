import { useEffect, useRef, useState } from "react";
import { EventSequencer } from "@codeagent-studio/protocol";
import type { AgentEvent } from "@codeagent-studio/protocol";
import { applyAgentEvent, type ChatMessage } from "./chat-state.js";
import { MessageItem } from "./message-item.js";
import { Composer } from "./Composer.js";

type Props = {
  sessionId: string;
  providerName?: string;
  scope?: "personal" | "project";
  projectName?: string;
  providers?: string[];
  disabledProviders?: string[];
  loadMessages?: () => Promise<ChatMessage[]>;
  subscribe?: (listener: (event: AgentEvent) => void) => () => void;
  onPrompt?: (text: string, provider: string) => Promise<void> | void;
  onAbort?: (sessionId: string) => Promise<unknown> | unknown;
  onProviderChange?: (provider: string) => void;
  onTitleChange?: (title: string) => void;
};

export function ChatPanel({
  sessionId,
  providerName = "Claude",
  scope = "personal",
  projectName,
  providers = ["Claude", "Cursor", "Codex", "Pi", "OpenCode"],
  disabledProviders = [],
  loadMessages,
  subscribe,
  onPrompt,
  onAbort,
  onProviderChange,
  onTitleChange,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [provider, setProvider] = useState(providerName);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [queued, setQueued] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [composerNotice, setComposerNotice] = useState("");
  const [copiedMessage, setCopiedMessage] = useState<string>();
  const lastPrompt = useRef<{ text: string; provider: string }>();
  const [showScrollButton, setShowScrollButton] = useState(false);
  const sequencer = useRef(new EventSequencer());
  const transcriptRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  useEffect(() => {
    setProvider(providerName);
  }, [providerName]);
  useEffect(() => {
    const clear = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: string }>).detail;
      if (detail.sessionId === sessionId) {
        setMessages([]);
        setComposerNotice("当前会话已清空");
      }
    };
    window.addEventListener("codeagent:clear-session", clear);
    return () => window.removeEventListener("codeagent:clear-session", clear);
  }, [sessionId]);
  useEffect(
    () =>
      subscribe?.((event) => {
        if (event.sessionId !== sessionId || !sequencer.current.accept(event))
          return;
        setMessages((current) => applyAgentEvent(current, event));
        if (event.type === "done" || event.type === "error") setSending(false);
      }),
    [sessionId, subscribe],
  );
  useEffect(() => {
    let active = true;
    sequencer.current = new EventSequencer();
    setMessages([]);
    if (loadMessages)
      void loadMessages()
        .then((loaded) => {
          if (active) setMessages(loaded);
        })
        .catch(() => {
          if (active) setError("会话记录加载失败");
        });
    return () => {
      active = false;
    };
  }, [sessionId]);
  useEffect(() => {
    const element = transcriptRef.current;
    if (!element || !stickToBottom.current) return;
    element.scrollTop = element.scrollHeight;
  }, [messages]);
  useEffect(() => {
    if (sending || queued.length === 0) return;
    const [next, ...rest] = queued;
    setQueued(rest);
    void runPrompt(next!, provider);
  }, [sending, queued, provider]);
  const scrollToBottom = () => {
    const element = transcriptRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    stickToBottom.current = true;
    setShowScrollButton(false);
  };
  const useQuickPrompt = (text: string) => {
    setDraft(text);
    setComposerNotice("已填入快捷任务，按 Enter 发送");
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLTextAreaElement>(".chat-composer textarea")
        ?.focus(),
    );
  };
  const runPrompt = async (
    text: string,
    selectedProvider: string,
    optimistic = true,
  ) => {
    lastPrompt.current = { text, provider: selectedProvider };
    setError(undefined);
    if (optimistic) {
      setMessages((current) => {
        if (!current.some((message) => message.role === "user")) {
          onTitleChange?.(text);
          window.dispatchEvent(
            new CustomEvent("codeagent:session-title", {
              detail: { sessionId, title: text },
            }),
          );
        }
        return [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "user",
            content: text,
            status: "done",
            createdAt: Date.now(),
          },
        ];
      });
    }
    setSending(true);
    try {
      if (!onPrompt) throw new Error("Agent 接口不可用，请重启应用");
      await onPrompt(text, selectedProvider);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Agent 请求失败");
    } finally {
      setSending(false);
    }
  };
  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    if (sending) {
      setQueued((current) => [...current, text]);
      setComposerNotice("消息已加入队列");
      return;
    }
    if (text === "/clear") {
      setMessages([]);
      setComposerNotice("当前会话已清空");
      return;
    }
    if (text === "/help") {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "agent",
          content: "可用命令：\n- `/help` 查看命令\n- `/clear` 清空当前会话",
          status: "done",
          createdAt: Date.now(),
        },
      ]);
      setComposerNotice("已显示可用命令");
      return;
    }
    await runPrompt(text, provider);
  };
  const retry = async () => {
    const prompt = lastPrompt.current;
    if (!prompt || sending) return;
    await runPrompt(prompt.text, prompt.provider, false);
  };
  const regenerate = async () => {
    const text = [...messages]
      .reverse()
      .find((message) => message.role === "user")?.content;
    if (!text || sending || !onPrompt) return;
    setError(undefined);
    setSending(true);
    try {
      await onPrompt(text, provider);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Agent 请求失败");
    } finally {
      setSending(false);
    }
  };
  const copyMessage = async (id: string, content: string) => {
    try {
      await navigator.clipboard?.writeText(content);
      setCopiedMessage(id);
      window.setTimeout(
        () =>
          setCopiedMessage((current) => (current === id ? undefined : current)),
        1400,
      );
    } catch {
      setComposerNotice("当前环境不支持复制");
    }
  };
  return (
    <section className="chat-panel" aria-label="Agent 对话">
      <header className="chat-header">
        <div>
          <span className="eyebrow">WORKSPACE CHAT</span>
          <h1>{provider}</h1>
          <span className="session-meta">会话 {sessionId}</span>
        </div>
        <label className="provider-picker">
          Agent
          <select
            aria-label="选择 Provider"
            value={provider}
            onChange={(event) => {
              setProvider(event.target.value);
              onProviderChange?.(event.target.value);
            }}
          >
            {providers.map((item) => (
              <option
                key={item}
                value={item}
                disabled={disabledProviders.includes(item)}
              >
                {item}
                {disabledProviders.includes(item) ? "（未安装）" : ""}
              </option>
            ))}
          </select>
        </label>
      </header>
      {error && (
        <div className="chat-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void retry()} disabled={sending}>
            重试
          </button>
        </div>
      )}
      <div
        ref={transcriptRef}
        className="chat-transcript list"
        role="log"
        aria-live="polite"
        onScroll={(event) => {
          const element = event.currentTarget;
          const atBottom =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            80;
          stickToBottom.current = atBottom;
          setShowScrollButton(
            !atBottom && element.scrollHeight > element.clientHeight + 80,
          );
        }}
      >
        {messages.length === 0 ? (
          <div className="chat-empty welcome">
            {scope === "project" && projectName && (
              <div className="project-context-strip welcome-context">
                项目上下文 · {projectName}
              </div>
            )}
            <div className="empty-mark welcome-mark">✦</div>
            <span className="welcome-status welcome-tag">SYSTEM READY</span>
            <h2 className="welcome-title">今天想让 Agent 做什么？</h2>
            <p className="welcome-sub">
              从一个快捷任务开始，或直接描述你的代码问题。
            </p>
            <div className="quick-prompts welcome-grid">
              <button
                className="welcome-card"
                type="button"
                onClick={() =>
                  useQuickPrompt("帮我快速了解这个项目的目录结构和主要技术栈")
                }
              >
                了解项目
              </button>
              <button
                className="welcome-card"
                type="button"
                onClick={() =>
                  useQuickPrompt(
                    "检查当前项目中最值得优先修复的问题，并给出修复计划",
                  )
                }
              >
                检查问题
              </button>
              <button
                className="welcome-card"
                type="button"
                onClick={() =>
                  useQuickPrompt(
                    "帮我实现一个小功能，并先说明你准备修改哪些文件",
                  )
                }
              >
                实现功能
              </button>
              <button
                className="welcome-card"
                type="button"
                onClick={() =>
                  useQuickPrompt("阅读当前代码，找出潜在的性能或安全风险")
                }
              >
                代码审查
              </button>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              provider={provider}
              copied={copiedMessage === message.id}
              sending={sending}
              onCopy={(id, content) => void copyMessage(id, content)}
              onRegenerate={() => void regenerate()}
              onFeedback={() => setComposerNotice("已记录反馈")}
              onEditResend={(text) => void runPrompt(text)}
              onSuggestion={useQuickPrompt}
            />
          ))
        )}
      </div>
      {showScrollButton && (
        <button
          type="button"
          className="scroll-bottom"
          aria-label="回到底部"
          title="回到底部"
          onClick={scrollToBottom}
        >
          ↓
        </button>
      )}
      <Composer
        draft={draft}
        messages={messages}
        provider={provider}
        sending={sending}
        queued={queued}
        notice={composerNotice}
        onDraftChange={(value) => setDraft(value)}
        onSend={() => void send()}
        onStop={() => {
          setSending(false);
          void onAbort?.(sessionId);
        }}
        onCancelQueued={(index) =>
          setQueued((current) =>
            current.filter((_, itemIndex) => itemIndex !== index),
          )
        }
        onEditQueued={(index) => {
          const item = queued[index];
          if (!item) return;
          setDraft(item);
          setQueued((current) =>
            current.filter((_, itemIndex) => itemIndex !== index),
          );
        }}
        onPromoteQueued={(index) => {
          const item = queued[index];
          if (!item) return;
          setQueued((current) => [
            item,
            ...current.filter((_, itemIndex) => itemIndex !== index),
          ]);
          void onAbort?.(sessionId);
          setSending(false);
        }}
      />
    </section>
  );
}

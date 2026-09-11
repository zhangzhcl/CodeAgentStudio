import { useEffect, useRef, useState, type CSSProperties } from "react";
import { EventSequencer } from "@codeagent-studio/protocol";
import type { AgentEvent } from "@codeagent-studio/protocol";
import { applyAgentEvent, type ChatMessage } from "./chat-state.js";
import { MessageItem } from "./message-item.js";
import { Composer } from "./Composer.js";
import { IconArrowDown, IconSparkle } from "../icons.js";
import { getAgentPresentation } from "../agent-presentation.js";

type PromptSendOptions = { repeat?: boolean };
type Props = {
  sessionId: string;
  providerName?: string;
  providerLocked?: boolean;
  scope?: "personal" | "project";
  projectName?: string;
  providers?: string[];
  disabledProviders?: string[];
  loadMessages?: () => Promise<ChatMessage[]>;
  subscribe?: (listener: (event: AgentEvent) => void) => () => void;
  onPrompt?: (text: string, provider: string, model: string, options?: PromptSendOptions) => Promise<void> | void;
  onAbort?: (sessionId: string) => Promise<unknown> | unknown;
  onProviderChange?: (provider: string) => void;
  onTitleChange?: (title: string) => void;
  onStatsChange?: (stats: { rounds: number; tokens: number }) => void;
  onSelectBranch?: (messageId: string, index: number) => void;
  quickPrompts?: string[];
};

export const DEFAULT_WELCOME_PROMPTS = [
  "帮我搜索本周 AI 领域的重要新闻，并总结成三条要点",
  "用 TypeScript 写一个防抖函数，要求带完整注释",
  "头脑风暴：给一家主打深夜营业的咖啡品牌起 10 个名字",
  "把这句话翻译成英文：工欲善其事，必先利其器",
];

export function ChatPanel({
  sessionId,
  providerName = "Claude",
  providerLocked = false,
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
  onStatsChange,
  onSelectBranch,
  quickPrompts = DEFAULT_WELCOME_PROMPTS,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [provider, setProvider] = useState(providerName);
  const agentPresentation = getAgentPresentation(provider);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [queued, setQueued] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [composerNotice, setComposerNotice] = useState("");
  const [copiedMessage, setCopiedMessage] = useState<string>();
  const lastPrompt = useRef<{ text: string; provider: string; model: string }>();
  const [showScrollButton, setShowScrollButton] = useState(false);
  const sequencer = useRef(new EventSequencer());
  const transcriptRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  useEffect(() => {
    onStatsChange?.({
      rounds: messages.filter((message) => message.role === "user").length,
      tokens: Math.max(0, Math.ceil(messages.reduce((total, message) => total + message.content.length, 0) / 4)),
    });
  }, [messages, onStatsChange]);
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
    onStatsChange?.({ rounds: 0, tokens: 0 });
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
  const userMessages = messages.filter((message) => message.role === "user");
  const jumpToMessage = (messageId: string) => {
    const target = transcriptRef.current?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(messageId)}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const runPrompt = async (
    text: string,
    selectedProvider: string,
    optimistic = true,
    selectedModel = "",
    repeat = false,
  ) => {
    lastPrompt.current = { text, provider: selectedProvider, model: selectedModel };
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
      await onPrompt(text, selectedProvider, selectedModel, { repeat });
      // IPC streaming providers resolve when the run is registered and finish
      // via done/error events. Standalone callers without a stream callback
      // are complete at this point and must unlock the composer immediately.
      if (!subscribe) setSending(false);
    } catch (cause) {
      setSending(false);
      setError(cause instanceof Error ? cause.message : "Agent 请求失败");
    }
  };
  const send = async (selectedModel = "") => {
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
    await runPrompt(text, provider, true, selectedModel);
  };
  const retry = async () => {
    const prompt = lastPrompt.current;
    if (!prompt || sending) return;
    await runPrompt(prompt.text, prompt.provider, false, prompt.model, true);
  };
  const regenerate = async () => {
    const text = [...messages]
      .reverse()
      .find((message) => message.role === "user")?.content;
    if (!text || sending || !onPrompt) return;
    setError(undefined);
    setSending(true);
    try {
      await onPrompt(text, provider, lastPrompt.current?.model ?? "", { repeat: true });
      if (!subscribe) setSending(false);
    } catch (cause) {
      setSending(false);
      setError(cause instanceof Error ? cause.message : "Agent 请求失败");
    }
  };
  const copyMessage = async (id: string, content: string) => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(content);
      else throw new Error("clipboard-unavailable");
      setCopiedMessage(id);
      window.setTimeout(
        () =>
          setCopiedMessage((current) => (current === id ? undefined : current)),
        1400,
      );
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = content;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
        setCopiedMessage(id);
      } catch {
        setComposerNotice("当前环境不支持复制");
      }
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
            disabled={providerLocked}
            title={providerLocked ? "已有会话的 Agent 不可切换，请新建会话" : "选择 Agent"}
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
      <div className="list-wrap">
        <div className="list-viewport">
          <div
            ref={transcriptRef}
            className="chat-transcript list"
            role="log"
            aria-live="polite"
            onScroll={(event) => {
              const element = event.currentTarget;
              const atBottom =
                element.scrollHeight -
                  element.scrollTop -
                  element.clientHeight <
                80;
              stickToBottom.current = atBottom;
              setShowScrollButton(
                !atBottom && element.scrollHeight > element.clientHeight + 80,
              );
            }}
          >
            {messages.length === 0 ? (
              <div className="chat-empty welcome">
                <div className="empty-mark welcome-mark">
                  <IconSparkle size={22} />
                </div>
                <span className="welcome-status welcome-tag">SYSTEM READY</span>
                <h1 className="welcome-title">{agentPresentation.greeting}</h1>
                <p className="welcome-sub">
                  {agentPresentation.description}
                </p>
                {scope === "project" && projectName && (
                  <div className="welcome-context">
                    <span className="conv-head-dot" aria-hidden="true" />
                    已挂载项目「{projectName}」的共享上下文，本会话与项目内其他会话共享项目资料
                  </div>
                )}
                <div className="quick-prompts welcome-grid" aria-label="快捷任务">
                  {quickPrompts.map((prompt) => (
                    <button key={prompt} className="welcome-card" type="button" onClick={() => useQuickPrompt(prompt)}>
                      {prompt}
                    </button>
                  ))}
        </div>
      </div>
            ) : (
              <div className="list-inner">
                {messages.map((message, index) => (
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
                    isLastAgent={
                      message.role === "agent" &&
                      !messages.slice(index + 1).some((item) => item.role === "agent")
                    }
                    onSelectBranch={(branchIndex) => onSelectBranch?.(message.id, branchIndex)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        <nav className="conversation-rail" aria-label="提问定位" onWheel={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}>
          <div className="conversation-rail-content" style={{ "--rail-content-height": `${Math.max(100, userMessages.length * 28)}px` } as CSSProperties}>
            <span className="conversation-rail-track" aria-hidden="true" />
            {userMessages.map((message, index) => {
              const top = userMessages.length === 1 ? 50 : (index / (userMessages.length - 1)) * 100;
              const preview = `${message.content.slice(0, 48)}${message.content.length > 48 ? "…" : ""}`;
              return <button key={message.id} type="button" className="conversation-marker" style={{ top: `${top}%` }} onClick={() => jumpToMessage(message.id)} title={preview} data-preview={preview} aria-label={`定位提问：${preview}`} />;
            })}
          </div>
        </nav>
        {showScrollButton && (
          <button
            type="button"
            className="jump-bottom scroll-bottom"
            aria-label="回到底部"
            title="回到底部"
            onClick={scrollToBottom}
          >
            <IconArrowDown size={15} />
          </button>
        )}
      </div>
      <Composer
        draft={draft}
        messages={messages}
        provider={provider}
        sending={sending}
        queued={queued}
        notice={composerNotice}
        onDraftChange={(value) => setDraft(value)}
        onSend={(_, model) => void send(model)}
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

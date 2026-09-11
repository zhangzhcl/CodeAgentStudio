import type { AgentEvent } from "@codeagent-studio/protocol";

export type ChatMessage = {
  id: string;
  role: "user" | "agent" | "tool";
  content: string;
  status?: "streaming" | "done" | "error";
  createdAt?: number;
  thinking?: "running" | "done";
  thinkingContent?: string;
  suggestions?: string[];
  branch?: { index: number; total: number };
};

export function applyAgentEvent(
  messages: ChatMessage[],
  event: AgentEvent,
): ChatMessage[] {
  if (event.type === "thinking_delta") {
    const index = messages.findIndex((message) => message.id === event.messageId);
    if (index < 0) return [...messages, { id: event.messageId, role: "agent", content: "", thinking: "running", thinkingContent: event.payload.text, status: "streaming", createdAt: Date.now() }];
    const next = messages.slice();
    next[index] = { ...next[index], thinking: "running", thinkingContent: `${next[index].thinkingContent ?? ""}${event.payload.text}`, status: "streaming" };
    return next;
  }
  if (event.type === "text_delta") {
    const index = messages.findIndex(
      (message) => message.id === event.messageId,
    );
    if (index < 0)
      return [
        ...messages,
        {
          id: event.messageId,
          role: "agent",
          content: event.payload.text,
          status: "streaming",
          thinking: "running",
          createdAt: Date.now(),
        },
      ];
    const next = messages.slice();
    next[index] = {
      ...next[index],
      content: next[index].content + event.payload.text,
      status: "streaming",
      thinking: "running",
    };
    return next;
  }
  if (event.type === "done")
    return messages.map((message) =>
      message.status === "streaming"
        ? {
            ...message,
            status: "done",
            thinking: message.role === "agent" ? "done" : message.thinking,
          }
        : message,
    );
  if (event.type === "error")
    return [
      ...messages,
      {
        id: `${event.messageId}:error:${event.sequence}`,
        role: "agent",
        content: event.payload.message,
        status: "error",
      },
    ];
  // 同一轮运行的所有事件共用 runMessageId，工具与错误需要独立条目渲染；
  // 直接复用 messageId 会与正文消息产生重复的 React key。
  if (event.type === "tool.started")
    return [
      ...messages,
      {
        id: `${event.messageId}:tool:${event.sequence}`,
        role: "tool",
        content: `正在执行 ${event.payload.toolName}\n${JSON.stringify(event.payload.input, null, 2)}`,
        status: "streaming",
      },
    ];
  if (event.type === "tool.completed")
    return [
      ...messages,
      {
        id: `${event.messageId}:tool:${event.sequence}`,
        role: "tool",
        content: `${event.payload.toolName}\n${JSON.stringify(event.payload.output, null, 2)}`,
        status: "done",
      },
    ];
  return messages;
}

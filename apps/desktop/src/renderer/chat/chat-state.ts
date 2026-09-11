import type { AgentEvent } from "@codeagent-studio/protocol";

export type ChatMessage = {
  id: string;
  role: "user" | "agent" | "tool";
  content: string;
  status?: "streaming" | "done" | "error";
  createdAt?: number;
  thinking?: "running" | "done";
  attachments?: Array<{ name: string; size: number; type?: string }>;
  suggestions?: string[];
  branch?: { index: number; total: number };
};

export function applyAgentEvent(
  messages: ChatMessage[],
  event: AgentEvent,
): ChatMessage[] {
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
        id: event.messageId,
        role: "agent",
        content: event.payload.message,
        status: "error",
      },
    ];
  if (event.type === "tool.started")
    return [
      ...messages,
      {
        id: event.messageId,
        role: "tool",
        content: `正在执行 ${event.payload.toolName}\n${JSON.stringify(event.payload.input, null, 2)}`,
        status: "streaming",
      },
    ];
  if (event.type === "tool.completed")
    return [
      ...messages,
      {
        id: event.messageId,
        role: "tool",
        content: `${event.payload.toolName}\n${JSON.stringify(event.payload.output, null, 2)}`,
        status: "done",
      },
    ];
  return messages;
}

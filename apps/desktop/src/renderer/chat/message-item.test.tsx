import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { MessageItem } from "./message-item.js";

describe("MessageItem", () => {
  it("shows the Agent name only once in an agent response header", () => {
    render(
      <MessageItem
        message={{ id: "agent-1", role: "agent", content: "完成", createdAt: 0 }}
        provider="Claude"
        copied={false}
        sending={false}
        onCopy={vi.fn()}
        onRegenerate={vi.fn()}
        onFeedback={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Claude", { exact: true })).toHaveLength(1);
  });
});

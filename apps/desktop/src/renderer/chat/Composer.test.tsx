import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer.js";

describe("Composer", () => {
  it("uses the configured model instead of static model choices", () => {
    render(
      <Composer
        {...({
          draft: "",
          messages: [],
          provider: "Claude",
          configuredModels: [
            { id: "claude-haiku-4-5", label: "glm-5.3", tag: "Haiku" },
            { id: "claude-sonnet-4-6[1M]", label: "glm-5.3-flash", tag: "Sonnet" },
            { id: "claude-opus-4-8[1M]", label: "glm-5.3", tag: "Opus" },
          ],
          sending: false,
          onDraftChange: vi.fn(),
          onSend: vi.fn(),
          onStop: vi.fn(),
          queued: [],
          onCancelQueued: vi.fn(),
          onEditQueued: vi.fn(),
          onPromoteQueued: vi.fn(),
        } as any)}
      />,
    );

    expect(screen.getByText("claude-haiku-4-5")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("当前模型：claude-haiku-4-5"));
  const options = screen.getAllByRole("option");
  expect(options).toHaveLength(3);
  expect(options[0]).toHaveTextContent("glm-5.3");
  expect(options[1]).toHaveTextContent("glm-5.3-flash");
  expect(options[2]).toHaveTextContent("glm-5.3");
    expect(screen.queryByRole("option", { name: /Claude Sonnet/ })).not.toBeInTheDocument();
  });
});

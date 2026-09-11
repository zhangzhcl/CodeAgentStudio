import { describe, expect, it } from "vitest";
import { getAgentPresentation } from "./agent-presentation.js";

describe("agent presentation", () => {
  it("uses the selected provider identity in the welcome copy", () => {
    expect(getAgentPresentation("cursor").greeting).toBe("你好，我是 Cursor Agent");
    expect(getAgentPresentation("opencode").name).toBe("OpenCode");
  });

  it("falls back safely for a newly detected provider", () => {
    expect(getAgentPresentation("my-agent").greeting).toBe("你好，我是 my-agent");
  });
});

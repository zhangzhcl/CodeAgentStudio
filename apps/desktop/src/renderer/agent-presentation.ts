export type AgentPresentation = {
  id: string;
  name: string;
  greeting: string;
  description: string;
  model: string;
};

const PRESENTATIONS: Record<string, AgentPresentation> = {
  claude: { id: "claude", name: "Claude", greeting: "你好，我是 Claude", description: "我可以协助你阅读项目、编写代码，并把复杂任务拆解成可执行的步骤。", model: "Claude" },
  cursor: { id: "cursor", name: "Cursor", greeting: "你好，我是 Cursor Agent", description: "我可以结合当前工作区理解代码、修改文件，并陪你完成开发任务。", model: "Cursor Agent" },
  codex: { id: "codex", name: "Codex", greeting: "你好，我是 Codex", description: "我可以分析代码、实现功能、运行验证，并协助你完成工程级修改。", model: "Codex" },
  pi: { id: "pi", name: "Pi", greeting: "你好，我是 Pi Coding Agent", description: "我可以和你持续协作，探索方案、编写代码，并在会话中逐步推进任务。", model: "Pi" },
  opencode: { id: "opencode", name: "OpenCode", greeting: "你好，我是 OpenCode", description: "我可以使用项目上下文完成代码问答、编辑和开发辅助。", model: "OpenCode" },
};

export function getAgentPresentation(provider?: string): AgentPresentation {
  const id = (provider ?? "claude").trim().toLowerCase();
  return PRESENTATIONS[id] ?? { ...PRESENTATIONS.claude, id, name: provider?.trim() || "Agent", greeting: `你好，我是 ${provider?.trim() || "Agent"}`, model: provider?.trim() || "Agent" };
}

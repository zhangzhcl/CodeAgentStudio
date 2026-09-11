export type AgentPresentation = {
  id: string;
  name: string;
  greeting: string;
  description: string;
  model: string;
};
export type AgentModel = { id: string; label: string; tag: string; speed: number };

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

const MODELS: Record<string, AgentModel[]> = {
  claude: [{ id: 'sonnet', label: 'Claude Sonnet', tag: '均衡', speed: 2 }, { id: 'opus', label: 'Claude Opus', tag: '旗舰', speed: 1 }, { id: 'haiku', label: 'Claude Haiku', tag: '极速', speed: 3 }],
  cursor: [{ id: 'auto', label: 'Auto', tag: '自动选择', speed: 3 }, { id: 'sonnet-4', label: 'Claude Sonnet 4', tag: '均衡', speed: 2 }, { id: 'gpt-5', label: 'GPT-5', tag: '推理', speed: 2 }],
  codex: [{ id: 'gpt-5-codex', label: 'GPT-5 Codex', tag: '编码', speed: 2 }, { id: 'o4-mini', label: 'o4-mini', tag: '极速', speed: 3 }],
  pi: [{ id: 'sensenova-6.8-flash-lite', label: 'sensenova-6.8-flash-lite', tag: '轻量 Agent', speed: 3 }, { id: 'deepseek-v4-flash', label: 'deepseek-v4-flash', tag: '1M 上下文', speed: 2 }, { id: 'glm-5.2', label: 'glm-5.2', tag: '长上下文', speed: 1 }],
  opencode: [{ id: 'sensenova-6.8-flash-lite', label: 'sensenova-6.8-flash-lite', tag: '轻量 Agent', speed: 3 }, { id: 'deepseek-v4-pro', label: 'deepseek-v4-pro', tag: '高性能', speed: 2 }, { id: 'kimi-k3', label: 'kimi-k3', tag: '1M 上下文', speed: 2 }],
};
export function getAgentModels(provider?: string): AgentModel[] { return MODELS[(provider ?? '').trim().toLowerCase()] ?? MODELS.claude; }

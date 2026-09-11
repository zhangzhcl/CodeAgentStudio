# CodeAgent Studio

CodeAgent开发平台：独立打包的本地桌面工作台，统一接入 Claude Code、Cursor CLI、Codex、Pi Coding Agent 与 opencode，并提供项目文件树、Monaco 编辑器和会话管理。

## 当前状态

已完成协议、项目文件沙箱、Workbench、文件树、编辑器状态模型、聊天流式状态、CLI Provider 适配层、Pi Transport、Provider 生命周期、原生会话发现与日志基础能力。项目目录与 Agent 默认工作区已分离：只有用户显式选择的目录会进入项目列表，原生会话默认归入个人会话。

项目表通过 `source` 持久化归属（`user` 或 `native-discovered`）。会话只有在其原生工作目录落入用户已登记项目根目录时才归入项目会话，否则归入对应 Agent 的个人会话；切换 Agent 不会混显示其他 Agent 的会话。

当前本机已完成只读真实冒烟：Claude Code 2.1.267、Cursor Agent 2026.09.08-6caf4ff、Codex CLI 0.153.4、Pi 0.85.1、OpenCode 1.18.30 均能启动并返回 `PING`。四种 CLI 的流式参数已分别接入；只有 Pi 的原生会话恢复已接入，其他 CLI 当前在恢复历史后按新运行降级。

## 开发运行

要求 Node.js 22+ 与 pnpm 10+：

```bash
pnpm install
pnpm --filter @codeagent-studio/protocol test
pnpm --filter @codeagent-studio/desktop test -- --run
pnpm --filter @codeagent-studio/desktop typecheck

# Electron 开发模式
pnpm --filter @codeagent-studio/desktop start

# Windows/macOS/Linux 打包
pnpm --filter @codeagent-studio/desktop package
```

生产 Electron 使用 `better-sqlite3`，其 native binding 必须与 Electron ABI 匹配；打包流程会准备对应的 native module。SQLite 集成测试在 Node 22 中使用内置 SQLite 兼容适配执行迁移、WAL 和损坏恢复验证，不依赖本机 better-sqlite3 ABI。

真实 Agent E2E（会产生真实模型请求，默认跳过）：

```powershell
$env:CODEAGENT_REAL_AGENT_E2E = "1"
pnpm --filter @codeagent-studio/desktop test -- --run src/main/providers/real-agent.e2e.test.ts
```

## 合规边界

项目协议、Provider 合同和文件服务均为 CodeAgent Studio 自有实现。参考仓库不作为依赖引入；复制 MIT 文件时必须保留版权头并登记在 [NOTICE](./NOTICE) 中。MVP 暂不包含自动更新与遥测上传。

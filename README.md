# CodeAgent Studio

CodeAgent开发平台：独立打包的本地桌面工作台，统一接入 Claude Code、Cursor CLI、Codex、Pi Coding Agent 与 opencode，并提供项目文件树、Monaco 编辑器和会话管理。

## 当前状态

已完成协议、项目文件沙箱、Workbench、文件树、编辑器状态模型、聊天流式状态、CLI Provider 适配层、Pi Transport、Provider 生命周期、原生会话发现与日志基础能力。项目目录与 Agent 默认工作区已分离：只有用户显式选择的目录会进入项目列表，原生会话默认归入个人会话。

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

如果本机 Node.js 主版本与 `better-sqlite3` 的预编译模块不一致，请先执行 `pnpm rebuild better-sqlite3`，再运行测试或 Electron。

## 合规边界

项目协议、Provider 合同和文件服务均为 CodeAgent Studio 自有实现。参考仓库不作为依赖引入；复制 MIT 文件时必须保留版权头并登记在 [NOTICE](./NOTICE) 中。MVP 暂不包含自动更新与遥测上传。

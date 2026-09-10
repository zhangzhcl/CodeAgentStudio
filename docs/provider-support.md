# Provider 支持矩阵

| Provider | 检测命令 | 未安装行为 | 当前状态 |
|---|---|---|---|
| Claude Code | `claude --version` | 显示“未就绪”，不阻塞应用启动 | 适配器已完成，需本机联调 |
| Cursor CLI | `agent --version` | 显示“未就绪”，不阻塞应用启动 | 适配器已完成；支持 Windows `agent.ps1` |
| Codex | `codex --version` | 显示“未就绪”，不阻塞应用启动 | 适配器已完成，需本机联调 |
| Pi Coding Agent | SDK/RPC transport 探针 | 显示“未就绪”，不阻塞应用启动 | Transport 已完成，SDK 版本待锁定 |
| opencode | `opencode --version` | 显示“未就绪”，不阻塞应用启动 | 适配器已加入；本机 1.18.30 |

本机探测记录（2026-09-11）：Claude Code 2.1.267、Cursor Agent 2026.09.08-6caf4ff、Codex CLI 0.153.4、Pi 0.85.1、opencode 1.18.30。

Cursor Windows 原生安装（官方）：

```powershell
irm 'https://cursor.com/install?win32=true' | iex
agent --version
```

## 联调命令模板

- Claude：`claude -p "<prompt>" --add-dir <projectRoot>`；继续会话使用 `--resume <session-id>`。
- Codex：`codex exec "<prompt>"`；恢复会话使用 `codex resume <session-id>`。
- Pi：`pi --print --mode json --session <session-file> "<prompt>"`；恢复使用同一 `--session` 文件。
- opencode：`opencode run "<prompt>" --session <session-id>`；恢复使用 `--continue` 或 `--session`。

以上命令模板会触发真实模型请求，联调时必须由用户明确选择项目目录和 Provider。

## 认证配置

- Claude：使用 Claude Code 自带 `/login`，或在启动环境提供 `ANTHROPIC_API_KEY`。
- Codex：使用 `codex login`，凭据由 Codex CLI 管理。
- Pi：使用 `pi auth` 或对应 Provider 的环境变量；CodeAgent Studio 不读取或复制 Pi 凭据文件。
- opencode：使用 `opencode auth`/`opencode providers` 配置 Provider。

CodeAgent Studio 只保存 Provider 标识和会话元数据，不把 API Key 写入项目目录或会话转录。

### Pi Transport 约定

Pi CLI 0.85.1 提供 `--mode json`、`--session <path>`、`--session-id <id>`、
`--resume <path|id>` 和 `--session-dir <dir>`。Pi 会话文件应保存在应用用户数据目录，
不放入项目根目录；SDK/RPC 对象只允许存在于 Electron 主进程，不能通过 IPC 序列化。

检测仅执行版本探针，不主动触发登录或认证流程。真实会话启动时显式传入项目 cwd；用户级配置目录由 Provider 自身读取，不纳入项目文件沙箱。

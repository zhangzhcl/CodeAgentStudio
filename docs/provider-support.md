# Provider 支持矩阵

| Provider | 检测命令 | 未安装行为 | 当前状态 |
|---|---|---|---|
| Claude Code | `claude --version` | 显示“未就绪”，不阻塞应用启动 | `stream-json` 增量输出已验证；原生 resume 尚未接入 |
| Cursor CLI | `agent --version` | 显示“未就绪”，不阻塞应用启动 | Windows `agent.ps1`、`stream-json` 增量输出已验证；原生 resume 尚未接入 |
| Codex | `codex --version` | 显示“未就绪”，不阻塞应用启动 | `codex exec --json` 增量事件已验证；原生 resume 尚未接入 |
| Pi Coding Agent | `pi --version` | 显示“未就绪”，不阻塞应用启动 | `--mode json` 增量事件与精确 `--session <file>` 恢复已验证 |
| opencode | `opencode --version` | 显示“未就绪”，不阻塞应用启动 | `run --format json` 增量事件已验证；原生 resume 尚未接入 |

本机探测记录（2026-09-11）：Claude Code 2.1.267、Cursor Agent 2026.09.08-6caf4ff、Codex CLI 0.153.4、Pi 0.85.1、opencode 1.18.30。

Cursor Windows 原生安装（官方）：

```powershell
irm 'https://cursor.com/install?win32=true' | iex
agent --version
```

## 联调命令模板

- Claude：`claude -p --output-format stream-json --include-partial-messages --verbose "<prompt>"`；原生恢复命令为 `--resume <session-id>`，当前适配器暂按新运行处理。
- Cursor：`agent -p --output-format stream-json --stream-partial-output "<prompt>"`；原生恢复命令为 `--resume <chat-id>`，当前适配器暂按新运行处理。
- Codex：`codex exec --json "<prompt>"`；原生恢复命令为 `codex exec resume <session-id>`，当前适配器暂按新运行处理。
- Pi：`pi --print --mode json --session <session-file> "<prompt>"`；非交互恢复使用同一个精确 session 文件再次传入 `--session`（Pi 的 `--resume` 在无 TTY 时会打开选择器），已接入并通过二次对话验证。
- opencode：`opencode run --format json "<prompt>" --session <session-id>`；恢复使用 `--session`，当前适配器暂按新运行处理。

以上命令模板会触发真实模型请求，联调时必须由用户明确选择项目目录和 Provider。

## 认证配置

- Claude：使用 Claude Code 自带 `/login`，或在启动环境提供 `ANTHROPIC_API_KEY`。
- Codex：使用 `codex login`，凭据由 Codex CLI 管理。
- Pi：使用 `pi auth` 或对应 Provider 的环境变量；CodeAgent Studio 不读取或复制 Pi 凭据文件。
- opencode：使用 `opencode auth`/`opencode providers` 配置 Provider。

CodeAgent Studio 只保存 Provider 标识和会话元数据，不把 API Key 写入项目目录或会话转录。

### Pi Transport 约定

Pi CLI 0.85.1 提供 `--mode json`、`--session <path>`、`--session-id <id>`、
`--resume <path|id>` 和 `--session-dir <dir>`。默认扫描和创建目录统一为
`%USERPROFILE%/.pi/agent/sessions`（macOS/Linux 为 `~/.pi/agent/sessions`），也可用
`CODEAGENT_PI_HOME` 或 `CODEAGENT_PI_SESSION_DIR` 覆盖；Pi 会话文件不放入项目根目录；SDK/RPC
对象只允许存在于 Electron 主进程，不能通过 IPC 序列化。

检测仅执行版本探针，不主动触发登录或认证流程。真实会话启动时显式传入项目 cwd；用户级配置目录由 Provider 自身读取，不纳入项目文件沙箱。

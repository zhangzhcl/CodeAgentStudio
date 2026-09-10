# Provider 支持矩阵

| Provider | 检测命令 | 未安装行为 | 当前状态 |
|---|---|---|---|
| Claude Code | `claude --version` | 显示“未就绪”，不阻塞应用启动 | 适配器已完成，需本机联调 |
| Cursor CLI | `cursor --version` | 显示“未就绪”，不阻塞应用启动 | 适配器已完成，需本机联调 |
| Codex | `codex --version` | 显示“未就绪”，不阻塞应用启动 | 适配器已完成，需本机联调 |
| Pi Coding Agent | SDK/RPC transport 探针 | 显示“未就绪”，不阻塞应用启动 | Transport 已完成，SDK 版本待锁定 |
| opencode | `opencode --version` | 显示“未就绪”，不阻塞应用启动 | 适配器已加入；本机 1.18.30 |

本机探测记录（2026-09-10）：Claude Code 2.1.267、Codex CLI 0.153.4、Pi 0.85.1、opencode 1.18.30；Cursor CLI 未安装。

检测仅执行版本探针，不主动触发登录或认证流程。真实会话启动时显式传入项目 cwd；用户级配置目录由 Provider 自身读取，不纳入项目文件沙箱。

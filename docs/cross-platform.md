# 跨平台与多人交付策略

项目代码不包含任何开发者机器的绝对路径。Provider 命令解析规则：

1. 优先读取环境变量覆盖（例如 `CODEAGENT_CURSOR_AGENT`）。
2. Windows 使用当前登录用户的 `%LOCALAPPDATA%\cursor-agent\agent.ps1`（通过 `homedir()` 动态计算）。
3. 若默认路径不存在，则回退到 PATH 中的 `agent` 命令。
4. macOS/Linux 直接使用 PATH 中的 `agent`、`claude`、`codex`、`opencode`。

项目注册保存的是用户选择的项目根目录，不保存开发者机器路径。打包产物由 Electron Forge 分别针对 win32、darwin、linux 构建；Provider 是否可用在目标机器启动时动态探测。

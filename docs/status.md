# CodeAgent Studio 开发状态

## 已完成并已验证

- 自有协议、版本握手、事件序列和 Provider 合同
- SQLite 项目/会话/消息持久化，包含 schema v1→v6 迁移与项目来源标记
- 项目注册、路径沙箱、句柄级文本读写和文件操作 IPC
- 文件资源管理器、Monaco 编辑器、文件打开/编辑/保存闭环
- 个人会话/项目会话、会话标题、转录回放和 Agent 聊天 UI
- Claude、Cursor、Codex、Pi、OpenCode Provider 适配器
- Pi 原生 session 文件恢复；其他 CLI 在恢复时降级为新运行并保留历史转录
- Provider 发现、并发限制、停止控制、完成状态持久化
- 脱敏日志、Vite 构建、Electron Forge Windows x64 ZIP 打包
- 五个本机真实 Agent 的 JSON/流式冒烟与 Pi 二次会话恢复测试

## 当前限制

- 当前已验证 Windows；macOS/Linux 尚未完成实机打包验证
- Node ABI 与 Electron 原生模块不一致时，Node 环境的 SQLite 集成测试需在 Electron runtime 或重建 native binding 后执行
- 文件监听、上传/下载 UI、DiffEditor、系统钥匙串凭据存储、自动更新和签名发布尚未加入 MVP
- 真实 Agent E2E 默认跳过，使用 `CODEAGENT_REAL_AGENT_E2E=1` 显式启用

## 下一阶段

1. macOS/Linux 实机打包与安装验证
2. 文件监听、保存冲突确认与上传/下载 UI
3. 系统钥匙串凭据存储和 Provider 原生 transcript 自动发现
4. Playwright 自动化验收、签名与发布流程

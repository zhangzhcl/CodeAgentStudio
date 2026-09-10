# CodeAgent Studio 开发进度

## 已完成

- 自有协议、版本握手和 Provider 合同
- 项目注册、路径沙箱与文件操作 IPC
- 文件资源管理器与 Monaco 编辑器
- 文件打开、编辑、保存闭环
- 个人会话/项目会话和聊天 UI
- Claude、Cursor、Codex 适配器骨架
- Pi Transport 与受控恢复骨架
- Provider 发现、并发限制、停止控制
- 脱敏日志、Vite 构建和 Electron Forge Windows ZIP

## 当前限制

- 会话和项目注册目前为进程内存存储，尚未接 SQLite
- CLI 适配器已统一协议，但仍需在各 Agent 的真实安装环境联调
- Pi SDK 具体版本和认证存储尚未锁定
- 文件监听、上传/下载、DiffEditor 和自动更新尚未加入 MVP

## 下一阶段顺序

1. SQLite 项目/会话持久化
2. 真实 Provider 端到端联调
3. 文件监听与冲突确认 UI
4. 完整打包安装器、签名和发布流程

# 打包与交付

## 跨平台 ZIP

```bash
pnpm install
pnpm verify
pnpm --filter @codeagent-studio/desktop package
```

默认在当前操作系统生成对应架构的 ZIP：

```bash
# Windows
pnpm --filter @codeagent-studio/desktop package

# macOS
pnpm --filter @codeagent-studio/desktop package

# Linux
pnpm --filter @codeagent-studio/desktop package
```

产物位于 `apps/desktop/out/make/`，文件名包含平台、架构和版本。由于 Electron
原生模块需要目标系统 ABI，发布 macOS/Linux 版本时应在对应系统或 CI runner 上构建。

打包包含 Electron 主进程、preload、renderer 和 Monaco 资源。首次运行时，Provider 是否可用取决于本机是否安装对应 CLI；未安装的 Provider 显示为“未就绪”，不会阻塞应用启动。

MVP 暂不提供自动更新，后续可接入签名发布和更新服务。

## SQLite 开发环境

首次启用 `better-sqlite3` 原生 binding 时执行：

```bash
pnpm approve-builds
pnpm rebuild better-sqlite3
```

如果 binding 不可用，应用会自动降级为内存模式，不影响界面启动。

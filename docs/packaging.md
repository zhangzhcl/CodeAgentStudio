# 打包与交付

## Windows ZIP

```bash
pnpm install
pnpm verify
pnpm --filter @codeagent-studio/desktop package
```

产物位于 `apps/desktop/out/make/`，文件名格式为
`@codeagent-studio-desktop-win32-x64-<version>.zip`。

打包包含 Electron 主进程、preload、renderer 和 Monaco 资源。首次运行时，Provider 是否可用取决于本机是否安装对应 CLI；未安装的 Provider 显示为“未就绪”，不会阻塞应用启动。

MVP 暂不提供自动更新，后续可接入签名发布和更新服务。

## SQLite 开发环境

首次启用 `better-sqlite3` 原生 binding 时执行：

```bash
pnpm approve-builds
pnpm rebuild better-sqlite3
```

如果 binding 不可用，应用会自动降级为内存模式，不影响界面启动。

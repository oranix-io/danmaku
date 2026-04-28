# 贡献指南

感谢你关注 LiveHiME。本文档整理本项目的本地启动、构建和贡献流程。

## 环境要求

- Node.js >= 20.19.0
- Yarn 3.6.0
  - 仓库已提交 `.yarn/releases/yarn-3.6.0.cjs`，并在 `.yarnrc.yml` 中指定 `yarnPath`
  - 如本机未启用 Yarn，可先执行 `corepack enable`

## 安装依赖

在仓库根目录执行：

```bash
yarn install
```

## 项目结构

- `main/`：Electron 主进程入口
- `preload/`：Electron preload 脚本
- `renderer/`：React + Vite 渲染进程
- `lib/`：B 站直播弹幕相关逻辑
- `assets/`：托盘图标和应用图标资源
- `build.ts`：使用 esbuild 构建主进程和 preload
- `forge.config.js`：Electron Forge 打包配置

## 启动方式

### 开发模式

推荐使用两个终端启动：

终端 1：监听并构建主进程和 preload。

```bash
yarn watch
```

终端 2：启动 Vite 渲染进程开发服务，并启动 Electron。

```bash
yarn dev
```

开发模式下：

- 主窗口加载 `http://localhost:5173`
- 弹幕窗口加载 `http://localhost:5173/danmaku.html`
- `yarn dev` 会通过 Wireit 先启动 `renderer:dev`
- `yarn watch` 会把 `main/` 和 `preload/` 构建到 `dist/`

如果只执行 `yarn dev`，需要确保 `dist/main/index.js` 和 preload 产物已经存在，否则 Electron 可能找不到入口文件。

### 构建后启动

如果不需要热更新，可以先完整构建，再启动 Electron：

```bash
yarn build
yarn start
```

完整构建会：

- 执行 `tsx build.ts`，构建主进程和 preload
- 执行 `yarn renderer:build`，构建渲染进程到 `dist/renderer`

构建后的 Electron 会加载本地文件：

- `dist/renderer/index.html`
- `dist/renderer/danmaku.html`

## 常用命令

```bash
yarn watch            # 监听并构建 main/preload
yarn dev              # 启动 Vite 开发服务和 Electron
yarn build            # 构建 main/preload 和 renderer
yarn renderer:dev     # 仅启动 renderer Vite 开发服务
yarn renderer:build   # 仅构建 renderer
yarn package          # 使用 Electron Forge 打包当前平台应用
yarn make             # 使用 Electron Forge 生成分发产物
```

Renderer 目录还提供：

```bash
yarn workspace renderer-react lint
yarn workspace renderer-react preview
```

## 调试

仓库包含 VS Code 调试配置：`.vscode/launch.json`。

可使用 `Main + renderer` compound 配置同时调试：

- `Main`：启动 Electron 主进程
- `Renderer`：连接到 `9222` 端口调试渲染进程

手动调试时，Electron 启动参数需要包含：

```bash
--remote-debugging-port=9222
```

## 常见问题

### Electron 启动时报找不到 `dist/main/index.js`

先执行以下任一方式生成主进程产物：

```bash
yarn watch
```

或：

```bash
yarn build
```

### 页面空白或无法连接 `localhost:5173`

开发模式下需要确保 Vite 服务已启动。推荐直接使用：

```bash
yarn dev
```

如果单独启动 Electron，请先运行：

```bash
yarn renderer:dev
```

### 修改主进程代码后没有生效

`yarn watch` 会重新构建主进程和 preload，但不会自动重启 Electron。主进程代码变更后需要重启 `yarn dev` 或 `yarn start`。

## 提交流程

提交前请根据改动范围执行必要检查：

```bash
yarn build
yarn workspace renderer-react lint
```

如果只修改文档，可确认文档内容准确且格式正常即可。

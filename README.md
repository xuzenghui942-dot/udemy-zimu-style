# Bilingual Subtitle Styler Plugins

这个仓库现在产出两个完全独立、可分别安装的 Chrome 插件：

- `dist/frontendmasters-subtitle-styler`：只匹配 Frontend Masters。
- `dist/udemy-subtitle-styler`：只匹配 Udemy，并实现 Udemy 自己的播放器、课程切换和全屏逻辑。

两个插件不会共享 Manifest、站点入口或 `chrome.storage.sync` 设置键。它们只在源码阶段复用字幕样式渲染器，构建后每个目录都是自包含插件，可以单独执行 Load unpacked。

两个插件都支持一键切换字幕样式的启用状态，并保留其他样式设置：

- Frontend Masters 默认快捷键：`Alt+Shift+F`。
- Udemy 默认快捷键：`Alt+Shift+U`。
- 打开 `chrome://extensions/shortcuts` 可以分别修改或清除快捷键。若默认组合已被其他插件占用，也可在这里重新绑定。

## Udemy 插件功能

- 默认英文原字幕在上、中文翻译在下，也可切换为中文在上。
- 分别设置中英文字幕的颜色、字重、字体、字号、行背景颜色与透明度。
- 分别设置中英文 SVG 描边的颜色、宽度与透明度。
- 设置字幕整体背景颜色、透明度以及中英文行间距。
- popup 实时预览、启用/禁用、恢复默认、双向同步中英文样式。
- 使用独立的 `udemySubtitleSettings` 保存 Udemy 设置。
- 只扫描当前 Udemy 播放器树，不会抓取课程目录或 transcript。
- 普通播放时 overlay 挂在 Udemy 播放器内；播放器容器进入全屏后，同一个 overlay 移入全屏元素树，退出后再移回播放器。
- 只隐藏当前被 overlay 接管的视频原生 cue；禁用插件或无法安全渲染时恢复原字幕。

## 源码边界

- `src/frontendmasters-content.js`：Frontend Masters 站点控制器。
- `src/udemy-content.js`：Udemy 站点控制器。
- `src/subtitle-styler-core.js`：中立的设置校验、双语排序、SVG 渲染和清理逻辑，不含 Udemy host 或播放器 selector。
- `src/background.js`：监听两个插件各自的一键启停命令，并切换对应的独立设置键。
- `manifests/frontendmasters.json` 与 `manifests/udemy.json`：两个独立插件的 Manifest 源文件。
- `scripts/build-extensions.js`：把共享渲染文件和对应站点控制器打成两个自包含目录。

## 构建与验证

```powershell
npm run build
npm test
```

也可以一次执行：

```powershell
npm run verify
```

测试覆盖：两个插件包隔离、Manifest host 范围、Udemy 播放器上下文、全屏挂载、中文上下顺序、overlay 复用、全部字幕样式字段、禁用恢复和既有安全约束。

## 安装

1. 运行 `npm run build`。
2. 打开 `chrome://extensions` 并开启 Developer mode。
3. 安装 Frontend Masters 插件时，选择 `dist/frontendmasters-subtitle-styler`。
4. 安装 Udemy 插件时，选择 `dist/udemy-subtitle-styler`。
5. 修改代码后重新运行构建，在对应插件卡片点击 Reload，并刷新课程页。

## 说明

- 插件本身不提供翻译能力，也不调用翻译 API。
- 字体是否生效取决于系统或页面能否加载相应字体。
- 原生 `<video>` 本身是不可容纳自定义 DOM 子层的 replaced element。如果浏览器直接让 `<video>` 而非 Udemy 播放器容器成为 Fullscreen top layer，Udemy 插件会停止接管原字幕，避免字幕完全消失；Udemy 常规播放器容器全屏路径支持完整样式。

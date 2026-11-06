# MarkdownIt

类 Typora 的桌面 Markdown IDE（Electron + SQLite）。

## 功能

- 实时模式（WYSIWYG）与源码模式，`Ctrl+/` 切换（无左右分屏）
- Electron 桌面壳 + IDE 布局（侧边栏文档库 / 编辑区 / 大纲）
- SQLite 管理文件夹、文档、图片资源（图片 base64 入库）
- Typora 风格菜单栏与格式工具条（带快捷键提示）
- 粘贴图片、自动保存、主题切换、导出 PDF / Markdown
- 

## 开发

如 Electron 下载缓慢（国内网络常见），先设置镜像：

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
```

```bash
npm install
npm run rebuild:native
npm run electron:dev
```

当前 Node `v22.20.x` 请继续使用自带的 npm 10；不必强行升级到 npm 12（它要求更新的 Node）。

仅调试渲染层（无桌面 API）：

```bash
npm run dev
```

## 构建

```bash
npm run electron:build
```

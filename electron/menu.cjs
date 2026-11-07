const { Menu } = require('electron')

function send(win, command, payload) {
  if (!win || win.isDestroyed()) return
  win.webContents.send('menu:command', command, payload)
}

function buildAppMenu(win) {
  const template = [
    {
      label: '文件',
      submenu: [
        { label: '新建文档', accelerator: 'CmdOrCtrl+N', click: () => send(win, 'new-document') },
        { label: '新建文件夹', click: () => send(win, 'new-folder') },
        { type: 'separator' },
        { label: '打开 Markdown…', accelerator: 'CmdOrCtrl+O', click: () => send(win, 'import-markdown') },
        { label: '保存到文件夹…', click: () => send(win, 'choose-directory') },
        { label: '不保存到文件夹', click: () => send(win, 'clear-directory') },
        { type: 'separator' },
        { label: '导出 Markdown…', accelerator: 'CmdOrCtrl+Shift+E', click: () => send(win, 'export-markdown') },
        { label: '导出 PDF…', accelerator: 'CmdOrCtrl+Shift+P', click: () => send(win, 'export-pdf') },
        { type: 'separator' },
        { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => send(win, 'save') },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
        { type: 'separator' },
        { label: '查找文档…', accelerator: 'CmdOrCtrl+P', click: () => send(win, 'focus-search') },
      ],
    },
    {
      label: '段落',
      submenu: [
        { label: '一级标题', accelerator: 'CmdOrCtrl+1', click: () => send(win, 'format', 'h1') },
        { label: '二级标题', accelerator: 'CmdOrCtrl+2', click: () => send(win, 'format', 'h2') },
        { label: '三级标题', accelerator: 'CmdOrCtrl+3', click: () => send(win, 'format', 'h3') },
        { label: '四级标题', accelerator: 'CmdOrCtrl+4', click: () => send(win, 'format', 'h4') },
        { label: '五级标题', accelerator: 'CmdOrCtrl+5', click: () => send(win, 'format', 'h5') },
        { label: '六级标题', accelerator: 'CmdOrCtrl+6', click: () => send(win, 'format', 'h6') },
        { type: 'separator' },
        { label: '段落', accelerator: 'CmdOrCtrl+0', click: () => send(win, 'format', 'paragraph') },
        { label: '引用', accelerator: 'CmdOrCtrl+Shift+Q', click: () => send(win, 'format', 'quote') },
        { label: '代码块', accelerator: 'CmdOrCtrl+Shift+K', click: () => send(win, 'format', 'codeblock') },
        { type: 'separator' },
        { label: '有序列表', accelerator: 'CmdOrCtrl+Shift+O', click: () => send(win, 'format', 'ordered-list') },
        { label: '无序列表', accelerator: 'CmdOrCtrl+Shift+U', click: () => send(win, 'format', 'bullet-list') },
        { label: '任务列表', accelerator: 'CmdOrCtrl+Shift+T', click: () => send(win, 'format', 'task-list') },
        { type: 'separator' },
        { label: '表格', accelerator: 'CmdOrCtrl+T', click: () => send(win, 'format', 'table') },
        { label: '分隔线', click: () => send(win, 'format', 'hr') },
      ],
    },
    {
      label: '格式',
      submenu: [
        { label: '粗体', accelerator: 'CmdOrCtrl+B', click: () => send(win, 'format', 'bold') },
        { label: '斜体', accelerator: 'CmdOrCtrl+I', click: () => send(win, 'format', 'italic') },
        { label: '删除线', accelerator: 'CmdOrCtrl+Shift+S', click: () => send(win, 'format', 'strike') },
        { label: '行内代码', accelerator: 'CmdOrCtrl+`', click: () => send(win, 'format', 'code') },
        { type: 'separator' },
        { label: '链接', accelerator: 'CmdOrCtrl+K', click: () => send(win, 'format', 'link') },
        { label: '图片', accelerator: 'CmdOrCtrl+Shift+I', click: () => send(win, 'format', 'image') },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '实时模式', accelerator: 'CmdOrCtrl+Alt+1', click: () => send(win, 'mode', 'wysiwyg') },
        { label: '源码模式', accelerator: 'CmdOrCtrl+Alt+2', click: () => send(win, 'mode', 'source') },
        { label: '切换实时/源码', accelerator: 'CmdOrCtrl+/', click: () => send(win, 'toggle-mode') },
        { type: 'separator' },
        { label: '切换侧边栏', accelerator: 'CmdOrCtrl+\\', click: () => send(win, 'toggle-sidebar') },
        { label: '切换大纲', accelerator: 'CmdOrCtrl+Shift+\\', click: () => send(win, 'toggle-outline') },
        { label: '切换主题', accelerator: 'CmdOrCtrl+Shift+L', click: () => send(win, 'toggle-theme') },
        { type: 'separator' },
        { role: 'reload', label: '重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        { label: '快捷键一览', click: () => send(win, 'show-shortcuts') },
        {
          label: '关于 MarkdownIt',
          click: () => send(win, 'about'),
        },
      ],
    },
  ]

  return Menu.buildFromTemplate(template)
}

module.exports = { buildAppMenu }

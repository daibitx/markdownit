const { contextBridge, ipcRenderer, webUtils } = require('electron')

const queuedMenuCommands = []
let menuHandler = null
ipcRenderer.on('menu:command', (_event, command, payload) => {
  if (menuHandler) menuHandler(command, payload)
  else queuedMenuCommands.push([command, payload])
})

contextBridge.exposeInMainWorld('markdownit', {
  listTree: () => ipcRenderer.invoke('db:listTree'),
  getDocument: (id) => ipcRenderer.invoke('db:getDocument', id),
  createFolder: (name, parentId) => ipcRenderer.invoke('db:createFolder', name, parentId),
  renameFolder: (id, name) => ipcRenderer.invoke('db:renameFolder', id, name),
  deleteFolder: (id) => ipcRenderer.invoke('db:deleteFolder', id),
  createDocument: (folderId, title, content) =>
    ipcRenderer.invoke('db:createDocument', folderId, title, content),
  saveDocument: (id, payload) => ipcRenderer.invoke('db:saveDocument', id, payload),
  renameDocument: (id, title) => ipcRenderer.invoke('db:renameDocument', id, title),
  deleteDocument: (id) => ipcRenderer.invoke('db:deleteDocument', id),
  searchDocuments: (query) => ipcRenderer.invoke('db:searchDocuments', query),
  saveAsset: (documentId, mime, dataBase64) =>
    ipcRenderer.invoke('db:saveAsset', documentId, mime, dataBase64),
  getAsset: (id) => ipcRenderer.invoke('db:getAsset', id),
  getSetting: (key, fallback) => ipcRenderer.invoke('db:getSetting', key, fallback),
  setSetting: (key, value) => ipcRenderer.invoke('db:setSetting', key, value),
  exportPdf: (defaultName) => ipcRenderer.invoke('export:pdf', defaultName),
  importMarkdownFile: () => ipcRenderer.invoke('file:importMarkdown'),
  readMarkdownPath: (filePath) => ipcRenderer.invoke('file:readMarkdownPath', filePath),
  chooseDirectory: () => ipcRenderer.invoke('file:chooseDirectory'),
  saveIntoDirectory: (directory, title, content) =>
    ipcRenderer.invoke('file:saveIntoDirectory', directory, title, content),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  exportMarkdownFile: (defaultName, content) =>
    ipcRenderer.invoke('file:exportMarkdown', defaultName, content),
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximizeToggle: () => ipcRenderer.invoke('window:maximizeToggle'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  setWindowBackground: (theme) => ipcRenderer.invoke('window:setBackground', theme),
  onWindowMaximized: (handler) => {
    const listener = (_event, value) => handler(Boolean(value))
    ipcRenderer.on('window:maximized', listener)
    return () => ipcRenderer.removeListener('window:maximized', listener)
  },
  onMenuCommand: (handler) => {
    menuHandler = (command, payload) => handler(command, payload)
    for (const [command, payload] of queuedMenuCommands.splice(0, queuedMenuCommands.length)) {
      handler(command, payload)
    }
    return () => {
      if (menuHandler) menuHandler = null
    }
  },
})

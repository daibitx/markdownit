const path = require('node:path')
const { app, BrowserWindow, ipcMain, dialog, protocol, Menu, shell } = require('electron')
const db = require('./db.cjs')
const { buildAppMenu } = require('./menu.cjs')

const isDev = !app.isPackaged
let mainWindow = null

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true,
    },
  },
])

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 760,
    minHeight: 520,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#ffffff',
    center: true,
    maximizable: true,
    title: 'MarkdownIt',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  Menu.setApplicationMenu(buildAppMenu(mainWindow))

  const emitWindowState = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.send('window:maximized', mainWindow.isMaximized())
  }
  mainWindow.on('maximize', emitWindowState)
  mainWindow.on('unmaximize', emitWindowState)

  mainWindow.once('ready-to-show', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    mainWindow.show()
    emitWindowState()
  })

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
}

function registerIpc() {
  ipcMain.handle('db:listTree', () => db.listTree())
  ipcMain.handle('db:getDocument', (_e, id) => db.getDocument(id))
  ipcMain.handle('db:createFolder', (_e, name, parentId) => db.createFolder(name, parentId))
  ipcMain.handle('db:renameFolder', (_e, id, name) => db.renameFolder(id, name))
  ipcMain.handle('db:deleteFolder', (_e, id) => db.deleteFolder(id))
  ipcMain.handle('db:createDocument', (_e, folderId, title, content) =>
    db.createDocument(folderId, title, content),
  )
  ipcMain.handle('db:saveDocument', (_e, id, payload) => db.saveDocument(id, payload))
  ipcMain.handle('db:renameDocument', (_e, id, title) => db.renameDocument(id, title))
  ipcMain.handle('db:deleteDocument', (_e, id) => db.deleteDocument(id))
  ipcMain.handle('db:searchDocuments', (_e, query) => db.searchDocuments(query))
  ipcMain.handle('db:saveAsset', (_e, documentId, mime, dataBase64) =>
    db.saveAsset(documentId, mime, dataBase64),
  )
  ipcMain.handle('db:getAsset', (_e, id) => db.getAsset(id))
  ipcMain.handle('db:getSetting', (_e, key, fallback) => db.getSetting(key, fallback))
  ipcMain.handle('db:setSetting', (_e, key, value) => db.setSetting(key, value))

  ipcMain.handle('export:pdf', async (_e, defaultName) => {
    if (!mainWindow) return { ok: false }
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '导出 PDF',
      defaultPath: `${defaultName || 'document'}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (canceled || !filePath) return { ok: false }
    const pdf = await mainWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { marginType: 'default' },
    })
    const fs = require('node:fs')
    fs.writeFileSync(filePath, pdf)
    return { ok: true, filePath }
  })

  ipcMain.handle('file:importMarkdown', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: '导入 Markdown',
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    })
    if (canceled || !filePaths?.[0]) return null
    const fs = require('node:fs')
    const filePath = filePaths[0]
    return {
      name: path.basename(filePath, path.extname(filePath)),
      content: fs.readFileSync(filePath, 'utf8'),
    }
  })

  ipcMain.handle('file:exportMarkdown', async (_e, defaultName, content) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '导出 Markdown',
      defaultPath: `${defaultName || 'document'}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    if (canceled || !filePath) return { ok: false }
    const fs = require('node:fs')
    fs.writeFileSync(filePath, content, 'utf8')
    return { ok: true, filePath }
  })

  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize()
  })
  ipcMain.handle('window:maximizeToggle', () => {
    if (!mainWindow) return false
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
    return mainWindow.isMaximized()
  })
  ipcMain.handle('window:close', () => {
    mainWindow?.close()
  })
  ipcMain.handle('window:isMaximized', () => Boolean(mainWindow?.isMaximized()))
}

app.whenReady().then(() => {
  db.initDatabase(app.getPath('userData'))
  registerIpc()

  protocol.handle('asset', async (request) => {
    try {
      const parsed = new URL(request.url)
      const assetId = decodeURIComponent(parsed.hostname || parsed.pathname.replace(/^\/+/, ''))
      const asset = db.getAsset(assetId)
      if (!asset) {
        return new Response('Not Found', { status: 404 })
      }
      const buffer = Buffer.from(asset.dataBase64, 'base64')
      return new Response(buffer, {
        headers: {
          'Content-Type': asset.mime || 'application/octet-stream',
          'Cache-Control': 'no-cache',
        },
      })
    } catch {
      return new Response('Bad Request', { status: 400 })
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    db.closeDatabase()
    app.quit()
  }
})

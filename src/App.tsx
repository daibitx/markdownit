import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { CrepeEditor, type EditorApi } from './components/CrepeEditor'
import { FormatBar } from './components/FormatBar'
import { OutlinePanel } from './components/OutlinePanel'
import { ConfirmModal } from './components/ConfirmModal'
import { FormatInsertModal } from './components/FormatInsertModal'
import { PromptModal } from './components/PromptModal'
import { Sidebar } from './components/Sidebar'
import { SourceEditor, type SourceEditorHandle } from './components/SourceEditor'
import { TableInsertModal } from './components/TableInsertModal'
import { TitleBar } from './components/TitleBar'
import { getApi, isDesktop } from './lib/api'
import {
  buildMarkdownTable,
  extractOutline,
  type FormatAction,
} from './lib/formatMarkdown'
import type { DocumentListItem, DocumentRecord, FolderNode } from './types/markdownit'
import './App.css'

type Mode = 'wysiwyg' | 'source'

type PromptState =
  | { kind: 'folder-create'; parentId: string | null }
  | { kind: 'folder-rename'; id: string; name: string }
  | { kind: 'doc-rename'; id: string; title: string }
  | null

type ConfirmState =
  | { kind: 'doc-delete'; id: string; title: string }
  | { kind: 'folder-delete'; id: string; name: string }
  | null

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function App() {
  const [ready, setReady] = useState(false)
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [documents, setDocuments] = useState<DocumentListItem[]>([])
  const [activeDoc, setActiveDoc] = useState<DocumentRecord | null>(null)
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [mode, setMode] = useState<Mode>('wysiwyg')
  const [docKey, setDocKey] = useState(0)
  const [status, setStatus] = useState('启动中…')
  const [query, setQuery] = useState('')
  const [searchHits, setSearchHits] = useState<DocumentListItem[] | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [fontSize, setFontSize] = useState(18)
  const [maximized, setMaximized] = useState(false)
  const [prompt, setPrompt] = useState<PromptState>(null)
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [tableModalOpen, setTableModalOpen] = useState(false)
  const [formatInsert, setFormatInsert] = useState<'link' | 'image' | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)

  const editorApiRef = useRef<EditorApi | null>(null)
  const sourceRef = useRef<SourceEditorHandle>(null)
  const draftRef = useRef('')
  const activeIdRef = useRef<string | null>(null)
  const saveTimerRef = useRef<number | null>(null)

  draftRef.current = draft
  activeIdRef.current = activeDoc?.id ?? null

  const outline = useMemo(() => extractOutline(draft), [draft])
  const sidebarDocuments = searchHits ?? documents

  useEffect(() => {
    if (!isDesktop()) return
    const q = query.trim()
    if (!q) {
      setSearchHits(null)
      return
    }
    const timer = window.setTimeout(() => {
      void getApi()
        .searchDocuments(q)
        .then((hits) => {
          setSearchHits(
            hits.map((hit) => ({
              id: hit.id,
              folderId: hit.folderId,
              title: hit.title,
              updatedAt: hit.updatedAt,
              createdAt: hit.updatedAt,
              size: hit.snippet.length,
            })),
          )
        })
    }, 200)
    return () => window.clearTimeout(timer)
  }, [query])

  const refreshTree = useCallback(async () => {
    const api = getApi()
    const tree = await api.listTree()
    setFolders(tree.folders)
    setDocuments(tree.documents)
    return tree
  }, [])

  const openDocument = useCallback(async (id: string) => {
    const api = getApi()
    const doc = await api.getDocument(id)
    if (!doc) return
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    setActiveDoc(doc)
    setDraft(doc.content)
    draftRef.current = doc.content
    setDirty(false)
    editorApiRef.current = null
    setDocKey((key) => key + 1)
    await api.setSetting('lastDocumentId', id)
    setStatus('已打开')
  }, [])

  const persist = useCallback(async (reason = '已保存') => {
    if (!activeIdRef.current || !activeDoc) return
    const api = getApi()
    const content = mode === 'wysiwyg' && editorApiRef.current
      ? editorApiRef.current.getMarkdown()
      : draftRef.current
    const saved = await api.saveDocument(activeIdRef.current, {
      content,
      title: activeDoc.title,
    })
    setActiveDoc(saved)
    setDraft(saved.content)
    draftRef.current = saved.content
    setDirty(false)
    await refreshTree()
    setStatus(reason)
  }, [activeDoc, mode, refreshTree])

  const scheduleSave = useCallback((content: string) => {
    setDraft(content)
    draftRef.current = content
    setDirty(true)
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      void persist('自动保存')
    }, 800)
  }, [persist])

  const handlePasteImage = useCallback(async (file: File) => {
    if (!activeIdRef.current) return null
    const api = getApi()
    const dataBase64 = await fileToBase64(file)
    const asset = await api.saveAsset(activeIdRef.current, file.type || 'image/png', dataBase64)
    setStatus('图片已保存')
    return `![图片](${asset.url})`
  }, [])

  const insertTable = useCallback((cols: number, rows: number) => {
    if (mode === 'source') {
      const markdown = buildMarkdownTable(cols, rows).trim()
      sourceRef.current?.insertText(`\n${markdown}\n`)
    } else {
      editorApiRef.current?.insertTable(cols, rows)
    }
    setTableModalOpen(false)
    setStatus('已插入表格')
  }, [mode])

  const applyFormat = useCallback((action: FormatAction) => {
    if (action === 'table') {
      setTableModalOpen(true)
      return
    }
    if (action === 'link' || action === 'image') {
      setFormatInsert(action)
      return
    }
    if (mode === 'source') {
      sourceRef.current?.applyFormat(action)
      return
    }
    editorApiRef.current?.applyFormat(action)
  }, [mode])

  const confirmFormatInsert = useCallback(
    (payload: { href: string; text?: string; alt?: string }) => {
      const kind = formatInsert
      setFormatInsert(null)
      if (!kind) return
      if (mode === 'source') {
        if (kind === 'link') {
          const label = payload.text || '链接文字'
          sourceRef.current?.insertText(`[${label}](${payload.href})`)
        } else {
          const alt = payload.alt || '图片说明'
          sourceRef.current?.insertText(`![${alt}](${payload.href})`)
        }
        setStatus(kind === 'link' ? '已插入链接' : '已插入图片')
        return
      }
      if (kind === 'link') {
        editorApiRef.current?.applyLink(payload.href, payload.text)
      } else {
        editorApiRef.current?.applyImage(payload.href, payload.alt)
      }
      setStatus(kind === 'link' ? '已插入链接' : '已插入图片')
    },
    [formatInsert, mode],
  )

  const createDocument = useCallback(async (folderId: string | null = null) => {
    const api = getApi()
    if (dirty) await persist()
    const doc = await api.createDocument(folderId, '未命名', '# 未命名\n\n')
    await refreshTree()
    await openDocument(doc.id)
    setSidebarOpen(true)
    setStatus('已新建')
  }, [dirty, openDocument, persist, refreshTree])

  const createFolder = useCallback((parentId: string | null = null) => {
    setPrompt({ kind: 'folder-create', parentId })
  }, [])

  const renameActiveTitle = useCallback(async (title: string) => {
    if (!activeDoc) return
    const api = getApi()
    const saved = await api.renameDocument(activeDoc.id, title)
    setActiveDoc(saved)
    await refreshTree()
    setStatus('已重命名')
  }, [activeDoc, refreshTree])

  const toggleTheme = useCallback(async () => {
    const api = getApi()
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.dataset.theme = next
    await api.setSetting('theme', next)
    setStatus(next === 'dark' ? '暗色' : '浅色')
  }, [theme])

  const changeFontSize = useCallback(async (size: number) => {
    const next = Math.min(28, Math.max(14, size))
    setFontSize(next)
    document.documentElement.style.setProperty('--editor-font-size', `${next}px`)
    await getApi().setSetting('fontSize', String(next))
    setStatus(`字号 ${next}`)
  }, [])

  const toggleMode = useCallback(async (next?: Mode) => {
    const target = next ?? (mode === 'wysiwyg' ? 'source' : 'wysiwyg')
    if (target === mode) return

    if (mode === 'wysiwyg' && target === 'source') {
      const markdown = editorApiRef.current?.getMarkdown() ?? draftRef.current
      setDraft(markdown)
      draftRef.current = markdown
      setMode('source')
      setStatus('源码模式')
      return
    }

    editorApiRef.current = null
    setDocKey((key) => key + 1)
    setMode('wysiwyg')
    setStatus('实时模式')
  }, [mode])

  const exportPdf = useCallback(async () => {
    if (dirty) await persist()
    const api = getApi()
    const result = await api.exportPdf(activeDoc?.title || 'document')
    setStatus(result.ok ? 'PDF 已导出' : '已取消导出')
  }, [activeDoc?.title, dirty, persist])

  const importMarkdown = useCallback(async () => {
    const api = getApi()
    const file = await api.importMarkdownFile()
    if (!file) return
    if (dirty) await persist()
    const doc = await api.createDocument(null, file.name, file.content)
    await refreshTree()
    await openDocument(doc.id)
    setStatus('已导入')
  }, [dirty, openDocument, persist, refreshTree])

  const exportMarkdown = useCallback(async () => {
    const content = mode === 'wysiwyg' && editorApiRef.current
      ? editorApiRef.current.getMarkdown()
      : draftRef.current
    const api = getApi()
    const result = await api.exportMarkdownFile(activeDoc?.title || 'document', content)
    setStatus(result.ok ? 'Markdown 已导出' : '已取消导出')
  }, [activeDoc?.title, mode])

  useEffect(() => {
    if (!isDesktop()) {
      setBootError('请使用 npm run electron:dev 启动桌面应用。')
      return
    }

    void (async () => {
      try {
        const api = getApi()
        const tree = await refreshTree()
        const savedTheme = (await api.getSetting('theme', 'light')) as 'light' | 'dark'
        setTheme(savedTheme === 'dark' ? 'dark' : 'light')
        document.documentElement.dataset.theme = savedTheme === 'dark' ? 'dark' : 'light'
        const savedFont = Number(await api.getSetting('fontSize', '18'))
        const nextFont = Number.isFinite(savedFont) ? Math.min(28, Math.max(14, savedFont)) : 18
        setFontSize(nextFont)
        document.documentElement.style.setProperty('--editor-font-size', `${nextFont}px`)
        if (api.windowIsMaximized) {
          const isMax = await api.windowIsMaximized()
          if (isMax) await api.windowMaximizeToggle()
          setMaximized(false)
        }

        const lastId = await api.getSetting('lastDocumentId')
        const initial =
          (lastId && tree.documents.some((d) => d.id === lastId) && lastId) ||
          tree.documents[0]?.id
        if (initial) await openDocument(initial)
        setReady(true)
        setStatus('就绪')
      } catch (error) {
        setBootError(error instanceof Error ? error.message : String(error))
      }
    })()
  }, [openDocument, refreshTree])

  useEffect(() => {
    if (!isDesktop()) return
    return getApi().onWindowMaximized(setMaximized)
  }, [])

  useEffect(() => {
    if (!isDesktop()) return
    const api = getApi()
    return api.onMenuCommand((command, payload) => {
      void (async () => {
        switch (command) {
          case 'new-document':
            await createDocument(null)
            break
          case 'new-folder':
            createFolder(null)
            break
          case 'import-markdown':
            await importMarkdown()
            break
          case 'export-markdown':
            await exportMarkdown()
            break
          case 'export-pdf':
            await exportPdf()
            break
          case 'save':
            await persist('已保存')
            break
          case 'toggle-mode':
            await toggleMode()
            break
          case 'mode':
            await toggleMode(payload as Mode)
            break
          case 'format':
            if (payload) applyFormat(payload as FormatAction)
            break
          case 'toggle-sidebar':
            setSidebarOpen((open) => !open)
            break
          case 'toggle-outline':
            setOutlineOpen((open) => !open)
            break
          case 'toggle-theme':
            await toggleTheme()
            break
          case 'focus-search':
            setSidebarOpen(true)
            requestAnimationFrame(() => {
              document.querySelector<HTMLInputElement>('.sidebar-search')?.focus()
            })
            break
          case 'show-shortcuts':
            setStatus('查看菜单中的快捷键')
            break
          case 'about':
            setStatus('Markdown 桌面写作工具')
            break
          default:
            break
        }
      })()
    })
  }, [
    applyFormat,
    createDocument,
    createFolder,
    exportMarkdown,
    exportPdf,
    importMarkdown,
    persist,
    toggleMode,
    toggleTheme,
  ])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey
      if (!mod) return
      if (event.key === '/') {
        event.preventDefault()
        void toggleMode()
      }
      if (event.key === '\\') {
        event.preventDefault()
        setSidebarOpen((open) => !open)
      }
      if (event.key.toLowerCase() === 'l' && event.shiftKey) {
        event.preventDefault()
        void toggleTheme()
      }
      if (event.key.toLowerCase() === 't' && !event.shiftKey && !event.altKey) {
        event.preventDefault()
        setTableModalOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleMode, toggleTheme])

  const handlePromptConfirm = useCallback(async (value: string) => {
    const api = getApi()
    const current = prompt
    setPrompt(null)
    if (!current) return

    if (current.kind === 'folder-create') {
      const tree = await api.createFolder(value, current.parentId)
      setFolders(tree.folders)
      setDocuments(tree.documents)
      setSidebarOpen(true)
      setStatus('已创建文件夹')
      return
    }

    if (current.kind === 'folder-rename') {
      const tree = await api.renameFolder(current.id, value)
      setFolders(tree.folders)
      setDocuments(tree.documents)
      setStatus('文件夹已重命名')
      return
    }

    if (current.kind === 'doc-rename') {
      const saved = await api.renameDocument(current.id, value)
      await refreshTree()
      if (activeDoc?.id === current.id) setActiveDoc(saved)
      setStatus('文档已重命名')
    }
  }, [activeDoc?.id, prompt, refreshTree])

  if (bootError) {
    return (
      <div className="boot-error">
        <p>{bootError}</p>
        <code>npm run electron:dev</code>
      </div>
    )
  }

  if (!ready || !activeDoc) {
    return <div className="boot-loading">加载中…</div>
  }

  return (
    <div className={`ide-shell theme-${theme} ${sidebarOpen ? 'has-sidebar' : ''} ${outlineOpen ? 'has-outline' : ''}`}>
      <TitleBar
        title={activeDoc.title}
        dirty={dirty}
        theme={theme}
        fontSize={fontSize}
        maximized={maximized}
        sidebarOpen={sidebarOpen}
        outlineOpen={outlineOpen}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        onToggleOutline={() => setOutlineOpen((open) => !open)}
        onToggleTheme={() => void toggleTheme()}
        onFontSizeChange={(size) => void changeFontSize(size)}
        onRenameTitle={(title) => void renameActiveTitle(title)}
        onExportPdf={() => void exportPdf()}
      />

      <FormatBar onFormat={applyFormat} />

      <div className="ide-body">
        <Sidebar
          open={sidebarOpen}
          folders={folders}
          documents={sidebarDocuments}
          activeId={activeDoc.id}
          query={query}
          onQueryChange={setQuery}
          onClose={() => setSidebarOpen(false)}
          onSelectDocument={(id) => {
            void (async () => {
              if (dirty) await persist()
              await openDocument(id)
            })()
          }}
          onNewDocument={(folderId) => void createDocument(folderId ?? null)}
          onNewFolder={(parentId) => createFolder(parentId ?? null)}
          onRenameDocument={(id) => {
            const doc = documents.find((item) => item.id === id)
            if (!doc) return
            setPrompt({ kind: 'doc-rename', id, title: doc.title })
          }}
          onDeleteDocument={(id) => {
            const doc = documents.find((item) => item.id === id)
            if (!doc) return
            setConfirm({ kind: 'doc-delete', id, title: doc.title })
          }}
          onRenameFolder={(id) => {
            const folder = folders.find((item) => item.id === id)
            if (!folder) return
            setPrompt({ kind: 'folder-rename', id, name: folder.name })
          }}
          onDeleteFolder={(id) => {
            const folder = folders.find((item) => item.id === id)
            if (!folder) return
            setConfirm({ kind: 'folder-delete', id, name: folder.name })
          }}
        />

        <main className={`editor-pane ${mode === 'source' ? 'is-source' : ''}`}>
          <div className="paper">
            {mode === 'wysiwyg' ? (
              <CrepeEditor
                key={docKey}
                docKey={String(docKey)}
                defaultValue={draft}
                dark={theme === 'dark'}
                onChange={scheduleSave}
                onPasteImage={handlePasteImage}
                onReady={(api) => {
                  editorApiRef.current = api
                }}
              />
            ) : (
              <SourceEditor
                ref={sourceRef}
                value={draft}
                dark={theme === 'dark'}
                onChange={scheduleSave}
                onPasteImage={handlePasteImage}
              />
            )}
          </div>
        </main>

        {outlineOpen ? (
          <OutlinePanel
            items={outline}
            onJump={(line) => {
              if (mode === 'source') {
                sourceRef.current?.focusLine(line)
                return
              }
              setStatus(`第 ${line + 1} 行`)
            }}
          />
        ) : null}
      </div>

      <footer className="ide-status">
        <div className="status-left">
          <div className="status-mode" role="group" aria-label="编辑模式">
            <button
              type="button"
              className={`status-mode-btn ${mode === 'wysiwyg' ? 'is-active' : ''}`}
              title="启用实时预览"
              aria-label="实时模式"
              onClick={() => void toggleMode('wysiwyg')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="12" cy="12" r="7" />
              </svg>
            </button>
            <button
              type="button"
              className={`status-mode-btn ${mode === 'source' ? 'is-active' : ''}`}
              title="启用源代码模式"
              aria-label="源码模式"
              onClick={() => void toggleMode('source')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="m8 8-4 4 4 4" />
                <path d="m16 8 4 4-4 4" />
                <path d="m14 6-4 12" />
              </svg>
            </button>
          </div>
          <span className="status-text">{status}</span>
        </div>
        <span className="status-right">{mode === 'wysiwyg' ? '实时' : '源码'} · Ctrl+/</span>
      </footer>

      <PromptModal
        open={Boolean(prompt)}
        title={
          prompt?.kind === 'folder-create'
            ? '新建文件夹'
            : prompt?.kind === 'folder-rename'
              ? '重命名文件夹'
              : '重命名文档'
        }
        defaultValue={
          prompt?.kind === 'folder-create'
            ? '新建文件夹'
            : prompt?.kind === 'folder-rename'
              ? prompt.name
              : prompt?.kind === 'doc-rename'
                ? prompt.title
                : ''
        }
        onCancel={() => setPrompt(null)}
        onConfirm={(value) => void handlePromptConfirm(value)}
      />

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.kind === 'folder-delete' ? '删除文件夹' : '删除文档'}
        message={
          confirm?.kind === 'folder-delete'
            ? `确定删除「${confirm.name}」及其包含的文档吗？此操作不可撤销。`
            : confirm
              ? `确定删除「${confirm.title}」吗？此操作不可撤销。`
              : ''
        }
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const current = confirm
          setConfirm(null)
          if (!current) return
          if (current.kind === 'doc-delete') {
            void getApi().deleteDocument(current.id).then(async (tree) => {
              setFolders(tree.folders)
              setDocuments(tree.documents)
              if (activeDoc.id === current.id) {
                const next = tree.documents[0]
                if (next) await openDocument(next.id)
              }
              setStatus('已删除文档')
            })
            return
          }
          void getApi().deleteFolder(current.id).then((tree) => {
            setFolders(tree.folders)
            setDocuments(tree.documents)
            setStatus('已删除文件夹')
          })
        }}
      />

      <TableInsertModal
        open={tableModalOpen}
        onCancel={() => setTableModalOpen(false)}
        onConfirm={insertTable}
      />

      <FormatInsertModal
        open={Boolean(formatInsert)}
        kind={formatInsert}
        onCancel={() => {
          setFormatInsert(null)
          if (mode === 'source') sourceRef.current?.focus()
          else editorApiRef.current?.focus()
        }}
        onConfirm={confirmFormatInsert}
      />
    </div>
  )
}

export default App

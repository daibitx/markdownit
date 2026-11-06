type AppChromeProps = {
  fileName: string
  dirty: boolean
  mode: 'wysiwyg' | 'source'
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
  onNew: () => void
  onToggleMode: () => void
}

export function AppChrome({
  fileName,
  dirty,
  mode,
  onOpen,
  onSave,
  onSaveAs,
  onNew,
  onToggleMode,
}: AppChromeProps) {
  return (
    <header className="app-chrome">
      <div className="chrome-brand">
        <span className="brand-mark" aria-hidden="true" />
        <div className="brand-copy">
          <strong>MarkdownIt</strong>
          <span className="file-meta" title={fileName}>
            {fileName}
            {dirty ? ' · 未保存' : ''}
          </span>
        </div>
      </div>

      <div className="chrome-actions" role="toolbar" aria-label="文件与视图">
        <button type="button" onClick={onNew}>
          新建
        </button>
        <button type="button" onClick={onOpen}>
          打开
        </button>
        <button type="button" onClick={onSave}>
          保存
        </button>
        <button type="button" onClick={onSaveAs}>
          另存为
        </button>
        <button
          type="button"
          className={mode === 'source' ? 'is-active' : undefined}
          onClick={onToggleMode}
        >
          {mode === 'wysiwyg' ? '源码' : '所见即所得'}
        </button>
      </div>
    </header>
  )
}

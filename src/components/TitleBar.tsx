import { useEffect, useRef, useState } from 'react'

import {
  IconClose,
  IconList,
  IconMaximize,
  IconMinimize,
  IconPanelLeft,
  IconRestore,
} from './Icons'

function IconSun() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

function IconMoon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" />
    </svg>
  )
}

type TitleBarProps = {
  title: string
  dirty: boolean
  theme: 'light' | 'dark'
  fontSize: number
  maximized: boolean
  sidebarOpen: boolean
  outlineOpen: boolean
  onToggleSidebar: () => void
  onToggleOutline: () => void
  onToggleTheme: () => void
  onFontSizeChange: (size: number) => void
  onRenameTitle: (title: string) => void
  onOpenFile: () => void
  onExportPdf: () => void
}

export function TitleBar({
  title,
  dirty,
  theme,
  fontSize,
  maximized,
  sidebarOpen,
  outlineOpen,
  onToggleSidebar,
  onToggleOutline,
  onToggleTheme,
  onFontSizeChange,
  onRenameTitle,
  onOpenFile,
  onExportPdf,
}: TitleBarProps) {
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraftTitle(title)
  }, [editing, title])

  useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing])

  const commit = () => {
    const next = draftTitle.trim()
    setEditing(false)
    if (next && next !== title) onRenameTitle(next)
    else setDraftTitle(title)
  }

  return (
    <header className="titlebar">
      <div className="titlebar-drag">
        <div className="titlebar-left">
          <button
            type="button"
            className={`icon-btn ${sidebarOpen ? 'is-active' : ''}`}
            title="文档库"
            aria-label="切换文档库"
            onClick={onToggleSidebar}
          >
            <IconPanelLeft />
          </button>
          <button
            type="button"
            className={`icon-btn ${outlineOpen ? 'is-active' : ''}`}
            title="大纲"
            aria-label="切换大纲"
            onClick={onToggleOutline}
          >
            <IconList />
          </button>

          <div className={`titlebar-title-wrap ${editing ? 'is-editing' : ''}`}>
            {editing ? (
              <input
                ref={inputRef}
                className="titlebar-title-input"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                onBlur={commit}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commit()
                  if (event.key === 'Escape') {
                    setDraftTitle(title)
                    setEditing(false)
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className="titlebar-doc"
                title="拖动窗口 · 双击重命名"
                onDoubleClick={() => setEditing(true)}
              >
                <span className="titlebar-doc-name">{title}</span>
                {dirty ? (
                  <span className="dirty-mark" aria-label="未保存">
                    •
                  </span>
                ) : null}
              </button>
            )}
          </div>
        </div>

        <div className="titlebar-right">
          <div className="font-size-control" role="group" aria-label="字体大小">
            <button
              type="button"
              className="icon-btn"
              title="减小字号"
              aria-label="减小字号"
              onClick={() => onFontSizeChange(Math.max(14, fontSize - 1))}
            >
              A-
            </button>
            <span className="font-size-value">{fontSize}</span>
            <button
              type="button"
              className="icon-btn"
              title="增大字号"
              aria-label="增大字号"
              onClick={() => onFontSizeChange(Math.min(28, fontSize + 1))}
            >
              A+
            </button>
          </div>

          <button
            type="button"
            className="icon-btn"
            title={theme === 'light' ? '切换暗色' : '切换浅色'}
            aria-label="切换主题"
            onClick={onToggleTheme}
          >
            {theme === 'light' ? <IconMoon /> : <IconSun />}
          </button>
          <button type="button" className="text-btn shelf" onClick={onOpenFile}>
            打开
          </button>
          <button type="button" className="text-btn" onClick={onExportPdf}>
            PDF
          </button>

          <div className="window-controls">
            <button
              type="button"
              className="win-btn"
              title="最小化"
              aria-label="最小化"
              onClick={() => void window.markdownit?.windowMinimize()}
            >
              <IconMinimize size={14} />
            </button>
            <button
              type="button"
              className="win-btn"
              title={maximized ? '还原' : '最大化'}
              aria-label={maximized ? '还原' : '最大化'}
              onClick={() => void window.markdownit?.windowMaximizeToggle()}
            >
              {maximized ? <IconRestore size={14} /> : <IconMaximize size={14} />}
            </button>
            <button
              type="button"
              className="win-btn win-close"
              title="关闭"
              aria-label="关闭"
              onClick={() => void window.markdownit?.windowClose()}
            >
              <IconClose size={14} />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

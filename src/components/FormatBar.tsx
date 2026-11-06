import { useState } from 'react'

import type { FormatAction } from '../lib/formatMarkdown'

type Item = {
  label: string
  action: FormatAction
  shortcut: string
  glyph: string
}

const ITEMS: Item[] = [
  { label: '一级标题', action: 'h1', shortcut: 'Ctrl+1', glyph: 'H1' },
  { label: '二级标题', action: 'h2', shortcut: 'Ctrl+2', glyph: 'H2' },
  { label: '三级标题', action: 'h3', shortcut: 'Ctrl+3', glyph: 'H3' },
  { label: '粗体', action: 'bold', shortcut: 'Ctrl+B', glyph: 'B' },
  { label: '斜体', action: 'italic', shortcut: 'Ctrl+I', glyph: 'I' },
  { label: '删除线', action: 'strike', shortcut: 'Ctrl+Shift+S', glyph: 'S' },
  { label: '行内代码', action: 'code', shortcut: 'Ctrl+`', glyph: '</>' },
  { label: '链接', action: 'link', shortcut: 'Ctrl+K', glyph: '🔗' },
  { label: '图片', action: 'image', shortcut: 'Ctrl+Shift+I', glyph: '🖼' },
  { label: '引用', action: 'quote', shortcut: 'Ctrl+Shift+Q', glyph: '❝' },
  { label: '列表', action: 'bullet-list', shortcut: 'Ctrl+Shift+U', glyph: '•' },
  { label: '任务', action: 'task-list', shortcut: 'Ctrl+Shift+T', glyph: '☑' },
  { label: '代码块', action: 'codeblock', shortcut: 'Ctrl+Shift+K', glyph: '{ }' },
  { label: '表格', action: 'table', shortcut: 'Ctrl+T', glyph: '▦' },
]

type FormatBarProps = {
  onFormat: (action: FormatAction) => void
}

export function FormatBar({ onFormat }: FormatBarProps) {
  const [tip, setTip] = useState<{ label: string; shortcut: string; x: number; y: number } | null>(
    null,
  )

  return (
    <div className="format-bar" role="toolbar" aria-label="Markdown 格式">
      {ITEMS.map((item) => (
        <button
          key={item.action}
          type="button"
          className="format-btn"
          aria-label={`${item.label}${item.shortcut ? ` ${item.shortcut}` : ''}`}
          onClick={() => onFormat(item.action)}
          onMouseEnter={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            setTip({
              label: item.label,
              shortcut: item.shortcut,
              x: rect.left + rect.width / 2,
              y: rect.bottom + 8,
            })
          }}
          onMouseLeave={() => setTip(null)}
        >
          {item.glyph}
        </button>
      ))}

      {tip ? (
        <div
          className="format-tooltip"
          style={{ left: tip.x, top: tip.y }}
          role="tooltip"
        >
          <span>{tip.label}</span>
          {tip.shortcut ? <kbd>{tip.shortcut}</kbd> : null}
        </div>
      ) : null}
    </div>
  )
}

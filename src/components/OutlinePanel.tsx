import type { OutlineItem } from '../lib/formatMarkdown'

type OutlinePanelProps = {
  items: OutlineItem[]
  onJump: (line: number) => void
}

export function OutlinePanel({ items, onJump }: OutlinePanelProps) {
  return (
    <aside className="outline-panel">
      <div className="outline-header">大纲</div>
      <div className="outline-list">
        {items.length === 0 ? (
          <p className="outline-empty">暂无标题</p>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`outline-item level-${item.level}`}
              onClick={() => onJump(item.line)}
            >
              {item.text}
            </button>
          ))
        )}
      </div>
    </aside>
  )
}

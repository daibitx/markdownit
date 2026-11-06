import { useEffect, useRef, useState } from 'react'

type FormatInsertModalProps = {
  open: boolean
  kind: 'link' | 'image' | null
  onConfirm: (payload: { href: string; text?: string; alt?: string }) => void
  onCancel: () => void
}

export function FormatInsertModal({ open, kind, onConfirm, onCancel }: FormatInsertModalProps) {
  const [href, setHref] = useState(kind === 'image' ? 'asset://' : 'https://')
  const [extra, setExtra] = useState(kind === 'image' ? '图片说明' : '链接文字')
  const hrefRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || !kind) return
    setHref(kind === 'image' ? 'asset://' : 'https://')
    setExtra(kind === 'image' ? '图片说明' : '链接文字')
    const timer = window.setTimeout(() => {
      hrefRef.current?.focus()
      hrefRef.current?.select()
    }, 30)
    return () => window.clearTimeout(timer)
  }, [kind, open])

  if (!open || !kind) return null

  const title = kind === 'link' ? '插入链接' : '插入图片'
  const extraLabel = kind === 'link' ? '显示文字' : '替代文字'
  const hrefLabel = kind === 'link' ? '链接地址' : '图片地址'

  const submit = () => {
    const nextHref = href.trim()
    if (!nextHref) return
    if (kind === 'link') {
      onConfirm({ href: nextHref, text: extra.trim() || '链接文字' })
      return
    }
    onConfirm({ href: nextHref, alt: extra.trim() || '图片说明' })
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h3>{title}</h3>
        <p className="modal-label">{hrefLabel}</p>
        <input
          ref={hrefRef}
          value={href}
          onChange={(event) => setHref(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
            if (event.key === 'Escape') onCancel()
          }}
        />
        <p className="modal-label">{extraLabel}</p>
        <input
          value={extra}
          onChange={(event) => setExtra(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
            if (event.key === 'Escape') onCancel()
          }}
        />
        <div className="modal-actions">
          <button type="button" className="text-btn" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="text-btn primary" onClick={submit}>
            插入
          </button>
        </div>
      </div>
    </div>
  )
}

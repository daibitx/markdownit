import { useEffect, useRef, useState } from 'react'

type PromptModalProps = {
  open: boolean
  title: string
  label?: string
  defaultValue?: string
  confirmText?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

export function PromptModal({
  open,
  title,
  label,
  defaultValue = '',
  confirmText = '确定',
  onConfirm,
  onCancel,
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setValue(defaultValue)
    const timer = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 30)
    return () => window.clearTimeout(timer)
  }, [defaultValue, open])

  if (!open) return null

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
        {label ? <p className="modal-label">{label}</p> : null}
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              const next = value.trim()
              if (next) onConfirm(next)
            }
            if (event.key === 'Escape') onCancel()
          }}
        />
        <div className="modal-actions">
          <button type="button" className="text-btn" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="text-btn primary"
            onClick={() => {
              const next = value.trim()
              if (next) onConfirm(next)
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

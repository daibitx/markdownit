import { useEffect, useRef, useState } from 'react'

type TableInsertModalProps = {
  open: boolean
  onConfirm: (cols: number, rows: number) => void
  onCancel: () => void
}

export function TableInsertModal({ open, onConfirm, onCancel }: TableInsertModalProps) {
  const [cols, setCols] = useState('3')
  const [rows, setRows] = useState('3')
  const colsRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setCols('3')
    setRows('3')
    const timer = window.setTimeout(() => {
      colsRef.current?.focus()
      colsRef.current?.select()
    }, 30)
    return () => window.clearTimeout(timer)
  }, [open])

  if (!open) return null

  const submit = () => {
    const nextCols = Number(cols)
    const nextRows = Number(rows)
    if (!Number.isFinite(nextCols) || !Number.isFinite(nextRows)) return
    if (nextCols < 1 || nextRows < 1) return
    onConfirm(nextCols, nextRows)
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal-card table-modal"
        role="dialog"
        aria-modal="true"
        aria-label="插入表格"
        onClick={(event) => event.stopPropagation()}
      >
        <h3>插入表格</h3>
        <div className="table-modal-fields">
          <label>
            <span>列</span>
            <input
              ref={colsRef}
              type="number"
              min={1}
              max={20}
              value={cols}
              onChange={(event) => setCols(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit()
                if (event.key === 'Escape') onCancel()
              }}
            />
          </label>
          <label>
            <span>行</span>
            <input
              type="number"
              min={1}
              max={50}
              value={rows}
              onChange={(event) => setRows(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit()
                if (event.key === 'Escape') onCancel()
              }}
            />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="text-btn" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="text-btn primary" onClick={submit}>
            确定
          </button>
        </div>
      </div>
    </div>
  )
}

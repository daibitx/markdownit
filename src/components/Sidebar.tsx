import { useEffect, useMemo, useState } from 'react'

import type { DocumentListItem, FolderNode } from '../types/markdownit'
import {
  IconChevronLeft,
  IconFilePlus,
  IconFolder,
  IconFolderPlus,
  IconPencil,
  IconSearch,
  IconTrash,
} from './Icons'

type SidebarProps = {
  open: boolean
  folders: FolderNode[]
  documents: DocumentListItem[]
  activeId: string | null
  query: string
  onQueryChange: (value: string) => void
  onClose: () => void
  onSelectDocument: (id: string) => void
  onNewDocument: (folderId?: string | null) => void
  onNewFolder: (parentId?: string | null) => void
  onRenameDocument: (id: string) => void
  onDeleteDocument: (id: string) => void
  onRenameFolder: (id: string) => void
  onDeleteFolder: (id: string) => void
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg className="tree-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      {open ? <path d="m6 9 6 6 6-6" /> : <path d="m9 6 6 6-6 6" />}
    </svg>
  )
}

export function Sidebar({
  open,
  folders,
  documents,
  activeId,
  query,
  onQueryChange,
  onClose,
  onSelectDocument,
  onNewDocument,
  onNewFolder,
  onRenameDocument,
  onDeleteDocument,
  onRenameFolder,
  onDeleteFolder,
}: SidebarProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const rootFolders = useMemo(
    () => folders.filter((folder) => !folder.parentId),
    [folders],
  )

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev }
      for (const folder of folders) {
        if (next[folder.id] === undefined) next[folder.id] = true
      }
      return next
    })
  }, [folders])

  const q = query.trim().toLowerCase()
  const visibleDocs = q
    ? documents.filter((doc) => doc.title.toLowerCase().includes(q))
    : documents
  const rootDocs = visibleDocs.filter((doc) => !doc.folderId)

  const childFolders = (parentId: string) =>
    folders.filter((folder) => folder.parentId === parentId)

  const renderFolder = (folder: FolderNode, depth: number) => {
    const isOpen = expanded[folder.id] !== false
    const children = visibleDocs.filter((doc) => doc.folderId === folder.id)
    const nested = childFolders(folder.id)

    return (
      <div key={folder.id} className="tree-node">
        <div className="tree-row" style={{ paddingLeft: `${depth * 16}px` }}>
          <button
            type="button"
            className="tree-main"
            title="展开/收起"
            onClick={() =>
              setExpanded((prev) => ({ ...prev, [folder.id]: !(prev[folder.id] !== false) }))
            }
          >
            <IconChevron open={isOpen} />
            <IconFolder size={14} />
            <span className="tree-label">{folder.name}</span>
          </button>
          <div className="tree-actions">
            <button
              type="button"
              className="icon-btn ghost"
              title="在此新建文档"
              aria-label="在此新建文档"
              onClick={() => onNewDocument(folder.id)}
            >
              <IconFilePlus size={14} />
            </button>
            <button
              type="button"
              className="icon-btn ghost"
              title="重命名"
              aria-label="重命名文件夹"
              onClick={() => onRenameFolder(folder.id)}
            >
              <IconPencil size={14} />
            </button>
            <button
              type="button"
              className="icon-btn ghost danger"
              title="删除"
              aria-label="删除文件夹"
              onClick={() => onDeleteFolder(folder.id)}
            >
              <IconTrash size={14} />
            </button>
          </div>
        </div>

        {isOpen ? (
          <>
            {nested.map((child) => renderFolder(child, depth + 1))}
            {children.map((doc) => (
              <DocRow
                key={doc.id}
                doc={doc}
                depth={depth + 1}
                active={doc.id === activeId}
                onSelect={onSelectDocument}
                onRename={onRenameDocument}
                onDelete={onDeleteDocument}
              />
            ))}
          </>
        ) : null}
      </div>
    )
  }

  return (
    <aside className={`sidebar-dock ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="sidebar-header">
        <div className="sidebar-heading">
          <button
            type="button"
            className="icon-btn"
            title="收起"
            aria-label="收起文档库"
            onClick={onClose}
          >
            <IconChevronLeft />
          </button>
          <strong>文档</strong>
        </div>
        <div className="sidebar-actions">
          <button
            type="button"
            className="icon-btn"
            title="新建文档"
            aria-label="新建文档"
            onClick={() => onNewDocument(null)}
          >
            <IconFilePlus />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="新建文件夹"
            aria-label="新建文件夹"
            onClick={() => onNewFolder(null)}
          >
            <IconFolderPlus />
          </button>
        </div>
      </div>

      <label className="sidebar-search-wrap">
        <IconSearch size={14} />
        <input
          className="sidebar-search"
          placeholder="搜索…"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>

      <div className="sidebar-tree">
        {rootFolders.map((folder) => renderFolder(folder, 0))}

        {rootDocs.length > 0 ? (
          <div className="tree-node">
            <div className="tree-row section-label">
              <span className="tree-main muted">
                <span className="tree-chevron-spacer" />
                <span className="tree-label">未分类</span>
              </span>
            </div>
            {rootDocs.map((doc) => (
              <DocRow
                key={doc.id}
                doc={doc}
                depth={0}
                active={doc.id === activeId}
                onSelect={onSelectDocument}
                onRename={onRenameDocument}
                onDelete={onDeleteDocument}
              />
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  )
}

function DocRow({
  doc,
  depth,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  doc: DocumentListItem
  depth: number
  active: boolean
  onSelect: (id: string) => void
  onRename: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className={`tree-row ${active ? 'is-active' : ''}`} style={{ paddingLeft: `${depth * 16}px` }}>
      <button type="button" className="tree-main" onClick={() => onSelect(doc.id)}>
        <span className="tree-chevron-spacer" />
        <span className="tree-file-dot" aria-hidden="true" />
        <span className="tree-label">{doc.title}</span>
      </button>
      <div className="tree-actions">
        <button
          type="button"
          className="icon-btn ghost"
          title="重命名"
          aria-label="重命名文档"
          onClick={() => onRename(doc.id)}
        >
          <IconPencil size={14} />
        </button>
        <button
          type="button"
          className="icon-btn ghost danger"
          title="删除"
          aria-label="删除文档"
          onClick={() => onDelete(doc.id)}
        >
          <IconTrash size={14} />
        </button>
      </div>
    </div>
  )
}

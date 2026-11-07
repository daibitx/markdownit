export type FolderNode = {
  id: string
  name: string
  parentId: string | null
  createdAt: string
  updatedAt: string
}

export type DocumentListItem = {
  id: string
  folderId: string | null
  title: string
  updatedAt: string
  createdAt: string
  size: number
  filePath?: string | null
}

export type DocumentRecord = {
  id: string
  folderId: string | null
  title: string
  content: string
  filePath?: string | null
  missing?: boolean
  createdAt: string
  updatedAt: string
}

export type SearchHit = {
  id: string
  folderId: string | null
  title: string
  updatedAt: string
  snippet: string
  filePath?: string | null
}

export type AssetRecord = {
  id: string
  documentId: string
  mime: string
  dataBase64: string
  createdAt: string
}

export type MarkdownItApi = {
  listTree: () => Promise<{ folders: FolderNode[]; documents: DocumentListItem[] }>
  getDocument: (id: string) => Promise<DocumentRecord | undefined>
  createFolder: (name: string, parentId?: string | null) => Promise<{ folders: FolderNode[]; documents: DocumentListItem[] }>
  renameFolder: (id: string, name: string) => Promise<{ folders: FolderNode[]; documents: DocumentListItem[] }>
  deleteFolder: (id: string) => Promise<{ folders: FolderNode[]; documents: DocumentListItem[] }>
  createDocument: (
    folderId?: string | null,
    title?: string,
    content?: string,
  ) => Promise<DocumentRecord>
  openExternalDocument: (filePath: string) => Promise<DocumentRecord>
  saveDocument: (
    id: string,
    payload: { title?: string; content?: string; folderId?: string | null },
  ) => Promise<DocumentRecord>
  renameDocument: (id: string, title: string) => Promise<DocumentRecord>
  deleteDocument: (id: string) => Promise<{ folders: FolderNode[]; documents: DocumentListItem[] }>
  searchDocuments: (query: string) => Promise<SearchHit[]>
  saveAsset: (
    documentId: string,
    mime: string,
    dataBase64: string,
  ) => Promise<{ id: string; mime: string; url: string }>
  getAsset: (id: string) => Promise<AssetRecord | undefined>
  getSetting: (key: string, fallback?: string | null) => Promise<string | null>
  setSetting: (key: string, value: string) => Promise<boolean>
  exportPdf: (defaultName?: string) => Promise<{ ok: boolean; filePath?: string }>
  importMarkdownFile: () => Promise<{ name: string; content: string; filePath?: string } | null>
  readMarkdownPath: (
    filePath: string,
  ) => Promise<{ name: string; content: string; filePath: string } | null>
  chooseDirectory: () => Promise<string | null>
  saveIntoDirectory: (
    directory: string,
    title: string,
    content: string,
  ) => Promise<{ ok: boolean; filePath?: string }>
  getPathForFile: (file: File) => string
  exportMarkdownFile: (
    defaultName: string,
    content: string,
  ) => Promise<{ ok: boolean; filePath?: string }>
  windowMinimize: () => Promise<void>
  windowMaximizeToggle: () => Promise<boolean>
  windowClose: () => Promise<void>
  windowIsMaximized: () => Promise<boolean>
  setWindowBackground: (theme: 'light' | 'dark') => Promise<void>
  onWindowMaximized: (handler: (maximized: boolean) => void) => () => void
  onMenuCommand: (
    handler: (command: string, payload?: string) => void,
  ) => () => void
}

declare global {
  interface Window {
    markdownit?: MarkdownItApi
  }
}

export {}

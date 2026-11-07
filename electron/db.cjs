const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const Database = require('better-sqlite3')

/** @type {import('better-sqlite3').Database | null} */
let db = null

function now() {
  return new Date().toISOString()
}

function id() {
  return crypto.randomUUID()
}

function ensureColumn(table, column, definition) {
  const columns = requireDb().prepare(`PRAGMA table_info(${table})`).all()
  if (columns.some((item) => item.name === column)) return
  requireDb().exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

function initDatabase(installRoot) {
  const dir = path.join(installRoot, 'data')
  fs.mkdirSync(dir, { recursive: true })
  const dbPath = path.join(dir, 'markdownit.sqlite')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      mime TEXT NOT NULL,
      data_base64 TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder_id);
    CREATE INDEX IF NOT EXISTS idx_assets_document ON assets(document_id);
    CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title);
    CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at DESC);
  `)

  ensureColumn('documents', 'file_path', 'TEXT')
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_file_path
    ON documents(file_path) WHERE file_path IS NOT NULL`)
  // Existing installs already have the documents table; ensure new indexes are created too.
  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at DESC)`)

  const count = db.prepare('SELECT COUNT(*) AS c FROM documents').get().c
  if (count === 0) {
    seed()
  } else {
    migrateWelcomeCopy()
  }

  return dbPath
}

const STARTER_CONTENT = `# 草稿

`

function seed() {
  const ts = now()
  const folderId = id()
  const docId = id()
  db.prepare(
    `INSERT INTO folders (id, name, parent_id, created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?)`,
  ).run(folderId, '笔记', ts, ts)

  db.prepare(
    `INSERT INTO documents (id, folder_id, title, content, file_path, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?)`,
  ).run(docId, folderId, '草稿', STARTER_CONTENT, ts, ts)

  const upsertSetting = db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  )
  upsertSetting.run('theme', 'light')
  upsertSetting.run('lastDocumentId', docId)
}

function migrateWelcomeCopy() {
  const rows = db
    .prepare(
      `SELECT id, title, content FROM documents
       WHERE file_path IS NULL AND (title LIKE ? OR content LIKE ? OR title = ? OR content LIKE ?)`,
    )
    .all('%欢迎使用 MarkdownIt%', '%欢迎使用 MarkdownIt%', '草稿', '%在这里开始写%')
  const update = db.prepare(
    `UPDATE documents SET title = ?, content = ?, updated_at = ? WHERE id = ?`,
  )
  for (const row of rows) {
    if (
      row.title.includes('欢迎使用 MarkdownIt') ||
      row.content.includes('欢迎使用 MarkdownIt') ||
      row.content.includes('在这里开始写')
    ) {
      update.run('草稿', STARTER_CONTENT, now(), row.id)
    }
  }

  db.prepare(`UPDATE folders SET name = ?, updated_at = ? WHERE name = ?`).run(
    '笔记',
    now(),
    '我的笔记',
  )
}

function requireDb() {
  if (!db) throw new Error('Database not initialized')
  return db
}

function mapDocumentRow(row) {
  if (!row) return undefined
  const filePath = row.filePath || null
  let content = row.content ?? ''
  let missing = false

  if (filePath) {
    try {
      content = fs.readFileSync(filePath, 'utf8')
    } catch {
      content = ''
      missing = true
    }
  }

  return {
    id: row.id,
    folderId: row.folderId,
    title: row.title,
    content,
    filePath,
    missing,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function documentSelect(whereSql = '') {
  return `SELECT id, folder_id AS folderId, title, content, file_path AS filePath,
                 created_at AS createdAt, updated_at AS updatedAt
          FROM documents ${whereSql}`
}

function externalSize(filePath) {
  try {
    return fs.statSync(filePath).size
  } catch {
    return 0
  }
}

function listTree() {
  const database = requireDb()
  const folders = database
    .prepare(
      `SELECT id, name, parent_id AS parentId, created_at AS createdAt, updated_at AS updatedAt
       FROM folders ORDER BY name COLLATE NOCASE`,
    )
    .all()
  const documents = database
    .prepare(
      `SELECT id, folder_id AS folderId, title, updated_at AS updatedAt, created_at AS createdAt,
              file_path AS filePath, content
       FROM documents ORDER BY updated_at DESC`,
    )
    .all()
    .map((row) => ({
      id: row.id,
      folderId: row.folderId,
      title: row.title,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
      filePath: row.filePath || null,
      size: row.filePath ? externalSize(row.filePath) : String(row.content || '').length,
    }))
  return { folders, documents }
}

function getDocument(docId) {
  const row = requireDb().prepare(documentSelect('WHERE id = ?')).get(docId)
  return mapDocumentRow(row)
}

function findDocumentByPath(filePath) {
  const resolved = path.resolve(filePath)
  const row = requireDb().prepare(documentSelect('WHERE file_path = ?')).get(resolved)
  return mapDocumentRow(row)
}

function createFolder(name, parentId = null) {
  const ts = now()
  const folderId = id()
  requireDb()
    .prepare(
      `INSERT INTO folders (id, name, parent_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(folderId, name || '新建文件夹', parentId, ts, ts)
  return listTree()
}

function renameFolder(folderId, name) {
  requireDb()
    .prepare(`UPDATE folders SET name = ?, updated_at = ? WHERE id = ?`)
    .run(name, now(), folderId)
  return listTree()
}

function deleteFolder(folderId) {
  requireDb().prepare(`DELETE FROM folders WHERE id = ?`).run(folderId)
  return listTree()
}

function createDocument(folderId = null, title = '未命名', content = '# 未命名\n\n') {
  const ts = now()
  const docId = id()
  requireDb()
    .prepare(
      `INSERT INTO documents (id, folder_id, title, content, file_path, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, ?, ?)`,
    )
    .run(docId, folderId, title, content, ts, ts)
  setSetting('lastDocumentId', docId)
  return getDocument(docId)
}

function openExternalDocument(filePath) {
  const resolved = path.resolve(filePath)
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error('文件不存在')
  }

  const existing = findDocumentByPath(resolved)
  if (existing) {
    setSetting('lastDocumentId', existing.id)
    requireDb()
      .prepare(`UPDATE documents SET title = ?, updated_at = ? WHERE id = ?`)
      .run(path.basename(resolved, path.extname(resolved)), now(), existing.id)
    return getDocument(existing.id)
  }

  const ts = now()
  const docId = id()
  const title = path.basename(resolved, path.extname(resolved))
  requireDb()
    .prepare(
      `INSERT INTO documents (id, folder_id, title, content, file_path, created_at, updated_at)
       VALUES (?, NULL, ?, '', ?, ?, ?)`,
    )
    .run(docId, title, resolved, ts, ts)
  setSetting('lastDocumentId', docId)
  return getDocument(docId)
}

function saveDocument(docId, { title, content, folderId }) {
  const current = getDocument(docId)
  if (!current) throw new Error('Document not found')
  const nextTitle = title ?? current.title
  const nextContent = content ?? current.content
  const nextFolder = folderId === undefined ? current.folderId : folderId
  const ts = now()

  if (current.filePath) {
    fs.writeFileSync(current.filePath, nextContent ?? '', 'utf8')
    requireDb()
      .prepare(
        `UPDATE documents
         SET title = ?, content = '', folder_id = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(nextTitle, nextFolder, ts, docId)
    return getDocument(docId)
  }

  requireDb()
    .prepare(
      `UPDATE documents
       SET title = ?, content = ?, folder_id = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(nextTitle, nextContent, nextFolder, ts, docId)
  return getDocument(docId)
}

function renameDocument(docId, title) {
  const current = getDocument(docId)
  if (!current) throw new Error('Document not found')
  const nextTitle = String(title || '').trim() || current.title

  if (current.filePath) {
    const dir = path.dirname(current.filePath)
    const ext = path.extname(current.filePath) || '.md'
    const base = nextTitle.replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ').trim() || '未命名'
    const nextPath = path.join(dir, /\.(md|markdown|txt)$/i.test(base) ? base : `${base}${ext}`)
    if (path.resolve(nextPath) !== path.resolve(current.filePath)) {
      if (fs.existsSync(nextPath)) throw new Error('同名文件已存在')
      fs.renameSync(current.filePath, nextPath)
    }
    requireDb()
      .prepare(
        `UPDATE documents SET title = ?, file_path = ?, content = '', updated_at = ? WHERE id = ?`,
      )
      .run(path.basename(nextPath, path.extname(nextPath)), nextPath, now(), docId)
    return getDocument(docId)
  }

  requireDb()
    .prepare(`UPDATE documents SET title = ?, updated_at = ? WHERE id = ?`)
    .run(nextTitle, now(), docId)
  return getDocument(docId)
}

function deleteDocument(docId) {
  // External docs only remove the library link; the file on disk stays.
  requireDb().prepare(`DELETE FROM documents WHERE id = ?`).run(docId)
  return listTree()
}

function searchDocuments(query) {
  const q = `%${query.trim()}%`
  return requireDb()
    .prepare(
      `SELECT id, folder_id AS folderId, title, updated_at AS updatedAt, file_path AS filePath,
              CASE
                WHEN file_path IS NOT NULL THEN file_path
                ELSE substr(content, 1, 160)
              END AS snippet
       FROM documents
       WHERE title LIKE ? OR (file_path IS NULL AND content LIKE ?) OR (file_path IS NOT NULL AND file_path LIKE ?)
       ORDER BY updated_at DESC
       LIMIT 50`,
    )
    .all(q, q, q)
}

function saveAsset(documentId, mime, dataBase64) {
  const assetId = id()
  requireDb()
    .prepare(
      `INSERT INTO assets (id, document_id, mime, data_base64, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(assetId, documentId, mime, dataBase64, now())
  return { id: assetId, mime, url: `asset://${assetId}` }
}

function getAsset(assetId) {
  return requireDb()
    .prepare(
      `SELECT id, document_id AS documentId, mime, data_base64 AS dataBase64, created_at AS createdAt
       FROM assets WHERE id = ?`,
    )
    .get(assetId)
}

function getSetting(key, fallback = null) {
  const row = requireDb().prepare(`SELECT value FROM settings WHERE key = ?`).get(key)
  return row ? row.value : fallback
}

function setSetting(key, value) {
  requireDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, String(value))
  return true
}

function closeDatabase() {
  if (db) {
    db.close()
    db = null
  }
}

module.exports = {
  initDatabase,
  closeDatabase,
  listTree,
  getDocument,
  findDocumentByPath,
  createFolder,
  renameFolder,
  deleteFolder,
  createDocument,
  openExternalDocument,
  saveDocument,
  renameDocument,
  deleteDocument,
  searchDocuments,
  saveAsset,
  getAsset,
  getSetting,
  setSetting,
}

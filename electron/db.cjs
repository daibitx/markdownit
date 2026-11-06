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

function initDatabase(userDataPath) {
  const dir = path.join(userDataPath, 'data')
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
  `)

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
    `INSERT INTO documents (id, folder_id, title, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
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
       WHERE title LIKE ? OR content LIKE ? OR title = ? OR content LIKE ?`,
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
              length(content) AS size
       FROM documents ORDER BY updated_at DESC`,
    )
    .all()
  return { folders, documents }
}

function getDocument(docId) {
  return requireDb()
    .prepare(
      `SELECT id, folder_id AS folderId, title, content, created_at AS createdAt, updated_at AS updatedAt
       FROM documents WHERE id = ?`,
    )
    .get(docId)
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
      `INSERT INTO documents (id, folder_id, title, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(docId, folderId, title, content, ts, ts)
  setSetting('lastDocumentId', docId)
  return getDocument(docId)
}

function saveDocument(docId, { title, content, folderId }) {
  const current = getDocument(docId)
  if (!current) throw new Error('Document not found')
  const nextTitle = title ?? current.title
  const nextContent = content ?? current.content
  const nextFolder = folderId === undefined ? current.folderId : folderId
  requireDb()
    .prepare(
      `UPDATE documents
       SET title = ?, content = ?, folder_id = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(nextTitle, nextContent, nextFolder, now(), docId)
  return getDocument(docId)
}

function renameDocument(docId, title) {
  requireDb()
    .prepare(`UPDATE documents SET title = ?, updated_at = ? WHERE id = ?`)
    .run(title, now(), docId)
  return getDocument(docId)
}

function deleteDocument(docId) {
  requireDb().prepare(`DELETE FROM documents WHERE id = ?`).run(docId)
  return listTree()
}

function searchDocuments(query) {
  const q = `%${query.trim()}%`
  return requireDb()
    .prepare(
      `SELECT id, folder_id AS folderId, title, updated_at AS updatedAt,
              substr(content, 1, 160) AS snippet
       FROM documents
       WHERE title LIKE ? OR content LIKE ?
       ORDER BY updated_at DESC
       LIMIT 50`,
    )
    .all(q, q)
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
  createFolder,
  renameFolder,
  deleteFolder,
  createDocument,
  saveDocument,
  renameDocument,
  deleteDocument,
  searchDocuments,
  saveAsset,
  getAsset,
  getSetting,
  setSetting,
}

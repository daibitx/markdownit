export type FormatAction =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'link'
  | 'image'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'paragraph'
  | 'quote'
  | 'codeblock'
  | 'ordered-list'
  | 'bullet-list'
  | 'task-list'
  | 'table'
  | 'hr'

function wrapSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder = '文本',
) {
  const selected = value.slice(start, end) || placeholder
  const next = value.slice(0, start) + before + selected + after + value.slice(end)
  const cursorStart = start + before.length
  const cursorEnd = cursorStart + selected.length
  return { next, cursorStart, cursorEnd }
}

function prefixLines(
  value: string,
  start: number,
  end: number,
  prefix: string,
) {
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const lineEndIdx = value.indexOf('\n', end)
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx
  const block = value.slice(lineStart, lineEnd)
  const nextBlock = block
    .split('\n')
    .map((line) => (line.startsWith(prefix) ? line : `${prefix}${line || ''}`))
    .join('\n')
  const next = value.slice(0, lineStart) + nextBlock + value.slice(lineEnd)
  return {
    next,
    cursorStart: lineStart,
    cursorEnd: lineStart + nextBlock.length,
  }
}

function setHeading(value: string, start: number, end: number, level: number) {
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const lineEndIdx = value.indexOf('\n', end)
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx
  const line = value.slice(lineStart, lineEnd).replace(/^#{1,6}\s+/, '')
  const nextLine = level === 0 ? line : `${'#'.repeat(level)} ${line || '标题'}`
  const next = value.slice(0, lineStart) + nextLine + value.slice(lineEnd)
  return {
    next,
    cursorStart: lineStart,
    cursorEnd: lineStart + nextLine.length,
  }
}

export function applySourceFormat(
  value: string,
  start: number,
  end: number,
  action: FormatAction,
): { next: string; cursorStart: number; cursorEnd: number } {
  switch (action) {
    case 'bold':
      return wrapSelection(value, start, end, '**', '**', '粗体')
    case 'italic':
      return wrapSelection(value, start, end, '*', '*', '斜体')
    case 'strike':
      return wrapSelection(value, start, end, '~~', '~~', '删除线')
    case 'code':
      return wrapSelection(value, start, end, '`', '`', 'code')
    case 'link':
      return wrapSelection(value, start, end, '[', '](https://)', '链接文字')
    case 'image':
      return wrapSelection(value, start, end, '![', '](asset://)', '图片说明')
    case 'h1':
      return setHeading(value, start, end, 1)
    case 'h2':
      return setHeading(value, start, end, 2)
    case 'h3':
      return setHeading(value, start, end, 3)
    case 'h4':
      return setHeading(value, start, end, 4)
    case 'h5':
      return setHeading(value, start, end, 5)
    case 'h6':
      return setHeading(value, start, end, 6)
    case 'paragraph':
      return setHeading(value, start, end, 0)
    case 'quote':
      return prefixLines(value, start, end, '> ')
    case 'ordered-list':
      return prefixLines(value, start, end, '1. ')
    case 'bullet-list':
      return prefixLines(value, start, end, '- ')
    case 'task-list':
      return prefixLines(value, start, end, '- [ ] ')
    case 'codeblock': {
      const selected = value.slice(start, end) || 'code'
      const snippet = `\n\`\`\`\n${selected}\n\`\`\`\n`
      const next = value.slice(0, start) + snippet + value.slice(end)
      return {
        next,
        cursorStart: start + 5,
        cursorEnd: start + 5 + selected.length,
      }
    }
    case 'table': {
      const table = buildMarkdownTable(3, 3)
      const next = value.slice(0, start) + table + value.slice(end)
      return { next, cursorStart: start + 1, cursorEnd: start + table.length }
    }
    case 'hr': {
      const snippet = '\n\n---\n\n'
      const next = value.slice(0, start) + snippet + value.slice(end)
      return { next, cursorStart: start + snippet.length, cursorEnd: start + snippet.length }
    }
    default:
      return { next: value, cursorStart: start, cursorEnd: end }
  }
}

export function buildMarkdownTable(cols: number, rows: number) {
  const columnCount = Math.min(20, Math.max(1, Math.floor(cols)))
  const bodyRows = Math.min(50, Math.max(1, Math.floor(rows)))
  const header = Array.from({ length: columnCount }, (_, i) => `列${i + 1}`).join(' | ')
  const sep = Array.from({ length: columnCount }, () => '---').join(' | ')
  const body = Array.from({ length: bodyRows }, () =>
    Array.from({ length: columnCount }, () => ' ').join(' | '),
  )
  return `\n| ${header} |\n| ${sep} |\n${body.map((row) => `| ${row} |`).join('\n')}\n`
}

export function extractTitle(markdown: string, fallback = '未命名文档') {
  const match = markdown.match(/^#\s+(.+)$/m)
  const title = match?.[1]?.trim()
  return title || fallback
}

export type OutlineItem = {
  id: string
  level: number
  text: string
  line: number
}

export function extractOutline(markdown: string): OutlineItem[] {
  return markdown
    .split('\n')
    .map((line, index) => {
      const match = /^(#{1,6})\s+(.+)$/.exec(line)
      if (!match) return null
      return {
        id: `h-${index}-${match[1].length}`,
        level: match[1].length,
        text: match[2].trim(),
        line: index,
      }
    })
    .filter((item): item is OutlineItem => Boolean(item))
}

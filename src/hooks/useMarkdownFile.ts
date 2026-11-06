import { useCallback, useRef, useState } from 'react'

type FileHandle = FileSystemFileHandle

function supportsFileSystemAccess() {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window
}

async function readTextFromHandle(handle: FileHandle) {
  const file = await handle.getFile()
  return {
    name: file.name,
    content: await file.text(),
  }
}

async function writeTextToHandle(handle: FileHandle, content: string) {
  const writable = await handle.createWritable()
  await writable.write(content)
  await writable.close()
}

function downloadFallback(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.md') ? filename : `${filename}.md`
  a.click()
  URL.revokeObjectURL(url)
}

function openFallback(): Promise<{ name: string; content: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md,.markdown,.txt,text/markdown,text/plain'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      resolve({ name: file.name, content: await file.text() })
    }
    input.click()
  })
}

export function useMarkdownFile(initialContent: string) {
  const handleRef = useRef<FileHandle | null>(null)
  const [fileName, setFileName] = useState('Untitled.md')
  const [content, setContent] = useState(initialContent)
  const [dirty, setDirty] = useState(false)

  const markDirty = useCallback((next: string) => {
    setContent(next)
    setDirty(true)
  }, [])

  const openFile = useCallback(async () => {
    try {
      if (supportsFileSystemAccess()) {
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: 'Markdown',
              accept: {
                'text/markdown': ['.md', '.markdown'],
                'text/plain': ['.txt'],
              },
            },
          ],
        })
        const result = await readTextFromHandle(handle)
        handleRef.current = handle
        setFileName(result.name)
        setContent(result.content)
        setDirty(false)
        return result.content
      }

      const result = await openFallback()
      if (!result) return null
      handleRef.current = null
      setFileName(result.name)
      setContent(result.content)
      setDirty(false)
      return result.content
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return null
      }
      throw error
    }
  }, [])

  const saveFile = useCallback(
    async (markdown: string, saveAs = false) => {
      try {
        if (supportsFileSystemAccess()) {
          let handle = handleRef.current
          if (saveAs || !handle) {
            handle = await window.showSaveFilePicker({
              suggestedName: fileName.endsWith('.md') ? fileName : `${fileName}.md`,
              types: [
                {
                  description: 'Markdown',
                  accept: { 'text/markdown': ['.md'] },
                },
              ],
            })
            handleRef.current = handle
            setFileName(handle.name)
          }
          await writeTextToHandle(handle, markdown)
          setContent(markdown)
          setDirty(false)
          return true
        }

        downloadFallback(fileName, markdown)
        setContent(markdown)
        setDirty(false)
        return true
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return false
        }
        throw error
      }
    },
    [fileName],
  )

  const newFile = useCallback((markdown: string) => {
    handleRef.current = null
    setFileName('Untitled.md')
    setContent(markdown)
    setDirty(false)
  }, [])

  return {
    fileName,
    content,
    dirty,
    setContent: markDirty,
    replaceContent: (markdown: string) => {
      setContent(markdown)
      setDirty(false)
    },
    openFile,
    saveFile,
    newFile,
  }
}

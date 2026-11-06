import { Crepe } from '@milkdown/crepe'
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core'
import {
  clearTextInCurrentBlockCommand,
  createCodeBlockCommand,
  insertHrCommand,
  insertImageCommand,
  listItemSchema,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
  toggleStrongCommand,
  turnIntoTextCommand,
  updateLinkCommand,
  wrapInBlockquoteCommand,
  wrapInBlockTypeCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from '@milkdown/kit/preset/commonmark'
import { insertTableCommand, toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm'
import { TextSelection } from '@milkdown/kit/prose/state'
import { callCommand, replaceAll } from '@milkdown/kit/utils'
import { useEffect, useRef } from 'react'

import type { FormatAction } from '../lib/formatMarkdown'

import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import '../styles/markdown-prose.css'

export type EditorApi = {
  getMarkdown: () => string
  setMarkdown: (markdown: string) => void
  applyFormat: (action: FormatAction) => void
  applyLink: (href: string, text?: string) => void
  applyImage: (src: string, alt?: string) => void
  insertTable: (cols: number, rows: number) => void
  insertText: (text: string) => void
  focus: () => void
}

type CrepeEditorProps = {
  docKey: string
  defaultValue: string
  dark?: boolean
  onChange: (markdown: string) => void
  onReady?: (api: EditorApi) => void
  onPasteImage?: (file: File) => Promise<string | null>
}

export function CrepeEditor({
  docKey,
  defaultValue,
  dark = false,
  onChange,
  onReady,
  onPasteImage,
}: CrepeEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const onReadyRef = useRef(onReady)
  const onPasteImageRef = useRef(onPasteImage)
  const defaultValueRef = useRef(defaultValue)
  const crepeRef = useRef<Crepe | null>(null)

  onChangeRef.current = onChange
  onReadyRef.current = onReady
  onPasteImageRef.current = onPasteImage
  defaultValueRef.current = defaultValue

  useEffect(() => {
    document.documentElement.dataset.crepeTheme = dark ? 'dark' : 'light'
  }, [dark])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const crepe = new Crepe({
      root,
      defaultValue: defaultValueRef.current,
      features: {
        [Crepe.Feature.Latex]: true,
        [Crepe.Feature.TopBar]: false,
      },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: {
          text: '开始写作…',
          mode: 'block',
        },
        [Crepe.Feature.ListItem]: {
          bulletIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.25"/></svg>`,
          checkBoxCheckedIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 12.5 10 16l7.5-8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
          checkBoxUncheckedIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"></svg>`,
        },
      },
    })
    crepeRef.current = crepe

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown, prevMarkdown) => {
        if (markdown !== prevMarkdown) onChangeRef.current(markdown)
      })
    })

    const onPaste = async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items || !onPasteImageRef.current) return
      for (const item of items) {
        if (!item.type.startsWith('image/')) continue
        const file = item.getAsFile()
        if (!file) continue
        event.preventDefault()
        event.stopPropagation()
        const markdownImage = await onPasteImageRef.current(file)
        if (!markdownImage) return
        const current = crepe.getMarkdown()
        const next = `${current.trimEnd()}\n\n${markdownImage}\n`
        crepe.editor.action(replaceAll(next))
        onChangeRef.current(next)
        return
      }
    }

    let cancelled = false
    void crepe.create().then(() => {
      if (cancelled) return
      root.addEventListener('paste', onPaste, true)

      const focusEditor = () => {
        crepe.editor.action((ctx) => {
          ctx.get(editorViewCtx).focus()
        })
      }

      const api: EditorApi = {
        getMarkdown: () => crepe.getMarkdown(),
        setMarkdown: (markdown: string) => {
          crepe.editor.action(replaceAll(markdown))
        },
        focus: focusEditor,
        insertText: (text: string) => {
          crepe.editor.action((ctx) => {
            const view = ctx.get(editorViewCtx)
            const { from, to } = view.state.selection
            const snippet = text.startsWith('\n') ? text : `\n${text}\n`
            view.dispatch(view.state.tr.insertText(snippet, from, to))
            view.focus()
          })
          onChangeRef.current(crepe.getMarkdown())
        },
        applyLink: (href: string, text = '链接文字') => {
          crepe.editor.action((ctx) => {
            const view = ctx.get(editorViewCtx)
            const { empty, from } = view.state.selection
            if (empty) {
              const withText = view.state.tr.insertText(text, from)
              view.dispatch(
                withText.setSelection(
                  TextSelection.create(withText.doc, from, from + text.length),
                ),
              )
            }
          })
          crepe.editor.action(callCommand(toggleLinkCommand.key, { href }))
          crepe.editor.action(callCommand(updateLinkCommand.key, { href }))
          focusEditor()
        },
        applyImage: (src: string, alt = '图片说明') => {
          crepe.editor.action(callCommand(insertImageCommand.key, { src, alt }))
          focusEditor()
        },
        insertTable: (cols: number, rows: number) => {
          crepe.editor.action(
            callCommand(insertTableCommand.key, {
              row: Math.max(1, rows),
              col: Math.max(1, cols),
            }),
          )
          focusEditor()
        },
        applyFormat: (action: FormatAction) => {
          const editor = crepe.editor
          const run = (command: Parameters<typeof callCommand>[0], payload?: unknown) => {
            editor.action(callCommand(command, payload))
            focusEditor()
          }

          switch (action) {
            case 'bold':
              run(toggleStrongCommand.key)
              break
            case 'italic':
              run(toggleEmphasisCommand.key)
              break
            case 'strike':
              run(toggleStrikethroughCommand.key)
              break
            case 'code':
              run(toggleInlineCodeCommand.key)
              break
            case 'link':
            case 'image':
              // Handled by App modal — keep no-op here.
              break
            case 'h1':
            case 'h2':
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6':
              run(wrapInHeadingCommand.key, Number(action.slice(1)))
              break
            case 'paragraph':
              run(turnIntoTextCommand.key)
              break
            case 'quote':
              run(wrapInBlockquoteCommand.key)
              break
            case 'codeblock':
              run(createCodeBlockCommand.key)
              break
            case 'bullet-list':
              run(wrapInBulletListCommand.key)
              break
            case 'ordered-list':
              run(wrapInOrderedListCommand.key)
              break
            case 'table':
              run(insertTableCommand.key, { row: 3, col: 3 })
              break
            case 'hr':
              run(insertHrCommand.key)
              break
            case 'task-list':
              editor.action((ctx) => {
                const commands = ctx.get(commandsCtx)
                const listItem = listItemSchema.type(ctx)
                commands.call(clearTextInCurrentBlockCommand.key)
                commands.call(wrapInBlockTypeCommand.key, {
                  nodeType: listItem,
                  attrs: { checked: false },
                })
              })
              focusEditor()
              break
            default:
              break
          }
        },
      }

      onReadyRef.current?.(api)
    })

    return () => {
      cancelled = true
      root.removeEventListener('paste', onPaste, true)
      crepeRef.current = null
      void crepe.destroy()
    }
  }, [docKey])

  return <div className="crepe-host" ref={rootRef} />
}

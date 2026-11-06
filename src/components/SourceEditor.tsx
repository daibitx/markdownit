import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  placeholder,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
} from '@codemirror/view'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

import type { FormatAction } from '../lib/formatMarkdown'
import { applySourceFormat } from '../lib/formatMarkdown'

export type SourceEditorHandle = {
  applyFormat: (action: FormatAction) => void
  insertText: (text: string) => void
  focusLine: (line: number) => void
  focus: () => void
}

type SourceEditorProps = {
  value: string
  dark?: boolean
  onChange: (value: string) => void
  onPasteImage?: (file: File) => Promise<string | null>
}

function readSelection(view: EditorView) {
  const { from, to } = view.state.selection.main
  return { from, to, doc: view.state.doc.toString() }
}

function replaceRange(view: EditorView, next: string, cursorStart: number, cursorEnd: number) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: next },
    selection: { anchor: cursorStart, head: cursorEnd },
  })
  view.focus()
}

export const SourceEditor = forwardRef<SourceEditorHandle, SourceEditorProps>(
  function SourceEditor({ value, dark = false, onChange, onPasteImage }, ref) {
    const hostRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const valueRef = useRef(value)
    const onChangeRef = useRef(onChange)
    const onPasteImageRef = useRef(onPasteImage)

    valueRef.current = value
    onChangeRef.current = onChange
    onPasteImageRef.current = onPasteImage

    useImperativeHandle(ref, () => ({
      applyFormat: (action) => {
        const view = viewRef.current
        if (!view) return
        const { from, to, doc } = readSelection(view)
        const result = applySourceFormat(doc, from, to, action)
        replaceRange(view, result.next, result.cursorStart, result.cursorEnd)
        onChangeRef.current(result.next)
      },
      insertText: (text) => {
        const view = viewRef.current
        if (!view) {
          onChangeRef.current(`${valueRef.current.trimEnd()}\n\n${text}\n`)
          return
        }
        const { from, to } = view.state.selection.main
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length },
        })
        view.focus()
        onChangeRef.current(view.state.doc.toString())
      },
      focusLine: (line) => {
        const view = viewRef.current
        if (!view) return
        const doc = view.state.doc
        const target = Math.min(Math.max(1, line), doc.lines)
        const pos = doc.line(target).from
        view.dispatch({
          selection: { anchor: pos },
          effects: EditorView.scrollIntoView(pos, { y: 'center' }),
        })
        view.focus()
      },
      focus: () => viewRef.current?.focus(),
    }))

    useEffect(() => {
      const host = hostRef.current
      if (!host) return

      const syncTheme = EditorView.theme(
        {
          '&': {
            height: '100%',
            fontSize: 'calc(var(--editor-font-size) - 1px)',
            backgroundColor: 'transparent',
            color: 'var(--ink)',
          },
          '.cm-scroller': {
            fontFamily: 'var(--mono)',
            lineHeight: '1.7',
            overflow: 'auto',
          },
          '.cm-content': {
            padding: '1.1rem 1.25rem 2.5rem',
            caretColor: 'var(--accent)',
          },
          '.cm-gutters': {
            background: 'transparent',
            border: 'none',
            color: 'color-mix(in srgb, var(--muted) 70%, transparent)',
            minWidth: '2.4rem',
          },
          '.cm-activeLineGutter': {
            background: 'transparent',
            color: 'var(--accent)',
          },
          '.cm-activeLine': {
            background: 'color-mix(in srgb, var(--accent) 6%, transparent)',
          },
          '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
            background: 'color-mix(in srgb, var(--accent) 24%, transparent) !important',
          },
          '.cm-cursor': {
            borderLeftColor: 'var(--accent)',
          },
          '&.cm-focused': {
            outline: 'none',
          },
          '.cm-scroller::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '.cm-scroller::-webkit-scrollbar-thumb': {
            background: 'color-mix(in srgb, var(--muted) 42%, transparent)',
            border: '2px solid transparent',
            borderRadius: '999px',
            backgroundClip: 'content-box',
          },
          '.cm-scroller::-webkit-scrollbar-button': {
            display: 'none',
            width: 0,
            height: 0,
          },
        },
        { dark },
      )

      const view = new EditorView({
        parent: host,
        state: EditorState.create({
          doc: valueRef.current,
          extensions: [
            syncTheme,
            lineNumbers(),
            highlightActiveLine(),
            highlightActiveLineGutter(),
            drawSelection(),
            history(),
            markdown({ base: markdownLanguage, codeLanguages: languages }),
            placeholder('在此编辑 Markdown 源码…'),
            keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
            EditorView.lineWrapping,
            EditorView.updateListener.of((update) => {
              if (!update.docChanged) return
              onChangeRef.current(update.state.doc.toString())
            }),
            EditorView.domEventHandlers({
              paste(event, view) {
                const pasteImage = onPasteImageRef.current
                if (!pasteImage) return false
                const items = event.clipboardData?.items
                if (!items) return false
                for (const item of items) {
                  if (!item.type.startsWith('image/')) continue
                  const file = item.getAsFile()
                  if (!file) continue
                  event.preventDefault()
                  void pasteImage(file).then((markdownImage) => {
                    if (!markdownImage) return
                    const snippet = `\n${markdownImage}\n`
                    const { from, to } = view.state.selection.main
                    view.dispatch({
                      changes: { from, to, insert: snippet },
                      selection: { anchor: from + snippet.length },
                    })
                    onChangeRef.current(view.state.doc.toString())
                  })
                  return true
                }
                return false
              },
            }),
          ],
        }),
      })
      viewRef.current = view

      return () => {
        view.destroy()
        viewRef.current = null
      }
      // Recreate only when theme flips so syntax colors refresh cleanly.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dark])

    useEffect(() => {
      const view = viewRef.current
      if (!view) return
      const current = view.state.doc.toString()
      if (current === value) return
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      })
    }, [value])

    return <div ref={hostRef} className="source-editor source-editor-cm" aria-label="Markdown 源码" />
  },
)

import type { MarkdownItApi } from '../types/markdownit'

export function getApi(): MarkdownItApi {
  if (!window.markdownit) {
    throw new Error('MarkdownIt desktop API 不可用，请通过 Electron 启动应用')
  }
  return window.markdownit
}

export function isDesktop() {
  return Boolean(window.markdownit)
}

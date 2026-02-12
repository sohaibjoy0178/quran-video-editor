import { ElectronAPI } from '@electron-toolkit/preload'

interface StoreAPI {
  get: (key: string) => Promise<unknown>
  set: (key: string, value: unknown) => Promise<void>
  getAll: () => Promise<Record<string, unknown>>
}

interface DialogAPI {
  openFile: (filters: Array<{ name: string; extensions: string[] }>) => Promise<string | null>
  saveFile: (defaultName: string) => Promise<string | null>
}

interface GeminiAPI {
  analyze: (audioPath: string) => Promise<any>
  testConnection: () => Promise<{ success: boolean; message: string }>
  onProgress: (callback: (data: { status: string; error?: boolean }) => void) => () => void
}

interface FFmpegAPI {
  getPath: () => Promise<{ path: string; exists: boolean }>
  render: (options: unknown) => Promise<{ success: boolean; message: string }>
  cancel: () => Promise<boolean>
  probe: (filePath: string) => Promise<{ duration: number; width: number; height: number }>
  extractAudio: (videoPath: string) => Promise<string>
  onProgress: (callback: (data: { currentTime: number; line: string }) => void) => () => void
  onDiagnostic: (
    callback: (data: { runLabel: string; line: string; at: number }) => void
  ) => () => void
}

interface CaptionSegment {
  start: number
  end: number
  arabic: string
  bengali: string
  arabicLines: string[]
  bengaliLines: string[]
}

interface CaptionsAPI {
  saveImages: (
    images: Array<{ pngDataUrl: string; start: number; end: number }>
  ) => Promise<Array<{ path: string; start: number; end: number }>>
}

interface FilesAPI {
  write: (path: string, buffer: ArrayBuffer) => Promise<{ success: boolean; error?: string }>
}

interface CustomAPI {
  store: StoreAPI
  dialog: DialogAPI
  gemini: GeminiAPI
  captions: CaptionsAPI
  files: FilesAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}

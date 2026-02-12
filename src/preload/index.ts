import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom API exposed to renderer
const api = {
  // ─── Store ─────────────────────────────────────────────
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
    getAll: () => ipcRenderer.invoke('store:getAll')
  },

  // ─── File Dialogs ──────────────────────────────────────
  dialog: {
    openFile: (filters: Array<{ name: string; extensions: string[] }>) =>
      ipcRenderer.invoke('dialog:openFile', filters),
    saveFile: (defaultName: string) => ipcRenderer.invoke('dialog:saveFile', defaultName)
  },

  // ─── Gemini AI ─────────────────────────────────────────
  gemini: {
    analyze: (audioPath: string) => ipcRenderer.invoke('gemini:analyze', audioPath),
    testConnection: () => ipcRenderer.invoke('gemini:testConnection'),
    onProgress: (callback: (data: { status: string; error?: boolean }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { status: string; error?: boolean }) =>
        callback(data)
      ipcRenderer.on('gemini:progress', handler)
      return () => ipcRenderer.removeListener('gemini:progress', handler)
    }
  },

  // ─── File System ───────────────────────────────────────
  files: {
    write: (path: string, buffer: ArrayBuffer) => ipcRenderer.invoke('file:save', path, buffer)
  },

  // ─── Captions ──────────────────────────────────────────
  captions: {
    saveImages: (
      images: Array<{ pngDataUrl: string; start: number; end: number }>
    ): Promise<Array<{ path: string; start: number; end: number }>> =>
      ipcRenderer.invoke('captions:saveImages', images)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}

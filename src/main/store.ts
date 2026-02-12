import { ipcMain } from 'electron'

interface StoreSchema {
  geminiApiKey: string
  captionSettings: {
    arabicFont: string
    bengaliFont: string
    arabicSize: number
    bengaliSize: number
    arabicColor: string
    bengaliColor: string
    gap: number
    strokeColor: string
    strokeWidth: number
    shadowColor: string
    shadowBlur: number
    positionY: number
    animation?: string
  }
  renderSettings: {
    encoder: 'av1_qsv' | 'hevc_qsv' | 'libsvtav1' | 'libx265'
    bitrate: string
    enableSlowMo: boolean
    slowMoFps: number
    videoFilter: 'none' | 'cinematic' | 'bw' | 'warm' | 'cool'
  }
  watermark: {
    path: string
    x: number
    y: number
    width: number
    height: number
    opacity: number
  } | null
  isRendering: boolean
  lastProjectDir: string
}

const DEFAULTS: StoreSchema = {
  geminiApiKey: '',
  captionSettings: {
    arabicFont: 'Amiri',
    bengaliFont: 'Noto Sans Bengali',
    arabicSize: 48,
    bengaliSize: 36,
    arabicColor: '#ffffff',
    bengaliColor: '#f0e68c',
    gap: 16,
    strokeColor: '#000000',
    strokeWidth: 2,
    shadowColor: 'rgba(0,0,0,0.8)',
    shadowBlur: 8,
    positionY: 75,
    animation: 'none'
  },
  renderSettings: {
    encoder: 'av1_qsv',
    bitrate: '8M',
    enableSlowMo: false,
    slowMoFps: 60,
    videoFilter: 'none'
  },
  watermark: null,
  isRendering: false,
  lastProjectDir: ''
}

// electron-store v8 is ESM-only â€” use dynamic import
let storeInstance: any = null

async function getStoreInstance(): Promise<any> {
  if (storeInstance) return storeInstance
  const { default: Store } = await import('electron-store')
  storeInstance = new Store({
    name: 'quran-editor-settings',
    defaults: DEFAULTS
  })
  return storeInstance
}

export function registerStoreHandlers(): void {
  ipcMain.removeHandler('store:get')
  ipcMain.handle('store:get', async (_event, key: string) => {
    const store = await getStoreInstance()
    return store.get(key)
  })

  ipcMain.removeHandler('store:set')
  ipcMain.handle('store:set', async (_event, key: string, value: unknown) => {
    const store = await getStoreInstance()
    store.set(key, value)
  })

  ipcMain.removeHandler('store:getAll')
  ipcMain.handle('store:getAll', async () => {
    const store = await getStoreInstance()
    return store.store
  })
}

export async function getStore(): Promise<any> {
  return getStoreInstance()
}

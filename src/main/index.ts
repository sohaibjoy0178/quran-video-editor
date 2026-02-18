import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { writeFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerGeminiHandlers } from './gemini'
import { registerStoreHandlers } from './store'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0d1117',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0d1117',
      symbolColor: '#e6edf3',
      height: 36
    },
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false // Allow loading local video files
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ─── IPC: File Dialogs ──────────────────────────────────────────────
ipcMain.handle('dialog:openFile', async (_event, filters: Electron.FileFilter[]) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

ipcMain.handle('dialog:saveFile', async (_event, defaultName: string) => {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: 'Video', extensions: ['mp4', 'mkv', 'webm'] }]
  })
  if (result.canceled) return null
  return result.filePath
})

// ─── IPC: Save Caption Images ────────────────────────────────────────

// ─── App Lifecycle ────────────────────────────────────────────────────
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.quraneditor.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register all IPC handlers
  registerStoreHandlers()
  //   registerFFmpegHandlers() // Removed: migrating to client-side MediaRecorder
  registerGeminiHandlers()

  // ─── IPC: Write File (for saving Blobs) ──────────────────────────────
  ipcMain.handle('file:save', async (_event, filePath: string, buffer: ArrayBuffer) => {
    try {
      writeFileSync(filePath, Buffer.from(buffer))
      return { success: true }
    } catch (e: unknown) {
      const error = e as Error
      console.error('Failed to save file:', error)
      return { success: false, error: error.message }
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

export { mainWindow }

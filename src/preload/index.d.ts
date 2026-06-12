import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    voltAPI: {
      // Expand this as ipcMain handlers are added in Phase 3+
    }
  }
}

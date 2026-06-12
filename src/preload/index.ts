import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Expose a typed, sandboxed API surface to the renderer.
// Nothing from Node or Electron leaks through except what is explicitly listed here.

const voltAPI = {
  // Phase 3: Claude API proxy will be wired up here.
  // The API key will be stored securely in the main process via electron-store
  // and all Claude requests will be proxied through ipcMain — never exposed
  // to the renderer directly.
  //
  // Example (not yet implemented):
  //   askClaude: (messages: Message[]) => ipcRenderer.invoke('claude:chat', messages)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('voltAPI', voltAPI)
  } catch (error) {
    console.error('[preload] Failed to expose APIs:', error)
  }
} else {
  // Fallback for non-sandboxed environments (should not occur in production)
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.voltAPI = voltAPI
}

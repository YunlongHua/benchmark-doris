// Global type declarations for Electron runtime built-ins
// These are available in the Electron main process at runtime

declare namespace Electron {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface App {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface BrowserWindow {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IpcMain {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IpcRenderer {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ContextBridge {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Dialog {}
}

declare const app: typeof import('electron').app
declare const BrowserWindow: typeof import('electron').BrowserWindow
declare const ipcMain: typeof import('electron').ipcMain
declare const ipcRenderer: typeof import('electron').ipcRenderer
declare const contextBridge: typeof import('electron').contextBridge
declare const dialog: typeof import('electron').dialog

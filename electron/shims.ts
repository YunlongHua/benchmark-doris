// Shim for Electron globals
// The 'electron' npm package is a CLI tool that returns a string path, NOT the electron API.
// We use require to access the Electron runtime's built-in modules.

const electron = require('electron')

export const app = electron.app
export const BrowserWindow = electron.BrowserWindow
export const ipcMain = electron.ipcMain
export const ipcRenderer = electron.ipcRenderer
export const contextBridge = electron.contextBridge
export const dialog = electron.dialog
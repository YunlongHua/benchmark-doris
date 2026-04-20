import { contextBridge, ipcRenderer } from 'electron'

export interface IElectronAPI {
  test: {
    start: (payload: { testType: string; scale: number; clusterId: string }) => Promise<void>
    stop: () => Promise<void>
    runStep: (payload: { step: number; testType: string; scale: number; clusterId: string }) => Promise<void>
  }
  config: {
    list: () => Promise<ClusterConfig[]>
    save: (config: ClusterConfig) => Promise<void>
    delete: (name: string) => Promise<void>
  }
  result: {
    export: (result: TestResult, savePath: string) => Promise<void>
  }
  sql: {
    execute: (sql: string, clusterId: string) => Promise<SqlResult>
  }
  system: {
    checkDeps: () => Promise<{ bash: boolean; mysql: boolean }>
  }
  on: (channel: string, callback: (data: unknown) => void) => () => void
}

interface ClusterConfig {
  name: string
  feHost: string
  feHttpPort: number
  feQueryPort: number
  user: string
  password: string
  createdAt: string
}

interface TestResult {
  testType: string
  scale: number
  clusterName: string
  startTime: string
  endTime: string
  totalDurationMs: number
  queries: Array<{ queryId: string; sql: string; durationMs: number; status: string; error?: string }>
}

interface SqlResult {
  columns: string[]
  rows: Record<string, unknown>[]
}

const api: IElectronAPI = {
  test: {
    start: (p) => ipcRenderer.invoke('test:start', p),
    stop: () => ipcRenderer.invoke('test:stop'),
    runStep: (p) => ipcRenderer.invoke('test:step', p)
  },
  config: {
    list: () => ipcRenderer.invoke('config:list'),
    save: (c) => ipcRenderer.invoke('config:save', c),
    delete: (n) => ipcRenderer.invoke('config:delete', n)
  },
  result: {
    export: (r, p) => ipcRenderer.invoke('result:export', r, p)
  },
  sql: {
    execute: (s, cid) => ipcRenderer.invoke('sql:execute', s, cid)
  },
  system: {
    checkDeps: () => ipcRenderer.invoke('system:check-deps')
  },
  on: (channel, callback) => {
    const subscription = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on(channel, subscription)
    return () => { ipcRenderer.removeListener(channel, subscription) }
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
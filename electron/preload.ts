import { contextBridge, ipcRenderer } from './shims'

export interface IElectronAPI {
  test: {
    start: (payload: { testType: string; scale: number; clusterId: string }) => Promise<void>
    stop: () => Promise<void>
    runStep: (payload: { step: number; testType: string; scale: number; clusterId: string }) => Promise<void>
    uploadTools: (payload: { testType: string; clusterId: string }) => Promise<void>
    cleanup: (payload: { target: string; testType: string; scale: number; clusterId: string }) => Promise<void>
  }
  config: {
    list: () => Promise<ClusterConfig[]>
    save: (config: ClusterConfig) => Promise<void>
    delete: (name: string) => Promise<void>
  }
  result: {
    export: (result: EnhancedTestResult, savePath: string) => Promise<void>
    generateReport: (language: string) => Promise<string>
  }
  sql: {
    execute: (sql: string, cluster: ClusterConfig) => Promise<SqlResult>
  }
  system: {
    checkDeps: () => Promise<{ bash: boolean; mysql: boolean }>
    testSsh: (config: SshConfig) => Promise<void>
    checkEnv: (payload: { testType: string; scale: number; clusterId: string; language?: string }) => Promise<{ toolsUploaded: boolean; build: boolean; dataGenerated: boolean; tablesCreated: boolean; dataLoaded: boolean; details: string }>
  }
  on: (channel: string, callback: (data: unknown) => void) => () => void
}

interface SshConfig {
  host: string
  port: number
  user: string
  password: string
}

interface ClusterConfig {
  name: string
  feHost: string
  feHttpPort: number
  feHttpsPort: number
  feQueryPort: number
  user: string
  password: string
  sshHost: string
  sshPort: number
  sshUser: string
  sshPassword: string
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

interface QueryRunDetail {
  coldRun: number
  hotRun1: number
  hotRun2: number
  bestHotRun: number
}

interface EnhancedQueryResult extends QueryResult {
  runDetails: QueryRunDetail
}

interface TestSummary {
  totalQueries: number
  successCount: number
  failedCount: number
  successRate: number
  avgColdRun: number
  avgHotRun: number
  minColdRun: number
  maxColdRun: number
  minHotRun: number
  maxHotRun: number
  coldStdDev: number
  hotStdDev: number
  qps: number
  cacheHitRate: number
  performanceScore: number
}

interface EnhancedTestResult {
  testType: 'ssb' | 'tpch' | 'tpcds'
  scale: number
  clusterName: string
  startTime: string
  endTime: string
  totalDurationMs: number
  totalColdRunMs: number
  totalHotRunMs: number
  queries: EnhancedQueryResult[]
  summary: TestSummary
  flatQueries?: EnhancedQueryResult[]
  flatSummary?: TestSummary
}

interface SqlResult {
  columns: string[]
  rows: Record<string, unknown>[]
}

const api: IElectronAPI = {
  test: {
    start: (p) => ipcRenderer.invoke('test:start', p),
    stop: () => ipcRenderer.invoke('test:stop'),
    runStep: (payload: { step: number; testType: string; scale: number; clusterId: string }) => ipcRenderer.invoke('test:step', payload) as Promise<any>,
    uploadTools: (p) => ipcRenderer.invoke('test:upload-tools', p),
    cleanup: (p) => ipcRenderer.invoke('test:cleanup', p)
  },
  config: {
    list: () => ipcRenderer.invoke('config:list'),
    save: (c) => ipcRenderer.invoke('config:save', c),
    delete: (n) => ipcRenderer.invoke('config:delete', n)
  },
  result: {
    export: (r, p) => ipcRenderer.invoke('result:export', r ? JSON.parse(JSON.stringify(r)) : r, p),
    generateReport: (lang) => ipcRenderer.invoke('report:generate', lang)
  },
  sql: {
    execute: (s, cid) => ipcRenderer.invoke('sql:execute', s, cid)
  },
  system: {
    checkDeps: () => ipcRenderer.invoke('system:check-deps'),
    testSsh: (c) => ipcRenderer.invoke('system:test-ssh', c),
    checkEnv: (p) => ipcRenderer.invoke('system:check-env', p)
  },
  on: (channel, callback) => {
    const subscription = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on(channel, subscription)
    return () => { ipcRenderer.removeListener(channel, subscription) }
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
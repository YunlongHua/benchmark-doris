/// <reference types="vite/client" />

export {} // Make this file a module so `declare global` takes effect

export interface ClusterConfig {
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

export interface QueryResult {
  queryId: string
  sql: string
  durationMs: number
  status: 'success' | 'error'
  error?: string
}

export interface TestResult {
  testType: 'ssb' | 'tpch' | 'tpcds'
  scale: number
  clusterName: string
  startTime: string
  endTime: string
  totalDurationMs: number
  queries: QueryResult[]
}

export interface SqlResult {
  columns: string[]
  rows: Record<string, unknown>[]
}

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
    execute: (sql: string, cluster: ClusterConfig) => Promise<SqlResult>
  }
  system: {
    checkDeps: () => Promise<{ bash: boolean; mysql: boolean }>
  }
  on: (channel: string, callback: (data: unknown) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: IElectronAPI
  }
}

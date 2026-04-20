export interface ClusterConfig {
  name: string
  feHost: string
  feHttpPort: number
  feQueryPort: number
  user: string
  password: string
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
    execute: (sql: string, clusterId: string) => Promise<SqlResult>
  }
  system: {
    checkDeps: () => Promise<{ bash: boolean; mysql: boolean }>
  }
  on: (channel: string, callback: (data: unknown) => void) => () => void
}

export type TestType = 'ssb' | 'tpch' | 'tpcds'
export type TestStep = 1 | 2 | 3 | 4 | 5
export type TestStatus = 'idle' | 'running' | 'success' | 'error'
export type LogLevel = 'info' | 'error'

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

export type TestType = 'ssb' | 'tpch' | 'tpcds'
export type TestStep = 1 | 2 | 3 | 4 | 5
export type TestStatus = 'idle' | 'running' | 'success' | 'error'
export type LogLevel = 'info' | 'error' | 'warn'
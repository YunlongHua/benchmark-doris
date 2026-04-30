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

export interface QueryRunDetail {
  coldRun: number
  hotRun1: number
  hotRun2: number
  bestHotRun: number
}

export interface EnhancedQueryResult extends QueryResult {
  runDetails: QueryRunDetail
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

export interface EnhancedTestResult {
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

export interface TestSummary {
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

export interface SqlResult {
  columns: string[]
  rows: Record<string, unknown>[]
}

export type TestType = 'ssb' | 'tpch' | 'tpcds'
export type TestStep = 1 | 2 | 3 | 4 | 5 | 6
export type TestStatus = 'idle' | 'running' | 'success' | 'error'
export type LogLevel = 'info' | 'error' | 'warn'
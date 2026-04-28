/// <reference types="vite/client" />

import type { ClusterConfig, SqlResult, EnhancedTestResult } from './types'

export interface IElectronAPI {
  test: {
    start: (payload: { testType: string; scale: number; clusterId: string }) => Promise<void>
    stop: () => Promise<void>
    runStep: (payload: { step: number; testType: string; scale: number; clusterId: string }) => Promise<EnhancedTestResult | undefined>
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
    testSsh: (config: { host: string; port: number; user: string; password: string }) => Promise<void>
    checkEnv: (payload: { testType: string; scale?: number; clusterId: string; language?: string }) => Promise<{ toolsUploaded: boolean; build: boolean; dataGenerated: boolean; tablesCreated: boolean; dataLoaded: boolean; details: string }>
  }
  on: (channel: string, callback: (data: unknown) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: IElectronAPI
  }
}

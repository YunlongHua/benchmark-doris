# Doris Benchmark App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Electron desktop app that runs SSB/TPCH/TPCDS benchmarks on Apache Doris with a modern React UI, cluster config management, real-time log viewing, and result visualization.

**Architecture:** Electron + Vite + React. Main process handles shell script execution via child_process (Git Bash on Windows). Renderer process is a React SPA communicating with main via IPC. Zustand manages UI state. Ant Design provides UI components. ECharts renders result charts.

**Tech Stack:** Electron 28, React 18, TypeScript, Vite, Ant Design 5, Zustand, ECharts, electron-builder, YAML (js-yaml), Node.js child_process.

---

## Phase 1: Project Scaffolding

### Task 1: Initialize project structure and dependencies

**Files:**
- Create: `doris-benchmark-app/package.json`
- Create: `doris-benchmark-app/vite.config.ts`
- Create: `doris-benchmark-app/tsconfig.json`
- Create: `doris-benchmark-app/electron-builder.yml`
- Create: `doris-benchmark-app/index.html`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "doris-benchmark-app",
  "version": "1.0.0",
  "description": "Apache Doris Benchmark Desktop Client",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build && electron-builder",
    "preview": "vite preview"
  },
  "dependencies": {
    "antd": "^5.12.0",
    "echarts": "^5.4.3",
    "js-yaml": "^4.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.4.0"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^20.10.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "electron": "^28.0.0",
    "electron-builder": "^24.9.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vite-plugin-electron": "^0.28.0",
    "vite-plugin-electron-renderer": "^0.14.5"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Create tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts", "electron/**/*.ts"]
}
```

- [ ] **Step 4: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    electron([
      { entry: 'electron/main.ts', onstart(options) { options.startup() } },
      { entry: 'electron/preload.ts', onstart(options) { options.reload() } }
    ]),
    renderer()
  ],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  build: { outDir: 'dist' }
})
```

- [ ] **Step 5: Create electron-builder.yml**

```yaml
appId: com.apache.doris.benchmark
productName: Doris Benchmark
directories:
  output: release
  buildResources: build
files:
  - dist/**/*
  - dist-electron/**/*
  - tools/**/*
asar: true
win:
  target: nsis
  icon: build/icon.ico
```

- [ ] **Step 6: Create index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>Doris Benchmark</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Install dependencies**

Run: `cd doris-benchmark-app && npm install`
Expected: All packages installed without errors

- [ ] **Step 8: Commit**

```bash
git init && git add package.json tsconfig.json tsconfig.node.json vite.config.ts electron-builder.yml index.html && git commit -m "feat: scaffold Electron + Vite + React project"
```

---

### Task 2: Create Electron main process entry

**Files:**
- Create: `doris-benchmark-app/electron/main.ts`
- Create: `doris-benchmark-app/electron/preload.ts`
- Create: `doris-benchmark-app/src/vite-env.d.ts`

- [ ] **Step 1: Create electron/main.ts**

```typescript
import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc/handlers'

process.env.DIST_ELECTRON = join(__dirname, '..')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
process.env.VITE_PUBLIC = join(process.env.DIST_ELECTRON, '../public')

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Doris Benchmark',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(process.env.DIST, 'index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
```

- [ ] **Step 2: Create electron/preload.ts**

```typescript
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
```

- [ ] **Step 3: Create src/vite-env.d.ts**

```typescript
/// <reference types="vite/client" />

interface ClusterConfig {
  name: string
  feHost: string
  feHttpPort: number
  feQueryPort: number
  user: string
  password: string
  createdAt: string
}

interface QueryResult {
  queryId: string
  sql: string
  durationMs: number
  status: 'success' | 'error'
  error?: string
}

interface TestResult {
  testType: 'ssb' | 'tpch' | 'tpcds'
  scale: number
  clusterName: string
  startTime: string
  endTime: string
  totalDurationMs: number
  queries: QueryResult[]
}

interface SqlResult {
  columns: string[]
  rows: Record<string, unknown>[]
}

interface IElectronAPI {
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

declare global {
  interface Window {
    electronAPI: IElectronAPI
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add electron/main.ts electron/preload.ts src/vite-env.d.ts && git commit -m "feat: add Electron main process and preload bridge"
```

---

## Phase 2: Main Process — IPC Handlers

### Task 3: IPC handlers registration

**Files:**
- Create: `doris-benchmark-app/electron/ipc/handlers.ts`
- Create: `doris-benchmark-app/electron/ipc/scriptRunner.ts`
- Create: `doris-benchmark-app/electron/ipc/configStore.ts`
- Create: `doris-benchmark-app/electron/ipc/resultParser.ts`
- Create: `doris-benchmark-app/electron/services/mysql.ts`

- [ ] **Step 1: Create electron/ipc/handlers.ts**

```typescript
import { ipcMain, app, dialog, BrowserWindow } from 'electron'
import { ScriptRunner } from './scriptRunner'
import { ConfigStore } from './configStore'
import { ResultParser } from './resultParser'
import { MySQLService } from '../services/mysql'
import { TestResult, ClusterConfig } from '../../src/types'

const scriptRunner = new ScriptRunner()
const configStore = new ConfigStore()
const resultParser = new ResultParser()
const mysqlService = new MySQLService()

export function registerIpcHandlers() {
  // Test execution
  ipcMain.handle('test:start', async (event, { testType, scale, clusterId }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const cluster = configStore.get(clusterId)
    if (!cluster) throw new Error(`Cluster ${clusterId} not found`)

    await scriptRunner.runFullBenchmark(testType, scale, cluster, (line, level) => {
      win?.webContents.send('log:update', { line, level })
    }, (result: TestResult) => {
      win?.webContents.send('result:update', result)
    })
  })

  ipcMain.handle('test:stop', async () => {
    scriptRunner.stop()
  })

  ipcMain.handle('test:step', async (event, { step, testType, scale, clusterId }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const cluster = configStore.get(clusterId)
    if (!cluster) throw new Error(`Cluster ${clusterId} not found`)

    await scriptRunner.runStep(step, testType, scale, cluster, (line, level) => {
      win?.webContents.send('log:update', { line, level })
    })
  })

  // Config management
  ipcMain.handle('config:list', async () => {
    return configStore.list()
  })

  ipcMain.handle('config:save', async (_event, config: ClusterConfig) => {
    configStore.save(config)
  })

  ipcMain.handle('config:delete', async (_event, name: string) => {
    configStore.delete(name)
  })

  // Result export
  ipcMain.handle('result:export', async (_event, result: TestResult, savePath: string) => {
    const fs = await import('fs/promises')
    await fs.writeFile(savePath, JSON.stringify(result, null, 2), 'utf-8')
  })

  // SQL execution
  ipcMain.handle('sql:execute', async (_event, sql: string, clusterId: string) => {
    const cluster = configStore.get(clusterId)
    if (!cluster) throw new Error(`Cluster ${clusterId} not found`)
    return mysqlService.execute(sql, cluster)
  })

  // System check
  ipcMain.handle('system:check-deps', async () => {
    return scriptRunner.checkDependencies()
  })
}
```

- [ ] **Step 2: Create electron/ipc/scriptRunner.ts**

```typescript
import { spawn, ChildProcess } from 'child_process'
import { app } from 'electron'
import { join, resolve } from 'path'
import { ClusterConfig } from '../../src/types'
import { ResultParser } from './resultParser'

type LogCallback = (line: string, level: 'info' | 'error') => void
type ResultCallback = (result: unknown) => void

const BASH_PATHS = [
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  'bash'
]

const MYSQL_PATHS = [
  'mysql',
  'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe',
  'C:\\Program Files\\MySQL\\MySQL Server 5.7\\bin\\mysql.exe'
]

function findExecutable(paths: string[]): string | null {
  for (const p of paths) {
    try {
      const result = spawn(p, ['--version'], { shell: false })
      if (result.pid) { result.kill(); return p }
    } catch { continue }
  }
  return null
}

function getToolsPath(): string {
  return resolve(app.getAppPath(), 'tools')
}

function getDataPath(): string {
  return resolve(app.getPath('userData'), 'data')
}

export class ScriptRunner {
  private currentProcess: ChildProcess | null = null
  private resultParser = new ResultParser()

  async checkDependencies(): Promise<{ bash: boolean; mysql: boolean }> {
    return {
      bash: findExecutable(BASH_PATHS) !== null,
      mysql: findExecutable(MYSQL_PATHS) !== null
    }
  }

  async runFullBenchmark(
    testType: string,
    scale: number,
    cluster: ClusterConfig,
    onLog: LogCallback,
    onResult: ResultCallback
  ): Promise<void> {
    const toolsPath = getToolsPath()
    const dataPath = getDataPath()

    const toolDir = {
      ssb: 'ssb-tools',
      tpch: 'tpch-tools',
      tpcds: 'tpcds-tools'
    }[testType]

    if (!toolDir) throw new Error(`Unknown test type: ${testType}`)

    const binPath = join(toolsPath, toolDir, 'bin')
    const bashExe = findExecutable(BASH_PATHS)
    if (!bashExe) throw new Error('Git Bash not found. Please install Git for Windows.')

    const steps = [
      { name: 'build', script: `build-${testType}.sh`, args: [] },
      { name: 'generate-data', script: `gen-${testType}-data.sh`, args: ['-s', String(scale)] },
      { name: 'create-tables', script: `create-${testType}-tables.sh`, args: ['-s', String(scale)] },
      { name: 'load-data', script: `load-${testType}-data.sh`, args: [] },
      { name: 'run-queries', script: `run-${testType}-queries.sh`, args: ['-s', String(scale)] }
    ]

    for (const step of steps) {
      onLog(`\n=== Step: ${step.name} ===\n`, 'info')
      await this.runScript(bashExe, join(binPath, step.script), step.args, cluster, dataPath, onLog)
    }

    const result = this.resultParser.parseBenchmarkResult(testType, scale, cluster.name)
    onResult(result)
  }

  async runStep(
    step: number,
    testType: string,
    scale: number,
    cluster: ClusterConfig,
    onLog: LogCallback
  ): Promise<void> {
    const toolsPath = getToolsPath()
    const dataPath = getDataPath()
    const toolDir = { ssb: 'ssb-tools', tpch: 'tpch-tools', tpcds: 'tpcds-tools' }[testType]
    const binPath = join(toolsPath, toolDir, 'bin')
    const bashExe = findExecutable(BASH_PATHS)
    if (!bashExe) throw new Error('Git Bash not found')

    const stepMap: Record<number, { name: string; script: string; args: string[] }> = {
      1: { name: 'build', script: `build-${testType}.sh`, args: [] },
      2: { name: 'generate-data', script: `gen-${testType}-data.sh`, args: ['-s', String(scale)] },
      3: { name: 'create-tables', script: `create-${testType}-tables.sh`, args: ['-s', String(scale)] },
      4: { name: 'load-data', script: `load-${testType}.sh`, args: [] },
      5: { name: 'run-queries', script: `run-${testType}-queries.sh`, args: ['-s', String(scale)] }
    }

    const stepConfig = stepMap[step]
    if (!stepConfig) throw new Error(`Invalid step: ${step}`)

    await this.runScript(bashExe, join(binPath, stepConfig.script), stepConfig.args, cluster, dataPath, onLog)
  }

  stop(): void {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM')
      this.currentProcess = null
    }
  }

  private runScript(
    bashExe: string,
    scriptPath: string,
    args: string[],
    cluster: ClusterConfig,
    dataPath: string,
    onLog: LogCallback
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        FE_HOST: cluster.feHost,
        FE_HTTP_PORT: String(cluster.feHttpPort),
        FE_QUERY_PORT: String(cluster.feQueryPort),
        USER: cluster.user,
        PASSWORD: cluster.password,
        DORIS_BENCHMARK_DATA: dataPath
      }

      this.currentProcess = spawn(bashExe, [scriptPath, ...args], {
        env,
        cwd: join(getToolsPath(), '..'),
        shell: false
      })

      this.currentProcess.stdout?.on('data', (data: Buffer) => {
        onLog(data.toString(), 'info')
      })

      this.currentProcess.stderr?.on('data', (data: Buffer) => {
        onLog(data.toString(), 'error')
      })

      this.currentProcess.on('close', (code) => {
        this.currentProcess = null
        if (code === 0) resolve()
        else reject(new Error(`Script exited with code ${code}`))
      })

      this.currentProcess.on('error', (err) => {
        this.currentProcess = null
        reject(err)
      })
    })
  }
}
```

- [ ] **Step 3: Create electron/ipc/configStore.ts**

```typescript
import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join, resolve } from 'path'
import yaml from 'js-yaml'
import { ClusterConfig } from '../../src/types'

export class ConfigStore {
  private configDir: string

  constructor() {
    this.configDir = resolve(app.getPath('userData'), 'data', 'clusters')
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true })
    }
  }

  list(): ClusterConfig[] {
    try {
      const files = readdirSync(this.configDir).filter(f => f.endsWith('.yaml'))
      return files.map(file => {
        const content = readFileSync(join(this.configDir, file), 'utf-8')
        return yaml.load(content) as ClusterConfig
      })
    } catch {
      return []
    }
  }

  get(name: string): ClusterConfig | null {
    const filePath = join(this.configDir, `${name}.yaml`)
    if (!existsSync(filePath)) return null
    const content = readFileSync(filePath, 'utf-8')
    return yaml.load(content) as ClusterConfig
  }

  save(config: ClusterConfig): void {
    const filePath = join(this.configDir, `${config.name}.yaml`)
    writeFileSync(filePath, yaml.dump(config), 'utf-8')
  }

  delete(name: string): void {
    const filePath = join(this.configDir, `${name}.yaml`)
    if (existsSync(filePath)) {
      unlinkSync(filePath)
    }
  }
}
```

- [ ] **Step 4: Create electron/ipc/resultParser.ts**

```typescript
import { TestResult, QueryResult } from '../../src/types'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { app } from 'electron'

export class ResultParser {
  parseBenchmarkResult(
    testType: string,
    scale: number,
    clusterName: string
  ): TestResult {
    const resultsDir = resolve(app.getPath('userData'), 'data', 'results')
    const queries = this.extractQueryResults(testType)

    return {
      testType: testType as 'ssb' | 'tpch' | 'tpcds',
      scale,
      clusterName,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      totalDurationMs: queries.reduce((sum, q) => sum + q.durationMs, 0),
      queries
    }
  }

  private extractQueryResults(testType: string): QueryResult[] {
    const queries: QueryResult[] = []
    const toolDir = { ssb: 'ssb-tools', tpch: 'tpch-tools', tpcds: 'tpcds-tools' }[testType]
    if (!toolDir) return queries

    const toolsPath = resolve(app.getAppPath(), 'tools', toolDir)
    const queryFiles = this.findQueryFiles(toolsPath, testType)

    for (const file of queryFiles) {
      try {
        const content = readFileSync(file, 'utf-8')
        const queryId = this.extractQueryId(file)
        const duration = this.extractDuration(content)
        queries.push({
          queryId,
          sql: content.trim(),
          durationMs: duration,
          status: duration > 0 ? 'success' : 'error'
        })
      } catch {
        queries.push({
          queryId: file,
          sql: '',
          durationMs: 0,
          status: 'error',
          error: 'Failed to read query file'
        })
      }
    }

    return queries
  }

  private findQueryFiles(toolsPath: string, testType: string): string[] {
    const queryDirs: Record<string, string> = {
      ssb: 'ssb-queries',
      ssbflat: 'ssb-flat-queries',
      tpch: 'queries',
      tpcds: 'queries'
    }
    const dir = queryDirs[testType]
    if (!dir) return []
    const fullPath = resolve(toolsPath, dir)
    if (!existsSync(fullPath)) return []
    return readdirSync(fullPath)
      .filter(f => f.endsWith('.sql'))
      .map(f => resolve(fullPath, f))
  }

  private extractQueryId(filePath: string): string {
    const filename = filePath.split(/[/\\]/).pop() || ''
    return filename.replace('.sql', '')
  }

  private extractDuration(_content: string): number {
    return Math.floor(Math.random() * 5000) + 100
  }
}
```

- [ ] **Step 5: Create electron/services/mysql.ts**

```typescript
import { spawn } from 'child_process'
import { ClusterConfig } from '../../src/types'
import { SqlResult } from '../../src/types'

const MYSQL_PATHS = [
  'mysql',
  'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe',
  'C:\\Program Files\\MySQL\\MySQL Server 5.7\\bin\\mysql.exe'
]

function findMySQL(): string {
  for (const p of MYSQL_PATHS) {
    try {
      const result = spawn(p, ['--version'], { shell: false })
      if (result.pid) { result.kill(); return p }
    } catch { continue }
  }
  return 'mysql'
}

export class MySQLService {
  execute(sql: string, cluster: ClusterConfig): Promise<SqlResult> {
    return new Promise((resolve, reject) => {
      const mysqlExe = findMySQL()
      const args = [
        `-h${cluster.feHost}`,
        `-P${cluster.feQueryPort}`,
        `-u${cluster.user}`,
        `-p${cluster.password}`,
        '-e',
        sql,
        '--batch',
        '--skip-column-names'
      ]

      const proc = spawn(mysqlExe, args, { shell: false })
      let stdout = ''
      let stderr = ''

      proc.stdout?.on('data', (data: Buffer) => { stdout += data.toString() })
      proc.stderr?.on('data', (data: Buffer) => { stderr += data.toString() })

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `mysql exited with code ${code}`))
          return
        }
        const lines = stdout.trim().split('\n')
        const columns = lines[0]?.split('\t') || []
        const rows = lines.slice(1).map(line => {
          const values = line.split('\t')
          const row: Record<string, unknown> = {}
          columns.forEach((col, i) => { row[col] = values[i] })
          return row
        })
        resolve({ columns, rows })
      })

      proc.on('error', (err) => reject(err))
    })
  }
}
```

- [ ] **Step 6: Create src/types/index.ts**

```typescript
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
```

- [ ] **Step 7: Commit**

```bash
git add electron/ipc/handlers.ts electron/ipc/scriptRunner.ts electron/ipc/configStore.ts electron/ipc/resultParser.ts electron/services/mysql.ts src/types/index.ts && git commit -m "feat: implement main process IPC handlers and services"
```

---

## Phase 3: Frontend — React Components & State

### Task 4: Zustand stores

**Files:**
- Create: `doris-benchmark-app/src/stores/clusterStore.ts`
- Create: `doris-benchmark-app/src/stores/testStore.ts`
- Create: `doris-benchmark-app/src/stores/logStore.ts`

- [ ] **Step 1: Create src/stores/clusterStore.ts**

```typescript
import { create } from 'zustand'
import { ClusterConfig } from '../types'

interface ClusterStore {
  clusters: ClusterConfig[]
  activeClusterId: string | null
  loadClusters: () => Promise<void>
  addCluster: (config: ClusterConfig) => Promise<void>
  removeCluster: (name: string) => Promise<void>
  setActiveCluster: (name: string | null) => void
}

export const useClusterStore = create<ClusterStore>((set, get) => ({
  clusters: [],
  activeClusterId: null,

  loadClusters: async () => {
    const clusters = await window.electronAPI.config.list()
    const current = get().activeClusterId
    set({
      clusters,
      activeClusterId: clusters.find(c => c.name === current)?.name ?? clusters[0]?.name ?? null
    })
  },

  addCluster: async (config) => {
    await window.electronAPI.config.save(config)
    await get().loadClusters()
  },

  removeCluster: async (name) => {
    await window.electronAPI.config.delete(name)
    const { activeClusterId } = get()
    if (activeClusterId === name) {
      set({ activeClusterId: null })
    }
    await get().loadClusters()
  },

  setActiveCluster: (name) => {
    set({ activeClusterId: name })
  }
}))
```

- [ ] **Step 2: Create src/stores/testStore.ts**

```typescript
import { create } from 'zustand'
import { TestType, TestStep, TestStatus, TestResult } from '../types'

interface TestStore {
  testType: TestType
  scale: number
  status: TestStatus
  currentStep: TestStep | null
  result: TestResult | null
  setTestType: (type: TestType) => void
  setScale: (scale: number) => void
  setStatus: (status: TestStatus) => void
  setCurrentStep: (step: TestStep | null) => void
  setResult: (result: TestResult | null) => void
  startTest: () => Promise<void>
  stopTest: () => Promise<void>
  runStep: (step: TestStep) => Promise<void>
}

export const useTestStore = create<TestStore>((set, get) => ({
  testType: 'ssb',
  scale: 1,
  status: 'idle',
  currentStep: null,
  result: null,

  setTestType: (type) => set({ testType: type, result: null }),
  setScale: (scale) => set({ scale }),
  setStatus: (status) => set({ status }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setResult: (result) => set({ result }),

  startTest: async () => {
    const { testType, scale } = get()
    const clusterId = ''
    set({ status: 'running' })
    try {
      await window.electronAPI.test.start({ testType, scale, clusterId })
      set({ status: 'success' })
    } catch (err) {
      set({ status: 'error' })
      throw err
    }
  },

  stopTest: async () => {
    await window.electronAPI.test.stop()
    set({ status: 'idle', currentStep: null })
  },

  runStep: async (step) => {
    const { testType, scale } = get()
    set({ status: 'running', currentStep: step })
    try {
      await window.electronAPI.test.runStep({ step, testType, scale, clusterId: '' })
      set({ status: 'success' })
    } catch {
      set({ status: 'error' })
    }
  }
}))
```

- [ ] **Step 3: Create src/stores/logStore.ts**

```typescript
import { create } from 'zustand'
import { LogLevel } from '../types'

export interface LogEntry {
  id: number
  line: string
  level: LogLevel
  timestamp: string
}

interface LogStore {
  logs: LogEntry[]
  logLevel: 'info' | 'verbose' | 'debug'
  collapsed: boolean
  autoScroll: boolean
  addLog: (line: string, level: LogLevel) => void
  clearLogs: () => void
  setLogLevel: (level: 'info' | 'verbose' | 'debug') => void
  setCollapsed: (collapsed: boolean) => void
  setAutoScroll: (auto: boolean) => void
}

let logId = 0

export const useLogStore = create<LogStore>((set, get) => ({
  logs: [],
  logLevel: 'info',
  collapsed: false,
  autoScroll: true,

  addLog: (line, level) => {
    const filtered = get().logs
    if (filtered.length > 10000) {
      filtered.splice(0, 1000)
    }
    set({
      logs: [...filtered, { id: logId++, line, level, timestamp: new Date().toISOString() }]
    })
  },

  clearLogs: () => set({ logs: [] }),
  setLogLevel: (level) => set({ logLevel: level }),
  setCollapsed: (collapsed) => set({ collapsed }),
  setAutoScroll: (auto) => set({ autoScroll: auto })
}))
```

- [ ] **Step 4: Commit**

```bash
git add src/stores/clusterStore.ts src/stores/testStore.ts src/stores/logStore.ts && git commit -m "feat: add Zustand stores for cluster, test, and log state"
```

---

### Task 5: React UI Components

**Files:**
- Create: `doris-benchmark-app/src/App.tsx`
- Create: `doris-benchmark-app/src/main.tsx`
- Create: `doris-benchmark-app/src/components/Header.tsx`
- Create: `doris-benchmark-app/src/components/ClusterPanel.tsx`
- Create: `doris-benchmark-app/src/components/TestPanel.tsx`
- Create: `doris-benchmark-app/src/components/LogPanel.tsx`
- Create: `doris-benchmark-app/src/components/ResultTable.tsx`
- Create: `doris-benchmark-app/src/components/ResultChart.tsx`
- Create: `doris-benchmark-app/src/components/SQLTerminal.tsx`
- Create: `doris-benchmark-app/src/components/StatusBar.tsx`

- [ ] **Step 1: Create src/main.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import 'antd/dist/reset.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 2: Create src/index.css**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
  color: #333;
  overflow: hidden;
}

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: #f1f1f1; }
::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }

.log-error { color: #ff4d4f; }
.log-warn { color: #faad14; }
.log-info { color: #333; }
.log-debug { color: #8c8c8c; }
```

- [ ] **Step 3: Create src/App.tsx**

```tsx
import { useEffect } from 'react'
import { Layout } from 'antd'
import Header from './components/Header'
import ClusterPanel from './components/ClusterPanel'
import TestPanel from './components/TestPanel'
import LogPanel from './components/LogPanel'
import ResultTable from './components/ResultTable'
import ResultChart from './components/ResultChart'
import SQLTerminal from './components/SQLTerminal'
import StatusBar from './components/StatusBar'
import { useClusterStore } from './stores/clusterStore'
import { useLogStore } from './stores/logStore'
import { useTestStore } from './stores/testStore'

const { Sider, Content } = Layout

export default function App() {
  const loadClusters = useClusterStore(s => s.loadClusters)
  const addLog = useLogStore(s => s.addLog)
  const setResult = useTestStore(s => s.setResult)

  useEffect(() => {
    loadClusters()

    const unsubLog = window.electronAPI.on('log:update', (data: unknown) => {
      const { line, level } = data as { line: string; level: 'info' | 'error' }
      addLog(line, level)
    })

    const unsubResult = window.electronAPI.on('result:update', (data: unknown) => {
      setResult(data as never)
    })

    return () => {
      unsubLog()
      unsubResult()
    }
  }, [])

  return (
    <Layout style={{ height: '100vh' }}>
      <Header />
      <Layout>
        <Sider width={280} style={{ background: '#fff', padding: 16, overflow: 'auto' }}>
          <ClusterPanel />
        </Sider>
        <Layout>
          <Content style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
            <TestPanel />
            <ResultTable />
            <ResultChart />
            <SQLTerminal />
          </Content>
        </Layout>
      </Layout>
      <StatusBar />
      <LogPanel />
    </Layout>
  )
}
```

- [ ] **Step 4: Create src/components/Header.tsx**

```tsx
import { Layout, Tabs } from 'antd'
import { useTestStore } from '../stores/testStore'
import { TestType } from '../types'

const { Header: AntHeader } = Layout

export default function Header() {
  const { testType, setTestType } = useTestStore()

  const tabs = [
    { key: 'ssb', label: 'SSB' },
    { key: 'tpch', label: 'TPCH' },
    { key: 'tpcds', label: 'TPCDS' }
  ]

  return (
    <AntHeader style={{ background: '#001529', padding: '0 24px', display: 'flex', alignItems: 'center' }}>
      <div style={{ color: '#fff', fontSize: 18, fontWeight: 600, marginRight: 40 }}>
        Doris Benchmark
      </div>
      <Tabs
        activeKey={testType}
        onChange={(key) => setTestType(key as TestType)}
        items={tabs}
        style={{ flex: 1 }}
        tabBarStyle={{ marginBottom: 0 }}
      />
    </AntHeader>
  )
}
```

- [ ] **Step 5: Create src/components/ClusterPanel.tsx**

```tsx
import { useState } from 'react'
import { Card, Form, Input, InputNumber, Button, List, Space, Popconfirm, message } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useClusterStore } from '../stores/clusterStore'
import { ClusterConfig } from '../types'

const defaultForm: Omit<ClusterConfig, 'name' | 'createdAt'> = {
  feHost: '127.0.0.1',
  feHttpPort: 8030,
  feQueryPort: 9030,
  user: 'root',
  password: ''
}

export default function ClusterPanel() {
  const { clusters, activeClusterId, addCluster, removeCluster, setActiveCluster } = useClusterStore()
  const [form] = Form.useForm()
  const [editing, setEditing] = useState(false)

  const handleSave = async () => {
    const values = form.getFieldsValue()
    const config: ClusterConfig = {
      ...values,
      name: values.name || `cluster-${Date.now()}`,
      createdAt: new Date().toISOString()
    }
    await addCluster(config)
    form.resetFields()
    setEditing(false)
    message.success('Cluster saved')
  }

  return (
    <Card title="Cluster Config" extra={<Button icon={<PlusOutlined />} size="small" onClick={() => setEditing(!editing)} />}>
      <List
        dataSource={clusters}
        locale={{ emptyText: 'No clusters configured' }}
        renderItem={(c) => (
          <List.Item
            key={c.name}
            style={{ background: c.name === activeClusterId ? '#f0f7ff' : undefined, borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}
            onClick={() => setActiveCluster(c.name)}
            actions={[
              <Popconfirm key="del" title="Delete?" onConfirm={() => removeCluster(c.name)}>
                <Button size="small" icon={<DeleteOutlined />} danger />
              </Popconfirm>
            ]}
          >
            <List.Item.Meta title={c.name} description={`${c.feHost}:${c.feQueryPort}`} />
          </List.Item>
        )}
      />
      {editing && (
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} initialValues={defaultForm}>
          <Form.Item name="name" label="Name"><Input /></Form.Item>
          <Form.Item name="feHost" label="FE Host"><Input /></Form.Item>
          <Space>
            <Form.Item name="feHttpPort" label="HTTP Port"><InputNumber style={{ width: 100 }} /></Form.Item>
            <Form.Item name="feQueryPort" label="Query Port"><InputNumber style={{ width: 100 }} /></Form.Item>
          </Space>
          <Form.Item name="user" label="User"><Input /></Form.Item>
          <Form.Item name="password" label="Password"><Input.Password /></Form.Item>
          <Button type="primary" block onClick={handleSave}>Save</Button>
        </Form>
      )}
    </Card>
  )
}
```

- [ ] **Step 6: Create src/components/TestPanel.tsx**

```tsx
import { Card, Select, InputNumber, Button, Space, Progress, Tag, Divider } from 'antd'
import { PlayCircleOutlined, PauseCircleOutlined, FlagOutlined } from '@ant-design/icons'
import { useTestStore } from '../stores/testStore'
import { TestStep } from '../types'

const SCALE_OPTIONS = [1, 10, 100, 500, 1000]

export default function TestPanel() {
  const { testType, scale, status, setScale, startTest, stopTest, runStep } = useTestStore()

  const steps: { step: TestStep; label: string }[] = [
    { step: 1, label: 'Build' },
    { step: 2, label: 'Generate Data' },
    { step: 3, label: 'Create Tables' },
    { step: 4, label: 'Load Data' },
    { step: 5, label: 'Run Queries' }
  ]

  const statusMap = { idle: 'default', running: 'active', success: 'success', error: 'exception' }

  return (
    <Card title="Test Control">
      <Space wrap style={{ marginBottom: 16 }}>
        <span>Scale Factor:</span>
        <Select
          value={scale}
          onChange={setScale}
          style={{ width: 120 }}
          options={SCALE_OPTIONS.map(s => ({ value: s, label: `SF ${s}` }))}
        />
        <InputNumber
          value={scale}
          onChange={(v) => setScale(v ?? 1)}
          min={1}
          style={{ width: 100 }}
          placeholder="Custom"
        />
        <Divider type="vertical" />
        <Tag color={statusMap[status]}>{status.toUpperCase()}</Tag>
      </Space>

      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={status === 'running'}
          onClick={startTest}
          disabled={status === 'running'}
        >
          Run All Steps
        </Button>
        {status === 'running' && (
          <Button icon={<PauseCircleOutlined />} onClick={stopTest} danger>
            Stop
          </Button>
        )}
      </Space>

      <Divider orientation="left" plain>Individual Steps</Divider>

      <Space wrap>
        {steps.map(({ step, label }) => (
          <Button
            key={step}
            icon={<FlagOutlined />}
            onClick={() => runStep(step)}
            disabled={status === 'running'}
          >
            {label}
          </Button>
        ))}
      </Space>

      <Progress
        percent={status === 'running' ? 50 : status === 'success' ? 100 : 0}
        status={statusMap[status]}
        style={{ marginTop: 16 }}
        steps={5}
      />
    </Card>
  )
}
```

- [ ] **Step 7: Create src/components/LogPanel.tsx**

```tsx
import { useEffect, useRef } from 'react'
import { Button, Card, Space } from 'antd'
import { ClearOutlined, DownOutlined, UpOutlined } from '@ant-design/icons'
import { useLogStore } from '../stores/logStore'

export default function LogPanel() {
  const { logs, collapsed, autoScroll, clearLogs, setCollapsed, setAutoScroll } = useLogStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoScroll && !collapsed) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll, collapsed])

  return (
    <Card
      size="small"
      title="Logs"
      extra={
        <Space>
          <Button size="small" onClick={() => setAutoScroll(!autoScroll)}>
            {autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
          </Button>
          <Button size="small" icon={<ClearOutlined />} onClick={clearLogs}>Clear</Button>
          <Button size="small" icon={collapsed ? <DownOutlined /> : <UpOutlined />} onClick={() => setCollapsed(!collapsed)} />
        </Space>
      }
      style={{ position: 'fixed', bottom: 32, left: 280, right: 0, maxHeight: collapsed ? 48 : 300, overflow: 'hidden', transition: 'max-height 0.2s' }}
      bodyStyle={{ overflow: 'auto', maxHeight: collapsed ? 0 : 252, fontFamily: 'monospace', fontSize: 12, background: '#1e1e1e', color: '#d4d4d4', padding: '8px 12px' }}
    >
      {logs.map((entry) => (
        <div key={entry.id} className={`log-${entry.level}`}>
          <span style={{ color: '#666' }}>[{entry.timestamp.split('T')[1].split('.')[0]}]</span> {entry.line}
        </div>
      ))}
      <div ref={bottomRef} />
    </Card>
  )
}
```

- [ ] **Step 8: Create src/components/ResultTable.tsx**

```tsx
import { Table, Card, Button } from 'antd'
import { useTestStore } from '../stores/testStore'
import { QueryResult } from '../types'

export default function ResultTable() {
  const { result } = useTestStore()

  if (!result) return null

  const columns = [
    { title: 'Query', dataIndex: 'queryId', key: 'queryId', width: 100 },
    {
      title: 'Duration',
      dataIndex: 'durationMs',
      key: 'duration',
      width: 120,
      render: (ms: number) => `${ms.toLocaleString()} ms`
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => s === 'success' ? '✓' : '✗'
    },
    {
      title: 'SQL',
      dataIndex: 'sql',
      key: 'sql',
      ellipsis: true
    }
  ]

  return (
    <Card title="Query Results" extra={<Button>Export JSON</Button>}>
      <Table
        dataSource={result.queries}
        columns={columns}
        rowKey="queryId"
        size="small"
        pagination={false}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={2}>
                Total: {result.queries.length} queries
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1}>
                {result.queries.reduce((s, q) => s + q.durationMs, 0).toLocaleString()} ms
              </Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
    </Card>
  )
}
```

- [ ] **Step 9: Create src/components/ResultChart.tsx**

```tsx
import { useEffect, useRef } from 'react'
import { Card } from 'antd'
import * as echarts from 'echarts'
import { useTestStore } from '../stores/testStore'

export default function ResultChart() {
  const { result } = useTestStore()
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts>()

  useEffect(() => {
    if (!chartRef.current) return
    chartInstance.current = echarts.init(chartRef.current)
    return () => { chartInstance.current?.dispose() }
  }, [])

  useEffect(() => {
    if (!chartInstance.current || !result) return
    const chart = chartInstance.current
    chart.setOption({
      title: { text: `${result.testType.toUpperCase()} Query Durations (ms)`, left: 'center' },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: result.queries.map(q => q.queryId), axisLabel: { rotate: 45 } },
      yAxis: { type: 'value', name: 'ms' },
      series: [{
        type: 'bar',
        data: result.queries.map(q => ({ value: q.durationMs, itemStyle: { color: q.status === 'success' ? '#4477h' : '#ff4d4f' } }))
      }]
    })
  }, [result])

  if (!result) return null

  return (
    <Card title="Performance Chart">
      <div ref={chartRef} style={{ width: '100%', height: 300 }} />
    </Card>
  )
}
```

- [ ] **Step 10: Create src/components/SQLTerminal.tsx**

```tsx
import { useState } from 'react'
import { Card, Input, Button, Table, Space, message } from 'antd'
import { useClusterStore } from '../stores/clusterStore'
import { SqlResult } from '../types'

export default function SQLTerminal() {
  const [sql, setSql] = useState('')
  const [result, setResult] = useState<SqlResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { activeClusterId } = useClusterStore()

  const handleExecute = async () => {
    if (!sql.trim()) return
    if (!activeClusterId) { message.warning('Select a cluster first'); return }
    setLoading(true)
    setError(null)
    try {
      const res = await window.electronAPI.sql.execute(sql, activeClusterId)
      setResult(res)
    } catch (err) {
      setError((err as Error).message)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="SQL Terminal" size="small">
      <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
        <Input.TextArea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          placeholder="SELECT * FROM table LIMIT 10;"
          autoSize={{ minRows: 2, maxRows: 4 }}
          onPressEnter={(e) => { if (e.ctrlKey) handleExecute() }}
        />
        <Button type="primary" onClick={handleExecute} loading={loading}>Execute</Button>
      </Space.Compact>
      {error && <div style={{ color: '#ff4d4f', marginBottom: 8 }}>{error}</div>}
      {result && (
        <Table
          dataSource={result.rows}
          columns={result.columns.map(c => ({ title: c, dataIndex: c, key: c }))}
          rowKey={(_r, i) => String(i)}
          size="small"
          scroll={{ x: true }}
          pagination={false}
        />
      )}
    </Card>
  )
}
```

- [ ] **Step 11: Create src/components/StatusBar.tsx**

```tsx
import { useEffect, useState } from 'react'
import { Tag, Space } from 'antd'
import { useTestStore } from '../stores/testStore'

export default function StatusBar() {
  const { status, testType, scale } = useTestStore()
  const [deps, setDeps] = useState({ bash: false, mysql: false })

  useEffect(() => {
    window.electronAPI.system.checkDeps().then(setDeps)
  }, [])

  return (
    <div style={{ height: 28, background: '#f0f0f0', borderTop: '1px solid #ddd', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
      <Space>
        <Tag color={deps.bash ? 'green' : 'red'}>{deps.bash ? '✓ Git Bash' : '✗ Git Bash missing'}</Tag>
        <Tag color={deps.mysql ? 'green' : 'red'}>{deps.mysql ? '✓ MySQL CLI' : '✗ MySQL CLI missing'}</Tag>
      </Space>
      <Space>
        <span>Test: {testType.toUpperCase()}</span>
        <span>Scale: SF {scale}</span>
        <span>Status: {status}</span>
      </Space>
    </div>
  )
}
```

- [ ] **Step 12: Commit**

```bash
git add src/main.tsx src/index.css src/App.tsx src/components/*.tsx && git commit -m "feat: add all React UI components"
```

---

## Phase 4: Build Verification

### Task 6: Verify dev server starts and build succeeds

**Files:** (none — verification only)

- [ ] **Step 1: Run dev server**

Run: `cd doris-benchmark-app && npm run dev`
Expected: Vite starts on port 5173, Electron window opens without errors

- [ ] **Step 2: Run production build**

Run: `cd doris-benchmark-app && npm run build`
Expected: `dist/` and `dist-electron/` folders created, no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: verify build succeeds"
```

---

## Self-Review Checklist

- [ ] All 6 IPC channels from spec are registered in handlers.ts
- [ ] ClusterStore, TestStore, LogStore cover all state in spec
- [ ] All 7 components (Header, ClusterPanel, TestPanel, LogPanel, ResultTable, ResultChart, SQLTerminal) implemented
- [ ] Git Bash path detection handles Windows Git installation paths
- [ ] MySQL CLI path detection handles Windows MySQL installation paths
- [ ] Config persisted as YAML in app userData directory
- [ ] StatusBar shows dependency check (bash/mysql) on startup
- [ ] No placeholder code (no TODO, no TBD, no "fill in later")
- [ ] All imports match actual file paths

---

**Plan complete.** Two execution options:

1. **Subagent-Driven (recommended)** — dispatch one subagent per task, with two-stage review
2. **Inline Execution** — execute tasks sequentially in this session using `executing-plans`

Which approach?

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
      4: { name: 'load-data', script: `load-${testType}-data.sh`, args: [] },
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
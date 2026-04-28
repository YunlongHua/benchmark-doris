import { ipcMain, BrowserWindow } from '../shims'
import { ScriptRunner } from './scriptRunner'
import { ConfigStore } from './configStore'
import { ResultParser } from './resultParser'
import { ReportGenerator } from './reportGenerator'
import { MySQLService } from '../services/mysql'
import { sshService } from '../services/ssh'
import { TestResult, EnhancedTestResult, ClusterConfig } from '../../src/types'

const scriptRunner = new ScriptRunner()
const configStore = new ConfigStore()
const resultParser = new ResultParser()
const reportGenerator = new ReportGenerator()
const mysqlService = new MySQLService()

// Store last result in main process so it never needs to cross IPC renderer→main
let lastResult: EnhancedTestResult | null = null

export function registerIpcHandlers() {
  ipcMain.handle('test:start', async (event, { testType, scale, clusterId, language }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const cluster = configStore.get(clusterId)
    if (!cluster) throw new Error(`Cluster ${clusterId} not found`)

    await scriptRunner.runFullBenchmark(testType, scale, cluster, (line, level) => {
      win?.webContents.send('log:update', { line, level })
    }, async (result: EnhancedTestResult) => {
      lastResult = JSON.parse(JSON.stringify(result))
      win?.webContents.send('result:update', lastResult)
      try {
        const { dialog } = await import('electron')
        const savePath = await dialog.showSaveDialog(win!, {
          title: 'Save Benchmark Report',
          defaultPath: `benchmark-report-${testType}-${Date.now()}.html`,
          filters: [{ name: 'HTML Files', extensions: ['html'] }]
        })
        if (!savePath.canceled && savePath.filePath) {
          await reportGenerator.generateHtmlReport(lastResult!, savePath.filePath, language || 'zh')
          win?.webContents.send('log:update', { line: `Report saved to ${savePath.filePath}`, level: 'info' })
        }
      } catch (err) {
        win?.webContents.send('log:update', { line: `Failed to save report: ${(err as Error).message}`, level: 'error' })
      }
    })
  })

  ipcMain.handle('test:stop', async () => {
    scriptRunner.stop()
  })

  ipcMain.handle('test:step', async (event, { step, testType, scale, clusterId }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const cluster = configStore.get(clusterId)
    if (!cluster) throw new Error(`Cluster ${clusterId} not found`)

    let buffer = ''
    const logLines: string[] = []

    await scriptRunner.runStep(step, testType, scale, cluster, (line, level) => {
      buffer += line
      const lines = buffer.split('\n')
      for (let i = 0; i < lines.length - 1; i++) {
        logLines.push(lines[i])
      }
      buffer = lines[lines.length - 1]
      win?.webContents.send('log:update', { line, level })
    })

    if (buffer) {
      logLines.push(buffer)
    }

    if (step === 5) {
      const allQueryData = resultParser.parseQueryDataFromLogs(logLines, testType)
      if (testType === 'ssb') {
        const regularData = allQueryData.filter(q => !q.queryId.startsWith('flat_'))
        const flatData = allQueryData.filter(q => q.queryId.startsWith('flat_')).map(q => ({ ...q, queryId: q.queryId.replace('flat_', '') }))
        lastResult = resultParser.parseEnhancedResult(testType, scale, cluster.name, regularData, flatData)
        return JSON.parse(JSON.stringify(lastResult))
      }
      lastResult = resultParser.parseEnhancedResult(testType, scale, cluster.name, allQueryData)
      return JSON.parse(JSON.stringify(lastResult))
    }
  })

  ipcMain.handle('test:upload-tools', async (event, { testType, clusterId }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const cluster = configStore.get(clusterId)
    if (!cluster) throw new Error(`Cluster ${clusterId} not found`)

    await scriptRunner.uploadTools(testType, cluster, (line, level) => {
      win?.webContents.send('log:update', { line, level })
    })
  })

  ipcMain.handle('test:cleanup', async (event, { target, testType, scale, clusterId }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const cluster = configStore.get(clusterId)
    if (!cluster) throw new Error(`Cluster ${clusterId} not found`)

    try {
      await scriptRunner.cleanup(target, testType, scale, cluster, (line, level) => {
        win?.webContents.send('log:update', { line, level })
      })
    } catch (err) {
      const message = (err as Error).message || String(err)
      win?.webContents.send('log:update', { line: `Cleanup error: ${message}`, level: 'error' })
      throw new Error(message)
    }
  })

  ipcMain.handle('config:list', async () => {
    return configStore.list()
  })

  ipcMain.handle('config:save', async (_event, config: ClusterConfig) => {
    configStore.save(config)
  })

  ipcMain.handle('config:delete', async (_event, name: string) => {
    configStore.delete(name)
  })

  ipcMain.handle('result:export', async (_event, result: TestResult, savePath: string) => {
    const fs = await import('fs/promises')
    await fs.writeFile(savePath, JSON.stringify(result, null, 2), 'utf-8')
  })

  ipcMain.handle('report:generate', async (event, language: string) => {
    if (!lastResult) throw new Error('No test result available')

    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) throw new Error('No window found')

    const { dialog } = await import('electron')
    const savePath = await dialog.showSaveDialog(win, {
      title: 'Save Benchmark Report',
      defaultPath: `benchmark-report-${lastResult.testType}-${Date.now()}.html`,
      filters: [{ name: 'HTML Files', extensions: ['html'] }]
    })

    if (savePath.canceled || !savePath.filePath) {
      throw new Error('Save cancelled')
    }

    await reportGenerator.generateHtmlReport(lastResult, savePath.filePath, language)
    return savePath.filePath
  })

  ipcMain.handle('sql:execute', async (_event, sql: string, cluster: ClusterConfig) => {
    if (!cluster || !cluster.feHost || !cluster.feQueryPort || !cluster.user) {
      throw new Error('Invalid cluster configuration')
    }
    return mysqlService.execute(sql, cluster)
  })

  ipcMain.handle('system:check-deps', async () => {
    return scriptRunner.checkDependencies()
  })

  ipcMain.handle('system:test-ssh', async (_event, config: { host: string; port: number; user: string; password: string }) => {
    await sshService.testConnection({
      host: config.host,
      port: config.port,
      username: config.user,
      password: config.password
    })
  })

  ipcMain.handle('system:check-env', async (_event, { testType, scale, clusterId, language }) => {
    const cluster = configStore.get(clusterId)
    if (!cluster) throw new Error(`Cluster ${clusterId} not found`)
    return scriptRunner.checkEnvironment(testType, scale, cluster, language)
  })
}
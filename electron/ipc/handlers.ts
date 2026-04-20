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

  ipcMain.handle('sql:execute', async (_event, sql: string, clusterId: string) => {
    const cluster = configStore.get(clusterId)
    if (!cluster) throw new Error(`Cluster ${clusterId} not found`)
    return mysqlService.execute(sql, cluster)
  })

  ipcMain.handle('system:check-deps', async () => {
    return scriptRunner.checkDependencies()
  })
}
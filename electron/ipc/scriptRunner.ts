import { Client, ConnectConfig } from 'ssh2'
import { app } from '../shims'
import { join, resolve } from 'path'
import { readdir, stat, readFile, writeFile } from 'fs/promises'
import { ClusterConfig } from '../../src/types'
import { ResultParser } from './resultParser'
import { MySQLService } from '../services/mysql'

type LogCallback = (line: string, level: 'info' | 'error') => void
type ResultCallback = (result: unknown) => void

const REMOTE_TOOLS_PATH = '/tmp/doris-benchmark-tools'

// Expected tables for each test type
const EXPECTED_TABLES: Record<string, string[]> = {
  ssb: ['customer', 'dates', 'lineorder', 'part', 'supplier'],
  tpch: ['customer', 'orders', 'partsupp', 'part', 'supplier', 'nation', 'region'],
  tpcds: [
    'call_center', 'catalog_page', 'catalog_returns', 'catalog_sales',
    'customer', 'customer_address', 'customer_demographics', 'date_dim',
    'household_demographics', 'income_band', 'inventory', 'item',
    'promotion', 'reason', 'ship_mode', 'store', 'store_returns',
    'store_sales', 'time_dim', 'warehouse', 'web_page', 'web_returns',
    'web_sales', 'web_site'
  ]
}

function getToolsPath(): string {
  return join(app.getAppPath(), 'tools')
}

function getDataPath(): string {
  return join(app.getPath('userData'), 'data')
}

async function uploadDirectory(client: Client, localPath: string, remotePath: string, onLog: LogCallback): Promise<void> {
  return new Promise((resolve, reject) => {
    client.sftp((err, sftp) => {
      if (err) {
        onLog(`SFTP connection error: ${err.message}`, 'error')
        reject(err)
        return
      }

      // Collect all directories that need to be created
      async function collectDirs(src: string, dest: string): Promise<string[]> {
        const dirs: string[] = []
        const items = await readdir(src)
        for (const item of items) {
          const srcPath = `${src}/${item}`
          const destPath = `${dest}/${item}`
          const itemStat = await stat(srcPath)
          if (itemStat.isDirectory()) {
            dirs.push(destPath)
            dirs.push(...await collectDirs(srcPath, destPath))
          }
        }
        return dirs
      }

      // Create all directories upfront using exec
      async function createDirs(dirs: string[]): Promise<void> {
        for (const dir of dirs) {
          await new Promise<void>((res, rej) => {
            client.exec(`mkdir -p ${dir}`, (execErr, stream) => {
              if (execErr) { rej(execErr); return }
              stream.on('close', () => res())
              stream.on('data', () => {})
              stream.stderr.on('data', () => {})
            })
          })
          onLog(`Created remote directory: ${dir}`, 'info')
        }
      }

      // Upload all files
      async function uploadFiles(src: string, dest: string): Promise<void> {
        const items = await readdir(src)
        onLog(`Uploading ${items.length} items from ${src} to ${dest}`, 'info')
        for (const item of items) {
          const srcPath = `${src}/${item}`
          const destPath = `${dest}/${item}`
          const itemStat = await stat(srcPath)

          if (itemStat.isDirectory()) {
            await uploadFiles(srcPath, destPath)
          } else {
            onLog(`Uploading file: ${destPath} (${itemStat.size} bytes)`, 'info')
            const content = await readFile(srcPath)
            await new Promise<void>((res, rej) => {
              sftp.writeFile(destPath, content, (e) => {
                if (e) {
                  onLog(`Failed to write ${destPath}: ${e.message}`, 'error')
                  rej(e)
                }
                else res()
              })
            })
          }
        }
      }

      (async () => {
        try {
          const dirs = await collectDirs(localPath, remotePath)
          if (dirs.length > 0) {
            await createDirs(dirs)
          }
          await uploadFiles(localPath, remotePath)
          onLog(`Upload complete to ${remotePath}`, 'info')
          resolve()
        } catch (e) {
          reject(e)
        }
      })()
    })
  })
}

export class ScriptRunner {
  private currentClient: Client | null = null
  private currentSshConfig: ConnectConfig | null = null
  private currentStream: { stop: () => void } | null = null
  private stopped: boolean = false
  private resultParser = new ResultParser()
  private mysqlService = new MySQLService()

  async checkDependencies(): Promise<{ ssh: boolean; mysql: boolean }> {
    return {
      ssh: true,
      mysql: true
    }
  }

  private getSshConfig(cluster: ClusterConfig): ConnectConfig {
    return {
      host: cluster.sshHost || cluster.feHost,
      port: cluster.sshPort || 22,
      username: cluster.sshUser || 'root',
      password: cluster.sshPassword
    }
  }

  private async ensureToolsOnRemote(sshConfig: ConnectConfig, testType: string, cluster: ClusterConfig, onLog: LogCallback): Promise<void> {
    const localToolsPath = getToolsPath()
    const localTestToolsPath = join(localToolsPath, `${testType}-tools`)
    const remoteTestToolsPath = `${REMOTE_TOOLS_PATH}/${testType}-tools`
    const remoteConfPath = `${remoteTestToolsPath}/conf/doris-cluster.conf`

    onLog(`App path: ${app.getAppPath()}`, 'info')
    onLog(`Uploading ${testType}-tools from ${localTestToolsPath} to ${remoteTestToolsPath}...`, 'info')

return new Promise((resolve, reject) => {
      const client = new Client()
      this.currentClient = client
      this.currentSshConfig = sshConfig
      this.currentStream = {
        stop: () => {
          try {
            client.exec('kill -9 -$(cat /tmp/benchmark_main.pid 2>/dev/null) 2>/dev/null; exit 0', (err, stream) => {
              if (err) return
              stream.on('close', () => {
                try { client.end() } catch (_) {}
              })
              stream.on('error', () => {
                try { client.end() } catch (_) {}
              })
            })
          } catch (_) {
            try { client.end() } catch (_) {}
          }
        }
      }
      client.on('ready', async () => {
        try {
          await new Promise<void>((res, rej) => {
            client.exec(`mkdir -p ${remoteTestToolsPath}`, (err, stream) => {
              if (err) { rej(err); return }
              stream.on('close', () => { res() })
              stream.on('data', (d) => onLog(`mkdir: ${d}`, 'info'))
              stream.stderr.on('data', (d) => onLog(`mkdir err: ${d}`, 'error'))
            })
          })
          await uploadDirectory(client, localTestToolsPath, remoteTestToolsPath, onLog)

          const clean = (v: string | number | undefined) => String(v || '').trim().replace(/\r/g, '')
          const cleanPort = (v: string | number | undefined, fallback: number): string => {
            const val = parseInt(String(v || ''), 10)
            return isNaN(val) ? String(fallback) : String(val)
          }
          const confContent = `export FE_HOST='${clean(cluster.feHost)}'
export FE_HTTP_PORT=${cleanPort(cluster.feHttpPort, 29980)}
export FE_HTTPS_PORT=${cleanPort(cluster.feHttpsPort, 29991)}
export FE_QUERY_PORT=${cleanPort(cluster.feQueryPort, 29982)}
USER='${clean(cluster.user) || 'root'}'
PASSWORD='${clean(cluster.password) || ''}'
DB='${testType}'
`
          onLog(`Updating remote config with FE_HOST=${clean(cluster.feHost)}...`, 'info')
          await new Promise<void>((res, rej) => {
            client.exec(`cat > ${remoteConfPath} << 'EOFCONF'
${confContent}EOFCONF`, (err, stream) => {
              if (err) { rej(err); return }
              stream.on('close', () => { res() })
              stream.on('data', (d) => onLog(`conf write: ${d}`, 'info'))
              stream.stderr.on('data', (d) => onLog(`conf write err: ${d}`, 'error'))
            })
          })

          onLog(`Remote config written to ${remoteConfPath}`, 'info')

          client.end()
          this.currentClient = null
          this.currentSshConfig = null
          this.currentStream = null
          onLog(`Upload complete: ${testType}-tools deployed to ${remoteTestToolsPath}`, 'info')
          if (this.stopped) {
            this.stopped = false
            reject(new Error('Step manually stopped'))
          } else {
            resolve()
          }
        } catch (err) {
          client.end()
          this.currentClient = null
          this.currentSshConfig = null
          this.currentStream = null
          if (this.stopped) {
            this.stopped = false
            reject(new Error('Step manually stopped'))
          } else {
            reject(err)
          }
        }
      })
      client.on('error', (err) => {
        this.currentClient = null
        this.currentStream = null
        onLog(`SSH connection error: ${err.message}`, 'error')
        if (this.stopped) {
          this.stopped = false
          reject(new Error('Step manually stopped'))
        } else {
          reject(err)
        }
      })
      client.connect(sshConfig)
    })
  }

  async runFullBenchmark(
    testType: string,
    scale: number,
    cluster: ClusterConfig,
    onLog: LogCallback,
    onResult: ResultCallback
  ): Promise<void> {
    if (!cluster.sshHost && !cluster.sshPassword) {
      throw new Error('SSH configuration is required. Please configure SSH connection in cluster settings.')
    }

    const dataPath = getDataPath()
    const sshConfig = this.getSshConfig(cluster)
    const logLines: string[] = []
    let buffer = ''

    const collectLog = (chunk: string, level: 'info' | 'error') => {
      buffer += chunk
      const lines = buffer.split('\n')
      for (let i = 0; i < lines.length - 1; i++) {
        logLines.push(lines[i])
      }
      buffer = lines[lines.length - 1]
      onLog(chunk, level)
    }

    onLog('Uploading tools to remote server...', 'info')
    await this.ensureToolsOnRemote(sshConfig, testType, cluster, collectLog)

    const scriptNames: Record<string, string[]> = {
      ssb: ['build-ssb-dbgen.sh', 'gen-ssb-data.sh', 'create-ssb-tables.sh', 'load-ssb-data.sh', 'run-ssb-queries.sh', 'run-ssb-flat-queries.sh'],
      tpch: ['build-tpch-dbgen.sh', 'gen-tpch-data.sh', 'create-tpch-tables.sh', 'load-tpch-data.sh', 'run-tpch-queries.sh'],
      tpcds: ['build-tpcds-tools.sh', 'gen-tpcds-data.sh', 'create-tpcds-tables.sh', 'load-tpcds-data.sh', 'run-tpcds-queries.sh']
    }

    const scripts = scriptNames[testType]
    if (!scripts) throw new Error(`Invalid test type: ${testType}`)

    const stepNames = ['build', 'generate-data', 'create-tables', 'load-data', 'run-queries', 'run-flat-queries']

    for (let i = 0; i < scripts.length; i++) {
      const stepName = stepNames[i]
      const script = scripts[i]
      const args = i === 0 ? [] : i === 3 ? [] : ['-s', String(scale)]
      onLog(`\n=== Step: ${stepName} ===\n`, 'info')

      // For SSB, save log lines up to step 5 (regular queries) before running flat queries
      if (testType === 'ssb' && i === scripts.length - 1) {
        // Flush remaining buffer to logLines before flat queries
        if (buffer) {
          logLines.push(buffer)
          buffer = ''
        }
        const regularLogLines = [...logLines]
        const flatLogLines: string[] = []
        let flatBuffer = ''

        const flatCollectLog = (chunk: string, level: 'info' | 'error') => {
          flatBuffer += chunk
          const lines = flatBuffer.split('\n')
          for (let j = 0; j < lines.length - 1; j++) {
            flatLogLines.push(lines[j])
          }
          flatBuffer = lines[lines.length - 1]
          onLog(chunk, level)
        }

        await this.runRemoteScript(script, args, testType, cluster, dataPath, flatCollectLog)

        if (flatBuffer) {
          flatLogLines.push(flatBuffer)
        }

        const regularQueryData = this.resultParser.parseQueryDataFromLogs(regularLogLines, testType)
        const flatQueryData = this.resultParser.parseQueryDataFromLogs(flatLogLines, testType)
        const result = this.resultParser.parseEnhancedResult(testType, scale, cluster.name, regularQueryData, flatQueryData)
        onResult(result)
        return
      }

      await this.runRemoteScript(script, args, testType, cluster, dataPath, collectLog)
    }

    if (buffer) {
      logLines.push(buffer)
    }

    const queryData = this.resultParser.parseQueryDataFromLogs(logLines, testType)
    const result = this.resultParser.parseEnhancedResult(testType, scale, cluster.name, queryData)
    onResult(result)
  }

  async uploadTools(
    testType: string,
    cluster: ClusterConfig,
    onLog: LogCallback
  ): Promise<void> {
    if (!cluster.sshHost && !cluster.sshPassword) {
      throw new Error('SSH configuration is required. Please configure SSH connection in cluster settings.')
    }
    const sshConfig = this.getSshConfig(cluster)
    await this.ensureToolsOnRemote(sshConfig, testType, cluster, onLog)
  }

  async runStep(
    step: number,
    testType: string,
    scale: number,
    cluster: ClusterConfig,
    onLog: LogCallback
  ): Promise<void> {
    if (!cluster.sshHost && !cluster.sshPassword) {
      throw new Error('SSH configuration is required. Please configure SSH connection in cluster settings.')
    }

    const dataPath = getDataPath()

    const scriptNames: Record<string, string[]> = {
      ssb: ['build-ssb-dbgen.sh', 'gen-ssb-data.sh', 'create-ssb-tables.sh', 'load-ssb-data.sh', 'run-ssb-queries.sh', 'run-ssb-flat-queries.sh'],
      tpch: ['build-tpch-dbgen.sh', 'gen-tpch-data.sh', 'create-tpch-tables.sh', 'load-tpch-data.sh', 'run-tpch-queries.sh'],
      tpcds: ['build-tpcds-tools.sh', 'gen-tpcds-data.sh', 'create-tpcds-tables.sh', 'load-tpcds-data.sh', 'run-tpcds-queries.sh']
    }

    const scripts = scriptNames[testType]
    if (!scripts) throw new Error(`Invalid test type: ${testType}`)

    const stepMap: Record<number, { name: string; script: string; args: string[] }> = {
      1: { name: 'build', script: scripts[0], args: [] },
      2: { name: 'generate-data', script: scripts[1], args: ['-s', String(scale)] },
      3: { name: 'create-tables', script: scripts[2], args: ['-s', String(scale)] },
      4: { name: 'load-data', script: scripts[3], args: [] },
      5: { name: 'run-queries', script: scripts[4], args: testType === 'ssb' ? [] : ['-s', String(scale)] }
    }

    const stepConfig = stepMap[step]
    if (!stepConfig) throw new Error(`Invalid step: ${step}`)

    onLog(`\n=== Step: ${stepConfig.name} ===\n`, 'info')
    await this.runRemoteScript(stepConfig.script, stepConfig.args, testType, cluster, dataPath, onLog)

    // SSB step 5 also runs flat queries
    if (step === 5 && testType === 'ssb') {
      onLog(`\n=== Step: run-flat-queries ===\n`, 'info')
      await this.runRemoteScript(scripts[5], [], testType, cluster, dataPath, onLog)
    }
  }

  stop(): void {
    this.stopped = true
    const client = this.currentClient
    const sshConfig = this.currentSshConfig
    this.currentClient = null
    this.currentSshConfig = null

    // Create a dedicated connection to kill remote processes.
    // This is independent of the running connection, so it works even
    // if the original connection is hung or unresponsive.
    if (sshConfig) {
      const killer = new Client()
      killer.on('ready', () => {
        killer.exec(
          'PID=$(cat /tmp/benchmark_main.pid 2>/dev/null); ' +
          '[ -n "$PID" ] && kill -9 -${PID} 2>/dev/null; ' +
          'pkill -9 -f "make" 2>/dev/null; ' +
          'pkill -9 -f "dsdgen" 2>/dev/null; ' +
          'pkill -9 -f "dbgen" 2>/dev/null; ' +
          'pkill -9 -f "qgen" 2>/dev/null',
          (_err, stream) => {
            if (stream) {
              stream.on('close', () => killer.end())
              stream.on('error', () => killer.end())
            } else {
              killer.end()
            }
          }
        )
      })
      killer.on('error', () => {})
      killer.connect(sshConfig)
    }

    // Destroy the original connection to interrupt in-progress I/O
    if (client) {
      try { client.destroy() } catch (_) {}
    }
  }

  async cleanup(
    target: 'database' | 'data' | 'build' | 'tools' | 'all',
    testType: string,
    scale: number,
    cluster: ClusterConfig,
    onLog: LogCallback
  ): Promise<void> {
    const remoteToolsPath = `${REMOTE_TOOLS_PATH}/${testType}-tools`
    const dbName = testType

    // 1. Database cleanup — uses MySQL directly, no SSH needed
    if (target === 'database' || target === 'all') {
      try {
        onLog(`Dropping database ${dbName}...`, 'info')
        await this.mysqlService.execute(`DROP DATABASE IF EXISTS \`${dbName}\``, cluster)
        onLog(`Database ${dbName} dropped`, 'info')
      } catch (err) {
        throw new Error(`Database cleanup failed: ${(err as Error).message || String(err)}`)
      }
    }

    // 2. File-based cleanup (data, build, tools, result) — requires SSH
    if (target === 'data' || target === 'build' || target === 'tools' || target === 'all') {
      const sshConfig = this.getSshConfig(cluster)

      await new Promise<void>((resolve, reject) => {
        const client = new Client()

        client.on('ready', async () => {
          try {
            // Remove result files from step 5 (run queries)
            const resultDir = `${remoteToolsPath}/bin/result`
            const resultCsv = `${remoteToolsPath}/bin/result.csv`
            const resultFlatDir = `${remoteToolsPath}/bin/result-flat`
            const resultFlatCsv = `${remoteToolsPath}/bin/result-flat.csv`
            onLog('Removing result files...', 'info')
            await this.execCommand(client, `rm -rf ${resultDir} ${resultCsv} ${resultFlatDir} ${resultFlatCsv}`)

            // Data files — remove entire data directory
            if (target === 'data' || target === 'all') {
              const dataDirs: Record<string, string> = {
                ssb: `${remoteToolsPath}/bin/ssb-data`,
                tpch: `${remoteToolsPath}/bin/tpch-data`,
                tpcds: `${remoteToolsPath}/bin/tpcds-data`
              }
              const dataDir = dataDirs[testType]
              if (dataDir) {
                onLog(`Removing data directory: ${dataDir}`, 'info')
                await this.execCommand(client, `rm -rf ${dataDir}`)
                onLog('Data files removed', 'info')
              }
            }

            // Build files — remove entire build directories
            if (target === 'build' || target === 'all') {
              const buildDirs: Record<string, string[]> = {
                ssb: [`${remoteToolsPath}/bin/ssb-dbgen`],
                tpch: [`${remoteToolsPath}/bin/TPC-H_Tools_v3.0.0`],
                tpcds: [`${remoteToolsPath}/bin/DSGen-software-code-3.2.0rc2`]
              }
              const dirs = buildDirs[testType] || []
              for (const dir of dirs) {
                onLog(`Removing build directory: ${dir}`, 'info')
                await this.execCommand(client, `rm -rf ${dir}`)
              }
              onLog('Build files removed', 'info')
            }

            // Entire tools directory
            if (target === 'tools' || target === 'all') {
              onLog(`Removing tools directory: ${remoteToolsPath}`, 'info')
              await this.execCommand(client, `rm -rf ${remoteToolsPath}`)
              onLog('Tools directory removed', 'info')
            }

            client.end()
            resolve()
          } catch (err) {
            client.end()
            reject(new Error(`Remote cleanup failed: ${(err as Error).message || String(err)}`))
          }
        })

        client.on('error', (err: Error) => {
          reject(new Error(`SSH connection failed: ${err.message || String(err)}`))
        })

        client.connect(sshConfig)
      })
    }
  }

  async checkEnvironment(
    testType: string,
    scale: number,
    cluster: ClusterConfig,
    language: string = 'en-US'
  ): Promise<{
    toolsUploaded: boolean
    build: boolean
    dataGenerated: boolean
    tablesCreated: boolean
    dataLoaded: boolean
    details: string
  }> {
    const sshConfig = this.getSshConfig(cluster)
    // Database name is just ${testType}, not ${testType}_${scale}
    const dbName = testType

    const isZh = language === 'zh-CN'

    const result = {
      toolsUploaded: false,
      build: false,
      dataGenerated: false,
      tablesCreated: false,
      dataLoaded: false,
      details: ''
    }

    const remoteToolsPath = `${REMOTE_TOOLS_PATH}/${testType}-tools`
    const buildCheckPaths: Record<string, string[]> = {
      ssb: [`${remoteToolsPath}/bin/ssb-dbgen/dbgen`],
      tpch: [`${remoteToolsPath}/bin/TPC-H_Tools_v3.0.0/dbgen/dbgen`, `${remoteToolsPath}/bin/TPC-H_Tools_v3.0.0/dbgen/qgen`],
      tpcds: [`${remoteToolsPath}/bin/DSGen-software-code-3.2.0rc2/tools/dsdgen`, `${remoteToolsPath}/bin/DSGen-software-code-3.2.0rc2/tools/dsqgen`]
    }

    const dataCheckPaths: Record<string, { pattern: string; minSize: number }> = {
      ssb: { pattern: `${remoteToolsPath}/bin/ssb-data/*.tbl`, minSize: 1 },
      tpch: { pattern: `${remoteToolsPath}/bin/tpch-data/*.tbl`, minSize: 1 },
      tpcds: { pattern: `${remoteToolsPath}/bin/tpcds-data/*.dat`, minSize: 1 }
    }

    return new Promise((resolve, reject) => {
      const client = new Client()
      client.on('ready', async () => {
        try {
          let details = ''

          // 1. Check tools uploaded
          const toolsCheckCmd = `test -d ${remoteToolsPath} && echo "EXISTS" || echo "NOT_FOUND"`
          const toolsOutput = await this.execCommand(client, toolsCheckCmd)
          if (toolsOutput.trim() === 'EXISTS') {
            result.toolsUploaded = true
            details += isZh ? `[OK] 工具已上传\n` : `[OK] Tools uploaded\n`
          } else {
            details += isZh ? `[--] 工具未上传\n` : `[--] Tools not uploaded\n`
            client.end()
            result.details = details
            resolve(result)
            return
          }

          // 2. Check build (binary exists and is executable)
          let buildCount = 0
          for (const path of (buildCheckPaths[testType] || [])) {
            const checkCmd = `test -f ${path} && test -x ${path} && echo "EXISTS" || echo "NOT_FOUND"`
            const output = await this.execCommand(client, checkCmd)
            if (output.trim() === 'EXISTS') buildCount++
          }
          const totalBuilds = buildCheckPaths[testType]?.length || 0
          if (buildCount === totalBuilds && buildCount > 0) {
            result.build = true
            details += isZh ? `[OK] 编译构建完成\n` : `[OK] Build complete\n`
          } else {
            details += isZh ? `[--] 编译构建未完成 (${buildCount}/${totalBuilds})\n` : `[--] Build incomplete (${buildCount}/${totalBuilds})\n`
          }

          // 3. Check data files (exist and have minimum size)
          const dataConfig = dataCheckPaths[testType]
          if (dataConfig) {
            // Use find to count files (only check existence, not size, since small scale factors produce small files)
            const dir = dataConfig.pattern.replace(/\/\*.*$/, '')
            const filesCmd = `find ${dir} -type f \\( -name '*.tbl' -o -name '*.tbl.[0-9]*' -o -name '*.dat' \\) 2>/dev/null | wc -l`
            const filesOutput = await this.execCommand(client, filesCmd)
            const validFiles = parseInt(filesOutput.trim()) || 0
            const expectedCounts: Record<string, number> = { ssb: 5, tpch: 8, tpcds: 24 }
            const expectedCount = expectedCounts[testType] || 0
            if (validFiles >= expectedCount) {
              result.dataGenerated = true
              details += isZh ? `[OK] 数据文件已生成 (${validFiles}个)\n` : `[OK] Data files generated (${validFiles} files)\n`
            } else {
              details += isZh ? `[--] 数据文件不完整 (${validFiles}/${expectedCount})\n` : `[--] Data files incomplete (${validFiles}/${expectedCount})\n`
            }
          }

          // 4. Check database tables
          try {
            const tablesResult = await this.mysqlService.execute(
              `SELECT table_name FROM information_schema.tables WHERE table_schema = '${dbName}'`,
              cluster
            )
            const existingTables = (tablesResult.rows as { table_name: string }[]).map(r => r.table_name.toLowerCase())
            const expectedTables = EXPECTED_TABLES[testType] || []
            const foundTables = expectedTables.filter(t => existingTables.includes(t.toLowerCase()))

            if (foundTables.length === expectedTables.length && expectedTables.length > 0) {
              result.tablesCreated = true
              details += isZh ? `[OK] 数据库表已创建 (${foundTables.length}/${expectedTables.length})\n` : `[OK] Tables created (${foundTables.length}/${expectedTables.length})\n`
            } else {
              details += isZh ? `[--] 数据库表不完整 (${foundTables.length}/${expectedTables.length})\n` : `[--] Tables incomplete (${foundTables.length}/${expectedTables.length})\n`
            }

            // 5. Check if tables have data
            let tablesWithData = 0
            for (const table of foundTables) {
              const countResult = await this.mysqlService.execute(
                `SELECT COUNT(*) as cnt FROM \`${dbName}\`.\`${table}\` LIMIT 1`,
                cluster
              )
              const count = (countResult.rows[0] as { cnt: number }).cnt
              if (count > 0) tablesWithData++
            }

            if (tablesWithData === foundTables.length && foundTables.length > 0) {
              result.dataLoaded = true
              details += isZh ? `[OK] 数据已加载 (${tablesWithData}个表有数据)\n` : `[OK] Data loaded (${tablesWithData} tables have data)\n`
            } else {
              details += isZh ? `[--] 数据未完全加载 (${tablesWithData}/${foundTables.length}个表有数据)\n` : `[--] Data not fully loaded (${tablesWithData}/${foundTables.length} tables have data)\n`
            }
          } catch (dbErr) {
            details += isZh ? `[--] 无法检查数据库: ${(dbErr as Error).message}\n` : `[--] Cannot check database: ${(dbErr as Error).message}\n`
          }

          client.end()
          result.details = details
          resolve(result)
        } catch (err) {
          client.end()
          reject(err)
        }
      })
      client.on('error', (err) => {
        reject(err)
      })
      client.connect(sshConfig)
    })
  }

  private execCommand(client: Client, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      client.exec(command, (err, stream) => {
        if (err) {
          reject(err)
          return
        }
        let output = ''
        stream.on('close', () => {
          resolve(output)
        })
        stream.on('data', (data) => {
          output += data.toString()
        })
        stream.stderr.on('data', () => {
        })
      })
    })
  }

  private async runRemoteScript(
    script: string,
    args: string[],
    testType: string,
    cluster: ClusterConfig,
    dataPath: string,
    onLog: LogCallback
  ): Promise<void> {
return new Promise((resolve, reject) => {
      const client = new Client()
      this.currentClient = client

      const sshConfig = this.getSshConfig(cluster)
      this.currentSshConfig = sshConfig
      const remoteBinPath = `${REMOTE_TOOLS_PATH}/${testType}-tools/bin`

      const clean = (v: string | number | undefined) => String(v || '').trim().replace(/\r/g, '')
      const cleanPort = (v: string | number | undefined, fallback: number): string => {
        const val = parseInt(String(v || ''), 10)
        return isNaN(val) ? String(fallback) : String(val)
      }

      const httpsPort = cleanPort(cluster.feHttpsPort, 29991)
      const envVars = [
        cluster.feHost ? `FE_HOST=${clean(cluster.feHost)}` : null,
        cluster.feHttpPort ? `FE_HTTP_PORT=${clean(cluster.feHttpPort)}` : null,
        `FE_HTTPS_PORT=${httpsPort}`,
        cluster.feQueryPort ? `FE_QUERY_PORT=${clean(cluster.feQueryPort)}` : null,
        cluster.user ? `USER=${clean(cluster.user)}` : null,
        cluster.password ? `PASSWORD=${clean(cluster.password)}` : null,
        `DB=${testType}`,
        `DORIS_BENCHMARK_DATA=${dataPath}`
      ].filter(Boolean).join(' ')

      const command = `echo $$ > /tmp/benchmark_main.pid && cd ${remoteBinPath} && chmod +x ${script} && sed -i 's/\r$//' ${script} && find ${remoteBinPath}/../conf -name "*.conf" -exec sed -i 's/\r$//' {} \\; && sed -i '/tlsv1\.2/!s/curl -sk /curl -sk --tlsv1.2 /g' ${script} && sed -i '/tlsv1\.2/!s/curl -k /curl -k --tlsv1.2 /g' ${script} && trap 'kill -9 0 2>/dev/null' EXIT INT TERM HUP && ${envVars} bash ${script} ${args.join(' ')}`

      const streamWrapper = {
        stop: () => {
          try {
            client.exec('PGID=$(ps -o pgid=$$ | tr -d " "); kill -9 -${PGID} 2>/dev/null; exit 0', (err, stream) => {
              if (err) return
              stream.on('close', () => {
                try { client.end() } catch (_) {}
              })
              stream.on('error', () => {
                try { client.end() } catch (_) {}
              })
            })
          } catch (_) {
            try { client.end() } catch (_) {}
          }
        }
      }
      this.currentStream = streamWrapper

      client.on('ready', () => {
        client.exec(command, (err, stream) => {
          if (err) {
            client.end()
            this.currentClient = null
            this.currentSshConfig = null
          this.currentStream = null
            reject(err)
            return
          }

          stream.on('close', (code: number | null) => {
            client.end()
            this.currentClient = null
            this.currentSshConfig = null
          this.currentStream = null
            if (this.stopped) {
              this.stopped = false
              reject(new Error('Step manually stopped'))
            } else if (code === 0 || code === null) {
              resolve()
            } else {
              reject(new Error(`Script exited with code ${code}`))
            }
          })

          stream.on('error', (err: Error) => {
            client.end()
            this.currentClient = null
            this.currentSshConfig = null
          this.currentStream = null
            if (this.stopped) {
              this.stopped = false
              reject(new Error('Step manually stopped'))
            } else {
              reject(new Error(`Stream error: ${err.message}`))
            }
          })

          stream.on('data', (data: Buffer) => {
            const text = data.toString()
            const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
            onLog(cleanText, 'info')
          })

          stream.stderr.on('data', (data: Buffer) => {
            const text = data.toString()
            const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
            onLog(cleanText, 'error')
          })
        })
      })

      client.on('error', (err) => {
        this.currentClient = null
        this.currentStream = null
        if (this.stopped) {
          this.stopped = false
          reject(new Error('Step manually stopped'))
        } else {
          reject(err)
        }
      })

      client.connect(sshConfig)
    })
  }
}
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
import mysql from 'mysql2/promise'
import { ClusterConfig } from '../../src/types'
import { SqlResult } from '../../src/types'

let pool: mysql.Pool | null = null
let currentClusterKey: string = ''

function getClusterKey(cluster: ClusterConfig): string {
  return `${cluster.feHost}:${cluster.feQueryPort}:${cluster.user}`
}

function getPool(cluster: ClusterConfig): mysql.Pool {
  const clusterKey = getClusterKey(cluster)

  if (pool && currentClusterKey === clusterKey) {
    return pool
  }

  if (pool) {
    pool.end().catch(() => {})
  }

  pool = mysql.createPool({
    host: cluster.feHost,
    port: cluster.feQueryPort,
    user: cluster.user,
    password: cluster.password,
    database: '',
    connectTimeout: 10000,
    supportNumbers: true,
    enabledFunctions: true,
    enableCleartextPlugin: true
  })

  currentClusterKey = clusterKey
  return pool
}

export class MySQLService {
  async execute(sql: string, cluster: ClusterConfig): Promise<SqlResult> {
    const connection = getPool(cluster)
    try {
      const [rows, fields] = await connection.query(sql)
      if (Array.isArray(rows)) {
        const columns = fields ? fields.map((f: mysql.FieldPacket) => f.name) : []
        return { columns, rows: rows as Record<string, unknown>[] }
      } else {
        return { columns: [], rows: [] }
      }
    } catch (err) {
      throw new Error((err as Error).message)
    }
  }

  async closePool(): Promise<void> {
    if (pool) {
      await pool.end()
      pool = null
      currentClusterKey = ''
    }
  }
}
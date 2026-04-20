import { useState } from 'react'
import { Card, Input, Button, Table, Space, message } from 'antd'
import { useClusterStore } from '../stores/clusterStore'

export default function SQLTerminal() {
  const [sql, setSql] = useState('')
  const [result, setResult] = useState<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null)
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
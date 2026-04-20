import { Table, Card, Button, message } from 'antd'
import { useTestStore } from '../stores/testStore'

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
    <Card title="Query Results" extra={<Button onClick={async () => {
  const { result } = useTestStore.getState()
  if (!result) return
  try {
    await window.electronAPI.result.export(result, `${result.testType}_${result.scale}_${Date.now()}.json`)
    message.success('Exported successfully')
  } catch (e) {
    message.error('Export failed')
  }
}}>Export JSON</Button>}>
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
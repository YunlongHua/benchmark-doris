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
import { useEffect, useRef } from 'react'
import { Button, Space } from 'antd'
import { ClearOutlined } from '@ant-design/icons'
import { useLogStore } from '../stores/logStore'
import { useTranslation } from '../hooks/useTranslation'

export default function LogPanel() {
  const { logs, autoScroll, clearLogs, setAutoScroll } = useLogStore()
  const { t, language } = useTranslation()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  const getLogColor = (level: string) => {
    switch (level) {
      case 'error': return '#ef4444'
      case 'warn': return '#f59e0b'
      default: return '#3b82f6'
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#fff',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#3b82f6', fontWeight: 500, fontSize: 12 }}>{t('logPanel')}</span>
          <span style={{ color: '#94a3b8', fontSize: 11 }}>({logs.length})</span>
        </div>
        <Space size={4}>
          <Button
            size="small"
            onClick={() => setAutoScroll(!autoScroll)}
            style={{
              fontSize: 10,
              height: 22,
              padding: '0 8px',
              background: autoScroll ? '#eff6ff' : 'transparent',
              borderColor: autoScroll ? '#bfdbfe' : '#e2e8f0',
              color: autoScroll ? '#3b82f6' : '#94a3b8'
            }}
          >
            AUTO
          </Button>
          <Button size="small" icon={<ClearOutlined />} onClick={clearLogs} style={{ height: 22 }} />
        </Space>
      </div>
      <div style={{
        flex: 1,
        overflow: 'auto',
        fontFamily: "'SF Mono', Monaco, Consolas, monospace",
        fontSize: 11.5,
        padding: '10px 12px',
        lineHeight: 1.7,
        background: '#fafafa'
      }}>
        {logs.length === 0 ? (
          <div style={{ color: '#94a3b8', fontStyle: 'italic', padding: 10 }}>
            {language === 'zh-CN' ? '暂无日志' : 'No logs yet'}
          </div>
        ) : (
          logs.map((entry) => (
            <div key={entry.id} style={{
              color: getLogColor(entry.level),
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              marginBottom: 3
            }}>
              <span style={{ color: '#94a3b8', marginRight: 8 }}>[{entry.timestamp.split('T')[1]?.split('.')[0]}]</span>
              {entry.level === 'error' ? '✖ ' : entry.level === 'warn' ? '⚠ ' : '› '}
              {entry.line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
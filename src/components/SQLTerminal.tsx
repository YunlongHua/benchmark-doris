import { useState } from 'react'
import { Input, Button, Table, Space, message, Tooltip } from 'antd'
import { PlayCircleOutlined, FormOutlined, ClearOutlined } from '@ant-design/icons'
import { format as formatSql } from 'sql-formatter'
import { useClusterStore } from '../stores/clusterStore'
import { useTranslation } from '../hooks/useTranslation'

export default function SQLTerminal() {
  const [sql, setSql] = useState('')
  const [result, setResult] = useState<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { activeClusterId, clusters } = useClusterStore()
  const { t, language } = useTranslation()

  const activeCluster = clusters.find(c => c.name === activeClusterId)

  const handleExecute = async () => {
    if (!sql.trim()) return
    if (!activeCluster) { message.warning(language === 'zh-CN' ? '请先选择集群' : 'Select a cluster first'); return }
    setLoading(true)
    setError(null)
    try {
      const res = await window.electronAPI.sql.execute(sql, activeCluster)
      setResult(res)
    } catch (err) {
      setError((err as Error).message)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const handleFormat = () => {
    try {
      const formatted = formatSql(sql, { language: 'sql', keywordCase: 'upper' })
      setSql(formatted)
    } catch {
      message.warning(language === 'zh-CN' ? '格式化失败' : 'Format failed')
    }
  }

  const handleClear = () => {
    setSql('')
    setResult(null)
    setError(null)
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
          <span style={{ color: '#22c55e', fontWeight: 500, fontSize: 12 }}>{t('sqlTerminal')}</span>
          {result && <span style={{ color: '#94a3b8', fontSize: 11 }}>({result.rows.length} rows)</span>}
        </div>
        <Space size={4}>
          <Tooltip title={language === 'zh-CN' ? '格式化' : 'Format'}>
            <Button icon={<FormOutlined />} onClick={handleFormat} disabled={!sql.trim()} size="small" style={{ height: 22 }} />
          </Tooltip>
          <Button icon={<ClearOutlined />} onClick={handleClear} size="small" style={{ height: 22 }} />
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleExecute}
            loading={loading}
            disabled={!activeCluster || !sql.trim()}
            size="small"
            style={{ height: 22 }}
          >
            {t('run')}
          </Button>
        </Space>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        <Input.TextArea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          placeholder={language === 'zh-CN' ? 'SQL...' : 'SQL...'}
          autoSize={{ minRows: 2, maxRows: 4 }}
          onPressEnter={(e) => { if (e.ctrlKey) handleExecute() }}
          style={{
            marginBottom: 12,
            fontFamily: "'SF Mono', Monaco, Consolas, monospace",
            fontSize: 12,
            borderRadius: 6,
            border: '1px solid #e2e8f0'
          }}
        />
        {error && (
          <div style={{
            color: '#ef4444',
            marginBottom: 12,
            padding: '8px 12px',
            background: '#fef2f2',
            borderRadius: 6,
            fontSize: 11,
            fontFamily: "'SF Mono', Monaco, Consolas, monospace",
            border: '1px solid #fecaca'
          }}>
            ✖ {error}
          </div>
        )}
        {result && (
          <div style={{ overflow: 'auto', background: '#fff', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <Table
              dataSource={result.rows}
              columns={result.columns.map(c => ({
                title: <span style={{ color: '#22c55e', fontWeight: 500, fontSize: 11 }}>{c}</span>,
                dataIndex: c,
                key: c,
                render: (text) => (
                  <span style={{ fontFamily: "'SF Mono', Monaco, Consolas, monospace", fontSize: 11 }}>
                    {String(text ?? 'NULL')}
                  </span>
                )
              }))}
              rowKey={(_r, i) => String(i)}
              size="small"
              scroll={{ x: true }}
              pagination={false}
              style={{ fontSize: 11 }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
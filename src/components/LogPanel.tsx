import { useEffect, useRef, useState, useMemo } from 'react'
import { Button, Input, Space } from 'antd'
import { ClearOutlined, DownloadOutlined, SearchOutlined } from '@ant-design/icons'
import { useLogStore } from '../stores/logStore'
import { useTranslation } from '../hooks/useTranslation'
import { useThemeStore } from '../stores/themeStore'

export default function LogPanel() {
  const { logs, autoScroll, clearLogs, setAutoScroll } = useLogStore()
  const { t, language } = useTranslation()
  const themeMode = useThemeStore(s => s.theme)
  const isDark = themeMode === 'dark'
  const bottomRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs
    const lower = search.toLowerCase()
    return logs.filter(e => e.line.toLowerCase().includes(lower))
  }, [logs, search])

  const getLogColor = (level: string) => {
    switch (level) {
      case 'error': return '#ef4444'
      case 'warn': return '#f59e0b'
      default: return '#3b82f6'
    }
  }

  const highlightText = (text: string, term: string) => {
    if (!term.trim()) return text
    const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === term.toLowerCase()
        ? <mark key={i} style={{ background: isDark ? '#854d0e' : '#fde68a', color: isDark ? '#fef3c7' : '#422006', borderRadius: 2, padding: '0 1px' }}>{part}</mark>
        : part
    )
  }

  const handleDownload = () => {
    const text = (search.trim() ? filteredLogs : logs)
      .map(e => `[${e.timestamp}] ${e.level === 'error' ? '✖' : e.level === 'warn' ? '⚠' : '›'} ${e.line}`)
      .join('\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `benchmark-log-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const headerBg = isDark ? '#1e293b' : '#fff'
  const bodyBg = isDark ? '#0f172a' : '#fafafa'
  const borderColor = isDark ? '#334155' : '#e2e8f0'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: bodyBg }}>
      <div style={{
        padding: '8px 12px',
        borderBottom: `1px solid ${borderColor}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        background: headerBg,
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ color: '#3b82f6', fontWeight: 500, fontSize: 12 }}>{t('logPanel')}</span>
          <span style={{ color: '#94a3b8', fontSize: 11 }}>
            {search.trim() ? `${filteredLogs.length}/${logs.length}` : logs.length}
          </span>
        </div>
        <Input
          size="small"
          placeholder={language === 'zh-CN' ? '搜索日志...' : 'Search logs...'}
          prefix={<SearchOutlined style={{ fontSize: 10, color: '#94a3b8' }} />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
          style={{
            flex: 1,
            maxWidth: 240,
            height: 24,
            fontSize: 11,
            background: isDark ? '#0f172a' : '#f8fafc',
            borderColor: borderColor,
            color: isDark ? '#e2e8f0' : '#334155'
          }}
        />
        <Space size={4}>
          <Button
            size="small"
            onClick={() => setAutoScroll(!autoScroll)}
            style={{
              fontSize: 10,
              height: 22,
              padding: '0 8px',
              background: autoScroll ? (isDark ? '#1e3a5f' : '#eff6ff') : 'transparent',
              borderColor: autoScroll ? (isDark ? '#1e40af' : '#bfdbfe') : borderColor,
              color: autoScroll ? '#3b82f6' : '#94a3b8'
            }}
          >
            AUTO
          </Button>
          <Button size="small" icon={<DownloadOutlined />} onClick={handleDownload} disabled={logs.length === 0} style={{ height: 22 }} title={language === 'zh-CN' ? '下载日志' : 'Download logs'} />
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
        background: bodyBg
      }}>
        {logs.length === 0 ? (
          <div style={{ color: '#94a3b8', fontStyle: 'italic', padding: 10 }}>
            {language === 'zh-CN' ? '暂无日志' : 'No logs yet'}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ color: '#94a3b8', fontStyle: 'italic', padding: 10 }}>
            {language === 'zh-CN' ? '无匹配结果' : 'No matches'}
          </div>
        ) : (
          filteredLogs.map((entry) => (
            <div key={entry.id} style={{
              color: getLogColor(entry.level),
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              marginBottom: 3
            }}>
              <span style={{ color: '#94a3b8', marginRight: 8 }}>[{entry.timestamp}]</span>
              {entry.level === 'error' ? '✖ ' : entry.level === 'warn' ? '⚠ ' : '› '}
              {search.trim() ? highlightText(entry.line, search.trim()) : entry.line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

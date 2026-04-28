import { useEffect, useState } from 'react'
import { Layout, ConfigProvider, theme } from 'antd'
import { FileTextOutlined, ConsoleSqlOutlined } from '@ant-design/icons'
import LogPanel from './components/LogPanel'
import SQLTerminal from './components/SQLTerminal'
import TestPanel from './components/TestPanel'
import { useLogStore } from './stores/logStore'
import { useTestStore } from './stores/testStore'
import { useLanguageStore } from './stores/languageStore'
import { useClusterStore } from './stores/clusterStore'

type BottomPanelType = 'log' | 'sql'

const antdTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#3b82f6',
    colorSuccess: '#22c55e',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorBgContainer: '#ffffff',
    colorBgLayout: '#f8fafc',
    colorBorder: '#e2e8f0',
    colorText: '#1e293b',
    colorTextSecondary: '#64748b',
    borderRadius: 6,
    fontFamily: "'Inter', 'Microsoft YaHei', 'PingFang SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 13,
    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    boxShadowSecondary: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  },
  components: {
    Button: {
      borderRadius: 6,
      controlHeight: 32,
      paddingContentHorizontal: 12,
    },
    Select: {
      borderRadius: 6,
      controlHeight: 28,
    },
    Input: {
      borderRadius: 6,
    },
    Tag: {
      borderRadius: 4,
    },
  },
}

export default function App() {
  const { addLog } = useLogStore()
  const setResult = useTestStore(s => s.setResult)
  const language = useLanguageStore(s => s.language)
  const loadClusters = useClusterStore(s => s.loadClusters)
  const [bottomPanel, setBottomPanel] = useState<BottomPanelType>('log')

  useEffect(() => {
    loadClusters()
  }, [])

  useEffect(() => {
    document.body.classList.toggle('lang-en', language === 'en-US')
  }, [language])

  useEffect(() => {
    const unsubLog = window.electronAPI.on('log:update', (data: unknown) => {
      const { line, level } = data as { line: string; level: 'info' | 'error' }
      addLog(line, level)
    })

    const unsubResult = window.electronAPI.on('result:update', (data: unknown) => {
      setResult(data as never)
    })

    return () => {
      unsubLog()
      unsubResult()
    }
  }, [])

  return (
    <ConfigProvider theme={antdTheme}>
      <Layout style={{ height: '100vh', background: '#f8fafc' }}>
        <Layout style={{ background: '#f8fafc' }}>
          <div style={{ height: '100vh', padding: 16, display: 'flex', gap: 16 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              {/* Test Panel */}
              <div style={{
                flexShrink: 0,
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
                overflow: 'auto',
                transition: 'box-shadow 0.2s ease',
              }}>
                <TestPanel />
              </div>

              {/* Bottom Panel (Log/SQL) */}
              <div style={{
                flex: 1,
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
                overflow: 'hidden',
                display: 'flex',
                minHeight: 0,
                transition: 'box-shadow 0.2s ease',
              }}>
                {/* Left icon bar */}
                <div style={{
                  width: 52,
                  background: '#f8fafc',
                  borderRight: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  paddingTop: 12,
                  gap: 8,
                  flexShrink: 0
                }}>
                  <div
                    onClick={() => setBottomPanel('log')}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      background: bottomPanel === 'log' ? '#eff6ff' : 'transparent',
                      border: bottomPanel === 'log' ? '1px solid #bfdbfe' : '1px solid transparent',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                    title="Logs"
                  >
                    <FileTextOutlined style={{ fontSize: 18, color: bottomPanel === 'log' ? '#3b82f6' : '#94a3b8' }} />
                  </div>
                  <div
                    onClick={() => setBottomPanel('sql')}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      background: bottomPanel === 'sql' ? '#f0fdf4' : 'transparent',
                      border: bottomPanel === 'sql' ? '1px solid #bbf7d0' : '1px solid transparent',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                    title="SQL Terminal"
                  >
                    <ConsoleSqlOutlined style={{ fontSize: 18, color: bottomPanel === 'sql' ? '#22c55e' : '#94a3b8' }} />
                  </div>
                </div>

                {/* Panel content */}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  {bottomPanel === 'log' ? <LogPanel /> : <SQLTerminal />}
                </div>
              </div>
            </div>
          </div>
        </Layout>
      </Layout>
    </ConfigProvider>
  )
}
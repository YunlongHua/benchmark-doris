import { useEffect } from 'react'
import { Layout } from 'antd'
import Header from './components/Header'
import ClusterPanel from './components/ClusterPanel'
import TestPanel from './components/TestPanel'
import LogPanel from './components/LogPanel'
import ResultTable from './components/ResultTable'
import ResultChart from './components/ResultChart'
import SQLTerminal from './components/SQLTerminal'
import StatusBar from './components/StatusBar'
import { useClusterStore } from './stores/clusterStore'
import { useLogStore } from './stores/logStore'
import { useTestStore } from './stores/testStore'

const { Sider, Content } = Layout

export default function App() {
  const loadClusters = useClusterStore(s => s.loadClusters)
  const addLog = useLogStore(s => s.addLog)
  const setResult = useTestStore(s => s.setResult)

  useEffect(() => {
    loadClusters()

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
    <Layout style={{ height: '100vh' }}>
      <Header />
      <Layout>
        <Sider width={280} style={{ background: '#fff', padding: 16, overflow: 'auto' }}>
          <ClusterPanel />
        </Sider>
        <Layout>
          <Content style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
            <TestPanel />
            <ResultTable />
            <ResultChart />
            <SQLTerminal />
          </Content>
        </Layout>
      </Layout>
      <StatusBar />
      <LogPanel />
    </Layout>
  )
}
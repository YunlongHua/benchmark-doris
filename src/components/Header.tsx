import { Layout, Tabs } from 'antd'
import { useTestStore } from '../stores/testStore'
import { TestType } from '../types'

const { Header: AntHeader } = Layout

export default function Header() {
  const { testType, setTestType } = useTestStore()

  const tabs = [
    { key: 'ssb', label: 'SSB' },
    { key: 'tpch', label: 'TPCH' },
    { key: 'tpcds', label: 'TPCDS' }
  ]

  return (
    <AntHeader style={{ background: '#001529', padding: '0 24px', display: 'flex', alignItems: 'center' }}>
      <div style={{ color: '#fff', fontSize: 18, fontWeight: 600, marginRight: 40 }}>
        Doris Benchmark
      </div>
      <Tabs
        activeKey={testType}
        onChange={(key) => setTestType(key as TestType)}
        items={tabs}
        style={{ flex: 1 }}
        tabBarStyle={{ marginBottom: 0 }}
      />
    </AntHeader>
  )
}
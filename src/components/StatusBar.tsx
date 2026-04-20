import { useEffect, useState } from 'react'
import { Tag, Space } from 'antd'
import { useTestStore } from '../stores/testStore'

export default function StatusBar() {
  const { status, testType, scale } = useTestStore()
  const [deps, setDeps] = useState({ bash: false, mysql: false })

  useEffect(() => {
    window.electronAPI.system.checkDeps().then(setDeps)
  }, [])

  return (
    <div style={{ height: 28, background: '#f0f0f0', borderTop: '1px solid #ddd', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
      <Space>
        <Tag color={deps.bash ? 'green' : 'red'}>{deps.bash ? '✓ Git Bash' : '✗ Git Bash missing'}</Tag>
        <Tag color={deps.mysql ? 'green' : 'red'}>{deps.mysql ? '✓ MySQL CLI' : '✗ MySQL CLI missing'}</Tag>
      </Space>
      <Space>
        <span>Test: {testType.toUpperCase()}</span>
        <span>Scale: SF {scale}</span>
        <span>Status: {status}</span>
      </Space>
    </div>
  )
}
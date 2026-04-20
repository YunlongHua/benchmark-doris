import { Card, Select, InputNumber, Button, Space, Progress, Tag, Divider } from 'antd'
import { PlayCircleOutlined, PauseCircleOutlined, FlagOutlined } from '@ant-design/icons'
import { useTestStore } from '../stores/testStore'
import { TestStep } from '../types'

const SCALE_OPTIONS = [1, 10, 100, 500, 1000]

export default function TestPanel() {
  const { scale, status, setScale, startTest, stopTest, runStep } = useTestStore()

  const steps: { step: TestStep; label: string }[] = [
    { step: 1, label: 'Build' },
    { step: 2, label: 'Generate Data' },
    { step: 3, label: 'Create Tables' },
    { step: 4, label: 'Load Data' },
    { step: 5, label: 'Run Queries' }
  ]

  const statusMap = { idle: 'normal', running: 'active', success: 'success', error: 'exception' } as const

  return (
    <Card title="Test Control">
      <Space wrap style={{ marginBottom: 16 }}>
        <span>Scale Factor:</span>
        <Select
          value={scale}
          onChange={setScale}
          style={{ width: 120 }}
          options={SCALE_OPTIONS.map(s => ({ value: s, label: `SF ${s}` }))}
        />
        <InputNumber
          value={scale}
          onChange={(v) => setScale(v ?? 1)}
          min={1}
          style={{ width: 100 }}
          placeholder="Custom"
        />
        <Divider type="vertical" />
        <Tag color={statusMap[status]}>{status.toUpperCase()}</Tag>
      </Space>

      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={status === 'running'}
          onClick={startTest}
          disabled={status === 'running'}
        >
          Run All Steps
        </Button>
        {status === 'running' && (
          <Button icon={<PauseCircleOutlined />} onClick={stopTest} danger>
            Stop
          </Button>
        )}
      </Space>

      <Divider orientation="left" plain>Individual Steps</Divider>

      <Space wrap>
        {steps.map(({ step, label }) => (
          <Button
            key={step}
            icon={<FlagOutlined />}
            onClick={() => runStep(step)}
            disabled={status === 'running'}
          >
            {label}
          </Button>
        ))}
      </Space>

      <Progress
        percent={status === 'running' ? 50 : status === 'success' ? 100 : 0}
        status={statusMap[status]}
        style={{ marginTop: 16 }}
        steps={5}
      />
    </Card>
  )
}
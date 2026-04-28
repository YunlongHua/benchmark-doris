import { Select, Button, message, Modal, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import { PlayCircleOutlined, PauseCircleOutlined, SyncOutlined, DeleteOutlined, SafetyCertificateOutlined, UploadOutlined, PlusOutlined, SettingOutlined, DownOutlined, FileTextOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useTestStore } from '../stores/testStore'
import { useClusterStore } from '../stores/clusterStore'
import { useLogStore } from '../stores/logStore'
import { useLanguageStore } from '../stores/languageStore'
import { TestStep } from '../types'
import { useTranslation } from '../hooks/useTranslation'
import ClusterModal from './ClusterModal'

type StepStatus = 'pending' | 'running' | 'success' | 'error'

const DividerLine = () => (
  <div style={{ width: 1, height: 24, background: '#e8e8e8', margin: '0 4px' }} />
)

export default function TestPanel() {
  const { status, setStatus, setCurrentStep, testType, setTestType, setScale, scale, result, setResult } = useTestStore()
  const { clusters, activeClusterId, setActiveCluster } = useClusterStore()
  const { clearLogs } = useLogStore()
  const { t, language } = useTranslation()
  const { setLanguage } = useLanguageStore()
  const [testing, setTesting] = useState(false)
  const [connected, setConnected] = useState<boolean | null>(null)
  const [cleaning, setCleaning] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [clusterModalVisible, setClusterModalVisible] = useState(false)
  const [editingCluster, setEditingCluster] = useState<string | null>(null)
  const [stepStatuses, setStepStatuses] = useState<Record<TestStep, StepStatus>>({
    1: 'pending', 2: 'pending', 3: 'pending', 4: 'pending', 5: 'pending'
  })

  const activeCluster = clusters.find(c => c.name === activeClusterId)
  const isDisabled = !activeClusterId || connected === false || status === 'running'

  const testTypeOptions = [
    { value: 'ssb', label: 'SSB' },
    { value: 'tpch', label: 'TPCH' },
    { value: 'tpcds', label: 'TPCDS' }
  ]

  const scaleOptions = [
    { value: 1, label: 'SF 1' },
    { value: 10, label: 'SF 10' },
    { value: 100, label: 'SF 100' },
    { value: 500, label: 'SF 500' },
    { value: 1000, label: 'SF 1000' }
  ]

  const clusterOptions = [
    { value: '', label: language === 'zh-CN' ? '-- 选择集群 --' : '-- Select Cluster --' },
    ...clusters.map(c => ({
      value: c.name,
      label: c.name,
      disabled: !c.feHost
    }))
  ]

  const handleClusterChange = async (clusterName: string | null) => {
    setActiveCluster(clusterName)
    setConnected(null)
    setUploaded(false)
    resetStepStatuses()
    if (clusterName) {
      await testConnection(clusterName)
    }
  }

  const resetStepStatuses = () => {
    setStepStatuses({ 1: 'pending', 2: 'pending', 3: 'pending', 4: 'pending', 5: 'pending' })
  }

  const handleRunAllSteps = async () => {
    if (!activeClusterId || !activeCluster) {
      message.warning(language === 'zh-CN' ? '请先选择并连接到集群' : 'Please select and connect to a cluster first')
      return
    }
    resetStepStatuses()
    setStatus('running')
    setCurrentStep(1)

    for (let i = 1; i <= 5; i++) {
      setStepStatuses(prev => ({ ...prev, [i as TestStep]: 'running' }))
      try {
        const stepResult = await window.electronAPI.test.runStep({ step: i, testType, scale, clusterId: activeClusterId })
        setStepStatuses(prev => ({ ...prev, [i as TestStep]: 'success' }))
        if (stepResult) {
          setResult(stepResult as any)
        }
      } catch (err) {
        setStepStatuses(prev => ({ ...prev, [i as TestStep]: 'error' }))
        setStatus('error')
        message.error((err as Error).message)
        return
      }
    }
    setStatus('success')
  }

  const testConnection = async (clusterName: string) => {
    const cluster = clusters.find(c => c.name === clusterName)
    if (!cluster) return

    setTesting(true)
    setConnected(null)
    try {
      await window.electronAPI.sql.execute('SELECT 1', cluster)
      setConnected(true)
      message.success(language === 'zh-CN' ? `已连接到集群: ${clusterName}` : `Connected to cluster: ${clusterName}`)
    } catch (err) {
      setConnected(false)
      message.error(language === 'zh-CN' ? `集群 ${clusterName} 连接失败: ${(err as Error).message}` : `Failed to connect to cluster ${clusterName}: ${(err as Error).message}`)
    } finally {
      setTesting(false)
    }
  }

  const handleCheckEnv = async () => {
    if (!activeClusterId || !activeCluster) {
      message.warning(language === 'zh-CN' ? '请先选择集群' : 'Please select and connect to a cluster first')
      return
    }
    try {
      const envStatus = await window.electronAPI.system.checkEnv({ testType, clusterId: activeClusterId, language })

      // Update step statuses based on environment check
      if (envStatus.toolsUploaded) {
        setUploaded(true)
      }
      setStepStatuses(prev => ({
        ...prev,
        1: envStatus.build ? 'success' : 'pending',
        2: envStatus.dataGenerated ? 'success' : 'pending',
        3: envStatus.tablesCreated ? 'success' : 'pending',
        4: envStatus.dataLoaded ? 'success' : 'pending',
      }))

      Modal.info({
        title: language === 'zh-CN' ? '环境状态' : 'Environment Status',
        content: <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{envStatus.details || (language === 'zh-CN' ? '无状态信息' : 'No status information')}</pre>,
        okText: language === 'zh-CN' ? '确定' : 'OK'
      })
    } catch (err) {
      message.error((err as Error).message)
    }
  }

  const handleCleanup = async (target: 'database' | 'data' | 'build' | 'tools' | 'all') => {
    if (!activeClusterId || !activeCluster) return
    setCleaning(true)
    clearLogs()
    try {
      await window.electronAPI.test.cleanup({ target, testType, scale, clusterId: activeClusterId })
      resetStepStatuses()
      setUploaded(false)
      const targetLabels: Record<string, string> = {
        database: language === 'zh-CN' ? '数据库' : 'Database',
        data: language === 'zh-CN' ? '数据文件' : 'Data files',
        build: language === 'zh-CN' ? '编译文件' : 'Build files',
        tools: language === 'zh-CN' ? '工具' : 'Tools',
        all: language === 'zh-CN' ? '全部' : 'All'
      }
      message.success(`${targetLabels[target]} ${language === 'zh-CN' ? '清理完成' : 'cleaned'}`)
    } catch (err) {
      message.error((err as Error).message)
    } finally {
      setCleaning(false)
    }
  }

  const cleanupMenuItems: MenuProps['items'] = [
    {
      key: 'database',
      label: language === 'zh-CN' ? '清理数据库' : 'Clean Database',
      onClick: () => handleCleanup('database')
    },
    {
      key: 'data',
      label: language === 'zh-CN' ? '清理数据文件' : 'Clean Data Files',
      onClick: () => handleCleanup('data')
    },
    {
      key: 'build',
      label: language === 'zh-CN' ? '清理编译文件' : 'Clean Build Files',
      onClick: () => handleCleanup('build')
    },
    {
      key: 'tools',
      label: language === 'zh-CN' ? '清理工具目录' : 'Clean Tools Directory',
      onClick: () => handleCleanup('tools')
    },
    { type: 'divider' },
    {
      key: 'all',
      label: language === 'zh-CN' ? '清理全部' : 'Clean All',
      danger: true,
      onClick: () => handleCleanup('all')
    }
  ]

  const handleUploadTools = async () => {
    if (!activeClusterId) {
      message.warning(language === 'zh-CN' ? '请先选择集群' : 'Please select and connect to a cluster first')
      return
    }
    setUploading(true)
    try {
      await window.electronAPI.test.uploadTools({ testType, clusterId: activeClusterId })
      setUploaded(true)
      message.success(language === 'zh-CN' ? '工具上传完成' : 'Tools uploaded successfully')
    } catch (err) {
      message.error((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const handleRunStep = async (step: TestStep) => {
    if (!activeClusterId || !activeCluster) {
      message.warning(language === 'zh-CN' ? '请先选择集群' : 'Please select and connect to a cluster first')
      return
    }
    setStatus('running')
    setCurrentStep(step)
    setStepStatuses(prev => ({ ...prev, [step]: 'running' }))
    try {
      const stepResult = await window.electronAPI.test.runStep({ step, testType, scale, clusterId: activeClusterId })
      setStepStatuses(prev => ({ ...prev, [step]: 'success' }))
      if (stepResult) {
        setResult(stepResult as any)
      }
      setStatus('success')
      Modal.success({
        title: language === 'zh-CN' ? '执行成功' : 'Success',
        content: language === 'zh-CN'
          ? `${t(stepKeys[step - 1])} 完成`
          : `${t(stepKeys[step - 1]).charAt(0).toUpperCase() + t(stepKeys[step - 1]).slice(1)} completed`,
        okText: language === 'zh-CN' ? '确定' : 'OK'
      })
    } catch (err) {
      setStepStatuses(prev => ({ ...prev, [step]: 'error' }))
      setStatus('error')
      Modal.error({
        title: language === 'zh-CN' ? '执行失败' : 'Failed',
        content: language === 'zh-CN'
          ? `${t(stepKeys[step - 1])} 失败: ${(err as Error).message}`
          : `${t(stepKeys[step - 1]).charAt(0).toUpperCase() + t(stepKeys[step - 1]).slice(1)} failed: ${(err as Error).message}`,
        okText: language === 'zh-CN' ? '确定' : 'OK'
      })
    }
  }

  const handleGenerateReport = async () => {
    try {
      const savePath = await window.electronAPI.result.generateReport(language)
      message.success(language === 'zh-CN' ? `报告已保存: ${savePath}` : `Report saved: ${savePath}`)
    } catch (err) {
      if ((err as Error).message !== 'Save cancelled') {
        message.error((err as Error).message)
      }
    }
  }

  const getStepColor = (stepStatus: StepStatus) => {
    switch (stepStatus) {
      case 'success': return { bg: '#f6ffed', border: '#b7eb8f', color: '#52c41a' }
      case 'running': return { bg: '#e6f7ff', border: '#91d5ff', color: '#1677ff' }
      case 'error': return { bg: '#fff2f0', border: '#ffccc7', color: '#ff4d4f' }
      default: return { bg: '#fafafa', border: '#d9d9d9', color: '#8c8c8c' }
    }
  }

  const stepKeys = ['build', 'generateData', 'createTables', 'loadData', 'runQueries'] as const

  return (
    <div style={{ padding: '12px 16px' }}>
      {/* Row 1: Cluster Config | Test Config | Environment Actions | Language */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12
      }}>
        {/* Cluster Config Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, color: '#94a3b8', marginRight: 4 }}>
            {language === 'zh-CN' ? '集群' : 'Cluster'}
          </span>
          {testing ? (
            <SyncOutlined spin style={{ color: '#1677ff', fontSize: 14, marginRight: 4 }} />
          ) : connected === true ? (
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#52c41a', display: 'inline-block', marginRight: 4 }} />
          ) : connected === false ? (
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff4d4f', display: 'inline-block', marginRight: 4 }} />
          ) : null}
          <Select
            value={activeClusterId || ''}
            onChange={handleClusterChange}
            style={{ width: 140 }}
            options={clusterOptions}
            size="small"
          />
          <Button size="small" icon={<PlusOutlined />} onClick={() => { setEditingCluster(null); setClusterModalVisible(true) }} style={{ height: 24 }} />
          <Button size="small" icon={<SettingOutlined />} onClick={() => { if (activeClusterId) { setEditingCluster(activeClusterId); setClusterModalVisible(true) } }} disabled={!activeClusterId} style={{ height: 24 }} />
        </div>

        <DividerLine />

        {/* Test Config Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, color: '#94a3b8', marginRight: 4 }}>
            {language === 'zh-CN' ? '测试' : 'Test'}
          </span>
          <Select
            value={testType}
            onChange={(v) => { setTestType(v as 'ssb' | 'tpch' | 'tpcds'); setUploaded(false); resetStepStatuses() }}
            options={testTypeOptions}
            style={{ width: 90 }}
            size="small"
          />
          <Select
            value={scale}
            onChange={(v) => setScale(v)}
            options={scaleOptions}
            style={{ width: 90 }}
            size="small"
          />
        </div>

        <DividerLine />

        {/* Environment Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, color: '#94a3b8', marginRight: 4 }}>
            {language === 'zh-CN' ? '环境' : 'Env'}
          </span>
          <Button icon={<SafetyCertificateOutlined />} onClick={handleCheckEnv} disabled={isDisabled} size="small" style={{ height: 26 }}>
            {language === 'zh-CN' ? '检查' : 'Check'}
          </Button>
          <Dropdown menu={{ items: cleanupMenuItems }} trigger={['click']} placement="bottomLeft">
            <Button icon={<DeleteOutlined />} loading={cleaning} disabled={isDisabled} danger size="small" style={{ height: 26 }}>
              {language === 'zh-CN' ? '清理' : 'Clean'} <DownOutlined />
            </Button>
          </Dropdown>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Language */}
        <Select
          value={language}
          onChange={setLanguage}
          options={[
            { value: 'zh-CN', label: '中文' },
            { value: 'en-US', label: 'EN' }
          ]}
          style={{ width: 68 }}
          size="small"
        />
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#f0f0f0', marginBottom: 12 }} />

      {/* Row 2: Upload + Steps + Run All */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8
      }}>
        {/* Upload */}
        <div
          onClick={() => !isDisabled && handleUploadTools()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 6,
            border: `1px solid ${uploaded ? '#b7eb8f' : !isDisabled ? '#91d5ff' : '#d9d9d9'}`,
            background: uploaded ? '#f6ffed' : !isDisabled ? '#e6f7ff' : '#fafafa',
            cursor: !isDisabled ? 'pointer' : 'not-allowed',
            opacity: !isDisabled ? 1 : 0.5,
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: uploaded ? '#52c41a' : !isDisabled ? '#1677ff' : '#d9d9d9',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11
          }}>
            {uploading ? <SyncOutlined spin /> : uploaded ? '✓' : <UploadOutlined style={{ fontSize: 11 }} />}
          </div>
          <span style={{ fontSize: 12, color: uploaded ? '#52c41a' : !isDisabled ? '#1677ff' : '#8c8c8c', fontWeight: 500 }}>
            {language === 'zh-CN' ? '上传工具' : 'Upload'}
          </span>
        </div>

        <DividerLine />

        {/* Steps */}
        {stepKeys.map((key, idx) => {
          const step = (idx + 1) as TestStep
          const stepStatus = stepStatuses[step]
          const colors = getStepColor(stepStatus)
          return (
            <div
              key={step}
              onClick={() => !isDisabled && handleRunStep(step)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 6,
                border: `1px solid ${colors.border}`,
                background: colors.bg,
                cursor: !isDisabled ? 'pointer' : 'not-allowed',
                opacity: !isDisabled ? 1 : 0.5,
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: colors.border,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 600
              }}>
                {stepStatus === 'running' ? <SyncOutlined spin /> : stepStatus === 'success' ? '✓' : stepStatus === 'error' ? '✕' : idx + 1}
              </div>
              <span style={{ fontSize: 12, color: colors.color, fontWeight: 500 }}>{t(key)}</span>
            </div>
          )
        })}

        <DividerLine />

        {/* Run All */}
        <div
          onClick={() => !isDisabled && handleRunAllSteps()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 6,
            border: `1px solid ${!isDisabled ? '#b7eb8f' : '#d9d9d9'}`,
            background: !isDisabled ? '#f6ffed' : '#fafafa',
            cursor: !isDisabled ? 'pointer' : 'not-allowed',
            opacity: !isDisabled ? 1 : 0.5,
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: !isDisabled ? '#52c41a' : '#d9d9d9',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11
          }}>
            {status === 'running' ? <SyncOutlined spin /> : <PlayCircleOutlined style={{ fontSize: 12 }} />}
          </div>
          <span style={{ fontSize: 12, color: !isDisabled ? '#52c41a' : '#8c8c8c', fontWeight: 500 }}>
            {language === 'zh-CN' ? '运行所有' : 'Run All'}
          </span>
        </div>

        {status === 'running' && (
          <Button icon={<PauseCircleOutlined />} onClick={() => window.electronAPI.test.stop()} danger size="small" style={{ height: 26 }} />
        )}

        {result && status === 'success' && (
          <div
            onClick={handleGenerateReport}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #8b5cf6',
              background: 'rgba(139, 92, 246, 0.1)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#8b5cf6',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11
            }}>
              <FileTextOutlined style={{ fontSize: 11 }} />
            </div>
            <span style={{ fontSize: 12, color: '#8b5cf6', fontWeight: 500 }}>
              {language === 'zh-CN' ? '生成报告' : 'Generate Report'}
            </span>
          </div>
        )}
      </div>

      <ClusterModal
        visible={clusterModalVisible}
        editingCluster={editingCluster}
        onClose={() => setClusterModalVisible(false)}
        onSelect={(name) => { setActiveCluster(name); setClusterModalVisible(false) }}
      />
    </div>
  )
}
import { useState, useEffect } from 'react'
import { Form, Input, InputNumber, Button, Space, message, Popconfirm } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { useClusterStore } from '../stores/clusterStore'
import { ClusterConfig } from '../types'
import { useTranslation } from '../hooks/useTranslation'

const defaultForm: Omit<ClusterConfig, 'name' | 'createdAt'> = {
  feHost: '',
  feHttpPort: 29980,
  feHttpsPort: 29991,
  feQueryPort: 29982,
  user: '',
  password: '',
  sshHost: '',
  sshPort: 22,
  sshUser: 'root',
  sshPassword: ''
}

interface Props {
  visible: boolean
  editingCluster: string | null
  onClose: () => void
  onSelect: (clusterName: string) => void
}

const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{
    border: '1px solid #e8e8e8',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16
  }}>
    <div style={{
      padding: '10px 16px',
      background: '#fafafa',
      borderBottom: '1px solid #e8e8e8',
      fontSize: 13,
      fontWeight: 500,
      color: '#1e293b'
    }}>
      {title}
    </div>
    <div style={{ padding: 16 }}>
      {children}
    </div>
  </div>
)

export default function ClusterModal({ visible, editingCluster, onClose, onSelect }: Props) {
  const { clusters, addCluster, removeCluster, updateCluster } = useClusterStore()
  const [form] = Form.useForm()
  const [testingSql, setTestingSql] = useState(false)
  const [testingSsh, setTestingSsh] = useState(false)
  const [sqlResult, setSqlResult] = useState<{ success: boolean; message: string } | null>(null)
  const [sshResult, setSshResult] = useState<{ success: boolean; message: string } | null>(null)
  const { language } = useTranslation()

  useEffect(() => {
    if (visible) {
      if (editingCluster) {
        const cluster = clusters.find(c => c.name === editingCluster)
        if (cluster) {
          form.setFieldsValue({
            name: cluster.name,
            feHost: cluster.feHost,
            feHttpPort: cluster.feHttpPort || 29980,
            feHttpsPort: cluster.feHttpsPort || 29991,
            feQueryPort: cluster.feQueryPort || 29982,
            user: cluster.user,
            password: cluster.password,
            sshHost: cluster.sshHost || '',
            sshPort: cluster.sshPort || 22,
            sshUser: cluster.sshUser || 'root',
            sshPassword: cluster.sshPassword || ''
          })
        }
      } else {
        form.setFieldsValue(defaultForm)
      }
      setSqlResult(null)
      setSshResult(null)
    }
  }, [visible, editingCluster])

  const handleTestSqlConnection = async () => {
    const values = form.getFieldsValue()
    if (!values.feHost || !values.feQueryPort || !values.user) {
      message.warning(language === 'zh-CN' ? '请填写必填字段' : 'Please fill in required fields')
      return
    }
    setTestingSql(true)
    setSqlResult(null)
    try {
      const tempConfig: ClusterConfig = {
        name: values.name || values.feHost,
        feHost: values.feHost,
        feHttpPort: values.feHttpPort ?? 29980,
        feHttpsPort: values.feHttpsPort ?? 29991,
        feQueryPort: values.feQueryPort ?? 29982,
        user: values.user,
        password: values.password,
        sshHost: values.sshHost,
        sshPort: values.sshPort,
        sshUser: values.sshUser,
        sshPassword: values.sshPassword,
        createdAt: new Date().toISOString()
      }
      await window.electronAPI.sql.execute('SELECT 1', tempConfig)
      setSqlResult({ success: true, message: language === 'zh-CN' ? '连接成功' : 'Connected' })
      message.success(language === 'zh-CN' ? 'SQL 连接成功' : 'SQL connected')
    } catch (err) {
      setSqlResult({ success: false, message: (err as Error).message })
      message.error(language === 'zh-CN' ? 'SQL 连接失败' : 'SQL connection failed')
    } finally {
      setTestingSql(false)
    }
  }

  const handleTestSshConnection = async () => {
    const values = form.getFieldsValue()
    if (!values.sshHost || !values.sshPort || !values.sshUser || !values.sshPassword) {
      message.warning(language === 'zh-CN' ? '请填写 SSH 必填字段' : 'Please fill in SSH required fields')
      return
    }
    setTestingSsh(true)
    setSshResult(null)
    try {
      await window.electronAPI.system.testSsh({
        host: values.sshHost,
        port: values.sshPort,
        user: values.sshUser,
        password: values.sshPassword
      })
      setSshResult({ success: true, message: language === 'zh-CN' ? 'SSH 连接成功' : 'SSH connected' })
      message.success(language === 'zh-CN' ? 'SSH 连接成功' : 'SSH connected')
    } catch (err) {
      setSshResult({ success: false, message: (err as Error).message })
      message.error(language === 'zh-CN' ? 'SSH 连接失败' : 'SSH connection failed')
    } finally {
      setTestingSsh(false)
    }
  }

  const handleSave = async () => {
    const values = form.getFieldsValue()
    if (!values.name) {
      message.warning(language === 'zh-CN' ? '请输入集群名称' : 'Please enter a cluster name')
      return
    }
    if (!values.feHost || !values.feQueryPort || !values.user) {
      message.warning(language === 'zh-CN' ? '请填写必填字段' : 'Please fill in required fields')
      return
    }
    if (!values.sshHost || !values.sshPort || !values.sshUser || !values.sshPassword) {
      message.warning(language === 'zh-CN' ? '请填写 SSH 必填字段' : 'Please fill in SSH required fields')
      return
    }
    if (!sqlResult?.success) {
      message.warning(language === 'zh-CN' ? '请先测试 SQL 连接' : 'Please test SQL connection first')
      return
    }
    if (!sshResult?.success) {
      message.warning(language === 'zh-CN' ? '请先测试 SSH 连接' : 'Please test SSH connection first')
      return
    }
    const config: ClusterConfig = {
      name: values.name,
      feHost: values.feHost,
      feHttpPort: values.feHttpPort ?? 29980,
      feHttpsPort: values.feHttpsPort ?? 29991,
      feQueryPort: values.feQueryPort ?? 29982,
      user: values.user,
      password: values.password || '',
      sshHost: values.sshHost,
      sshPort: values.sshPort ?? 22,
      sshUser: values.sshUser,
      sshPassword: values.sshPassword || '',
      createdAt: editingCluster ? clusters.find(c => c.name === editingCluster)?.createdAt || new Date().toISOString() : new Date().toISOString()
    }

    if (editingCluster) {
      await updateCluster(editingCluster, config)
    } else {
      await addCluster(config)
    }

    message.success(editingCluster ? (language === 'zh-CN' ? '集群已更新' : 'Cluster updated') : (language === 'zh-CN' ? '集群已保存' : 'Cluster saved'))
    onSelect(values.name)
  }

  const handleDelete = async () => {
    if (editingCluster) {
      await removeCluster(editingCluster)
      message.success(language === 'zh-CN' ? '集群已删除' : 'Cluster deleted')
      onClose()
    }
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 12,
        width: 540,
        maxHeight: '85vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>
            {editingCluster
              ? (language === 'zh-CN' ? '编辑集群' : 'Edit Cluster')
              : (language === 'zh-CN' ? '新建集群' : 'New Cluster')}
          </div>
          <Button type="text" size="small" onClick={onClose} style={{ color: '#64748b' }}>✕</Button>
        </div>

        {/* Form Content */}
        <div style={{ padding: 20, flex: 1, overflow: 'auto' }}>
          <Form form={form} layout="vertical">
            {/* Cluster Name */}
            <div style={{ marginBottom: 20 }}>
              <Form.Item name="name" rules={[{ required: true, message: language === 'zh-CN' ? '请输入集群名称' : 'Please enter cluster name' }]} style={{ marginBottom: 0 }}>
                <Input
                  disabled={!!editingCluster}
                  placeholder={language === 'zh-CN' ? '集群名称' : 'Cluster Name'}
                  style={{ width: '100%', height: 36 }}
                />
              </Form.Item>
            </div>

            {/* Doris Connection Card */}
            <SectionCard title={language === 'zh-CN' ? 'Doris 连接' : 'Doris Connection'}>
              <div style={{ marginBottom: 12 }}>
                <Form.Item name="feHost" rules={[{ required: true, message: language === 'zh-CN' ? '请输入 FE 主机地址' : 'Please enter FE host' }]} style={{ marginBottom: 0 }}>
                  <Input
                    placeholder={language === 'zh-CN' ? 'FE 主机地址' : 'FE Host'}
                    style={{ width: '100%', height: 36 }}
                  />
                </Form.Item>
              </div>

              {/* Ports Grid */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <Form.Item name="feHttpPort" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 0, flex: 1 }}>
                  <InputNumber placeholder="HTTP" style={{ width: '100%', height: 36 }} />
                </Form.Item>
                <Form.Item name="feHttpsPort" style={{ marginBottom: 0, flex: 1 }}>
                  <InputNumber placeholder="HTTPS" style={{ width: '100%', height: 36 }} />
                </Form.Item>
                <Form.Item name="feQueryPort" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 0, flex: 1 }}>
                  <InputNumber placeholder="Query" style={{ width: '100%', height: 36 }} />
                </Form.Item>
              </div>

              {/* User & Password */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <Form.Item name="user" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 0, flex: 1 }}>
                  <Input placeholder={language === 'zh-CN' ? '用户名' : 'Username'} style={{ width: '100%', height: 36 }} />
                </Form.Item>
                <Form.Item name="password" style={{ marginBottom: 0, flex: 1 }}>
                  <Input.Password placeholder={language === 'zh-CN' ? '密码' : 'Password'} style={{ width: '100%', height: 36 }} />
                </Form.Item>
              </div>

              {/* Test Connection */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Button
                  size="small"
                  onClick={handleTestSqlConnection}
                  loading={testingSql}
                  style={{ height: 28, borderRadius: 6 }}
                >
                  {language === 'zh-CN' ? '测试连接' : 'Test Connection'}
                </Button>
                {sqlResult && (
                  <span style={{
                    color: sqlResult.success ? '#52c41a' : '#ff4d4f',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    {sqlResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                    {sqlResult.success
                      ? (language === 'zh-CN' ? '成功' : 'Connected')
                      : `${language === 'zh-CN' ? '失败' : 'Failed'}: ${sqlResult.message}`}
                  </span>
                )}
              </div>
            </SectionCard>

            {/* SSH Connection Card */}
            <SectionCard title={language === 'zh-CN' ? 'SSH 连接' : 'SSH Connection'}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <Form.Item name="sshHost" style={{ marginBottom: 0, flex: 2 }}>
                  <Input
                    placeholder={language === 'zh-CN' ? 'SSH 主机' : 'SSH Host'}
                    style={{ width: '100%', height: 36 }}
                  />
                </Form.Item>
                <Form.Item name="sshPort" style={{ marginBottom: 0, flex: 1 }}>
                  <InputNumber placeholder={language === 'zh-CN' ? '端口' : 'Port'} style={{ width: '100%', height: 36 }} />
                </Form.Item>
              </div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <Form.Item name="sshUser" style={{ marginBottom: 0, flex: 1 }}>
                  <Input placeholder={language === 'zh-CN' ? '用户名' : 'Username'} style={{ width: '100%', height: 36 }} />
                </Form.Item>
                <Form.Item name="sshPassword" style={{ marginBottom: 0, flex: 1 }}>
                  <Input.Password placeholder={language === 'zh-CN' ? '密码' : 'Password'} style={{ width: '100%', height: 36 }} />
                </Form.Item>
              </div>

              {/* Test SSH */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Button
                  size="small"
                  onClick={handleTestSshConnection}
                  loading={testingSsh}
                  style={{ height: 28, borderRadius: 6 }}
                >
                  {language === 'zh-CN' ? '测试 SSH' : 'Test SSH'}
                </Button>
                {sshResult && (
                  <span style={{
                    color: sshResult.success ? '#52c41a' : '#ff4d4f',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    {sshResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                    {sshResult.success
                      ? (language === 'zh-CN' ? '成功' : 'Connected')
                      : `${language === 'zh-CN' ? '失败' : 'Failed'}: ${sshResult.message}`}
                  </span>
                )}
              </div>
            </SectionCard>
          </Form>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#fafafa'
        }}>
          <div>
            {editingCluster && (
              <Popconfirm
                title={language === 'zh-CN' ? '确定删除此集群?' : 'Delete this cluster?'}
                onConfirm={handleDelete}
                okText={language === 'zh-CN' ? '确定' : 'Yes'}
                cancelText={language === 'zh-CN' ? '取消' : 'No'}
              >
                <Button danger size="small" style={{ height: 32 }}>
                  {language === 'zh-CN' ? '删除' : 'Delete'}
                </Button>
              </Popconfirm>
            )}
          </div>
          <Space>
            <Button onClick={onClose} size="small" style={{ height: 32, borderRadius: 6 }}>
              {language === 'zh-CN' ? '取消' : 'Cancel'}
            </Button>
            <Button type="primary" onClick={handleSave} size="small" style={{ height: 32, borderRadius: 6 }}>
              {language === 'zh-CN' ? '保存' : 'Save'}
            </Button>
          </Space>
        </div>
      </div>
    </div>
  )
}
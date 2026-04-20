import { useState } from 'react'
import { Card, Form, Input, InputNumber, Button, List, Space, Popconfirm, message } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useClusterStore } from '../stores/clusterStore'
import { ClusterConfig } from '../types'

const defaultForm: Omit<ClusterConfig, 'name' | 'createdAt'> = {
  feHost: '127.0.0.1',
  feHttpPort: 8030,
  feQueryPort: 9030,
  user: 'root',
  password: ''
}

export default function ClusterPanel() {
  const { clusters, activeClusterId, addCluster, removeCluster, setActiveCluster } = useClusterStore()
  const [form] = Form.useForm()
  const [editing, setEditing] = useState(false)

  const handleSave = async () => {
    const values = form.getFieldsValue()
    const config: ClusterConfig = {
      ...values,
      name: values.name || `cluster-${Date.now()}`,
      createdAt: new Date().toISOString()
    }
    await addCluster(config)
    form.resetFields()
    setEditing(false)
    message.success('Cluster saved')
  }

  return (
    <Card title="Cluster Config" extra={<Button icon={<PlusOutlined />} size="small" onClick={() => setEditing(!editing)} />}>
      <List
        dataSource={clusters}
        locale={{ emptyText: 'No clusters configured' }}
        renderItem={(c) => (
          <List.Item
            key={c.name}
            style={{ background: c.name === activeClusterId ? '#f0f7ff' : undefined, borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}
            onClick={() => setActiveCluster(c.name)}
            actions={[
              <Popconfirm key="del" title="Delete?" onConfirm={() => removeCluster(c.name)}>
                <Button size="small" icon={<DeleteOutlined />} danger />
              </Popconfirm>
            ]}
          >
            <List.Item.Meta title={c.name} description={`${c.feHost}:${c.feQueryPort}`} />
          </List.Item>
        )}
      />
      {editing && (
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} initialValues={defaultForm}>
          <Form.Item name="name" label="Name"><Input /></Form.Item>
          <Form.Item name="feHost" label="FE Host"><Input /></Form.Item>
          <Space>
            <Form.Item name="feHttpPort" label="HTTP Port"><InputNumber style={{ width: 100 }} /></Form.Item>
            <Form.Item name="feQueryPort" label="Query Port"><InputNumber style={{ width: 100 }} /></Form.Item>
          </Space>
          <Form.Item name="user" label="User"><Input /></Form.Item>
          <Form.Item name="password" label="Password"><Input.Password /></Form.Item>
          <Button type="primary" block onClick={handleSave}>Save</Button>
        </Form>
      )}
    </Card>
  )
}
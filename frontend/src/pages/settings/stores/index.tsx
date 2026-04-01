import { App, Button, Form, Input, Modal, Space } from 'antd';
import { useRef, useState } from 'react';
import { ActionType, ModalForm, ProFormText, ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { createStore, deactivateStore, getStores, updateStore } from '@/services/api';

export default function StoresPage() {
  const { message, modal } = App.useApp();
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [editingStore, setEditingStore] = useState<API.Store | null>(null);
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);

  const columns: ProColumns<API.Store>[] = [
    { title: '门店名称', dataIndex: 'name' },
    { title: '地址', dataIndex: 'address', ellipsis: true },
    { title: '电话', dataIndex: 'phone' },
    { title: '创建时间', dataIndex: 'createdAt', search: false, width: 140 },
    {
      title: '操作',
      width: 150,
      search: false,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            onClick={() => {
              setEditingStore(record);
              form.setFieldsValue(record);
              setModalOpen(true);
            }}
          >
            编辑
          </Button>
          <Button
            size="small"
            danger
            onClick={() =>
              modal.confirm({
                title: '确认停用该门店？',
                onOk: async () => {
                  await deactivateStore(record.id);
                  actionRef.current?.reload();
                },
              })
            }
          >
            停用
          </Button>
        </Space>
      ),
    },
  ];

  const handleSave = async () => {
    const values = await form.validateFields();
    if (editingStore) {
      await updateStore(editingStore.id, values);
      message.success('已更新');
    } else {
      await createStore(values);
      message.success('已创建');
    }
    setModalOpen(false);
    actionRef.current?.reload();
  };

  return (
    <>
      <ProTable<API.Store>
        headerTitle="门店列表"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        search={false}
        request={async () => {
          const data = await getStores();
          return { data, success: true };
        }}
        toolBarRender={() => [
          <Button
            key="add"
            type="primary"
            onClick={() => {
              setEditingStore(null);
              form.resetFields();
              setModalOpen(true);
            }}
          >
            新增门店
          </Button>,
        ]}
      />
      <Modal
        title={editingStore ? '编辑门店' : '新增门店'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="门店名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="电话">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

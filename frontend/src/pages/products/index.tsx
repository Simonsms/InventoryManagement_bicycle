import { useAccess, useModel } from '@umijs/max';
import { App, Button, Form, Input, InputNumber, Modal, Select, Space, Tag } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { ActionType, ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import {
  createProduct,
  deactivateProduct,
  getCategories,
  getProducts,
  updateProduct,
} from '@/services/api';

export default function ProductsPage() {
  const { message, modal } = App.useApp();
  const access = useAccess();
  const actionRef = useRef<ActionType>();
  const [categories, setCategories] = useState<API.Category[]>([]);
  const [editingProduct, setEditingProduct] = useState<API.Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  const columns: ProColumns<API.Product>[] = [
    { title: '商品名称', dataIndex: 'name', ellipsis: true },
    { title: '品牌', dataIndex: 'brand', width: 100 },
    { title: '型号', dataIndex: 'modelNumber', width: 120 },
    {
      title: '分类',
      dataIndex: ['category', 'name'],
      width: 100,
      renderFormItem: () => (
        <Select allowClear placeholder="选择分类" options={categories.map(c => ({ label: c.name, value: c.id }))} />
      ),
    },
    { title: '预警阈值', dataIndex: 'lowStockThreshold', width: 90, search: false },
    { title: '质保(月)', dataIndex: 'warrantyMonths', width: 90, search: false },
    {
      title: '操作',
      width: 120,
      search: false,
      render: (_, record) => (
        <Space>
          {access.isAdminOrOwner && (
            <Button
              size="small"
              onClick={() => {
                setEditingProduct(record);
                form.setFieldsValue(record);
                setModalOpen(true);
              }}
            >
              编辑
            </Button>
          )}
          {access.isOwner && (
            <Button
              size="small"
              danger
              onClick={() =>
                modal.confirm({
                  title: '确认停用该商品？',
                  onOk: async () => {
                    await deactivateProduct(record.id);
                    actionRef.current?.reload();
                  },
                })
              }
            >
              停用
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const handleSave = async () => {
    const values = await form.validateFields();
    if (editingProduct) {
      await updateProduct(editingProduct.id, values);
      message.success('已更新');
    } else {
      await createProduct(values);
      message.success('已创建');
    }
    setModalOpen(false);
    actionRef.current?.reload();
  };

  return (
    <>
      <ProTable<API.Product>
        headerTitle="商品列表"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          const data = await getProducts({
            keyword: params.name,
            brand: params.brand,
            category_id: params['category.name'],
          });
          return { data, success: true };
        }}
        toolBarRender={() =>
          access.isAdminOrOwner
            ? [
                <Button
                  key="add"
                  type="primary"
                  onClick={() => {
                    setEditingProduct(null);
                    form.resetFields();
                    setModalOpen(true);
                  }}
                >
                  新增商品
                </Button>,
              ]
            : []
        }
      />
      <Modal
        title={editingProduct ? '编辑商品' : '新增商品'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="categoryId" label="分类" rules={[{ required: true }]}>
            <Select options={categories.map(c => ({ label: c.name, value: c.id }))} />
          </Form.Item>
          <Form.Item name="name" label="商品名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="brand" label="品牌" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="modelNumber" label="型号">
            <Input />
          </Form.Item>
          <Form.Item name="warrantyMonths" label="质保期（月）">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="lowStockThreshold" label="低库存预警阈值" initialValue={2}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

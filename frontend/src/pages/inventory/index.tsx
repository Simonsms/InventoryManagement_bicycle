import { useAccess, useModel } from '@umijs/max';
import { App, Button, DatePicker, Descriptions, Drawer, Form, InputNumber, Select, Space, Table, Tag } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { ActionType, ModalForm, ProFormDigit, ProFormSelect, ProFormText, ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import {
  getInventory,
  getInventoryBatches,
  getProducts,
  getStores,
  stockIn,
  stockOut,
} from '@/services/api';
import { useNavigate } from '@umijs/max';
import dayjs from 'dayjs';

export default function InventoryPage() {
  const { message } = App.useApp();
  const access = useAccess();
  const { initialState } = useModel('@@initialState');
  const isOwner = initialState?.currentUser?.role === 'shop_owner';
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [stores, setStores] = useState<API.Store[]>([]);
  const [products, setProducts] = useState<API.Product[]>([]);
  const [batchDrawer, setBatchDrawer] = useState<{ open: boolean; inv?: API.Inventory }>({ open: false });
  const [batches, setBatches] = useState<API.InventoryBatch[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    getStores().then(setStores);
    getProducts().then(setProducts);
  }, []);

  const openBatches = async (inv: API.Inventory) => {
    setBatchDrawer({ open: true, inv });
    const data = await getInventoryBatches(inv.id);
    setBatches(data);
  };

  const columns: ProColumns<API.Inventory>[] = [
    {
      title: '门店',
      dataIndex: 'storeId',
      width: 100,
      hideInTable: !isOwner,
      search: isOwner,
      fieldProps: { options: stores.map(s => ({ label: s.name, value: s.id })), allowClear: true, placeholder: '全部门店' },
      render: (_, record) => record.store?.name,
    },
    { title: '商品名称', dataIndex: ['product', 'name'], ellipsis: true },
    { title: '品牌', dataIndex: ['product', 'brand'], width: 90, search: false },
    { title: '型号', dataIndex: ['product', 'modelNumber'], width: 110, search: false },
    {
      title: '库存',
      dataIndex: 'quantity',
      width: 80,
      search: false,
      render: (_, record) => {
        const threshold = record.product?.lowStockThreshold ?? 2;
        const qty = record.quantity;
        return (
          <Tag color={qty <= threshold ? 'red' : qty <= threshold * 2 ? 'orange' : 'green'}>
            {qty}
          </Tag>
        );
      },
    },
    {
      title: '操作',
      width: 200,
      search: false,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openBatches(record)}>批次明细</Button>
          <ModalForm
            title="采购入库"
            trigger={<Button size="small" type="primary">入库</Button>}
            onFinish={async (values) => {
              await stockIn({
                productId: record.productId,
                quantity: values.quantity,
                batchNo: values.batchNo,
                purchaseDate: dayjs(values.purchaseDate).format('YYYY-MM-DD'),
                costPrice: values.costPrice,
                store_id: record.storeId,
              });
              message.success('入库成功');
              actionRef.current?.reload();
              return true;
            }}
          >
            <div style={{ marginBottom: 8 }}>
              商品：<strong>{record.product?.name}</strong>（当前库存 {record.quantity}）
            </div>
            <ProFormDigit name="quantity" label="入库数量" min={1} rules={[{ required: true }]} />
            <ProFormText name="batchNo" label="批次号" rules={[{ required: true }]} />
            <Form.Item name="purchaseDate" label="入库日期" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <ProFormDigit name="costPrice" label="成本价" min={0} />
          </ModalForm>
          <ModalForm
            title="销售出库"
            trigger={<Button size="small" danger>出库</Button>}
            onFinish={async (values) => {
              if (values.quantity > record.quantity) {
                message.error('出库数量不能超过库存');
                return false;
              }
              await stockOut({
                productId: record.productId,
                quantity: values.quantity,
                referenceNo: values.referenceNo,
                note: values.note,
                store_id: record.storeId,
              });
              message.success('出库成功');
              actionRef.current?.reload();
              return true;
            }}
          >
            <div style={{ marginBottom: 8 }}>
              商品：<strong>{record.product?.name}</strong>（当前库存 {record.quantity}）
            </div>
            <ProFormDigit name="quantity" label="出库数量" min={1} max={record.quantity} rules={[{ required: true }]} />
            <ProFormText name="referenceNo" label="单据号" />
            <ProFormText name="note" label="备注" />
          </ModalForm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ProTable<API.Inventory>
        headerTitle="库存列表"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          const data = await getInventory({
            store_id: params['store.name'],
            keyword: params['product.name'],
          });
          return { data, success: true };
        }}
      />
      <Drawer
        title={`批次明细 — ${batchDrawer.inv?.product?.name ?? ''}`}
        open={batchDrawer.open}
        onClose={() => setBatchDrawer({ open: false })}
        width={600}
      >
        <Table
          dataSource={batches}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            { title: '批次号', dataIndex: 'batchNo' },
            { title: '剩余数量', dataIndex: 'quantity', render: q => <Tag color={q > 0 ? 'blue' : 'default'}>{q}</Tag> },
            { title: '入库日期', dataIndex: 'purchaseDate' },
            { title: '成本价', dataIndex: 'costPrice', render: v => v ? `¥${v}` : '-' },
            { title: '创建时间', dataIndex: 'createdAt', render: v => dayjs(v).format('MM-DD HH:mm') },
          ]}
        />
      </Drawer>
    </>
  );
}

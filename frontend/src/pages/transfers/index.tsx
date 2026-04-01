import { useModel } from '@umijs/max';
import { App, Button, Form, InputNumber, Select, Space, Tabs, Tag } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { ActionType, ModalForm, ProFormDigit, ProFormSelect, ProFormText, ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import {
  approveTransfer,
  completeTransfer,
  createTransfer,
  getInventory,
  getProducts,
  getStores,
  getTransfers,
  rejectTransfer,
} from '@/services/api';
import dayjs from 'dayjs';

const STATUS_CONFIG: Record<API.TransferStatus, { text: string; color: string }> = {
  pending: { text: '待审批', color: 'orange' },
  approved: { text: '已审批', color: 'blue' },
  rejected: { text: '已拒绝', color: 'red' },
  completed: { text: '已完成', color: 'green' },
};

export default function TransfersPage() {
  const { message, modal } = App.useApp();
  const { initialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser;
  const isOwner = currentUser?.role === 'shop_owner';
  const isAdminOrOwner = isOwner || currentUser?.role === 'store_admin';
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [activeTab, setActiveTab] = useState('pending');
  const [stores, setStores] = useState<API.Store[]>([]);
  const [products, setProducts] = useState<API.Product[]>([]);
  // 发起调拨 — 动态明细行
  const [transferItems, setTransferItems] = useState<{ productId?: number; quantity?: number }[]>([{}]);

  useEffect(() => {
    getStores().then(setStores);
    getProducts().then(setProducts);
  }, []);

  const columns: ProColumns<API.Transfer>[] = [
    {
      title: '单号',
      dataIndex: 'id',
      width: 60,
      render: id => `TF-${id}`,
    },
    { title: '调出门店', dataIndex: ['fromStore', 'name'], width: 100 },
    { title: '调入门店', dataIndex: ['toStore', 'name'], width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_, r) => <Tag color={STATUS_CONFIG[r.status].color}>{STATUS_CONFIG[r.status].text}</Tag>,
    },
    { title: '申请人', dataIndex: ['requester', 'name'], width: 80 },
    { title: '备注', dataIndex: 'note', ellipsis: true },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      width: 140,
      render: v => dayjs(v as string).format('MM-DD HH:mm'),
    },
    {
      title: '操作',
      width: 200,
      render: (_, record) => (
        <Space>
          {isOwner && record.status === 'pending' && (
            <>
              <Button
                size="small"
                type="primary"
                onClick={() =>
                  modal.confirm({
                    title: '确认审批通过？',
                    onOk: async () => { await approveTransfer(record.id); actionRef.current?.reload(); },
                  })
                }
              >
                通过
              </Button>
              <Button
                size="small"
                danger
                onClick={() =>
                  modal.confirm({
                    title: '确认拒绝？',
                    onOk: async () => { await rejectTransfer(record.id); actionRef.current?.reload(); },
                  })
                }
              >
                拒绝
              </Button>
            </>
          )}
          {isAdminOrOwner && record.status === 'approved' && (
            <Button
              size="small"
              type="primary"
              onClick={() =>
                modal.confirm({
                  title: '确认收货？收货后库存将同步更新。',
                  onOk: async () => { await completeTransfer(record.id); actionRef.current?.reload(); },
                })
              }
            >
              确认收货
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ background: '#fff', padding: '0 24px', marginBottom: 16 }}>
        <Tabs
          activeKey={activeTab}
          onChange={key => { setActiveTab(key); actionRef.current?.reload(); }}
          items={[
            { key: 'pending', label: '待审批' },
            { key: 'approved', label: '已审批' },
            { key: 'completed', label: '已完成' },
            { key: 'rejected', label: '已拒绝' },
          ]}
        />
      </div>
      <ProTable<API.Transfer>
        headerTitle="调拨列表"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        search={false}
        request={async () => {
          const data = await getTransfers({ status: activeTab });
          return { data, success: true };
        }}
        toolBarRender={() =>
          isAdminOrOwner
            ? [
                <ModalForm
                  key="create"
                  title="发起调拨申请"
                  trigger={<Button type="primary">发起调拨</Button>}
                  width={560}
                  onFinish={async (values) => {
                    const validItems = transferItems.filter(i => i.productId && i.quantity && i.quantity > 0);
                    if (!validItems.length) { message.error('请添加调拨商品'); return false; }
                    await createTransfer({
                      toStoreId: values.toStoreId,
                      items: validItems as { productId: number; quantity: number }[],
                      note: values.note,
                      store_id: values.fromStoreId,
                    });
                    message.success('调拨申请已提交');
                    setTransferItems([{}]);
                    actionRef.current?.reload();
                    return true;
                  }}
                >
                  {isOwner && (
                    <ProFormSelect
                      name="fromStoreId"
                      label="调出门店"
                      options={stores.map(s => ({ label: s.name, value: s.id }))}
                      rules={[{ required: true }]}
                    />
                  )}
                  <ProFormSelect
                    name="toStoreId"
                    label="调入门店"
                    options={stores
                      .filter(s => isOwner || s.id !== currentUser?.storeId)
                      .map(s => ({ label: s.name, value: s.id }))}
                    rules={[{ required: true }]}
                  />
                  <div style={{ marginBottom: 8, fontWeight: 500 }}>调拨商品</div>
                  {transferItems.map((item, idx) => (
                    <Space key={idx} style={{ display: 'flex', marginBottom: 8 }}>
                      <Select
                        style={{ width: 200 }}
                        placeholder="选择商品"
                        options={products.map(p => ({ label: `${p.name} (${p.brand})`, value: p.id }))}
                        value={item.productId}
                        onChange={v => {
                          const next = [...transferItems];
                          next[idx] = { ...next[idx], productId: v };
                          setTransferItems(next);
                        }}
                      />
                      <InputNumber
                        min={1}
                        placeholder="数量"
                        value={item.quantity}
                        onChange={v => {
                          const next = [...transferItems];
                          next[idx] = { ...next[idx], quantity: v ?? undefined };
                          setTransferItems(next);
                        }}
                      />
                      <Button danger onClick={() => setTransferItems(transferItems.filter((_, i) => i !== idx))}>删除</Button>
                    </Space>
                  ))}
                  <Button onClick={() => setTransferItems([...transferItems, {}])}>+ 添加商品</Button>
                  <ProFormText name="note" label="备注" />
                </ModalForm>,
              ]
            : []
        }
      />
    </>
  );
}

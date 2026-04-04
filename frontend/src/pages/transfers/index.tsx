import { useModel } from '@umijs/max';
import { App, Button, InputNumber, Select, Space, Tabs, Tag } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { type ActionType, ModalForm, ProFormSelect, ProFormText, ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import {
  approveTransfer,
  createTransfer,
  executeTransferAdjustment,
  getProducts,
  getStores,
  getTransfers,
  receiveTransfer,
  rejectTransfer,
  shipTransfer,
} from '@/services/api';
import dayjs from 'dayjs';

const TRANSFER_TYPE_TEXT: Record<API.TransferType, string> = {
  physical_transfer: '实物调拨',
  book_adjustment: '账面划转',
};

const STATUS_META: Record<API.TransferType, Record<API.TransferStatus, { text: string; color: string }>> = {
  physical_transfer: {
    pending: { text: '待审批', color: 'orange' },
    approved: { text: '待发货', color: 'blue' },
    in_transit: { text: '在途待收货', color: 'cyan' },
    completed: { text: '已完成', color: 'green' },
    rejected: { text: '已拒绝', color: 'red' },
  },
  book_adjustment: {
    pending: { text: '待审批', color: 'orange' },
    approved: { text: '待执行', color: 'blue' },
    in_transit: { text: '处理中', color: 'cyan' },
    completed: { text: '已完成', color: 'green' },
    rejected: { text: '已拒绝', color: 'red' },
  },
};

const REASON_OPTIONS: Record<API.TransferType, { label: string; value: string }[]> = {
  physical_transfer: [
    { label: '门店补货', value: 'store_replenishment' },
    { label: '展陈调配', value: 'display_allocation' },
    { label: '紧急调货', value: 'emergency_transfer' },
  ],
  book_adjustment: [
    { label: '账务修正', value: 'bookkeeping_fix' },
    { label: '期初修正', value: 'opening_balance_fix' },
    { label: '应急划转', value: 'emergency_transfer' },
  ],
};

function getStatusTabs(type: API.TransferType) {
  if (type === 'physical_transfer') {
    return [
      { key: 'pending', label: '待审批' },
      { key: 'approved', label: '待发货' },
      { key: 'in_transit', label: '在途待收货' },
      { key: 'completed', label: '已完成' },
      { key: 'rejected', label: '已拒绝' },
    ];
  }

  return [
    { key: 'pending', label: '待审批' },
    { key: 'approved', label: '待执行' },
    { key: 'completed', label: '已完成' },
    { key: 'rejected', label: '已拒绝' },
  ];
}

export default function TransfersPage() {
  const { message, modal } = App.useApp();
  const { initialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser;
  const isOwner = currentUser?.role === 'shop_owner';
  const isAdminOrOwner = isOwner || currentUser?.role === 'store_admin';
  const actionRef = useRef<ActionType | undefined>(undefined);
  const transferItemKeyRef = useRef(1);
  const [activeType, setActiveType] = useState<API.TransferType>('physical_transfer');
  const [activeStatus, setActiveStatus] = useState<API.TransferStatus>('pending');
  const [stores, setStores] = useState<API.Store[]>([]);
  const [products, setProducts] = useState<API.Product[]>([]);
  const [transferItems, setTransferItems] = useState<{ key: number; productId?: number; quantity?: number }[]>([{ key: 0 }]);

  useEffect(() => {
    getStores().then(setStores);
    getProducts().then(setProducts);
  }, []);

  useEffect(() => {
    setActiveStatus('pending');
  }, [activeType]);

  const canCreateCurrentType = activeType === 'physical_transfer' ? isAdminOrOwner : isOwner;

  const columns: ProColumns<API.Transfer>[] = [
    {
      title: '单号',
      dataIndex: 'id',
      width: 80,
      render: (id) => `TF-${id}`,
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (_, record) => <Tag>{TRANSFER_TYPE_TEXT[record.type]}</Tag>,
    },
    { title: '调出门店', dataIndex: ['fromStore', 'name'], width: 130 },
    { title: '调入门店', dataIndex: ['toStore', 'name'], width: 160 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (_, record) => {
        const meta = STATUS_META[record.type][record.status];
        return <Tag color={meta.color}>{meta.text}</Tag>;
      },
    },
    {
      title: '原因',
      dataIndex: 'reasonCode',
      width: 120,
      render: (value) => REASON_OPTIONS[activeType].find((option) => option.value === value)?.label ?? value ?? '-',
    },
    { title: '申请人', dataIndex: ['requester', 'name'], width: 90 },
    {
      title: '特殊标记',
      dataIndex: 'selfApprovedException',
      width: 100,
      render: (_, record) => (
        record.selfApprovedException ? <Tag color="red">自审例外</Tag> : '-'
      ),
    },
    { title: '备注', dataIndex: 'note', ellipsis: true },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      width: 140,
      render: (value) => dayjs(value as string).format('MM-DD HH:mm'),
    },
    {
      title: '操作',
      width: 220,
      render: (_, record) => {
        const canShip = isOwner || currentUser?.storeId === record.fromStoreId;
        const canReceive = isOwner || currentUser?.storeId === record.toStoreId;

        return (
          <Space>
            {isOwner && record.status === 'pending' && (
              <>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => modal.confirm({
                    title: '确认审批通过？',
                    onOk: async () => {
                      await approveTransfer(record.id);
                      actionRef.current?.reload();
                    },
                  })}
                >
                  通过
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => modal.confirm({
                    title: '确认拒绝？',
                    onOk: async () => {
                      await rejectTransfer(record.id);
                      actionRef.current?.reload();
                    },
                  })}
                >
                  拒绝
                </Button>
              </>
            )}
            {record.type === 'physical_transfer' && record.status === 'approved' && canShip && (
              <Button
                size="small"
                type="primary"
                onClick={() => modal.confirm({
                  title: '确认发货？',
                  content: '发货后会扣减调出门店库存，并进入在途状态。',
                  onOk: async () => {
                    await shipTransfer(record.id);
                    actionRef.current?.reload();
                  },
                })}
              >
                发货
              </Button>
            )}
            {record.type === 'physical_transfer' && record.status === 'in_transit' && canReceive && (
              <Button
                size="small"
                type="primary"
                onClick={() => modal.confirm({
                  title: '确认收货？',
                  content: '收货后会增加调入门店库存，并完成单据。',
                  onOk: async () => {
                    await receiveTransfer(record.id);
                    actionRef.current?.reload();
                  },
                })}
              >
                确认收货
              </Button>
            )}
            {record.type === 'book_adjustment' && record.status === 'approved' && isOwner && (
              <Button
                size="small"
                type="primary"
                onClick={() => modal.confirm({
                  title: '确认执行账面划转？',
                  content: '执行后会同时调整调出和调入门店库存。',
                  onOk: async () => {
                    await executeTransferAdjustment(record.id);
                    actionRef.current?.reload();
                  },
                })}
              >
                执行划转
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <div style={{ background: '#fff', padding: '0 24px', marginBottom: 16 }}>
        <Tabs
          activeKey={activeType}
          onChange={(key) => setActiveType(key as API.TransferType)}
          items={[
            { key: 'physical_transfer', label: '实物调拨' },
            { key: 'book_adjustment', label: '账面划转' },
          ]}
        />
        <Tabs
          activeKey={activeStatus}
          onChange={(key) => {
            setActiveStatus(key as API.TransferStatus);
            actionRef.current?.reload();
          }}
          items={getStatusTabs(activeType)}
        />
      </div>
      <ProTable<API.Transfer>
        headerTitle={`${TRANSFER_TYPE_TEXT[activeType]}列表`}
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        search={false}
        request={async () => {
          const data = await getTransfers({ status: activeStatus, type: activeType });
          return { data, success: true };
        }}
        toolBarRender={() => (
          canCreateCurrentType
            ? [
                <ModalForm
                  key="create"
                  title={activeType === 'physical_transfer' ? '发起实物调拨' : '发起账面划转'}
                  trigger={
                    <Button type="primary">
                      {activeType === 'physical_transfer' ? '发起调拨' : '发起账面划转'}
                    </Button>
                  }
                  width={560}
                  onFinish={async (values) => {
                    const validItems = transferItems.filter((item) => item.productId && item.quantity && item.quantity > 0);
                    if (!validItems.length) {
                      message.error('请添加商品和数量');
                      return false;
                    }

                    await createTransfer({
                      type: activeType,
                      fromStoreId: isOwner ? values.fromStoreId : undefined,
                      toStoreId: values.toStoreId,
                      items: validItems as { productId: number; quantity: number }[],
                      reasonCode: values.reasonCode,
                      note: values.note,
                    });
                    message.success(activeType === 'physical_transfer' ? '调拨单已提交' : '账面划转单已提交');
                    setTransferItems([{ key: 0 }]);
                    transferItemKeyRef.current = 1;
                    actionRef.current?.reload();
                    return true;
                  }}
                  modalProps={{
                    destroyOnHidden: true,
                    afterOpenChange: (open) => {
                      if (!open) {
                        setTransferItems([{ key: 0 }]);
                        transferItemKeyRef.current = 1;
                      }
                    },
                  }}
                >
                  {isOwner && (
                    <ProFormSelect
                      name="fromStoreId"
                      label="调出门店"
                      options={stores.map((store) => ({ label: store.name, value: store.id }))}
                      rules={[{ required: true, message: '请选择调出门店' }]}
                    />
                  )}
                  <ProFormSelect
                    name="toStoreId"
                    label="调入门店"
                    options={stores
                      .filter((store) => isOwner || store.id !== currentUser?.storeId)
                      .map((store) => ({ label: store.name, value: store.id }))}
                    rules={[{ required: true, message: '请选择调入门店' }]}
                  />
                  <ProFormSelect
                    name="reasonCode"
                    label="原因"
                    options={REASON_OPTIONS[activeType]}
                    rules={[{ required: true, message: '请选择原因' }]}
                  />
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ marginBottom: 8, fontWeight: 500 }}>
                      商品明细 <span style={{ color: '#ff4d4f' }}>*</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
                      至少添加一件商品，并填写数量
                    </div>
                    {transferItems.map((item, idx) => (
                      <div
                        key={item.key}
                        style={{
                          background: idx % 2 === 0 ? '#fafafa' : '#fff',
                          padding: 8,
                          marginBottom: 8,
                          borderRadius: 4,
                          border: '1px solid #d9d9d9',
                        }}
                      >
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <Select
                            style={{ width: '100%' }}
                            placeholder="选择商品"
                            options={products.map((product) => ({
                              label: `${product.name} (${product.brand})`,
                              value: product.id,
                            }))}
                            value={item.productId}
                            onChange={(value) => {
                              const next = [...transferItems];
                              next[idx] = { ...next[idx], productId: value };
                              setTransferItems(next);
                            }}
                          />
                          <InputNumber
                            min={1}
                            placeholder="数量"
                            style={{ width: '100%' }}
                            value={item.quantity}
                            onChange={(value) => {
                              const next = [...transferItems];
                              next[idx] = { ...next[idx], quantity: value ?? undefined };
                              setTransferItems(next);
                            }}
                          />
                          <Button
                            danger
                            size="small"
                            onClick={() => setTransferItems(transferItems.filter((_, rowIndex) => rowIndex !== idx))}
                          >
                            删除此行
                          </Button>
                        </Space>
                      </div>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() => {
                        setTransferItems([
                          ...transferItems,
                          { key: transferItemKeyRef.current++, productId: undefined, quantity: undefined },
                        ]);
                      }}
                      block
                    >
                      + 添加商品
                    </Button>
                  </div>
                  <ProFormText
                    name="note"
                    label="备注"
                    fieldProps={{
                      placeholder: activeType === 'physical_transfer' ? '例如：中关村店周末活动补货' : '例如：线下已完成搬货，系统补记账',
                    }}
                  />
                </ModalForm>,
              ]
            : []
        )}
      />
    </>
  );
}

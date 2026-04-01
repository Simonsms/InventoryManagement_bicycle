import { useModel } from '@umijs/max';
import { App, Button, Drawer, InputNumber, Space, Table, Tag } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { ActionType, ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import {
  completeStocktake,
  createStocktake,
  getStocktakeItems,
  getStocktakes,
  updateStocktakeItems,
} from '@/services/api';
import dayjs from 'dayjs';

export default function StocktakesPage() {
  const { message, modal } = App.useApp();
  const { initialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser;
  const isAdminOrOwner = currentUser?.role === 'shop_owner' || currentUser?.role === 'store_admin';
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [itemsDrawer, setItemsDrawer] = useState<{ open: boolean; stocktake?: API.Stocktake }>({ open: false });
  const [items, setItems] = useState<(API.StocktakeItem & { editQty?: number })[]>([]);
  const [saving, setSaving] = useState(false);

  const openItems = async (stocktake: API.Stocktake) => {
    setItemsDrawer({ open: true, stocktake });
    const data = await getStocktakeItems(stocktake.id);
    setItems(data.map(i => ({ ...i, editQty: i.actualQty ?? undefined })));
  };

  const handleSaveItems = async () => {
    if (!itemsDrawer.stocktake) return;
    setSaving(true);
    try {
      await updateStocktakeItems(
        itemsDrawer.stocktake.id,
        items.map(i => ({ productId: i.productId, actualQty: i.editQty ?? i.systemQty })),
      );
      message.success('已保存');
      // 刷新本地差值显示
      setItems(prev => prev.map(i => ({
        ...i,
        actualQty: i.editQty ?? i.actualQty,
        difference: (i.editQty ?? i.actualQty ?? i.systemQty) - i.systemQty,
      })));
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!itemsDrawer.stocktake) return;
    await completeStocktake(itemsDrawer.stocktake.id);
    message.success('盘点已提交，库存已调整');
    setItemsDrawer({ open: false });
    actionRef.current?.reload();
  };

  const columns: ProColumns<API.Stocktake>[] = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '门店', dataIndex: ['store', 'name'], width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_, r) => (
        <Tag color={r.status === 'open' ? 'blue' : 'green'}>
          {r.status === 'open' ? '进行中' : '已完成'}
        </Tag>
      ),
    },
    { title: '创建人', dataIndex: ['creator', 'name'], width: 80 },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 140,
      render: v => dayjs(v as string).format('MM-DD HH:mm'),
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      width: 140,
      render: v => v ? dayjs(v as string).format('MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      width: 100,
      render: (_, record) => (
        <Button size="small" onClick={() => openItems(record)}>
          {record.status === 'open' ? '填写明细' : '查看明细'}
        </Button>
      ),
    },
  ];

  return (
    <>
      <ProTable<API.Stocktake>
        headerTitle="盘点记录"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        search={false}
        request={async () => {
          const data = await getStocktakes();
          return { data, success: true };
        }}
        toolBarRender={() =>
          isAdminOrOwner
            ? [
                <Button
                  key="create"
                  type="primary"
                  onClick={() =>
                    modal.confirm({
                      title: '新建盘点单？',
                      content: '将对当前门店所有商品创建库存快照，请确认。',
                      onOk: async () => {
                        await createStocktake();
                        message.success('盘点单已创建');
                        actionRef.current?.reload();
                      },
                    })
                  }
                >
                  新建盘点
                </Button>,
              ]
            : []
        }
      />
      <Drawer
        title={`盘点明细 #${itemsDrawer.stocktake?.id}`}
        open={itemsDrawer.open}
        onClose={() => setItemsDrawer({ open: false })}
        width={700}
        extra={
          itemsDrawer.stocktake?.status === 'open' && (
            <Space>
              <Button onClick={handleSaveItems} loading={saving}>保存</Button>
              <Button
                type="primary"
                onClick={() =>
                  modal.confirm({
                    title: '提交盘点？',
                    content: '提交后将根据差异自动调整库存，不可撤销。',
                    onOk: handleComplete,
                  })
                }
              >
                提交盘点
              </Button>
            </Space>
          )
        }
      >
        <Table
          dataSource={items}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            { title: '商品', dataIndex: ['product', 'name'], ellipsis: true },
            { title: '品牌', dataIndex: ['product', 'brand'], width: 80 },
            { title: '系统数量', dataIndex: 'systemQty', width: 90 },
            {
              title: '实际数量',
              width: 120,
              render: (_, record, idx) =>
                itemsDrawer.stocktake?.status === 'open' ? (
                  <InputNumber
                    min={0}
                    value={record.editQty}
                    onChange={v =>
                      setItems(prev =>
                        prev.map((i, ii) => (ii === idx ? { ...i, editQty: v ?? undefined } : i)),
                      )
                    }
                  />
                ) : (
                  record.actualQty ?? '-'
                ),
            },
            {
              title: '差异',
              width: 80,
              render: (_, record) => {
                const actual = record.editQty ?? record.actualQty;
                if (actual === null || actual === undefined) return '-';
                const diff = actual - record.systemQty;
                if (diff === 0) return <Tag>持平</Tag>;
                return <Tag color={diff > 0 ? 'green' : 'red'}>{diff > 0 ? `+${diff}` : diff}</Tag>;
              },
            },
            { title: '备注', dataIndex: 'note', ellipsis: true },
          ]}
        />
      </Drawer>
    </>
  );
}

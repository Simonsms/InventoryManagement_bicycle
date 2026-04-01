import { useNavigate } from '@umijs/max';
import { App, Button, Space, Tabs, Tag } from 'antd';
import { useRef, useState } from 'react';
import { ActionType, ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { getLowStockAlerts, getStaleInventory } from '@/services/api';

export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState('lowstock');
  const actionRef = useRef<ActionType | undefined>(undefined);
  const navigate = useNavigate();

  const lowStockColumns: ProColumns<API.Inventory>[] = [
    { title: '门店', dataIndex: ['store', 'name'], width: 100 },
    { title: '商品', dataIndex: ['product', 'name'], ellipsis: true },
    { title: '品牌', dataIndex: ['product', 'brand'], width: 90 },
    {
      title: '库存',
      dataIndex: 'quantity',
      width: 80,
      render: (_, r) => <Tag color="red">{r.quantity}</Tag>,
    },
    {
      title: '预警阈值',
      dataIndex: ['product', 'lowStockThreshold'],
      width: 90,
    },
    {
      title: '操作',
      width: 90,
      render: (_, record) => (
        <Button
          size="small"
          type="primary"
          onClick={() => navigate('/inventory')}
        >
          去入库
        </Button>
      ),
    },
  ];

  const staleColumns: ProColumns<API.Inventory>[] = [
    { title: '门店', dataIndex: ['store', 'name'], width: 100 },
    { title: '商品', dataIndex: ['product', 'name'], ellipsis: true },
    { title: '品牌', dataIndex: ['product', 'brand'], width: 90 },
    {
      title: '库存',
      dataIndex: 'quantity',
      width: 80,
      render: q => <Tag color="orange">{q as number}</Tag>,
    },
    {
      title: '最后更新',
      dataIndex: 'updatedAt',
      width: 120,
      render: v => new Date(v as string).toLocaleDateString('zh-CN'),
    },
  ];

  return (
    <>
      <div style={{ background: '#fff', padding: '0 24px', marginBottom: 16 }}>
        <Tabs
          activeKey={activeTab}
          onChange={key => { setActiveTab(key); actionRef.current?.reload(); }}
          items={[
            { key: 'lowstock', label: '低库存预警' },
            { key: 'stale', label: '滞销品（90天）' },
          ]}
        />
      </div>
      {activeTab === 'lowstock' && (
        <ProTable<API.Inventory>
          headerTitle="低库存预警"
          actionRef={actionRef}
          rowKey="id"
          columns={lowStockColumns}
          search={false}
          request={async () => {
            const data = await getLowStockAlerts();
            return { data, success: true };
          }}
        />
      )}
      {activeTab === 'stale' && (
        <ProTable<API.Inventory>
          headerTitle="滞销品（90天无出库）"
          actionRef={actionRef}
          rowKey="id"
          columns={staleColumns}
          search={false}
          request={async () => {
            const data = await getStaleInventory({ days: 90 });
            return { data, success: true };
          }}
        />
      )}
    </>
  );
}

import { App, Badge, Select, Tag } from 'antd';
import { useRef } from 'react';
import { ActionType, ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { getMovements } from '@/services/api';
import dayjs from 'dayjs';

const TYPE_LABELS: Record<API.MovementType, { text: string; color: string }> = {
  in: { text: '采购入库', color: 'green' },
  out: { text: '销售出库', color: 'red' },
  transfer_in: { text: '调拨入库', color: 'blue' },
  transfer_out: { text: '调拨出库', color: 'orange' },
  adjust: { text: '盘点调整', color: 'purple' },
};

export default function MovementsPage() {
  const actionRef = useRef<ActionType>();

  const columns: ProColumns<API.StockMovement>[] = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 160,
      search: false,
      render: (_, r) => dayjs(r.createdAt).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '门店',
      dataIndex: ['store', 'name'],
      width: 100,
      search: false,
    },
    {
      title: '商品',
      dataIndex: ['product', 'name'],
      ellipsis: true,
      search: false,
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 110,
      renderFormItem: () => (
        <Select
          allowClear
          options={Object.entries(TYPE_LABELS).map(([v, { text }]) => ({ label: text, value: v }))}
        />
      ),
      render: (_, r) => {
        const info = TYPE_LABELS[r.type];
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 80,
      search: false,
      render: (_, r) => (
        <span style={{ color: r.quantity > 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>
          {r.quantity > 0 ? `+${r.quantity}` : r.quantity}
        </span>
      ),
    },
    { title: '单据号', dataIndex: 'referenceNo', width: 120, search: false },
    { title: '备注', dataIndex: 'note', ellipsis: true, search: false },
    { title: '操作人', dataIndex: ['operator', 'name'], width: 80, search: false },
  ];

  return (
    <ProTable<API.StockMovement>
      headerTitle="出入库流水"
      actionRef={actionRef}
      rowKey="id"
      columns={columns}
      request={async (params, sort, filter) => {
        const res = await getMovements({
          type: params.type,
          page: params.current,
          page_size: params.pageSize,
        });
        return { data: res.list, total: res.total, success: true };
      }}
      pagination={{ defaultPageSize: 50 }}
      search={{ labelWidth: 'auto' }}
    />
  );
}

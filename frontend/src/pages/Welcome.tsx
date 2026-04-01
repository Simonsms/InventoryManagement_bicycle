import { useNavigate } from '@umijs/max';
import { Alert, Badge, Button, Card, Col, Row, Skeleton, Space, Statistic, Table, Tag, Typography } from 'antd';
import {
  AlertOutlined,
  ApartmentOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { getDashboard } from '@/services/api';

const { Title, Text } = Typography;

type DashboardData = {
  totalSkus: number;
  lowStockCount: number;
  pendingTransferCount: number;
  storeStats: { storeId: number; storeName: string; totalQty: number; skuCount: number }[];
  lowStockItems: API.Inventory[];
  pendingTransfers: API.Transfer[];
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(() => setError('加载仪表盘数据失败'))
      .finally(() => setLoading(false));
  }, []);

  if (error) {
    return <Alert type="error" message={error} style={{ margin: 24 }} />;
  }

  return (
    <div style={{ padding: 24 }}>
      {/* 统计卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card>
            <Skeleton loading={loading} active paragraph={false}>
              <Statistic
                title="活跃商品 SKU"
                value={data?.totalSkus ?? 0}
                prefix={<DatabaseOutlined style={{ color: '#1677ff' }} />}
                suffix="个"
              />
            </Skeleton>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/alerts')}
          >
            <Skeleton loading={loading} active paragraph={false}>
              <Statistic
                title="低库存预警"
                value={data?.lowStockCount ?? 0}
                prefix={<AlertOutlined style={{ color: data?.lowStockCount ? '#ff4d4f' : '#52c41a' }} />}
                suffix="条"
                valueStyle={{ color: data?.lowStockCount ? '#ff4d4f' : undefined }}
              />
            </Skeleton>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/transfers')}
          >
            <Skeleton loading={loading} active paragraph={false}>
              <Statistic
                title="待审批调拨"
                value={data?.pendingTransferCount ?? 0}
                prefix={<ClockCircleOutlined style={{ color: data?.pendingTransferCount ? '#faad14' : '#52c41a' }} />}
                suffix="单"
                valueStyle={{ color: data?.pendingTransferCount ? '#faad14' : undefined }}
              />
            </Skeleton>
          </Card>
        </Col>
      </Row>

      {/* 各门店库存概览 */}
      {(data?.storeStats?.length ?? 0) > 0 && (
        <Card
          title={
            <Space>
              <ApartmentOutlined />
              <span>门店库存概览</span>
            </Space>
          }
          style={{ marginTop: 16 }}
        >
          <Row gutter={[12, 12]}>
            {data!.storeStats.map(s => (
              <Col key={s.storeId} xs={24} sm={12} md={8} lg={6}>
                <Card size="small" style={{ background: '#fafafa' }}>
                  <Title level={5} style={{ marginBottom: 4 }}>{s.storeName}</Title>
                  <Space direction="vertical" size={0}>
                    <Text type="secondary">库存总量：<Text strong>{s.totalQty}</Text> 件</Text>
                    <Text type="secondary">在库 SKU：<Text strong>{s.skuCount}</Text> 个</Text>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* 低库存预警列表 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <AlertOutlined style={{ color: '#ff4d4f' }} />
                <span>低库存预警</span>
                {(data?.lowStockCount ?? 0) > 5 && (
                  <Tag color="red">还有 {(data?.lowStockCount ?? 0) - 5} 条</Tag>
                )}
              </Space>
            }
            extra={
              <Button size="small" type="link" onClick={() => navigate('/alerts')}>
                查看全部
              </Button>
            }
          >
            <Table
              dataSource={data?.lowStockItems ?? []}
              rowKey="id"
              size="small"
              pagination={false}
              loading={loading}
              locale={{ emptyText: '暂无低库存预警' }}
              columns={[
                { title: '门店', dataIndex: ['store', 'name'], width: 80 },
                { title: '商品', dataIndex: ['product', 'name'], ellipsis: true },
                {
                  title: '库存',
                  dataIndex: 'quantity',
                  width: 70,
                  render: (q: number) => <Tag color="red">{q}</Tag>,
                },
                {
                  title: '操作',
                  width: 70,
                  render: () => (
                    <Button size="small" type="primary" onClick={() => navigate('/inventory')}>
                      入库
                    </Button>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        {/* 待审批调拨列表 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <SwapOutlined style={{ color: '#faad14' }} />
                <span>待审批调拨</span>
                {(data?.pendingTransferCount ?? 0) > 5 && (
                  <Tag color="orange">还有 {(data?.pendingTransferCount ?? 0) - 5} 条</Tag>
                )}
              </Space>
            }
            extra={
              <Button size="small" type="link" onClick={() => navigate('/transfers')}>
                查看全部
              </Button>
            }
          >
            <Table
              dataSource={data?.pendingTransfers ?? []}
              rowKey="id"
              size="small"
              pagination={false}
              loading={loading}
              locale={{ emptyText: '暂无待审批调拨' }}
              columns={[
                {
                  title: '单号',
                  dataIndex: 'id',
                  width: 70,
                  render: (id: number) => `TF-${id}`,
                },
                { title: '调出', dataIndex: ['fromStore', 'name'], width: 80 },
                { title: '调入', dataIndex: ['toStore', 'name'], width: 80 },
                { title: '申请人', dataIndex: ['requester', 'name'], width: 80 },
                {
                  title: '操作',
                  width: 70,
                  render: () => (
                    <Button size="small" onClick={() => navigate('/transfers')}>
                      审批
                    </Button>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

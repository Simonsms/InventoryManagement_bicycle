import { App, Button, Card, Col, List, Row, Space, Typography, Upload } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { importInventory, importProducts } from '@/services/api';

const { Dragger } = Upload;
const { Text, Title } = Typography;

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

function ImportCard({
  title,
  description,
  templateCols,
  onImport,
}: {
  title: string;
  description: string;
  templateCols: string;
  onImport: (file: File) => Promise<ImportResult>;
}) {
  const { message } = App.useApp();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async (file: File) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await onImport(file);
      setResult(res);
      if (res.failed === 0) {
        message.success(`导入完成：成功 ${res.success} 条`);
      } else {
        message.warning(`导入完成：成功 ${res.success} 条，失败 ${res.failed} 条`);
      }
    } catch {
      message.error('导入失败，请检查文件格式或网络连接');
    } finally {
      setLoading(false);
    }
    // 返回 false 阻止 antd Upload 自动上传
    return false;
  };

  return (
    <Card title={title} style={{ height: '100%' }}>
      <Typography.Paragraph type="secondary">{description}</Typography.Paragraph>
      <Typography.Paragraph>
        <Text strong>模板列：</Text>
        <Text code>{templateCols}</Text>
      </Typography.Paragraph>

      <Dragger
        accept=".xlsx,.xls,.csv"
        showUploadList={false}
        beforeUpload={(file) => {
          handleUpload(file);
          return false;
        }}
        disabled={loading}
        style={{ marginBottom: 16 }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">支持 .xlsx / .xls / .csv 格式</p>
      </Dragger>

      {loading && <Text type="secondary">正在导入，请稍候...</Text>}

      {result && (
        <div style={{ marginTop: 12 }}>
          <Space>
            <Text type="success">成功：{result.success} 条</Text>
            {result.failed > 0 && <Text type="danger">失败：{result.failed} 条</Text>}
          </Space>
          {result.errors.length > 0 && (
            <List
              size="small"
              style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto', background: '#fff2f0', padding: 8, borderRadius: 4 }}
              dataSource={result.errors}
              renderItem={(e) => (
                <List.Item style={{ padding: '2px 0', color: '#cf1322', fontSize: 12 }}>
                  {e}
                </List.Item>
              )}
            />
          )}
        </div>
      )}
    </Card>
  );
}

export default function ImportPage() {
  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>Excel 批量导入</Title>
      <Row gutter={24}>
        <Col xs={24} md={12}>
          <ImportCard
            title="批量导入商品"
            description="从 Excel 批量创建商品信息。若分类不存在，系统将自动创建。"
            templateCols="分类名称 | 品牌 | 商品名称 | 型号 | 规格 | 质保月数 | 预警阈值"
            onImport={importProducts}
          />
        </Col>
        <Col xs={24} md={12}>
          <ImportCard
            title="批量入库"
            description="从 Excel 批量创建入库记录，商品需已在系统中存在。每行创建一个批次。"
            templateCols="商品名称 | 品牌 | 数量 | 进货日期 | 成本价 | 批次号"
            onImport={importInventory}
          />
        </Col>
      </Row>
    </div>
  );
}

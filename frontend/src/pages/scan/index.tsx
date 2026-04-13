import { App, Button, Card, Form, Input, InputNumber, Select, Space } from 'antd';
import { CameraOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons';
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { createProduct, getCategories } from '@/services/api';
import { history } from '@umijs/max';
import './index.less';

export default function ScanPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [categories, setCategories] = useState<API.Category[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState<string>('');
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerInitialized = useRef(false);

  useEffect(() => {
    getCategories().then(setCategories);
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-reader');
      }

      if (scannerInitialized.current) {
        return;
      }

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          setScannedCode(decodedText);
          form.setFieldsValue({ barcode: decodedText });
          stopScanner();
          message.success('扫码成功');
        },
        () => {
          // 扫码失败，静默处理
        }
      );

      scannerInitialized.current = true;
      setScanning(true);
    } catch (err) {
      message.error('无法启动摄像头，请检查权限设置');
      console.error('Scanner error:', err);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && scannerInitialized.current) {
      try {
        await html5QrCodeRef.current.stop();
        scannerInitialized.current = false;
        setScanning(false);
      } catch (err) {
        console.error('Stop scanner error:', err);
      }
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await createProduct(values);
      message.success('商品录入成功');
      form.resetFields();
      setScannedCode('');
    } catch (err: any) {
      message.error(err.message || '录入失败');
    }
  };

  const handleReset = () => {
    form.resetFields();
    setScannedCode('');
  };

  return (
    <div className="scan-page">
      <div className="scan-header">
        <h2>扫码录入商品</h2>
        <Button
          type="text"
          icon={<CloseOutlined />}
          onClick={() => history.push('/products')}
        />
      </div>

      <div className="scan-content">
        {/* 扫码区域 */}
        <Card className="scanner-card">
          <div id="qr-reader" style={{ width: '100%' }} />

          {!scanning && (
            <div className="scanner-placeholder">
              <CameraOutlined style={{ fontSize: 48, color: '#999' }} />
              <p>点击下方按钮开始扫码</p>
            </div>
          )}

          <Space style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}>
            {!scanning ? (
              <Button type="primary" size="large" icon={<CameraOutlined />} onClick={startScanner}>
                开始扫码
              </Button>
            ) : (
              <Button size="large" danger onClick={stopScanner}>
                停止扫码
              </Button>
            )}
          </Space>

          {scannedCode && (
            <div className="scanned-result">
              <p>已扫描: <strong>{scannedCode}</strong></p>
            </div>
          )}
        </Card>

        {/* 商品信息表单 */}
        <Card title="商品信息" className="form-card">
          <Form form={form} layout="vertical">
            <Form.Item
              label="条形码/二维码"
              name="barcode"
              rules={[{ required: true, message: '请输入或扫描条形码' }]}
            >
              <Input placeholder="扫码自动填充或手动输入" size="large" />
            </Form.Item>

            <Form.Item
              label="商品名称"
              name="name"
              rules={[{ required: true, message: '请输入商品名称' }]}
            >
              <Input placeholder="例如：捷安特 ATX 810" size="large" />
            </Form.Item>

            <Form.Item
              label="品牌"
              name="brand"
              rules={[{ required: true, message: '请输入品牌' }]}
            >
              <Input placeholder="例如：捷安特" size="large" />
            </Form.Item>

            <Form.Item
              label="型号"
              name="modelNumber"
              rules={[{ required: true, message: '请输入型号' }]}
            >
              <Input placeholder="例如：ATX 810" size="large" />
            </Form.Item>

            <Form.Item
              label="分类"
              name="categoryId"
              rules={[{ required: true, message: '请选择分类' }]}
            >
              <Select
                placeholder="选择分类"
                size="large"
                options={categories.map(c => ({ label: c.name, value: c.id }))}
              />
            </Form.Item>

            <Form.Item label="预警阈值" name="lowStockThreshold">
              <InputNumber
                placeholder="库存低于此值时预警"
                size="large"
                style={{ width: '100%' }}
                min={0}
              />
            </Form.Item>

            <Form.Item label="质保期(月)" name="warrantyMonths">
              <InputNumber
                placeholder="质保月数"
                size="large"
                style={{ width: '100%' }}
                min={0}
              />
            </Form.Item>

            <Form.Item>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Button size="large" icon={<ReloadOutlined />} onClick={handleReset}>
                  重置
                </Button>
                <Button type="primary" size="large" onClick={handleSubmit}>
                  提交录入
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
}

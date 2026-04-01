import { App, Card, Form, InputNumber, Skeleton, Space, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { ProForm, ProFormDigit } from '@ant-design/pro-components';
import { getSettings, updateSettings } from '@/services/api';

export default function SettingsConfigPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();

  useEffect(() => {
    getSettings()
      .then(data => form.setFieldsValue(data))
      .finally(() => setLoading(false));
  }, []);

  const handleFinish = async (values: { staleDays: number; lowStockDefault: number }) => {
    await updateSettings(values);
    message.success('系统参数已保存');
  };

  return (
    <Card title="系统参数配置" style={{ maxWidth: 520 }}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>
        以下参数影响全局预警和统计逻辑，修改后立即生效。
      </Typography.Paragraph>
      <Skeleton loading={loading} active paragraph={{ rows: 4 }}>
        <ProForm form={form} onFinish={handleFinish} submitter={{ searchConfig: { submitText: '保存' } }}>
          <ProFormDigit
            name="staleDays"
            label="滞销品判断天数"
            tooltip="超过此天数无出库记录（且有库存）的商品视为滞销品"
            min={1}
            max={365}
            rules={[{ required: true, message: '请输入天数' }]}
            fieldProps={{ addonAfter: '天' }}
          />
          <ProFormDigit
            name="lowStockDefault"
            label="新商品默认低库存阈值"
            tooltip="新建商品时自动填入的预警阈值，已有商品不受影响"
            min={0}
            max={9999}
            rules={[{ required: true, message: '请输入阈值' }]}
            fieldProps={{ addonAfter: '件' }}
          />
        </ProForm>
      </Skeleton>
    </Card>
  );
}

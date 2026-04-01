import { useModel } from '@umijs/max';
import { App, Button, Form, Modal, Select, Space, Tag } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { ActionType, ModalForm, ProFormSelect, ProFormText, ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { deactivateUser, getStores, getUsers, updateUser } from '@/services/api';

const ROLE_NAMES: Record<API.RoleName, { text: string; color: string }> = {
  shop_owner: { text: '店长', color: 'purple' },
  store_admin: { text: '管理员', color: 'blue' },
  staff: { text: '员工', color: 'default' },
};

export default function UsersPage() {
  const { message, modal } = App.useApp();
  const { initialState } = useModel('@@initialState');
  const actionRef = useRef<ActionType>();
  const [roles, setRoles] = useState<API.Role[]>([]);
  const [stores, setStores] = useState<API.Store[]>([]);
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<API.User | null>(null);

  // 模拟 role 数据（实际应从 /api/v1/roles 获取，简化为硬编码）
  useEffect(() => {
    const mockRoles: API.Role[] = [
      { id: 1, name: 'shop_owner' },
      { id: 2, name: 'store_admin' },
      { id: 3, name: 'staff' },
    ];
    setRoles(mockRoles);
    getStores().then(setStores);
  }, []);

  const columns: ProColumns<API.User>[] = [
    { title: '姓名', dataIndex: 'name' },
    { title: '邮箱', dataIndex: 'email' },
    {
      title: '角色',
      dataIndex: ['role', 'name'],
      render: r => {
        const info = ROLE_NAMES[r as API.RoleName];
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    { title: '归属门店', dataIndex: ['store', 'name'] },
    { title: '创建时间', dataIndex: 'createdAt', search: false, width: 140 },
    {
      title: '操作',
      width: 150,
      search: false,
      render: (_, record) => (
        <Space>
          <ModalForm
            title="编辑用户"
            trigger={<Button size="small">编辑</Button>}
            form={form}
            initialValues={record}
            onFinish={async (values) => {
              await updateUser(record.id, values);
              message.success('已更新');
              actionRef.current?.reload();
              return true;
            }}
          >
            <ProFormText name="name" label="姓名" rules={[{ required: true }]} />
            <ProFormSelect
              name="roleId"
              label="角色"
              options={roles.map(r => ({ label: ROLE_NAMES[r.name].text, value: r.id }))}
              rules={[{ required: true }]}
            />
            <ProFormSelect
              name="storeId"
              label="归属门店"
              allowClear
              options={stores.map(s => ({ label: s.name, value: s.id }))}
            />
            <ProFormText name="password" label="新密码（留空则不改）" />
          </ModalForm>
          {record.id !== initialState?.currentUser?.id && (
            <Button
              size="small"
              danger
              onClick={() =>
                modal.confirm({
                  title: '确认停用该用户？',
                  onOk: async () => {
                    await deactivateUser(record.id);
                    actionRef.current?.reload();
                  },
                })
              }
            >
              停用
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <ProTable<API.User>
      headerTitle="用户列表"
      actionRef={actionRef}
      rowKey="id"
      columns={columns}
      request={async () => {
        const data = await getUsers();
        return { data, success: true };
      }}
    />
  );
}

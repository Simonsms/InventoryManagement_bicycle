import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { LoginForm, ProFormText } from '@ant-design/pro-components';
import { Helmet, SelectLang, useModel } from '@umijs/max';
import { App } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { flushSync } from 'react-dom';
import { Footer } from '@/components';
import { loginApi } from '@/services/auth';
import Settings from '../../../../config/defaultSettings';

const useStyles = createStyles(({ token }) => {
  return {
    lang: {
      width: 42,
      height: 42,
      lineHeight: '42px',
      position: 'fixed',
      right: 16,
      borderRadius: token.borderRadius,
      ':hover': {
        backgroundColor: token.colorBgTextHover,
      },
    },
    container: {
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'auto',
      backgroundImage:
        "url('https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/V-_oS6r-i7wAAAAAAAAAAAAAFl94AQBr')",
      backgroundSize: '100% 100%',
    },
  };
});

const Login: React.FC = () => {
  const { initialState, setInitialState } = useModel('@@initialState');
  const { styles } = useStyles();
  const { message } = App.useApp();

  const handleSubmit = async (values: { email: string; password: string }) => {
    try {
      const result = await loginApi(values);
      localStorage.setItem('accessToken', result.accessToken);
      localStorage.setItem('refreshToken', result.refreshToken);

      const userInfo = await initialState?.fetchUserInfo?.();
      if (userInfo) {
        flushSync(() => {
          setInitialState((s) => ({ ...s, currentUser: userInfo }));
        });
      }

      message.success('登录成功！');
      const urlParams = new URL(window.location.href).searchParams;
      window.location.href = urlParams.get('redirect') || '/';
    } catch (_error) {
      message.error('邮箱或密码错误，请重试！');
    }
  };

  return (
    <div className={styles.container}>
      <Helmet>
        <title>登录 - {Settings.title}</title>
      </Helmet>
      <div className={styles.lang} data-lang>
        {SelectLang && <SelectLang />}
      </div>
      <div style={{ flex: '1', padding: '32px 0' }}>
        <LoginForm
          contentStyle={{ minWidth: 280, maxWidth: '75vw' }}
          logo={<img alt="logo" src="/logo.svg" />}
          title="自行车库存管理"
          subTitle="多门店公路车库存管理系统"
          onFinish={async (values) => {
            await handleSubmit(values as { email: string; password: string });
          }}
        >
          <ProFormText
            name="email"
            fieldProps={{
              size: 'large',
              prefix: <UserOutlined />,
              autoComplete: 'email',
            }}
            placeholder="请输入邮箱"
            rules={[
              { required: true, message: '请输入邮箱！' },
              { type: 'email', message: '邮箱格式不正确！' },
            ]}
          />
          <ProFormText.Password
            name="password"
            fieldProps={{
              size: 'large',
              prefix: <LockOutlined />,
              autoComplete: 'current-password',
            }}
            placeholder="请输入密码"
            rules={[{ required: true, message: '请输入密码！' }]}
          />
        </LoginForm>
      </div>
      <Footer />
    </div>
  );
};

export default Login;

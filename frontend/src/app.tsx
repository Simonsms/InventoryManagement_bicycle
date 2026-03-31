import type { RequestOptions } from '@@/plugin-request/request';
import type { Settings as LayoutSettings } from '@ant-design/pro-components';
import type { RequestConfig, RunTimeLayoutConfig } from '@umijs/max';
import { history } from '@umijs/max';
import React from 'react';
import { AvatarDropdown, AvatarName, Footer, SelectLang } from '@/components';
import defaultSettings from '../config/defaultSettings';
import { errorConfig } from './requestErrorConfig';
import type { CurrentUser } from '@/services/auth';
import { getCurrentUser } from '@/services/auth';

const loginPath = '/user/login';

export async function getInitialState(): Promise<{
  settings?: Partial<LayoutSettings>;
  currentUser?: CurrentUser;
  loading?: boolean;
  fetchUserInfo?: () => Promise<CurrentUser | undefined>;
}> {
  const fetchUserInfo = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return undefined;
    try {
      return await getCurrentUser();
    } catch (_error) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      history.push(loginPath);
      return undefined;
    }
  };

  const { location } = history;
  if (location.pathname !== loginPath) {
    const currentUser = await fetchUserInfo();
    return {
      fetchUserInfo,
      currentUser,
      settings: defaultSettings as Partial<LayoutSettings>,
    };
  }
  return {
    fetchUserInfo,
    settings: defaultSettings as Partial<LayoutSettings>,
  };
}

export const layout: RunTimeLayoutConfig = ({ initialState }) => {
  return {
    actionsRender: () => [<SelectLang key="SelectLang" />],
    avatarProps: {
      src: initialState?.currentUser?.avatar,
      title: <AvatarName />,
      render: (_, avatarChildren) => (
        <AvatarDropdown>{avatarChildren}</AvatarDropdown>
      ),
    },
    waterMarkProps: {
      content: initialState?.currentUser?.name,
    },
    footerRender: () => <Footer />,
    onPageChange: () => {
      const { location } = history;
      if (!initialState?.currentUser && location.pathname !== loginPath) {
        history.push(loginPath);
      }
    },
    menuHeaderRender: undefined,
    childrenRender: (children) => <>{children}</>,
    ...initialState?.settings,
  };
};

export const request: RequestConfig = {
  baseURL: '',
  ...errorConfig,
  requestInterceptors: [
    (config: RequestOptions) => {
      const token = localStorage.getItem('accessToken');
      if (token && config.headers) {
        (config.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
      }
      return config;
    },
  ],
  responseInterceptors: [
    (response) => response,
  ],
};

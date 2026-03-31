import type { RequestConfig } from '@umijs/max';
import { message } from 'antd';

export const errorConfig: RequestConfig = {
  errorConfig: {
    errorHandler: (error: any, opts: any) => {
      if (opts?.skipErrorHandler) throw error;
      if (error.response) {
        message.error(`请求失败：${error.response.status}`);
      } else if (error.request) {
        message.error('网络异常，请检查网络连接');
      } else {
        message.error('请求发送失败，请重试');
      }
    },
  },
};

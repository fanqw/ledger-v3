import type { MessageInstance } from 'antd/es/message/interface';

// antd message 实例由 App 组件（AntdApp.useApp）注入，避免模块级静态 message 的 context 警告
let messageApi: MessageInstance | null = null;

export function setMessageApi(api: MessageInstance | null) {
  messageApi = api;
}

export const toast = {
  success: (message: string) => messageApi?.success(message),
  error: (message: string) => messageApi?.error(message),
};

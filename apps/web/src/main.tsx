import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import './index.css';

// Material Design 主题：纸张隐喻 + 层级阴影 + 大圆角 + 触摸目标
// 表面白/浅灰，主色青蓝 #0288D1，阴影分层（卡片→对话框→FAB 逐级抬高）
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#3B82F6',
          colorInfo: '#3B82F6',
          colorLink: '#3B82F6',
          colorBgLayout: '#F6F8FC',
          colorBgContainer: '#FFFFFF',
          colorTextBase: '#0F172A',
          colorTextSecondary: '#64748B',
          colorBorder: '#E2E8F0',
          colorSplit: '#E8EDF4',
          borderRadius: 8,
          borderRadiusLG: 12,
          controlHeight: 36,
          // Material Elevation：卡片（shadow1）→ 对话框（shadow2）→ 弹层（shadow3）
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
          boxShadowSecondary: '0 10px 30px rgba(15, 23, 42, 0.10)',
          boxShadowTertiary: '0 16px 40px rgba(15, 23, 42, 0.14)',
        },
        components: {
          Layout: {
            headerBg: '#FFFFFF',
            siderBg: '#FFFFFF',
            bodyBg: '#F5F7FA',
          },
          Card: {
            boxShadowTertiary: '0 1px 4px rgba(2, 20, 40, 0.06)',
          },
          Table: {
            headerBg: '#F8FAFC',
            headerColor: '#475569',
            headerSplitColor: 'transparent',
          },
          Button: {
            primaryShadow: '0 2px 6px rgba(59, 130, 246, 0.35)',
          },
          FloatButton: {
            colorPrimary: '#3B82F6',
          },
        },
      }}
    >
      <AntdApp>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  </StrictMode>,
);

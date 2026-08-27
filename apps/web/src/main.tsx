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
          colorPrimary: '#0288D1',
          colorInfo: '#0288D1',
          colorLink: '#0288D1',
          colorBgLayout: '#F5F7FA',
          colorTextBase: '#0F172A',
          colorBorder: '#E5E7EB',
          borderRadius: 8,
          borderRadiusLG: 16,
          controlHeight: 36,
          // Material Elevation：卡片（shadow1）→ 对话框（shadow2）→ 弹层（shadow3）
          boxShadow: '0 1px 3px rgba(2, 20, 40, 0.08), 0 1px 2px rgba(2, 20, 40, 0.04)',
          boxShadowSecondary: '0 4px 12px rgba(2, 20, 40, 0.10)',
          boxShadowTertiary: '0 8px 24px rgba(2, 20, 40, 0.14)',
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
            primaryShadow: '0 2px 6px rgba(2, 136, 209, 0.35)',
          },
          FloatButton: {
            colorPrimary: '#0288D1',
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

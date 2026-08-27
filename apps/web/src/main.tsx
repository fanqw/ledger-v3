import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, App as AntdApp, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { ThemeProvider, useThemeMode } from './lib/theme';
import App from './App';
import './index.css';

function ThemedApp() {
  const { mode } = useThemeMode();
  const dark = mode === 'dark';
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#3B82F6',
          colorInfo: '#3B82F6',
          colorLink: '#3B82F6',
          colorBgLayout: dark ? '#000000' : '#F6F8FC',
          colorBgContainer: dark ? '#141414' : '#FFFFFF',
          colorTextBase: dark ? '#E5E7EB' : '#0F172A',
          colorTextSecondary: dark ? '#9CA3AF' : '#64748B',
          colorBorder: dark ? '#303030' : '#E2E8F0',
          colorSplit: dark ? '#303030' : '#E8EDF4',
          borderRadius: 8,
          borderRadiusLG: 12,
          controlHeight: 36,
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
          boxShadowSecondary: '0 10px 30px rgba(15, 23, 42, 0.10)',
          boxShadowTertiary: '0 16px 40px rgba(15, 23, 42, 0.14)',
        },
        components: {
          Layout: {
            headerBg: dark ? '#141414' : '#FFFFFF',
            siderBg: dark ? '#141414' : '#FFFFFF',
            bodyBg: dark ? '#000000' : '#F5F7FA',
          },
          Card: {
            boxShadowTertiary: '0 1px 4px rgba(2, 20, 40, 0.06)',
          },
          Table: {
            headerBg: dark ? '#1F1F1F' : '#F8FAFC',
            headerColor: dark ? '#9CA3AF' : '#475569',
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
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  </StrictMode>,
);

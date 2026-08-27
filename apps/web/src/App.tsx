import { Routes, Route, Navigate } from 'react-router-dom';
import { App as AntdApp } from 'antd';
import { AuthProvider, useAuth } from './lib/auth';
import { setGlobalAuth } from './lib/api';
import { setMessageApi } from './lib/toast';
import { lazy, Suspense, useEffect } from 'react';
import AppShell from './components/layout/AppShell';
import ChunkErrorBoundary from './components/ChunkErrorBoundary';

const LoginPage = lazy(() => import('./pages/Login'));
const CategoriesPage = lazy(() => import('./pages/Categories'));
const UnitsPage = lazy(() => import('./pages/Units'));
const CommoditiesPage = lazy(() => import('./pages/Commodities'));
const PurchasePlacesPage = lazy(() => import('./pages/PurchasePlaces'));
const OrdersPage = lazy(() => import('./pages/Orders'));
const OrderDetailPage = lazy(() => import('./pages/OrderDetail'));
const AnalyticsPage = lazy(() => import('./pages/Analytics'));

function AuthInit({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  useEffect(() => { setGlobalAuth(auth); }, [auth]);
  return <>{children}</>;
}

// 将 antd message 实例注入 lib/toast（供模块级 toast 调用）
function MessageBridge() {
  const { message } = AntdApp.useApp();
  useEffect(() => { setMessageApi(message); }, [message]);
  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function LoginRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <LoginPage />;
}

export default function App() {
  return (
    <>
      <MessageBridge />
      <AuthProvider>
        <AuthInit>
          <ChunkErrorBoundary>
            <Suspense fallback={(
            <div className="flex min-h-screen items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
          )}>
            <Routes>
            <Route path="/login" element={<LoginRedirect />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<div><h1 className="text-[18px] font-bold text-[#0F172A] dark:text-white">仪表台</h1><p className="mt-2 text-[#64748B] dark:text-[#94A3B8]">即将上线...</p></div>} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="orders/:id" element={<OrderDetailPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="units" element={<UnitsPage />} />
              <Route path="commodities" element={<CommoditiesPage />} />
              <Route path="purchase-places" element={<PurchasePlacesPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
            </Routes>
            </Suspense>
          </ChunkErrorBoundary>
        </AuthInit>
      </AuthProvider>
    </>
  );
}

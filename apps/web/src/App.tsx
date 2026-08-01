import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './lib/theme';
import { AuthProvider, useAuth } from './lib/auth';
import { setGlobalAuth } from './lib/api';
import { lazy, Suspense, useEffect } from 'react';
import AppShell from './components/layout/AppShell';

const LoginPage = lazy(() => import('./pages/Login'));
const CategoriesPage = lazy(() => import('./pages/Categories'));
const UnitsPage = lazy(() => import('./pages/Units'));
const CommoditiesPage = lazy(() => import('./pages/Commodities'));
const PurchasePlacesPage = lazy(() => import('./pages/PurchasePlaces'));

function AuthInit({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  useEffect(() => { setGlobalAuth(auth); }, [auth]);
  return <>{children}</>;
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
    <ThemeProvider>
      <AuthProvider>
        <AuthInit>
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
              <Route path="dashboard" element={<div className="p-6"><h1 className="text-[18px] font-bold text-[#0F172A] dark:text-white">仪表台</h1><p className="mt-2 text-[#64748B] dark:text-[#94A3B8]">即将上线...</p></div>} />
              <Route path="orders" element={<div className="p-6"><h1 className="text-[18px] font-bold text-[#0F172A] dark:text-white">订单管理</h1><p className="mt-2 text-[#64748B] dark:text-[#94A3B8]">即将上线...</p></div>} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="units" element={<UnitsPage />} />
              <Route path="commodities" element={<CommoditiesPage />} />
              <Route path="purchase-places" element={<PurchasePlacesPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
            </Routes>
          </Suspense>
        </AuthInit>
      </AuthProvider>
    </ThemeProvider>
  );
}

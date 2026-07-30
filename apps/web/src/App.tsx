import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './lib/theme';
import { AuthProvider, useAuth } from './lib/auth';
import { setGlobalAuth } from './lib/api';
import { useEffect } from 'react';
import LoginPage from './pages/Login';
import AppShell from './components/layout/AppShell';

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
          <Routes>
            <Route path="/login" element={<LoginRedirect />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthInit>
      </AuthProvider>
    </ThemeProvider>
  );
}

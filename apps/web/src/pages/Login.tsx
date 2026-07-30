import { useState, FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../lib/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err?.message || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC]">
      {/* Left Brand Panel */}
      <div className="hidden w-[576px] shrink-0 flex-col items-center justify-center gap-8 bg-brand-gradient p-12 lg:flex">
        <h1 className="text-[32px] font-bold text-white">台帐系统</h1>
        <p className="text-[14px] text-slate-400">精准记录 · 数据驱动 · 高效决策</p>
        <div className="flex h-[72px] w-[72px] items-end justify-center gap-1 rounded-2xl bg-logo-gradient p-[0_14px_16px] shadow-[0px_4px_16px_0px_#3B82F640]">
          <div className="h-6 w-1.5 rounded-sm bg-white" />
          <div className="h-8 w-1.5 rounded-sm bg-white" />
          <div className="h-[18px] w-1.5 rounded-sm bg-white" />
          <div className="h-7 w-1.5 rounded-sm bg-white" />
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex flex-1 items-center justify-center bg-white p-12">
        <form onSubmit={handleSubmit} className="flex w-full max-w-[400px] flex-col gap-6">
          <h2 className="text-[28px] font-bold text-[#0F172A]">欢迎登录</h2>
          <p className="text-[14px] text-[#475569]">请输入账户信息以继续</p>

          {error && (
            <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#475569]">用户名</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              className="bg-[#F8FAFC] border-[#E2E8F0] h-10 text-sm"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#475569]">密码</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-[#F8FAFC] border-[#E2E8F0] h-10 pr-10 text-sm"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            size="lg"
            className="h-12 w-full bg-[#3B82F6] text-[15px] font-semibold text-white shadow-btn hover:bg-blue-700"
          >
            {loading ? '登录中...' : '登 录'}
          </Button>
        </form>
      </div>

      {/* Small screen brand header */}
      <div className="fixed left-0 right-0 top-0 flex h-16 items-center justify-center gap-3 bg-brand-gradient lg:hidden">
        <div className="flex h-8 w-8 items-end justify-center gap-0.5 rounded-lg bg-logo-gradient p-[0_6px_8px]">
          <div className="h-3 w-[3px] rounded-sm bg-white" />
          <div className="h-4 w-[3px] rounded-sm bg-white" />
          <div className="h-2.5 w-[3px] rounded-sm bg-white" />
          <div className="h-3.5 w-[3px] rounded-sm bg-white" />
        </div>
        <span className="text-base font-bold text-white">台帐系统 V3</span>
      </div>
    </div>
  );
}

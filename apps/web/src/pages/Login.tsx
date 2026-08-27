import { useState } from 'react';
import { Form, Input, Button } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../lib/auth';
import { toast } from '../lib/toast';

interface LoginForm {
  username: string;
  password: string;
}

export default function LoginPage() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  async function onFinish(values: LoginForm) {
    if (loading) return;
    setLoading(true);
    try {
      await login(values.username, values.password);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '登录失败，请检查用户名和密码');
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
        <Form<LoginForm>
          onFinish={onFinish}
          className="w-full max-w-[400px]"
          size="large"
        >
          <h2 className="text-[28px] font-bold text-[#0F172A]">欢迎登录</h2>
          <p className="mb-6 text-[14px] text-[#475569]">请输入账户信息以继续</p>

          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              登 录
            </Button>
          </Form.Item>
        </Form>
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

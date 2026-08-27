import type { ReactNode } from 'react';
import { Button, Empty, Result, Skeleton } from 'antd';

export default function DataState({ loading, error, empty, onRetry, children }: {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (loading) return <div className="data-state"><Skeleton active paragraph={{ rows: 6 }} /></div>;
  if (error) return <Result status="error" title="加载失败" subTitle={error} extra={onRetry && <Button onClick={onRetry}>重新加载</Button>} />;
  if (empty) return <div className="data-state"><Empty description="暂无数据" /></div>;
  return <>{children}</>;
}

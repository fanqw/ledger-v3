import type { ReactNode } from 'react';
import { Typography } from 'antd';

export default function PageHeader({ title, description, actions }: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header__copy">
        <Typography.Title level={2}>{title}</Typography.Title>
        {description && <Typography.Text type="secondary">{description}</Typography.Text>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

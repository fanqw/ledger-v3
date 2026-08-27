import type { ReactNode } from 'react';

export default function PageToolbar({ children }: { children: ReactNode }) {
  return <section className="page-toolbar" aria-label="筛选与操作">{children}</section>;
}

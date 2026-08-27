import type { Key, ReactNode } from 'react';

export default function ResponsiveDataView<T>({ items, desktop, renderMobileItem, rowKey }: {
  items: T[];
  desktop: ReactNode;
  renderMobileItem: (item: T) => ReactNode;
  rowKey: (item: T) => Key;
}) {
  return (
    <>
      <div className="responsive-data__desktop">{desktop}</div>
      <div className="responsive-data__mobile" role="list">
        {items.map((item) => <div role="listitem" key={rowKey(item)}>{renderMobileItem(item)}</div>)}
      </div>
    </>
  );
}

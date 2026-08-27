import { Button, Space, App as AntdApp } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';

export default function RowActions({ label, onView, onEdit, onDelete }: {
  label: string;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void | Promise<void>;
}) {
  const { modal } = AntdApp.useApp();
  const confirmDelete = () => modal.confirm({
    title: `确定删除“${label}”？`,
    content: '删除后将无法恢复。',
    okText: '删除',
    okButtonProps: { danger: true },
    cancelText: '取消',
    onOk: onDelete,
  });
  return <Space size={2} className="row-actions">
    {onView && <Button type="text" icon={<EyeOutlined />} aria-label={`查看${label}`} onClick={onView} />}
    {onEdit && <Button type="text" icon={<EditOutlined />} aria-label={`编辑${label}`} onClick={onEdit} />}
    {onDelete && <Button type="text" danger icon={<DeleteOutlined />} aria-label={`删除${label}`} onClick={confirmDelete} />}
  </Space>;
}

import { Routes, Route, Navigate } from 'react-router-dom';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<div className="p-8 text-xl">仪表台（开发中）</div>} />
      <Route path="*" element={<div className="p-8">404 - 页面不存在</div>} />
    </Routes>
  );
}

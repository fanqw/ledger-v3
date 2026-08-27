# Design: ui-antd-migration

## 依赖设计

### 新增
```json
"antd": "^5.4.5",
"@ant-design/icons": "^5.0.0"
```

### 移除
`@radix-ui/react-*`（10 个）、`sonner`、`cmdk`、`react-day-picker`、`lucide-react`、`class-variance-authority`、`tailwind-merge`、`tailwindcss-animate`

### 保留
`tailwindcss`、`echarts`（Analytics 图表）、`react-router-dom`、`@ledger-v3/shared`

## 组件映射（`components/ui/` → antd）

| 自研组件 | antd 替代 | 说明 |
|----------|-----------|------|
| `button.tsx` | `Button` | size/variant 映射 antd 类型 |
| `input.tsx` | `Input` | |
| `dialog.tsx` | `Modal` | |
| `alert-dialog.tsx` | `Modal.confirm` / `Popconfirm` | 删除确认 |
| `select.tsx` | `Select` | 关联下拉（分类/单位/进货地） |
| `creatable-select.tsx` | `Select` + `AutoComplete` | 即输即建：搜索无匹配时动态建 |
| `data-table.tsx` | `Table` | columns/dataSource/pagination/search |
| `table.tsx` | `Table` | 明细表（rowSpan 合并单元格） |
| `label.tsx` | `Form.Item label` | |
| `popover.tsx` | `Popover` / `DatePicker.RangePicker` | Analytics 时间筛选 |
| `tooltip.tsx` | `Tooltip` | |
| `avatar.tsx` | `Avatar` | TopBar |
| `separator.tsx` | `Divider` | |
| `command.tsx` | （并入 Select/AutoComplete） | cmdk 移除 |

## 页面改造方案

### Login
- `Form` + `Input`（用户名/密码）+ `Button` + `message`（错误提示）
- 对齐 V1 login 页（UserOutlined/LockOutlined 图标前缀）

### 列表页（Categories/Units/Commodities/PurchasePlaces/Orders）
- **列表**：`Table`（columns 定义、`pagination` 受控、keyword 搜索 Input）
- **新增/编辑**：`Modal` + `Form`（`Form.Item` 校验、Zod schema 复用）
- **删除**：`Modal.confirm` 确认
- **关联下拉**（商品/订单）：`Select`（选项来自 fetchAllPages）
- **提示**：`message.success/error` 替代 sonner toast

### OrderDetail
- **明细表**：`Table`——对齐 V1 用 columns + `onCell` 返回 `rowSpan` 实现分类列/分类金额列合并，首行显示总金额；`isModified` 行金额 `style.color: red`
- **金额联动**：维持现有业务逻辑（数量×单价实时算、手动改标红），仅换 Form 控件
- **即输即建**：`AutoComplete`（输入商品名搜索，无匹配动态建）+ 分类/单位 `Select`
- **Excel 导出**：逻辑不变

### Analytics（V3 独有）
- UI：时间筛选 `DatePicker.RangePicker`、刷新 `Button`、KPI 卡片改用 antd 样式
- 图表：**ECharts 保留**（use-echarts 不变）

### 布局（AppShell/SideNav/TopBar）
- `Layout` + `Sider`（可折叠）+ `Menu`（items 定义，对齐 V1 layout）+ `Header`（TopBar：标题 + `Avatar` + `Dropdown` 用户菜单 + 登出）

## 全局方案

### 主题
```tsx
// main.tsx / App 根组件
<ConfigProvider theme={{ token: { colorPrimary: '#1677ff' } }}>
  <App>...</App>
</ConfigProvider>
```
V1 亮色默认主题，不保留 dark mode。

### message 适配
antd `message` 需要 `App` 组件包裹（`App.useApp()`）或静态方法。用 `App` 组件包裹应用，页面通过 `App.useApp()` 获取 `message` 实例（避免静态方法 warning）。

### toast 迁移
- `apps/web/src/lib/toast.ts`：改为包装 antd message（`toast.success/error` 内部调 `message`）
- 各页面 `toast()` 调用点保持接口不变，减少改动面

### 图标
lucide-react → `@ant-design/icons`（Pencil→EditOutlined、Trash2→DeleteOutlined、Plus→PlusOutlined、Eye→EyeOutlined 等）

### 组件目录清理
`components/ui/` 下被替换的自研组件删除；保留不复用的（如无）。

## 风险与注意
- antd Table 的 rowSpan 合并与当前自研实现不同，需按 antd columns `onCell` 重写合并逻辑
- CreatableSelect → AutoComplete 的即输即建交互需保持"搜索无匹配时动态创建"行为
- 分页受控：antd Table `pagination={{ current, pageSize, total, onChange }}` 与现有 pagination 状态对接
- ECharts 与 antd 样式共存无冲突

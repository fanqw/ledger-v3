# Proposal: ui-antd-migration

## Summary

将前端 UI 组件与交互从当前 radix-ui + tailwind 自研组件体系切换为 **Ant Design（antd v5）**，对齐 V1（ledger-v2/v1/ledger-frontend）的交互与视觉，降低用户在不同版本间的认知负担。后端 API、业务逻辑、数据结构不变。

## Motivation

当前 V3 前端使用 radix-ui 底层 + tailwind 自研组件（`components/ui/` 14 个），与 V1 的 antd 交互（Table 合并单元格、Modal 表单、message 提示等）不一致。用户反馈心智负担高——同一业务在两个版本操作方式不同。决定改回 V1 的 antd 组件体系，V1（antd 5.4.5）已有成熟交互范式可直接复用。

## Scope

### In Scope
- **依赖变更**：新增 `antd`（^5）+ `@ant-design/icons`；移除 `@radix-ui/*`、`sonner`、`cmdk`、`react-day-picker`、`lucide-react`、`class-variance-authority`、`tailwind-merge`、`tailwindcss-animate`
- **UI 组件替换**：`components/ui/` 自研组件 → antd 对应组件（Button/Input/Modal/Table/Select/Form/Popconfirm/AutoComplete/Tooltip/Avatar/Divider 等）
- **页面改造**（全部 8 页 + 布局）：
  - Login → antd Form
  - 列表页（Categories/Units/Commodities/PurchasePlaces/Orders）→ antd Table + Modal + Form + message
  - OrderDetail → antd Table（分类/金额合并单元格 rowSpan）+ Modal + AutoComplete（即输即建）
  - Analytics → UI 换 antd（Button/DatePicker/RangePicker），**ECharts 图表保留**（V3 独有功能，V1 无参照）
  - 布局（AppShell/SideNav/TopBar）→ antd Layout + Sider + Menu + Avatar + Dropdown（对齐 V1 layout）
- **全局替换**：
  - toast：sonner → antd `message`
  - 图标：lucide-react → `@ant-design/icons`
  - 主题：`ConfigProvider` + antd theme，**V1 亮色**（不保留 V3 暗色模式）
  - 样式：antd 自带样式 + **保留 tailwind**（页面布局/间距等自定义样式）

### Out of Scope
- 后端 API、数据结构、业务逻辑不改
- 即输即建/联动/标红等**业务行为**不变，仅换实现组件
- Analytics 图表库（ECharts）不换，仅页面 UI 组件换 antd
- 不引入 V1 没有的新交互

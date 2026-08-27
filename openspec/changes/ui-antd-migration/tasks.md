# Tasks: ui-antd-migration

## Task 1: 依赖安装与全局接入

- 安装 `antd`、`@ant-design/icons` 到 apps/web
- `main.tsx`：用 antd `ConfigProvider`（V1 亮色）+ `App` 组件包裹
- `lib/toast.ts`：改为包装 antd `message`（保持 `toast.success/error` 接口不变）
- 验证：`pnpm --filter web build` 通过

**Spec coverage**: Requirement "前端 UI 组件使用 Ant Design"

## Task 2: 布局（Layout/Menu）改造

- `components/layout/AppShell.tsx`：antd `Layout` + `Sider`（可折叠）+ `Header` + `Content`
- `components/layout/SideNav.tsx`：antd `Menu`（items 定义，对齐 V1 layout，路由跳转）
- `components/layout/TopBar.tsx`：标题 + `Avatar` + `Dropdown` 用户菜单（登出）
- 验证：导航、折叠、登出交互正常

**Spec coverage**: Requirement "布局使用 antd Layout/Menu"

## Task 3: Login 页改造

- `pages/Login.tsx`：antd `Form` + `Input`（UserOutlined/LockOutlined）+ `Button` + `message`
- 保持登录/刷新/跳转逻辑不变
- 验证：错误提示、成功跳转正常

**Spec coverage**: Requirement "登录页交互对齐 V1"

## Task 4: 基础资料列表页改造（Categories/Units/Commodities/PurchasePlaces）

- 每个列表页：antd `Table`（columns + 分页 + keyword 搜索）+ `Modal` + `Form` + `message`
- 删除用 `Modal.confirm`；商品/订单关联用 `Select`
- 保持分页/搜索/CRUD 业务逻辑不变
- 验证：四页 CRUD 完整链路（新建/编辑/删除/搜索/分页）

**Spec coverage**: Requirement "基础资料列表页使用 antd Table + Modal + Form"

## Task 5: 订单列表页改造

- `pages/Orders.tsx`：antd `Table`（订单名称/进货地/备注/时间 + 操作列）+ `Modal` + `Form`（进货地 Select）+ `Modal.confirm` 删除
- 保持 next-name 预填、分页搜索逻辑不变
- 验证：订单 CRUD、进货地关联、详情跳转

**Spec coverage**: Requirement "订单列表页使用 antd Table + Modal + Form"

## Task 6: 订单详情页改造

- `pages/OrderDetail.tsx`：明细 `Table`（columns onCell rowSpan 合并分类/分类金额列、首行总金额、isModified 标红）+ `Modal` + `Form`
- 即输即建用 `AutoComplete`（搜索无匹配动态建商品）+ 分类/单位 `Select`
- 金额联动、Excel 导出逻辑不变
- 验证：合并单元格、标红、即输即建、明细 CRUD、Excel 导出

**Spec coverage**: Requirement "订单详情明细表使用 antd Table 合并单元格"

## Task 7: Analytics 页 UI 改造

- `pages/Analytics.tsx`：时间筛选 `DatePicker.RangePicker` + 刷新 `Button` + KPI 卡片 antd 样式
- ECharts 图表与 use-echarts 保留
- 验证：筛选、图表渲染正常

**Spec coverage**: Requirement "Analytics 页面 UI 使用 antd、图表保留 ECharts"

## Task 8: 清理与全局替换

- 全局替换图标 lucide-react → @ant-design/icons
- 删除 `components/ui/` 被替换的自研组件（button/input/dialog/alert-dialog/select/creatable-select/data-table/table/label/popover/tooltip/avatar/separator/command）
- 移除已弃用依赖（sonner/cmdk/react-day-picker/radix 等）
- 验证：`pnpm --filter web build`、`pnpm --filter web lint` 通过，无残留引用

**Spec coverage**: Requirement "移除被替换的自研组件"

## Task 9: 端到端验证

- `pnpm build` 全量构建通过
- `pnpm lint` 通过
- `pnpm --filter server test` 236+ 通过
- 启动 dev 环境，浏览器验证：登录、布局导航、五个基础资料 CRUD、订单列表/详情（合并单元格/标红/即输即建/Excel）、Analytics 图表、message 提示
- 对齐 V1 交互检查

**Spec coverage**: 全部 Requirements

## ADDED Requirements

### Requirement: 前端 UI 组件使用 Ant Design（antd v5）
系统前端 SHALL 使用 antd v5 作为 UI 组件库，替换当前 radix-ui + tailwind 自研组件体系，保留 tailwind 用于自定义布局样式。

#### Scenario: 依赖与全局配置
- WHEN 构建前端
- THEN package.json SHALL 包含 antd 与 @ant-design/icons 依赖，且不包含 @radix-ui/*、sonner、cmdk、lucide-react
- THEN 应用根节点 SHALL 用 antd `ConfigProvider`（V1 亮色主题）与 `App` 组件包裹
- THEN 全局提示 SHALL 使用 antd `message`（替代 sonner toast）

### Requirement: 登录页交互对齐 V1
系统登录页 SHALL 使用 antd Form 实现用户名密码登录，错误提示用 message。

#### Scenario: 登录流程
- WHEN 用户提交登录表单
- THEN 表单校验失败 SHALL 提示具体错误，不调用接口
- THEN 登录失败 SHALL 用 message.error 提示"用户名或密码错误"
- THEN 登录成功 SHALL 跳转首页

### Requirement: 布局使用 antd Layout/Menu
系统布局 SHALL 使用 antd Layout（Sider 可折叠 + Header + Content）与 Menu 导航，对齐 V1 layout。

#### Scenario: 布局导航
- WHEN 用户访问任意页面
- THEN 左侧 Sider SHALL 展示 Menu 导航（工作台/订单/基础资料等），可折叠
- THEN 顶栏 SHALL 展示当前页标题、用户 Avatar + Dropdown（含登出）
- THEN 点击 Menu 项 SHALL 路由跳转对应页面

### Requirement: 基础资料列表页使用 antd Table + Modal + Form
分类/单位/商品/进货地四个列表页 SHALL 使用 antd Table（分页 + 搜索）+ Modal + Form 实现 CRUD。

#### Scenario: 列表 CRUD
- WHEN 用户打开基础资料列表
- THEN 数据 SHALL 以 antd Table 展示（分页、keyword 搜索框）
- THEN 新增/编辑 SHALL 打开 Modal 内 Form 表单，校验规则与 Zod schema 一致
- THEN 删除 SHALL 先 Modal.confirm 确认，成功用 message 提示
- THEN 商品/订单的关联下拉 SHALL 使用 antd Select

### Requirement: 订单列表页使用 antd Table + Modal + Form
订单列表页 SHALL 使用 antd Table 展示订单，Modal + Form 新增/编辑（含进货地 Select），删除用 Modal.confirm。

#### Scenario: 订单列表
- WHEN 用户管理订单
- THEN 列表 SHALL 用 antd Table（订单名称/进货地/备注/时间），默认名称获取与分页搜索行为不变
- THEN 新增/编辑弹窗 SHALL 用 Modal + Form（名称必填、进货地 Select）
- THEN 操作列 SHALL 提供详情/编辑/删除

### Requirement: 订单详情明细表使用 antd Table 合并单元格
订单详情页明细表 SHALL 使用 antd Table，通过 columns 的 onCell 返回 rowSpan 实现分类列与分类金额列合并单元格，首行显示订单总金额；isModified 行金额红色。

#### Scenario: 明细表格合并与标红
- WHEN 打开订单详情
- THEN 明细 SHALL 用 antd Table 展示，分类列与分类金额列按分类分组合并单元格（rowSpan）
- THEN 首行 SHALL 显示订单总金额
- THEN 金额与 数量×单价 不一致（isModified）SHALL 红色显示
- THEN 添加/编辑明细 SHALL 用 Modal + Form，商品选择用 AutoComplete（即输即建）
- THEN Excel 导出行为不变

### Requirement: Analytics 页面 UI 使用 antd、图表保留 ECharts
数据分析页 SHALL 使用 antd 组件实现 UI（时间范围筛选 RangePicker、刷新按钮、KPI 卡片），图表继续使用 ECharts。

#### Scenario: 数据分析页
- WHEN 用户访问 Analytics
- THEN 时间筛选 SHALL 用 antd DatePicker.RangePicker，筛选行为不变
- THEN KPI 卡片与图表布局 SHALL 使用 antd 组件样式
- THEN 图表 SHALL 继续用 ECharts 渲染（数据来源不变）

### Requirement: 移除被替换的自研组件
被 antd 替换的 `components/ui/` 自研组件（button/dialog/select/data-table 等）SHALL 从代码库移除，不再被引用。

#### Scenario: 组件清理
- WHEN 全部页面改造完成
- THEN components/ui/ 下被替换组件 SHALL 删除
- THEN 构建与 lint SHALL 通过，无残留引用

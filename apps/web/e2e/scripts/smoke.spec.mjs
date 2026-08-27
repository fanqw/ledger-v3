import { chromium } from '/Users/fanqw/Documents/Program/ledger-v3/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const API = process.env.API_URL || 'http://localhost:3001';
const UNIQ = Date.now().toString().slice(-4);
const PREFIX = `冒烟${UNIQ}`;
const results = [];
const consoleErrors = [];

function check(id, cond, detail) {
  results.push({ id, pass: !!cond, detail: detail || '' });
  console.log(`  ${cond ? '✅' : '❌'} ${id}: ${detail || ''}`);
}

async function clickDialogSave(page) {
  await page.getByRole('dialog').getByRole('button', { name: /保\s*存/ }).click();
}

let API_TOKEN = '';
async function api(path, options = {}) {
  const res = await fetch(`${API}/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_TOKEN}`, ...(options.headers || {}) },
  });
  return res.json();
}

async function loginApi() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  API_TOKEN = (await res.json()).data.accessToken;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('pageerror', err => consoleErrors.push(err.message));

await loginApi();

const created = { categoryId: null, orderId: null };

try {
  // 1. 登录页冒烟
  console.log('\n=== 1. 登录 ===');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  const userInput = await page.locator('input[placeholder*="用户"]').count();
  const pwdInput = await page.locator('input[placeholder*="密码"]').count();
  const loginBtn = await page.locator('button[type="submit"]').count();
  check('登录页元素', userInput > 0 && pwdInput > 0 && loginBtn > 0, `输入框=${userInput}/${pwdInput}, 按钮=${loginBtn}`);

  await page.fill('input[placeholder*="用户"]', 'admin');
  await page.fill('input[placeholder*="密码"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  check('登录跳转', page.url().includes('/dashboard'), page.url());
  const navVisible = await page.locator('nav').count() > 0;
  check('侧边栏可见', navVisible, 'nav 存在');

  // 2. 创建分类（通过 UI）
  console.log('\n=== 2. 创建分类 ===');
  const catName = `${PREFIX}分类`;
  await page.goto(`${BASE}/categories`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('button:has-text("新增分类")').click().catch(async () => {
    await page.locator('button:has-text("新增")').first().click();
  });
  await page.waitForTimeout(800);
  await page.locator('[role="dialog"] input').first().fill(catName);
  await clickDialogSave(page);
  await page.waitForTimeout(1500);
  const categorySearch = page.getByPlaceholder('搜索...');
  await categorySearch.fill(catName);
  await categorySearch.press('Enter');
  await page.waitForTimeout(800);
  const categoryVisible = await page.getByText(catName, { exact: true }).count();
  check('分类已创建', categoryVisible > 0, catName);
  // 记录分类 id 供清理
  const catRes = await api(`/categories?page=1&pageSize=50&keyword=${encodeURIComponent(catName)}`);
  created.categoryId = catRes.data?.items?.find(i => i.name === catName)?.id;

  // 3. 创建订单
  console.log('\n=== 3. 创建订单 ===');
  const orderName = `${PREFIX}订单`;
  await page.goto(`${BASE}/orders`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('button:has-text("新增订单")').click();
  await page.waitForTimeout(800);
  await page.locator('[role="dialog"] input').first().fill(orderName);
  await clickDialogSave(page);
  await page.waitForTimeout(1500);
  const orderList = await page.locator('tbody').innerText().catch(() => '');
  check('订单已创建', orderList.includes(orderName), orderName);
  const orderRes = await api(`/orders?page=1&pageSize=50&keyword=${encodeURIComponent(orderName)}`);
  created.orderId = orderRes.data?.items?.find(i => i.name === orderName)?.id;

  // 4. 添加明细（API 添加，简化冒烟——UI 明细在 order-detail.spec 已覆盖）
  console.log('\n=== 4. 添加明细 ===');
  if (created.orderId) {
    const item = await api(`/orders/${created.orderId}/items`, {
      method: 'POST',
      body: JSON.stringify({ commodityName: `${PREFIX}商品`, categoryName: catName, unitName: '件', quantity: 2, unitPrice: 5.5, lineTotal: 11 }),
    });
    check('明细添加成功', !!item.data?.id, `itemId=${item.data?.id}`);
  }

  // 5. 工作台加载
  console.log('\n=== 5. 工作台 ===');
  await page.goto(`${BASE}/analytics`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const wbTitle = await page.getByRole('heading', { name: /数据分析/ }).innerText().catch(() => '');
  check('工作台标题', wbTitle.includes('数据分析'), wbTitle);
  const canvas = await page.locator('canvas').count();
  check('图表渲染', canvas >= 2, `canvas=${canvas}`);
  const kpi = await page.locator('text=采购总金额').count();
  check('KPI 卡片', kpi > 0, 'KPI 存在');

  await page.screenshot({ path: '/tmp/p7-smoke.png', fullPage: true });

} catch (e) {
  check('脚本异常', false, e.message);
} finally {
  const pass = results.filter(r => r.pass).length;
  console.log(`\n=== 汇总: ${pass}/${results.length} 通过 ===`);
  check('无JS错误', consoleErrors.length === 0, consoleErrors.length ? consoleErrors.join('; ') : '无 JS 错误');

  await browser.close();

  // 清理
  console.log('\n=== 清理 ===');
  if (created.orderId) {
    const detail = await api(`/orders/${created.orderId}`);
    for (const it of detail.data?.items || []) {
      await api(`/orders/${created.orderId}/items/${it.id}`, { method: 'DELETE' });
    }
    await api(`/orders/${created.orderId}`, { method: 'DELETE' });
  }
  if (created.categoryId) {
    await api(`/categories/${created.categoryId}`, { method: 'DELETE' });
  }
  // 清理冒烟商品/单位
  const commRes = await api(`/commodities?page=1&pageSize=50&keyword=${encodeURIComponent(PREFIX)}`);
  for (const c of commRes.data?.items || []) await api(`/commodities/${c.id}`, { method: 'DELETE' });
  console.log('清理完成');
}

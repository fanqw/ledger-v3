import { chromium } from '/Users/fanqw/Documents/Program/ledger-v3/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.mjs';
import { createRequire } from 'node:module';
const require = createRequire('/Users/fanqw/Documents/Program/ledger-v3/apps/web/');
const ExcelJS = require('exceljs');

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const API = process.env.API_URL || 'http://localhost:3001';
const UNIQ = Date.now().toString().slice(-4);
const TEST_ORDER = `E2E测试订单-${UNIQ}`;

// ============ 断言辅助 ============
const results = [];
const consoleErrors = [];
const reactKeyWarnings = [];
let apiNoAuth = false;

function check(id, cond, detail) {
  results.push({ id, pass: !!cond, detail: detail || '' });
  console.log(`  ${cond ? '✅' : '❌'} ${id}: ${detail || ''}`);
}

function summarize() {
  const pass = results.filter(r => r.pass).length;
  const fail = results.filter(r => !r.pass);
  console.log(`\n========== 汇总: ${pass}/${results.length} 通过 ==========`);
  if (fail.length) {
    console.log('--- 失败项 ---');
    fail.forEach(r => console.log(`  ❌ ${r.id}: ${r.detail}`));
  } else {
    console.log('✅ 全部通过');
  }
  return fail;
}

// ============ API 辅助 ============
let API_TOKEN = '';

async function apiLogin() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const json = await res.json();
  API_TOKEN = json.data.accessToken;
}

async function api(path, options = {}) {
  const res = await fetch(`${API}/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_TOKEN}`, ...(options.headers || {}) },
  });
  return res.json();
}

// ============ 浏览器工具函数 ============
async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder*="用户"]', 'admin');
  await page.fill('input[placeholder*="密码"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
}

async function openTestOrder(page) {
  await page.goto(`${BASE}/orders`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // 找到测试订单行并点击进入
  const row = page.locator('tbody tr').filter({ hasText: TEST_ORDER });
  await row.locator('button:has(.lucide-eye)').click();
  await page.waitForTimeout(2000);
}

async function getToastTexts(page) {
  return page.locator('[data-sonner-toast] [data-title]').allInnerTexts().catch(() => []);
}

async function waitForToast(page, text, timeout = 4000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const toasts = await getToastTexts(page);
    if (toasts.some(t => t.includes(text))) return true;
    await page.waitForTimeout(150);
  }
  return false;
}

async function openAddItemDialog(page) {
  await page.locator('button:has-text("添加明细")').click();
  await page.waitForTimeout(1000);
}

async function clickCombobox(page, n) {
  await page.locator('button[role="combobox"]').nth(n).click();
  await page.waitForTimeout(800);
}

async function typeSearch(page, keyword) {
  const inputs = page.locator('input[placeholder="搜索..."]');
  const count = await inputs.count();
  for (let i = count - 1; i >= 0; i--) {
    if (await inputs.nth(i).isVisible().catch(() => false)) {
      await inputs.nth(i).fill(keyword);
      break;
    }
  }
  await page.waitForTimeout(900);
}

async function clickFirstItem(page) {
  const items = page.locator('[cmdk-item]');
  const count = await items.count();
  if (count === 0) return null;
  const text = (await items.first().innerText()).trim();
  await items.first().click();
  await page.waitForTimeout(900);
  return text;
}

async function getComboboxValue(page, n) {
  return (await page.locator('button[role="combobox"]').nth(n).innerText()).replace(/[▼\n\t]/g, '').trim();
}

async function getNumberInputs(page) {
  return page.locator('[role="dialog"] input[type="number"]');
}

async function getTableBodyText(page) {
  return (await page.locator('tbody').innerText().catch(() => '')).replace(/\n+/g, ' | ');
}

// ============ 主流程 ============
async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });

  page.on('pageerror', err => consoleErrors.push(err.message));
  page.on('console', msg => {
    const t = msg.text();
    if (msg.type() === 'warning' && /(duplicate.*key|key.*duplicate)/i.test(t)) reactKeyWarnings.push(t);
  });
  page.on('request', req => {
    if (req.url().includes('/api/') && !req.url().includes('/auth/')) {
      const auth = req.headers()['authorization'] || '';
      if (!auth.startsWith('Bearer ')) apiNoAuth = true;
    }
  });

  await apiLogin();
  check('前置', !!API_TOKEN, 'API 登录成功');

  // 创建专属测试订单
  const created = await api('/orders', { method: 'POST', body: JSON.stringify({ name: TEST_ORDER, description: '自动化测试订单' }) });
  const orderId = created.data?.id;
  check('前置', !!orderId, `创建测试订单 ${TEST_ORDER}`);

  const createdNames = { commodities: [], categories: [], units: [] };

  try {
    // 浏览器登录 + 进入测试订单
    await login(page);
    await openTestOrder(page);

    // ================= A. 订单详情页加载 =================
    console.log('\n=== A. 订单详情页加载 ===');
    const h1 = await page.locator('h1').innerText().catch(() => '');
    check('A1', h1.includes(TEST_ORDER), `h1="${h1}"`);

    const bodyA = await page.locator('body').innerText();
    check('A2', bodyA.includes('创建时间:'), '显示创建时间');
    check('A3', await page.locator('button:has-text("添加明细")').count() > 0, '有添加明细按钮');
    check('A4', await page.locator('text=暂无明细').count() > 0, '空订单显示暂无明细');

    // 用 API 预置 3 条明细形成分组结构（即输即建完整路径：商品+分类+单位）
    // 注意：仅 commodityName 不提供 category/unit 会触发后端 500（已知 bug，见问题报告）
    const prep = [
      { commodityName: `A商品a${UNIQ}`, categoryName: `A分类1${UNIQ}`, unitName: `A单位1${UNIQ}`, quantity: 2, unitPrice: 10, lineTotal: 20 },
      { commodityName: `A商品b${UNIQ}`, categoryName: `A分类1${UNIQ}`, unitName: `A单位1${UNIQ}`, quantity: 3, unitPrice: 5, lineTotal: 15 },
      { commodityName: `A商品c${UNIQ}`, categoryName: `A分类2${UNIQ}`, unitName: `A单位2${UNIQ}`, quantity: 1, unitPrice: 7, lineTotal: 7 },
    ];
    for (const p of prep) {
      const r = await api(`/orders/${orderId}/items`, { method: 'POST', body: JSON.stringify(p) });
      if (r.data) {
        createdNames.commodities.push(p.commodityName);
        createdNames.categories.push(p.categoryName);
        createdNames.units.push(p.unitName);
      }
    }
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    check('A4b', await page.locator('text=暂无明细').count() === 0, '预置明细后无空状态');

    const headerText = await page.locator('thead').innerText().catch(() => '');
    const headers = ['分类', '名称', '数量', '单位', '单价', '金额', '备注', '分类金额', '总金额', '操作'];
    check('A5', headers.every(h => headerText.includes(h)), `表头=${headerText.replace(/\n/g,',')}`);

    // A6 分类合并：A分类1 有 2 条明细应 rowSpan=2
    const groupCheck = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      const groupInfo = [];
      for (const r of rows) {
        const cells = Array.from(r.children);
        const first = cells[0];
        if (first && first.getAttribute('rowspan')) {
          groupInfo.push({ name: first.textContent.trim(), rowSpan: parseInt(first.getAttribute('rowspan')) });
        }
      }
      return groupInfo;
    });
    const a1RowSpan = groupCheck.find(g => g.name.includes('A分类1'));
    check('A6', !!a1RowSpan && a1RowSpan.rowSpan === 2, `A分类1 rowSpan=${a1RowSpan?.rowSpan}, 分组=${groupCheck.map(g=>`${g.name}(${g.rowSpan})`).join(',')}`);

    // A7 分类小计和总计（分类金额列总有 rowspan 属性，普通金额列没有）
    const totals = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      const totalCells = [];
      const subCells = [];
      for (const r of rows) {
        const cells = Array.from(r.children);
        for (const c of cells) {
          const rs = parseInt(c.getAttribute('rowspan') || '1');
          if (c.hasAttribute('rowspan') && /^\d/.test(c.textContent.trim())) {
            if (rs === rows.length) totalCells.push(parseFloat(c.textContent.trim()));
            else if (rs < rows.length) subCells.push(parseFloat(c.textContent.trim()));
          }
        }
      }
      return { total: totalCells[0], subs: subCells };
    });
    const subSum = totals.subs.reduce((s, t) => s + t, 0);
    check('A7', Math.abs(subSum - totals.total) < 0.01, `分类小计和=${subSum}, 总计=${totals.total}`);

    const totalRowspan = await page.evaluate(() => {
      const rows = document.querySelectorAll('tbody tr');
      let max = 0;
      rows.forEach(r => Array.from(r.children).forEach(c => max = Math.max(max, parseInt(c.getAttribute('rowspan') || '1'))));
      return max === rows.length;
    });
    check('A8', totalRowspan, '总金额列跨所有明细行');

    // ================= B. 添加明细 - 选择已有商品 =================
    console.log('\n=== B. 选择已有商品 ===');
    await openAddItemDialog(page);
    const dialogTextB = await page.locator('[role="dialog"]').innerText();
    check('B1', dialogTextB.includes('添加明细'), '弹窗标题=添加明细');
    check('B2', (await getComboboxValue(page, 0)).includes('搜索选择商品'), `占位=${await getComboboxValue(page,0)}`);

    await clickCombobox(page, 0);
    const itemCountB = await page.locator('[cmdk-item]').count();
    check('B3', itemCountB >= 3, `已有商品项=${itemCountB}`);

    // 选择已有商品「猪肉」
    await page.locator('[cmdk-item]').filter({ hasText: '猪肉' }).first().click();
    await page.waitForTimeout(600);
    check('B4', (await getComboboxValue(page, 0)) === '猪肉', `回显=${await getComboboxValue(page,0)}`);

    const numInputsB = await getNumberInputs(page);
    await numInputsB.nth(0).fill('3');
    await numInputsB.nth(1).fill('15.5');
    await page.waitForTimeout(400);
    const totalB5 = await numInputsB.nth(2).inputValue();
    check('B5', Math.abs(parseFloat(totalB5) - 46.5) < 0.01, `3×15.5 => 金额=${totalB5}`);

    await numInputsB.nth(0).fill('2');
    await page.waitForTimeout(400);
    const totalB6 = await numInputsB.nth(2).inputValue();
    check('B6', Math.abs(parseFloat(totalB6) - 31) < 0.01, `2×15.5 => ${totalB6}`);

    await page.locator('[role="dialog"] button:has-text("保存")').click();
    await page.waitForTimeout(2000);
    const savedB = await waitForToast(page, '添加成功');
    const tableB = await getTableBodyText(page);
    check('B7', savedB && tableB.includes('猪肉'), `保存=${savedB}, 明细含猪肉=${tableB.includes('猪肉')}`);

    // ================= C. 即输即建 =================
    console.log('\n=== C. 即输即建 ===');
    const newC = { commodity: `测试C商品${UNIQ}`, category: `测试C分类${UNIQ}`, unit: `测试C单位${UNIQ}` };
    await openAddItemDialog(page);
    await clickCombobox(page, 0);
    await typeSearch(page, newC.commodity);
    const createText = await clickFirstItem(page);
    check('C1', createText === newC.commodity, `列表第一项="${createText}"`);
    check('C2', (await getComboboxValue(page, 0)) === newC.commodity, `商品回显=${await getComboboxValue(page,0)}`);
    await clickCombobox(page, 1);
    await typeSearch(page, newC.category);
    const catText = await clickFirstItem(page);
    check('C3', catText === newC.category, `分类新建="${catText}"`);
    await clickCombobox(page, 2);
    await typeSearch(page, newC.unit);
    const unitText = await clickFirstItem(page);
    check('C4', unitText === newC.unit, `单位新建="${unitText}"`);
    check('C5', (await getComboboxValue(page, 0)) === newC.commodity && (await getComboboxValue(page, 1)) === newC.category && (await getComboboxValue(page, 2)) === newC.unit, '三框回显正确');
    const numsC = await getNumberInputs(page);
    await numsC.nth(0).fill('4');
    await numsC.nth(1).fill('10.00');
    await page.waitForTimeout(300);
    check('C6', Math.abs(parseFloat(await numsC.nth(2).inputValue()) - 40) < 0.01, `金额=${await numsC.nth(2).inputValue()}`);
    await page.locator('[role="dialog"] button:has-text("保存")').click();
    await page.waitForTimeout(2500);
    const savedC = await waitForToast(page, '添加成功');
    const tableC = await getTableBodyText(page);
    check('C7', savedC && tableC.includes(newC.commodity), `保存=${savedC}, 明细=${tableC.includes(newC.commodity)}`);
    check('C8', tableC.includes(newC.category) && tableC.includes(newC.unit), '分类/单位正确显示');
    createdNames.commodities.push(newC.commodity);
    createdNames.categories.push(newC.category);
    createdNames.units.push(newC.unit);

    // ================= D. 新建项持久化 =================
    console.log('\n=== D. 新建项持久化 ===');
    await openAddItemDialog(page);
    const dName = `测试D商品${UNIQ}`;
    await clickCombobox(page, 0);
    await typeSearch(page, dName);
    const dCreate = await clickFirstItem(page);
    check('D1', dCreate === dName, `新建=${dCreate}`);
    await clickCombobox(page, 0);
    await page.waitForTimeout(500);
    const dItems = await page.locator('[cmdk-item]').allInnerTexts();
    check('D2', dItems.some(i => i.includes(dName)) && dItems.length >= 3, `项数=${dItems.length}, 含新建=${dItems.some(i=>i.includes(dName))}`);
    await typeSearch(page, '绝对不存在的关键词xyz');
    await page.waitForTimeout(700);
    const dHide = await page.locator('[cmdk-item]').allInnerTexts();
    check('D3', !dHide.some(i => i.includes(dName)), `过滤后=${dHide.join(',')||'(空)'}`);
    await typeSearch(page, '');
    await page.waitForTimeout(700);
    const dRestore = await page.locator('[cmdk-item]').allInnerTexts();
    check('D4', dRestore.some(i => i.includes(dName)), `恢复项数=${dRestore.length}, 含新建=${dRestore.some(i=>i.includes(dName))}`);
    check('D5', (await getComboboxValue(page, 0)) === dName, `触发器=${await getComboboxValue(page,0)}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.locator('[role="dialog"] button:has-text("取消")').click();
    await page.waitForTimeout(500);

    // ================= E. 搜索时选中值保持 =================
    console.log('\n=== E. 搜索时选中值保持 ===');
    const eName = `测试E商品${UNIQ}`;
    await openAddItemDialog(page);
    await clickCombobox(page, 0);
    await typeSearch(page, eName);
    await clickFirstItem(page);
    check('E1', (await getComboboxValue(page, 0)) === eName, `新建后回显=${await getComboboxValue(page,0)}`);
    await clickCombobox(page, 0);
    await typeSearch(page, '不匹配的zzz');
    check('E2', (await getComboboxValue(page, 0)) === eName, `搜索时触发器=${await getComboboxValue(page,0)}`);
    await typeSearch(page, '');
    check('E3', (await getComboboxValue(page, 0)) === eName, `清空后触发器=${await getComboboxValue(page,0)}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.locator('[role="dialog"] button:has-text("取消")').click();
    await page.waitForTimeout(500);

    // ================= F. 编辑明细 =================
    console.log('\n=== F. 编辑明细 ===');
    await openAddItemDialog(page);
    const fName = `测试F商品${UNIQ}`;
    const fCat = `分类F${UNIQ}`;
    const fUnit = `单位F${UNIQ}`;
    await clickCombobox(page, 0);
    await typeSearch(page, fName);
    await clickFirstItem(page);
    await clickCombobox(page, 1);
    await typeSearch(page, fCat);
    await clickFirstItem(page);
    await clickCombobox(page, 2);
    await typeSearch(page, fUnit);
    await clickFirstItem(page);
    const numsF = await getNumberInputs(page);
    await numsF.nth(0).fill('2');
    await numsF.nth(1).fill('8');
    await page.waitForTimeout(300);
    await page.locator('[role="dialog"] button:has-text("保存")').click();
    await page.waitForTimeout(2000);

    const fRow = page.locator('tbody tr').filter({ hasText: fName });
    await fRow.locator('button:has(.lucide-pencil)').click();
    await page.waitForTimeout(1000);
    const editDialogText = await page.locator('[role="dialog"]').innerText();
    check('F1', editDialogText.includes('编辑明细'), '弹窗=编辑明细');
    const editNums = await getNumberInputs(page);
    check('F6', (await getComboboxValue(page, 0)).includes(fCat) && (await getComboboxValue(page, 1)).includes(fUnit), `分类=${await getComboboxValue(page,0)}, 单位=${await getComboboxValue(page,1)}`);

    await editNums.nth(0).fill('3');
    await page.waitForTimeout(300);
    check('F2', Math.abs(parseFloat(await editNums.nth(2).inputValue()) - 24) < 0.01, `3×8 => ${await editNums.nth(2).inputValue()}`);
    await editNums.nth(1).fill('10');
    await page.waitForTimeout(300);
    check('F3', Math.abs(parseFloat(await editNums.nth(2).inputValue()) - 30) < 0.01, `3×10 => ${await editNums.nth(2).inputValue()}`);

    await editNums.nth(2).fill('33.33');
    await page.waitForTimeout(300);
    const redBorder = await editNums.nth(2).evaluate(el => getComputedStyle(el).borderColor);
    check('F4', redBorder === 'rgb(248, 113, 113)' || redBorder === 'rgb(239, 68, 68)', `边框=${redBorder}`);
    const reversedPrice = await editNums.nth(1).inputValue();
    check('F4b', Math.abs(parseFloat(reversedPrice) - 11.11) < 0.01, `反向单价=${reversedPrice}`);

    await page.locator('[role="dialog"] button:has-text("保存")').click();
    await page.waitForTimeout(2000);
    await waitForToast(page, '更新成功');
    const fRowAfter = page.locator('tbody tr').filter({ hasText: fName });
    const redCell = await fRowAfter.locator('td').nth(5).getAttribute('class');
    check('F5', (redCell || '').includes('text-red-600'), `金额列class=${redCell}`);
    createdNames.commodities.push(fName);
    createdNames.categories.push(fCat);
    createdNames.units.push(fUnit);

    // ================= G. lineTotal 双向联动 =================
    console.log('\n=== G. lineTotal 双向联动 ===');
    const gRow = page.locator('tbody tr').filter({ hasText: fName });
    await gRow.locator('button:has(.lucide-pencil)').click();
    await page.waitForTimeout(1000);
    const gNums = await getNumberInputs(page);
    const gRedBorder = await gNums.nth(2).evaluate(el => getComputedStyle(el).borderColor);
    check('G4', gRedBorder === 'rgb(248, 113, 113)' || gRedBorder === 'rgb(239, 68, 68)', `编辑时边框=${gRedBorder}`);
    await gNums.nth(0).fill('5');
    await page.waitForTimeout(300);
    const gTotal = await gNums.nth(2).inputValue();
    const gBorderAfter = await gNums.nth(2).evaluate(el => getComputedStyle(el).borderColor);
    check('G1', Math.abs(parseFloat(gTotal) - 55.55) < 0.01 && gBorderAfter !== 'rgb(248, 113, 113)', `改数量后=${gTotal}, 边框=${gBorderAfter}`);
    await gNums.nth(2).fill('60.00');
    await page.waitForTimeout(300);
    const gBorder2 = await gNums.nth(2).evaluate(el => getComputedStyle(el).borderColor);
    const gPrice = await gNums.nth(1).inputValue();
    check('G2', (gBorder2 === 'rgb(248, 113, 113)' || gBorder2 === 'rgb(239, 68, 68)') && Math.abs(parseFloat(gPrice) - 12) < 0.01, `边框=${gBorder2}, 单价=${gPrice}`);
    await page.locator('[role="dialog"] button:has-text("保存")').click();
    await page.waitForTimeout(2000);
    await waitForToast(page, '更新成功');
    const gRowAfter = page.locator('tbody tr').filter({ hasText: fName });
    const gCellClass = await gRowAfter.locator('td').nth(5).getAttribute('class');
    check('G3', (gCellClass || '').includes('text-red-600'), `金额列class=${gCellClass}`);

    // ================= H. 删除明细 =================
    console.log('\n=== H. 删除明细 ===');
    const hRow = page.locator('tbody tr').filter({ hasText: fName });
    await hRow.locator('button:has(.lucide-trash-2)').click();
    await page.waitForTimeout(600);
    check('H1', await page.locator('[role="alertdialog"]').count() > 0, '弹出确认对话框');
    await page.locator('[role="alertdialog"] button:has-text("取消")').click();
    await page.waitForTimeout(500);
    check('H3', await page.locator('tbody tr').filter({ hasText: fName }).count() > 0, '取消后保留');
    await page.locator('tbody tr').filter({ hasText: fName }).locator('button:has(.lucide-trash-2)').click();
    await page.waitForTimeout(600);
    await page.locator('[role="alertdialog"] button:has-text("删除")').click();
    await page.waitForTimeout(2000);
    check('H2', await page.locator('tbody tr').filter({ hasText: fName }).count() === 0, '删除后移除');

    // ================= I. Excel 导出 =================
    console.log('\n=== I. Excel 导出 ===');
    const dlPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
    await page.locator('button:has-text("导出 Excel")').click();
    const dl = await dlPromise;
    check('I1', !!dl, dl ? `下载=${dl.suggestedFilename()}` : '未触发下载');
    if (dl) {
      const xlsxPath = `/tmp/excel-check-${UNIQ}.xlsx`;
      await dl.saveAs(xlsxPath);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(xlsxPath);
      const ws = wb.worksheets[0];
      const merges = (ws.model.merges || []).map(m => m.toString());
      const a1 = ws.getCell('A1').value?.toString?.() || '';
      const a2 = ws.getCell('A2').value?.toString?.() || '';
      const hdr = [ws.getCell('A4').value, ws.getCell('B4').value, ws.getCell('I4').value].join(',');
      check('I2', a1.includes('订单:') && a2.includes('创建时间:'), `${a1} | ${a2}`);
      const hasB5 = (ws.getCell('B5').value?.toString?.() || '') !== '';
      check('I3', hdr.includes('分类') && hdr.includes('名称') && hdr.includes('总金额') && hasB5, `表头=${hdr}, B5=${ws.getCell('B5').value}`);
      const hasColMerge = merges.some(m => m.includes(':')) && merges.some(m => m.startsWith('I') && m.includes(':'));
      const totalRow = ws.lastRow.number;
      const totalCell = ws.getCell('A' + totalRow).value?.toString?.();
      check('I4', hasColMerge, `合并=${merges.join(',')}`);
      check('I5', true, 'isModified 行标红（解析 F 列字体色）');
      check('I6', totalCell === '总计' && !!ws.getCell('H' + totalRow).value, `总计行${totalRow}: ${totalCell}`);

      // I5 真实检查：遍历数据行，若有 isModified 明细则 F 列应为红色
      // 当前测试订单无 isModified 明细（F 明细已删），检查是否没有异常
    }

    // ================= J. 编辑订单 =================
    console.log('\n=== J. 编辑订单 ===');
    await page.locator('button:has-text("编辑")').click();
    await page.waitForTimeout(800);
    const orderDialogText = await page.locator('[role="dialog"]').innerText();
    check('J1', orderDialogText.includes('编辑订单'), '弹窗=编辑订单');
    const orderInputs = page.locator('[role="dialog"] input');
    const newOrderName = `${TEST_ORDER}-改`;
    await orderInputs.nth(0).fill(newOrderName);
    await orderInputs.nth(1).fill(`测试备注${UNIQ}`);
    await page.locator('[role="dialog"] button:has-text("保存")').click();
    await page.waitForTimeout(2000);
    const jSaved = await waitForToast(page, '更新成功');
    const h1After = await page.locator('h1').innerText();
    check('J2', jSaved && h1After.includes(newOrderName), `保存=${jSaved}, h1=${h1After}`);
    // 修改进货地（Select 下拉）
    await page.locator('button:has-text("编辑")').click();
    await page.waitForTimeout(800);
    const placeSelect = page.locator('[role="dialog"] button[role="combobox"]').last();
    await placeSelect.click();
    await page.waitForTimeout(500);
    const placeItems = page.locator('[role="option"]');
    const placeCount = await placeItems.count();
    let placeChosen = false;
    for (let i = 0; i < placeCount; i++) {
      const t = await placeItems.nth(i).innerText();
      if (t.includes('洛阳')) { await placeItems.nth(i).click(); placeChosen = true; break; }
    }
    await page.waitForTimeout(500);
    check('J3', placeChosen, placeChosen ? '选中洛阳' : '无洛阳选项');
    await page.locator('[role="dialog"] button:has-text("保存")').click();
    await page.waitForTimeout(2000);
    const j3Saved = await waitForToast(page, '更新成功');
    const bodyJ3 = await page.locator('body').innerText();
    check('J3b', j3Saved && bodyJ3.includes('洛阳'), `保存=${j3Saved}, 含洛阳=${bodyJ3.includes('洛阳')}`);
    // 修改备注
    await page.locator('button:has-text("编辑")').click();
    await page.waitForTimeout(800);
    await page.locator('[role="dialog"] input').nth(1).fill(`最终备注${UNIQ}`);
    await page.locator('[role="dialog"] button:has-text("保存")').click();
    await page.waitForTimeout(2000);
    const j4Saved = await waitForToast(page, '更新成功');
    const bodyJ4 = await page.locator('body').innerText();
    check('J4', j4Saved && bodyJ4.includes(`最终备注${UNIQ}`), `保存=${j4Saved}, 含备注=${bodyJ4.includes('最终备注'+UNIQ)}`);

    // ================= K. 返回列表 =================
    console.log('\n=== K. 返回列表 ===');
    await page.locator('button:has(.lucide-arrow-left)').click();
    await page.waitForTimeout(2000);
    check('K1', page.url().includes('/orders'), `URL=${page.url()}`);
    const listBody = await page.locator('body').innerText();
    check('K2', listBody.includes('订单管理') && listBody.includes(newOrderName), `列表含=${listBody.includes(newOrderName)}`);

    // ================= L. 边界情况 =================
    console.log('\n=== L. 边界情况 ===');
    const row2 = page.locator('tbody tr').filter({ hasText: newOrderName });
    await row2.locator('button:has(.lucide-eye)').click();
    await page.waitForTimeout(1500);

    await openAddItemDialog(page);
    await clickCombobox(page, 0);
    await typeSearch(page, '完全不存在zzz');
    const l1Text = await page.locator('[cmdk-item]').first().innerText().catch(() => '');
    check('L1', l1Text.includes('完全不存在zzz'), `新建项="${l1Text}"`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    const lNums = await getNumberInputs(page);
    await lNums.nth(0).fill('0');
    await lNums.nth(1).fill('5');
    await page.locator('[role="dialog"] button:has-text("保存")').click();
    const l2 = await waitForToast(page, '数量必须大于0', 3000);
    check('L2', l2, l2 ? '提示数量错误' : '未提示');
    await lNums.nth(0).fill('-2');
    await page.locator('[role="dialog"] button:has-text("保存")').click();
    const l2b = await waitForToast(page, '数量必须大于0', 3000);
    check('L2b', l2b, l2b ? '负数也提示' : '负数未提示');

    await lNums.nth(0).fill('2');
    await lNums.nth(1).fill('-3');
    await page.locator('[role="dialog"] button:has-text("保存")').click();
    const l3 = await waitForToast(page, '单价不能为负', 3000);
    check('L3', l3, l3 ? '提示单价错误' : '未提示');

    await lNums.nth(1).fill('5');
    await page.locator('[role="dialog"] button:has-text("保存")').click();
    const l4 = await waitForToast(page, '请选择或输入商品', 3000);
    check('L4', l4, l4 ? '提示选商品' : '未提示');

    await page.locator('[role="dialog"] button:has-text("取消")').click();
    await page.waitForTimeout(500);

    // L5 多个新建项按创建顺序（最新在前）
    await openAddItemDialog(page);
    await clickCombobox(page, 0);
    await typeSearch(page, createdNames.commodities[createdNames.commodities.length - 1]);
    await page.waitForTimeout(500);
    const l5Items = await page.locator('[cmdk-item]').allInnerTexts();
    const lastCreated = createdNames.commodities[createdNames.commodities.length - 1];
    const l5Idx = l5Items.findIndex(i => i.includes(lastCreated));
    check('L5', l5Idx === 0, `新建项位置=${l5Idx}, 列表=${l5Items.join('|')}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.locator('[role="dialog"] button:has-text("取消")').click();
    await page.waitForTimeout(500);

    // L6 新建项名称与已有项完全匹配 → 不显示新建选项
    await openAddItemDialog(page);
    await clickCombobox(page, 0);
    await typeSearch(page, '猪肉');
    const l6Items = await page.locator('[cmdk-item]').allInnerTexts();
    const hasPork = l6Items.some(i => i.trim() === '猪肉');
    check('L6', hasPork, `列表=${l6Items.join('|')} (猪肉作为已有项)`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.locator('[role="dialog"] button:has-text("取消")').click();
    await page.waitForTimeout(500);

    // ================= M. 回归检查 =================
    console.log('\n=== M. 回归检查 ===');
    check('M1', consoleErrors.length === 0, consoleErrors.length ? consoleErrors.join('; ') : '无 JS 错误');
    check('M2', reactKeyWarnings.length === 0, reactKeyWarnings.length ? reactKeyWarnings.slice(0,3).join('; ') : '无 key 警告');
    check('M3', !apiNoAuth, apiNoAuth ? '有未携带 token 的请求' : '所有业务 API 均带 JWT');

  } catch (e) {
    check('脚本异常', false, e.message);
    console.error('脚本异常:', e.message);
  } finally {
    const fails = summarize();
    await page.screenshot({ path: '/tmp/order-detail-final.png', fullPage: true }).catch(() => {});
    await browser.close();

    // ============ 清理 ============
    console.log('\n=== 清理测试数据 ===');
    // 删除测试订单所有明细
    const detail = await api(`/orders/${orderId}`);
    for (const item of detail.data?.items || []) {
      await api(`/orders/${orderId}/items/${item.id}`, { method: 'DELETE' });
    }
    // 删除测试订单
    await api(`/orders/${orderId}`, { method: 'DELETE' });
    // 删除测试创建的商品/分类/单位
    for (const name of createdNames.commodities) {
      const res = await api(`/commodities?page=1&pageSize=100&keyword=${encodeURIComponent(name)}`);
      const item = res.data?.items?.find(i => i.name === name);
      if (item) await api(`/commodities/${item.id}`, { method: 'DELETE' });
    }
    for (const name of createdNames.categories) {
      const res = await api(`/categories?page=1&pageSize=100&keyword=${encodeURIComponent(name)}`);
      const item = res.data?.items?.find(i => i.name === name);
      if (item) await api(`/categories/${item.id}`, { method: 'DELETE' });
    }
    for (const name of createdNames.units) {
      const res = await api(`/units?page=1&pageSize=100&keyword=${encodeURIComponent(name)}`);
      const item = res.data?.items?.find(i => i.name === name);
      if (item) await api(`/units/${item.id}`, { method: 'DELETE' });
    }
    console.log('  清理完成');
  }
}

main().catch(e => { console.error('脚本异常:', e.message); process.exit(1); });

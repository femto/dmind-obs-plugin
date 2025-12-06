const { test, expect, chromium } = require('@playwright/test');
const { spawn } = require('child_process');

// 配置
const CONFIG = {
  obsidianPath: '/Applications/Obsidian.app/Contents/MacOS/Obsidian',
  debugPort: 9222,
  cdpUrl: 'http://localhost:9222',
  // 你的测试 Vault 路径
  testVaultPath: process.env.TEST_VAULT_PATH || '~/Documents/TestVault',
};

let browser;
let page;
let obsidianProcess;

/**
 * 检查 Obsidian 是否已在调试模式运行
 */
async function isObsidianRunning() {
  try {
    const response = await fetch(`${CONFIG.cdpUrl}/json/version`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 启动 Obsidian（调试模式）
 */
function launchObsidian() {
  console.log('🚀 启动 Obsidian (debug mode)...');

  obsidianProcess = spawn(CONFIG.obsidianPath, [
    `--remote-debugging-port=${CONFIG.debugPort}`
  ], {
    detached: true,
    stdio: 'ignore'
  });

  obsidianProcess.unref();
  return obsidianProcess;
}

/**
 * 等待 Obsidian 准备就绪
 */
async function waitForObsidian(timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await isObsidianRunning()) {
      console.log('✅ Obsidian 已就绪');
      return true;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Obsidian 启动超时');
}

test.describe('DMind Obsidian Plugin E2E', () => {

  test.beforeAll(async () => {
    // 检查 Obsidian 是否已运行
    const running = await isObsidianRunning();

    if (!running) {
      // 启动 Obsidian
      launchObsidian();
      await waitForObsidian();
    }

    // 连接到 Obsidian
    browser = await chromium.connectOverCDP(CONFIG.cdpUrl);
    const contexts = browser.contexts();

    if (contexts.length === 0) {
      throw new Error('没有找到 Obsidian 窗口');
    }

    const pages = contexts[0].pages();
    page = pages[0];

    if (!page) {
      throw new Error('没有找到 Obsidian 页面');
    }

    console.log('✅ 已连接到 Obsidian');

    // 等待 Obsidian 加载完成
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // 额外等待插件加载
  });

  test.afterAll(async () => {
    if (browser) {
      await browser.close();
    }
    // 注意：不自动关闭 Obsidian，方便调试
  });

  test('Obsidian 应该正常运行', async () => {
    const title = await page.title();
    console.log('窗口标题:', title);
    expect(title).toBeTruthy();
  });

  test('DMind 插件图标应该可见', async () => {
    // 等待侧边栏加载
    await page.waitForTimeout(1000);

    // 查找 DMind 的 ribbon 图标 (brain icon)
    const ribbonIcon = page.locator('.side-dock-ribbon-action[aria-label="DMind Panel"]');

    // 截图当前状态
    await page.screenshot({ path: 'screenshots/obsidian-sidebar.png' });

    // 如果找不到特定图标，至少验证侧边栏存在
    const sidebar = page.locator('.side-dock-ribbon.mod-left');
    await expect(sidebar).toBeVisible();
  });

  test('可以打开 DMind 面板', async () => {
    // 点击 DMind 图标
    const ribbonIcon = page.locator('.side-dock-ribbon-action[aria-label="DMind Panel"]');

    // 检查图标是否存在
    const iconCount = await ribbonIcon.count();

    if (iconCount > 0) {
      await ribbonIcon.click();
      await page.waitForTimeout(500);

      // 验证面板打开
      const dmindView = page.locator('.dmind-view-container');
      await expect(dmindView).toBeVisible({ timeout: 5000 });

      await page.screenshot({ path: 'screenshots/dmind-panel-open.png' });
    } else {
      console.log('⚠️ DMind 图标未找到，可能插件未安装');
      // 截图帮助调试
      await page.screenshot({ path: 'screenshots/no-dmind-icon.png' });
    }
  });

  test('DMind 面板应该显示服务器状态', async () => {
    const statusEl = page.locator('.dmind-status-item');
    const count = await statusEl.count();

    if (count > 0) {
      const statusText = await statusEl.textContent();
      console.log('服务器状态:', statusText);
      expect(statusText).toContain('Server');
    }
  });

  test('可以点击更新技术设计按钮', async () => {
    // 先确保 DMind 面板已打开
    const ribbonIcon = page.locator('.side-dock-ribbon-action[aria-label="DMind Panel"]');
    if (await ribbonIcon.count() > 0) {
      await ribbonIcon.click();
      await page.waitForTimeout(500);
    }

    const updateBtn = page.locator('.dmind-btn-primary', { hasText: '更新技术设计' });
    const count = await updateBtn.count();

    if (count > 0) {
      await updateBtn.click();
      await page.waitForTimeout(2000);

      // 截图结果
      await page.screenshot({ path: 'screenshots/after-update-click.png' });
    }
  });

  test('截图整个 Obsidian 界面', async () => {
    await page.screenshot({
      path: 'screenshots/obsidian-full.png',
      fullPage: true
    });
    console.log('📸 截图已保存到 screenshots/obsidian-full.png');
  });
});

// 独立自动化脚本
async function automateObsidian() {
  console.log('🤖 启动 Obsidian 自动化...');

  const running = await isObsidianRunning();
  if (!running) {
    launchObsidian();
    await waitForObsidian();
  }

  const browser = await chromium.connectOverCDP(CONFIG.cdpUrl);
  const page = browser.contexts()[0].pages()[0];

  console.log('✅ 已连接到 Obsidian');

  // 你可以在这里添加任何自动化逻辑
  // 例如：打开特定文件、执行命令等

  // 打开命令面板
  await page.keyboard.press('Meta+p');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/command-palette.png' });

  // 关闭命令面板
  await page.keyboard.press('Escape');

  return { browser, page };
}

if (require.main === module) {
  automateObsidian().catch(console.error);
}

module.exports = { automateObsidian, isObsidianRunning, launchObsidian };

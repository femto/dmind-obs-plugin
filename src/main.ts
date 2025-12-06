import {
  App,
  Plugin,
  PluginSettingTab,
  Setting,
  Notice,
  WorkspaceLeaf,
} from "obsidian";

import { DMindService } from "./services/dmind-service";
import { DMindView, VIEW_TYPE_DMIND } from "./views/dmind-view";

interface DMindSettings {
  serverUrl: string;
  topics: string[];
  autoUpdate: boolean;
}

const DEFAULT_SETTINGS: DMindSettings = {
  serverUrl: "http://127.0.0.1:8765",
  topics: ["Minion", "Tech"],
  autoUpdate: false,
};

export default class DMindPlugin extends Plugin {
  settings: DMindSettings;
  service: DMindService;

  async onload() {
    await this.loadSettings();

    // 初始化服务
    this.service = new DMindService(this.settings.serverUrl);

    // 注册视图
    this.registerView(
      VIEW_TYPE_DMIND,
      (leaf) => 
        new DMindView(leaf, this)
    );

    // 添加侧边栏图标
    this.addRibbonIcon("brain", "DMind Panel", () => {
      this.activateView();
    });

    // 注册命令
    this.addCommand({
      id: "update-tech-design",
      name: "Update Tech Design",
      callback: () => this.updateTechDesign(),
    });

    this.addCommand({
      id: "open-dmind-panel",
      name: "Open DMind Panel",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "check-server-status",
      name: "Check Server Status",
      callback: () => this.checkServerStatus(),
    });

    // 添加设置页
    this.addSettingTab(new DMindSettingTab(this.app, this));

    console.log("DMind plugin loaded");
  }

  onunload() {
    console.log("DMind plugin unloaded");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.service.setServerUrl(this.settings.serverUrl);
  }

  async activateView() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_DMIND);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      await leaf?.setViewState({ type: VIEW_TYPE_DMIND, active: true });
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  async updateTechDesign() {
    const vaultPath = (this.app.vault.adapter as any).basePath;

    new Notice("正在更新技术设计文档...");

    try {
      const result = await this.service.updateTechDesign(
        vaultPath,
        this.settings.topics
      );

      if (result.status === "no_updates") {
        new Notice("没有新的碎片需要处理");
      } else if (result.status === "draft_ready") {
        new Notice(`草稿已生成，使用了 ${result.fragments_used?.length || 0} 个碎片`);
        // 打开侧边栏显示草稿
        await this.activateView();
      }
    } catch (error) {
      new Notice(`更新失败: ${error.message}`);
      console.error("Update tech design failed:", error);
    }
  }

  async checkServerStatus() {
    try {
      const health = await this.service.healthCheck();
      new Notice(`Server 状态: ${health.status} (v${health.version})`);
    } catch (error) {
      new Notice(`无法连接到 Server: ${error.message}`);
    }
  }
}

class DMindSettingTab extends PluginSettingTab {
  plugin: DMindPlugin;

  constructor(app: App, plugin: DMindPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.createEl("h2", { text: "DMind 设置" });

    new Setting(containerEl)
      .setName("Server URL")
      .setDesc("本地 Python Server 地址")
      .addText((text) =>
        text
          .setPlaceholder("http://127.0.0.1:8765")
          .setValue(this.plugin.settings.serverUrl)
          .onChange(async (value) => {
            this.plugin.settings.serverUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Topics")
      .setDesc("要匹配的主题标签（逗号分隔）")
      .addText((text) =>
        text
          .setPlaceholder("Minion, Tech")
          .setValue(this.plugin.settings.topics.join(", "))
          .onChange(async (value) => {
            this.plugin.settings.topics = value
              .split(",")
              .map((t) => t.trim())
              .filter((t) => t.length > 0);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("自动更新")
      .setDesc("打开文件时自动检查更新")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoUpdate)
          .onChange(async (value) => {
            this.plugin.settings.autoUpdate = value;
            await this.plugin.saveSettings();
          })
      );
  }
}

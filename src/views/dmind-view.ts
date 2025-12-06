import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import type DMindPlugin from "../main";

export const VIEW_TYPE_DMIND = "dmind-view";

export class DMindView extends ItemView {
  plugin: DMindPlugin;
  private currentDraft: {
    id: string;
    content: string;
    diff?: { old: string; new: string };
    fragments: string[];
  } | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: DMindPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE_DMIND;
  }

  getDisplayText() {
    return "DMind";
  }

  getIcon() {
    return "brain";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("dmind-view-container");

    this.renderContent(container);
  }

  async onClose() {
    // 清理
  }

  private renderContent(container: Element) {
    // Header
    const header = container.createEl("div", { cls: "dmind-header" });
    header.createEl("h3", { text: "DMind Agent" });

    // Status
    const statusEl = container.createEl("div", { cls: "dmind-status" });
    this.renderStatus(statusEl);

    // Actions
    const actionsEl = container.createEl("div", { cls: "dmind-actions" });
    this.renderActions(actionsEl);

    // Draft preview
    const draftEl = container.createEl("div", { cls: "dmind-draft" });
    this.renderDraft(draftEl);

    // Styles
    this.addStyles();
  }

  private async renderStatus(container: Element) {
  container.empty();

    try {
      const health = await this.plugin.service.healthCheck();
      container.createEl("div", {
        cls: "dmind-status-item dmind-status-ok",
        text: `Server: ${health.status} (v${health.version})`,
      });
    } catch (error) {
      container.createEl("div", {
        cls: "dmind-status-item dmind-status-error",
        text: "Server: 离线",
      });
    }
  }

  private renderActions(container: Element) {
    container.empty();

    // Update button
    const updateBtn = container.createEl("button", {
      cls: "dmind-btn dmind-btn-primary",
      text: "更新技术设计",
    });
    updateBtn.addEventListener("click", () => this.handleUpdate());

    // Refresh status button
    const refreshBtn = container.createEl("button", {
      cls: "dmind-btn",
      text: "刷新状态",
    });
    refreshBtn.addEventListener("click", () => {
      const statusEl = this.containerEl.querySelector(".dmind-status");
      if (statusEl) this.renderStatus(statusEl);
    });
  }

  private renderDraft(container: Element) {
    container.empty();

    if (!this.currentDraft) {
      container.createEl("div", {
        cls: "dmind-draft-empty",
        text: "暂无草稿。点击「更新技术设计」扫描新碎片。",
      });
      return;
    }

    // Draft header
    const headerEl = container.createEl("div", { cls: "dmind-draft-header" });
    headerEl.createEl("h4", { text: "草稿预览" });
    headerEl.createEl("span", {
      cls: "dmind-draft-info",
      text: `使用了 ${this.currentDraft.fragments.length} 个碎片`,
    });

    // Fragments list
    if (this.currentDraft.fragments.length > 0) {
      const fragmentsEl = container.createEl("div", { cls: "dmind-fragments" });
      fragmentsEl.createEl("h5", { text: "来源碎片:" });
      const list = fragmentsEl.createEl("ul");
      this.currentDraft.fragments.forEach((f) => {
        list.createEl("li", { text: f });
      });
    }

    // Content preview
    const previewEl = container.createEl("div", { cls: "dmind-draft-preview" });
    previewEl.createEl("pre", { text: this.currentDraft.content.slice(0, 1000) });
    if (this.currentDraft.content.length > 1000) {
      previewEl.createEl("div", {
        cls: "dmind-draft-more",
        text: "... (点击接受查看完整内容)",
      });
    }

    // Actions
    const actionsEl = container.createEl("div", { cls: "dmind-draft-actions" });

    const acceptBtn = actionsEl.createEl("button", {
      cls: "dmind-btn dmind-btn-success",
      text: "接受草稿",
    });
    acceptBtn.addEventListener("click", () => this.handleAccept());

    const rejectBtn = actionsEl.createEl("button", {
      cls: "dmind-btn dmind-btn-danger",
      text: "拒绝",
    });
    rejectBtn.addEventListener("click", () => this.handleReject());
  }

  private async handleUpdate() {
    const vaultPath = (this.app.vault.adapter as any).basePath;

    new Notice("正在扫描碎片...");

    try {
      const result = await this.plugin.service.updateTechDesign(
        vaultPath,
        this.plugin.settings.topics
      );

      if (result.status === "no_updates") {
        new Notice("没有新的碎片需要处理");
        this.currentDraft = null;
      } else if (result.status === "draft_ready") {
        this.currentDraft = {
          id: result.draft_id!,
          content: result.draft!,
          diff: result.diff,
          fragments: result.fragments_used,
        };
        new Notice(`草稿已生成`);
      }

      // 刷新视图
      const draftEl = this.containerEl.querySelector(".dmind-draft");
      if (draftEl) this.renderDraft(draftEl);
    } catch (error) {
      new Notice(`更新失败: ${error.message}`);
    }
  }

  private async handleAccept() {
    if (!this.currentDraft) return;

    const vaultPath = (this.app.vault.adapter as any).basePath;

    try {
      const result = await this.plugin.service.acceptDraft(
        vaultPath,
        this.currentDraft.id
      );
      new Notice(`草稿已应用到: ${result.file}`);
      this.currentDraft = null;

      // 刷新视图
      const draftEl = this.containerEl.querySelector(".dmind-draft");
      if (draftEl) this.renderDraft(draftEl);
    } catch (error) {
      new Notice(`接受草稿失败: ${error.message}`);
    }
  }

  private handleReject() {
    this.currentDraft = null;
    new Notice("草稿已拒绝");

    // 刷新视图
    const draftEl = this.containerEl.querySelector(".dmind-draft");
    if (draftEl) this.renderDraft(draftEl);
  }

  private addStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .dmind-view-container {
        padding: 16px;
      }
      .dmind-header h3 {
        margin: 0 0 16px 0;
      }
      .dmind-status {
        margin-bottom: 16px;
      }
      .dmind-status-item {
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
      }
      .dmind-status-ok {
        background: var(--background-modifier-success);
        color: var(--text-success);
      }
      .dmind-status-error {
        background: var(--background-modifier-error);
        color: var(--text-error);
      }
      .dmind-actions {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }
      .dmind-btn {
        padding: 8px 16px;
        border-radius: 4px;
        border: none;
        cursor: pointer;
        font-size: 14px;
      }
      .dmind-btn-primary {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
      }
      .dmind-btn-success {
        background: var(--background-modifier-success);
        color: var(--text-success);
      }
      .dmind-btn-danger {
        background: var(--background-modifier-error);
        color: var(--text-error);
      }
      .dmind-draft {
        margin-top: 16px;
      }
      .dmind-draft-empty {
        color: var(--text-muted);
        font-style: italic;
      }
      .dmind-draft-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .dmind-draft-info {
        color: var(--text-muted);
        font-size: 12px;
      }
      .dmind-fragments {
        margin-bottom: 12px;
        padding: 8px;
        background: var(--background-secondary);
        border-radius: 4px;
      }
      .dmind-fragments h5 {
        margin: 0 0 8px 0;
        font-size: 12px;
      }
      .dmind-fragments ul {
        margin: 0;
        padding-left: 16px;
        font-size: 11px;
      }
      .dmind-draft-preview {
        background: var(--background-secondary);
        padding: 12px;
        border-radius: 4px;
        margin-bottom: 12px;
      }
      .dmind-draft-preview pre {
        margin: 0;
        white-space: pre-wrap;
        font-size: 12px;
      }
      .dmind-draft-more {
        color: var(--text-muted);
        font-style: italic;
        margin-top: 8px;
      }
      .dmind-draft-actions {
        display: flex;
        gap: 8px;
      }
    `;
    this.containerEl.appendChild(style);
  }
}

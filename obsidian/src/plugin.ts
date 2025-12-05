import { Plugin, WorkspaceLeaf } from "obsidian";
import { ChatView, VIEW_TYPE_CHAT } from "./components/chat/ChatView";
import {
  createSettingsStore,
  type SettingsStore,
} from "./adapters/obsidian/settings-store.adapter";
import { AgentClientSettingTab } from "./components/settings/AgentClientSettingTab";

export interface AgentClientPluginSettings {
  autoAllowPermissions: boolean;
  autoMentionActiveNote: boolean;
  debugMode: boolean;
}

const DEFAULT_SETTINGS: AgentClientPluginSettings = {
  autoAllowPermissions: false,
  autoMentionActiveNote: true,
  debugMode: false,
};

export default class AgentClientPlugin extends Plugin {
  settings: AgentClientPluginSettings;
  settingsStore!: SettingsStore;

  // Active ACP adapter instance (shared across use cases)
  acpAdapter: import("./adapters/acp/acp.adapter").AcpAdapter | null = null;

  async onload() {
    await this.loadSettings();

    // Initialize settings store
    this.settingsStore = createSettingsStore(this.settings, this);

    this.registerView(VIEW_TYPE_CHAT, (leaf) => new ChatView(leaf, this));

    const ribbonIconEl = this.addRibbonIcon(
      "bot-message-square",
      "Open agent client",
      (_evt: MouseEvent) => {
        void this.activateView();
      },
    );
    ribbonIconEl.addClass("agent-client-ribbon-icon");

    this.addCommand({
      id: "open-chat-view",
      name: "Open agent chat",
      callback: () => {
        void this.activateView();
      },
    });

    // Register agent-specific commands
    this.registerAgentCommands();
    this.registerPermissionCommands();

    this.addSettingTab(new AgentClientSettingTab(this.app, this));
  }

  onunload() {}

  async activateView() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_CHAT);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: VIEW_TYPE_CHAT,
          active: true,
        });
      }
    }

    if (leaf) {
      await workspace.revealLeaf(leaf);
      // Focus textarea after revealing the leaf
      const viewContainerEl = leaf.view?.containerEl;
      if (viewContainerEl) {
        window.setTimeout(() => {
          const textarea = viewContainerEl.querySelector("textarea.chat-input-textarea");
          if (textarea instanceof HTMLTextAreaElement) {
            textarea.focus();
          }
        }, 0);
      }
    }
  }

  /**
   * Open chat view and switch to specified agent
   */
  private async openChatWithAgent(): Promise<void> {
    // Activate view (create new or focus existing)
    await this.activateView();

    // Trigger new chat
    this.app.workspace.trigger("agent-client:new-chat-requested" as "quit");
  }

  /**
   * Register commands for each configured agent
   */
  private registerAgentCommands(): void {
    this.addCommand({
      id: "open-chat",
      name: "New chat",
      callback: async () => {
        await this.openChatWithAgent();
      },
    });
  }

  private registerPermissionCommands(): void {
    this.addCommand({
      id: "approve-active-permission",
      name: "Approve active permission",
      callback: async () => {
        await this.activateView();
        this.app.workspace.trigger("agent-client:approve-active-permission");
      },
    });

    this.addCommand({
      id: "reject-active-permission",
      name: "Reject active permission",
      callback: async () => {
        await this.activateView();
        this.app.workspace.trigger("agent-client:reject-active-permission");
      },
    });

    this.addCommand({
      id: "toggle-auto-mention",
      name: "Toggle auto-mention",
      callback: async () => {
        await this.activateView();
        this.app.workspace.trigger("agent-client:toggle-auto-mention");
      },
    });

    this.addCommand({
      id: "cancel-current-message",
      name: "Cancel current message",
      callback: () => {
        this.app.workspace.trigger("agent-client:cancel-message");
      },
    });
  }

  async loadSettings() {
    const rawSettings = ((await this.loadData()) ?? {}) as Record<string, unknown>;

    // Simplified settings loading - only core settings remain
    this.settings = {
      autoAllowPermissions:
        typeof rawSettings.autoAllowPermissions === "boolean"
          ? rawSettings.autoAllowPermissions
          : DEFAULT_SETTINGS.autoAllowPermissions,
      autoMentionActiveNote:
        typeof rawSettings.autoMentionActiveNote === "boolean"
          ? rawSettings.autoMentionActiveNote
          : DEFAULT_SETTINGS.autoMentionActiveNote,
      debugMode:
        typeof rawSettings.debugMode === "boolean"
          ? rawSettings.debugMode
          : DEFAULT_SETTINGS.debugMode,
    };
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async saveSettingsAndNotify(nextSettings: AgentClientPluginSettings) {
    this.settings = nextSettings;
    await this.saveData(this.settings);
    this.settingsStore.set(this.settings);
  }
}

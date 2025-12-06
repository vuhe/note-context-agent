import { Plugin, WorkspaceLeaf } from "obsidian";
import { ChatView } from "./components/chat/ChatView";
import {
  createSettingsStore,
  type SettingsStore,
} from "./adapters/obsidian/settings-store.adapter";
import { AgentClientSettingTab } from "./components/settings/AgentClientSettingTab";
import { useNoteAgent } from "./adapters/note-agent";

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
  settings: AgentClientPluginSettings = DEFAULT_SETTINGS;
  settingsStore!: SettingsStore;

  // Active ACP adapter instance (shared across use cases)
  acpAdapter: import("./adapters/acp/acp.adapter").AcpAdapter | null = null;

  async onload() {
    await this.loadSettings();

    // Initialize settings store
    this.settingsStore = createSettingsStore(this.settings, this);

    this.registerView(ChatView.ViewType, (leaf) => new ChatView(leaf, this));

    const ribbonIconEl = this.addRibbonIcon(
      "bot-message-square",
      // eslint-disable-next-line obsidianmd/ui/sentence-case
      "打开 Agent 对话",
      (_evt: MouseEvent) => {
        void this.activateView();
      },
    );
    ribbonIconEl.addClass("agent-client-ribbon-icon");

    this.addCommand({
      id: "open-chat-view",
      name: "打开对话面板",
      callback: async () => {
        await this.activateView();
      },
    });

    this.addCommand({
      id: "open-new-chat",
      name: "新对话",
      callback: async () => {
        const newSession = useNoteAgent(s => s.newSession);
        await newSession();
      },
    });

    this.addCommand({
      id: "toggle-auto-mention",
      name: "Toggle auto-mention",
      callback: async () => {
        await this.activateView();
        // TODO: 如果需要实现则调用 useNoteAgent 方法
      },
    });

    this.addSettingTab(new AgentClientSettingTab(this.app, this));
  }

  onunload() {}

  async activateView() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(ChatView.ViewType);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: ChatView.ViewType,
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
}

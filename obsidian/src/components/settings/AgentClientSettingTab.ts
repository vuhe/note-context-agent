import { App, PluginSettingTab, Setting } from "obsidian";
import type AgentClientPlugin from "../../plugin";

export class AgentClientSettingTab extends PluginSettingTab {
  plugin: AgentClientPlugin;

  constructor(app: App, plugin: AgentClientPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("Auto-allow permissions")
      .setDesc(
        "Automatically allow all permission requests from agents. ⚠️ Use with caution - this gives agents full access to your system.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoAllowPermissions).onChange(async (value) => {
          this.plugin.settings.autoAllowPermissions = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Auto-mention active note")
      .setDesc(
        "Include the current note in your messages automatically. The agent will have access to its content without typing @notename.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoMentionActiveNote).onChange(async (value) => {
          this.plugin.settings.autoMentionActiveNote = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl).setName("Developer").setHeading();

    new Setting(containerEl)
      .setName("Debug mode")
      .setDesc("Enable debug logging to console. Useful for development and troubleshooting.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.debugMode).onChange(async (value) => {
          this.plugin.settings.debugMode = value;
          await this.plugin.saveSettings();
        }),
      );
  }
}

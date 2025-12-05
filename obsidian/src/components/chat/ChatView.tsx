import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import * as React from "react";
const { useState, useRef, useEffect, useMemo, useCallback } = React;
import { createRoot, Root } from "react-dom/client";

import type AgentClientPlugin from "../../plugin";

// Component imports
import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";

// Service imports
import { NoteMentionService } from "../../adapters/obsidian/mention-service";

// Utility imports
import { Logger } from "../../shared/logger";

// Adapter imports
import { AcpAdapter, type IAcpClient } from "../../adapters/acp/acp.adapter";
import { ObsidianVaultAdapter } from "../../adapters/obsidian/vault.adapter";

// Hooks imports
import { useSettings } from "../../hooks/useSettings";
import { useMentions } from "../../hooks/useMentions";
import { useSlashCommands } from "../../hooks/useSlashCommands";
import { useAutoMention } from "../../hooks/useAutoMention";
import { useAgentSession } from "../../hooks/useAgentSession";
import { useChat } from "../../hooks/useChat";
import { usePermission } from "../../hooks/usePermission";

// Type definitions for Obsidian internal APIs
interface VaultAdapterWithBasePath {
  basePath?: string;
}

interface AppWithSettings {
  setting: {
    open: () => void;
    openTabById: (id: string) => void;
  };
}

export const VIEW_TYPE_CHAT = "agent-client-chat-view";

function ChatComponent({
  plugin,
  view,
}: {
  plugin: AgentClientPlugin;
  view: ChatView;
}) {
  // ============================================================
  // Memoized Services & Adapters
  // ============================================================
  const logger = useMemo(() => new Logger(plugin), [plugin]);

  const vaultPath = useMemo(() => {
    return (
      (plugin.app.vault.adapter as VaultAdapterWithBasePath).basePath ||
      process.cwd()
    );
  }, [plugin]);

  const noteMentionService = useMemo(
    () => new NoteMentionService(plugin),
    [plugin],
  );

  // Cleanup NoteMentionService when component unmounts
  useEffect(() => {
    return () => {
      noteMentionService.destroy();
    };
  }, [noteMentionService]);

  const acpAdapter = useMemo(() => new AcpAdapter(plugin), [plugin]);
  const acpClientRef = useRef<IAcpClient>(acpAdapter);

  const vaultAccessAdapter = useMemo(() => {
    return new ObsidianVaultAdapter(plugin, noteMentionService);
  }, [plugin, noteMentionService]);

  // ============================================================
  // Custom Hooks
  // ============================================================
  const settings = useSettings(plugin);

  const agentSession = useAgentSession(
    acpAdapter,
    plugin.settingsStore,
    vaultPath,
  );

  const {
    session,
    errorInfo: sessionErrorInfo,
    isReady: isSessionReady,
  } = agentSession;

  const chat = useChat(acpAdapter, vaultAccessAdapter, noteMentionService, {
    sessionId: session.sessionId,
    authMethods: session.authMethods,
  });

  const { messages, isSending } = chat;

  const permission = usePermission(acpAdapter, messages);

  const mentions = useMentions(vaultAccessAdapter, plugin);
  const autoMention = useAutoMention(vaultAccessAdapter);
  const slashCommands = useSlashCommands(
    session.availableCommands || [],
    autoMention.toggle,
  );

  // Combined error info (session errors take precedence)
  const errorInfo = sessionErrorInfo || chat.errorInfo || permission.errorInfo;

  // ============================================================
  // Local State
  // ============================================================
  const [restoredMessage, setRestoredMessage] = useState<string | null>(null);

  // ============================================================
  // Callbacks
  // ============================================================
  /**
   * Handle new chat request.
   */
  const handleNewChat = useCallback(async () => {
    const isAgentSwitch = false;

    // Skip if already empty AND not switching agents
    if (messages.length === 0 && !isAgentSwitch) {
      new Notice("[Agent Client] Already a new session");
      return;
    }

    logger.log("[Debug] Creating new session...");

    autoMention.toggle(false);
    chat.clearMessages();
    await agentSession.restartSession();
  }, [messages, session, logger, autoMention, chat, agentSession]);

  const handleOpenSettings = useCallback(() => {
    const appWithSettings = plugin.app as unknown as AppWithSettings;
    appWithSettings.setting.open();
    appWithSettings.setting.openTabById(plugin.manifest.id);
  }, [plugin]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      await chat.sendMessage(content, {
        activeNote: autoMention.activeNote,
        vaultBasePath:
          (plugin.app.vault.adapter as VaultAdapterWithBasePath).basePath || "",
        isAutoMentionDisabled: autoMention.isDisabled,
      });
    },
    [chat, autoMention, plugin],
  );

  const handleStopGeneration = useCallback(async () => {
    logger.log("Cancelling current operation...");
    // Save last user message before cancel (to restore it)
    const lastMessage = chat.lastUserMessage;
    await agentSession.cancelOperation();
    // Restore the last user message to input field
    if (lastMessage) {
      setRestoredMessage(lastMessage);
    }
  }, [logger, agentSession, chat.lastUserMessage]);

  const handleClearError = useCallback(() => {
    chat.clearError();
  }, [chat]);

  const handleRestoredMessageConsumed = useCallback(() => {
    setRestoredMessage(null);
  }, []);

  // ============================================================
  // Effects - Session Lifecycle
  // ============================================================
  // Initialize session on mount or when agent changes
  useEffect(() => {
    logger.log("[Debug] Starting connection setup via useAgentSession...");
    void agentSession.createSession();
  }, [agentSession.createSession]);

  // Refs for cleanup (to access latest values in cleanup function)
  const messagesRef = useRef(messages);
  const sessionRef = useRef(session);
  const closeSessionRef = useRef(agentSession.closeSession);
  messagesRef.current = messages;
  sessionRef.current = session;
  closeSessionRef.current = agentSession.closeSession;

  // Cleanup on unmount only - close session
  useEffect(() => {
    return () => {
      logger.log("[ChatView] Cleanup: close session");
      // Use refs to get latest values (avoid stale closures)
      void (async () => {
        await closeSessionRef.current();
      })();
    };
    // Empty dependency array - only run on unmount
  }, []);

  // ============================================================
  // Effects - ACP Adapter Callbacks
  // ============================================================
  useEffect(() => {
    acpAdapter.setMessageCallbacks(
      chat.addMessage,
      chat.updateLastMessage,
      chat.updateMessage,
      agentSession.updateAvailableCommands,
    );
  }, [
    acpAdapter,
    chat.addMessage,
    chat.updateLastMessage,
    chat.updateMessage,
    agentSession.updateAvailableCommands,
  ]);

  // ============================================================
  // Effects - Auto-mention Active Note Tracking
  // ============================================================
  useEffect(() => {
    let isMounted = true;

    const refreshActiveNote = async () => {
      if (!isMounted) return;
      await autoMention.updateActiveNote();
    };

    const unsubscribe = vaultAccessAdapter.subscribeSelectionChanges(() => {
      void refreshActiveNote();
    });

    void refreshActiveNote();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [autoMention.updateActiveNote, vaultAccessAdapter]);

  // ============================================================
  // Effects - Workspace Events (Hotkeys)
  // ============================================================
  useEffect(() => {
    const workspace = plugin.app.workspace;

    const eventRef = workspace.on(
      "agent-client:toggle-auto-mention" as "quit",
      () => {
        autoMention.toggle();
      },
    );

    return () => {
      workspace.offref(eventRef);
    };
  }, [plugin.app.workspace, autoMention.toggle]);

  // Handle new chat request from plugin commands (e.g., "New chat with [Agent]")
  useEffect(() => {
    const workspace = plugin.app.workspace;

    // Cast to any to bypass Obsidian's type constraints for custom events
    const eventRef = (
      workspace as unknown as {
        on: (
          name: string,
          callback: () => void,
        ) => ReturnType<typeof workspace.on>;
      }
    ).on("agent-client:new-chat-requested", () => {
      void handleNewChat();
    });

    return () => {
      workspace.offref(eventRef);
    };
  }, [plugin.app.workspace, handleNewChat]);

  useEffect(() => {
    const workspace = plugin.app.workspace;

    const approveRef = workspace.on(
      "agent-client:approve-active-permission" as "quit",
      () => {
        void (async () => {
          const success = await permission.approveActivePermission();
          if (!success) {
            new Notice("[Agent Client] No active permission request");
          }
        })();
      },
    );

    const rejectRef = workspace.on(
      "agent-client:reject-active-permission" as "quit",
      () => {
        void (async () => {
          const success = await permission.rejectActivePermission();
          if (!success) {
            new Notice("[Agent Client] No active permission request");
          }
        })();
      },
    );

    const cancelRef = workspace.on(
      "agent-client:cancel-message" as "quit",
      () => {
        void handleStopGeneration();
      },
    );

    return () => {
      workspace.offref(approveRef);
      workspace.offref(rejectRef);
      workspace.offref(cancelRef);
    };
  }, [
    plugin.app.workspace,
    permission.approveActivePermission,
    permission.rejectActivePermission,
    handleStopGeneration,
  ]);

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="chat-view-container">
      <ChatHeader
        onNewChat={() => void handleNewChat()}
        onOpenSettings={handleOpenSettings}
      />

      <ChatMessages
        messages={messages}
        isSending={isSending}
        isSessionReady={isSessionReady}
        errorInfo={errorInfo}
        plugin={plugin}
        view={view}
        acpClient={acpClientRef.current}
        onApprovePermission={permission.approvePermission}
        onClearError={handleClearError}
      />

      <ChatInput
        isSending={isSending}
        isSessionReady={isSessionReady}
        availableCommands={session.availableCommands || []}
        autoMentionEnabled={settings.autoMentionActiveNote}
        restoredMessage={restoredMessage}
        mentions={mentions}
        slashCommands={slashCommands}
        autoMention={autoMention}
        plugin={plugin}
        view={view}
        onSendMessage={handleSendMessage}
        onStopGeneration={handleStopGeneration}
        onRestoredMessageConsumed={handleRestoredMessageConsumed}
      />
    </div>
  );
}

export class ChatView extends ItemView {
  private root: Root | null = null;
  private plugin: AgentClientPlugin;
  private logger: Logger;

  constructor(leaf: WorkspaceLeaf, plugin: AgentClientPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.logger = new Logger(plugin);
  }

  getViewType() {
    return VIEW_TYPE_CHAT;
  }

  getDisplayText() {
    return "Agent client";
  }

  getIcon() {
    return "bot-message-square";
  }

  onOpen() {
    const container = this.containerEl.children[1];
    container.empty();

    this.root = createRoot(container);
    this.root.render(<ChatComponent plugin={this.plugin} view={this} />);
    return Promise.resolve();
  }

  onClose(): Promise<void> {
    this.logger.log("[ChatView] onClose() called");
    // Cleanup is handled by React useEffect cleanup in ChatComponent
    // which performs auto-export and closeSession
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    return Promise.resolve();
  }
}

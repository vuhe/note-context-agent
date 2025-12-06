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
import { AcpAdapter } from "../../adapters/acp/acp.adapter";
import { ObsidianVaultAdapter } from "../../adapters/obsidian/vault.adapter";

// Hooks imports
import { useSettings } from "../../hooks/useSettings";
import { useMentions } from "../../hooks/useMentions";
import { useAutoMention } from "../../hooks/useAutoMention";
import { useAgentSession } from "../../hooks/useAgentSession";
import { useChat } from "../../hooks/useChat";

// Type definitions for Obsidian internal APIs
interface VaultAdapterWithBasePath {
  basePath?: string;
}

function ChatComponent({ plugin, view }: { plugin: AgentClientPlugin; view: ChatView }) {
  // ============================================================
  // Memoized Services & Adapters
  // ============================================================
  const vaultPath = useMemo(() => {
    return (plugin.app.vault.adapter as VaultAdapterWithBasePath).basePath || process.cwd();
  }, [plugin]);

  const noteMentionService = useMemo(() => new NoteMentionService(plugin), [plugin]);

  // Cleanup NoteMentionService when component unmounts
  useEffect(() => {
    return () => {
      noteMentionService.destroy();
    };
  }, [noteMentionService]);

  const acpAdapter = useMemo(() => new AcpAdapter(plugin), [plugin]);

  const vaultAccessAdapter = useMemo(() => {
    return new ObsidianVaultAdapter(plugin, noteMentionService);
  }, [plugin, noteMentionService]);

  // ============================================================
  // Custom Hooks
  // ============================================================
  const settings = useSettings(plugin);

  const agentSession = useAgentSession(acpAdapter, plugin.settingsStore, vaultPath);

  const { session } = agentSession;

  const chat = useChat(acpAdapter, vaultAccessAdapter, noteMentionService, {
    sessionId: session.sessionId,
    authMethods: session.authMethods,
  });

  const { messages } = chat;

  const mentions = useMentions(vaultAccessAdapter, plugin);
  const autoMention = useAutoMention(vaultAccessAdapter);

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
    if (messages.length === 0) {
      new Notice("已经在新对话中了！");
      return;
    }

    Logger.log("[Debug] Creating new session...");

    autoMention.toggle(false);
    chat.clearMessages();
    await agentSession.restartSession();
  }, [messages, session, autoMention, chat, agentSession]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      await chat.sendMessage(content, {
        activeNote: autoMention.activeNote,
        vaultBasePath: (plugin.app.vault.adapter as VaultAdapterWithBasePath).basePath || "",
        isAutoMentionDisabled: autoMention.isDisabled,
      });
    },
    [chat, autoMention, plugin],
  );

  const handleStopGeneration = useCallback(async () => {
    Logger.log("Cancelling current operation...");
    // Save last user message before cancel (to restore it)
    const lastMessage = chat.lastUserMessage;
    await agentSession.cancelOperation();
    // Restore the last user message to input field
    if (lastMessage) {
      setRestoredMessage(lastMessage);
    }
  }, [agentSession, chat.lastUserMessage]);

  const handleRestoredMessageConsumed = useCallback(() => {
    setRestoredMessage(null);
  }, []);

  // ============================================================
  // Effects - Session Lifecycle
  // ============================================================
  // Initialize session on mount or when agent changes
  useEffect(() => {
    Logger.log("[Debug] Starting connection setup via useAgentSession...");
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
      Logger.log("[ChatView] Cleanup: close session");
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
  // Render
  // ============================================================
  return (
    <div className="chat-view-container">
      <ChatHeader onNewChat={() => void handleNewChat()} />
      <ChatMessages view={view} />

      <ChatInput
        autoMentionEnabled={settings.autoMentionActiveNote}
        restoredMessage={restoredMessage}
        mentions={mentions}
        autoMention={autoMention}
        onSendMessage={handleSendMessage}
        onStopGeneration={handleStopGeneration}
        onRestoredMessageConsumed={handleRestoredMessageConsumed}
      />
    </div>
  );
}

export class ChatView extends ItemView {
  static readonly ViewType = "agent-client-chat-view";
  private root: Root | null = null;
  private plugin: AgentClientPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: AgentClientPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return ChatView.ViewType;
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
    Logger.log("[ChatView] onClose() called");
    // Cleanup is handled by React useEffect cleanup in ChatComponent
    // which performs auto-export and closeSession
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    return Promise.resolve();
  }
}

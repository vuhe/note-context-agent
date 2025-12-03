import { useState, useCallback } from "react";
import type {
  ChatSession,
  SessionState,
  SlashCommand,
  AuthenticationMethod,
} from "../domain/models/chat-session";
import type { IAgentClient } from "../domain/ports/agent-client.port";
import type { ISettingsAccess } from "../domain/ports/settings-access.port";

// ============================================================================
// Types
// ============================================================================

/**
 * Error information specific to session operations.
 */
export interface SessionErrorInfo {
  title: string;
  message: string;
  suggestion?: string;
}

/**
 * Return type for useAgentSession hook.
 */
export interface UseAgentSessionReturn {
  /** Current session state */
  session: ChatSession;
  /** Whether the session is ready for user input */
  isReady: boolean;
  /** Error information if session operation failed */
  errorInfo: SessionErrorInfo | null;

  /**
   * Create a new session with the current active agent.
   * Resets session state and initializes connection.
   */
  createSession: () => Promise<void>;

  /**
   * Restart the current session.
   * Alias for createSession (closes current and creates new).
   */
  restartSession: () => Promise<void>;

  /**
   * Close the current session and disconnect from agent.
   * Cancels any running operation and kills the agent process.
   */
  closeSession: () => Promise<void>;

  /**
   * Cancel the current agent operation.
   * Stops ongoing message generation without disconnecting.
   */
  cancelOperation: () => Promise<void>;

  /**
   * Callback to update available slash commands.
   * Called by AcpAdapter when agent sends available_commands_update.
   */
  updateAvailableCommands: (commands: SlashCommand[]) => void;
}

// ============================================================================
// Initial State
// ============================================================================

/**
 * Create initial session state.
 */
function createInitialSession(workingDirectory: string): ChatSession {
  return {
    sessionId: null,
    state: "disconnected" as SessionState,
    authMethods: [],
    availableCommands: undefined,
    createdAt: new Date(),
    lastActivityAt: new Date(),
    workingDirectory,
  };
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing agent session lifecycle.
 *
 * Handles session creation, restart, cancellation, and agent switching.
 * This hook owns the session state independently.
 *
 * @param agentClient - Agent client for communication
 * @param settingsAccess - Settings access for agent configuration
 * @param workingDirectory - Working directory for the session
 */
export function useAgentSession(
  agentClient: IAgentClient,
  settingsAccess: ISettingsAccess,
  workingDirectory: string,
): UseAgentSessionReturn {
  // Session state
  const [session, setSession] = useState<ChatSession>(() =>
    createInitialSession(workingDirectory),
  );

  // Error state
  const [errorInfo, setErrorInfo] = useState<SessionErrorInfo | null>(null);

  // Derived state
  const isReady = session.state === "ready";

  /**
   * Create a new session with the active agent.
   * (Inlined from ManageSessionUseCase.createSession)
   */
  const createSession = useCallback(async () => {
    // Reset to initializing state immediately
    setSession((prev) => ({
      ...prev,
      sessionId: null,
      state: "initializing",
      authMethods: [],
      availableCommands: undefined,
      createdAt: new Date(),
      lastActivityAt: new Date(),
    }));
    setErrorInfo(null);

    try {
      let authMethods: AuthenticationMethod[] = [];

      if (!agentClient.isInitialized()) {
        // Initialize connection to agent (spawn process + protocol handshake)
        const initResult = await agentClient.initialize(workingDirectory);
        authMethods = initResult.authMethods;
      }

      // Create new session (lightweight operation)
      const sessionResult = await agentClient.newSession(workingDirectory);

      // Success - update to ready state
      setSession((prev) => ({
        ...prev,
        sessionId: sessionResult.sessionId,
        state: "ready",
        authMethods: authMethods,
        lastActivityAt: new Date(),
      }));
    } catch (error) {
      // Error - update to error state
      setSession((prev) => ({ ...prev, state: "error" }));
      setErrorInfo({
        title: "Session Creation Failed",
        message: `Failed to create new session: ${error instanceof Error ? error.message : String(error)}`,
        suggestion: "Please check the agent configuration and try again.",
      });
    }
  }, [agentClient, settingsAccess, workingDirectory]);

  /**
   * Restart the current session.
   */
  const restartSession = useCallback(async () => {
    await createSession();
  }, [createSession]);

  /**
   * Close the current session and disconnect from agent.
   * Cancels any running operation and kills the agent process.
   */
  const closeSession = useCallback(async () => {
    // Cancel current session if active
    if (session.sessionId) {
      try {
        await agentClient.cancel(session.sessionId);
      } catch (error) {
        // Ignore errors - session might already be closed
        console.warn("Failed to cancel session:", error);
      }
    }

    // Disconnect from agent (kill process)
    try {
      await agentClient.disconnect();
    } catch (error) {
      console.warn("Failed to disconnect:", error);
    }

    // Update to disconnected state
    setSession((prev) => ({
      ...prev,
      sessionId: null,
      state: "disconnected",
    }));
  }, [agentClient, session.sessionId]);

  /**
   * Cancel the current operation.
   */
  const cancelOperation = useCallback(async () => {
    if (!session.sessionId) {
      return;
    }

    try {
      // Cancel via agent client
      await agentClient.cancel(session.sessionId);

      // Update to ready state
      setSession((prev) => ({
        ...prev,
        state: "ready",
      }));
    } catch (error) {
      // If cancel fails, log but still update UI
      console.warn("Failed to cancel operation:", error);

      // Still update to ready state
      setSession((prev) => ({
        ...prev,
        state: "ready",
      }));
    }
  }, [agentClient, session.sessionId]);

  /**
   * Update available slash commands.
   * Called by AcpAdapter when receiving available_commands_update.
   */
  const updateAvailableCommands = useCallback((commands: SlashCommand[]) => {
    setSession((prev) => ({
      ...prev,
      availableCommands: commands,
    }));
  }, []);

  return {
    session,
    isReady,
    errorInfo,
    createSession,
    restartSession,
    closeSession,
    cancelOperation,
    updateAvailableCommands,
  };
}

import * as acp from "@agentclientprotocol/sdk";

import type {
  IAgentClient,
  InitializeResult,
  NewSessionResult,
  PermissionRequest,
} from "../../domain/ports/agent-client.port";
import type {
  ChatMessage,
  MessageContent,
  PermissionOption,
} from "../../domain/models/chat-message";
import type { AgentError } from "../../domain/models/agent-error";
import { AcpTypeConverter } from "./acp-type-converter";
import { Logger } from "../../shared/logger";
import type AgentClientPlugin from "../../plugin";
import type { SlashCommand } from "src/domain/models/chat-session";

/**
 * Extended ACP Client interface for UI layer.
 *
 * Provides ACP-specific operations needed by UI components
 * (permission handling, etc.) that are not
 * part of the domain-level IAgentClient interface.
 *
 * This interface extends the base ACP Client from the protocol library
 * with plugin-specific methods for:
 * - Permission response handling
 * - Operation cancellation
 * - Message state management
 */
export interface IAcpClient extends acp.Client {
  handlePermissionResponse(requestId: string, optionId: string): void;
  cancelAllOperations(): void;
  resetCurrentMessage(): void;
}

/**
 * Adapter that wraps the Agent Client Protocol (ACP) library.
 *
 * This adapter:
 * - Manages agent process lifecycle (spawn, monitor, kill)
 * - Implements ACP protocol directly (no intermediate AcpClient layer)
 * - Handles message updates and terminal operations
 * - Provides callbacks for UI updates
 */
export class AcpAdapter implements IAgentClient, IAcpClient {
  private logger: Logger;

  // Callback handlers
  private messageCallback: ((message: ChatMessage) => void) | null = null;
  private errorCallback: ((error: AgentError) => void) | null = null;
  private permissionCallback: ((request: PermissionRequest) => void) | null =
    null;
  private updateAvailableCommandsCallback:
    | ((commands: SlashCommand[]) => void)
    | null = null;

  // Message update callbacks (for ViewModel integration)
  private addMessage: (message: ChatMessage) => void;
  private updateLastMessage: (content: MessageContent) => void;
  private updateMessage: (
    toolCallId: string,
    content: MessageContent,
  ) => boolean;

  // Configuration state
  private workingDirectory: string | null = null;
  private isInitializedFlag = false;
  private autoAllowPermissions = false;

  // IAcpClient implementation properties
  private currentMessageId: string | null = null;
  private pendingPermissionRequests = new Map<
    string,
    {
      resolve: (response: acp.RequestPermissionResponse) => void;
      toolCallId: string;
      options: PermissionOption[];
    }
  >();
  private pendingPermissionQueue: Array<{
    requestId: string;
    toolCallId: string;
    options: PermissionOption[];
  }> = [];

  constructor(
    private plugin: AgentClientPlugin,
    addMessage?: (message: ChatMessage) => void,
    updateLastMessage?: (content: MessageContent) => void,
    updateMessage?: (toolCallId: string, content: MessageContent) => boolean,
  ) {
    this.logger = new Logger(plugin);
    // Initialize with provided callbacks or no-ops
    this.addMessage = addMessage || (() => {});
    this.updateLastMessage = updateLastMessage || (() => {});
    this.updateMessage = updateMessage || (() => false);
  }

  /**
   * Set message callbacks after construction.
   *
   * This allows decoupling AcpAdapter creation from ViewModel creation,
   * enabling proper dependency injection in Clean Architecture.
   *
   * @param addMessage - Callback to add a new message to chat
   * @param updateLastMessage - Callback to update the last message
   * @param updateMessage - Callback to update a specific message by toolCallId
   * @param updateAvailableCommandsCallback - Callback to update available commands
   */
  setMessageCallbacks(
    addMessage: (message: ChatMessage) => void,
    updateLastMessage: (content: MessageContent) => void,
    updateMessage: (toolCallId: string, content: MessageContent) => boolean,
    updateAvailableCommandsCallback: (commands: SlashCommand[]) => void,
  ): void {
    this.addMessage = addMessage;
    this.updateLastMessage = updateLastMessage;
    this.updateMessage = updateMessage;
    this.updateAvailableCommandsCallback = updateAvailableCommandsCallback;
  }

  /**
   * Initialize connection to an AI agent.
   * Spawns the agent process and establishes ACP connection.
   */
  async initialize(workingDirectory: string): Promise<InitializeResult> {
    this.logger.log(
      "[AcpAdapter] Starting agent process in directory:",
      workingDirectory,
    );

    this.workingDirectory = workingDirectory;

    // Update auto-allow permissions from plugin settings
    this.autoAllowPermissions = this.plugin.settings.autoAllowPermissions;

    // TODO: 接入后端初始化，但更可能什么也不做

    // Mark as initialized
    this.isInitializedFlag = true;

    return {
      protocolVersion: 0,
      authMethods: [],
    };
  }

  /**
   * Create a new chat session with the agent.
   */
  async newSession(workingDirectory: string): Promise<NewSessionResult> {
    try {
      this.logger.log("[AcpAdapter] Creating new session...");

      // TODO: 在此，后端应该创建对话记录和上下文，用于提供对应的对话上下文和记录

      const sessionId = "backend session";

      this.logger.log(`[AcpAdapter] 📝 Created session: ${sessionId}`);

      return {
        sessionId: sessionId,
      };
    } catch (error) {
      this.logger.error("[AcpAdapter] New Session Error:", error);

      const agentError: AgentError = {
        id: crypto.randomUUID(),
        category: "connection",
        severity: "error",
        title: "Session Creation Failed",
        message: `Failed to create new session: ${error instanceof Error ? error.message : String(error)}`,
        suggestion: "Please try disconnecting and reconnecting to the agent.",
        occurredAt: new Date(),
        originalError: error,
      };

      this.errorCallback?.(agentError);
      throw error;
    }
  }

  /**
   * Authenticate with the agent using a specific method.
   */
  async authenticate(methodId: string): Promise<boolean> {
    try {
      // TODO: 此处应该交给后端验证是否可用
      this.logger.log("[AcpAdapter] ✅ authenticate ok:", methodId);
      return true;
    } catch (error: unknown) {
      this.logger.error("[AcpAdapter] Authentication Error:", error);

      // Check if this is a rate limit error
      const errorObj = error as Record<string, unknown> | null;
      const isRateLimitError =
        errorObj &&
        typeof errorObj === "object" &&
        "code" in errorObj &&
        errorObj.code === 429;

      let agentError: AgentError;

      if (isRateLimitError) {
        // Rate limit error
        const errorMessage =
          errorObj &&
          "message" in errorObj &&
          typeof errorObj.message === "string"
            ? errorObj.message
            : null;
        agentError = {
          id: crypto.randomUUID(),
          category: "rate_limit",
          severity: "error",
          title: "Rate Limit Exceeded",
          message: errorMessage
            ? `Rate limit exceeded: ${errorMessage}`
            : "Rate limit exceeded. Too many requests. Please try again later.",
          suggestion:
            "You have exceeded the API rate limit. Please wait a few moments before trying again.",
          occurredAt: new Date(),
          originalError: error,
        };
      } else {
        // Authentication error
        agentError = {
          id: crypto.randomUUID(),
          category: "authentication",
          severity: "error",
          title: "Authentication Failed",
          message: `Authentication failed: ${error instanceof Error ? error.message : String(error)}`,
          suggestion:
            "Please check your API key or authentication credentials in settings.",
          occurredAt: new Date(),
          originalError: error,
        };
      }

      this.errorCallback?.(agentError);
      return false;
    }
  }

  /**
   * Send a message to the agent in a specific session.
   */
  async sendMessage(sessionId: string, message: string): Promise<void> {
    // Reset current message for new assistant response
    this.resetCurrentMessage();

    try {
      this.logger.log(`[AcpAdapter] ✅ Sending Message...: ${message}`);

      // TODO: 应该替换为后端的处理，发送一条之后，后端会一直进行输出直到结束
      const promptResult = { stopReason: "backend stop" };

      this.logger.log(
        `[AcpAdapter] ✅ Agent completed with: ${promptResult.stopReason}`,
      );
    } catch (error: unknown) {
      this.logger.error("[AcpAdapter] Prompt Error:", error);

      // Check if this is an ignorable error (empty response or user abort)
      const errorObj = error as Record<string, unknown> | null;
      if (
        errorObj &&
        typeof errorObj === "object" &&
        "code" in errorObj &&
        errorObj.code === -32603 &&
        "data" in errorObj
      ) {
        const errorData = errorObj.data as Record<string, unknown> | null;
        if (
          errorData &&
          typeof errorData === "object" &&
          "details" in errorData &&
          typeof errorData.details === "string"
        ) {
          // Ignore "empty response text" errors
          if (errorData.details.includes("empty response text")) {
            this.logger.log(
              "[AcpAdapter] Empty response text error - ignoring",
            );
            return;
          }
          // Ignore "user aborted" errors (from cancel operation)
          if (errorData.details.includes("user aborted")) {
            this.logger.log("[AcpAdapter] User aborted request - ignoring");
            return;
          }
        }
      }

      const agentError: AgentError = {
        id: crypto.randomUUID(),
        category: "communication",
        severity: "error",
        title: "Message Send Failed",
        message: `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
        suggestion: "Please check your connection and try again.",
        occurredAt: new Date(),
        sessionId: sessionId,
        originalError: error,
      };

      this.errorCallback?.(agentError);
      throw error;
    }
  }

  /**
   * Cancel the current operation in a session.
   */
  async cancel(sessionId: string): Promise<void> {
    try {
      this.logger.log("[AcpAdapter] Sending session/cancel notification...");

      // 应该向后端发送取消请求

      this.logger.log("[AcpAdapter] Cancellation request sent successfully");

      // Cancel all running operations (permission requests + terminals)
      this.cancelAllOperations();
    } catch (error) {
      this.logger.error("[AcpAdapter] Failed to send cancellation:", error);

      // Still cancel all operations even if network cancellation failed
      this.cancelAllOperations();
    }
  }

  /**
   * Disconnect from the agent and clean up resources.
   */
  disconnect(): Promise<void> {
    this.logger.log("[AcpAdapter] Disconnecting...");

    // Cancel all pending operations
    this.cancelAllOperations();

    // Reset initialization state
    this.isInitializedFlag = false;

    this.logger.log("[AcpAdapter] Disconnected");
    return Promise.resolve();
  }

  /**
   * Check if the agent connection is initialized and ready.
   *
   * Implementation of IAgentClient.isInitialized()
   */
  isInitialized(): boolean {
    return this.isInitializedFlag;
  }

  /**
   * Register a callback to receive chat messages from the agent.
   */
  onMessage(callback: (message: ChatMessage) => void): void {
    this.messageCallback = callback;
  }

  /**
   * Register a callback to receive error notifications.
   */
  onError(callback: (error: AgentError) => void): void {
    this.errorCallback = callback;
  }

  /**
   * Register a callback to receive permission requests from the agent.
   */
  onPermissionRequest(callback: (request: PermissionRequest) => void): void {
    this.permissionCallback = callback;
  }

  /**
   * Respond to a permission request from the agent.
   */
  respondToPermission(requestId: string, optionId: string): Promise<void> {
    this.logger.log(
      "[AcpAdapter] Responding to permission request:",
      requestId,
      "with option:",
      optionId,
    );
    this.handlePermissionResponse(requestId, optionId);
    return Promise.resolve();
  }

  // ========================================================================
  // IAcpClient Implementation
  // ========================================================================

  /**
   * Handle session updates from the ACP protocol.
   * This is called by ClientSideConnection when the agent sends updates.
   */
  sessionUpdate(params: acp.SessionNotification): Promise<void> {
    const update = params.update;
    this.logger.log("[AcpAdapter] sessionUpdate:", update);

    switch (update.sessionUpdate) {
      case "agent_message_chunk":
        if (update.content.type === "text") {
          this.updateLastMessage({
            type: "text",
            text: update.content.text,
          });
        }
        break;

      case "agent_thought_chunk":
        if (update.content.type === "text") {
          this.updateLastMessage({
            type: "agent_thought",
            text: update.content.text,
          });
        }
        break;

      case "tool_call": {
        // Try to update existing tool call first
        const updated = this.updateMessage(update.toolCallId, {
          type: "tool_call",
          toolCallId: update.toolCallId,
          title: update.title,
          status: update.status || "pending",
          kind: update.kind,
          content: AcpTypeConverter.toToolCallContent(update.content),
          locations: update.locations ?? undefined,
        });

        // Create new message only if no existing tool call was found
        if (!updated) {
          this.addMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            content: [
              {
                type: "tool_call",
                toolCallId: update.toolCallId,
                title: update.title,
                status: update.status || "pending",
                kind: update.kind,
                content: AcpTypeConverter.toToolCallContent(update.content),
                locations: update.locations ?? undefined,
              },
            ],
            timestamp: new Date(),
          });
        }
        break;
      }

      case "tool_call_update":
        this.logger.log(
          `[AcpAdapter] tool_call_update for ${update.toolCallId}, content:`,
          update.content,
        );
        this.updateMessage(update.toolCallId, {
          type: "tool_call",
          toolCallId: update.toolCallId,
          title: update.title,
          status: update.status || "pending",
          kind: update.kind || undefined,
          content: AcpTypeConverter.toToolCallContent(update.content),
          locations: update.locations ?? undefined,
        });
        break;

      case "plan":
        this.updateLastMessage({
          type: "plan",
          entries: update.entries,
        });
        break;

      case "available_commands_update": {
        this.logger.log(
          `[AcpAdapter] available_commands_update, commands:`,
          update.availableCommands,
        );

        const commands: SlashCommand[] = (update.availableCommands || []).map(
          (cmd) => ({
            name: cmd.name,
            description: cmd.description,
            hint: cmd.input?.hint ?? null,
          }),
        );

        if (this.updateAvailableCommandsCallback) {
          this.updateAvailableCommandsCallback(commands);
        }
        break;
      }
    }
    return Promise.resolve();
  }

  /**
   * Reset the current message ID.
   */
  resetCurrentMessage(): void {
    this.currentMessageId = null;
  }

  /**
   * Handle permission response from user.
   */
  handlePermissionResponse(requestId: string, optionId: string): void {
    const request = this.pendingPermissionRequests.get(requestId);
    if (!request) {
      return;
    }

    const { resolve, toolCallId, options } = request;

    // Reflect the selection in the UI immediately
    this.updateMessage(toolCallId, {
      type: "tool_call",
      toolCallId,
      permissionRequest: {
        requestId,
        options,
        selectedOptionId: optionId,
        isActive: false,
      },
    } as MessageContent);

    resolve({
      outcome: {
        outcome: "selected",
        optionId,
      },
    });
    this.pendingPermissionRequests.delete(requestId);
    this.pendingPermissionQueue = this.pendingPermissionQueue.filter(
      (entry) => entry.requestId !== requestId,
    );
    this.activateNextPermission();
  }

  /**
   * Cancel all ongoing operations.
   */
  cancelAllOperations(): void {
    // Cancel pending permission requests
    this.cancelPendingPermissionRequests();
  }

  private activateNextPermission(): void {
    if (this.pendingPermissionQueue.length === 0) {
      return;
    }

    const next = this.pendingPermissionQueue[0];
    const pending = this.pendingPermissionRequests.get(next.requestId);
    if (!pending) {
      return;
    }

    this.updateMessage(next.toolCallId, {
      type: "tool_call",
      toolCallId: next.toolCallId,
      permissionRequest: {
        requestId: next.requestId,
        options: pending.options,
        isActive: true,
      },
    } as MessageContent);
  }

  /**
   * Request permission from user for an operation.
   */
  async requestPermission(
    params: acp.RequestPermissionRequest,
  ): Promise<acp.RequestPermissionResponse> {
    this.logger.log("[AcpAdapter] Permission request received:", params);

    // If auto-allow is enabled, automatically approve the first allow option
    if (this.autoAllowPermissions) {
      const allowOption =
        params.options.find(
          (option) =>
            option.kind === "allow_once" ||
            option.kind === "allow_always" ||
            (!option.kind && option.name.toLowerCase().includes("allow")),
        ) || params.options[0]; // fallback to first option

      this.logger.log(
        "[AcpAdapter] Auto-allowing permission request:",
        allowOption,
      );

      return Promise.resolve({
        outcome: {
          outcome: "selected",
          optionId: allowOption.optionId,
        },
      });
    }

    // Generate unique ID for this permission request
    const requestId = crypto.randomUUID();
    const toolCallId = params.toolCall?.toolCallId || crypto.randomUUID();

    const normalizedOptions: PermissionOption[] = params.options.map(
      (option) => {
        const normalizedKind =
          option.kind === "reject_always" ? "reject_once" : option.kind;
        const kind: PermissionOption["kind"] = normalizedKind
          ? normalizedKind
          : option.name.toLowerCase().includes("allow")
            ? "allow_once"
            : "reject_once";

        return {
          optionId: option.optionId,
          name: option.name,
          kind,
        };
      },
    );

    const isFirstRequest = this.pendingPermissionQueue.length === 0;

    // Prepare permission request data
    const permissionRequestData = {
      requestId: requestId,
      options: normalizedOptions,
      isActive: isFirstRequest,
    };

    this.pendingPermissionQueue.push({
      requestId,
      toolCallId,
      options: normalizedOptions,
    });

    // Try to update existing tool_call with permission request
    const updated = this.updateMessage(toolCallId, {
      type: "tool_call",
      toolCallId: toolCallId,
      permissionRequest: permissionRequestData,
    } as MessageContent);

    // If no existing tool_call was found, create a new tool_call message with permission
    if (!updated && params.toolCall?.title) {
      const toolCallInfo = params.toolCall;
      const status = toolCallInfo.status || "pending";
      const kind = toolCallInfo.kind as acp.ToolKind | undefined;
      const content = AcpTypeConverter.toToolCallContent(
        toolCallInfo.content as acp.ToolCallContent[] | undefined,
      );

      this.addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: [
          {
            type: "tool_call",
            toolCallId: toolCallInfo.toolCallId,
            title: toolCallInfo.title,
            status,
            kind,
            content,
            permissionRequest: permissionRequestData,
          },
        ],
        timestamp: new Date(),
      });
    }

    // Return a Promise that will be resolved when user clicks a button
    return new Promise((resolve) => {
      this.pendingPermissionRequests.set(requestId, {
        resolve,
        toolCallId,
        options: normalizedOptions,
      });
    });
  }

  /**
   * Cancel all pending permission requests.
   */
  private cancelPendingPermissionRequests(): void {
    this.logger.log(
      `[AcpAdapter] Cancelling ${this.pendingPermissionRequests.size} pending permission requests`,
    );
    this.pendingPermissionRequests.forEach(
      ({ resolve, toolCallId, options }, requestId) => {
        // Update UI to show cancelled state
        this.updateMessage(toolCallId, {
          type: "tool_call",
          toolCallId,
          status: "completed",
          permissionRequest: {
            requestId,
            options,
            isCancelled: true,
            isActive: false,
          },
        } as MessageContent);

        // Resolve the promise with cancelled outcome
        resolve({
          outcome: {
            outcome: "cancelled",
          },
        });
      },
    );
    this.pendingPermissionRequests.clear();
    this.pendingPermissionQueue = [];
  }

  // ========================================================================
  // Terminal Operations (IAcpClient)
  // ========================================================================

  readTextFile(params: acp.ReadTextFileRequest) {
    return Promise.resolve({ content: "" });
  }

  writeTextFile(params: acp.WriteTextFileRequest) {
    return Promise.resolve({});
  }
}

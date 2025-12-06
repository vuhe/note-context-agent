/**
 * Domain Models for Chat Messages
 *
 * These types are independent of the Agent Client Protocol (ACP) library.
 * They represent the core domain concepts of this plugin and remain stable
 * even if the underlying protocol changes. The Adapter layer handles conversion
 * between these domain types and ACP protocol types.
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Message role in a conversation.
 * - assistant: AI agent's messages
 * - user: User's messages
 */
export type Role = "assistant" | "user";

/**
 * Status of a tool call execution.
 */
export type ToolCallStatus = "pending" | "in_progress" | "completed" | "failed";

/**
 * Categories of tool operations.
 */
export type ToolKind =
  | "read" // Reading files or data
  | "edit" // Modifying existing content
  | "delete" // Removing files or data
  | "move" // Moving or renaming
  | "search" // Searching through content
  | "execute" // Running commands or scripts
  | "think" // Agent reasoning/planning
  | "fetch" // Fetching external resources
  | "switch_mode" // Changing operation mode
  | "other"; // Other operations

// ============================================================================
// Tool Call Content Types
// ============================================================================

/**
 * Content that can be included in a tool call result.
 * Currently supports diffs.
 */
export type ToolCallContent =
  | {
      type: "content";
      content: ToolCallMessage;
    }
  | {
      type: "diff";
      path: string;
      newText: string;
      oldText?: string | null; // null or undefined for new files
    };

export type ToolCallMessage =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image";
      data: string; // Base64 encoded image data
      mimeType: string; // e.g., "image/png"
      uri?: string; // Optional source URI
    };

// ============================================================================
// Chat Message
// ============================================================================

/**
 * A single message in the chat history.
 *
 * Messages can contain multiple content blocks of different types
 * (text, images, tool calls, etc.) to represent rich conversations.
 */
export interface ChatMessage {
  id: string;
  role: Role;
  content: MessageContent;
}

/**
 * Different types of content that can appear in a message.
 *
 * This union type represents all possible content blocks:
 * - text: Plain text from user or agent
 * - agent_thought: Agent's internal reasoning (often collapsed in UI)
 * - image: Visual content (base64 encoded)
 * - tool_call: Agent's tool execution with results
 * - plan: Agent's task breakdown
 * - permission_request: Request for user approval
 */
export type MessageContent =
  | {
      type: "text";
      text: string;
    }
  // | {
  //     type: "text_with_context";
  //     text: string;
  //     autoMentionContext?: {
  //       noteName: string;
  //       notePath: string;
  //       selection?: {
  //         fromLine: number;
  //         toLine: number;
  //       };
  //     };
  //   }
  | {
      type: "agent_thought";
      text: string;
    }
  | {
      type: "image";
      data: string; // Base64 encoded image data
      mimeType: string; // e.g., "image/png"
      uri?: string; // Optional source URI
    }
  | {
      type: "tool_call";
      title?: string | null;
      status: ToolCallStatus;
      kind?: ToolKind;
      content?: ToolCallContent;
      locationPath?: string;
    };

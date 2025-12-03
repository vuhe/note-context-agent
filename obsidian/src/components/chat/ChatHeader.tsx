import * as React from "react";
import { HeaderButton } from "./HeaderButton";

/**
 * Props for ChatHeader component
 */
export interface ChatHeaderProps {
  /** Callback to create a new chat session */
  onNewChat: () => void;
  /** Callback to open settings */
  onOpenSettings: () => void;
}

/**
 * Header component for the chat view.
 *
 * Displays:
 * - Agent name
 * - Update notification (if available)
 * - Action buttons (new chat, settings)
 */
export function ChatHeader({ onNewChat, onOpenSettings }: ChatHeaderProps) {
  return (
    <div className="chat-view-header">
      <h3 className="chat-view-header-title">Note ACP</h3>
      <div className="chat-view-header-actions">
        <HeaderButton iconName="plus" tooltip="New chat" onClick={onNewChat} />
        <HeaderButton
          iconName="settings"
          tooltip="Settings"
          onClick={onOpenSettings}
        />
      </div>
    </div>
  );
}

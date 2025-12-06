import * as React from "react";
import { setIcon } from "obsidian";
import { useNoteAgent } from "../../adapters/note-agent";
import { useCallback } from "react";
const { useRef, useEffect } = React;

/**
 * Props for ChatHeader component
 */
export interface ChatHeaderProps {
  /** Callback to create a new chat session */
  onNewChat: () => void;
}

/**
 * Header component for the chat view.
 *
 * Displays:
 * - Agent name
 * - Update notification (if available)
 * - Action buttons (new chat, settings)
 */
export function ChatHeader({ onNewChat }: ChatHeaderProps) {
  const title = useNoteAgent((s) => s.title);

  const onOpenSettings = useCallback(() => {
    return;
  }, []);

  return (
    <div className="chat-view-header">
      <h3 className="chat-view-header-title">{title}</h3>
      <div className="chat-view-header-actions">
        <HeaderButton iconName="plus" tooltip="新聊天" onClick={onNewChat} />
        <HeaderButton iconName="file-clock" tooltip="历史记录" onClick={onOpenSettings} />
      </div>
    </div>
  );
}

interface HeaderButtonProps {
  iconName: string;
  tooltip: string;
  onClick: () => void;
}

export function HeaderButton({ iconName, tooltip, onClick }: HeaderButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (buttonRef.current) {
      setIcon(buttonRef.current, iconName);
    }
  }, [iconName]);

  return <button ref={buttonRef} title={tooltip} onClick={onClick} className="header-button" />;
}

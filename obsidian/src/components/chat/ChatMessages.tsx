import * as React from "react";
const { useRef, useState, useEffect, useCallback } = React;

import type { ChatView } from "./ChatView";
import { MessageRenderer } from "../message/MessageRenderer";
import { useNoteAgent } from "../../adapters/note-agent";

/**
 * Props for ChatMessages component
 */
export interface ChatMessagesProps {
  /** View instance for event registration */
  view: ChatView;
}

/**
 * Messages container component for the chat view.
 *
 * Handles:
 * - Message list rendering
 * - Auto-scroll behavior
 * - Error display
 * - Empty state display
 * - Loading indicator
 */
export function ChatMessages({ view }: ChatMessagesProps) {
  const isSessionReady = useNoteAgent((s) => s.isSessionReady);
  const isSending = useNoteAgent((s) => s.isSending);
  const messages = useNoteAgent((s) => s.messages);
  const error = useNoteAgent((s) => s.error);
  const clearError = useNoteAgent((s) => s.clearError);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Check if the scroll position is near the bottom.
  const checkIfAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;

    const threshold = 50;
    const isNearBottom =
      container.scrollTop + container.clientHeight >= container.scrollHeight - threshold;
    setIsAtBottom(isNearBottom);
    return isNearBottom;
  }, []);

  //Scroll to the bottom of the container.
  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    if (isAtBottom && messages.length > 0) {
      // Use setTimeout to ensure DOM has updated
      window.setTimeout(() => {
        scrollToBottom();
      }, 0);
    }
  }, [messages, isAtBottom, scrollToBottom]);

  // Set up scroll event listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      checkIfAtBottom();
    };

    view.registerDomEvent(container, "scroll", handleScroll);

    // Initial check
    checkIfAtBottom();
  }, [view, checkIfAtBottom]);

  if (!isSessionReady) {
    return (
      <div ref={containerRef} className="chat-view-messages">
        <div className="chat-empty-state">正在新建聊天...</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="chat-view-messages">
      {messages.length === 0 ? (
        <div className="chat-empty-state">发送消息开始对话</div>
      ) : (
        <>
          {messages.map((message) => (
            <MessageRenderer message={message} />
          ))}
        </>
      )}
      {isSending && (
        <div className="loading-indicator">
          <div className="loading-dots">
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
          </div>
        </div>
      )}
      {error && (
        <div className="chat-error-container">
          <h4 className="chat-error-title">{error.title}</h4>
          <p className="chat-error-message">{error.message}</p>
          <button onClick={clearError} className="chat-error-button">
            清除
          </button>
        </div>
      )}
    </div>
  );
}

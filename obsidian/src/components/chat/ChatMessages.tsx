import * as React from "react";
const { useRef, useState, useEffect, useCallback } = React;

import type { ChatMessage } from "../../adapters/chat-message";
import type { ChatView } from "./ChatView";
import { MessageRenderer } from "../message/MessageRenderer";

/**
 * Error information to display
 */
export interface ErrorInfo {
  title: string;
  message: string;
  suggestion?: string;
}

/**
 * Props for ChatMessages component
 */
export interface ChatMessagesProps {
  /** All messages in the current chat session */
  messages: ChatMessage[];
  /** Whether a message is currently being sent */
  isSending: boolean;
  /** Whether the session is ready for user input */
  isSessionReady: boolean;
  /** Error information (if any) */
  errorInfo: ErrorInfo | null;
  /** View instance for event registration */
  view: ChatView;
  /** Callback to clear the error */
  onClearError: () => void;
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
export function ChatMessages({
  messages,
  isSending,
  isSessionReady,
  errorInfo,
  view,
  onClearError,
}: ChatMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  /**
   * Check if the scroll position is near the bottom.
   */
  const checkIfAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;

    const threshold = 50;
    const isNearBottom =
      container.scrollTop + container.clientHeight >= container.scrollHeight - threshold;
    setIsAtBottom(isNearBottom);
    return isNearBottom;
  }, []);

  /**
   * Scroll to the bottom of the container.
   */
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

  return (
    <div ref={containerRef} className="chat-view-messages">
      {errorInfo ? (
        <div className="chat-error-container">
          <h4 className="chat-error-title">{errorInfo.title}</h4>
          <p className="chat-error-message">{errorInfo.message}</p>
          {errorInfo.suggestion && (
            <p className="chat-error-suggestion">💡 {errorInfo.suggestion}</p>
          )}
          <button onClick={onClearError} className="chat-error-button">
            OK
          </button>
        </div>
      ) : messages.length === 0 ? (
        <div className="chat-empty-state">
          {!isSessionReady ? "Connecting to agent..." : "Start a conversation with agent..."}
        </div>
      ) : (
        <>
          {messages.map((message) => (
            <MessageRenderer message={message} />
          ))}
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
        </>
      )}
    </div>
  );
}

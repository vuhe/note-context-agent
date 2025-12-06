import * as React from "react";
const { useRef, useState, useEffect, useCallback } = React;
import { setIcon } from "obsidian";

import type { NoteMetadata } from "../../domain/ports/vault-access.port";
import type { UseMentionsReturn } from "../../hooks/useMentions";
import type { UseAutoMentionReturn } from "../../hooks/useAutoMention";
import { Logger } from "../../shared/logger";
import { useNoteAgent } from "../../adapters/note-agent";

/**
 * Props for ChatInput component
 */
export interface ChatInputProps {
  /** Whether auto-mention setting is enabled */
  autoMentionEnabled: boolean;
  /** Message to restore (e.g., after cancellation) */
  restoredMessage: string | null;
  /** Mentions hook state and methods */
  mentions: UseMentionsReturn;
  /** Auto-mention hook state and methods */
  autoMention: UseAutoMentionReturn;
  /** Callback to send a message */
  onSendMessage: (content: string) => Promise<void>;
  /** Callback to stop the current generation */
  onStopGeneration: () => Promise<void>;
  /** Callback when restored message has been consumed */
  onRestoredMessageConsumed: () => void;
}

/**
 * Input component for the chat view.
 *
 * Handles:
 * - Text input with auto-resize
 * - Mention dropdown (@-mentions)
 * - Slash command dropdown (/-commands)
 * - Auto-mention badge
 * - Hint overlay for slash commands
 * - Send/stop button
 * - Keyboard navigation
 */
export function ChatInput({
  autoMentionEnabled,
  restoredMessage,
  mentions,
  autoMention,
  onSendMessage,
  onStopGeneration,
  onRestoredMessageConsumed,
}: ChatInputProps) {
  const isSessionReady = useNoteAgent((s) => s.isSessionReady);
  const isSending = useNoteAgent((s) => s.isSending);
  const permission = useNoteAgent((s) => s.permission);
  const respPermission = useNoteAgent((s) => s.responsePermission);

  // Local state
  const [inputValue, setInputValue] = useState("");
  const [hintText, setHintText] = useState<string | null>(null);
  const [commandText, setCommandText] = useState<string>("");

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendButtonRef = useRef<HTMLButtonElement>(null);

  /**
   * Common logic for setting cursor position after text replacement.
   */
  const setTextAndFocus = useCallback((newText: string) => {
    setInputValue(newText);

    // Set cursor position to end of text
    window.setTimeout(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        const cursorPos = newText.length;
        textarea.selectionStart = cursorPos;
        textarea.selectionEnd = cursorPos;
        textarea.focus();
      }
    }, 0);
  }, []);

  /**
   * Handle mention selection from dropdown.
   */
  const selectMention = useCallback(
    (suggestion: NoteMetadata) => {
      const newText = mentions.selectSuggestion(inputValue, suggestion);
      setTextAndFocus(newText);
    },
    [mentions, inputValue, setTextAndFocus],
  );

  /**
   * Adjust textarea height based on content.
   */
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Remove previous dynamic height classes
      textarea.classList.remove("textarea-auto-height", "textarea-expanded");

      // Temporarily use auto to measure
      textarea.classList.add("textarea-auto-height");
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 300;
      const hasAutoMention = textarea.classList.contains("has-auto-mention");
      const minHeight = hasAutoMention ? 116 : 80;

      // Check if expansion is needed
      const calculatedHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));

      // Apply expanded class if needed
      if (calculatedHeight > minHeight) {
        textarea.classList.add("textarea-expanded");
        // Set CSS variable for dynamic height
        textarea.style.setProperty("--textarea-height", `${calculatedHeight}px`);
      } else {
        textarea.style.removeProperty("--textarea-height");
      }

      textarea.classList.remove("textarea-auto-height");
    }
  }, []);

  /**
   * Update send button icon color based on state.
   */
  const updateIconColor = useCallback(
    (svg: SVGElement) => {
      // Remove all state classes
      svg.classList.remove("icon-sending", "icon-active", "icon-inactive");

      if (isSending) {
        // Stop button - always active when sending
        svg.classList.add("icon-sending");
      } else {
        // Send button - active when has input
        const hasInput = inputValue.trim() !== "";
        svg.classList.add(hasInput ? "icon-active" : "icon-inactive");
      }
    },
    [isSending, inputValue],
  );

  /**
   * Handle sending or stopping based on current state.
   */
  const handleSendOrStop = useCallback(async () => {
    if (isSending) {
      await onStopGeneration();
      return;
    }

    if (!inputValue.trim()) return;

    // Save input value before clearing
    const messageToSend = inputValue;

    // Clear input and hint state immediately
    setInputValue("");
    setHintText(null);
    setCommandText("");

    await onSendMessage(messageToSend);
  }, [isSending, inputValue, onSendMessage, onStopGeneration]);

  /**
   * Handle dropdown keyboard navigation.
   */
  const handleDropdownKeyPress = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!mentions.isOpen) {
        return false;
      }

      // Arrow navigation
      if (e.key === "ArrowDown") {
        e.preventDefault();
        mentions.navigate("down");
        return true;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        mentions.navigate("up");
        return true;
      }

      // Select item (Enter or Tab)
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const selectedSuggestion = mentions.suggestions[mentions.selectedIndex];
        if (selectedSuggestion) {
          selectMention(selectedSuggestion);
        }
        return true;
      }

      // Close dropdown (Escape)
      if (e.key === "Escape") {
        e.preventDefault();
        mentions.close();
        return true;
      }

      return false;
    },
    [mentions, selectMention],
  );

  /**
   * Handle keyboard events in the textarea.
   */
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      // Handle dropdown navigation first
      if (handleDropdownKeyPress(e)) {
        return;
      }

      // Normal input handling
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        const buttonDisabled = !isSending && (inputValue.trim() === "" || !isSessionReady);
        if (!buttonDisabled && !isSending) {
          void handleSendOrStop();
        }
      }
    },
    [handleDropdownKeyPress, isSending, inputValue, isSessionReady, handleSendOrStop],
  );

  /**
   * Handle input changes in the textarea.
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const cursorPosition = e.target.selectionStart || 0;

      Logger.log("[DEBUG] Input changed:", newValue, "cursor:", cursorPosition);

      setInputValue(newValue);

      // Hide hint overlay when user modifies the input
      if (hintText) {
        const expectedText = commandText + hintText;
        if (newValue !== expectedText) {
          setHintText(null);
          setCommandText("");
        }
      }

      // Update mention suggestions
      void mentions.updateSuggestions(newValue, cursorPosition);
    },
    [hintText, commandText, mentions],
  );

  // Adjust textarea height when input changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue, adjustTextareaHeight]);

  // Update send button icon based on sending state
  useEffect(() => {
    if (sendButtonRef.current) {
      const iconName = isSending ? "square" : "send-horizontal";
      setIcon(sendButtonRef.current, iconName);
      const svg = sendButtonRef.current.querySelector("svg");
      if (svg) {
        updateIconColor(svg);
      }
    }
  }, [isSending, updateIconColor]);

  // Update icon color when input changes
  useEffect(() => {
    if (sendButtonRef.current) {
      const svg = sendButtonRef.current.querySelector("svg");
      if (svg) {
        updateIconColor(svg);
      }
    }
  }, [inputValue, updateIconColor]);

  // Auto-focus textarea on mount
  useEffect(() => {
    window.setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 0);
  }, []);

  // Restore message when provided (e.g., after cancellation)
  useEffect(() => {
    if (restoredMessage) {
      setInputValue(restoredMessage);
      onRestoredMessageConsumed();
      // Focus and place cursor at end
      window.setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.selectionStart = restoredMessage.length;
          textareaRef.current.selectionEnd = restoredMessage.length;
        }
      }, 0);
    }
  }, [restoredMessage, onRestoredMessageConsumed]);

  // Button disabled state
  const isButtonDisabled = !isSending && (inputValue.trim() === "" || !isSessionReady);

  // Placeholder text
  const placeholder = "Message agent - @ to mention notes}";

  return (
    <div className="chat-input-container">
      <div className="chat-input-wrapper">
        {/* Request Permission Badge */}
        {permission && (
          <div className="auto-mention-inline">
            <span className={`mention-badge ${autoMention.isDisabled ? "disabled" : ""}`}>
              权限请求
            </span>
            <div className="message-permission-request-options">
              {permission.options.map((option) => (
                <button
                  key={option.optionId}
                  className={`permission-option ${option.kind ? `permission-kind-${option.kind}` : ""}`}
                  onClick={() => respPermission({ outcome: "selected", optionId: option.optionId })}
                >
                  {option.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Textarea with Hint Overlay */}
        <div className="textarea-wrapper">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            placeholder={placeholder}
            className={`chat-input-textarea ${autoMentionEnabled && autoMention.activeNote ? "has-auto-mention" : ""}`}
            rows={1}
          />
          {hintText && (
            <div className="hint-overlay" aria-hidden="true">
              <span className="invisible">{commandText}</span>
              <span className="hint-text">{hintText}</span>
            </div>
          )}
        </div>

        {/* Send/Stop Button */}
        <button
          ref={sendButtonRef}
          onClick={() => void handleSendOrStop()}
          disabled={isButtonDisabled}
          className={`chat-send-button ${isSending ? "sending" : ""} ${isButtonDisabled ? "disabled" : ""}`}
          title={!isSessionReady ? "Connecting..." : isSending ? "Stop generation" : "Send message"}
        ></button>
      </div>
    </div>
  );
}

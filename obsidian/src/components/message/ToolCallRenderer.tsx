import * as React from "react";
const { useMemo } = React;
import type { MessageContent } from "../../adapters/chat-message";
import { toRelativePath } from "../../shared/path-utils";
import { useNoteAgent } from "../../adapters/note-agent";
import { MarkdownTextRenderer } from "./MarkdownTextRenderer";

interface ToolCallRendererProps {
  content: Extract<MessageContent, { type: "tool_call" }>;
}

export function ToolCallRenderer({ content }: ToolCallRendererProps) {
  const { kind, title, status, locationPath, content: toolContent } = content;

  const plugin = useNoteAgent((s) => s.obsidian);

  // Get vault path for relative path display
  const vaultPath = useMemo(() => {
    const adapter = plugin?.app.vault.adapter as { basePath?: string };
    return adapter.basePath || "";
  }, [plugin]);

  // Get icon based on kind
  const getKindIcon = (kind?: string) => {
    switch (kind) {
      case "read":
        return "📖";
      case "edit":
        return "✏️";
      case "delete":
        return "🗑️";
      case "move":
        return "📦";
      case "search":
        return "🔍";
      case "execute":
        return "💻";
      case "think":
        return "💭";
      case "fetch":
        return "🌐";
      case "switch_mode":
        return "🔄";
      default:
        return "🔧";
    }
  };

  return (
    <div className="message-tool-call">
      {/* Header */}
      <div className="message-tool-call-header">
        <div className="message-tool-call-title">
          <span className="message-tool-call-icon">{getKindIcon(kind)}</span>
          {title}
        </div>
        {locationPath !== undefined && (
          <div className="message-tool-call-locations">
            <span className="message-tool-call-location">
              {toRelativePath(locationPath, vaultPath)}
            </span>
          </div>
        )}
        <div className="message-tool-call-status">Status: {status}</div>
      </div>

      {/* Tool call content (diffs, etc.) */}
      {toolContent && (
        <>
          {toolContent.type === "diff" && <DiffRenderer diff={toolContent} />}
          {toolContent.type === "content" && toolContent.content.type === "text" && (
            <MarkdownTextRenderer text={toolContent.content.text} />
          )}
        </>
      )}
    </div>
  );
}

// Diff renderer component
interface DiffRendererProps {
  diff: {
    type: "diff";
    path: string;
    oldText?: string | null;
    newText: string;
  };
}

function DiffRenderer({ diff }: DiffRendererProps) {
  // Simple line-based diff
  const renderDiff = () => {
    if (diff.oldText === null || diff.oldText === undefined || diff.oldText === "") {
      // New file
      return (
        <div className="tool-call-diff-new-file">
          <div className="diff-line-info">New file</div>
          {diff.newText.split("\n").map((line, idx) => (
            <div key={idx} className="diff-line diff-line-added">
              <span className="diff-line-marker">+</span>
              <span className="diff-line-content">{line}</span>
            </div>
          ))}
        </div>
      );
    }

    const oldLines = diff.oldText.split("\n");
    const newLines = diff.newText.split("\n");

    // Simple comparison: show removed lines then added lines
    const elements: React.ReactElement[] = [];

    // Show removed lines
    oldLines.forEach((line, idx) => {
      elements.push(
        <div key={`old-${idx}`} className="diff-line diff-line-removed">
          <span className="diff-line-marker">-</span>
          <span className="diff-line-content">{line}</span>
        </div>,
      );
    });

    // Show added lines
    newLines.forEach((line, idx) => {
      elements.push(
        <div key={`new-${idx}`} className="diff-line diff-line-added">
          <span className="diff-line-marker">+</span>
          <span className="diff-line-content">{line}</span>
        </div>,
      );
    });

    return elements;
  };

  return (
    <div className="tool-call-diff">
      <div className="tool-call-diff-content">{renderDiff()}</div>
    </div>
  );
}

import * as React from "react";
const { useState } = React;
import { MarkdownTextRenderer } from "./MarkdownTextRenderer";

interface CollapsibleThoughtProps {
  text: string;
}

export function CollapsibleThought({ text }: CollapsibleThoughtProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="collapsible-thought" onClick={() => setIsExpanded(!isExpanded)}>
      <div className="collapsible-thought-header">
        💡Thinking
        <span className="collapsible-thought-icon">{isExpanded ? "▼" : "▶"}</span>
      </div>
      {isExpanded && (
        <div className="collapsible-thought-content">
          <MarkdownTextRenderer text={text} />
        </div>
      )}
    </div>
  );
}

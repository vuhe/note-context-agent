import * as React from "react";
import type { ChatMessage } from "../../adapters/chat-message";
import { TextWithMentions } from "./TextWithMentions";
import { MarkdownTextRenderer } from "./MarkdownTextRenderer";
import { CollapsibleThought } from "./CollapsibleThought";
import { ToolCallRenderer } from "./ToolCallRenderer";

interface MessageRendererProps {
  message: ChatMessage;
}

export const MessageRenderer = React.memo<MessageRendererProps>(({ message }) => {
  const roleCSS = message.role === "user" ? "message-user" : "message-assistant";

  switch (message.content.type) {
    case "text":
      // User messages: render with mention support
      // Assistant messages: render as markdown
      if (message.role === "user") {
        return (
          <div className={`message-renderer ${roleCSS}`}>
            <TextWithMentions text={message.content.text} />
          </div>
        );
      }
      return (
        <div className={`message-renderer ${roleCSS}`}>
          <MarkdownTextRenderer text={message.content.text} />
        </div>
      );

    // case "text_with_context":
    //   // User messages with auto-mention context
    //   return (
    //     <TextWithMentions
    //       text={content.text}
    //       autoMentionContext={content.autoMentionContext}
    //       plugin={plugin}
    //     />
    //   );

    case "agent_thought":
      return (
        <div className={`message-renderer ${roleCSS}`}>
          <CollapsibleThought text={message.content.text} />
        </div>
      );

    case "tool_call":
      return (
        <div className={`message-renderer ${roleCSS}`}>
          <ToolCallRenderer content={message.content} />
        </div>
      );

    default:
      return (
        <div className={`message-renderer ${roleCSS}`}>
          <span>Unsupported content type</span>
        </div>
      );
  }
});

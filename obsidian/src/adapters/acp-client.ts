import * as acp from "@agentclientprotocol/sdk";
import EventEmitter from "eventemitter3";
import { INoteAgent } from "./note-agent";
import { Logger } from "../shared/logger";

export class AcpClient implements acp.Client {
  private readonly uiAgent: INoteAgent;
  private readonly permissionEvent: EventEmitter = new EventEmitter();
  private readonly logger = new Logger();

  constructor(uiAgent: INoteAgent) {
    this.uiAgent = uiAgent;
  }

  responsePermission(params: acp.RequestPermissionResponse) {
    this.permissionEvent.emit("requestPermission", params);
  }

  async requestPermission(params: acp.RequestPermissionRequest) {
    return new Promise<acp.RequestPermissionResponse>((resolve) => {
      this.permissionEvent.once("requestPermission", resolve);
    });
  }

  async sessionUpdate(params: acp.SessionNotification) {
    const update = params.update;
    this.logger.log("[AcpAdapter] sessionUpdate:", update);

    switch (update.sessionUpdate) {
      case "user_message_chunk":
        break;

      case "agent_message_chunk":
        if (update.content.type === "text") {
          // this.updateLastMessage({
          //   type: "text",
          //   text: update.content.text,
          // });
        }
        break;

      case "agent_thought_chunk":
        if (update.content.type === "text") {
          // this.updateLastMessage({
          //   type: "agent_thought",
          //   text: update.content.text,
          // });
        }
        break;

      case "tool_call": {
        // Try to update existing tool call first
        // const updated = this.updateMessage(update.toolCallId, {
        //   type: "tool_call",
        //   toolCallId: update.toolCallId,
        //   title: update.title,
        //   status: update.status || "pending",
        //   kind: update.kind,
        //   content: AcpTypeConverter.toToolCallContent(update.content),
        //   locations: update.locations ?? undefined,
        // });
        //
        // // Create new message only if no existing tool call was found
        // if (!updated) {
        //   this.addMessage({
        //     id: crypto.randomUUID(),
        //     role: "assistant",
        //     content: [
        //       {
        //         type: "tool_call",
        //         toolCallId: update.toolCallId,
        //         title: update.title,
        //         status: update.status || "pending",
        //         kind: update.kind,
        //         content: AcpTypeConverter.toToolCallContent(update.content),
        //         locations: update.locations ?? undefined,
        //       },
        //     ],
        //     timestamp: new Date(),
        //   });
        // }
        break;
      }

      case "tool_call_update":
        this.logger.log(
          `[AcpAdapter] tool_call_update for ${update.toolCallId}, content:`,
          update.content,
        );
        // this.updateMessage(update.toolCallId, {
        //   type: "tool_call",
        //   toolCallId: update.toolCallId,
        //   title: update.title,
        //   status: update.status || "pending",
        //   kind: update.kind || undefined,
        //   content: AcpTypeConverter.toToolCallContent(update.content),
        //   locations: update.locations ?? undefined,
        // });
        break;

      case "plan":
        // this.updateLastMessage({
        //   type: "plan",
        //   entries: update.entries,
        // });
        break;

      case "available_commands_update": {
        this.logger.log(
          `[AcpAdapter] available_commands_update, commands:`,
          update.availableCommands,
        );

        // const commands: SlashCommand[] = (update.availableCommands || []).map(
        //   (cmd) => ({
        //     name: cmd.name,
        //     description: cmd.description,
        //     hint: cmd.input?.hint ?? null,
        //   }),
        // );

        // if (this.updateAvailableCommandsCallback) {
        //   this.updateAvailableCommandsCallback(commands);
        // }
        break;
      }

      case "current_mode_update":
        break;
    }
  }

  async writeTextFile(params: acp.WriteTextFileRequest) {
    return {};
  }

  async readTextFile(params: acp.ReadTextFileRequest) {
    return { content: "" };
  }
}

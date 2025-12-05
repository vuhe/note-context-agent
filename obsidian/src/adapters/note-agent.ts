import * as acp from "@agentclientprotocol/sdk";
import { create } from "zustand";
import { NoteContextAgent } from "note-agent";
import EventEmitter from "eventemitter3";
import { Logger } from "../shared/logger";
import { Platform } from "obsidian";

export interface INoteAgent extends acp.Client {
  isInitialized: boolean;

  // 用于连接后端服务
  backend: acp.Agent | null;
  clientConnection: acp.ClientSideConnection | null;
  agentConnection: acp.AgentSideConnection | null;

  // 权限请求和权限回复通知
  permission: acp.RequestPermissionRequest | null;
  permissionEvent: EventEmitter;

  initialize(): Promise<void>;
  responsePermission(params: acp.RequestPermissionResponse): void;
}

export const useNoteAgent = create<INoteAgent>((set, get) => ({
  isInitialized: false,
  backend: null,
  clientConnection: null,
  agentConnection: null,
  permission: null,
  permissionEvent: new EventEmitter(),

  initialize: async () => {
    if (get().isInitialized) {
      return; // 初始化连接仅在没有连接时进行
    }

    // Client 写入的数据，将进入 clientToAgentWriter 的 WritableStream
    const clientToAgent = new TransformStream<Uint8Array, Uint8Array>();
    const clientWrite = clientToAgent.writable;
    const agentRead = clientToAgent.readable;

    // Agent 写入的数据，将进入 agentToClientWriter 的 WritableStream
    const agentToClient = new TransformStream<Uint8Array, Uint8Array>();
    const agentWrite = agentToClient.writable;
    const clientRead = agentToClient.readable;

    // 在 Client 侧使用 Client 的输入/输出流
    const clientStream = acp.ndJsonStream(clientWrite, clientRead);
    const clientConnection = new acp.ClientSideConnection((agent) => {
      set({ backend: agent });
      return get();
    }, clientStream);
    set({ clientConnection: clientConnection });

    // 在 Agent 侧使用 Agent 的输入/输出流
    const agentStream = acp.ndJsonStream(agentWrite, agentRead);
    const agentConnection = new acp.AgentSideConnection(
      (conn) => new NoteContextAgent(conn, true),
      agentStream,
    );
    set({ agentConnection: agentConnection });

    // 此处为协议要求的流程请求，由于前后端统一，因此不检查 agent 返回值
    await clientConnection.initialize({
      _meta: {
        obsidianMobile: Platform.isMobile
      },
      protocolVersion: acp.PROTOCOL_VERSION,
      clientCapabilities: {
        fs: {
          readTextFile: true,
          writeTextFile: Platform.isDesktop,
        },
      },
      clientInfo: {
        name: "obsidian-plugin",
        title: "Obsidian Plugin",
        version: "1.0.0",
      },
    });

    // 初始化完成，标记为资源准备完毕
    set({ isInitialized: true });
  },

  sessionUpdate: async (params) => {
    const update = params.update;
    Logger.log("[AcpAdapter] sessionUpdate:", update);

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
        Logger.log(
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
        Logger.log(`[AcpAdapter] available_commands_update, commands:`, update.availableCommands);

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
  },

  requestPermission: (params) => {
    set({ permission: params });
    return new Promise<acp.RequestPermissionResponse>((resolve) => {
      get().permissionEvent.once("responsePermission", resolve);
    });
  },

  responsePermission: (params) => {
    set({ permission: null });
    get().permissionEvent.emit("responsePermission", params);
  },

  writeTextFile: async (params) => {
    return {};
  },

  readTextFile: async (params) => {
    return { content: "" };
  },

  extNotification: async (params) => {
    // 用于历史记录拉去的回调，agent会以通知的形式回传历史记录
  },
}));

import * as acp from "@agentclientprotocol/sdk";

export class NoteContextAgent implements acp.Agent {
  private readonly connection: acp.AgentSideConnection;

  constructor(connection: acp.AgentSideConnection, obsidian: boolean) {
    this.connection = connection;
    // TODO: 确定文件系统工具集，node环境和obsidian不一样
  }

  async initialize(params: acp.InitializeRequest): Promise<acp.InitializeResponse> {
    const readable = params.clientCapabilities?.fs?.readTextFile ?? false;
    const writeable = params.clientCapabilities?.fs?.writeTextFile ?? false;
    const obsidianMobile = (params._meta?.obsidianMobile as boolean) ?? false;

    // TODO: 检查客户端支持的工具，如果缺少文件读写的话，将禁用工具
    // TODO: 如果是 obsidianMobile 那么需要禁用写工具

    return {
      protocolVersion: acp.PROTOCOL_VERSION,
      agentCapabilities: {
        loadSession: true,
        promptCapabilities: {
          embeddedContext: true,
          image: true,
        },
      },
      agentInfo: {
        name: "note-context-agent",
        title: "Note Context Agent",
        version: "1.0.0",
      },
    };
  }

  async newSession(params: acp.NewSessionRequest): Promise<acp.NewSessionResponse> {
    throw new Error("Not implemented.");
  }

  async loadSession?(params: acp.LoadSessionRequest): Promise<acp.LoadSessionResponse> {
    throw new Error("Not implemented.");
  }

  async setSessionMode?(params: acp.SetSessionModeRequest) {
    throw new Error("Not implemented.");
  }

  async setSessionModel?(params: acp.SetSessionModelRequest) {
    throw new Error("Not implemented.");
  }

  async authenticate(_: acp.AuthenticateRequest) {
    return {}; // 此工具不需要鉴权
  }

  async prompt(params: acp.PromptRequest): Promise<acp.PromptResponse> {
    // TODO: 这是核心实现，对一个提示词进行回复，期间进行多轮调用
    // TODO: 如果健全出现问题，那么应该返回 refusal
    return { stopReason: "end_turn" };
  }

  async cancel(params: acp.CancelNotification) {
    throw new Error("Not implemented.");
  }

  async extMethod?(method: string, params: Record<string, unknown>) {
    return {};
  }

  async extNotification?(method: string, params: Record<string, unknown>) {
    // TODO: 设置context文件专用方法
  }
}

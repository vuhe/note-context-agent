import * as acp from "@agentclientprotocol/sdk";

export class NoteContextAgent implements acp.Agent {
  private connection: acp.AgentSideConnection;

  constructor(connection: acp.AgentSideConnection, obsidian: boolean) {
    this.connection = connection;
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

  async authenticate(params: acp.AuthenticateRequest) {
    throw new Error("Not implemented.");
  }

  async prompt(params: acp.PromptRequest): Promise<acp.PromptResponse> {
    throw new Error("Not implemented.");
  }

  async cancel(params: acp.CancelNotification) {
    throw new Error("Not implemented.");
  }

  async extMethod?(method: string, params: Record<string, unknown>) {
    return {};
  }
}

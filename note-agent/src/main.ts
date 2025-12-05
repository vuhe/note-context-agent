import * as acp from "@agentclientprotocol/sdk";

export class NoteContextAgent implements acp.Agent {
  async initialize(params: acp.InitializeRequest): Promise<acp.InitializeResponse> {
    throw new Error("Not implemented.");
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

  async extMethod?(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    throw new Error("Not implemented.");
  }
}

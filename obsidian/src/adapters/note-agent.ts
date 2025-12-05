import * as acp from "@agentclientprotocol/sdk";
import { create } from "zustand";
import { AcpClient } from "./acp-client";
import { NoteContextAgent } from "note-agent";

export interface INoteAgent {
  /** 用于连接后端服务的 Client */
  client: AcpClient | null;

  agent: NoteContextAgent | null;

  /** 非 null 时显示权限请求 */
  requestPermission: acp.RequestPermissionRequest | null;

  /** 回复权限选择 */
  responsePermission(params: acp.RequestPermissionResponse): void;
}

export const useNoteAgent = create<INoteAgent>((set, get) => ({
  client: null,
  agent: null,
  requestPermission: null,
  responsePermission: (params) => {
    const client = get().client;
    client?.responsePermission(params);
  },
}));

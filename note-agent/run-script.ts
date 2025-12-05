#!/usr/bin/env ts-node

import * as acp from "@agentclientprotocol/sdk";
import { Readable, Writable } from "node:stream";
import { NoteContextAgent } from "./src/main.ts";

const input = Writable.toWeb(process.stdout);
const output = Readable.toWeb(process.stdin);
const stream = acp.ndJsonStream(input, output);
new acp.AgentSideConnection((conn) => new NoteContextAgent(conn, false), stream);

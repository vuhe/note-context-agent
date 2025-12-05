import type AgentClientPlugin from "../plugin";

export class Logger {
  private readonly debugMode: boolean = true;

  constructor(plugin: AgentClientPlugin | null = null) {}

  log(...args: unknown[]): void {
    if (this.debugMode) {
      console.debug(...args);
    }
  }

  error(...args: unknown[]): void {
    if (this.debugMode) {
      console.error(...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.debugMode) {
      console.warn(...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.debugMode) {
      console.debug(...args);
    }
  }
}

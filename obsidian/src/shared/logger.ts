import type AgentClientPlugin from "../plugin";

export class Logger {
  constructor(plugin: AgentClientPlugin | null = null) {}

  private static isDebugMode(): boolean {
    return true;
  }

  static log(...args: unknown[]): void {
    if (this.isDebugMode()) {
      console.debug(...args);
    }
  }

  static error(...args: unknown[]): void {
    if (this.isDebugMode()) {
      console.error(...args);
    }
  }

  static warn(...args: unknown[]): void {
    if (this.isDebugMode()) {
      console.warn(...args);
    }
  }

  static info(...args: unknown[]): void {
    if (this.isDebugMode()) {
      console.debug(...args);
    }
  }
}

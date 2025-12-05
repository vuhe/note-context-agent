import type AgentClientPlugin from "../plugin";

export class Logger {
  private static readonly debugMode: boolean = true;

  constructor(plugin: AgentClientPlugin | null = null) {}

  static log(...args: unknown[]): void {
    if (this.debugMode) {
      console.debug(...args);
    }
  }

  static error(...args: unknown[]): void {
    if (this.debugMode) {
      console.error(...args);
    }
  }

  static warn(...args: unknown[]): void {
    if (this.debugMode) {
      console.warn(...args);
    }
  }

  static info(...args: unknown[]): void {
    if (this.debugMode) {
      console.debug(...args);
    }
  }
}

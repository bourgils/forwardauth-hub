import type { Config } from "./config.js";

const levels = { debug: 10, info: 20, warn: 30, error: 40 } as const;

export class Logger {
  constructor(private readonly level: Config["logLevel"]) {}

  debug(message: string, data: Record<string, unknown> = {}): void {
    this.write("debug", message, data);
  }

  info(message: string, data: Record<string, unknown> = {}): void {
    this.write("info", message, data);
  }

  warn(message: string, data: Record<string, unknown> = {}): void {
    this.write("warn", message, data);
  }

  error(message: string, data: Record<string, unknown> = {}): void {
    this.write("error", message, data);
  }

  private write(level: keyof typeof levels, message: string, data: Record<string, unknown>): void {
    if (levels[level] < levels[this.level]) return;
    const line = JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...data });
    if (level === "error" || level === "warn") process.stderr.write(`${line}\n`);
    else process.stdout.write(`${line}\n`);
  }
}

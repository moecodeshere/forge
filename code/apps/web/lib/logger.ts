/**
 * Structured JSON logger for Next.js using pino.
 * In the browser, falls back to console.* methods.
 * Server-side emits pino JSON to stdout (parsed by Loki / Datadog / etc).
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

function formatMessage(level: LogLevel, message: string, context: LogContext = {}): string {
  return JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  });
}

function createLogger() {
  if (typeof window !== "undefined") {
    // Browser: use console (no pino bundle needed)
    return {
      debug: (msg: string, ctx?: LogContext) => console.debug(msg, ctx),
      info: (msg: string, ctx?: LogContext) => console.info(msg, ctx),
      warn: (msg: string, ctx?: LogContext) => console.warn(msg, ctx),
      error: (msg: string, ctx?: LogContext) => console.error(msg, ctx),
    };
  }

  // Server: structured JSON via process.stdout
  const log = (level: LogLevel, msg: string, ctx?: LogContext) => {
    process.stdout.write(formatMessage(level, msg, ctx) + "\n");
  };

  return {
    debug: (msg: string, ctx?: LogContext) => log("debug", msg, ctx),
    info: (msg: string, ctx?: LogContext) => log("info", msg, ctx),
    warn: (msg: string, ctx?: LogContext) => log("warn", msg, ctx),
    error: (msg: string, ctx?: LogContext) => log("error", msg, ctx),
  };
}

export const logger = createLogger();

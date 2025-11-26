/**
 * Centralized Logger Utility for Hustle Bot
 *
 * Provides structured logging with DEBUG, INFO, WARN, ERROR levels.
 * Logs structured data (objects) for improved observability.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('FunctionName', 'Descriptive message', { key: value });
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Environment-based log level (defaults to INFO in production, DEBUG otherwise)
const LOG_LEVEL: LogLevel =
  process.env.LOG_LEVEL === "DEBUG"
    ? LogLevel.DEBUG
    : process.env.LOG_LEVEL === "INFO"
      ? LogLevel.INFO
      : process.env.LOG_LEVEL === "WARN"
        ? LogLevel.WARN
        : process.env.LOG_LEVEL === "ERROR"
          ? LogLevel.ERROR
          : process.env.NODE_ENV === "production"
            ? LogLevel.INFO
            : LogLevel.DEBUG;

// Maximum length for string values to prevent logging sensitive data in full
const MAX_STRING_LENGTH = 200;

/**
 * Truncate long strings to prevent logging sensitive data in full
 */
function truncateString(value: string, maxLength: number = MAX_STRING_LENGTH): string {
  if (value.length <= maxLength) return value;
  return `${value.substring(0, maxLength)}...[truncated, total ${value.length} chars]`;
}

/**
 * Sanitize data for logging - truncates long strings and masks sensitive fields
 */
function sanitizeForLogging(data: unknown, depth: number = 0): unknown {
  if (depth > 5) return "[max depth reached]";

  if (data === null || data === undefined) return data;

  if (typeof data === "string") {
    return truncateString(data);
  }

  if (typeof data === "number" || typeof data === "boolean") {
    return data;
  }

  if (Array.isArray(data)) {
    if (data.length > 20) {
      return `[Array with ${data.length} items, showing first 20: ${JSON.stringify(data.slice(0, 20).map((item) => sanitizeForLogging(item, depth + 1)))}]`;
    }
    return data.map((item) => sanitizeForLogging(item, depth + 1));
  }

  if (typeof data === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // Mask potentially sensitive fields
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("password") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("token") ||
        lowerKey.includes("apikey") ||
        lowerKey.includes("api_key")
      ) {
        sanitized[key] = "[REDACTED]";
      } else if (lowerKey === "body" || lowerKey === "email_body" || lowerKey === "messagebody") {
        // Truncate message bodies more aggressively
        sanitized[key] =
          typeof value === "string" ? truncateString(value, 100) : sanitizeForLogging(value, depth + 1);
      } else {
        sanitized[key] = sanitizeForLogging(value, depth + 1);
      }
    }
    return sanitized;
  }

  return String(data);
}

/**
 * Format log entry for output
 */
function formatLogEntry(
  level: string,
  context: string,
  message: string,
  data?: Record<string, unknown>
): string {
  const timestamp = new Date().toISOString();
  const baseEntry = `[${timestamp}] [${level}] [${context}] ${message}`;

  if (data && Object.keys(data).length > 0) {
    const sanitizedData = sanitizeForLogging(data);
    return `${baseEntry} ${JSON.stringify(sanitizedData)}`;
  }

  return baseEntry;
}

/**
 * Logger class with level-based logging methods
 */
class Logger {
  private minLevel: LogLevel;

  constructor(minLevel: LogLevel = LOG_LEVEL) {
    this.minLevel = minLevel;
  }

  /**
   * Log at DEBUG level - detailed information for debugging
   */
  debug(context: string, message: string, data?: Record<string, unknown>): void {
    if (this.minLevel <= LogLevel.DEBUG) {
      console.debug(formatLogEntry("DEBUG", context, message, data));
    }
  }

  /**
   * Log at INFO level - general operational information
   */
  info(context: string, message: string, data?: Record<string, unknown>): void {
    if (this.minLevel <= LogLevel.INFO) {
      console.info(formatLogEntry("INFO", context, message, data));
    }
  }

  /**
   * Log at WARN level - warning conditions
   */
  warn(context: string, message: string, data?: Record<string, unknown>): void {
    if (this.minLevel <= LogLevel.WARN) {
      console.warn(formatLogEntry("WARN", context, message, data));
    }
  }

  /**
   * Log at ERROR level - error conditions
   */
  error(context: string, message: string, data?: Record<string, unknown>): void {
    if (this.minLevel <= LogLevel.ERROR) {
      // For errors, always include stack trace if available
      const errorData = { ...data };
      if (data?.error instanceof Error) {
        errorData.errorMessage = data.error.message;
        errorData.errorStack = data.error.stack;
      }
      console.error(formatLogEntry("ERROR", context, message, errorData));
    }
  }

  /**
   * Log function entry - use at the start of public functions
   */
  functionEntry(functionName: string, args?: Record<string, unknown>): void {
    this.debug(functionName, "Function entry", args ? { args: sanitizeForLogging(args) } : undefined);
  }

  /**
   * Log function exit - use at the end of public functions
   */
  functionExit(functionName: string, result?: { success: boolean; data?: unknown }): void {
    if (result?.success) {
      this.debug(functionName, "Function exit - success", result.data ? { resultSummary: summarizeResult(result.data) } : undefined);
    } else {
      this.debug(functionName, "Function exit - failure", result?.data ? { resultSummary: summarizeResult(result.data) } : undefined);
    }
  }

  /**
   * Log before a database operation
   */
  dbOperationStart(context: string, operation: string, details?: Record<string, unknown>): void {
    this.debug(context, `DB operation start: ${operation}`, details);
  }

  /**
   * Log after a database operation completes successfully
   */
  dbOperationSuccess(context: string, operation: string, details?: Record<string, unknown>): void {
    this.debug(context, `DB operation success: ${operation}`, details);
  }

  /**
   * Log when a database operation fails
   */
  dbOperationError(context: string, operation: string, error: unknown): void {
    this.error(context, `DB operation failed: ${operation}`, {
      error: error instanceof Error ? error : new Error(String(error)),
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  /**
   * Log when entering a conditional branch
   */
  branchTaken(context: string, branchDescription: string, condition?: unknown): void {
    this.debug(context, `Branch taken: ${branchDescription}`, condition !== undefined ? { condition: sanitizeForLogging(condition) } : undefined);
  }

  /**
   * Log loop iteration info
   */
  loopIteration(context: string, loopDescription: string, details: { current?: number; total?: number; item?: unknown }): void {
    this.debug(context, `Loop: ${loopDescription}`, {
      current: details.current,
      total: details.total,
      itemSummary: details.item ? summarizeResult(details.item) : undefined,
    });
  }

  /**
   * Log loop completion
   */
  loopComplete(context: string, loopDescription: string, details: { totalIterations: number; successCount?: number; errorCount?: number }): void {
    this.debug(context, `Loop complete: ${loopDescription}`, details);
  }
}

/**
 * Summarize a result for logging (get type, count, key fields)
 */
function summarizeResult(data: unknown): Record<string, unknown> {
  if (data === null || data === undefined) {
    return { type: "null" };
  }

  if (Array.isArray(data)) {
    return { type: "array", count: data.length };
  }

  if (typeof data === "object") {
    const keys = Object.keys(data);
    const summary: Record<string, unknown> = { type: "object", keyCount: keys.length };

    // Include id if present
    if ("id" in data) {
      summary.id = (data as Record<string, unknown>).id;
    }

    // Include count or total if present
    if ("count" in data) {
      summary.count = (data as Record<string, unknown>).count;
    }
    if ("total" in data) {
      summary.total = (data as Record<string, unknown>).total;
    }

    return summary;
  }

  return { type: typeof data, value: sanitizeForLogging(data) };
}

// Export singleton instance
export const logger = new Logger();

// Export Logger class for custom instances if needed
export { Logger };

/**
 * Structured Logger for Confera Frontend
 * 
 * Features:
 * - Structured JSON log entries with categories
 * - Buffered flushing to event_logs table
 * - Correlation ID tracking across operations
 * - Auto-capture of unhandled errors
 * - Performance mark tracking
 */

import { supabase } from '@/integrations/supabase/client';
import { detectBrowser } from '@/lib/voiceDiagnostics';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogCategory = 'voice' | 'ai' | 'auth' | 'network' | 'ui' | 'performance' | 'system';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  correlationId?: string;
  sessionId?: string;
  userId?: string;
  meta?: Record<string, any>;
  browser?: string;
  os?: string;
}

// ── Configuration ────────────────────────────────────────────────────────────

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const FLUSH_INTERVAL_MS = 30_000; // Flush every 30 seconds
const MAX_BUFFER_SIZE = 50; // Flush if buffer exceeds this
const IS_DEV = import.meta.env.DEV;

// Per-category minimum levels (in production, suppress debug logs)
const CATEGORY_MIN_LEVELS: Record<LogCategory, LogLevel> = {
  voice: IS_DEV ? 'debug' : 'warn',
  ai: IS_DEV ? 'debug' : 'info',
  auth: IS_DEV ? 'debug' : 'warn',
  network: IS_DEV ? 'debug' : 'warn',
  ui: IS_DEV ? 'debug' : 'error',
  performance: IS_DEV ? 'debug' : 'info',
  system: IS_DEV ? 'debug' : 'info',
};

// ── Logger singleton ─────────────────────────────────────────────────────────

class Logger {
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private correlationId: string = this.generateId();
  private userId: string | null = null;
  private sessionId: string | null = null;
  private browserInfo = detectBrowser();
  private isInitialized = false;

  private generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Initialize the logger with user context.
   * Call once after authentication.
   */
  init(userId?: string, sessionId?: string) {
    if (this.isInitialized) return;
    this.userId = userId || null;
    this.sessionId = sessionId || null;
    this.isInitialized = true;

    // Start periodic flush
    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);

    // Flush on page unload
    window.addEventListener('beforeunload', () => this.flush());

    // Auto-capture unhandled errors
    window.addEventListener('error', (event) => {
      this.error('system', `Unhandled error: ${event.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.error('system', `Unhandled promise rejection: ${event.reason?.message || event.reason}`, {
        stack: event.reason?.stack?.substring(0, 500),
      });
    });
  }

  /**
   * Update context (e.g., when entering an interview session)
   */
  setContext(opts: { userId?: string; sessionId?: string; correlationId?: string }) {
    if (opts.userId) this.userId = opts.userId;
    if (opts.sessionId) this.sessionId = opts.sessionId;
    if (opts.correlationId) this.correlationId = opts.correlationId;
  }

  /**
   * Generate a new correlation ID for a new operation chain
   */
  newCorrelation(): string {
    this.correlationId = this.generateId();
    return this.correlationId;
  }

  // ── Log methods ────────────────────────────────────────────────────────

  debug(category: LogCategory, message: string, meta?: Record<string, any>) {
    this.log('debug', category, message, meta);
  }

  info(category: LogCategory, message: string, meta?: Record<string, any>) {
    this.log('info', category, message, meta);
  }

  warn(category: LogCategory, message: string, meta?: Record<string, any>) {
    this.log('warn', category, message, meta);
  }

  error(category: LogCategory, message: string, meta?: Record<string, any>) {
    this.log('error', category, message, meta);
  }

  // ── Core log implementation ────────────────────────────────────────────

  private log(level: LogLevel, category: LogCategory, message: string, meta?: Record<string, any>) {
    // Check minimum level for this category
    const minLevel = CATEGORY_MIN_LEVELS[category];
    if (LOG_LEVELS[level] < LOG_LEVELS[minLevel]) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      correlationId: this.correlationId,
      sessionId: this.sessionId || undefined,
      userId: this.userId || undefined,
      meta,
      browser: `${this.browserInfo.name}/${this.browserInfo.version}`,
      os: this.browserInfo.os,
    };

    // Always log to console in dev
    if (IS_DEV) {
      const consoleMethod = level === 'error' ? console.error :
                           level === 'warn' ? console.warn :
                           level === 'debug' ? console.debug :
                           console.log;
      consoleMethod(`[${category.toUpperCase()}] ${message}`, meta || '');
    }

    // Buffer for batch flush
    this.buffer.push(entry);

    // Force flush if buffer is too large
    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      this.flush();
    }
  }

  // ── Flush to Supabase ──────────────────────────────────────────────────

  async flush() {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      // Batch insert into event_logs
      const rows = entries.map(entry => ({
        user_id: entry.userId || null,
        name: `log.${entry.category}.${entry.level}`,
        payload: {
          message: entry.message,
          correlationId: entry.correlationId,
          sessionId: entry.sessionId,
          meta: entry.meta,
          browser: entry.browser,
          os: entry.os,
          timestamp: entry.timestamp,
        },
      }));

      // Only flush if we have a valid user ID (event_logs requires it)
      const validRows = rows.filter(r => r.user_id);
      if (validRows.length > 0) {
        await supabase.from('event_logs').insert(validRows);
      }
    } catch (e) {
      // Don't log the logging failure to avoid recursion - just console
      if (IS_DEV) console.error('[Logger] Failed to flush logs:', e);

      // Put entries back for next flush attempt (but cap to avoid memory leak)
      if (this.buffer.length < MAX_BUFFER_SIZE * 2) {
        this.buffer.unshift(...entries);
      }
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────

  destroy() {
    this.flush();
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

// Singleton export
export const logger = new Logger();

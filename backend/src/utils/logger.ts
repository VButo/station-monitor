// Structured logger with optional per-route file outputs
import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, isAbsolute, resolve as resolvePath } from 'node:path'
// Use require here to avoid TS resolution complaints in some environments
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { requestContext } = require('./requestContext') as { requestContext: { getStore: () => { requestId?: string; routeKey?: string } | undefined } }

type LogLevel = 'info' | 'warn' | 'error'
type LogMeta = Record<string, unknown> | undefined

const levelToConsole: Record<LogLevel, (...args: unknown[]) => void> = {
  info: console.log,
  warn: console.warn,
  error: console.error,
}

let FILE_LOGGING_ENABLED: boolean | null = null
let RESOLVED_LOG_DIR: string | null = null
let ANNOUNCED = false

function initLoggingFromEnv(): void {
  // Always recompute from current env so that late dotenv injection is respected
  const enabled = String(process.env.LOG_TO_FILES || 'false').toLowerCase() === 'true'
  const rawLogPath = process.env.LOG_FILE_PATH || process.env.LOG_DIR
  let dir: string
  if (rawLogPath) {
    dir = isAbsolute(rawLogPath) ? rawLogPath : join(__dirname, '../../', rawLogPath)
  } else {
    dir = join(__dirname, '../../', 'logs')
  }
  FILE_LOGGING_ENABLED = enabled
  RESOLVED_LOG_DIR = dir
}

function ensureLogDir() {
  initLoggingFromEnv()
  if (!FILE_LOGGING_ENABLED) return
  try {
    if (RESOLVED_LOG_DIR && !existsSync(RESOLVED_LOG_DIR)) mkdirSync(RESOLVED_LOG_DIR, { recursive: true })
  } catch {
    // ignore directory creation errors, fallback to console-only
  }
}

function safeStringify(meta: LogMeta): string | undefined {
  if (!meta || Object.keys(meta).length === 0) return undefined
  try {
    return JSON.stringify(meta, (_key, value) => {
      if (value instanceof Error) return { message: value.message, stack: value.stack }
      return value
    })
  } catch {
    return '[unserializable-meta]'
  }
}

function getRouteKeyForLog(): string {
  const ctx = requestContext.getStore()
  return (ctx?.routeKey && /^[a-z0-9\-_.]+$/i.test(ctx.routeKey) ? ctx.routeKey : 'app')
}

function writeToFile(line: string, level: LogLevel) {
  initLoggingFromEnv()
  if (!FILE_LOGGING_ENABLED) return
  ensureLogDir()
  const routeKey = getRouteKeyForLog()
  const fileName = `${routeKey}.log`
  const fullPath = join(RESOLVED_LOG_DIR as string, fileName)
  try {
    appendFileSync(fullPath, line + '\n', { encoding: 'utf8' })
  } catch {
    // swallow file write errors to not impact app flow
  }
  // optional: write errors also to a global error file
  if (level === 'error') {
    const errPath = join(RESOLVED_LOG_DIR as string, 'errors.log')
    try { appendFileSync(errPath, line + '\n', { encoding: 'utf8' }) } catch {}
  }
}

export const logger = {
  info: (message: string, meta?: LogMeta) => emit('info', message, meta),
  warn: (message: string, meta?: LogMeta) => emit('warn', message, meta),
  error: (message: string, meta?: LogMeta) => emit('error', message, meta),
}

// Print a one-time startup notice the first time we log, after env is available
function maybeAnnounce() {
  initLoggingFromEnv()
  if (!FILE_LOGGING_ENABLED || ANNOUNCED) return
  try {
    ensureLogDir()
    const resolved = resolvePath(RESOLVED_LOG_DIR as string)
    // eslint-disable-next-line no-console
    console.log(`[logger] File logging enabled. Directory: ${resolved}`)
    ANNOUNCED = true
  } catch {
    // ignore
  }
}

// Trigger announcement on first import (best effort) and again on first log
maybeAnnounce()
function emit(level: LogLevel, message: string, meta?: LogMeta): void {
  maybeAnnounce()
  const ts = new Date().toISOString()
  const ctx = requestContext.getStore()
  const serializedMeta = safeStringify(meta)
  let base = `[${ts}] [${level.toUpperCase()}]`
  if (ctx?.requestId) base += ` [rid:${ctx.requestId}]`
  if (ctx?.routeKey) base += ` [route:${ctx.routeKey}]`
  base += ` ${message}`
  const line = serializedMeta ? `${base} ${serializedMeta}` : base
  levelToConsole[level](line)
  writeToFile(line, level)
}

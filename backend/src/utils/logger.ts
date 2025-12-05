// Lightweight structured logger utility
type LogLevel = 'info' | 'warn' | 'error';
type LogMeta = Record<string, unknown> | undefined;

const levelToConsole: Record<LogLevel, (...args: unknown[]) => void> = {
  info: console.log,
  warn: console.warn,
  error: console.error,
};

function safeStringify(meta: LogMeta): string | undefined {
  if (!meta || Object.keys(meta).length === 0) {
    return undefined;
  }

  try {
    return JSON.stringify(meta, (_key, value) => {
      if (value instanceof Error) {
        return { message: value.message, stack: value.stack };
      }
      return value;
    });
  } catch {
    return '[unserializable-meta]';
  }
}

function emit(level: LogLevel, message: string, meta?: LogMeta): void {
  const serializedMeta = safeStringify(meta);
  levelToConsole[level](`[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}${serializedMeta ? ` ${serializedMeta}` : ''}`);
}

export const logger = {
  info: (message: string, meta?: LogMeta) => emit('info', message, meta),
  warn: (message: string, meta?: LogMeta) => emit('warn', message, meta),
  error: (message: string, meta?: LogMeta) => emit('error', message, meta),
};

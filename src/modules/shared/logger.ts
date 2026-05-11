type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogContext = Record<string, unknown>

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
    }
  }

  return error
}

function write(level: LogLevel, message: string, context: LogContext = {}) {
  const payload = {
    level,
    message,
    at: new Date().toISOString(),
    ...context,
  }

  const line = JSON.stringify(payload)
  if (level === 'error') {
    console.error(line)
    return
  }
  if (level === 'warn') {
    console.warn(line)
    return
  }
  if (level === 'debug') {
    console.debug(line)
    return
  }
  console.info(line)
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== 'production') write('debug', message, context)
  },
  info(message: string, context?: LogContext) {
    write('info', message, context)
  },
  warn(message: string, context?: LogContext) {
    write('warn', message, context)
  },
  error(message: string, error?: unknown, context: LogContext = {}) {
    write('error', message, { ...context, error: serializeError(error) })
  },
}

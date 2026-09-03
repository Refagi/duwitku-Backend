import {
  configure,
  getConsoleSink,
  getJsonLinesFormatter,
  getLogger,
  type Logger as LogTapeLogger,
} from '@logtape/logtape'
import { getPrettyFormatter } from '@logtape/pretty'
import { config } from './config.js'

class Logger {
  private logger: LogTapeLogger
  private isDev = config.env === 'development'
  private configured = false

  constructor() {
    this.logger = getLogger(['app'])
  }

  async init() {
    if (this.configured) return

    await configure({
      sinks: {
        console: getConsoleSink({
          formatter: this.isDev
            ? getPrettyFormatter({ colors: true, timestamp: 'time' })
            : getJsonLinesFormatter(),
        }),
      },
      loggers: [
        {
          category: ['app'],
          lowestLevel: this.isDev ? 'debug' : 'info',
          sinks: ['console'],
        },

        {
          category: ['logtape', 'meta'],
          lowestLevel: 'warning',
          sinks: ['console'],
        },
      ],
    })

    this.configured = true
  }

  debug(message: string, meta?: Record<string, any>) {
    this.logger.debug(message, meta ?? {})
  }

  info(message: string, meta?: Record<string, any>) {
    this.logger.info(message, meta ?? {})
  }

  warn(message: string, meta?: Record<string, any>) {
    this.logger.warn(message, meta ?? {})
  }

  error(messageOrError: string | Error, meta?: Record<string, any>) {
    if (messageOrError instanceof Error) {
      this.logger.error(messageOrError, meta ?? {})
    } else {
      this.logger.error(messageOrError, meta ?? {})
    }
  }

  getInstance() {
    return this.logger
  }
}

export const logger = new Logger()

/**
 * Simple, performant logger utility
 * Can be extended with more sophisticated logging later
 */
class Logger {
  constructor(context = 'App') {
    this.context = context;
  }

  _formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] [${this.context}] ${message}${dataStr}`;
  }

  info(message, data) {
    console.log(this._formatMessage('INFO', message, data));
  }

  warn(message, data) {
    console.warn(this._formatMessage('WARN', message, data));
  }

  error(message, error) {
    const errorData = error ? {
      message: error.message,
      stack: error.stack
    } : null;
    console.error(this._formatMessage('ERROR', message, errorData));
  }

  debug(message, data) {
    if (process.env.DEBUG) {
      console.debug(this._formatMessage('DEBUG', message, data));
    }
  }
}

export default Logger;

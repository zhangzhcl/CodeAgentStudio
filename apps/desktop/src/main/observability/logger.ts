export type LogLevel = 'info' | 'warn' | 'error';
export type LogRecord = { level: LogLevel; event: string; data?: Record<string, unknown>; at: string };
const SECRET = /(token|api[_-]?key|password|secret|authorization)/i;
export function redact(data: Record<string, unknown> = {}) { return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, SECRET.test(key) ? '[REDACTED]' : value])); }
export class Logger {
  constructor(private readonly sink: (record: LogRecord) => void = (record) => console.log(JSON.stringify(record))) {}
  write(level: LogLevel, event: string, data?: Record<string, unknown>) { this.sink({ level, event, data: redact(data), at: new Date().toISOString() }); }
  info(event: string, data?: Record<string, unknown>) { this.write('info', event, data); }
  warn(event: string, data?: Record<string, unknown>) { this.write('warn', event, data); }
  error(event: string, data?: Record<string, unknown>) { this.write('error', event, data); }
}

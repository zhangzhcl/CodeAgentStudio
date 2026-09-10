import { describe, expect, it } from 'vitest';
import { Logger } from './logger.js';
describe('Logger', () => { it('redacts credentials', () => { const records: unknown[] = []; new Logger((record) => records.push(record)).info('auth', { apiKey: 'secret', provider: 'pi' }); expect((records[0] as { data: { apiKey: string } }).data.apiKey).toBe('[REDACTED]'); }); });

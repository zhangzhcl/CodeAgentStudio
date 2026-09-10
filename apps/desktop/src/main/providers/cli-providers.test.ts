import { describe, expect, it } from 'vitest';
import { CLI_CONFIGS } from './cli-providers.js';
describe('CLI configs', () => { it('uses non-interactive commands', () => { expect(CLI_CONFIGS.find((item) => item.id === 'claude')?.promptArgs('x')).toEqual(['-p', 'x']); expect(CLI_CONFIGS.find((item) => item.id === 'codex')?.promptArgs('x')).toEqual(['exec', 'x']); expect(CLI_CONFIGS.find((item) => item.id === 'opencode')?.promptArgs('x')).toEqual(['run', 'x']); expect(CLI_CONFIGS.find((item) => item.id === 'cursor')?.command).toBe('agent'); }); });

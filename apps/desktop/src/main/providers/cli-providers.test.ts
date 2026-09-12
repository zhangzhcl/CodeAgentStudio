import { describe, expect, it } from 'vitest';
import { CLI_CONFIGS } from './cli-providers.js';
describe('CLI configs', () => {
  it('uses each CLI non-interactive streaming protocol', () => {
    expect(CLI_CONFIGS.find((item) => item.id === 'claude')?.promptArgs()).toEqual(['-p', '--output-format', 'stream-json', '--include-partial-messages', '--verbose']);
    expect(CLI_CONFIGS.find((item) => item.id === 'cursor')?.promptArgs()).toContain('--stream-partial-output');
    expect(CLI_CONFIGS.find((item) => item.id === 'codex')?.promptArgs()).toEqual(['exec', '--json']);
    expect(CLI_CONFIGS.find((item) => item.id === 'opencode')?.promptArgs()).toEqual(['run', '--format', 'json', '--model', 'sensenova/sensenova-6.8-flash-lite']);
  });
  it('wraps PowerShell entrypoints explicitly on Windows', () => {
    const cursor = CLI_CONFIGS.find((item) => item.id === 'cursor');
    if (process.platform === 'win32') {
      expect(cursor?.command).toBe('powershell.exe');
      expect(cursor?.commandArgs?.[0]).toBe('-NoProfile');
      expect(cursor?.commandArgs).toContain('-File');
    }
  });
  it('resolves Windows npm shims to executable entries', () => {
    if (process.platform === 'win32' && !process.env.CODEAGENT_CODEX_COMMAND)
      expect(CLI_CONFIGS.find((item) => item.id === 'codex')?.command.toLowerCase()).toMatch(/codex\.(cmd|exe)$/);
  });
});
describe('CLI model forwarding', () => {
  it('adds the selected model using each CLI native flag', () => {
    expect(CLI_CONFIGS.find((item) => item.id === 'claude')?.promptArgs('sonnet')).toContain('--model');
    expect(CLI_CONFIGS.find((item) => item.id === 'claude')?.promptArgs('sonnet')).toContain('sonnet');
    expect(CLI_CONFIGS.find((item) => item.id === 'cursor')?.promptArgs('gpt-5')).toContain('gpt-5');
    expect(CLI_CONFIGS.find((item) => item.id === 'codex')?.promptArgs('gpt-5-codex')).toEqual(['exec', '--json', '-m', 'gpt-5-codex']);
    expect(CLI_CONFIGS.find((item) => item.id === 'opencode')?.promptArgs('deepseek-v4-pro')).toEqual(['run', '--format', 'json', '--model', 'sensenova/deepseek-v4-pro']);
  });

  it('keeps Cursor credentials out of command arguments', () => {
    const args = CLI_CONFIGS.find((item) => item.id === 'cursor')?.promptArgs(undefined, { apiKey: 'secret', baseUrl: 'https://proxy.example' }) ?? [];
    expect(args).not.toContain('secret');
    expect(args).not.toContain('--api-key');
    expect(args).not.toContain('--endpoint');
  });
});

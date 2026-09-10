import { describe, expect, it } from 'vitest';
import { resolveAgentCommand } from './command-resolver.js';

describe('resolveAgentCommand', () => {
  it('wraps a Windows PowerShell script without changing the script path', () => {
    expect(resolveAgentCommand('C:\\Users\\demo\\agent.ps1', { platform: 'win32' })).toEqual({
      command: 'powershell.exe',
      commandArgs: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'C:\\Users\\demo\\agent.ps1'],
      shell: false,
    });
  });

  it('keeps PATH commands portable on Unix', () => {
    expect(resolveAgentCommand('claude', { platform: 'linux' })).toEqual({ command: 'claude', commandArgs: [], shell: false });
  });

  it('uses Windows shell for command shims', () => {
    expect(resolveAgentCommand('codex', { platform: 'win32' })).toEqual({ command: 'codex', commandArgs: [], shell: true });
  });
});

import { extname } from 'node:path';

export type CommandResolution = { command: string; commandArgs: string[]; shell: boolean };
export type CommandResolutionOptions = { platform?: NodeJS.Platform };

/**
 * Converts a user/PATH command into a safe spawn tuple. PATH is intentionally
 * left to the operating system; only Windows script/shim semantics differ.
 */
export function resolveAgentCommand(command: string, options: CommandResolutionOptions = {}): CommandResolution {
  const platform = options.platform ?? process.platform;
  const normalized = command.trim();
  if (platform === 'win32' && extname(normalized).toLowerCase() === '.ps1') {
    return { command: 'powershell.exe', commandArgs: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', normalized], shell: false };
  }
  return { command: normalized, commandArgs: [], shell: platform === 'win32' };
}

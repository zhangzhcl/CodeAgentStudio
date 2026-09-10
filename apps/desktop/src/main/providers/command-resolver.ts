import { extname, posix, win32 } from 'node:path';
import { execFileSync } from 'node:child_process';

export type CommandResolution = { command: string; commandArgs: string[]; shell: boolean };
export type CommandResolutionOptions = { platform?: NodeJS.Platform };
export type BinaryPathOptions = { platform?: NodeJS.Platform; home?: string };
export type CommandLookupOptions = { platform?: NodeJS.Platform; lookup?: (command: string) => string | undefined };

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

export function withUserBinaryPaths(env: NodeJS.ProcessEnv, options: BinaryPathOptions = {}): NodeJS.ProcessEnv {
  const platform = options.platform ?? process.platform;
  const home = options.home ?? process.env.USERPROFILE ?? process.env.HOME ?? '';
  const delimiter = platform === 'win32' ? ';' : ':';
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
  const current = env[pathKey] ?? '';
  const join = platform === 'win32' ? win32.join : posix.join;
  const candidates = platform === 'win32'
    ? [env.APPDATA ? join(env.APPDATA, 'npm') : '', join(home, 'AppData', 'Roaming', 'npm'), join(home, '.npm-global', 'bin')]
    : [join(home, '.npm-global', 'bin'), join(home, '.local', 'bin')];
  const entries = current.split(delimiter).filter(Boolean);
  const seen = new Set<string>();
  const ordered = [...candidates, ...entries].filter((entry) => {
    if (!entry) return false;
    const key = platform === 'win32' ? entry.toLowerCase() : entry;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { ...env, [pathKey]: ordered.join(delimiter) };
}

export function findAgentCommand(candidates: string[], options: CommandLookupOptions = {}): string {
  const platform = options.platform ?? process.platform;
  const lookup = options.lookup ?? ((candidate: string) => {
    try {
      const tool = platform === 'win32' ? 'where.exe' : 'which';
      return execFileSync(tool, [candidate], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim() || undefined;
    } catch {
      return undefined;
    }
  });
  return candidates.find((candidate) => Boolean(lookup(candidate))) ?? candidates[0]!;
}

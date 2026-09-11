import { homedir } from 'node:os';
import { join } from 'node:path';

/** Single source of truth for Pi session storage used by creation and discovery. */
export function resolvePiSessionsDir(env: NodeJS.ProcessEnv = process.env): string {
  const piHome = env.CODEAGENT_PI_HOME || join(homedir(), '.pi', 'agent');
  return env.CODEAGENT_PI_SESSION_DIR || join(piHome, 'sessions');
}

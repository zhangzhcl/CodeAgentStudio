import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ProviderId } from '@codeagent-studio/protocol';

/** Stable, private cwd for personal sessions; never fall back to app source. */
export function personalAgentWorkspace(provider: ProviderId, sessionId?: string): string {
  return join(
    process.env.CODEAGENT_PERSONAL_HOME ?? join(homedir(), '.codeagent-studio'),
    'agents',
    provider,
    ...(sessionId ? [sessionId] : []),
  );
}

export async function ensureAgentWorkspace(provider: ProviderId, projectRoot?: string, sessionId?: string): Promise<string> {
  const root = projectRoot ?? personalAgentWorkspace(provider, sessionId);
  if (!projectRoot) await mkdir(root, { recursive: true });
  return root;
}

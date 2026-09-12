import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AgentProviderId } from './contracts.js';

type PathContext = { home?: string; env?: NodeJS.ProcessEnv };
export function providerConfigCandidates(provider: AgentProviderId, context: PathContext = {}): string[] {
  const home = context.home ?? homedir();
  const env = context.env ?? process.env;
  switch (provider) {
    case 'claude': return [join(home, '.claude', 'settings.json')];
    case 'cursor': return [join(env.CURSOR_CONFIG_DIR ?? join(home, '.cursor'), 'cli-config.json')];
    case 'codex': return [join(env.CODEX_HOME ?? join(home, '.codex'), 'config.toml')];
    case 'pi': return [join(env.PI_CODING_AGENT_DIR ?? join(home, '.pi', 'agent'), 'models.json'), join(env.PI_CODING_AGENT_DIR ?? join(home, '.pi', 'agent'), 'settings.json')];
    case 'opencode': return [join(env.XDG_CONFIG_HOME ?? join(home, '.config'), 'opencode', 'opencode.jsonc'), join(env.XDG_CONFIG_HOME ?? join(home, '.config'), 'opencode', 'opencode.json')];
  }
}

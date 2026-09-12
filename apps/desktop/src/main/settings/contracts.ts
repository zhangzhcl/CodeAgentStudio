export type AgentProviderId = 'claude' | 'cursor' | 'codex' | 'pi' | 'opencode';

export interface ProviderCapabilities {
  model: boolean;
  baseUrl: boolean;
  apiKey: boolean;
  nativeWrite: boolean;
}

export interface CredentialState {
  present: boolean;
  source?: 'native' | 'app' | 'environment';
}

export interface AgentConfigSnapshot {
  provider: AgentProviderId;
  model?: string;
  baseUrl?: string;
  credential: CredentialState;
  sourcePath: string;
  error?: string;
}

export const providerCapabilities: Record<AgentProviderId, ProviderCapabilities> = {
  claude: { model: true, baseUrl: true, apiKey: true, nativeWrite: true },
  cursor: { model: true, baseUrl: true, apiKey: true, nativeWrite: false },
  codex: { model: true, baseUrl: true, apiKey: true, nativeWrite: false },
  pi: { model: true, baseUrl: true, apiKey: true, nativeWrite: false },
  opencode: { model: true, baseUrl: true, apiKey: true, nativeWrite: false },
};

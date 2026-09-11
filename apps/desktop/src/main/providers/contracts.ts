import type { AgentEvent, ProviderId, SessionScope } from '@codeagent-studio/protocol';

export type ProviderCapabilities = {
  maxConcurrentSessions: number;
  supportsResume: boolean;
  supportsAttachments: boolean;
  supportsImages: boolean;
  supportsThinking: boolean;
  supportsWebSearch: boolean;
  supportsProjectScope: boolean;
  supportsAbort: boolean;
};
export type PromptOptions = { thinking?: boolean; webSearch?: boolean; attachments?: Array<{ name: string; relativePath: string; mimeType: string; size: number }> };

export type ProviderStatus = {
  provider: ProviderId;
  command?: string;
  installed: boolean;
  authenticated: boolean;
  version?: string;
  errorCode?: 'auth' | 'not_installed' | 'unsupported' | 'unknown';
};

export type CreateSessionInput = {
  scope: SessionScope;
  sessionId?: string;
  projectId?: string;
  projectRoot?: string;
};

export type AgentProvider = {
  readonly id: ProviderId;
  readonly capabilities: ProviderCapabilities;
  detect(): Promise<ProviderStatus>;
  createSession(input: CreateSessionInput): Promise<{ nativeId?: string; nativeSessionFile?: string }>;
  resumeSession(nativeId: string, nativeSessionFile?: string, appSessionId?: string): Promise<void>;
  prompt(sessionId: string, text: string, model?: string, options?: PromptOptions): Promise<void>;
  abort(sessionId: string): Promise<boolean>;
  subscribe(listener: (event: AgentEvent) => void): () => void;
};

import { describe, expect, it } from 'vitest';
import { PromptInputSchema } from './providers/agent-ipc.js';
import { CreateSessionSchema } from './sessions/session-ipc.js';

describe('IPC runtime schemas', () => {
  it('requires project identity for project sessions and prompts', () => {
    expect(() => CreateSessionSchema.parse({ provider: 'claude', scope: 'project' })).toThrow();
    expect(() => PromptInputSchema.parse({ sessionId: 's', provider: 'claude', scope: 'project', text: 'hello' })).toThrow();
    expect(CreateSessionSchema.parse({ provider: 'claude', scope: 'project', projectId: 'p' })).toMatchObject({ projectId: 'p' });
  });

  it('rejects project fields on personal prompts and unknown providers', () => {
    expect(() => PromptInputSchema.parse({ sessionId: 's', provider: 'unknown', scope: 'personal', text: 'hello' })).toThrow();
    expect(() => PromptInputSchema.parse({ sessionId: 's', provider: 'claude', scope: 'personal', projectId: 'p', text: 'hello' })).toThrow();
  });

  it('accepts the renderer new-session payload that carries a client-generated id', () => {
    expect(CreateSessionSchema.parse({ id: 'personal-abc', provider: 'claude', scope: 'personal' })).toMatchObject({ id: 'personal-abc', provider: 'claude', scope: 'personal' });
  });

  it('accepts repeat prompts used by retry and regenerate flows', () => {
    expect(PromptInputSchema.parse({ sessionId: 's', provider: 'claude', scope: 'personal', text: 'hello', repeat: true })).toMatchObject({ repeat: true });
  });
});

import { describe, expect, it } from 'vitest';
import { PromptInputSchema, assertPromptOptionsSupported } from './providers/agent-ipc.js';
import { CreateSessionSchema } from './sessions/session-ipc.js';
import { FakeProvider } from './providers/fake-provider.js';
import { SessionService } from './sessions/session-service.js';

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

  it('rejects prompt session ids with path characters', () => {
    expect(() => PromptInputSchema.parse({ sessionId: '../../evil', provider: 'claude', scope: 'personal', text: 'hello' })).toThrow();
    expect(() => PromptInputSchema.parse({ sessionId: 'a/b', provider: 'claude', scope: 'personal', text: 'hello' })).toThrow();
    expect(PromptInputSchema.parse({ sessionId: 'personal-abc_def-123', provider: 'claude', scope: 'personal', text: 'hello' })).toMatchObject({ sessionId: 'personal-abc_def-123' });
  });

  it('gates unsupported prompt options before any file staging', () => {
    const fake = new FakeProvider('codex', new SessionService());
    expect(() => assertPromptOptionsSupported(fake, { attachments: [{ sourcePath: 'C:/tmp/a.txt' }] })).toThrow('不支持附件');
    expect(() => assertPromptOptionsSupported(fake, { thinking: true })).toThrow('不支持深度思考');
    expect(() => assertPromptOptionsSupported(fake, { webSearch: true })).toThrow('不支持联网');
    // codex 形状：支持文本附件但不支持图片
    type GateTarget = Parameters<typeof assertPromptOptionsSupported>[0];
    const codexLike = { id: 'codex', capabilities: { ...fake.capabilities, supportsAttachments: true, supportsImages: false } } as GateTarget;
    expect(() => assertPromptOptionsSupported(codexLike, { attachments: [{ sourcePath: 'C:/tmp/shot.png' }] })).toThrow('不支持图片附件');
    expect(assertPromptOptionsSupported(codexLike, { attachments: [{ sourcePath: 'C:/tmp/a.txt' }] })).toBeUndefined();
  });
});

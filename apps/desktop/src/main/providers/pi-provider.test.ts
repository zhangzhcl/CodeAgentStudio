import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PiProvider, type PiTransport } from './pi-provider.js';
describe('PiProvider', () => {
  it('creates sessions in its controlled directory and resumes only there', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cas-pi-')); const transport: PiTransport = { createSession: vi.fn(async () => ({ nativeId: 'n1' })), resumeSession: vi.fn(async () => {}), prompt: vi.fn(async () => {}), abort: vi.fn(async () => true), subscribe: () => () => {}, detect: vi.fn(async () => ({ provider: 'pi', installed: true, authenticated: true })) }; const provider = new PiProvider(transport, join(root, 'sessions')); const created = await provider.createSession({ scope: 'project', projectId: 'p' }); expect(created.nativeSessionFile).toContain('sessions'); await provider.resumeSession('n1', created.nativeSessionFile); await expect(provider.resumeSession('n1', join(root, 'outside.jsonl'))).rejects.toThrow('outside'); await rm(root, { recursive: true, force: true });
  });
});

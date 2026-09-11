import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PiProvider, type PiTransport } from './pi-provider.js';
import { buildPiPromptArgs } from './pi-cli-transport.js';
describe('PiProvider', () => {
  it('uses the exact native session file for the next prompt after restoring', () => {
    expect(buildPiPromptArgs('sensenova', 'sensenova-6.8-flash-lite', 'session.jsonl', 'next', true)).toContain('--session');
    expect(buildPiPromptArgs('sensenova', 'sensenova-6.8-flash-lite', 'session.jsonl', 'next', false)).toContain('--session');
  });
  it('creates sessions in its controlled directory and resumes only there', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cas-pi-')); const transport: PiTransport = { createSession: vi.fn(async () => ({ nativeId: 'n1' })), resumeSession: vi.fn(async () => {}), prompt: vi.fn(async () => {}), abort: vi.fn(async () => true), subscribe: () => () => {}, detect: vi.fn(async () => ({ provider: 'pi' as const, installed: true, authenticated: true })) }; const provider = new PiProvider(transport, join(root, 'sessions')); const created = await provider.createSession({ scope: 'project', projectId: 'p' }); expect(created.nativeSessionFile).toContain('sessions'); await writeFile(created.nativeSessionFile!, '{}'); await provider.resumeSession('n1', created.nativeSessionFile); const outside = join(root, 'outside.jsonl'); await writeFile(outside, '{}'); await expect(provider.resumeSession('n1', outside)).rejects.toThrow('outside'); await rm(root, { recursive: true, force: true });
  });
});

import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertNativeWriteAllowed, writeClaudeSettings } from './native-config-writer.js';

describe('native config write policy', () => {
  it('allows Claude and rejects Codex', () => {
    expect(() => assertNativeWriteAllowed('claude')).not.toThrow();
    expect(() => assertNativeWriteAllowed('codex')).toThrowError('read_only_provider');
  });
});

describe('writeClaudeSettings', () => {
  it('treats missing fields as clearing the native keys', async () => {
    const home = await mkdtemp(join(tmpdir(), 'cas-writer-home-'));
    const settings = join(home, '.claude', 'settings.json');
    await mkdir(dirname(settings), { recursive: true });
    await writeFile(settings, JSON.stringify({ model: 'old-model', keep: true, env: { ANTHROPIC_BASE_URL: 'https://old', ANTHROPIC_API_KEY: 'sk-test' } }), 'utf8');

    writeClaudeSettings({ model: 'new-model' }, { home });

    expect(JSON.parse(await readFile(settings, 'utf8'))).toEqual({ model: 'new-model', keep: true, env: { ANTHROPIC_API_KEY: 'sk-test' } });
    await rm(home, { recursive: true, force: true });
  });

  it('keeps only the latest backups', async () => {
    const home = await mkdtemp(join(tmpdir(), 'cas-writer-home-'));
    for (let index = 0; index < 8; index += 1) writeClaudeSettings({ model: `model-${index}` }, { home });

    const backups = (await readdir(join(home, '.claude'))).filter((name) => name.startsWith('settings.json.bak-'));
    expect(backups.length).toBeLessThanOrEqual(5);
    await rm(home, { recursive: true, force: true });
  });
});

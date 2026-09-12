import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const { encryptionAvailable } = vi.hoisted(() => ({ encryptionAvailable: vi.fn(() => true) }));
vi.mock('electron', () => ({ safeStorage: { isEncryptionAvailable: encryptionAvailable, encryptString: (value: string) => Buffer.from(value), decryptString: (value: Buffer) => value.toString() } }));
import { CredentialStore, maskCredential } from './credential-store.js';

describe('credential masking', () => {
  it('never exposes the full key', () => {
    expect(maskCredential('sk-super-secret-key')).toBe('••••••••key');
    expect(maskCredential(undefined)).toBe('');
  });

  it('does not overwrite encrypted credentials when encryption is unavailable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cas-credentials-'));
    const file = join(root, 'agent-credentials.json');
    const original = JSON.stringify({ claude: Buffer.from('existing-key').toString('base64') });
    await writeFile(file, original, 'utf8');
    encryptionAvailable.mockReturnValue(false);

    const store = new CredentialStore(root);
    expect(() => store.set('cursor', 'new-key')).toThrow('Credential encryption is unavailable');
    await expect(readFile(file, 'utf8')).resolves.toBe(original);
    encryptionAvailable.mockReturnValue(true);
  });
});

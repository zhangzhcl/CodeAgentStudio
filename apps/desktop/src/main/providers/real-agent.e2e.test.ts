import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CLI_CONFIGS, CliProvider } from './cli-providers.js';
import { parseCliEvent } from './cli-event-parser.js';
import { PiCliTransport } from './pi-cli-transport.js';
import { PiProvider } from './pi-provider.js';

const enabled = process.env.CODEAGENT_REAL_AGENT_E2E === '1';
const prompt = 'Do not use tools. Reply exactly PING.';

describe.skipIf(!enabled)('real Agent E2E (opt-in)', () => {
  it.each(CLI_CONFIGS)('$id emits a text event', async (config) => {
    const provider = new CliProvider(config);
    const events: Array<ReturnType<typeof parseCliEvent>> = [];
    const unsubscribe = provider.subscribe((event) => events.push(event));
    await provider.createSession({ scope: 'personal', sessionId: 'real-e2e' });
    await provider.prompt('real-e2e', prompt);
    unsubscribe();
    expect(events.some((event) => event?.type === 'text_delta' && event.payload.text.trim())).toBe(true);
  }, 100_000);

  it('pi emits a text event from its JSON transport', async () => {
    const provider = new PiProvider(new PiCliTransport(), join(tmpdir(), `codeagent-pi-e2e-${crypto.randomUUID()}`));
    const events: Array<ReturnType<typeof parseCliEvent>> = [];
    const unsubscribe = provider.subscribe((event) => events.push(event));
    const created = await provider.createSession({ scope: 'personal', sessionId: 'real-pi-e2e' });
    await provider.prompt('real-pi-e2e', 'Do not use tools. Reply exactly FIRST.');
    const firstCount = events.length;
    await provider.resumeSession(created.nativeId!, created.nativeSessionFile, 'real-pi-e2e');
    await provider.prompt('real-pi-e2e', 'Do not use tools. Reply exactly SECOND.');
    unsubscribe();
    expect(events.slice(0, firstCount).some((event) => event?.type === 'text_delta' && event.payload.text.includes('FIRST'))).toBe(true);
    expect(events.slice(firstCount).some((event) => event?.type === 'text_delta' && event.payload.text.includes('SECOND'))).toBe(true);
  }, 100_000);
});

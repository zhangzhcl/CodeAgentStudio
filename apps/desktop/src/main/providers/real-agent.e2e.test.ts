import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CLI_CONFIGS } from './cli-providers.js';
import { parseCliEvent } from './cli-event-parser.js';
import { quoteShellArg, withUserBinaryPaths } from './command-resolver.js';

const enabled = process.env.CODEAGENT_REAL_AGENT_E2E === '1';
const prompt = 'Do not use tools. Reply exactly PING.';

function run(command: string, args: string[], shell: boolean): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, shell ? args.map((arg) => quoteShellArg(arg, process.platform)) : args, { cwd: process.cwd(), shell, windowsHide: true, env: withUserBinaryPaths(process.env), stdio: ['ignore', 'pipe', 'pipe'] });
    const lines: string[] = [];
    let pending = '';
    const consume = (chunk: Buffer) => { pending += chunk.toString(); const parts = pending.split(/\r?\n/); pending = parts.pop() ?? ''; lines.push(...parts.filter(Boolean)); };
    child.stdout?.on('data', consume);
    child.stderr?.on('data', consume);
    const timer = setTimeout(() => { child.kill(); reject(new Error(`${command} timed out`)); }, 90_000);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('close', (code) => { clearTimeout(timer); if (pending.trim()) lines.push(pending); if (code === 0) resolve(lines); else reject(new Error(`${command} exited with ${code}: ${lines.slice(-3).join('\n')}`)); });
  });
}

describe.skipIf(!enabled)('real Agent E2E (opt-in)', () => {
  it.each(CLI_CONFIGS)('$id emits a text event', async (config) => {
    const args = [...(config.commandArgs ?? []), ...config.promptArgs(prompt)];
    const lines = await run(config.command, args, config.shell ?? false);
    const events = lines.map((line, index) => parseCliEvent(line, config.id, 'real-e2e', index)).filter(Boolean);
    expect(events.some((event) => event?.type === 'text_delta' && event.payload.text.trim())).toBe(true);
  }, 100_000);

  it('pi emits a text event from its JSON transport', async () => {
    const session = join(tmpdir(), `codeagent-pi-e2e-${crypto.randomUUID()}.jsonl`);
    try {
      const command = process.env.CODEAGENT_PI_COMMAND ?? 'pi';
      const args = ['--print', '--mode', 'json', '--provider', process.env.CODEAGENT_PI_PROVIDER ?? 'sensenova', '--model', process.env.CODEAGENT_PI_MODEL ?? 'sensenova-6.8-flash-lite', '--no-tools', '--session', session];
      const first = await run(command, [...args, 'Do not use tools. Reply exactly FIRST.'], process.platform === 'win32');
      const resumed = await run(command, [...args, 'Do not use tools. Reply exactly SECOND.'], process.platform === 'win32');
      const firstEvents = first.map((line, index) => parseCliEvent(line, 'pi', 'real-e2e', index)).filter(Boolean);
      const resumedEvents = resumed.map((line, index) => parseCliEvent(line, 'pi', 'real-e2e', index)).filter(Boolean);
      expect(firstEvents.some((event) => event?.type === 'text_delta' && event.payload.text.includes('FIRST'))).toBe(true);
      expect(resumedEvents.some((event) => event?.type === 'text_delta' && event.payload.text.includes('SECOND'))).toBe(true);
    } finally {
      await rm(session, { force: true });
    }
  }, 100_000);
});

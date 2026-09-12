import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { AgentProviderId } from './contracts.js';
import { providerConfigCandidates } from './provider-config-paths.js';

const BACKUP_KEEP = 5;

export function assertNativeWriteAllowed(provider: AgentProviderId) {
  if (provider !== 'claude') throw new Error('read_only_provider');
}

/** 每次写入前备份并只保留最近几份，避免长期使用中 .bak 无限累积。 */
function backupSettings(path: string) {
  if (!existsSync(path)) return;
  copyFileSync(path, `${path}.bak-${Date.now()}`);
  const directory = dirname(path);
  const prefix = `${basename(path)}.bak-`;
  const backups = readdirSync(directory).filter((name) => name.startsWith(prefix)).sort();
  for (const name of backups.slice(0, Math.max(0, backups.length - BACKUP_KEEP))) rmSync(join(directory, name), { force: true });
}

/**
 * 面板总是提交完整字段：有值写入，无值从原生配置中清除对应键。
 * 临时文件加 rename 保证写入原子性，避免半份 settings.json 留在磁盘上。
 */
export function writeClaudeSettings(patch: { model?: string; baseUrl?: string }, context: { home?: string; env?: NodeJS.ProcessEnv } = {}) {
  assertNativeWriteAllowed('claude');
  const path = providerConfigCandidates('claude', context)[0]!;
  const current = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as Record<string, any> : {};
  const next: Record<string, any> = { ...current };
  if (patch.model) next.model = patch.model;
  else delete next.model;
  const env: Record<string, any> = { ...(current.env ?? {}) };
  if (patch.baseUrl) env.ANTHROPIC_BASE_URL = patch.baseUrl;
  else delete env.ANTHROPIC_BASE_URL;
  if (Object.keys(env).length) next.env = env;
  else delete next.env;
  backupSettings(path);
  // 全新环境可能连配置目录都不存在，先建目录再写临时文件
  mkdirSync(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.settings-${process.pid}-${Date.now()}.tmp`);
  writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  renameSync(temporary, path);
  return path;
}

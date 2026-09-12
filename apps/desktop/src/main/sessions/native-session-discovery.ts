import { readdir, readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join, basename, dirname, resolve, relative, isAbsolute } from 'node:path';
import type { ProviderId } from '@codeagent-studio/protocol';
import type { SessionService } from './session-service.js';
import type { WorkspaceService } from '../workspace/workspace-service.js';
import { resolvePiSessionsDir } from '../providers/pi-paths.js';

type DiscoveredMessage = { role: 'user' | 'agent'; content: string; sequence: number };
const textOf = (value: unknown): string => { if (typeof value === 'string') return value; if (!Array.isArray(value)) return ''; return value.map((part) => typeof part === 'string' ? part : (part && typeof part === 'object' && 'text' in part ? String((part as { text?: unknown }).text ?? '') : '')).filter(Boolean).join('\n'); };
const stableId = (provider: ProviderId, nativeId: string) => `${provider}-native-${createHash('sha1').update(`${provider}:${nativeId}`).digest('hex').slice(0, 20)}`;
/**
 * 把原生 transcript 认领回 app 创建的会话，避免被当作新原生会话重复导入。
 * 个人会话按私有工作区目录名精确匹配；项目会话按注册项目（或会话记录的 projectRoot）匹配。
 * 认领守卫：不抢注比会话更早的 transcript（app 之前直接用 CLI 产生的历史），
 * 已关联的会话只允许更新的 transcript 接管，多轮运行时最新一份获胜。
 */
const ownedAppSession = async (
  service: SessionService,
  workspace: WorkspaceService | undefined,
  provider: ProviderId,
  cwd: string | undefined,
  nativeId: string,
  timestamp: number,
) => {
  if (!cwd) return undefined;
  const nativePrefix = `${provider}-native-`;
  // 个人会话：cwd 是 <个人工作区>/agents/<provider>/<sessionId>，目录名即会话 id
  const root = join(process.env.CODEAGENT_PERSONAL_HOME ?? join(homedir(), '.codeagent-studio'), 'agents', provider);
  const inside = relative(resolve(root), resolve(cwd));
  const insidePersonalWorkspace = Boolean(inside) && !inside.startsWith('..') && !isAbsolute(inside) && !inside.includes('\\') && !inside.includes('/');
  if (insidePersonalWorkspace) {
    const personal = service.list().find((session) => session.id === inside && session.provider === provider);
    if (personal && (personal.nativeId === nativeId || !personal.nativeId || (await newerThanLinked(personal, timestamp)))) return personal;
  }
  // 项目会话：app 创建路径只落 projectId（projectRoot 可能为空），因此优先用注册项目
  // 解析 cwd 后按 projectId 匹配，projectRoot 相等作为无 workspace 时的兜底。
  if (!workspace) {
    return service.list().find((session) => session.provider === provider && session.scope === 'project'
      && session.projectRoot && resolve(session.projectRoot) === resolve(cwd) && !session.id.startsWith(nativePrefix)
      && session.createdAt <= timestamp);
  }
  const project = await workspace.findProject(cwd).catch(() => undefined);
  if (!project) return undefined;
  const candidates = service.list().filter((session) => session.provider === provider && session.scope === 'project'
    && !session.id.startsWith(nativePrefix)
    && (session.projectId === project.id || (session.projectRoot && resolve(session.projectRoot) === resolve(cwd))));
  for (const candidate of candidates) {
    if (candidate.nativeId === nativeId) return candidate;
    if (!candidate.nativeId) {
      if (candidate.createdAt <= timestamp) return candidate;
      continue;
    }
    // 已关联的会话只允许更新的 transcript 接管（多轮运行时最新一份获胜）
    if (await newerThanLinked(candidate, timestamp)) return candidate;
  }
  return undefined;
};

/** 会话已关联的 transcript 是否不晚于新出现的这份（允许新 transcript 接管）。 */
async function newerThanLinked(session: { nativeSessionFile?: string }, timestamp: number): Promise<boolean> {
  if (!session.nativeSessionFile) return true;
  const linked = await stat(session.nativeSessionFile).catch(() => undefined);
  return !linked || linked.mtimeMs <= timestamp;
}
async function files(root: string, suffix: string, depth = 0): Promise<string[]> { if (depth > 4) return []; try { const entries = await readdir(root, { withFileTypes: true }); const result: string[] = []; for (const entry of entries) { const path = join(root, entry.name); if (entry.isFile() && entry.name.endsWith(suffix)) result.push(path); else if (entry.isDirectory() && !entry.name.startsWith('.')) result.push(...await files(path, suffix, depth + 1)); if (result.length >= 120) break; } return result; } catch { return []; } }
async function parseJsonl(path: string): Promise<DiscoveredMessage[]> { try { const lines = (await readFile(path, 'utf8')).split(/\r?\n/); const result: DiscoveredMessage[] = []; for (const line of lines) { try { const entry = JSON.parse(line) as Record<string, unknown>; const payload = entry.payload && typeof entry.payload === 'object' ? entry.payload as Record<string, unknown> : undefined; const message = (entry.message && typeof entry.message === 'object' ? entry.message : payload?.type === 'message' ? payload : entry) as Record<string, unknown>; const role = message.role === 'user' ? 'user' : message.role === 'assistant' ? 'agent' : entry.type === 'event_msg' && payload?.type === 'agent_message' ? 'agent' : undefined; const content = textOf(message.content ?? message.text ?? payload?.content ?? payload?.message ?? payload?.text ?? entry.text); if (role && content.trim()) result.push({ role, content: content.trim(), sequence: result.length }); } catch { /* skip partial native rows */ } } return result; } catch { return []; } }
async function nativeCwd(path: string): Promise<string | undefined> { try { for (const line of (await readFile(path, 'utf8')).split(/\r?\n/)) { try { const value = JSON.parse(line) as Record<string, unknown>; const payload = value.payload && typeof value.payload === 'object' ? value.payload as Record<string, unknown> : undefined; const cwd = typeof value.cwd === 'string' ? value.cwd : typeof payload?.cwd === 'string' ? payload.cwd : undefined; if (cwd) return cwd; } catch { /* skip partial native rows */ } } return undefined; } catch { return undefined; } }
function inferredProjectPath(path: string, provider: ProviderId): string | undefined { if (provider !== 'claude') return undefined; const encoded = basename(dirname(path)).replace(/^([A-Za-z])--/, '$1:/'); return encoded.replace(/--/g, '\u0000').replace(/-/g, '\\').replace(/\u0000/g, '-'); }
async function parseCursorHistory(path: string): Promise<DiscoveredMessage[]> { try { const value = JSON.parse(await readFile(path, 'utf8')) as unknown; const items = Array.isArray(value) ? value : []; return items.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((content, sequence) => ({ role: 'user' as const, content: content.trim(), sequence })); } catch { return []; } }
async function cursorMeta(path: string): Promise<{ cwd?: string; title?: string }> { try { return JSON.parse(await readFile(basename(path) === 'meta.json' ? path : join(dirname(path), 'meta.json'), 'utf8')) as { cwd?: string; title?: string }; } catch { return {}; } }
export async function discoverNativeSessions(service: SessionService, workspace?: WorkspaceService): Promise<number> {
  let imported = 0;
  const platformRoots = new Set([resolve(process.cwd()), resolve(homedir())]);
  const projectForCwd = async (cwd: string | undefined) => {
    if (!cwd || !workspace || platformRoots.has(resolve(cwd))) return undefined;
    return workspace.findProject(cwd).catch(() => undefined);
  };
  // A native session without an explicit project id belongs to the Agent's
  // default workspace. Keep it personal across restarts even when its native
  // cwd happens to sit below a previously discovered directory.
  const legacyNativeIds = new Set(service.list().filter((session) => session.nativeId && !session.projectId).map((session) => `${session.provider}:${session.nativeId}`));
  const projectForSession = async (provider: ProviderId, nativeId: string, cwd: string | undefined) => legacyNativeIds.has(`${provider}:${nativeId}`) ? undefined : projectForCwd(cwd);
  const codexHome = process.env.CODEX_HOME || join(homedir(), '.codex');
  const claudeHome = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
  const cursorHome = process.env.CURSOR_HOME || join(homedir(), '.cursor');
  const roots: Array<[ProviderId, string]> = [
    ['claude', join(claudeHome, 'projects')],
    ['claude', join(claudeHome, 'sessions')],
    ['codex', join(codexHome, 'sessions')],
    ['codex', join(codexHome, 'archived_sessions')],
    ['pi', resolvePiSessionsDir()],
  ];
  for (const [provider, root] of roots) for (const path of await files(root, '.jsonl')) { const messages = await parseJsonl(path); if (!messages.length) continue; const timestamp = (await stat(path)).mtimeMs; const nativeId = basename(path, '.jsonl'); const id = stableId(provider, nativeId); const cwd = await nativeCwd(path) ?? inferredProjectPath(path, provider); const appSession = await ownedAppSession(service, workspace, provider, cwd, nativeId, timestamp); if (appSession) { service.updateNative(appSession.id, { nativeId, nativeSessionFile: path }); service.updateTimestamps(appSession.id, timestamp, timestamp); continue; } if (service.ownsNativeId(nativeId)) continue; const project = await projectForSession(provider, nativeId, cwd); const projectFields = project ? { projectId: project.id, projectRoot: project.rootPath, projectName: project.name } : undefined; const existing = service.list().find((session) => session.id === id); if (!existing) { service.create({ id, provider, scope: project ? 'project' : 'personal', ...(projectFields ?? {}), nativeId, nativeSessionFile: path, createdAt: timestamp, updatedAt: timestamp }); for (const message of messages) service.importMessage({ id: `${id}:native:${message.sequence}`, sessionId: id, role: message.role, content: message.content, sequence: message.sequence, createdAt: timestamp + message.sequence }); imported++; } else { if (existing.scope !== (project ? 'project' : 'personal') || (project && existing.projectId !== project.id) || (!project && (existing.projectId || existing.projectRoot || existing.projectName))) service.updateScope(id, project ? 'project' : 'personal', projectFields); service.updateTimestamps(id, timestamp, timestamp); } }
  const cursorFiles = await files(join(cursorHome, 'chats'), 'prompt_history.json');
  const cursorMetaFiles = await files(join(cursorHome, 'chats'), 'meta.json');
  const cursorChats = [...new Set([...cursorFiles, ...cursorMetaFiles].map((path) => dirname(path)))];
  for (const chat of cursorChats) { const history = join(chat, 'prompt_history.json'); const metaPath = join(chat, 'meta.json'); const hasHistory = cursorFiles.includes(history); const messages = hasHistory ? await parseCursorHistory(history) : []; const path = hasHistory ? history : metaPath; const timestamp = (await stat(path)).mtimeMs; const meta = await cursorMeta(metaPath); const nativeId = basename(chat); const id = stableId('cursor', nativeId); const appSession = await ownedAppSession(service, workspace, 'cursor', meta.cwd, nativeId, timestamp); if (appSession) { service.updateNative(appSession.id, { nativeId, nativeSessionFile: path }); service.updateTimestamps(appSession.id, timestamp, timestamp); continue; } if (service.ownsNativeId(nativeId)) continue; const project = await projectForSession('cursor', nativeId, meta.cwd); const projectFields = project ? { projectId: project.id, projectRoot: project.rootPath, projectName: project.name } : undefined; const existing = service.list().find((session) => session.id === id); if (!existing) { service.create({ id, provider: 'cursor', scope: project ? 'project' : 'personal', ...(projectFields ?? {}), nativeId, nativeSessionFile: path, title: meta.title, createdAt: timestamp, updatedAt: timestamp }); for (const message of messages) service.importMessage({ id: `${id}:native:${message.sequence}`, sessionId: id, role: message.role, content: message.content, sequence: message.sequence, createdAt: timestamp + message.sequence }); imported++; } else { if (existing.scope !== (project ? 'project' : 'personal') || (project && existing.projectId !== project.id) || (!project && (existing.projectId || existing.projectRoot || existing.projectName))) service.updateScope(id, project ? 'project' : 'personal', projectFields); service.updateTimestamps(id, timestamp, timestamp); } }
  try {
    const { default: Database } = await import('better-sqlite3');
    const opencodeCandidates = [
      process.env.OPENCODE_DB,
      process.env.XDG_DATA_HOME ? join(process.env.XDG_DATA_HOME, 'opencode', 'opencode.db') : undefined,
      join(homedir(), '.local', 'share', 'opencode', 'opencode.db'),
      join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'opencode', 'opencode.db'),
      join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'opencode', 'opencode.db'),
      join(homedir(), '.config', 'opencode', 'opencode.db'),
    ].filter((value): value is string => Boolean(value));
    let opencodePath = opencodeCandidates[0];
    for (const candidate of opencodeCandidates) { if (await stat(candidate).then((info) => info.isFile()).catch(() => false)) { opencodePath = candidate; break; } }
    if (!opencodePath) throw new Error('OpenCode database not found');
    const db = new Database(opencodePath, { readonly: true, fileMustExist: true });
    const sessions = db.prepare('SELECT id, title, directory, time_created FROM session ORDER BY time_updated DESC LIMIT 120').all() as Array<{ id: string; title?: string; directory?: string; time_created: number }>;
    const parts = db.prepare('SELECT m.session_id as sessionId, m.data as messageData, p.data as partData, p.time_created as createdAt FROM message m JOIN part p ON p.message_id = m.id ORDER BY p.time_created').all() as Array<{ sessionId: string; messageData: string; partData: string; createdAt: number }>;
    for (const item of sessions) { const id = stableId('opencode', item.id); const appSession = await ownedAppSession(service, workspace, 'opencode', item.directory, item.id, item.time_created); if (appSession) { service.updateNative(appSession.id, { nativeId: item.id, nativeSessionFile: undefined }); continue; } if (service.ownsNativeId(item.id)) continue; const project = await projectForSession('opencode', item.id, item.directory); const projectFields = project ? { projectId: project.id, projectRoot: project.rootPath, projectName: project.name } : undefined; const existing = service.list().find((session) => session.id === id); if (existing) { if (existing.scope !== (project ? 'project' : 'personal') || (project && existing.projectId !== project.id) || (!project && (existing.projectId || existing.projectRoot || existing.projectName))) service.updateScope(id, project ? 'project' : 'personal', projectFields); continue; } const rows = parts.filter((part) => part.sessionId === item.id); let sequence = 0; service.create({ id, provider: 'opencode', scope: project ? 'project' : 'personal', ...(projectFields ?? {}), nativeId: item.id }); for (const row of rows) { try { const message = JSON.parse(row.messageData) as { role?: string }; const part = JSON.parse(row.partData) as { type?: string; text?: string }; if ((message.role === 'user' || message.role === 'assistant') && part.type === 'text' && part.text?.trim()) service.importMessage({ id: `${id}:native:${sequence}`, sessionId: id, role: message.role === 'user' ? 'user' : 'agent', content: part.text.trim(), sequence, createdAt: row.createdAt }); sequence++; } catch { /* skip malformed OpenCode rows */ } } if (sequence > 0) imported++; }
    db.close();
  } catch { /* OpenCode is optional and may not have a local database */ }
  for (const [provider, root] of roots) for (const path of await files(root, '.jsonl')) { const firstUser = (await parseJsonl(path)).find((message) => message.role === 'user'); if (firstUser) service.ensureTitle(stableId(provider, basename(path, '.jsonl')), firstUser.content); }
  for (const path of cursorFiles) { const firstUser = (await parseCursorHistory(path))[0]; if (firstUser) service.ensureTitle(stableId('cursor', basename(join(path, '..'))), firstUser.content); }
  // Sessions imported by older builds were incorrectly marked as project
  // sessions without a project id. They are Agent default-workspace sessions,
  // so migrate them to the personal list on the next discovery pass.
  for (const session of service.list()) {
    if (session.nativeId && legacyNativeIds.has(`${session.provider}:${session.nativeId}`)) service.updateScope(session.id, 'personal');
  }
  return imported;
}

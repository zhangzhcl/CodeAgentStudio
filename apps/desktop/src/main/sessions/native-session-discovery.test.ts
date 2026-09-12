import { mkdtemp, mkdir, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverNativeSessions } from './native-session-discovery.js';
import { SessionService } from './session-service.js';
import { WorkspaceService } from '../workspace/workspace-service.js';

const originalEnv = {
  CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
  CODEX_HOME: process.env.CODEX_HOME,
  CURSOR_HOME: process.env.CURSOR_HOME,
  CODEAGENT_PERSONAL_HOME: process.env.CODEAGENT_PERSONAL_HOME,
  CODEAGENT_PI_SESSION_DIR: process.env.CODEAGENT_PI_SESSION_DIR,
};
afterEach(() => {
  // 直接赋值 undefined 会变成字符串 "undefined"，必须删除键才能真正还原
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

/** 把其余 Agent 的家目录指到空目录，避免测试导入本机真实原生会话。 */
const isolateOtherAgents = (home: string, except?: 'codex' | 'cursor') => {
  if (except !== 'codex') process.env.CODEX_HOME = join(home, 'codex-empty');
  if (except !== 'cursor') process.env.CURSOR_HOME = join(home, 'cursor-empty');
  process.env.CODEAGENT_PI_SESSION_DIR = join(home, 'pi-empty');
};

describe('discoverNativeSessions', () => {
  it('uses the native transcript timestamp instead of the discovery time', async () => {
    const home = await mkdtemp(join(tmpdir(), 'cas-native-discovery-'));
    const transcript = join(home, 'projects', 'sample', 'past-session.jsonl');
    await mkdir(join(home, 'projects', 'sample'), { recursive: true });
    await writeFile(transcript, '{"message":{"role":"user","content":"历史消息"}}\n');
    const historicalTime = new Date(Date.now() - 86_400_000);
    await utimes(transcript, historicalTime, historicalTime);
    process.env.CLAUDE_CONFIG_DIR = home;
    isolateOtherAgents(home);

    const sessions = new SessionService();
    await discoverNativeSessions(sessions);

    expect(sessions.list().find((session) => session.nativeSessionFile === transcript)).toMatchObject({ createdAt: historicalTime.getTime(), updatedAt: historicalTime.getTime() });
  });

  it('uses a Claude transcript cwd found after its first row to infer its project', async () => {
    const home = await mkdtemp(join(tmpdir(), 'cas-native-discovery-'));
    const projectRoot = await mkdtemp(join(tmpdir(), 'cas-claude-project-'));
    const transcript = join(home, 'projects', 'D--DevWork-project', 'session.jsonl');
    await mkdir(join(home, 'projects', 'D--DevWork-project'), { recursive: true });
    await writeFile(transcript, [
      '{"type":"system","content":"startup"}',
      JSON.stringify({ type: 'user', cwd: projectRoot, message: { role: 'user', content: 'inspect this project' } }),
    ].join('\n'));
    process.env.CLAUDE_CONFIG_DIR = home;
    isolateOtherAgents(home);
    const workspace = new WorkspaceService();
    const project = await workspace.registerProject(projectRoot);

    const sessions = new SessionService();
    await discoverNativeSessions(sessions, workspace);

    expect(sessions.list().find((session) => session.nativeSessionFile === transcript)).toMatchObject({
      scope: 'project', projectId: project.id, projectRoot, projectName: project.name,
    });
  });

  it('uses the encoded Claude project path when its transcript has no cwd', async () => {
    const home = await mkdtemp(join(tmpdir(), 'cas-native-discovery-'));
    const projectRoot = 'D:\\DevWork\\sample';
    const encodedProject = 'D--DevWork-sample';
    const transcript = join(home, 'projects', encodedProject, 'session.jsonl');
    await mkdir(join(home, 'projects', encodedProject), { recursive: true });
    await writeFile(transcript, '{"message":{"role":"user","content":"infer from the path"}}\n');
    process.env.CLAUDE_CONFIG_DIR = home;
    isolateOtherAgents(home);
    const project = { id: 'project-id', name: 'sample', rootPath: projectRoot, source: 'user' as const };
    const workspace = { findProject: async (cwd: string) => cwd.replace(/\//g, '\\') === projectRoot ? project : undefined } as unknown as WorkspaceService;

    const sessions = new SessionService();
    await discoverNativeSessions(sessions, workspace);

    expect(sessions.list().find((session) => session.nativeSessionFile === transcript)).toMatchObject({
      scope: 'project', projectId: project.id, projectRoot,
    });
  });

  it('discovers a Cursor chat from meta.json when prompt history is absent', async () => {
    const home = await mkdtemp(join(tmpdir(), 'cas-native-discovery-'));
    const chat = join(home, 'chats', 'cursor-chat');
    await mkdir(chat, { recursive: true });
    await writeFile(join(chat, 'meta.json'), JSON.stringify({ title: 'Metadata-only chat' }));
    process.env.CURSOR_HOME = home;
    isolateOtherAgents(home, 'cursor');

    const sessions = new SessionService();
    await discoverNativeSessions(sessions);

    expect(sessions.list().find((session) => session.provider === 'cursor')).toMatchObject({
      nativeId: 'cursor-chat', title: 'Metadata-only chat', nativeSessionFile: join(chat, 'meta.json'),
    });
  });

  it('imports text from modern Codex agent_message events', async () => {
    const home = await mkdtemp(join(tmpdir(), 'cas-native-discovery-'));
    const transcript = join(home, 'sessions', '2026', '09', '12', 'rollout.jsonl');
    await mkdir(join(home, 'sessions', '2026', '09', '12'), { recursive: true });
    await writeFile(transcript, [
      JSON.stringify({ type: 'session_meta', payload: { cwd: home } }),
      JSON.stringify({ type: 'event_msg', payload: { type: 'agent_message', message: 'The implementation is ready.' } }),
    ].join('\n'));
    process.env.CODEX_HOME = home;
    isolateOtherAgents(home, 'codex');

    const sessions = new SessionService();
    await discoverNativeSessions(sessions);
    const session = sessions.list().find((item) => item.provider === 'codex');

    expect(session).toBeDefined();
    expect(sessions.listMessages(session!.id)).toMatchObject([{ role: 'agent', content: 'The implementation is ready.' }]);
  });

  it('associates a native transcript with its app-created personal session', async () => {
    const home = await mkdtemp(join(tmpdir(), 'cas-native-discovery-'));
    const personalHome = await mkdtemp(join(tmpdir(), 'cas-personal-home-'));
    const cwd = join(personalHome, 'agents', 'claude', 'created-in-app');
    const transcript = join(home, 'projects', 'personal', 'native-session.jsonl');
    await mkdir(dirname(transcript), { recursive: true });
    await writeFile(transcript, JSON.stringify({ type: 'user', cwd, message: { role: 'user', content: 'remove me completely' } }));
    process.env.CLAUDE_CONFIG_DIR = home;
    process.env.CODEAGENT_PERSONAL_HOME = personalHome;
    isolateOtherAgents(home);

    const sessions = new SessionService();
    sessions.create({ id: 'created-in-app', provider: 'claude', scope: 'personal' });
    await discoverNativeSessions(sessions);

    expect(sessions.list()).toHaveLength(1);
    expect(sessions.get('created-in-app')).toMatchObject({ nativeId: 'native-session', nativeSessionFile: transcript });
  });

  it('associates a native transcript with its app-created project session', async () => {
    const home = await mkdtemp(join(tmpdir(), 'cas-native-discovery-'));
    const projectRoot = await mkdtemp(join(tmpdir(), 'cas-project-'));
    const transcript = join(home, 'projects', 'project', 'native-session.jsonl');
    await mkdir(dirname(transcript), { recursive: true });
    process.env.CLAUDE_CONFIG_DIR = home;
    isolateOtherAgents(home);

    // 真实时序：先有会话，后由 CLI 运行产生 transcript
    const sessions = new SessionService();
    sessions.create({ id: 'created-project-session', provider: 'claude', scope: 'project', projectId: 'project-1', projectRoot, projectName: 'project' });
    await writeFile(transcript, JSON.stringify({ type: 'user', cwd: projectRoot, message: { role: 'user', content: 'remove project session completely' } }));
    await discoverNativeSessions(sessions);

    expect(sessions.list()).toHaveLength(1);
    expect(sessions.get('created-project-session')).toMatchObject({ nativeId: 'native-session', nativeSessionFile: transcript });
  });

  it('claims a transcript for an app project session that only stores projectId', async () => {
    const home = await mkdtemp(join(tmpdir(), 'cas-native-discovery-'));
    const projectRoot = await mkdtemp(join(tmpdir(), 'cas-project-'));
    const transcript = join(home, 'projects', 'project', 'claimed.jsonl');
    await mkdir(dirname(transcript), { recursive: true });
    process.env.CLAUDE_CONFIG_DIR = home;
    isolateOtherAgents(home);

    // 真实时序：先有会话，后由 CLI 运行产生 transcript
    const workspace = new WorkspaceService();
    const project = await workspace.registerProject(projectRoot);
    const sessions = new SessionService();
    sessions.create({ id: 'project-app-session', provider: 'claude', scope: 'project', projectId: project.id });
    await writeFile(transcript, JSON.stringify({ type: 'user', cwd: projectRoot, message: { role: 'user', content: 'app-created session' } }));
    await discoverNativeSessions(sessions, workspace);

    expect(sessions.list()).toHaveLength(1);
    expect(sessions.get('project-app-session')).toMatchObject({ nativeId: 'claimed', nativeSessionFile: transcript });
  });

  it('does not claim transcripts older than the app session in the same project', async () => {
    const home = await mkdtemp(join(tmpdir(), 'cas-native-discovery-'));
    const projectRoot = await mkdtemp(join(tmpdir(), 'cas-project-'));
    const transcript = join(home, 'projects', 'project', 'history.jsonl');
    await mkdir(dirname(transcript), { recursive: true });
    await writeFile(transcript, JSON.stringify({ type: 'user', cwd: projectRoot, message: { role: 'user', content: 'cli history before app session' } }));
    const yesterday = new Date(Date.now() - 86_400_000);
    await utimes(transcript, yesterday, yesterday);
    process.env.CLAUDE_CONFIG_DIR = home;
    isolateOtherAgents(home);

    const workspace = new WorkspaceService();
    const project = await workspace.registerProject(projectRoot);
    const sessions = new SessionService();
    sessions.create({ id: 'project-app-session', provider: 'claude', scope: 'project', projectId: project.id });
    await discoverNativeSessions(sessions, workspace);

    // 更早的 CLI 历史不被认领，按普通原生会话导入
    expect(sessions.list()).toHaveLength(2);
    expect(sessions.get('project-app-session').nativeId).toBeUndefined();
    expect(sessions.list().some((session) => session.nativeId === 'history')).toBe(true);
  });

  it('skips transcripts recorded as owned by an app session run', async () => {
    const home = await mkdtemp(join(tmpdir(), 'cas-native-discovery-'));
    const projectRoot = await mkdtemp(join(tmpdir(), 'cas-project-'));
    const transcript = join(home, 'projects', 'project', 'owned-run.jsonl');
    await mkdir(dirname(transcript), { recursive: true });
    process.env.CLAUDE_CONFIG_DIR = home;
    isolateOtherAgents(home);

    const workspace = new WorkspaceService();
    await workspace.registerProject(projectRoot);
    const sessions = new SessionService();
    sessions.create({ id: 'project-app-session', provider: 'claude', scope: 'project', projectId: (await workspace.listProjects())[0]!.id });
    // 该轮运行结束时报过 run.completed，归属已登记（哪怕 ownedAppSession 匹配不上也不应导入）
    sessions.recordNativeRun('project-app-session', 'owned-run');
    await writeFile(transcript, JSON.stringify({ type: 'user', cwd: '/somewhere/else', message: { role: 'user', content: 'owned history' } }));
    await discoverNativeSessions(sessions, workspace);

    expect(sessions.list()).toHaveLength(1);
    expect(sessions.list().some((session) => session.nativeId === 'owned-run')).toBe(false);
  });

  it('keeps an unregistered native cwd in personal sessions', async () => {
    const home = await mkdtemp(join(tmpdir(), 'cas-native-discovery-'));
    const unregisteredRoot = await mkdtemp(join(tmpdir(), 'cas-unregistered-'));
    const transcript = join(home, 'projects', 'unregistered', 'native-session.jsonl');
    await mkdir(dirname(transcript), { recursive: true });
    await writeFile(transcript, JSON.stringify({ type: 'user', cwd: unregisteredRoot, message: { role: 'user', content: 'stay personal' } }));
    process.env.CLAUDE_CONFIG_DIR = home;
    isolateOtherAgents(home);

    const sessions = new SessionService();
    await discoverNativeSessions(sessions, new WorkspaceService());

    const [session] = sessions.list();
    expect(session).toMatchObject({ scope: 'personal' });
    expect(session).not.toHaveProperty('projectId');
    expect(session).not.toHaveProperty('projectRoot');
  });
});

import { useEffect, useState } from 'react';
import type { WorkbenchTab } from '@codeagent-studio/protocol';
import { FileExplorer } from '../files/FileExplorer.js';
import { ChatPanel } from '../chat/ChatPanel.js';
import { EditorTab } from '../editor/EditorTab.js';

type Activity = 'files' | 'sessions';
export function Workbench() {
  const [activity, setActivity] = useState<Activity>('files');
  const [tabs, setTabs] = useState<WorkbenchTab[]>([{ kind: 'chat', sessionId: 'new-chat', scope: 'project' }]);
  const [activeTab, setActiveTab] = useState<WorkbenchTab>(tabs[0]);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [projectId, setProjectId] = useState('example-project');
  const [projectRoot, setProjectRoot] = useState<string | undefined>();
  const [personalSessions, setPersonalSessions] = useState<Array<{ id: string; provider: string }>>([]);
  const [projectSessions, setProjectSessions] = useState<Array<{ id: string; provider: string }>>([]);
  const [providerStatuses, setProviderStatuses] = useState<Array<{ provider: string; command?: string; installed: boolean; version?: string }>>([]);
  const [detectingProviders, setDetectingProviders] = useState(false);
  const [providerDetectionError, setProviderDetectionError] = useState<string | undefined>();
  const [projectError, setProjectError] = useState<string | undefined>();
  useEffect(() => { const api = (window as Window & { codeagent?: { workspace?: { projects: () => Promise<Array<{ id: string; rootPath?: string }>> } } }).codeagent?.workspace; if (!api) return; void api.projects().then((projects) => { if (projects[0]) { setProjectId(projects[0].id); setProjectRoot(projects[0].rootPath); } }).catch(() => setProjectError('项目列表加载失败，请重新选择项目。')); }, []);
  useEffect(() => { const list = (window as Window & { codeagentSessions?: { list: () => Promise<Array<{ id: string; provider: string; scope: 'personal' | 'project' }>> } }).codeagentSessions?.list; if (list) void list().then((sessions) => { setPersonalSessions(sessions.filter((session) => session.scope === 'personal').map(({ id, provider }) => ({ id, provider }))); setProjectSessions(sessions.filter((session) => session.scope === 'project').map(({ id, provider }) => ({ id, provider }))); }); }, []);
  const detectProviders = () => { const detect = (window as Window & { codeagent?: { providers?: { detect: () => Promise<Array<{ provider: string; installed: boolean; version?: string; command?: string }>> } } }).codeagent?.providers?.detect; if (detectingProviders) return; if (!detect) { setProviderDetectionError('Agent 检测接口不可用，请重启应用。'); setDetectingProviders(false); return; } setDetectingProviders(true); setProviderDetectionError(undefined); void detect().then(setProviderStatuses).catch(() => setProviderDetectionError('Agent 检测失败，请检查系统权限和 PATH。')).finally(() => setDetectingProviders(false)); };
  useEffect(() => { detectProviders(); }, []);

  const openExampleFile = async (path = 'README.md') => {
    const fileTab: WorkbenchTab = { kind: 'file', projectId, path, dirty: false };
    const api = (window as Window & { codeagent?: { workspace?: { read: (projectId: string, path: string) => Promise<string> } } }).codeagent?.workspace;
    if (api) { try { const content = await api.read(projectId, path); setFileContents((current) => ({ ...current, [`${projectId}:${path}`]: content })); } catch { setFileContents((current) => ({ ...current, [`${projectId}:${path}`]: current[`${projectId}:${path}`] ?? '' })); } }
    setTabs((current) => current.some((tab) => tab.kind === 'file' && tab.path === fileTab.path) ? current : [...current, fileTab]);
    setActiveTab(fileTab);
  };

  const tabName = (tab: WorkbenchTab) => tab.kind === 'chat' ? '聊天' : tab.path.split('/').pop() ?? tab.path;
  const isSameTab = (left: WorkbenchTab, right: WorkbenchTab) => left.kind === right.kind && (left.kind === 'chat' && right.kind === 'chat' ? left.sessionId === right.sessionId : left.kind === 'file' && right.kind === 'file' && left.projectId === right.projectId && left.path === right.path);
  const openSession = (id: string, scope: 'personal' | 'project', provider: string) => { const existing = tabs.find((tab) => tab.kind === 'chat' && tab.sessionId === id); const tab: WorkbenchTab = existing ?? { kind: 'chat', sessionId: id, scope, provider: provider as 'claude' | 'cursor' | 'codex' | 'pi' | 'opencode' }; if (!existing) setTabs((items) => [...items, tab]); setActiveTab(tab); };
  const newSession = (scope: 'personal' | 'project') => { const id = `${scope}-${crypto.randomUUID()}`; scope === 'personal' ? setPersonalSessions((items) => [...items, { id, provider: 'claude' }]) : setProjectSessions((items) => [...items, { id, provider: 'claude' }]); const tab = { kind: 'chat' as const, sessionId: id, scope, provider: 'claude' as const }; setTabs((items) => [...items, tab]); setActiveTab(tab); };

  return (
    <div className="codeagent-workbench">
      <aside aria-label="活动栏">
        <div role="tablist" aria-label="工作区入口">
          <button role="tab" aria-selected={activity === 'files'} onClick={() => setActivity('files')}>文件</button>
          <button role="tab" aria-selected={activity === 'sessions'} onClick={() => setActivity('sessions')}>会话</button>
        </div>
        <section aria-label="侧栏">
          {activity === 'files' ? (
            <div>
              <h2>文件资源管理器</h2>
              <button type="button" onClick={() => { const choose = (window as Window & { codeagent?: { workspace?: { chooseProject: () => Promise<{ id: string; rootPath?: string } | undefined> } } }).codeagent?.workspace?.chooseProject; if (!choose) { setProjectError('项目选择接口不可用，请重启应用。'); return; } setProjectError(undefined); void choose().then((project) => { if (project) { setProjectId(project.id); setProjectRoot(project.rootPath); } }).catch(() => setProjectError('项目选择失败，请确认目录可访问。')); }}>选择项目</button>
              {projectError && <p role="alert">{projectError}</p>}
              <FileExplorer projectId={projectId} onOpenFile={(path) => void openExampleFile(path)} />
              <div aria-label="Agent 状态"><h3>Agent 状态</h3>{detectingProviders && <p>正在检测 Agent…</p>}<button type="button" onClick={detectProviders} disabled={detectingProviders}>{detectingProviders ? '检测中…' : '重新检测'}</button>{providerDetectionError && <p role="alert">{providerDetectionError}</p>}{providerStatuses.map((status) => <p key={status.provider}>{status.provider}: {status.installed ? `已安装${status.version ? ` (${status.version})` : ''}` : '未安装'}{status.command ? ` · ${status.command}` : ''}</p>)}</div>
            </div>
          ) : (
            <div>
              <h2>个人会话</h2>
              <button type="button" onClick={() => newSession('personal')}>新建个人会话</button>
              {personalSessions.length === 0 ? <p>暂无个人会话</p> : personalSessions.map(({ id, provider }) => <button type="button" key={id} onClick={() => openSession(id, 'personal', provider)}>{id}</button>)}
              <h2>项目会话</h2>
              <button type="button" onClick={() => newSession('project')}>新建项目会话</button>
              {projectSessions.length === 0 ? <p>暂无项目会话</p> : projectSessions.map(({ id, provider }) => <button type="button" key={id} onClick={() => openSession(id, 'project', provider)}>{id}</button>)}
            </div>
          )}
        </section>
      </aside>
      <main>
        <div role="tablist" aria-label="打开的标签">
          {tabs.map((tab) => (
            <button key={tab.kind === 'chat' ? tab.sessionId : `${tab.projectId}:${tab.path}`} role="tab" aria-label={tabName(tab)} aria-selected={isSameTab(activeTab, tab)} onClick={() => setActiveTab(tab)}>
              {tabName(tab)}{tab.kind === 'file' && <span role="button" tabIndex={0} aria-label={`关闭 ${tabName(tab)}`} onClick={(event) => { event.stopPropagation(); setTabs((items) => items.filter((item) => !isSameTab(item, tab))); if (isSameTab(activeTab, tab)) setActiveTab({ kind: 'chat', sessionId: 'new-chat', scope: 'project' }); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); setTabs((items) => items.filter((item) => !isSameTab(item, tab))); if (isSameTab(activeTab, tab)) setActiveTab({ kind: 'chat', sessionId: 'new-chat', scope: 'project' }); } }}>×</span>}
            </button>
          ))}
        </div>
        {activeTab.kind === 'chat' ? (
          <section role="tabpanel" aria-label="聊天"><ChatPanel sessionId={activeTab.sessionId} providerName={activeTab.kind === 'chat' && activeTab.provider === 'opencode' ? 'OpenCode' : activeTab.kind === 'chat' && activeTab.provider ? activeTab.provider[0]!.toUpperCase() + activeTab.provider.slice(1) : 'Claude'} disabledProviders={providerStatuses.filter((status) => !status.installed).map((status) => status.provider === 'opencode' ? 'OpenCode' : status.provider[0]!.toUpperCase() + status.provider.slice(1))} loadMessages={async () => { const load = (window as Window & { codeagentSessions?: { messages: (id: string) => Promise<Array<{ id: string; role: 'user' | 'agent' | 'tool'; content: unknown; status?: 'done' | 'streaming' | 'error' }>> } }).codeagentSessions?.messages; if (!load) return []; return (await load(activeTab.sessionId)).map((message) => ({ id: message.id, role: message.role, content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content), status: message.status ?? 'done' })); }} subscribe={(listener) => (window as Window & { codeagentAgent?: { subscribe: (handler: (event: unknown) => void) => () => void } }).codeagentAgent?.subscribe((event) => listener(event as never))} onAbort={(sessionId) => (window as Window & { codeagentAgent?: { abort: (id: string) => Promise<unknown> } }).codeagentAgent?.abort(sessionId)} onPrompt={(text, provider) => { const id = provider.toLowerCase() as 'claude' | 'cursor' | 'codex' | 'pi' | 'opencode'; const scope = activeTab.scope; return (window as Window & { codeagentAgent?: { prompt: (input: unknown) => Promise<void> } }).codeagentAgent?.prompt({ sessionId: activeTab.sessionId, provider: id, scope, ...(scope === 'project' ? { projectId, projectRoot } : {}), text }); }} /><button type="button" aria-label="打开示例文件" onClick={() => void openExampleFile()}>打开示例文件</button></section>
        ) : (
          <section role="tabpanel" aria-label={tabName(activeTab)}>
            <EditorTab key={`${activeTab.projectId}:${activeTab.path}`} projectId={activeTab.projectId} path={activeTab.path} content={fileContents[`${activeTab.projectId}:${activeTab.path}`] ?? '# CodeAgent Studio\n'} useMonaco={typeof window.matchMedia === 'function'} onDirtyChange={(dirty) => setTabs((items) => items.map((item) => item.kind === 'file' && item.projectId === activeTab.projectId && item.path === activeTab.path ? { ...item, dirty } : item))} onSave={(content) => { setFileContents((current) => ({ ...current, [`${activeTab.projectId}:${activeTab.path}`]: content })); const write = (window as Window & { codeagent?: { workspace?: { write: (projectId: string, path: string, value: string) => Promise<unknown> } } }).codeagent?.workspace?.write; if (write) return write(activeTab.projectId, activeTab.path, content).then(() => { setTabs((items) => items.map((item) => item.kind === 'file' && item.projectId === activeTab.projectId && item.path === activeTab.path ? { ...item, dirty: false } : item)); }).catch((error: unknown) => { throw error instanceof Error ? error : new Error('文件保存失败'); }); }} />
          </section>
        )}
      </main>
    </div>
  );
}

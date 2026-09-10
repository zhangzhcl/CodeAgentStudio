import { useEffect, useState } from 'react';
import type { WorkbenchTab } from '@codeagent-studio/protocol';
import { FileExplorer } from '../files/FileExplorer.js';
import { ChatPanel } from '../chat/ChatPanel.js';
import { EditorTab } from '../editor/EditorTab.js';

type Activity = 'files' | 'sessions';
export function Workbench() {
  const [activity, setActivity] = useState<Activity>('files');
  const [tabs, setTabs] = useState<WorkbenchTab[]>([{ kind: 'chat', sessionId: 'new-chat' }]);
  const [activeTab, setActiveTab] = useState<WorkbenchTab>(tabs[0]);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [projectId, setProjectId] = useState('example-project');
  const [personalSessions, setPersonalSessions] = useState<string[]>([]);
  const [projectSessions, setProjectSessions] = useState<string[]>([]);
  const [providerStatuses, setProviderStatuses] = useState<Array<{ provider: string; command?: string; installed: boolean; version?: string }>>([]);
  useEffect(() => { const api = (window as Window & { codeagent?: { workspace?: { projects: () => Promise<Array<{ id: string }>> } } }).codeagent?.workspace; if (api) void api.projects().then((projects) => { if (projects[0]) setProjectId(projects[0].id); }); }, []);
  const detectProviders = () => { const detect = (window as Window & { codeagent?: { providers?: { detect: () => Promise<Array<{ provider: string; installed: boolean; version?: string; command?: string }>> } } }).codeagent?.providers?.detect; if (detect) void detect().then(setProviderStatuses); };
  useEffect(() => { detectProviders(); }, []);

  const openExampleFile = async (path = 'README.md') => {
    const fileTab: WorkbenchTab = { kind: 'file', projectId: 'example-project', path, dirty: false };
    const api = (window as Window & { codeagent?: { workspace?: { read: (projectId: string, path: string) => Promise<string> } } }).codeagent?.workspace;
    if (api) { try { const content = await api.read('example-project', path); setFileContents((current) => ({ ...current, [path]: content })); } catch { setFileContents((current) => ({ ...current, [path]: current[path] ?? '' })); } }
    setTabs((current) => current.some((tab) => tab.kind === 'file' && tab.path === fileTab.path) ? current : [...current, fileTab]);
    setActiveTab(fileTab);
  };

  const tabName = (tab: WorkbenchTab) => tab.kind === 'chat' ? '聊天' : tab.path.split('/').pop() ?? tab.path;
  const newSession = (scope: 'personal' | 'project') => { const id = `${scope}-${crypto.randomUUID()}`; scope === 'personal' ? setPersonalSessions((items) => [...items, id]) : setProjectSessions((items) => [...items, id]); const tab = { kind: 'chat' as const, sessionId: id }; setTabs((items) => [...items, tab]); setActiveTab(tab); };

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
              <button type="button" onClick={() => { const choose = (window as Window & { codeagent?: { workspace?: { chooseProject: () => Promise<{ id: string } | undefined> } } }).codeagent?.workspace?.chooseProject; if (choose) void choose().then((project) => { if (project) setProjectId(project.id); }); }}>选择项目</button>
              <FileExplorer projectId={projectId} onOpenFile={(path) => void openExampleFile(path)} />
              {providerStatuses.length > 0 && <div aria-label="Agent 状态"><h3>Agent 状态</h3><button type="button" onClick={detectProviders}>重新检测</button>{providerStatuses.map((status) => <p key={status.provider}>{status.provider}: {status.installed ? `已安装${status.version ? ` (${status.version})` : ''}` : '未安装'}{status.command ? ` · ${status.command}` : ''}</p>)}</div>}
            </div>
          ) : (
            <div>
              <h2>个人会话</h2>
              <button type="button" onClick={() => newSession('personal')}>新建个人会话</button>
              {personalSessions.length === 0 ? <p>暂无个人会话</p> : personalSessions.map((id) => <p key={id}>{id}</p>)}
              <h2>项目会话</h2>
              <button type="button" onClick={() => newSession('project')}>新建项目会话</button>
              {projectSessions.length === 0 ? <p>暂无项目会话</p> : projectSessions.map((id) => <p key={id}>{id}</p>)}
            </div>
          )}
        </section>
      </aside>
      <main>
        <div role="tablist" aria-label="打开的标签">
          {tabs.map((tab) => (
            <button key={tab.kind === 'chat' ? tab.sessionId : `${tab.projectId}:${tab.path}`} role="tab" aria-label={tabName(tab)} aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}>
              {tabName(tab)}{tab.kind === 'file' && <span role="button" tabIndex={0} aria-label={`关闭 ${tabName(tab)}`} onClick={(event) => { event.stopPropagation(); setTabs((items) => items.filter((item) => item !== tab)); if (activeTab === tab) setActiveTab({ kind: 'chat', sessionId: 'new-chat' }); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); setTabs((items) => items.filter((item) => item !== tab)); if (activeTab === tab) setActiveTab({ kind: 'chat', sessionId: 'new-chat' }); } }}>×</span>}
            </button>
          ))}
        </div>
        {activeTab.kind === 'chat' ? (
          <section role="tabpanel" aria-label="聊天"><ChatPanel sessionId={activeTab.sessionId} /><button type="button" aria-label="打开示例文件" onClick={() => void openExampleFile()}>打开示例文件</button></section>
        ) : (
          <section role="tabpanel" aria-label={tabName(activeTab)}>
            <EditorTab projectId={activeTab.projectId} path={activeTab.path} content={fileContents[activeTab.path] ?? '# CodeAgent Studio\n'} useMonaco={typeof window.matchMedia === 'function'} onSave={(content) => { setFileContents((current) => ({ ...current, [activeTab.path]: content })); const write = (window as Window & { codeagent?: { workspace?: { write: (projectId: string, path: string, value: string) => Promise<unknown> } } }).codeagent?.workspace?.write; if (write) void write(activeTab.projectId, activeTab.path, content).catch((error: unknown) => console.error('Failed to save file', error)); }} />
          </section>
        )}
      </main>
    </div>
  );
}

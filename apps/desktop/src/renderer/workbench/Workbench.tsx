import { useState } from 'react';
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

  const openExampleFile = async (path = 'README.md') => {
    const fileTab: WorkbenchTab = { kind: 'file', projectId: 'example-project', path, dirty: false };
    const api = (window as Window & { codeagent?: { workspace?: { read: (projectId: string, path: string) => Promise<string> } } }).codeagent?.workspace;
    if (api) setFileContents((current) => ({ ...current, [path]: current[path] ?? '' }));
    setTabs((current) => current.some((tab) => tab.kind === 'file' && tab.path === fileTab.path) ? current : [...current, fileTab]);
    setActiveTab(fileTab);
  };

  const tabName = (tab: WorkbenchTab) => tab.kind === 'chat' ? '聊天' : tab.path.split('/').pop() ?? tab.path;

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
              <FileExplorer onOpenFile={(path) => void openExampleFile(path)} />
            </div>
          ) : (
            <div>
              <h2>个人会话</h2>
              <p>暂无个人会话</p>
              <h2>项目会话</h2>
              <p>暂无项目会话</p>
            </div>
          )}
        </section>
      </aside>
      <main>
        <div role="tablist" aria-label="打开的标签">
          {tabs.map((tab) => (
            <button key={tab.kind === 'chat' ? tab.sessionId : `${tab.projectId}:${tab.path}`} role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}>
              {tabName(tab)}
            </button>
          ))}
        </div>
        {activeTab.kind === 'chat' ? (
          <section role="tabpanel" aria-label="聊天"><ChatPanel sessionId={activeTab.sessionId} /><button type="button" aria-label="打开示例文件" onClick={() => void openExampleFile()}>打开示例文件</button></section>
        ) : (
          <section role="tabpanel" aria-label={tabName(activeTab)}>
            <EditorTab projectId={activeTab.projectId} path={activeTab.path} content={fileContents[activeTab.path] ?? '# CodeAgent Studio\n'} useMonaco={typeof window.matchMedia === 'function'} onSave={(content) => setFileContents((current) => ({ ...current, [activeTab.path]: content }))} />
          </section>
        )}
      </main>
    </div>
  );
}

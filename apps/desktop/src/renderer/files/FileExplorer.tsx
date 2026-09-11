import { useEffect, useState } from 'react';
import type { WorkspaceEntry } from '@codeagent-studio/protocol';

type Props = {
  projectId?: string;
  projectName?: string;
  listEntries?: (relativePath: string) => Promise<WorkspaceEntry[]>;
  onOpenFile: (relativePath: string) => void;
  initialEntries?: WorkspaceEntry[];
};

// Hide only VCS internals and OS metadata. Project folders such as node_modules,
// dist and build outputs remain visible, matching the reference explorer.
const IGNORED = new Set(['.git', '.DS_Store', 'Thumbs.db']);

export function FileExplorer({ projectId, projectName = '项目', listEntries, onOpenFile, initialEntries = [] }: Props) {
  const resolvedList = listEntries ?? (projectId ? async (path: string) => { const api = (window as Window & { codeagent?: { workspace?: { list: (id: string, path?: string) => Promise<WorkspaceEntry[]> } } }).codeagent?.workspace; return api ? api.list(projectId, path) : []; } : async () => []);
  const [entries, setEntries] = useState<WorkspaceEntry[]>(initialEntries);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [children, setChildren] = useState<Record<string, WorkspaceEntry[]>>({});

  useEffect(() => {
    setExpanded(new Set());
    setChildren({});
    if (initialEntries.length === 0) void resolvedList('').then(setEntries);
    else setEntries(initialEntries);
  }, [initialEntries.length, projectId]);

  const toggle = async (entry: WorkspaceEntry) => {
    if (!entry.isDirectory) { onOpenFile(entry.path); return; }
    if (expanded.has(entry.path)) { setExpanded((current) => new Set([...current].filter((path) => path !== entry.path))); return; }
    const loaded = await resolvedList(entry.path);
    setChildren((current) => ({ ...current, [entry.path]: loaded }));
    setExpanded((current) => new Set(current).add(entry.path));
  };

  const renderEntries = (items: WorkspaceEntry[], depth = 0) => items.filter((entry) => !IGNORED.has(entry.name)).map((entry) => (
    <li key={entry.path}>
      <button type="button" style={{ paddingLeft: `${depth * 16 + 4}px` }} aria-label={entry.name} onClick={() => void toggle(entry)}>
        <span className="tree-chevron">{entry.isDirectory ? (expanded.has(entry.path) ? '⌄' : '›') : ''}</span><span className={entry.isDirectory ? 'folder-icon' : 'file-icon'}>{entry.isDirectory ? '▾' : '◈'}</span><span>{entry.name}</span>
      </button>
      {entry.isDirectory && expanded.has(entry.path) && <ul>{renderEntries(children[entry.path] ?? [], depth + 1)}</ul>}
    </li>
  ));

  if (!projectId && !listEntries && initialEntries.length === 0) return <div role="tree" aria-label="文件资源管理器"><p className="file-empty">请选择一个项目以查看文件</p></div>;
  return <section className="file-explorer" aria-label="文件资源管理器">
    <div className="file-explorer-toolbar"><span>资源管理器</span><button type="button" aria-label="资源管理器更多操作">•••</button></div>
    <div className="file-project-row"><span className="tree-chevron">⌄</span><span className="folder-icon">▾</span><strong>{projectName}</strong><div className="file-project-actions"><button type="button" aria-label="新建文件">＋</button><button type="button" aria-label="新建文件夹">▱</button><button type="button" aria-label="刷新文件树" onClick={() => void resolvedList('').then(setEntries)}>↻</button></div></div>
    <div role="tree">{entries.length === 0 ? <p className="file-empty">{projectId ? '项目中暂无可显示的文件' : '请选择一个项目'}</p> : <ul>{renderEntries(entries)}</ul>}</div>
  </section>;
}

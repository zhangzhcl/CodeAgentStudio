import { useEffect, useState } from 'react';
import type { WorkspaceEntry } from '@codeagent-studio/protocol';

type Props = {
  projectId?: string;
  listEntries?: (relativePath: string) => Promise<WorkspaceEntry[]>;
  onOpenFile: (relativePath: string) => void;
  initialEntries?: WorkspaceEntry[];
};

const IGNORED = new Set(['.git', 'node_modules']);

export function FileExplorer({ projectId, listEntries, onOpenFile, initialEntries = [] }: Props) {
  const resolvedList = listEntries ?? (projectId ? async (path: string) => { const api = (window as Window & { codeagent?: { workspace?: { list: (id: string, path?: string) => Promise<WorkspaceEntry[]> } } }).codeagent?.workspace; return api ? api.list(projectId, path) : []; } : async () => []);
  const [entries, setEntries] = useState<WorkspaceEntry[]>(initialEntries);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [children, setChildren] = useState<Record<string, WorkspaceEntry[]>>({});

  useEffect(() => {
    if (initialEntries.length === 0) void resolvedList('').then(setEntries);
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
        {entry.isDirectory ? (expanded.has(entry.path) ? '▾ ' : '▸ ') : '  '}{entry.name}
      </button>
      {entry.isDirectory && expanded.has(entry.path) && <ul>{renderEntries(children[entry.path] ?? [], depth + 1)}</ul>}
    </li>
  ));

  return <div role="tree" aria-label="文件资源管理器"><ul>{renderEntries(entries)}</ul></div>;
}

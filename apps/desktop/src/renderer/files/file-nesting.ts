const DEFAULT_CHILD_PATTERNS: Record<string, string[]> = {
  '.js': ['.js.map'],
  '.ts': ['.js', '.d.ts'],
  '.tsx': ['.js'],
};

export function nestEntries<T extends { name: string; isDirectory: boolean }>(entries: T[]): T[] {
  const parents = new Set<string>();
  const children = new Set<string>();
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const dot = entry.name.lastIndexOf('.');
    if (dot < 0) continue;
    const base = entry.name.slice(0, dot);
    const ext = entry.name.slice(dot);
    const parent = entries.find((candidate) => !candidate.isDirectory && candidate.name === base && (DEFAULT_CHILD_PATTERNS[ext]?.includes(ext) || DEFAULT_CHILD_PATTERNS[candidate.name.slice(candidate.name.lastIndexOf('.'))]?.includes(ext)));
    if (parent) { parents.add(parent.name); children.add(entry.name); }
  }
  return entries.filter((entry) => !children.has(entry.name)).map((entry) => parents.has(entry.name) ? { ...entry } : entry);
}

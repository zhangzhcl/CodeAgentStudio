import { useEffect, useState } from 'react';
import { MonacoEditor } from './MonacoEditor.js';

type Props = { path: string; content: string; projectId?: string; useMonaco?: boolean; onDirtyChange?: (dirty: boolean) => void; onSave: (content: string) => void };

export function EditorTab({ path, content: initialContent, projectId = 'default', useMonaco = false, onDirtyChange, onSave }: Props) {
  const [content, setContent] = useState(initialContent);
  const dirty = content !== initialContent;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  return (
    <section aria-label={path}>
      <header><span>{path}</span>{dirty && <span>未保存</span>}<button type="button" aria-label="保存" onClick={() => onSave(content)}>保存</button></header>
      {useMonaco ? <MonacoEditor projectId={projectId} path={path} value={content} onChange={setContent} /> : <textarea aria-label={path} value={content} onChange={(event) => setContent(event.target.value)} />}
    </section>
  );
}

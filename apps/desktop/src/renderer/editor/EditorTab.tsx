import { useState } from 'react';

type Props = { path: string; content: string; onSave: (content: string) => void };

export function EditorTab({ path, content: initialContent, onSave }: Props) {
  const [content, setContent] = useState(initialContent);
  const dirty = content !== initialContent;
  return (
    <section aria-label={path}>
      <header><span>{path}</span>{dirty && <span>未保存</span>}<button type="button" aria-label="保存" onClick={() => onSave(content)}>保存</button></header>
      <textarea aria-label={path} value={content} onChange={(event) => setContent(event.target.value)} />
    </section>
  );
}

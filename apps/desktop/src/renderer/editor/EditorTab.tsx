import { useEffect, useState } from 'react';
import { MonacoEditor } from './MonacoEditor.js';

type Props = { path: string; content: string; projectId?: string; useMonaco?: boolean; onDirtyChange?: (dirty: boolean) => void; onSave: (content: string) => void | Promise<void> };

export function EditorTab({ path, content: initialContent, projectId = 'default', useMonaco = false, onDirtyChange, onSave }: Props) {
  const [content, setContent] = useState(initialContent);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const dirty = content !== savedContent;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty]);
  const save = async () => { if (saving) return; setSaveError(undefined); setSaving(true); try { await onSave(content); setSavedContent(content); } catch (error) { setSaveError(error instanceof Error ? error.message : '文件保存失败'); } finally { setSaving(false); } };
  return (
    <section aria-label={path}>
      <header><span>{path}</span>{dirty && <span>未保存</span>}<button type="button" aria-label="保存" disabled={saving || !dirty} onClick={() => void save()}>{saving ? '保存中…' : '保存'}</button></header>
      {saveError && <p role="alert">{saveError}</p>}
      {useMonaco ? <MonacoEditor projectId={projectId} path={path} value={content} onChange={setContent} /> : <textarea aria-label={path} value={content} onChange={(event) => setContent(event.target.value)} />}
    </section>
  );
}

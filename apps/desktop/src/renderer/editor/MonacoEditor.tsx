import { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import { MonacoService } from './monaco-service.js';

const service = new MonacoService();
export function MonacoEditor({ projectId, path, value, onChange }: { projectId: string; path: string; value: string; onChange: (value: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!host.current) return; const key = `${projectId}:${path}` as `${string}:${string}`; const model = monaco.editor.createModel(value, undefined, monaco.Uri.parse(`codeagent://${projectId}/${path}`)); service.register(key, model); const editor = monaco.editor.create(host.current, { model, automaticLayout: true, minimap: { enabled: false }, scrollBeyondLastLine: false }); const subscription = model.onDidChangeContent(() => onChange(model.getValue())); return () => { subscription.dispose(); editor.dispose(); service.dispose(key); model.dispose(); }; }, [projectId, path]);
  return <div ref={host} style={{ width: '100%', height: '100%', minHeight: 320 }} aria-label={path} />;
}

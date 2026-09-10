import { useState, type ReactNode } from 'react';

function InlineMarkdown({ text }: { text: string }) { const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g); return <>{parts.map((part, index) => part.startsWith('`') && part.endsWith('`') ? <code className="inline-code" key={index}>{part.slice(1, -1)}</code> : part.startsWith('**') && part.endsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong> : part.startsWith('*') && part.endsWith('*') ? <em key={index}>{part.slice(1, -1)}</em> : <span key={index}>{part}</span>)}</>; }

export function MarkdownLite({ content }: { content: string }) {
  const thinking = content.match(/<think(?:ing)?>([\s\S]*?)<\/(?:think|thinking)>/i)?.[1];
  const visibleContent = content.replace(/<think(?:ing)?>[\s\S]*?<\/(?:think|thinking)>/gi, '').trim();
  const blocks = visibleContent.split(/```([\w+-]*)\n?([\s\S]*?)```/g);
  const nodes: ReactNode[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    if (index % 3 === 0) { const text = blocks[index] ?? ''; text.split(/\n{2,}/).filter(Boolean).forEach((paragraph, partIndex) => { const lines = paragraph.split('\n'); if (lines.every((line) => /^[-*] /.test(line))) nodes.push(<ul className="md-list" key={`list-${index}-${partIndex}`}>{lines.map((line) => <li key={line}><InlineMarkdown text={line.slice(2)} /></li>)}</ul>); else if (lines.every((line) => /^\d+\. /.test(line))) nodes.push(<ol className="md-list" key={`ordered-${index}-${partIndex}`}>{lines.map((line) => <li key={line}><InlineMarkdown text={line.replace(/^\d+\. /, '')} /></li>)}</ol>); else if (lines.every((line) => /^> ?/.test(line))) nodes.push(<blockquote className="md-quote" key={`quote-${index}-${partIndex}`}><InlineMarkdown text={lines.map((line) => line.replace(/^> ?/, '')).join('\n')} /></blockquote>); else if (/^#{1,3} /.test(lines[0] ?? '')) { const level = Math.min(3, (lines[0]!.match(/^#+/)?.[0].length ?? 1)); const Heading = level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4'; nodes.push(<Heading key={`heading-${index}-${partIndex}`}><InlineMarkdown text={lines[0]!.replace(/^#+\s*/, '')} /></Heading>); if (lines.length > 1) nodes.push(<p key={`heading-text-${index}-${partIndex}`}><InlineMarkdown text={lines.slice(1).join('\n')} /></p>); } else nodes.push(<p key={`text-${index}-${partIndex}`}><InlineMarkdown text={paragraph} /></p>); }); continue; }
    if (index % 3 === 1) continue;
    const language = blocks[index - 1] || 'code'; const code = blocks[index] ?? '';
    nodes.push(<CodeBlock key={`code-${index}`} language={language} code={code.trimEnd()} />);
  }
  return <div className="markdown-lite">{thinking && <details className="thinking-block"><summary>思考过程</summary><p>{thinking.trim()}</p></details>}{nodes}</div>;
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(code);
    } catch {
      const area = document.createElement('textarea');
      area.value = code;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };
  return <div className="md-code-shell"><div className="md-code-toolbar"><span>{language || 'code'}</span><button type="button" aria-label="复制代码" onClick={() => void copy()}>{copied ? '已复制' : '复制'}</button></div><pre className="md-code-block"><code data-language={language}>{code}</code></pre></div>;
}

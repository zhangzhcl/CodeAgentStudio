import type { ReactNode } from 'react';

function InlineMarkdown({ text }: { text: string }) { const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g); return <>{parts.map((part, index) => part.startsWith('`') && part.endsWith('`') ? <code className="inline-code" key={index}>{part.slice(1, -1)}</code> : part.startsWith('**') && part.endsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong> : <span key={index}>{part}</span>)}</>; }

export function MarkdownLite({ content }: { content: string }) {
  const thinking = content.match(/<think(?:ing)?>([\s\S]*?)<\/(?:think|thinking)>/i)?.[1];
  const visibleContent = content.replace(/<think(?:ing)?>[\s\S]*?<\/(?:think|thinking)>/gi, '').trim();
  const blocks = visibleContent.split(/```([\w+-]*)\n?([\s\S]*?)```/g);
  const nodes: ReactNode[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    if (index % 3 === 0) { const text = blocks[index] ?? ''; text.split(/\n{2,}/).filter(Boolean).forEach((paragraph, partIndex) => { const lines = paragraph.split('\n'); if (lines.every((line) => /^[-*] /.test(line))) nodes.push(<ul className="md-list" key={`list-${index}-${partIndex}`}>{lines.map((line) => <li key={line}><InlineMarkdown text={line.slice(2)} /></li>)}</ul>); else if (/^#{1,3} /.test(lines[0] ?? '')) { const level = Math.min(3, (lines[0]!.match(/^#+/)?.[0].length ?? 1)); const Heading = level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4'; nodes.push(<Heading key={`heading-${index}-${partIndex}`}><InlineMarkdown text={lines[0]!.replace(/^#+\s*/, '')} /></Heading>); if (lines.length > 1) nodes.push(<p key={`heading-text-${index}-${partIndex}`}><InlineMarkdown text={lines.slice(1).join('\n')} /></p>); } else nodes.push(<p key={`text-${index}-${partIndex}`}><InlineMarkdown text={paragraph} /></p>); }); continue; }
    if (index % 3 === 1) continue;
    const language = blocks[index - 1] || 'code'; const code = blocks[index] ?? '';
    nodes.push(<pre className="md-code-block" key={`code-${index}`}><code data-language={language}>{code.trimEnd()}</code></pre>);
  }
  return <div className="markdown-lite">{thinking && <details className="thinking-block"><summary>思考过程</summary><p>{thinking.trim()}</p></details>}{nodes}</div>;
}

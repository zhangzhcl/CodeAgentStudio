import { useState, type ReactNode } from "react";

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("`") && part.endsWith("`") ? (
          <code className="md-code-inline inline-code" key={index}>
            {part.slice(1, -1)}
          </code>
        ) : part.startsWith("**") && part.endsWith("**") ? (
          <strong className="md-strong" key={index}>
            {part.slice(2, -2)}
          </strong>
        ) : part.startsWith("*") && part.endsWith("*") ? (
          <em className="md-em" key={index}>
            {part.slice(1, -1)}
          </em>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

export function MarkdownLite({ content }: { content: string }) {
  const thinking = content.match(
    /<think(?:ing)?>([\s\S]*?)<\/(?:think|thinking)>/i,
  )?.[1];
  const visibleContent = content
    .replace(/<think(?:ing)?>[\s\S]*?<\/(?:think|thinking)>/gi, "")
    .trim();
  const blocks = visibleContent.split(/```([\w+-]*)\n?([\s\S]*?)```/g);
  const nodes: ReactNode[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    if (index % 3 === 0) {
      const text = blocks[index] ?? "";
      text
        .split(/\n{2,}/)
        .filter(Boolean)
        .forEach((paragraph, partIndex) => {
          const lines = paragraph.split("\n");
          if (lines.every((line) => /^[-*] \[[ x~>]\] /.test(line)))
            nodes.push(
              <div
                className="task-list-block"
                key={`tasks-${index}-${partIndex}`}
              >
                <div className="task-list-head">
                  执行计划{" "}
                  <span>
                    {lines.filter((line) => /^[-*] \[x\] /i.test(line)).length}/
                    {lines.length}
                  </span>
                </div>
                {lines.map((line, taskIndex) => {
                  const marker = line.match(/^[-*] \[([ x~>])\] /)?.[1] ?? " ";
                  const status =
                    marker.toLowerCase() === "x"
                      ? "done"
                      : marker === ">" || marker === "~"
                        ? "running"
                        : "pending";
                  return (
                    <div
                      className={`task-list-item task-${status}`}
                      key={`${line}-${taskIndex}`}
                    >
                      <span className="task-check" aria-hidden="true">
                        {status === "done"
                          ? "✓"
                          : status === "running"
                            ? "·"
                            : ""}
                      </span>
                      <span>
                        <InlineMarkdown
                          text={line.replace(/^[-*] \[[ x~>]\] /, "")}
                        />
                      </span>
                    </div>
                  );
                })}
              </div>,
            );
          else if (lines.every((line) => /^[-*] /.test(line)))
            nodes.push(
              <ul className="md-list" key={`list-${index}-${partIndex}`}>
                {lines.map((line) => (
                  <li key={line}>
                    <InlineMarkdown text={line.slice(2)} />
                  </li>
                ))}
              </ul>,
            );
          else if (lines.every((line) => /^\d+\. /.test(line)))
            nodes.push(
              <ol className="md-list" key={`ordered-${index}-${partIndex}`}>
                {lines.map((line) => (
                  <li key={line}>
                    <InlineMarkdown text={line.replace(/^\d+\. /, "")} />
                  </li>
                ))}
              </ol>,
            );
          else if (lines.every((line) => /^> ?/.test(line)))
            nodes.push(
              <blockquote
                className="md-quote"
                key={`quote-${index}-${partIndex}`}
              >
                <InlineMarkdown
                  text={lines
                    .map((line) => line.replace(/^> ?/, ""))
                    .join("\n")}
                />
              </blockquote>,
            );
          else if (/^#{1,3} /.test(lines[0] ?? "")) {
            const level = Math.min(3, lines[0]!.match(/^#+/)?.[0].length ?? 1);
            const Heading = level === 1 ? "h2" : level === 2 ? "h3" : "h4";
            nodes.push(
              <Heading key={`heading-${index}-${partIndex}`}>
                <InlineMarkdown text={lines[0]!.replace(/^#+\s*/, "")} />
              </Heading>,
            );
            if (lines.length > 1)
              nodes.push(
                <p key={`heading-text-${index}-${partIndex}`}>
                  <InlineMarkdown text={lines.slice(1).join("\n")} />
                </p>,
              );
          } else
            nodes.push(
              <p key={`text-${index}-${partIndex}`}>
                <InlineMarkdown text={paragraph} />
              </p>,
            );
        });
      continue;
    }
    if (index % 3 === 1) continue;
    const language = blocks[index - 1] || "code";
    const code = blocks[index] ?? "";
    nodes.push(
      <CodeBlock
        key={`code-${index}`}
        language={language}
        code={code.trimEnd()}
      />,
    );
  }
  return (
    <div className="md markdown-lite">
      {thinking && (
        <details className="think thinking-block">
          <summary className="think-head">思考过程</summary>
          <p className="think-text">{thinking.trim()}</p>
        </details>
      )}
      {nodes}
    </div>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(code);
    } catch {
      const area = document.createElement("textarea");
      area.value = code;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div className="md-code-block">
      <div className="md-code-head">
        <span className="md-code-lang">{language || "text"}</span>
        <button
          className={`md-code-copy${copied ? " is-ok" : ""}`}
          type="button"
          aria-label="复制代码"
          onClick={() => void copy()}
        >
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <pre>
        <code data-language={language}>{code}</code>
      </pre>
    </div>
  );
}

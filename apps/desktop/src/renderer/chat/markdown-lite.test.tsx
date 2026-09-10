import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { MarkdownLite } from './markdown-lite.js';

describe('MarkdownLite', () => {
  it('renders headings, lists and inline code', () => {
    render(<MarkdownLite content={'## 目录\n\n- `apps`\n- **packages**'} />);
    expect(screen.getByRole('heading', { name: '目录' })).toBeInTheDocument();
    expect(screen.getByText('apps')).toHaveClass('inline-code');
    expect(screen.getByText('packages').tagName).toBe('STRONG');
  });
  it('renders fenced code and collapsible thinking', () => {
    const { container } = render(<MarkdownLite content={'<think>先检查目录</think>\n\n```ts\nconst ok = true\n```'} />);
    expect(screen.getByText('思考过程')).toBeInTheDocument();
    expect(screen.getByText('const ok = true')).toBeInTheDocument();
    expect(container.querySelector('code[data-language="ts"]')).toBeInTheDocument();
  });
  it('renders emphasis, ordered lists and quote blocks', () => {
    const { container } = render(<MarkdownLite content={'*重点*\n\n1. 第一步\n2. 第二步\n\n> 这是引用'} />);
    expect(screen.getByText('重点').tagName).toBe('EM');
    expect(container.querySelector('ol')).toBeInTheDocument();
    expect(container.querySelector('blockquote')).toHaveTextContent('这是引用');
  });
});

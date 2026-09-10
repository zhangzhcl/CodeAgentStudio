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
    render(<MarkdownLite content={'<think>先检查目录</think>\n\n```ts\nconst ok = true\n```'} />);
    expect(screen.getByText('思考过程')).toBeInTheDocument();
    expect(screen.getByText('const ok = true')).toBeInTheDocument();
    expect(screen.getByText('ts')).toBeInTheDocument();
  });
});

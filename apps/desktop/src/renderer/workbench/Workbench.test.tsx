import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { Workbench } from './Workbench.js';

describe('Workbench', () => {
  it('shows files and sessions activities with chat as the default tab', async () => {
    render(<Workbench />);
    await waitFor(() => expect(screen.getByRole('tabpanel', { name: '聊天' })).toBeInTheDocument());

    expect(screen.getByRole('tab', { name: '文件' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '会话' })).toBeInTheDocument();
    expect(screen.getByRole('tabpanel', { name: '聊天' })).toBeInTheDocument();
  });

  it('switches the sidebar to sessions and exposes personal and project groups', async () => {
    render(<Workbench />);
    await waitFor(() => expect(screen.getByRole('tabpanel', { name: '聊天' })).toBeInTheDocument());

    expect(screen.getByRole('heading', { name: '会话' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '项目' })).toBeInTheDocument();
  });

  it('does not show a fake example-file action', async () => {
    render(<Workbench />);
    await waitFor(() => expect(screen.getByRole('tabpanel', { name: '聊天' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: '打开示例文件' })).not.toBeInTheDocument();
  });

  it('does not remain in detecting state when the provider bridge is unavailable', async () => {
    render(<Workbench />);

    await waitFor(() => expect(screen.getByText('Agent 未就绪')).toBeInTheDocument());
    expect(screen.queryByText('正在检测 Agent…')).not.toBeInTheDocument();
  });

  it('reports project selection bridge failures instead of silently ignoring them', async () => {
    render(<Workbench />);

    fireEvent.click(screen.getByRole('tab', { name: '文件' }));
    fireEvent.click(screen.getByRole('button', { name: '选择项目' }));

    await waitFor(() => expect(screen.getAllByRole('alert').some((element) => element.textContent?.includes('项目选择接口不可用'))).toBe(true));
  });

  it('switches and persists the global color theme', async () => {
    window.localStorage.removeItem('codeagent-theme');
    render(<Workbench />);
    const toggle = await screen.findByRole('button', { name: '切换浅色主题' });
    fireEvent.click(toggle);
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(window.localStorage.getItem('codeagent-theme')).toBe('light');
  });
});

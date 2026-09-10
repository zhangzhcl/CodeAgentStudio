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

    fireEvent.click(screen.getByRole('tab', { name: '会话' }));

    expect(screen.getByRole('heading', { name: '个人会话' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '项目会话' })).toBeInTheDocument();
  });

  it('opens a file tab without removing the chat tab', async () => {
    render(<Workbench />);
    await waitFor(() => expect(screen.getByRole('tabpanel', { name: '聊天' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '打开示例文件' }));

    expect(screen.getByRole('tab', { name: '聊天' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'README.md' })).toBeInTheDocument();
    expect(screen.getByRole('tabpanel', { name: 'README.md' })).toBeInTheDocument();
  });

  it('closes a file tab and returns to chat', async () => {
    render(<Workbench />);
    await waitFor(() => expect(screen.getByRole('tabpanel', { name: '聊天' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '打开示例文件' }));
    fireEvent.click(screen.getByRole('button', { name: '关闭 README.md' }));
    expect(screen.getByRole('tabpanel', { name: '聊天' })).toBeInTheDocument();
  });
});

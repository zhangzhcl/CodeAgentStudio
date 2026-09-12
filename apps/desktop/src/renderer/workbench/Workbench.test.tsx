import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Workbench } from './Workbench.js';

describe('Workbench', () => {
  afterEach(() => {
    delete (window as Window & { codeagentSessions?: unknown }).codeagentSessions;
  });
  it('shows files and sessions activities with chat as the default tab', async () => {
    render(<Workbench />);
    await waitFor(() => expect(screen.getByRole('tabpanel', { name: '聊天' })).toBeInTheDocument());

    expect(screen.getByRole('tab', { name: '文件' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '会话' })).toBeInTheDocument();
    expect(screen.getByRole('tabpanel', { name: '聊天' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '选择 Agent' })).toHaveValue('');
    expect(screen.getByRole('heading', { name: '请选择 Agent' })).toBeInTheDocument();
  });

  it('requires an explicit Agent before creating a session', async () => {
    render(<Workbench />);
    const create = await screen.findByRole('button', { name: '新建会话' });
    expect(create).toBeDisabled();

    fireEvent.change(screen.getByRole('combobox', { name: '选择 Agent' }), {
      target: { value: 'pi' },
    });
    expect(create).not.toBeDisabled();
    expect(screen.getByRole('combobox', { name: '选择 Agent' })).toHaveValue('pi');
  });

  it('omits the already selected Agent name from sidebar session titles', () => {
    render(<Workbench />);
    fireEvent.change(screen.getByRole('combobox', { name: '选择 Agent' }), {
      target: { value: 'pi' },
    });
    fireEvent.click(screen.getByRole('button', { name: '新建会话' }));

    expect(document.querySelector('.conv-title')).not.toHaveTextContent('Pi ·');
  });

  it('does not select a session when an Agent is chosen', async () => {
    render(<Workbench />);

    fireEvent.change(screen.getByRole('combobox', { name: '选择 Agent' }), {
      target: { value: 'claude' },
    });

    expect(
      screen.getByRole('heading', { name: '请选择会话，或者创建新的会话开始' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Agent 对话' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '新建会话' }));
    expect(screen.getByRole('region', { name: 'Agent 对话' })).toBeInTheDocument();
    expect(document.querySelectorAll('.chat-tab')).toHaveLength(1);

    fireEvent.change(screen.getByRole('combobox', { name: '选择 Agent' }), {
      target: { value: 'pi' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: '选择 Agent' }), {
      target: { value: 'claude' },
    });

    expect(
      screen.getByRole('heading', { name: '请选择会话，或者创建新的会话开始' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Agent 对话' })).not.toBeInTheDocument();
    expect(document.querySelectorAll('.chat-tab')).toHaveLength(0);
  });

  it('switches the sidebar to sessions and exposes personal and project groups', async () => {
    render(<Workbench />);
    await waitFor(() => expect(screen.getByRole('tabpanel', { name: '聊天' })).toBeInTheDocument());

    expect(screen.getByRole('tab', { name: '项目' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '项目' }));
    expect(screen.getByRole('button', { name: '新建项目' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新建会话' })).not.toBeInTheDocument();
  });

  it('does not show a fake example-file action', async () => {
    render(<Workbench />);
    await waitFor(() => expect(screen.getByRole('tabpanel', { name: '聊天' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: '打开示例文件' })).not.toBeInTheDocument();
  });

  it('does not remain in detecting state when the provider bridge is unavailable', async () => {
    render(<Workbench />);

    await waitFor(() => expect(screen.getByText('未就绪')).toBeInTheDocument());
    expect(screen.queryByText('正在检测 Agent…')).not.toBeInTheDocument();
  });

  it('reports project selection bridge failures instead of silently ignoring them', async () => {
    render(<Workbench />);

    fireEvent.click(screen.getByRole('tab', { name: '文件' }));
    fireEvent.click(screen.getByRole('button', { name: '打开文件夹' }));

    await waitFor(() => expect(screen.getAllByRole('alert').some((element) => element.textContent?.includes('打开文件夹接口不可用'))).toBe(true));
  });

  it('switches and persists the global color theme', async () => {
    window.localStorage.removeItem('codeagent-theme');
    render(<Workbench />);
    const toggle = await screen.findByRole('button', { name: '切换浅色主题' });
    fireEvent.click(toggle);
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(window.localStorage.getItem('codeagent-theme')).toBe('light');
  });

  it('offers an explicit delete action for the active single session', async () => {
    render(<Workbench />);
    fireEvent.change(screen.getByRole('combobox', { name: '选择 Agent' }), { target: { value: 'claude' } });
    fireEvent.click(screen.getByRole('button', { name: '新建会话' }));

    expect(await screen.findByRole('button', { name: '删除当前会话' })).toBeEnabled();
  });

  it('keeps a session in the list when native deletion fails', async () => {
    const remove = vi.fn().mockRejectedValue(new Error('无法删除 Agent 原生会话'));
    (window as Window & { codeagentSessions?: unknown }).codeagentSessions = {
      list: vi.fn().mockResolvedValue([{ id: 'native-session', provider: 'claude', scope: 'personal', title: '原生会话' }]),
      delete: remove,
    };
    render(<Workbench />);
    fireEvent.change(screen.getByRole('combobox', { name: '选择 Agent' }), { target: { value: 'claude' } });
    const deleteButton = await screen.findByRole('button', { name: '删除会话 原生会话' });
    fireEvent.click(deleteButton);
    fireEvent.click(screen.getByRole('button', { name: '再次点击确认删除 原生会话' }));

    await waitFor(() => expect(screen.getAllByRole('alert').some((element) => element.textContent?.includes('无法删除 Agent 原生会话'))).toBe(true));
    expect(screen.getByText('原生会话')).toBeInTheDocument();
  });

  it('creates a project session with the clicked project id on the first try', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    (window as Window & { codeagent?: unknown }).codeagent = {
      workspace: {
        projects: vi.fn().mockResolvedValue([
          { id: 'project-a', name: 'Alpha', rootPath: 'D:/work/alpha' },
          { id: 'project-b', name: 'Beta', rootPath: 'D:/work/beta' },
        ]),
      },
    };
    (window as Window & { codeagentSessions?: unknown }).codeagentSessions = { create };
    try {
      render(<Workbench />);
      fireEvent.change(screen.getByRole('combobox', { name: '选择 Agent' }), { target: { value: 'claude' } });
      fireEvent.click(screen.getByRole('tab', { name: '项目' }));

      // 第一次点击就必须带上所点项目的 projectId，不能出现未关联会话或串到上一个项目
      fireEvent.click(await screen.findByRole('button', { name: '在 Beta 中新建会话' }));
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ provider: 'claude', scope: 'project', projectId: 'project-b' }));

      fireEvent.click(screen.getByRole('button', { name: '在 Alpha 中新建会话' }));
      expect(create).toHaveBeenCalledTimes(2);
      expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'project', projectId: 'project-a' }));
      expect(screen.queryByText(/未关联/)).not.toBeInTheDocument();
    } finally {
      delete (window as Window & { codeagent?: unknown }).codeagent;
    }
  });
});
